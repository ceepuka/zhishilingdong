import { describe, it, expect } from 'vitest';
import { mockAIService } from '../mockAIService';
import { generatedKnowledgeData } from '../../modules/search/mockData';

/**
 * 覆盖 knowledge-search 优化 Review R2 中的 mock 正则修复：
 * 1. /是谁/ 收窄为 /是谁$/，避免"知识点历史类提问"被误判为非知识点
 * 2. 归一化链支持剥离"是谁提出的/发现的/证明的"等后缀
 */
describe('mockAIService.search.analyze 非知识点判断（mock 正则）', () => {
  it('"牛顿是谁"（句尾是谁）判为非知识点', async () => {
    const res = await mockAIService.search.analyze('牛顿是谁');
    expect(res.data?.isKnowledgePoint).toBe(false);
  });

  it('"《大学》的作者是谁"判为非知识点', async () => {
    const res = await mockAIService.search.analyze('《大学》的作者是谁');
    expect(res.data?.isKnowledgePoint).toBe(false);
  });

  it('"123×456+789的结果是多少"判为非知识点', async () => {
    const res = await mockAIService.search.analyze('123×456+789的结果是多少');
    expect(res.data?.isKnowledgePoint).toBe(false);
  });

  it('"帮我写一封邮件"判为非知识点', async () => {
    const res = await mockAIService.search.analyze('帮我写一封邮件');
    expect(res.data?.isKnowledgePoint).toBe(false);
  });

  it('"林黛玉是谁"（作品角色名）判为非知识点，走问答', async () => {
    const res = await mockAIService.search.analyze('林黛玉是谁');
    expect(res.data?.isKnowledgePoint).toBe(false);
  });

  it('"抽象是什么梗"（网络热梗）判为非知识点，走问答', async () => {
    const res = await mockAIService.search.analyze('抽象是什么梗');
    expect(res.data?.isKnowledgePoint).toBe(false);
  });
});

describe('mockAIService.search.analyze 知识点历史问题不误判（/是谁/ 收窄回归）', () => {
  it('"加速度的定义是谁提出的"判为知识点并归一化为"加速度"', async () => {
    const res = await mockAIService.search.analyze('加速度的定义是谁提出的');
    expect(res.data?.isKnowledgePoint).toBe(true);
    expect(res.data?.canonicalTopic).toBe('加速度');
  });

  it('"万有引力定律是谁提出的"归一化为"万有引力定律"', async () => {
    const res = await mockAIService.search.analyze('万有引力定律是谁提出的');
    expect(res.data?.isKnowledgePoint).toBe(true);
    expect(res.data?.canonicalTopic).toBe('万有引力定律');
  });

  it('"勾股定理是谁证明的"归一化为"勾股定理"', async () => {
    const res = await mockAIService.search.analyze('勾股定理是谁证明的');
    expect(res.data?.isKnowledgePoint).toBe(true);
    expect(res.data?.canonicalTopic).toBe('勾股定理');
  });
});

describe('mockAIService.search.analyze 输入归一化', () => {
  const cases: [string, string][] = [
    ['加速度', '加速度'],
    ['加速度是什么', '加速度'],
    ['加速度的定义', '加速度'],
    ['说明加速度的概念', '加速度'],
    ['什么是加速度', '加速度'],
  ];

  it.each(cases)('%s → %s', async (input, expected) => {
    const res = await mockAIService.search.analyze(input);
    expect(res.data?.isKnowledgePoint).toBe(true);
    expect(res.data?.canonicalTopic).toBe(expected);
  });
});

describe('mockAIService.search.analyze 宽泛学科 → 知识图谱（带 category）', () => {
  it('"物理" 判为宽泛学科（isSpecific=false），graphData 每节点带 category', async () => {
    const res = await mockAIService.search.analyze('物理');
    expect(res.data?.isSpecific).toBe(false);
    expect(res.data?.isKnowledgePoint).toBe(true);
    expect(res.data?.graphData).toBeDefined();
    expect(res.data!.graphData!.length).toBeGreaterThan(0);
    // 根节点 + 分支 + 叶子都带 category
    const root = res.data!.graphData![0];
    expect(root.category).toBe('物理');
    expect(root.children!.length).toBeGreaterThan(0);
    expect(root.children![0].category).toBe('物理');
    expect(root.children![0].children![0].category).toBe('物理');
    // 叶子有 topic（点击后用于生成）
    expect(root.children![0].children![0].topic).toBeTruthy();
  });

  it('具体知识点（如"加速度"）不返回 graphData', async () => {
    const res = await mockAIService.search.analyze('加速度');
    expect(res.data?.isSpecific).toBe(true);
    expect(res.data?.graphData).toBeUndefined();
  });
});

describe('mockAIService.search.generate 试题年份范围（2023-2026）', () => {
  it('所有试题 source.year 均在 2023-2026 之间', async () => {
    const res = await mockAIService.search.generate('任意主题');
    const years = (res.data?.examQuestions ?? []).map(q => Number(q.source.year));
    expect(years.length).toBeGreaterThan(0);
    for (const year of years) {
      expect(year).toBeGreaterThanOrEqual(2023);
      expect(year).toBeLessThanOrEqual(2026);
    }
  });
});

describe('mockAIService.search.validate 输入边界', () => {
  it('空输入 → 无效', async () => {
    const res = await mockAIService.search.validate('');
    expect(res.data?.valid).toBe(false);
  });

  it('少于2个字符 → 无效', async () => {
    const res = await mockAIService.search.validate('a');
    expect(res.data?.valid).toBe(false);
  });

  it('正常输入 → 有效', async () => {
    const res = await mockAIService.search.validate('加速度');
    expect(res.data?.valid).toBe(true);
  });
});

describe('mockAIService.search.analyze 边界输入', () => {
  it('"是谁"单独输入 → 非知识点（句尾匹配）', async () => {
    const res = await mockAIService.search.analyze('是谁');
    expect(res.data?.isKnowledgePoint).toBe(false);
  });

  it('空字符串 → 兜底为知识点且 canonicalTopic 为空', async () => {
    const res = await mockAIService.search.analyze('');
    expect(res.data?.isKnowledgePoint).toBe(true);
    expect(res.data?.canonicalTopic).toBe('');
  });

  it('"是谁提出的"剥离后为空 → 兜底保留原文', async () => {
    const res = await mockAIService.search.analyze('是谁提出的');
    expect(res.data?.isKnowledgePoint).toBe(true);
    expect(res.data?.canonicalTopic).toBe('是谁提出的');
  });

  it('"介绍加速度"剥离前缀 → "加速度"', async () => {
    const res = await mockAIService.search.analyze('介绍加速度');
    expect(res.data?.canonicalTopic).toBe('加速度');
  });
});

describe('mockAIService.search.analyze 算式变体（×/x/*/空格）', () => {
  it.each([
    '12x34等于多少',
    '12*34等于多少',
    '12 × 34 等于多少',
    '计算12×34',
  ])('%s → 非知识点', async (input) => {
    const res = await mockAIService.search.analyze(input);
    expect(res.data?.isKnowledgePoint).toBe(false);
  });
});

describe('mockAIService.search.analyze 多重修饰循环剥离', () => {
  it.each([
    ['介绍什么是加速度', '加速度'],
    ['说明什么是微积分', '微积分'],
    ['解释加速度的定义', '加速度'],
    ['介绍说明加速度的概念', '加速度'],
    ['说明说明加速度', '加速度'],
    ['复数的应用有哪些', '复数'],
    ['光合作用需要光吗', '光合作用'],
    ['三角函数怎么学', '三角函数'],
  ])('%s → %s', async (input, expected) => {
    const res = await mockAIService.search.analyze(input);
    expect(res.data?.isKnowledgePoint).toBe(true);
    expect(res.data?.canonicalTopic).toBe(expected);
  });
});

describe('mockAIService.search.generate 全量返回', () => {
  it('返回 summary 概述且概念定义列表非空', async () => {
    const res = await mockAIService.search.generate('加速度');
    expect(res.data?.summary).toBeTruthy();
    expect(res.data?.summary).toContain('加速度');
    expect(res.data?.concepts?.length).toBeGreaterThanOrEqual(2);
    // 第一个概念应是主题本身的定义性概述（即"知识概述"）
    expect(res.data?.concepts?.[0]?.title).toBeTruthy();
  });

  it('概念示例内嵌于 concepts（example 可选）', async () => {
    const res = await mockAIService.search.generate('加速度');
    const concepts = res.data?.concepts ?? [];
    const withExample = concepts.filter(c => c.example);
    expect(withExample.length).toBeGreaterThan(0);
    // 至少有一个概念没有示例（可选性）
    expect(concepts.some(c => !c.example)).toBe(true);
  });

  it('knowledgeContext 返回非空 commonConclusions', async () => {
    const res = await mockAIService.search.generate('加速度');
    expect(res.data?.knowledgeContext?.commonConclusions?.length).toBeGreaterThan(0);
  });

  it('全量返回包含 summary/mindMap/concepts/knowledgeContext/examQuestions/interestingFacts', async () => {
    const res = await mockAIService.search.generate('加速度');
    expect(res.success).toBe(true);
    expect(res.data?.summary).toBeTruthy();
    expect(res.data?.mindMap?.length).toBeGreaterThan(0);
    expect(res.data?.concepts?.length).toBeGreaterThan(0);
    expect(res.data?.knowledgeContext).toBeTruthy();
    expect(res.data?.examQuestions?.length).toBeGreaterThan(0);
    expect(res.data?.interestingFacts?.length).toBeGreaterThan(0);
  });
});

describe('mockAIService 特定主题数据（generatedKnowledgeData）新格式', () => {
  it('所有主题 concepts 均为双层内容结构（elementary/advanced 非空）', () => {
    // 直接校验 mock 数据本身，避免 22 个主题串行调用服务导致超时
    for (const [topic, item] of Object.entries(generatedKnowledgeData)) {
      expect(item.concepts.length, `主题「${topic}」应至少有一个概念`).toBeGreaterThan(0);
      for (const c of item.concepts) {
        expect(typeof c.content, `「${topic}/${c.title}」content 应为对象`).toBe('object');
        const content = c.content as { elementary?: string; advanced?: string };
        expect(content.elementary?.trim().length, `「${topic}/${c.title}」elementary 非空`).toBeGreaterThan(0);
        expect(content.advanced?.trim().length, `「${topic}/${c.title}」advanced 非空`).toBeGreaterThan(0);
      }
    }
  });

  it('特定主题 summary 提及主题且首条概念是主题定义', async () => {
    const res = await mockAIService.search.generate('牛顿第二定律');
    expect(res.data?.summary).toContain('牛顿第二定律');
    const concepts = res.data?.concepts ?? [];
    // 第一条概念应是主题本身的定义性概述（不再是独立的 conceptsOverview 字段）
    expect(concepts[0]?.title).toBeTruthy();
    // 首条概念的标题包含主题名，content 给出该主题的严谨定义
    expect(concepts[0]?.title).toContain('牛顿第二定律');
  });

  it('特定主题的概念示例来自数据本身且标题可匹配', async () => {
    const res = await mockAIService.search.generate('牛顿第二定律');
    const concepts = res.data?.concepts ?? [];
    const withExample = concepts.filter(c => c.example);

    expect(withExample.length).toBeGreaterThan(0);
    // 示例内容是真实数据而非通用占位
    const fma = concepts.find(c => c.title === '牛顿第二定律公式');
    expect(fma?.example).toContain('5m/s²');
    // 存在无示例的概念（可选性）
    expect(concepts.some(c => !c.example)).toBe(true);
  });

  it('特定主题 summary 使用定义概念的严谨解释', async () => {
    const res = await mockAIService.search.generate('牛顿第二定律');
    expect(res.data?.summary).toContain('加速度');
  });

  it('特定主题知识脉络的关联主题来自思维导图分支（非占位）', async () => {
    const res = await mockAIService.search.generate('物理定律');
    const related = res.data?.knowledgeContext?.relatedTopics ?? [];
    expect(related).toContain('经典力学');
    expect(related).not.toContain('相关主题1');
  });
});
