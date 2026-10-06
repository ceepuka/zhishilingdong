import { describe, it, expect } from 'vitest';
import { generateKnowledgeNote } from '../export';
import type { GeneratedKnowledge } from '../../types';

/**
 * 知识笔记导出回归。
 *
 * 背景（两条真实的"导出丢内容"故障，都属于同一类）：
 *
 * 1. **概览（summary）丢失**：原先只出现在「复制」生成的 Markdown 里，导出文件
 *    （txt / md / html）整段没有 —— 同一份内容两个出口口径不一致。
 *
 * 2. **知识脉络 / 试题 / 趣味知识整段丢失**：`generateKnowledgeNote` 当时
 *    **完全没有这三个字段的分支**，而页面上三个区块都在渲染（见
 *    `components/knowledge/KnowledgeContentView`），「复制」出口也有。
 *    于是搜索结果导出后丢了一半内容 —— 这是比第1 条严重得多的同类问题，
 *    但同一个函数里没人注意到。
 *
 * 本文件同时锁住"三格式都必须含"和"字段之间不串味"。
 */

const base = (): GeneratedKnowledge => ({
  topic: '牛顿第二定律',
  summary: '合力 $F=ma$ 决定加速度',
  mindMap: [],
  concepts: [],
  examples: [],
  relatedResults: [],
  knowledgeContext: { prerequisites: [], relatedTopics: [], learningPath: [] },
  examQuestions: [],
  interestingFacts: [],
});

const full = (): GeneratedKnowledge => ({
  ...base(),
  knowledgeContext: {
    prerequisites: ['加速度', '受力分析'],
    relatedTopics: ['牛顿第一定律', '动量守恒'],
    learningPath: ['理解加速度定义', '学会画受力图', '用公式定量计算'],
    commonConclusions: ['受力分析要先选正方向', '单位必须统一到国际单位制'],
    confusables: [{ topic: '动量定理', difference: '动量守恒关注系统，初末状态量守恒' }],
  },
  examQuestions: [
    {
      id: 'q1',
      type: 'choice',
      question: '质量 2kg 的物体受 6N 合外力，加速度是多少？',
      options: ['1 m/s²', '2 m/s²', '3 m/s²', '12 m/s²'],
      answer: 'C',
      explanation: '由 a = F/m = 6/2 = 3 m/s²。',
      difficulty: 'easy',
      source: { year: '2023', exam: '高考物理', section: '力学' },
    },
  ],
  interestingFacts: [
    { id: 'f1', title: '阿波罗计划的讽刺', content: '登月用的导航计算机性能还不如今天的微波炉。', type: 'history' },
  ],
});

describe('知识笔记导出 — 概览（summary）不得丢失', () => {
  it('txt / md / html 三种格式都包含概览', () => {
    const { txt, md, html } = generateKnowledgeNote(base());

    expect(txt).toContain('合力 $F=ma$ 决定加速度');
    expect(md).toContain('合力 $F=ma$ 决定加速度');
    expect(html).toContain('合力 $F=ma$ 决定加速度');
  });

  it('概览排在标题之后（作为引导段，而不是混在末尾）', () => {
    const { md } = generateKnowledgeNote(base());

    expect(md.indexOf('# 牛顿第二定律')).toBeLessThan(md.indexOf('合力 $F=ma$ 决定加速度'));
  });

  it('没有概览时不产出 undefined 字样', () => {
    const { txt, md, html } = generateKnowledgeNote({ ...base(), summary: undefined });

    expect(txt).not.toContain('undefined');
    expect(md).not.toContain('undefined');
    expect(html).not.toContain('undefined');
  });
});

describe('知识笔记导出 — 知识脉络不得丢失', () => {
  it('三格式都含前置知识与关联主题', () => {
    const { txt, md, html } = generateKnowledgeNote(full());

    for (const out of [txt, md, html]) {
      expect(out).toContain('加速度');
      expect(out).toContain('受力分析');
      expect(out).toContain('动量守恒');
    }
  });

  it('学习路径逐条编号列出，不挤成一行', () => {
    const { md } = generateKnowledgeNote(full());

    expect(md).toContain('1. 理解加速度定义');
    expect(md).toContain('2. 学会画受力图');
    expect(md).toContain('3. 用公式定量计算');
  });

  it('常用结论与易混辨析都要写出', () => {
    const { md } = generateKnowledgeNote(full());

    expect(md).toContain('受力分析要先选正方向');
    expect(md).toContain('动量定理');
    expect(md).toContain('动量守恒关注系统');
  });

  it('知识脉络排在核心概念之后（与页面上区块顺序一致）', () => {
    const data = full();
    data.concepts = [
      {
        type: 'definition',
        title: '牛顿第二定律',
        content: { elementary: '力决定加速度', advanced: 'F=ma' },
      },
    ];
    const { md } = generateKnowledgeNote(data);

    expect(md.indexOf('牛顿第二定律')).toBeLessThan(md.indexOf('加速度'));
  });
});

describe('知识笔记导出 — 试题不得丢失', () => {
  it('三格式都含题干、答案与解析', () => {
    const { txt, md, html } = generateKnowledgeNote(full());

    for (const out of [txt, md, html]) {
      expect(out).toContain('加速度是多少');
      expect(out).toContain('C');
      expect(out).toContain('a = F/m = 6/2 = 3 m/s²');
    }
  });

  it('选项按 A/B/C/D 逐条列出', () => {
    const { md } = generateKnowledgeNote(full());

    expect(md).toContain('A. 1 m/s²');
    expect(md).toContain('B. 2 m/s²');
    expect(md).toContain('C. 3 m/s²');
    expect(md).toContain('D. 12 m/s²');
  });

  it('难度与出处都要带上（出处是真题可信度的唯一依据）', () => {
    const { md } = generateKnowledgeNote(full());

    expect(md).toContain('2023');
    expect(md).toContain('高考物理');
    expect(md).toContain('力学');
  });

  it('html 用标签表达结构（不是把 md 源码塞进去）', () => {
    const { html } = generateKnowledgeNote(full());

    expect(html).toContain('<h3>');
    expect(html).toContain('<ul>');
    // md 标记不能裸露在 html 里
    expect(html).not.toContain('**答案');
    expect(html).not.toContain('```');
  });
});

describe('知识笔记导出 — 趣味知识不得丢失', () => {
  it('三格式都含标题与正文', () => {
    const { txt, md, html } = generateKnowledgeNote(full());

    for (const out of [txt, md, html]) {
      expect(out).toContain('阿波罗计划的讽刺');
      expect(out).toContain('微波炉');
    }
  });

  it('趣味知识排在试题之后', () => {
    const { md } = generateKnowledgeNote(full());

    expect(md.indexOf('加速度是多少')).toBeLessThan(md.indexOf('阿波罗计划的讽刺'));
  });
});

describe('知识笔记导出 — 对象数组不得被当成字符串插值', () => {
  // 真实事故：`examples` 的字符串分支只判了 `length > 0`、没判 typeof，
  // 于是对象数组（{title, description, steps}）被 `${example}` 插值成
  // "[object Object]" —— 而且它**占住了标题**，让下方真正的对象分支永不执行。
  const withObjectExamples = (): GeneratedKnowledge => ({
    ...base(),
    examples: [
      { title: '斜面上放物体', description: '沿斜面匀速下滑', steps: ['受力分析', '列方程'], result: 'a = g(sinθ − μcosθ)' },
    ],
  });

  it('不产出 [object Object]', () => {
    const { txt, md, html } = generateKnowledgeNote(withObjectExamples());

    for (const out of [txt, md, html]) {
      expect(out).not.toContain('[object Object]');
    }
  });

  it('产出示例的标题 / 描述 / 步骤 / 结论', () => {
    const { txt, md } = generateKnowledgeNote(withObjectExamples());

    for (const out of [txt, md]) {
      expect(out).toContain('斜面上放物体');
      expect(out).toContain('沿斜面匀速下滑');
      expect(out).toContain('受力分析');
      expect(out).toContain('a = g(sin');
    }
  });

  it('示例区块标题只出现一次（不重复也不遗漏）', () => {
    const { md } = generateKnowledgeNote(withObjectExamples());
    // 不能断言具体标题文案 —— 区块标题走 i18n，测试环境读到的语言取决于
    // localStorage。这里只数"二级标题"的总数：对象分支多跑一次就会多一个标题。
    const headings = md.match(/^## /gm) ?? [];

    expect(headings).toHaveLength(1);
  });
});

describe('知识笔记导出 — 缺字段时不产出空壳或 undefined', () => {
  it('空区块不产生空标题（页面上不渲染，导出也不该留痕）', () => {
    const { txt, md, html } = generateKnowledgeNote(base());

    // base() 的 knowledgeContext 是空数组结构，不该出现区块标题
    expect(md).not.toContain('undefined');
    expect(txt).not.toContain('undefined');
    expect(html).not.toContain('undefined');
    // 三格式都不该有"只有标题没有内容"的区块
    for (const out of [txt, md, html]) {
      expect(out).not.toMatch(/^##\s*\n\s*\n##/m);
    }
  });

  it('空的 knowledgeContext 不产出任何二级标题', () => {
    // 页面上五个子字段全空时整个区块不渲染；导出曾只判"对象存在"，
    // 于是凭空多出一个光秃秃的「## 知识脉络」标题
    const { md } = generateKnowledgeNote(base());

    expect(md.match(/^## /gm) ?? []).toHaveLength(0);
  });

  it('任何格式都不产生 undefined / null 字样', () => {
    const data: GeneratedKnowledge = {
      ...full(),
      summary: undefined,
      conceptsOverview: undefined,
    };
    const { txt, md, html } = generateKnowledgeNote(data);

    for (const out of [txt, md, html]) {
      expect(out).not.toContain('undefined');
      expect(out).not.toContain('null');
    }
  });
});