import { describe, it, expect, beforeEach, vi } from 'vitest';
import { withFallback } from '../baseAIProvider';
import { StreamTimeoutError, StreamProtocolError, StreamNetworkError, StreamAbortedError } from '../streaming/sseReader';
import { GenerationInterruptedError, createInterruption } from '../streaming/interruption';

/**
 * 链路错误透传契约（替代旧的黑名单-自愈契约）。
 *
 * 背景：旧实现里"流式失败 → 记黑名单 → 冷却期自愈"是一套隐式全局状态，
 * 脆弱且难推理。现在改为**不猜测、不打补丁、链路状态诚实处理**：
 *   1. 不再有黑名单 —— 每次请求都按型号静态能力声明直接发 stream
 *   2. 流式链路失败（超时 / 协议错误）→ 以 success:false + 明确 code 透传给 UI
 *   3. 只有"模型真的产不出结果"这类业务错误才走 fallback 兜底
 *
 * 这里把"链路错误必须透传、业务错误才兜底"钉死为契约，
 * 防止将来有人把链路错误重新吞成静默 fallback（用户看到笼统"生成失败"却查不到原因）。
 */
describe('withFallback — 链路错误透传 vs 业务错误兜底', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('业务错误（普通 Error）→ 走 fallback 兜底，success:true', async () => {
    const op = withFallback(
      async () => { throw new Error('模型内部错误'); },
      { fallback: true },
      'Test'
    );

    const res = await op();
    expect(res.success).toBe(true);
    expect(res.data).toEqual({ fallback: true });
  });

  it('流式首字节超时（StreamTimeoutError）→ 透传 success:false + code=STREAM_TIMEOUT', async () => {
    const op = withFallback(
      async () => { throw new StreamTimeoutError('首字节超时：60000ms', 60_000); },
      { fallback: true },
      'Test'
    );

    const res = await op();
    expect(res.success).toBe(false);
    expect(res.error?.code).toBe('STREAM_TIMEOUT');
    expect(res.error?.retryable).toBe(true);
    // 不透传成 fallback：data 不应存在
    expect(res.data).toBeUndefined();
  });

  it('SSE 协议解析失败（StreamProtocolError）→ 透传 success:false + code=STREAM_PROTOCOL', async () => {
    const op = withFallback(
      async () => { throw new StreamProtocolError('response.body 不可读'); },
      { fallback: true },
      'Test'
    );

    const res = await op();
    expect(res.success).toBe(false);
    expect(res.error?.code).toBe('STREAM_PROTOCOL');
    expect(res.error?.retryable).toBe(true);
    expect(res.data).toBeUndefined();
  });

  it('密钥未配置错误 → 仍走 NO_API_KEY（retryable:false），不受链路透传影响', async () => {
    const op = withFallback(
      async () => { throw new Error('密钥未配置或已失效'); },
      { fallback: true },
      'Test'
    );

    const res = await op();
    expect(res.success).toBe(false);
    expect(res.error?.code).toBe('NO_API_KEY');
    expect(res.error?.retryable).toBe(false);
  });

  it('正常返回 → success:true 且 data 原样返回', async () => {
    const op = withFallback<{ ok: number }>(
      async () => ({ ok: 1 }),
      { ok: 0 },
      'Test'
    );

    const res = await op();
    expect(res.success).toBe(true);
    expect(res.data).toEqual({ ok: 1 });
  });
});

/**
 * 严格模式（内容生成类调用）契约。
 *
 * 问题背景：生成类调用若把异常吞成 fallback，会返回 **success:true + 空数据**。
 * 状态机看到"成功"且"数据为空"时，只能丢弃已流出的内容、回 IDLE、显示笼统"生成失败"——
 * 用户既看不到已收到的内容，也看不到原因。严格模式下必须返回 success:false + code。
 */
describe('withFallback — 严格模式（生成类调用不再吞错）', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('严格模式 + 认不出的异常 → success:false + GENERATE_FAILED（不再是"成功但空"）', async () => {
    const op = withFallback(
      async () => { throw new Error('流式生成结束但未解析出有效 JSON（已收到 300 字符）'); },
      { topic: '' },
      'Test',
      { strict: true }
    );

    const res = await op();
    expect(res.success).toBe(false);
    expect(res.error?.code).toBe('GENERATE_FAILED');
    expect(res.error?.message).toContain('未解析出有效 JSON');
    expect(res.data).toBeUndefined();
  });

  it('非严格模式（业务型调用）保持兜底 → success:true（不改变原有降级行为）', async () => {
    const op = withFallback(
      async () => { throw new Error('模型内部错误'); },
      { topic: 'fallback' },
      'Test'
    );

    const res = await op();
    expect(res.success).toBe(true);
    expect(res.data).toEqual({ topic: 'fallback' });
  });

  it('传输层失败（StreamNetworkError）→ 透传 STREAM_NETWORK（严格/非严格一致）', async () => {
    const strict = withFallback(
      async () => { throw new StreamNetworkError('无法连接到模型服务：Failed to fetch'); },
      { topic: '' },
      'Test',
      { strict: true }
    );
    const graceful = withFallback(
      async () => { throw new StreamNetworkError('无法连接到模型服务：Failed to fetch'); },
      { topic: '' },
      'Test'
    );

    for (const op of [strict, graceful]) {
      const res = await op();
      expect(res.success).toBe(false);
      expect(res.error?.code).toBe('STREAM_NETWORK');
      expect(res.data).toBeUndefined();
    }
  });

  it('用户取消 → 透传 STREAM_ABORTED 且 retryable:false', async () => {
    const op = withFallback(
      async () => { throw new StreamAbortedError(); },
      { topic: '' },
      'Test',
      { strict: true }
    );

    const res = await op();
    expect(res.success).toBe(false);
    expect(res.error?.code).toBe('STREAM_ABORTED');
    expect(res.error?.retryable).toBe(false);
  });

  it('模型输出上限（GenerationInterruptedError/length）→ 透传 OUTPUT_TRUNCATED', async () => {
    const op = withFallback(
      async () => {
        throw new GenerationInterruptedError(
          createInterruption('length', { detail: '已收到 16000 字符' }),
          '模型输出达到上限被截断'
        );
      },
      { topic: '' },
      'Test',
      { strict: true }
    );

    const res = await op();
    expect(res.success).toBe(false);
    expect(res.error?.code).toBe('OUTPUT_TRUNCATED');
    expect(res.data).toBeUndefined();
  });

  it('HTTP 错误（带厂商 aiError）→ 透传厂商 code，不再静默兜底', async () => {
    const err = new Error('密钥可能失效，请重新配置');
    (err as any).aiError = { code: 'INVALID_API_KEY', message: '密钥可能失效，请重新配置', retryable: false };

    const op = withFallback(
      async () => { throw err; },
      { topic: '' },
      'Test'
    );

    const res = await op();
    expect(res.success).toBe(false);
    expect(res.error?.code).toBe('INVALID_API_KEY');
    expect(res.error?.retryable).toBe(false);
  });
});
