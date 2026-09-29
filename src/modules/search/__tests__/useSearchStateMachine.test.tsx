import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSearchStateMachine } from '../useSearchStateMachine';
import { getCurrentStrings } from '../../../i18n/strings';
import { StreamTimeoutError } from '../../../services/streaming/sseReader';
import type {
  AIResponse,
  SearchGenerateResponse,
  SearchAnalyzeResponse,
  KnowledgeGraphNode,
} from '../../../types/ai';

/** 界面语言相关文案统一取自 i18n 层，避免测试写死某种语言而随文案调整失效 */
const strings = getCurrentStrings();

/**
 * 流式生成改造后的状态机测试：
 * 1. generateStream 成功 → DISPLAYING，各区块数据齐全
 * 2. generateStream 失败（success=false 或无 data）→ IDLE + 错误
 * 3. 流式快照正确合并（后到的空值不覆盖已有内容）
 * 4. 非知识点自动切换问答
 * 5. 宽泛类别 → KNOWLEDGE_GRAPH
 */

const mockSearchApi = vi.hoisted(() => ({
  validate: vi.fn(),
  analyze: vi.fn(),
  generate: vi.fn(),
  generateStream: vi.fn(),
  followup: vi.fn(),
  followupStream: vi.fn(),
}));

vi.mock('../../../services/aiServiceProvider', () => ({
  aiService: { search: mockSearchApi },
}));

const fullData = (): SearchGenerateResponse => ({
  topic: '加速度',
  summary: '加速度是描述速度变化快慢的物理量。',
  mindMap: [{ id: 'root', title: '加速度', level: 'root', children: [] }],
  concepts: [
    { type: 'definition', title: '速度', content: { elementary: '初等', advanced: '高等' }, example: '汽车每小时行驶100公里。' },
  ],
  examples: [],
  relatedResults: [],
  knowledgeContext: { prerequisites: ['速度'], relatedTopics: [], learningPath: [] },
  examQuestions: [],
  interestingFacts: [],
});

const ok = (data: SearchGenerateResponse): AIResponse<SearchGenerateResponse> => ({ success: true, data });
const fail = (): AIResponse<SearchGenerateResponse> => ({ success: false });

/** 默认：模拟一次完整流式过程 —— 增量回调后立即返回最终结果 */
const streamFullData = () => {
  mockSearchApi.generateStream.mockImplementation(async (topic: string, onPartial?: (s: any) => void) => {
    const data = { ...fullData(), topic };
    onPartial?.({ data, complete: true, completedKeys: Object.keys(data) });
    return ok(data);
  });
};

beforeEach(() => {
  vi.resetAllMocks();
  mockSearchApi.validate.mockResolvedValue({ success: true, data: { valid: true, suggestions: [] } });
  mockSearchApi.analyze.mockResolvedValue({
    success: true,
    data: { isSpecific: true, isKnowledgePoint: true, canonicalTopic: '加速度', topic: '加速度' },
  });
  streamFullData();
});

const runSearch = async (query: string, options?: { onRedirectToQA?: (q: string) => void }) => {
  const { result } = renderHook(() => useSearchStateMachine(options));
  await act(async () => {
    await result.current[1].search(query);
  });
  return result;
};

describe('useSearchStateMachine 流式生成', () => {
  it('generateStream 成功 → DISPLAYING，各区块数据齐全', async () => {
    const result = await runSearch('加速度是什么');

    expect(result.current[0].state).toBe('DISPLAYING');
    expect(result.current[0].error).toBeUndefined();
    const gd = result.current[0].generatedData!;
    expect(gd.summary).toContain('加速度');
    expect(gd.mindMap).toHaveLength(1);
    expect(gd.concepts[0].example).toBe('汽车每小时行驶100公里。');
    expect(gd.knowledgeContext.prerequisites).toEqual(['速度']);
  });

  it('generateStream 仅调用 1 次（单次调用，不再分多次 fetch）', async () => {
    await runSearch('加速度是什么');
    expect(mockSearchApi.generateStream).toHaveBeenCalledTimes(1);
  });

  it('generateStream 使用 canonicalTopic 而非原始输入', async () => {
    await runSearch('加速度是什么');
    expect(mockSearchApi.generateStream.mock.calls[0][0]).toBe('加速度');
  });

  it('流式快照被消费：onPartial 收到的增量会进入 generatedData', async () => {
    let captured: any[] = [];
    mockSearchApi.generateStream.mockImplementation(async (topic: string, onPartial?: (s: any) => void) => {
      const data = { ...fullData(), topic };
      const snapshots = [
        { data: { ...data, mindMap: [], concepts: [] }, complete: false, completedKeys: ['summary'] },
        { data, complete: true, completedKeys: ['summary', 'mindMap', 'concepts'] },
      ];
      for (const s of snapshots) {
        captured.push(s);
        onPartial?.(s);
      }
      return ok(data);
    });

    const result = await runSearch('加速度');

    expect(captured).toHaveLength(2);
    const gd = result.current[0].generatedData!;
    // 最终态以完整数据为准
    expect(gd.mindMap).toHaveLength(1);
    expect(gd.concepts).toHaveLength(1);
  });

  it('快照合并：后到的空字段不会覆盖已有内容（防解析抖动导致内容闪回）', async () => {
    mockSearchApi.generateStream.mockImplementation(async (topic: string, onPartial?: (s: any) => void) => {
      const data = { ...fullData(), topic };
      // 第二帧模拟"解析回退"：summary 变空、mindMap 变空
      onPartial?.({ data: { ...data, summary: '', mindMap: [] }, complete: true, completedKeys: ['summary'] });
      return ok(data);
    });

    const result = await runSearch('加速度');

    const gd = result.current[0].generatedData!;
    // 最终以服务端完整结果为准
    expect(gd.summary).toContain('加速度');
    expect(gd.mindMap).toHaveLength(1);
  });

  it('generateStream 返回 success=false → IDLE 且提示"生成失败"', async () => {
    mockSearchApi.generateStream.mockResolvedValue(fail());

    const result = await runSearch('加速度');

    expect(result.current[0].state).toBe('IDLE');
    expect(result.current[0].error).toBe(strings.search.errors.generateFailed);
  });

  it('generateStream 返回无 data → IDLE 且提示"生成失败"', async () => {
    mockSearchApi.generateStream.mockResolvedValue({ success: true } as AIResponse<SearchGenerateResponse>);

    const result = await runSearch('加速度');

    expect(result.current[0].state).toBe('IDLE');
    expect(result.current[0].error).toBe(strings.search.errors.generateFailed);
  });

  it('generateStream 返回的 summary/mindMap/concepts 全空 → IDLE 且提示"生成失败"', async () => {
    const empty = {
      topic: '加速度',
      summary: '',
      mindMap: [],
      concepts: [],
      knowledgeContext: { prerequisites: [], relatedTopics: [], learningPath: [] },
      examQuestions: [],
      interestingFacts: [],
      examples: [],
      relatedResults: [],
    };
    mockSearchApi.generateStream.mockImplementation(async (_t: string, onPartial?: (s: any) => void) => {
      onPartial?.({ data: empty, complete: true, completedKeys: Object.keys(empty) });
      return ok(empty as SearchGenerateResponse);
    });

    const result = await runSearch('加速度');

    expect(result.current[0].state).toBe('IDLE');
    expect(result.current[0].error).toBe(strings.search.errors.generateFailed);
  });

  /**
   * 边界：模型只产出了 knowledgeContext / examQuestions（summary/mindMap/concepts 恰好为空）。
   * 修复前 hasUsableContent 只认 summary/mindMap/concepts 三者，会把这种"有实质内容"的结果
   * 误判为"无内容" → 页面空白。修复后应进入 DISPLAYING 正常展示。
   */
  it('只产出 knowledgeContext/examQuestions（前三者空）→ DISPLAYING 而非判空', async () => {
    const partial: SearchGenerateResponse = {
      topic: '加速度',
      summary: '',
      mindMap: [],
      concepts: [],
      conceptsOverview: '',
      examples: [],
      relatedResults: [],
      knowledgeContext: {
        prerequisites: ['速度、位移'],
        relatedTopics: ['匀变速直线运动'],
        learningPath: ['先理解速度，再理解速度变化'],
      },
      examQuestions: [
        { id: 'q1', type: 'essay', question: '什么是加速度？', answer: '速度变化率', explanation: '', difficulty: 'easy', source: { year: '2023', exam: '' } },
      ],
      interestingFacts: [],
    };
    mockSearchApi.generateStream.mockImplementation(async (_t: string, onPartial?: (s: any) => void) => {
      onPartial?.({ data: partial, complete: true, completedKeys: Object.keys(partial) });
      return ok(partial);
    });

    const result = await runSearch('加速度');

    expect(result.current[0].state).toBe('DISPLAYING');
    expect(result.current[0].generatedData?.knowledgeContext?.prerequisites).toHaveLength(1);
  });

  /**
   * 未分类异常（既不是链路中断，也不是模型侧上限）：分类器按内容侧 parse 兜底（GENERATE_FAILED），
   * 此时给用户看的是**通用失败文案**——原始 message 往往带着解析器内部状态
   * （"Failed to parse JSON response (length=…, preview: …)"）或厂商原文，
   * 属于技术细节，只进 console 与 interruption.detail，不上屏。
   */
  it('generateStream 抛出未分类异常 → IDLE 且为通用失败文案（不泄露技术细节）', async () => {
    mockSearchApi.generateStream.mockRejectedValue(new Error('Failed to parse JSON response (length=9634)'));

    const result = await runSearch('加速度');

    expect(result.current[0].state).toBe('IDLE');
    expect(result.current[0].error).toBe(strings.search.errors.generateFailed);
    expect(result.current[0].error).not.toContain('length=');
  });

  /**
   * 首字节超时契约：generateStream 抛 StreamTimeoutError → 状态机退回 IDLE，
   * 并写入**专属文案**（不是原始 Error.message —— 原始消息对终端用户不友好）。
   * 修这个 bug 之前用户会卡在"模型正在思考…已等待 511 秒"永远不下去。
   */
  it('generateStream 抛 StreamTimeoutError → IDLE 且错误为"等待超时"友好文案', async () => {
    mockSearchApi.generateStream.mockRejectedValue(new StreamTimeoutError('首字节超时：60000ms 内未收到任何数据', 60_000));

    const result = await runSearch('加速度');

    expect(result.current[0].state).toBe('IDLE');
    expect(result.current[0].error).toBe(strings.search.errors.firstByteTimeout);
    // 必须有 thinking=false —— 否则 WaitTimer 仍会显示"模型正在思考…"
    expect(result.current[0].thinking).toBe(false);
  });

  /**
   * 半截超时：流式已经吐出 summary，再超时 → 状态机进入 DISPLAYING 展示已收部分。
   *
   * 关键：原因**不再写进 `error`**（那会在内容上方压一条错误横幅），而是作为
   * `interruption` 挂到数据上，由内容末尾的 GenerationNotice 分档提示承载
   * （side=link / kind=timeout）。UI 里"错误提示衔接在内容最后"，但仍能知道刚才出了何事。
   */
  it('流式中间超时（已收到部分内容） → DISPLAYING + 中断归因挂到数据上（内容末尾提示）', async () => {
    const partial: SearchGenerateResponse = {
      topic: '加速度',
      summary: '加速度是描述速度变化快慢的物理量。',
      mindMap: [],
      concepts: [],
      examples: [],
      relatedResults: [],
      knowledgeContext: { prerequisites: [], relatedTopics: [], learningPath: [] },
      examQuestions: [],
      interestingFacts: [],
    };
    mockSearchApi.generateStream.mockImplementation(async (_t: string, onPartial?: (s: any) => void) => {
      onPartial?.({ data: partial, complete: false, completedKeys: ['summary'] });
      throw new StreamTimeoutError('首字节超时：60000ms', 60_000);
    });

    const result = await runSearch('加速度');

    expect(result.current[0].state).toBe('DISPLAYING');
    expect(result.current[0].generatedData?.summary).toBe('加速度是描述速度变化快慢的物理量。');
    // 已渲染的内容照常展示，不再压顶部错误横幅
    expect(result.current[0].error).toBeUndefined();
    expect(result.current[0].generatedData?.interruption?.side).toBe('link');
    expect(result.current[0].generatedData?.interruption?.kind).toBe('timeout');
  });
});

describe('useSearchStateMachine 归一化与问答切换', () => {
  it('非知识点 → onRedirectToQA(原始输入) 且不调用 generate', async () => {
    const onRedirectToQA = vi.fn();
    mockSearchApi.analyze.mockResolvedValue({
      success: true,
      data: {
        isSpecific: true,
        isKnowledgePoint: false,
        canonicalTopic: '《大学》的作者是谁',
        topic: '《大学》的作者是谁',
      },
    });

    const result = await runSearch('《大学》的作者是谁', { onRedirectToQA });

    expect(onRedirectToQA).toHaveBeenCalledTimes(1);
    expect(onRedirectToQA).toHaveBeenCalledWith('《大学》的作者是谁');
    expect(result.current[0].state).toBe('IDLE');
    expect(mockSearchApi.generateStream).not.toHaveBeenCalled();
  });

  it('isKnowledgePoint 缺省（undefined）→ 按知识点继续生成', async () => {
    mockSearchApi.analyze.mockResolvedValue({
      success: true,
      data: { isSpecific: true, canonicalTopic: '加速度', topic: '加速度' } as unknown as SearchAnalyzeResponse,
    });

    const result = await runSearch('加速度');

    expect(result.current[0].state).toBe('DISPLAYING');
    expect(mockSearchApi.generateStream).toHaveBeenCalled();
  });

  it('isSpecific=false 宽泛类别 → KNOWLEDGE_GRAPH，不调用 generate', async () => {
    mockSearchApi.analyze.mockResolvedValue({
      success: true,
      data: {
        isSpecific: false,
        isKnowledgePoint: true,
        canonicalTopic: '物理',
        topic: '物理',
        graphData: [{ id: 'g1', title: '力学', type: 'concept' }],
      },
    });

    const result = await runSearch('物理');

    expect(result.current[0].state).toBe('KNOWLEDGE_GRAPH');
    expect(result.current[0].graphData).toHaveLength(1);
    expect(mockSearchApi.generateStream).not.toHaveBeenCalled();
  });
});

describe('useSearchStateMachine 前置阶段边界', () => {
  it('validate 接口失败 → IDLE 且展示错误信息', async () => {
    mockSearchApi.validate.mockResolvedValue({
      success: false,
      error: { code: 'NO_KEY', message: '请先配置AI模型密钥', retryable: false },
    });

    const result = await runSearch('加速度');

    expect(result.current[0].state).toBe('IDLE');
    expect(result.current[0].error).toBe('请先配置AI模型密钥');
  });

  it('validate 判定无效输入 → INVALID 状态，不调用 analyze', async () => {
    mockSearchApi.validate.mockResolvedValue({ success: true, data: { valid: false, reason: '请输入搜索内容' } });

    const result = await runSearch('');

    expect(result.current[0].state).toBe('INVALID');
    expect(mockSearchApi.analyze).not.toHaveBeenCalled();
  });

  it('analyze 接口失败 → IDLE 且提示"分析失败"', async () => {
    mockSearchApi.analyze.mockResolvedValue({ success: false });

    const result = await runSearch('加速度');

    expect(result.current[0].state).toBe('IDLE');
    expect(result.current[0].error).toBe(strings.search.errors.analyzeFailed);
  });

  it('analyze 抛出异常 → IDLE 且错误为异常消息', async () => {
    mockSearchApi.analyze.mockRejectedValue(new Error('网络超时'));

    const result = await runSearch('加速度');

    expect(result.current[0].state).toBe('IDLE');
    expect(result.current[0].error).toBe('网络超时');
  });
});

describe('useSearchStateMachine selectGraphNode', () => {
  it('selectGraphNode 成功 → DISPLAYING，使用 node.topic 作为主题', async () => {
    const { result } = renderHook(() => useSearchStateMachine());
    const node: KnowledgeGraphNode = { id: 'n1', title: '微积分', topic: '微积分学', type: 'concept' };
    await act(async () => {
      result.current[1].selectGraphNode(node);
    });

    expect(mockSearchApi.generateStream).toHaveBeenCalledTimes(1);
    expect(mockSearchApi.generateStream.mock.calls[0][0]).toBe('微积分学');
    expect(result.current[0].state).toBe('DISPLAYING');
  });

  it('selectGraphNode 失败 → KNOWLEDGE_GRAPH 且提示"生成失败"', async () => {
    mockSearchApi.generateStream.mockResolvedValue(fail());

    const { result } = renderHook(() => useSearchStateMachine());
    const node: KnowledgeGraphNode = { id: 'n1', title: '微积分', type: 'concept' };
    await act(async () => {
      result.current[1].selectGraphNode(node);
    });

    expect(result.current[0].state).toBe('KNOWLEDGE_GRAPH');
    expect(result.current[0].error).toBe(strings.search.errors.generateFailed);
  });
});
