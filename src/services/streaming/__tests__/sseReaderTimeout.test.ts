import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readSSEStream, StreamTimeoutError } from '../sseReader';

/**
 * 首字节超时契约：
 * 1. 超时时间内没收到任何字节 → 抛 StreamTimeoutError（不抛 StreamProtocolError，避免被记入"流式不支持"黑名单）
 * 2. 收到至少一个字节（即使很小）→ 不再超时
 * 3. firstByteTimeoutMs=0 → 禁用超时（保证测试可注入"极慢但终会到达"的网络）
 *
 * 这些不变量是修复"用户卡在'已等待 511 秒'、界面永远不下去"的关键。
 * 真实 bug 现场：fetch 拿到了响应，response.body 可读，但服务端 / 网关迟迟不发任何字节。
 *
 * 实现要点：fake timers 不会推进一个无限 pending 的 Promise 的 resolve/reject（setTimeout 之外的微任务队列），
 * 所以这里用真实 setTimeout 但 timeout 设为很小的值（如 50ms）让测试能在百毫秒级结束。
 */

class NeverEmittingBody {
  private cancelled = false;
  private pending: Array<(reason: unknown) => void> = [];
  getReader(): ReadableStreamDefaultReader<Uint8Array> {
    const self = this;
    return {
      read: () => new Promise<{ done: boolean; value?: Uint8Array }>((_resolve, reject) => {
        // 永不 resolve；只有外部调 cancel() 时才 reject（模拟 fetch 的 abort 行为）
        if (self.cancelled) {
          reject(new DOMException('Aborted', 'AbortError'));
          return;
        }
        self.pending.push(reject);
      }),
      releaseLock: () => {},
      cancel: () => {
        self.cancelled = true;
        const err = new DOMException('Aborted', 'AbortError');
        while (self.pending.length) self.pending.shift()!(err);
      },
      closed: Promise.resolve(),
    } as any;
  }
}

function makeResponse(body: any): Response {
  return {
    ok: true,
    status: 200,
    body,
    headers: new Headers({ 'content-type': 'text/event-stream' }),
  } as unknown as Response;
}

describe('SSE 流读取器 — 首字节超时', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('超时时间内没收到任何字节 → 抛 StreamTimeoutError（不是 StreamProtocolError）', async () => {
    const onDelta = vi.fn();
    const onReasoning = vi.fn();

    await expect(
      readSSEStream(makeResponse(new NeverEmittingBody()), onDelta, undefined, onReasoning, 50)
    ).rejects.toBeInstanceOf(StreamTimeoutError);
    expect(onDelta).not.toHaveBeenCalled();
    expect(onReasoning).not.toHaveBeenCalled();
  });

  it('StreamTimeoutError 携带 elapsedMs 字段（便于 UI 显示具体等待时长）', async () => {
    try {
      await readSSEStream(makeResponse(new NeverEmittingBody()), vi.fn(), undefined, undefined, 30);
      throw new Error('应该 reject');
    } catch (e) {
      expect(e).toBeInstanceOf(StreamTimeoutError);
      // 定时器与 Date.now() 都是毫秒粒度，实测会差 1~2ms（曾出现 29 vs 30 的偶发红），
      // 所以这里只校验"量级正确"，不把配置值当精确下界。
      const elapsed = (e as StreamTimeoutError).elapsedMs;
      expect(Number.isFinite(elapsed)).toBe(true);
      expect(elapsed).toBeGreaterThanOrEqual(20);
      expect(elapsed).toBeLessThan(500);
    }
  });

  it('firstByteTimeoutMs=0 → 禁用超时（不被无字节场景自动终止，测试用短轮询避免卡死）', async () => {
    // 验证方式：开启 timeout=0，立刻主动 cancel 让 promise reject；
    // 如果没有禁用，setTimeout 会已经排上，reject 后还会触发 abort 路径 → 行为可区分。
    const body = new NeverEmittingBody();
    const promise = readSSEStream(makeResponse(body), vi.fn(), undefined, undefined, 0);
    // 50ms 内没自动 reject → 证明 timeout=0 真的禁用了 setTimeout 路径
    const raced = await Promise.race([
      promise.then(() => 'resolved' as const, () => 'rejected' as const),
      new Promise<'pending'>((resolve) => setTimeout(() => resolve('pending'), 50)),
    ]);
    expect(raced).toBe('pending');
  });
});

describe('SSE 流读取器 — 超时不会误杀已建立连接的慢速流', () => {
  // 简单可控的 body：按外部信号逐段推数据；可以用来模拟"流式但很慢"
  class ChunkyBody {
    private chunks: Uint8Array[] = [];
    private readers: Array<(r: { done: boolean; value?: Uint8Array }) => void> = [];
    private rejecters: Array<(e: unknown) => void> = [];
    push(text: string) {
      const enc = new TextEncoder().encode(text);
      this.chunks.push(enc);
      while (this.readers.length) {
        const r = this.readers.shift()!;
        r({ done: false, value: enc });
      }
    }
    getReader(): any {
      const self = this;
      return {
        read: () => new Promise<{ done: boolean; value?: Uint8Array }>((resolve, reject) => {
          if (self.chunks.length) {
            resolve({ done: false, value: self.chunks.shift()! });
            return;
          }
          self.readers.push(resolve);
          self.rejecters.push(reject);
        }),
        releaseLock: () => {},
        cancel: () => {
          const err = new DOMException('Aborted', 'AbortError');
          while (self.rejecters.length) self.rejecters.shift()!(err);
        },
        closed: Promise.resolve(),
      };
    }
  }

  it('已收到第一个字节后不再受首字节超时约束（避免误杀慢速流）', async () => {
    const body = new ChunkyBody();
    const resp = makeResponse(body);
    const onDelta = vi.fn();

    // 故意把 timeout 设得很小（30ms），但只要先 push 第一个字节就不再受 timeout 影响
    const promise = readSSEStream(resp, onDelta, undefined, undefined, 30);

    // 先推一个 SSE 增量（带 finishReason 让流自然结束），验证不会被 timeout 误杀
    body.push('data: {"choices":[{"delta":{"content":"hi"},"finish_reason":"stop"}]}\n\n');

    const result = await promise;
    expect(onDelta).toHaveBeenCalledWith('hi');
    expect(result.text).toBe('hi');
    expect(result.streamed).toBe(true);
  });
});