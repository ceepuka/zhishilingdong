import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BaseAIProvider } from '../baseAIProvider';
import type { SearchGenerateResponse } from '../../types';

/**
 * `search.generateStream` 的部分内容保留契约。
 *
 * 背景（用户实测截图）：界面已经渲染出标题、概览、思维导图，顶部却弹出一条
 * 「流式生成结束但未解析出有效 JSON（已收到 9634 字符）」的红色技术性横幅。
 *
 * 根因：续写轮把**又一份完整/片段 JSON** 追加到首轮已产出的文本后面，
 * 拼接结果整体不再是合法 JSON —— `parser.finish()` 拿不到最终对象，
 * 于是整个生成被判成"解析失败"。可内容明明早已通过增量快照渲染出来了。
 *
 * 契约：
 *   1. 只要**曾经产出过可渲染快照**，就绝不能报致命错误 —— 保留内容 + 内容侧中断归因；
 *   2. 只有"全程一个字都没解析出来"才是真的失败（success:false + GENERATE_FAILED）。
 */
describe('search.generateStream — 尾部拼接不可解析时保留已生成内容', () => {
  type StreamResult = {
    content: string;
    model: string;
    latencyMs: number;
    streamed: boolean;
    truncated: boolean;
    finishReason?: string;
  };

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  /** 构造 provider：callModelStream 按「每轮结果」依次返回（含真实续写循环逻辑） */
  const makeProvider = (rounds: Array<StreamResult | Error>) => {
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
  };

  const round = (content: string): StreamResult => ({
    content,
    model: 'test-model',
    latencyMs: 1,
    streamed: true,
    truncated: false,
    finishReason: 'stop',
  });

  it('续写轮重复输出完整 JSON 与首轮拼接 → 保留已渲染内容，不再报"未解析出有效 JSON"', async () => {
    // 首轮：括号闭合但核心字段缺失 → 触发续写；续写轮又把整份 JSON 重发一遍 → 拼接后整体非法
    const dup = '{"topic":"牛顿第二定律"}';
    const provider = makeProvider([round(dup), round(dup), round(dup)]);
    const service = provider.buildService();

    const res = await (service.search.generateStream as any)('牛顿第二定律', () => {});

    expect(res.success).toBe(true);
    expect((res.data as SearchGenerateResponse)?.topic).toBe('牛顿第二定律');
    // 内容不完整要被诚实标记：truncated + 内容侧中断归因（UI 据此在内容末尾提示）
    expect(res.data.truncated).toBe(true);
    expect(res.data.interruption?.side).toBe('content');
    expect(res.error).toBeUndefined();
  });

  it('全程没有可解析 JSON → 保持"真的失败"契约（success:false + GENERATE_FAILED）', async () => {
    const provider = makeProvider([round('这是一段散文，完全没有 JSON 起始符。'), round('仍然没有 JSON。')]);
    const service = provider.buildService();

    const res = await (service.search.generateStream as any)('牛顿第二定律', () => {});

    expect(res.success).toBe(false);
    expect(res.error?.code).toBe('GENERATE_FAILED');
    expect(res.data).toBeUndefined();
  });

  it('正常完整 JSON → success:true 且无中断归因', async () => {
    const full = JSON.stringify({
      topic: '牛顿第二定律',
      summary: '经典力学核心定律',
      mindMap: [{ id: 'r', title: '牛顿第二定律', level: 'root', children: [] }],
      concepts: [],
      knowledgeContext: { prerequisites: [], relatedTopics: [], learningPath: [] },
      examQuestions: [],
      interestingFacts: [],
    });
    const provider = makeProvider([round(full)]);
    const service = provider.buildService();

    const res = await (service.search.generateStream as any)('牛顿第二定律', () => {});

    expect(res.success).toBe(true);
    expect(res.data.topic).toBe('牛顿第二定律');
    expect(res.data.interruption).toBeUndefined();
    expect(res.data.truncated).toBeUndefined();
  });
});
