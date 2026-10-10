import { describe, it, expect } from 'vitest';
import { StreamingJSONParser, isCompleteJSON, analyzeJSON } from '../partialJSON';

/** 把整段文本按指定大小切片，模拟真实网络分块 */
function streamAll<T>(parser: StreamingJSONParser<T>, text: string, chunkSize = 7): ReturnType<StreamingJSONParser<T>['read']>[] {
  const snaps = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    snaps.push(parser.push(text.slice(i, i + chunkSize)));
  }
  snaps.push(parser.finish());
  return snaps;
}

describe('StreamingJSONParser — 增量 JSON 解析', () => {
  it('完整流结束后能解析出与 JSON.parse 一致的结果', () => {
    const obj = {
      topic: '加速度',
      summary: '描述速度变化快慢的物理量',
      mindMap: [{ id: 'root', title: '加速度', level: 'root', children: [{ id: 'b1', title: '定义', level: 'branch' }] }],
      concepts: [{ type: 'definition', title: '瞬时加速度', content: { elementary: '速度变化的快慢', advanced: 'a = dv/dt' } }],
      count: 42,
      enabled: true,
    };
    const text = JSON.stringify(obj);

    const parser = new StreamingJSONParser<any>();
    const snaps = streamAll(parser, text, 5);
    const last = snaps[snaps.length - 1];

    expect(last.complete).toBe(true);
    expect(last.data).toEqual(obj);
  });

  it('流式过程中能逐步拿到已成形字段（边生成边渲染的基础）', () => {
    const text = '{"summary":"前半句","mindMap":[{"id":"r","title":"根"}]}';
    const parser = new StreamingJSONParser<any>();
    const snaps = streamAll(parser, text, 3);

    // summary 先成形
    const withSummary = snaps.find(s => s.completedKeys.includes('summary'));
    expect(withSummary).toBeTruthy();
    expect(withSummary!.data.summary).toBe('前半句');

    // mindMap 后成形
    const withMindMap = snaps.find(s => s.completedKeys.includes('mindMap'));
    expect(withMindMap).toBeTruthy();
    expect(withMindMap!.data.mindMap).toHaveLength(1);
  });

  it('容器型字段（数组 / 对象）在流式中间态就已判定完成', () => {
    // 复现真实 bug：真实生成顺序是 summary → mindMap → conceptsOverview → concepts…
    // mindMap 是数组。它闭合后 completedKeys 必须立刻含 mindMap，
    // 否则步骤指示会一直卡在"正在生成知识导图"，直到整个 JSON 结束才前进。
    const parser = new StreamingJSONParser<any>();
    parser.push('{"summary":"定位","mindMap":[{"id":"r","title":"根"}]');
    const snap = parser.read();

    expect(snap.complete).toBe(false);
    expect(snap.completedKeys).toEqual(expect.arrayContaining(['summary', 'mindMap']));
  });

  it('对象型字段闭合后也立即进入 completedKeys', () => {
    const parser = new StreamingJSONParser<any>();
    parser.push('{"summary":"定位","knowledgeContext":{"prerequisites":["速度"]}');
    const snap = parser.read();

    expect(snap.complete).toBe(false);
    expect(snap.completedKeys).toContain('knowledgeContext');
  });

  it('按真实字段顺序流式推进时，每个字段都进过 completedKeys 且顺序不倒退', () => {
    const order = ['summary', 'mindMap', 'conceptsOverview', 'concepts', 'knowledgeContext', 'examQuestions', 'interestingFacts'];
    const text = JSON.stringify({
      topic: '勾股定理',
      summary: '定位',
      mindMap: [{ id: 'r', title: '勾股定理' }],
      conceptsOverview: '总述',
      concepts: [{ type: 'definition', title: '勾股定理', content: { elementary: '', advanced: '' } }],
      knowledgeContext: { prerequisites: [], relatedTopics: [], learningPath: [] },
      examQuestions: [],
      interestingFacts: [],
    });

    const parser = new StreamingJSONParser<any>();
    // 逐字符推送 → 每个字段完成于不同的快照，可精确比较先后顺序
    const snaps = streamAll(parser, text, 1);

    const firstSeenAt: Record<string, number> = {};
    snaps.forEach((s, i) => {
      for (const k of order) {
        if (!(k in firstSeenAt) && s.completedKeys.includes(k)) firstSeenAt[k] = i;
      }
    });

    for (const k of order) {
      expect(firstSeenAt[k], `字段 ${k} 从未进入 completedKeys`).toBeTypeOf('number');
    }
    const seenOrder = order.map(k => firstSeenAt[k]);
    for (let i = 1; i < seenOrder.length; i++) {
      expect(seenOrder[i], `字段顺序倒退：${order[i]}`).toBeGreaterThan(seenOrder[i - 1]);
    }
  });

  it('正在写的长字符串会逐段呈现（打字机效果）', () => {
    const text = '{"reply":"这是一段比较长的回答内容用来验证打字机效果"}';
    const parser = new StreamingJSONParser<any>();
    const snaps = streamAll(parser, text, 4);

    const lengths = snaps
      .map(s => (s.data?.reply as string) || '')
      .map(s => s.length)
      .filter((n, i, arr) => i === 0 || n !== arr[i - 1]);

    // 长度应当单调递增，且中间出现过多个不同的中间态
    expect(lengths.length).toBeGreaterThan(3);
    for (let i = 1; i < lengths.length; i++) {
      expect(lengths[i]).toBeGreaterThanOrEqual(lengths[i - 1]);
    }
    // 最终结果完整
    expect(snaps[snaps.length - 1].data.reply).toBe('这是一段比较长的回答内容用来验证打字机效果');
  });

  it('能跳过 markdown 代码围栏', () => {
    const text = '```json\n{"topic":"勾股定理","n":1}\n```';
    const parser = new StreamingJSONParser<any>();
    const last = streamAll(parser, text).pop()!;
    expect(last.data).toEqual({ topic: '勾股定理', n: 1 });
  });

  it('字符串里的花括号/引号不会破坏结构判断', () => {
    const text = JSON.stringify({ formula: 'a = {x | x > 0}', note: '他说："这是公式"' });
    const parser = new StreamingJSONParser<any>();
    const last = streamAll(parser, text, 3).pop()!;
    expect(last.data.formula).toBe('a = {x | x > 0}');
    expect(last.data.note).toBe('他说："这是公式"');
  });

  it('任意时刻截断都不会抛错，且已解析部分保持合法', () => {
    const text = JSON.stringify({
      a: '文字内容',
      b: [1, 2, { c: '嵌套' }],
      d: { e: '深层', f: [true, false, null] },
    });

    for (let cut = 1; cut <= text.length; cut++) {
      const parser = new StreamingJSONParser<any>();
      expect(() => parser.push(text.slice(0, cut))).not.toThrow();
      const snap = parser.read();
      // data 要么为 null（还没成形），要么是个对象
      if (snap.data !== null) {
        expect(typeof snap.data).toBe('object');
      }
    }
  });

  it('顶层数组也能解析', () => {
    const text = '[{"a":1},{"a":2}]';
    const parser = new StreamingJSONParser<any>();
    const last = streamAll(parser, text, 3).pop()!;
    expect(last.data).toEqual([{ a: 1 }, { a: 2 }]);
  });

  it('未开始时传入无关前言不会误判', () => {
    const parser = new StreamingJSONParser<any>();
    expect(parser.push('好的，以下是结果：').data).toBeNull();
    const snap = parser.push('{"topic":"x"}');
    expect(snap.data).toEqual({ topic: 'x' });
  });
});

describe('isCompleteJSON / analyzeJSON（续写完整性判定的权威依据）', () => {
  it('isCompleteJSON：完整对象 → true，截断 → false', () => {
    expect(isCompleteJSON('{"a":1}')).toBe(true);
    expect(isCompleteJSON('{"a":1')).toBe(false);
    expect(isCompleteJSON('{"a":[1,2]}')).toBe(true);
    // 数组未闭合但花括号闭合 → false（边界回归：曾只判 {} 误判 true）
    expect(isCompleteJSON('{"a":[1,2}')).toBe(false);
    // 带 markdown 围栏
    expect(isCompleteJSON('```json\n{"a":1}\n```')).toBe(true);
    // 前言 + 尾部多余文字
    expect(isCompleteJSON('结果如下：{"a":1} 以上')).toBe(true);
    // 无 JSON
    expect(isCompleteJSON('hello')).toBe(false);
    expect(isCompleteJSON('')).toBe(false);
  });

  it('analyzeJSON：complete=false 时给 completedKeys，complete=true 时给全字段', () => {
    // 未闭合：completedKeys 是"已闭合的字段"
    const partial = analyzeJSON('{"summary":"s","mindMap":[{"id":"r"}]');
    expect(partial).not.toBeNull();
    expect(partial!.complete).toBe(false);
    expect(partial!.completedKeys).toEqual(expect.arrayContaining(['summary', 'mindMap']));

    // 闭合：completedKeys 是全字段
    const full = analyzeJSON('{"topic":"t","mindMap":[],"concepts":[],"knowledgeContext":{},"examQuestions":[],"interestingFacts":[]}');
    expect(full!.complete).toBe(true);
    expect(full!.completedKeys).toEqual(expect.arrayContaining(['topic', 'mindMap', 'concepts', 'knowledgeContext', 'examQuestions', 'interestingFacts']));
  });

  it('analyzeJSON：无 JSON 起始符 → null', () => {
    expect(analyzeJSON('前言文字')).toBeNull();
    expect(analyzeJSON('')).toBeNull();
  });

  it('analyzeJSON：给出「正在写的顶层字段」pendingKey（续写提示词要用它报告进度）', () => {
    // 正在写 mindMap 的值（嵌套容器未闭合）→ pendingKey = mindMap
    const writing = analyzeJSON('{"topic":"t","mindMap":[{"id":"r"}');
    expect(writing!.complete).toBe(false);
    expect(writing!.completedKeys).toEqual(expect.arrayContaining(['topic']));
    expect(writing!.pendingKey).toBe('mindMap');

    // 值刚闭合完、还没开始下一个键 → 没有"正在写"的字段
    const between = analyzeJSON('{"topic":"t","mindMap":[]');
    expect(between!.pendingKey).toBeNull();

    // 整体已闭合 → 没有"正在写"的字段
    const done = analyzeJSON('{"a":1}');
    expect(done!.complete).toBe(true);
    expect(done!.pendingKey).toBeNull();

    // 字符串值写到一半 → 仍算"正在写该字段"
    const strValue = analyzeJSON('{"topic":"加速');
    expect(strValue!.pendingKey).toBe('topic');
  });
});
