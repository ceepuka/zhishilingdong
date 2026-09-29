import { describe, it, expect, vi } from 'vitest';
import { hasCompleteJSONObject, MAX_GENERATION_ATTEMPTS, BaseAIProvider, buildGenerateCompleteChecker } from '../baseAIProvider';
import { StreamTimeoutError, StreamNetworkError, StreamAbortedError } from '../streaming/sseReader';

/**
 * 生成超限续写的核心前提：必须能严格判断"JSON 是否写完整"。
 * 这里刻意不做任何修复 —— 否则被 max_tokens 截断的 JSON 会被
 * repairTruncatedJSON 补成合法 JSON，让"没写完就续写"这条链路被跳过。
 */
describe('hasCompleteJSONObject（严格完整性判定，不做修复）', () => {
  it('完整 JSON → true', () => {
    expect(hasCompleteJSONObject('{"a":1,"b":[1,2]}')).toBe(true);
    expect(hasCompleteJSONObject('{"a":{"b":{"c":1}}}')).toBe(true);
  });

  it('被截断的 JSON → false', () => {
    expect(hasCompleteJSONObject('{"a":1,"b":[1,2')).toBe(false);
    expect(hasCompleteJSONObject('{"a":"未闭合的字符串')).toBe(false);
    expect(hasCompleteJSONObject('{"topic":"加速度","concepts":[{"title":"定义"')).toBe(false);
  });

  it('字符串里的花括号不影响深度判定', () => {
    expect(hasCompleteJSONObject('{"a":"{假的}","b":2}')).toBe(true);
    expect(hasCompleteJSONObject('{"a":"}","b":{"c":1}')).toBe(false);
  });

  it('数组括号也必须闭合（边界漏洞回归：{"a":[1,2} 曾误判为完整）', () => {
    // 数组 [ 未闭合，但 } 会让花括号深度归零 —— 修复前会误判为 true、跳过续写
    expect(hasCompleteJSONObject('{"a":[1,2}')).toBe(false);
    // 数组闭合但对象未闭合 → 仍不完整
    expect(hasCompleteJSONObject('{"a":[1,2]')).toBe(false);
    // 数组与对象都闭合 → 完整
    expect(hasCompleteJSONObject('{"a":[1,2]}')).toBe(true);
    // 嵌套数组未闭合
    expect(hasCompleteJSONObject('{"a":[[1,2],[3,4}')).toBe(false);
    // 字符串里的方括号不影响判定
    expect(hasCompleteJSONObject('{"a":"[1,2]","b":2}')).toBe(true);
  });

  it('带前言 / markdown 围栏 → true', () => {
    expect(hasCompleteJSONObject('好的，结果如下：\n```json\n{"a":1}\n```')).toBe(true);
  });

  it('尾部有多余文字但对象已闭合 → 仍视为完整', () => {
    expect(hasCompleteJSONObject('{"a":1}\n\n以上。')).toBe(true);
  });

  it('完全没有 JSON 起始符 → false', () => {
    expect(hasCompleteJSONObject('hello world')).toBe(false);
    expect(hasCompleteJSONObject('')).toBe(false);
  });
});

describe('续写次数上限', () => {
  it('最多 3 次（首轮 + 至多 2 次自动续写）', () => {
    expect(MAX_GENERATION_ATTEMPTS).toBe(3);
  });
});

describe('buildGenerateCompleteChecker（括号闭合 + 核心字段齐全）', () => {
  const check = buildGenerateCompleteChecker();

  it('括号闭合且核心字段齐全 → true', () => {
    const full = '{"topic":"t","mindMap":[],"concepts":[],"knowledgeContext":{},"examQuestions":[],"interestingFacts":[]}';
    expect(check(full)).toBe(true);
  });

  it('括号闭合但缺核心字段（如末尾 interestingFacts）→ false（触发续写，防内容悄悄不完整）', () => {
    const missingTail = '{"topic":"t","mindMap":[],"concepts":[],"knowledgeContext":{},"examQuestions":[]}';
    expect(check(missingTail)).toBe(false);
  });

  it('括号未闭合 → false', () => {
    expect(check('{"topic":"t","mindMap":[],"concepts":[]')).toBe(false);
  });

  it('缺可选项（summary/conceptsOverview/examples/relatedResults）不影响完整性 → true', () => {
    // 这些是可选项，漏了不应触发续写（否则空转浪费次数）
    const noOptional = '{"topic":"t","mindMap":[],"concepts":[],"knowledgeContext":{},"examQuestions":[],"interestingFacts":[]}';
    expect(check(noOptional)).toBe(true);
  });

  it('带 markdown 围栏的完整 JSON → true', () => {
    const fenced = '```json\n{"topic":"t","mindMap":[],"concepts":[],"knowledgeContext":{},"examQuestions":[],"interestingFacts":[]}\n```';
    expect(check(fenced)).toBe(true);
  });
});

/**
 * callModelStreamWithContinuation 的续写循环边界契约。
 * 通过一个最小子类 override callModelStream 来模拟各轮次的返回值 / 异常，
 * 验证循环在"续写轮空内容""续写轮链路异常"等边界下不会丢已生成内容、不会空转。
 */
describe('callModelStreamWithContinuation — 续写循环边界', () => {
  type StreamResult = { content: string; model: string; latencyMs: number; streamed: boolean; truncated: boolean };

  /** 构造一个 provider，其 callModelStream 按传入的「每轮结果」依次返回 */
  function makeProvider(rounds: Array<StreamResult | Error>) {
    let call = 0;
    return new (class extends BaseAIProvider {
      protected getProviderId(): string { return 'test'; }
      protected async callModelStream(
        _prompt: string,
        _systemPrompt: string | undefined,
        _depth: any,
        onDelta: (chunk: string) => void,
        _signal?: AbortSignal,
        _onReasoning?: (chunk: string) => void
      ): Promise<StreamResult> {
        const item = rounds[Math.min(call, rounds.length - 1)];
        call++;
        if (item instanceof Error) throw item;
        if (item.content) onDelta(item.content);
        return item;
      }
    })();
  }

  const ok = (content: string): StreamResult => ({ content, model: 'm', latencyMs: 1, streamed: true, truncated: false });
  const empty = (): StreamResult => ({ content: '', model: 'm', latencyMs: 1, streamed: false, truncated: false });

  it('续写轮返回空内容 → 立即结束，不再空转浪费次数', async () => {
    // 首轮内容未闭合（需要续写），续写轮却返回空 → 应 break，且 attempts 不超过 2
    const p = makeProvider([ok('{"a":'), empty()]);
    const r = await (p as any).callModelStreamWithContinuation(
      'p', undefined, 'high',
      () => {},
      undefined,
      (acc: string) => hasCompleteJSONObject(acc),
      (acc: string) => `续写:${acc}`
    );
    expect(r.attempts).toBe(2); // 首轮 + 1 次续写（空内容后停止）
    expect(r.truncated).toBe(true);
    expect(r.content).toBe('{"a":'); // 已生成内容保留
  });

  it('续写轮抛 StreamTimeoutError → 保留已生成内容并结束（不中断、不丢尾巴）', async () => {
    const p = makeProvider([ok('{"a":'), new StreamTimeoutError('超时', 1000)]);
    const onDelta = vi.fn();
    const r = await (p as any).callModelStreamWithContinuation(
      'p', undefined, 'high',
      onDelta,
      undefined,
      (acc: string) => hasCompleteJSONObject(acc),
      (acc: string) => `续写:${acc}`
    );
    expect(r.truncated).toBe(true);
    expect(r.content).toBe('{"a":'); // 首轮内容未被续写轮异常吞掉
    expect(onDelta).toHaveBeenCalledWith('{"a":');
  });

  it('首轮就抛 StreamTimeoutError → 异常向上冒泡（不吞）', async () => {
    const p = makeProvider([new StreamTimeoutError('超时', 1000)]);
    await expect(
      (p as any).callModelStreamWithContinuation(
        'p', undefined, 'high',
        () => {},
        undefined,
        (acc: string) => hasCompleteJSONObject(acc),
        (acc: string) => `续写:${acc}`
      )
    ).rejects.toBeInstanceOf(StreamTimeoutError);
  });

  it('首轮内容就完整 → 不触发续写，attempts=1', async () => {
    const p = makeProvider([ok('{"a":1}')]);
    const r = await (p as any).callModelStreamWithContinuation(
      'p', undefined, 'high',
      () => {},
      undefined,
      (acc: string) => hasCompleteJSONObject(acc),
      (acc: string) => `续写:${acc}`
    );
    expect(r.attempts).toBe(1);
    expect(r.continued).toBe(false);
    expect(r.truncated).toBe(false);
  });
});

/**
 * 全链路续写契约（v1.7.0 扩展）。
 *
 * 旧行为：**只有模型超限**（JSON 没闭合并续写）这一种情况会接着写；
 * 链路类中断（网络断开 / 超时 / 协议错）在首轮直接抛错终止 ——
 * 于是"内容没写完就截止，且没有任何提示"。
 *
 * 新行为：中断分类驱动续写，且总请求数硬上限仍是 MAX_GENERATION_ATTEMPTS。
 */
describe('callModelStreamWithContinuation — 全链路中断续写与归因', () => {
  /** 一轮：可携带增量内容 / 结束原因 / 抛出的异常（先吐内容再抛错＝"流到一半断掉"） */
  type Round = { content?: string; finishReason?: string; error?: Error };

  function makeRounds(rounds: Round[]) {
    const seenPrompts: string[] = [];
    let call = 0;
    const provider = new (class extends BaseAIProvider {
      protected getProviderId(): string { return 'test'; }
      protected async callModelStream(
        prompt: string,
        _systemPrompt: string | undefined,
        _depth: any,
        onDelta: (chunk: string) => void,
        _signal?: AbortSignal,
        _onReasoning?: (chunk: string) => void
      ) {
        seenPrompts.push(prompt);
        const item = rounds[Math.min(call, rounds.length - 1)];
        call++;
        if (item.content) onDelta(item.content);
        if (item.error) throw item.error;
        return {
          content: item.content ?? '',
          model: 'm',
          latencyMs: 1,
          streamed: true,
          truncated: item.finishReason === 'length',
          finishReason: item.finishReason,
        };
      }
    })();
    return { provider, seenPrompts };
  }

  const run = (provider: BaseAIProvider, opts: { signal?: AbortSignal } = {}) =>
    (provider as any).callModelStreamWithContinuation(
      '原始prompt',
      undefined,
      'high',
      () => {},
      opts.signal,
      (acc: string) => hasCompleteJSONObject(acc),
      (acc: string) => `续写:${acc}`
    );

  it('模型超限（finish_reason=length）→ 续写补全，归因 length 且 resolved=true', async () => {
    const { provider } = makeRounds([
      { content: '{"a":1,"b":', finishReason: 'length' },
      { content: '2}' },
    ]);
    const r = await run(provider);
    expect(r.content).toBe('{"a":1,"b":2}');
    expect(r.truncated).toBe(false);
    expect(r.continued).toBe(true);
    expect(r.interruption?.kind).toBe('length');
    expect(r.interruption?.side).toBe('model');
    expect(r.interruption?.resolved).toBe(true);
  });

  it('流到一半网络断开（已有内容）→ 仍然续写，不再直接终止', async () => {
    const { provider, seenPrompts } = makeRounds([
      { content: '{"a":1,', error: new StreamNetworkError('连接被重置') },
      { content: '2}' },
    ]);
    const r = await run(provider);
    expect(r.content).toBe('{"a":1,2}');
    expect(r.truncated).toBe(false);
    expect(r.interruption?.kind).toBe('network');
    expect(r.interruption?.resolved).toBe(true);
    // 第二轮必须是"回填续写"，而不是重发原始 prompt
    expect(seenPrompts[1]).toContain('续写:');
  });

  it('链路中断且已有内容、但续写轮仍失败并耗尽次数 → 保留内容 + 归因 resolved=false', async () => {
    const { provider } = makeRounds([
      { content: '{"a":1,', error: new StreamNetworkError('连接被重置') },
      { content: '', error: new StreamNetworkError('连接被重置') },
      { content: '', error: new StreamTimeoutError('首字节超时', 1000) },
    ]);
    const r = await run(provider);
    expect(r.attempts).toBe(MAX_GENERATION_ATTEMPTS);
    expect(r.truncated).toBe(true);
    expect(r.interruption?.resolved).toBe(false);
    // 已收到内容必须保留（不能因为异常丢尾巴）
    expect(r.content).toBe('{"a":1,');
  });

  it('重发轮才拿到内容又断掉 → 已收到内容必须保留（回归：用过期快照会整段丢掉）', async () => {
    // 首轮一个字都没拿到（触发"原请求重发"），重发轮吐了内容又断掉。
    // 若在 catch 里用"本轮开始前"的快照判断有没有内容，会把中间这段内容当成空气直接上抛。
    const { provider } = makeRounds([
      { error: new StreamNetworkError('无法连接') },
      { content: '{"a":1,"b":', error: new StreamNetworkError('连接被重置') },
      { error: new StreamNetworkError('连接被重置') },
    ]);
    const r = await run(provider);
    expect(r.truncated).toBe(true);
    expect(r.content).toBe('{"a":1,"b":');
    expect(r.interruption?.kind).toBe('network');
    expect(r.interruption?.resolved).toBe(false);
  });

  it('一个字都没拿到（网络失败）→ 按原 prompt 重发一次，仍失败则抛错', async () => {
    const { provider, seenPrompts } = makeRounds([
      { error: new StreamNetworkError('无法连接') },
      { error: new StreamNetworkError('无法连接') },
    ]);
    await expect(run(provider)).rejects.toBeInstanceOf(StreamNetworkError);
    // 只允许 1 次重发（共 2 次请求），不空转耗满 3 次
    expect(seenPrompts.length).toBe(2);
    // 重发用的是原始 prompt，而不是"续写:（空）"
    expect(seenPrompts[1]).toBe('原始prompt');
  });

  it('一个字都没拿到但重发成功 → 视为续写补全（attempts=2）', async () => {    const { provider } = makeRounds([
      { error: new StreamNetworkError('无法连接') },
      { content: '{"a":1}' },
    ]);
    const r = await run(provider);
    expect(r.attempts).toBe(2);
    expect(r.truncated).toBe(false);
    expect(r.interruption?.kind).toBe('network');
    expect(r.interruption?.resolved).toBe(true);
  });

  it('用户取消（signal.aborted）→ 不重试、异常上抛', async () => {    const controller = new AbortController();
    controller.abort();
    const { provider, seenPrompts } = makeRounds([{ error: new StreamAbortedError() }]);
    await expect(run(provider, { signal: controller.signal })).rejects.toBeInstanceOf(StreamAbortedError);
    expect(seenPrompts.length).toBe(1);
  });

  it('被安全策略拦截（content_filter）→ 不续写，归因 content_filter', async () => {
    const { provider, seenPrompts } = makeRounds([
      { content: '{"a":1,', finishReason: 'content_filter' },
      { content: '2}' },
    ]);
    const r = await run(provider);
    expect(seenPrompts.length).toBe(1);
    expect(r.truncated).toBe(true);
    expect(r.interruption?.kind).toBe('content_filter');
    expect(r.interruption?.side).toBe('model');
  });

  it('网关静默截断（无 finish_reason）→ 归因 incomplete 并续写', async () => {
    const { provider } = makeRounds([
      { content: '{"a":1,', },
      { content: '2}' },
    ]);
    const r = await run(provider);
    expect(r.truncated).toBe(false);
    expect(r.interruption?.kind).toBe('incomplete');
    expect(r.interruption?.side).toBe('content');
  });

  it('HTTP 错误（鉴权/额度类，无内容）→ 不重试，直接上抛', async () => {
    const authErr = new Error('密钥可能失效，请重新配置');
    (authErr as any).aiError = { code: 'INVALID_API_KEY', message: '密钥可能失效', retryable: false };
    const { provider, seenPrompts } = makeRounds([{ error: authErr }]);
    await expect(run(provider)).rejects.toBeTruthy();
    expect(seenPrompts.length).toBe(1);
  });

  it('完全没发生中断 → 不产生 interruption（UI 不显示任何横幅）', async () => {
    const { provider } = makeRounds([{ content: '{"a":1}', finishReason: 'stop' }]);
    const r = await run(provider);
    expect(r.interruption).toBeUndefined();
    expect(r.continued).toBe(false);
  });
});

