/**
 * SSE（Server-Sent Events）流读取器
 * ------------------------------------------------------------------
 * 职责：把 OpenAI 兼容接口的 stream=true 响应，解码成一串文本增量。
 *
 * 只做三件事：
 *   1. 按行切分 SSE（处理跨 chunk 的半行）
 *   2. 从 `data: {...}` 里掏出 choices[0].delta.content
 *   3. 识别 `[DONE]` 与流内错误，抛给上层决定降级还是报错
 *
 * 不关心业务语义 —— 增量交给上层缓冲区（StreamingJSONParser / StreamingTextBuffer）。
 */

export interface SSEStreamResult {
  /** 拼接后的完整文本 */
  text: string;
  /** 实际收到过增量（false 说明服务端没走 SSE，需要降级） */
  streamed: boolean;
  /** 服务端返回的模型名（可能在最后一个 chunk 里） */
  model?: string;
  /**
   * 服务端给出的结束原因：
   *   'stop'                 → 自然结束
   *   'length'               → 撞上 max_tokens，输出被**截断**（内容不完整！）
   *   'content_filter' 等    → 被安全策略中断
   * 未收到显式结束标记时为 undefined。
   */
  finishReason?: string;
  /** 是否因输出上限被截断（finish_reason === 'length'）。true 时 text 是半截内容，绝不能当完整结果用 */
  truncated: boolean;
  /** 收到过思维链增量：说明服务端确实在流式输出，只是还在"思考"、正文未开始 */
  receivedReasoning: boolean;
}

export class StreamProtocolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StreamProtocolError';
  }
}

/**
 * 首字节超时：服务端迟迟不发任何字节（既没正文也没思维链）。
 *
 * 跟 StreamProtocolError 的区别：超时是**链路侧**问题（网关/网络卡死），
 * 不能误判为"模型不支持流式"这种能力结论；协议错误才是"服务端声明流式但没按 SSE 干活"。
 * 两者都向上抛，由 interruption.ts 归类后在 UI 上给出**不同**的原因文案。
 */
export class StreamTimeoutError extends Error {
  /** 超时已等待的毫秒数（用于错误文案与可观测日志） */
  readonly elapsedMs: number;
  constructor(message: string, elapsedMs: number) {
    super(message);
    this.name = 'StreamTimeoutError';
    this.elapsedMs = elapsedMs;
  }
}

/**
 * 传输层失败：fetch 抛错（DNS/断网/网关拒绝）或**流读到一半连接被重置**。
 *
 * 这类失败以前会以裸 TypeError 形式冒泡，被 withFallback 的兜底分支
 * 吞成 success:true + 空结构体 —— 于是"已流出的内容被丢弃、页面空白、零提示"。
 * 现在显式归类为链路侧中断：已收到的内容必须保留并展示，原因是"网络中断"。
 */
export class StreamNetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StreamNetworkError';
  }
}

/** 用户主动取消（重新搜索 / 重置 / 切模块）—— 不是故障，不该提示为错误 */
export class StreamAbortedError extends Error {
  constructor(message = '生成已取消') {
    super(message);
    this.name = 'StreamAbortedError';
  }
}

/** 从一行 SSE data 中提取增量文本；返回 null 表示这一行不是内容增量 */
function extractDelta(line: string): {
  delta: string;
  /** 思维链增量（reasoning_content / reasoning）—— 思考中的模型会先输出很长一段，
   *  它不属于正文，但必须让上层知道"模型在动"，否则界面会长时间零反馈 */
  reasoning?: string;
  done: boolean;
  model?: string;
  error?: string;
  finishReason?: string;
} | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  if (!trimmed.startsWith('data:')) return null;

  const payload = trimmed.slice(5).trim();
  if (!payload) return null;
  if (payload === '[DONE]') return { delta: '', done: true };

  try {
    const json = JSON.parse(payload);
    // 流内错误（部分厂商在 200 响应体里塞 error）
    if (json?.error) {
      return { delta: '', done: false, error: json.error?.message || 'stream error' };
    }
    const choice = json?.choices?.[0];
    const delta: string = choice?.delta?.content ?? '';
    // 思维链：各厂商字段名不统一，常见 reasoning_content / reasoning / thinking
    const reasoning: string | undefined =
      typeof choice?.delta?.reasoning_content === 'string'
        ? choice.delta.reasoning_content
        : typeof choice?.delta?.reasoning === 'string'
        ? choice.delta.reasoning
        : undefined;
    const model: string | undefined = json?.model;
    // finish_reason 出现即视为结束（部分厂商不发 [DONE]）。
    // 关键：必须把 finish_reason 的**值**带出去 —— 'length' 表示撞上 max_tokens，
    // 此时 text 是半截内容，上层需要据此提示用户或重试，而不能当作完整结果。
    const finishReason: string | undefined = choice?.finish_reason ?? json?.finish_reason;
    if (finishReason) return { delta, reasoning, done: true, model, finishReason };
    return { delta, reasoning, done: false, model };
  } catch {
    // 非 JSON 的 data 行：忽略（心跳注释等）
    return null;
  }
}

/**
 * 读取 SSE 流。
 *
 * @param response  fetch 返回的响应（必须未消费过 body）
 * @param onDelta   每收到一段文本就回调一次（生产者写入缓冲区）
 * @param signal    可选的中断信号
 * @param onReasoning  思维链增量回调（可选）：只用于 UI 展示"模型思考中"，不参与正文拼接
 * @param firstByteTimeoutMs
 *   首字节超时（毫秒）。从进入函数开始计时，**在收到任何字节（delta 或 reasoning）之前**
 *   超过该时长仍未读到第一个字节 → 主动 abort 并抛 StreamTimeoutError。
 *   已收到至少一个字节后就不再超时（避免误杀慢速流）。默认 60s：
 *     - 思考型模型首字节慢的常见量级 10~30s，60s 已足够宽裕
 *     - 511s 这种级别基本是网关/网络层卡死，必须中断兜底
 *     - 设 0 / 负数表示禁用超时
 */
export async function readSSEStream(
  response: Response,
  onDelta: (chunk: string) => void,
  signal?: AbortSignal,
  onReasoning?: (chunk: string) => void,
  firstByteTimeoutMs: number = 60_000
): Promise<SSEStreamResult> {
  const body = response.body;
  if (!body || typeof (body as any).getReader !== 'function') {
    // 运行环境不支持流式读取（老浏览器 / 某些 polyfill）→ 交由上层降级
    throw new StreamProtocolError('response.body 不可读，无法流式解析');
  }

  const reader = (body as any).getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let text = '';
  let streamed = false;
  let model: string | undefined;
  let finishReason: string | undefined;
  let receivedReasoning = false;
  let firstByteReceived = false;

  // 首字节超时：从发起读取开始计时；已收到任意字节后立即清掉 timer，
  // 避免"流着流着忽然 abort"误杀正常慢速模型。
  const enableTimeout = firstByteTimeoutMs > 0;
  const startedAt = enableTimeout ? Date.now() : 0;
  let firstByteTimer: ReturnType<typeof setTimeout> | undefined;
  let timedOut = false;
  if (enableTimeout) {
    firstByteTimer = setTimeout(() => {
      timedOut = true;
      // 主动取消 fetch + reader.read —— 让 await reader.read() 立刻 reject
      try { reader.cancel?.(); } catch { /* ignore */ }
    }, firstByteTimeoutMs);
  }

  try {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      if (signal?.aborted) throw new StreamAbortedError();
      // 超时发生在 setTimeout 回调里（已 reader.cancel），reader.read() 会 reject；
      // 这里再补一道判断用于可读性诊断。
      if (timedOut) {
        const elapsed = Date.now() - startedAt;
        throw new StreamTimeoutError(`首字节超时：${elapsed}ms 内未收到任何数据`, elapsed);
      }

      const { done, value } = await reader.read();
      if (done) break;

      // 收到第一个字节：清掉首字节定时器，进入"已建立连接，不再超时"的安全区
      if (!firstByteReceived) {
        firstByteReceived = true;
        if (firstByteTimer !== undefined) {
          clearTimeout(firstByteTimer);
          firstByteTimer = undefined;
        }
      }

      buffer += decoder.decode(value, { stream: true });

      // SSE 以空行分隔事件；这里逐行处理，行尾不完整的留给下一轮
      let newlineIndex: number;
      while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, newlineIndex);
        buffer = buffer.slice(newlineIndex + 1);

        const parsed = extractDelta(line);
        if (!parsed) continue;

        if (parsed.error) throw new StreamProtocolError(parsed.error);
        // 思维链先到：记一次"模型在动"，但不算作正文增量
        if (parsed.reasoning) { receivedReasoning = true; onReasoning?.(parsed.reasoning); }
        if (parsed.delta) {
          streamed = true;
          text += parsed.delta;
          onDelta(parsed.delta);
        }
        if (parsed.model) model = parsed.model;
        if (parsed.finishReason) finishReason = parsed.finishReason;
        if (parsed.done) {
          // 收尾：丢弃剩余内容，直接返回
          return { text, streamed, model, finishReason, truncated: finishReason === 'length', receivedReasoning };
        }
      }
    }

    // 流正常结束但没收到显式结束标记，处理最后残留的一行
    const tail = extractDelta(buffer);
    if (tail?.reasoning) { receivedReasoning = true; onReasoning?.(tail.reasoning); }
    if (tail?.delta) {
      streamed = true;
      text += tail.delta;
      onDelta(tail.delta);
    }
    if (tail?.model) model = tail.model;
    if (tail?.finishReason) finishReason = tail.finishReason;

    return { text, streamed, model, finishReason, truncated: finishReason === 'length', receivedReasoning };
  } catch (e) {
    // 超时主动 cancel 时 reader.read() 会抛 AbortError / DOMException；
    // 翻译成更明确的 StreamTimeoutError，UI 才好精准提示"等待响应超时"。
    if (timedOut && !(e instanceof StreamTimeoutError)) {
      const elapsed = Date.now() - startedAt;
      throw new StreamTimeoutError(`首字节超时：${elapsed}ms 内未收到任何数据`, elapsed);
    }
    // 用户取消 → 明确归类（不是故障，UI 不提示错误）
    if (signal?.aborted) throw new StreamAbortedError();
    // 已归类的异常原样上抛（不要在 catch 里再包一层）
    if (
      e instanceof StreamTimeoutError ||
      e instanceof StreamProtocolError ||
      e instanceof StreamNetworkError ||
      e instanceof StreamAbortedError
    ) {
      throw e;
    }
    // 其余（reader.read() reject、decoder 异常、连接被重置）都是**传输层**失败：
    // 归类为 StreamNetworkError，保留已收到的 text 给上层决定是否续写。
    throw new StreamNetworkError(
      `流式读取中断：${e instanceof Error ? e.message : String(e)}`
    );
  } finally {
    if (firstByteTimer !== undefined) clearTimeout(firstByteTimer);
    try { reader.releaseLock?.(); } catch { /* ignore */ }
  }
}
