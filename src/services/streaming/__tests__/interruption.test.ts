import { describe, it, expect } from 'vitest';
import {
  classifyThrown,
  canContinueAfter,
  createInterruption,
  kindFromFinishReason,
  interruptionFromCode,
  GenerationInterruptedError,
} from '../interruption';
import {
  StreamProtocolError,
  StreamTimeoutError,
  StreamNetworkError,
  StreamAbortedError,
} from '../sseReader';

/**
 * 生成中断分类契约。
 *
 * 为什么值得单测：这套分类是"续写策略"与"用户提示"两件事的唯一依据。
 * 一旦"网络中断"被归类成"模型输出上限"，用户就会被误导去换模型（而真正该做的是检查网络）；
 * 一旦 aborted 被归成可重试，用户点了"重置"后还会莫名其妙再发一次请求。
 */
describe('classifyThrown — 异常 → 中断归因', () => {
  it('首字节超时 → link/timeout，可重试', () => {
    const info = classifyThrown(new StreamTimeoutError('首字节超时', 60_000));
    expect(info.kind).toBe('timeout');
    expect(info.side).toBe('link');
    expect(info.code).toBe('STREAM_TIMEOUT');
    expect(info.retryable).toBe(true);
  });

  it('传输层失败 → link/network（不是模型侧！）', () => {
    const info = classifyThrown(new StreamNetworkError('无法连接到模型服务'));
    expect(info.kind).toBe('network');
    expect(info.side).toBe('link');
    expect(info.code).toBe('STREAM_NETWORK');
    expect(info.retryable).toBe(true);
  });

  it('SSE 协议失败 → link/protocol', () => {
    const info = classifyThrown(new StreamProtocolError('response.body 不可读'));
    expect(info.kind).toBe('protocol');
    expect(info.side).toBe('link');
    expect(info.code).toBe('STREAM_PROTOCOL');
  });

  it('用户取消 → user/aborted，不可重试', () => {
    const info = classifyThrown(new StreamAbortedError());
    expect(info.kind).toBe('aborted');
    expect(info.side).toBe('user');
    expect(info.code).toBe('STREAM_ABORTED');
    expect(info.retryable).toBe(false);
  });

  it('AbortError（浏览器层取消）→ user/aborted', () => {
    const err = new Error('The user aborted a request.');
    err.name = 'AbortError';
    expect(classifyThrown(err).kind).toBe('aborted');
  });

  it('HTTP 错误（带厂商 aiError）→ link/http，沿用厂商 code 与可重试性', () => {
    const err = new Error('请求过于频繁，请稍后重试');
    (err as any).aiError = { code: 'RATE_LIMITED', message: '请求过于频繁', retryable: true };
    (err as any).httpStatus = 429;
    const info = classifyThrown(err);
    expect(info.kind).toBe('http');
    expect(info.side).toBe('link');
    expect(info.code).toBe('RATE_LIMITED');
    expect(info.httpStatus).toBe(429);
  });

  it('认不出的异常 → content/parse 兜底（绝不返回"无原因"）', () => {
    const info = classifyThrown(new TypeError('x is not a function'));
    expect(info.kind).toBe('parse');
    expect(info.code).toBe('GENERATE_FAILED');
    expect(info.retryable).toBe(false);
    expect(info.detail).toContain('x is not a function');
  });

  it('GenerationInterruptedError 保留自身归因（不被二次归类）', () => {
    const original = createInterruption('length', { detail: '已收到 12000 字符' });
    const info = classifyThrown(new GenerationInterruptedError(original, '被截断'));
    expect(info.kind).toBe('length');
    expect(info.side).toBe('model');
    expect(info.detail).toBe('已收到 12000 字符');
  });
});

describe('kindFromFinishReason — 模型侧归因', () => {
  it("'length' → 输出上限", () => {
    expect(kindFromFinishReason('length')).toBe('length');
  });

  it("'content_filter' / 'safety' → 安全策略拦截", () => {
    expect(kindFromFinishReason('content_filter')).toBe('content_filter');
    expect(kindFromFinishReason('content_filter_error')).toBe('content_filter');
    expect(kindFromFinishReason('safety')).toBe('content_filter');
  });

  it('无结束标记（网关静默截断）→ incomplete；正常 stop 但 JSON 没闭合也归 incomplete', () => {
    expect(kindFromFinishReason(undefined)).toBe('incomplete');
    expect(kindFromFinishReason('stop')).toBe('incomplete');
  });
});

describe('canContinueAfter — 哪些中断值得自动再发一轮', () => {
  const has = { hasContent: true };
  const none = { hasContent: false };

  it('模型输出上限 / 静默截断 → 一定续写', () => {
    expect(canContinueAfter('length', has)).toBe(true);
    expect(canContinueAfter('length', none)).toBe(true);
    expect(canContinueAfter('incomplete', none)).toBe(true);
  });

  it('链路抖动（timeout / network / protocol）→ 值得再试（有内容续写、没内容重发）', () => {
    expect(canContinueAfter('network', none)).toBe(true);
    expect(canContinueAfter('network', has)).toBe(true);
    expect(canContinueAfter('timeout', none)).toBe(true);
    expect(canContinueAfter('protocol', has)).toBe(true);
  });

  it('用户取消 / 安全策略拦截 / 内容非 JSON → 绝不自动重试', () => {
    expect(canContinueAfter('aborted', has)).toBe(false);
    expect(canContinueAfter('content_filter', has)).toBe(false);
    expect(canContinueAfter('parse', has)).toBe(false);
  });

  it('HTTP 错误：仅"已有内容 + 厂商标记可重试"才再试（鉴权/额度类永不重试）', () => {
    expect(canContinueAfter('http', { hasContent: true, retryable: true })).toBe(true);
    expect(canContinueAfter('http', { hasContent: false, retryable: true })).toBe(false);
    expect(canContinueAfter('http', { hasContent: true, retryable: false })).toBe(false);
  });
});

describe('interruptionFromCode — 只有 code 的一侧也能还原归因', () => {
  it('链路类 code 映射到对应链路侧种类', () => {
    expect(interruptionFromCode('STREAM_NETWORK').kind).toBe('network');
    expect(interruptionFromCode('STREAM_NETWORK').side).toBe('link');
    expect(interruptionFromCode('STREAM_TIMEOUT').kind).toBe('timeout');
    expect(interruptionFromCode('STREAM_PROTOCOL').kind).toBe('protocol');
    expect(interruptionFromCode('STREAM_ABORTED').kind).toBe('aborted');
  });

  it('模型侧 / 内容侧 code 映射正确', () => {
    expect(interruptionFromCode('OUTPUT_TRUNCATED').kind).toBe('length');
    expect(interruptionFromCode('OUTPUT_TRUNCATED').side).toBe('model');
    expect(interruptionFromCode('CONTENT_FILTERED').kind).toBe('content_filter');
    expect(interruptionFromCode('STREAM_INCOMPLETE').kind).toBe('incomplete');
  });

  it('鉴权/额度类 HTTP code 不可重试；限流/服务端异常可重试', () => {
    expect(interruptionFromCode('INVALID_API_KEY').retryable).toBe(false);
    expect(interruptionFromCode('QUOTA_EXCEEDED').retryable).toBe(false);
    expect(interruptionFromCode('RATE_LIMITED').retryable).toBe(true);
    expect(interruptionFromCode('SERVER_ERROR').retryable).toBe(true);
  });

  it('未知 code → parse 兜底，保留原 code', () => {
    const info = interruptionFromCode('WEIRD_CODE');
    expect(info.kind).toBe('parse');
    expect(info.code).toBe('WEIRD_CODE');
  });
});
