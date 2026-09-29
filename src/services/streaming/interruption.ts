/**
 * 生成中断分类（Generation Interruption Taxonomy）
 * ------------------------------------------------------------------
 * 背景：内容生成"没写完就截止"其实有多种**互不相同**的原因，其中只有一种属于模型自身：
 *
 *   模型侧（model）
 *     - length          模型撞上 max_tokens（finish_reason='length'）→ 唯一"输出上限"原因
 *     - content_filter  被模型安全策略拦截（finish_reason='content_filter'）
 *
 *   链路侧（link）
 *     - timeout         首字节超时（60s 内一个字节都没到）
 *     - network         传输层失败（fetch 抛错 / body 读取中断 / 连接被重置）
 *     - protocol        SSE 协议解析失败（流内 error、body 不可读）
 *     - http            HTTP 非 2xx（鉴权/额度/限流/服务端异常）
 *
 *   内容侧（content）
 *     - incomplete      流正常结束但 JSON 未闭合（网关静默截断，无 finish_reason）
 *     - parse           内容到了但解析不出 JSON
 *
 *   用户侧（user）
 *     - aborted         用户主动取消（重新搜索 / 重置）
 *
 * 为什么要分类：
 *   1. **续写策略不同**：模型侧的 length 与链路侧的抖动都值得"接着写"，安全策略拦截/用户取消则不值得
 *      再发一次请求（见 canContinueAfter）。
 *   2. **提示文案不同**：绝不能把网络中断说成"模型输出上限被截断"——那是错误归因。
 *   3. **可观测**：每类中断都带 code，便于在 UI 与日志里定位到底是厂商、网关还是本地网络的问题。
 */

import type { AIError, GenerationInterruption, InterruptionKind, InterruptionSide } from '../../types';
import {
  StreamProtocolError,
  StreamTimeoutError,
  StreamNetworkError,
  StreamAbortedError,
} from './sseReader';

/**
 * 类型定义在 `types/ai.ts`（单一来源，服务层/状态机/UI 共用同一套语义），这里做转发，
 * 让"中断分类"这一主题的读写集中在一个模块内。
 */
export type { GenerationInterruption, InterruptionKind, InterruptionSide };

interface KindMeta {
  side: InterruptionSide;
  code: string;
  retryable: boolean;
}

/**
 * 每种中断的默认元信息（side / 标准 code / 是否值得重试）。
 * 注意 retryable 的语义是「值得用户手动重试」，不是「续写循环可以自动再发」——
 * 后者由 canContinueAfter 单独判定（自动再发要更保守）。
 */
const KIND_META: Record<InterruptionKind, KindMeta> = {
  length: { side: 'model', code: 'OUTPUT_TRUNCATED', retryable: true },
  content_filter: { side: 'model', code: 'CONTENT_FILTERED', retryable: false },
  incomplete: { side: 'content', code: 'STREAM_INCOMPLETE', retryable: true },
  timeout: { side: 'link', code: 'STREAM_TIMEOUT', retryable: true },
  network: { side: 'link', code: 'STREAM_NETWORK', retryable: true },
  protocol: { side: 'link', code: 'STREAM_PROTOCOL', retryable: true },
  http: { side: 'link', code: 'HTTP_ERROR', retryable: true },
  aborted: { side: 'user', code: 'STREAM_ABORTED', retryable: false },
  parse: { side: 'content', code: 'GENERATE_FAILED', retryable: false },
};

/** 由种类构造中断信息（字段可被 extra 覆盖，例如 http 类要带上厂商返回的 code） */
export function createInterruption(
  kind: InterruptionKind,
  extra: Partial<Omit<GenerationInterruption, 'kind' | 'side'>> = {}
): GenerationInterruption {
  const meta = KIND_META[kind];
  return {
    kind,
    side: meta.side,
    code: extra.code ?? meta.code,
    retryable: extra.retryable ?? meta.retryable,
    resolved: extra.resolved ?? false,
    attempts: extra.attempts,
    continued: extra.continued,
    detail: extra.detail,
    httpStatus: extra.httpStatus,
  };
}

/** 把 finish_reason 映射为模型侧中断种类；无 finish_reason 视为"网关静默截断" */
export function kindFromFinishReason(finishReason?: string): InterruptionKind {
  if (finishReason === 'length') return 'length';
  if (
    finishReason === 'content_filter' ||
    finishReason === 'content_filter_error' ||
    finishReason === 'safety'
  ) {
    return 'content_filter';
  }
  return 'incomplete';
}

/**
 * 该中断是否允许**续写循环自动再发一次请求**。
 *
 * 策略（与用户确认过的边界一致）：
 *   - 模型侧 length / 内容侧 incomplete → 一定要接着写（这是"没写完"的正解）
 *   - 链路侧 timeout / network / protocol → 抖动类，值得再试（有内容就续写，没内容就按原 prompt 重发）
 *   - 链路侧 http → 仅"已有内容 且 厂商侧标记可重试（5xx/429）"才自动再试；
 *     鉴权/额度类绝不重试（重试必然同样失败）
 *   - content_filter → 不重试（同样的内容会被同样拦下）
 *   - aborted（用户取消）→ 不重试
 *   - parse（内容根本不是 JSON）→ 不重试（回填非 JSON 前缀续写没有意义）
 *
 * 次数上限不在这里管：由调用方用 MAX_GENERATION_ATTEMPTS 兜住（硬上限，绝不无限重试）。
 */
export function canContinueAfter(
  kind: InterruptionKind,
  ctx: { hasContent: boolean; retryable?: boolean }
): boolean {
  switch (kind) {
    case 'length':
    case 'incomplete':
    case 'timeout':
    case 'network':
    case 'protocol':
      return true;
    case 'http':
      return ctx.retryable === true && ctx.hasContent;
    case 'content_filter':
    case 'aborted':
    case 'parse':
    default:
      return false;
  }
}

/**
 * 把异常归一为中断信息。
 *
 * 认得的异常按类型精确归类；带 `aiError` 的按 HTTP 错误归类（保留厂商 code/是否可重试）；
 * 认不出的按内容侧 parse 兜底（GENERATE_FAILED）——**绝不返回 null**，
 * 这样上层永远有一个明确的原因可以展示，不会出现"截断了但不知道为什么"。
 */
export function classifyThrown(error: unknown): GenerationInterruption {
  if (error instanceof GenerationInterruptedError) {
    return { ...error.interruption, detail: error.interruption.detail ?? error.message };
  }
  if (error instanceof StreamTimeoutError) {
    return createInterruption('timeout', { detail: error.message, retryable: true });
  }
  if (error instanceof StreamNetworkError) {
    return createInterruption('network', { detail: error.message, retryable: true });
  }
  if (error instanceof StreamProtocolError) {
    return createInterruption('protocol', { detail: error.message, retryable: true });
  }
  if (error instanceof StreamAbortedError) {
    return createInterruption('aborted', { detail: error.message, retryable: false });
  }
  const anyErr = error as { aiError?: AIError; httpStatus?: number; name?: string; message?: string };
  if (anyErr?.aiError) {
    return createInterruption('http', {
      code: anyErr.aiError.code,
      detail: anyErr.aiError.message,
      retryable: anyErr.aiError.retryable,
      httpStatus: anyErr.httpStatus,
    });
  }
  if (anyErr?.name === 'AbortError') {
    return createInterruption('aborted', { detail: anyErr.message, retryable: false });
  }
  return createInterruption('parse', {
    code: 'GENERATE_FAILED',
    detail: anyErr?.message ?? String(error),
    retryable: false,
  });
}

/**
 * 由标准错误码反推中断信息（给"只拿到 code 的一侧"用，例如状态机读 AIResponse.error.code）。
 *
 * 用途：错误从服务层透传到 UI 后，UI 仍需要知道"这是模型侧还是链路侧"才能给对文案。
 */
export function interruptionFromCode(code: string | undefined, detail?: string): GenerationInterruption {
  switch (code) {
    case 'OUTPUT_TRUNCATED':
      return createInterruption('length', { detail });
    case 'STREAM_INCOMPLETE':
      return createInterruption('incomplete', { detail });
    case 'STREAM_TIMEOUT':
      return createInterruption('timeout', { detail });
    case 'STREAM_NETWORK':
      return createInterruption('network', { detail });
    case 'STREAM_PROTOCOL':
      return createInterruption('protocol', { detail });
    case 'STREAM_ABORTED':
      return createInterruption('aborted', { detail });
    case 'CONTENT_FILTERED':
      return createInterruption('content_filter', { detail });
    case 'INVALID_API_KEY':
    case 'QUOTA_EXCEEDED':
    case 'RATE_LIMITED':
    case 'SERVER_ERROR':
      return createInterruption('http', { code, detail, retryable: code !== 'INVALID_API_KEY' && code !== 'QUOTA_EXCEEDED' });
    default:
      return createInterruption('parse', { code: code ?? 'GENERATE_FAILED', detail });
  }
}

/**
 * 生成被中断的异常。
 *
 * 与普通 Error 的区别：它**带着分类信息**（以及可选的已生成内容），
 * 所以 withFallback / 状态机不必再靠字符串匹配去猜原因。
 */
export class GenerationInterruptedError extends Error {
  readonly interruption: GenerationInterruption;
  /** 中断前已收到的内容（可能为空） */
  readonly partial?: string;

  constructor(interruption: GenerationInterruption, message: string, partial?: string) {
    super(message);
    this.name = 'GenerationInterruptedError';
    this.interruption = interruption;
    this.partial = partial;
  }
}
