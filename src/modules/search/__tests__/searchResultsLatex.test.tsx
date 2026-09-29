import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { SearchResults } from '../SearchResults';
import type { GeneratedKnowledge, ExamQuestion } from '../../../types';

// vitest 未开启 globals，RTL 自动 cleanup 不会注册；同文件多次 render 会互相污染
afterEach(cleanup);

/**
 * 公式渲染覆盖回归测试。
 *
 * 用户实测截图暴露两类问题：
 *   ① 覆盖缺口：keyPoints / pitfalls 等字段没走统一渲染入口，`$\vec{F}$` 原样露出；
 *   ② 裸 LaTeX：`\sqrt{13}`、`\triangle ABC` 无 $ 围符，只认围符的渲染器识别不了。
 * 这里断言二者都被修复 —— 字段内出现 KaTeX，且不再残留 LaTeX 源码。
 */

const base = (): GeneratedKnowledge => ({
  topic: '专题',
  summary: '概述',
  mindMap: [{ id: 'root', title: '专题', level: 'root', children: [] }],
  concepts: [],
  examples: [],
  relatedResults: [],
  knowledgeContext: { prerequisites: [], relatedTopics: [], learningPath: [] },
  examQuestions: [],
  interestingFacts: [],
});

const withConcept = (concept: Partial<GeneratedKnowledge['concepts'][number]>): GeneratedKnowledge => ({
  ...base(),
  concepts: [
    {
      type: 'formula',
      title: '牛顿第二定律公式',
      content: { elementary: '力大跑得快', advanced: '合力等于质量与加速度的乘积' },
      ...concept,
    } as GeneratedKnowledge['concepts'][number],
  ],
});

describe('SearchResults 公式渲染覆盖（统一入口）', () => {
  it('概览（summary）仍渲染在标题卡内、紧跟标题 —— 搜索页观感不能变', () => {
    const { container } = render(
      <SearchResults data={null} generatedData={{ ...base(), summary: '这是概览段 $a^2+b^2=c^2$' }} />
    );

    const h2 = container.querySelector('h2')!;
    // h2 → 标题行（flex）→ 标题卡
    const card = h2.parentElement!.parentElement!;
    // 概览必须和标题在**同一张**卡里（曾经把它挪出去过，那是回退）
    expect(card.className).toContain('from-teal-50');
    expect(card.textContent).toContain('这是概览段');
    expect(card.textContent).not.toContain('$a^2');
    // 顺序：标题在前，概览在后
    expect(card.innerHTML.indexOf('专题')).toBeLessThan(card.innerHTML.indexOf('这是概览段'));
  });

  it('keyPoints 里的 $...$ 公式渲染为 KaTeX，不再原样露出源码', () => {
    const { container } = render(
      <SearchResults
        data={null}
        generatedData={withConcept({ keyPoints: ['公式中的 $\\vec{F}$ 是合外力，不是单个力'] })}
      />
    );

    expect(container.innerHTML).toContain('katex');
    expect(container.textContent).toContain('是合外力，不是单个力');
    // KaTeX HTML 输出不含 LaTeX 源码
    expect(container.textContent).not.toContain('\\vec');
  });

  it('pitfalls 里的裸 LaTeX（无 $ 围符）也能渲染', () => {
    const { container } = render(
      <SearchResults
        data={null}
        generatedData={withConcept({ pitfalls: ['注意 $\\vec{a}$ 与速度同向，别写成 \\sqrt{13}'] })}
      />
    );

    expect(container.innerHTML).toContain('katex');
    expect(container.textContent).not.toContain('\\sqrt');
    expect(container.textContent).toContain('别写成');
  });

  it('试题题干/选项里的裸 LaTeX 渲染为 KaTeX', () => {
    const q: ExamQuestion = {
      id: 'q1',
      type: 'choice',
      question: '在 \\triangle ABC 中，已知 $a = 3, b = 4, C = 60^\\circ$，则边 $c$ 的长为（ ）',
      options: ['\\sqrt{13}', '\\sqrt{37}', '5', '\\sqrt{13} 或 \\sqrt{37}'],
      answer: 'A',
      explanation: '由余弦定理 $c^2 = a^2 + b^2 - 2ab\\cos C$ 得 $c=\\sqrt{13}$',
      difficulty: 'medium',
      source: { year: '2024', exam: '期末' },
    };
    const { container } = render(<SearchResults data={null} generatedData={{ ...base(), examQuestions: [q] }} />);

    expect(container.innerHTML).toContain('katex');
    expect(container.textContent).not.toContain('\\triangle');
    expect(container.textContent).not.toContain('\\sqrt');
  });

  it('试题配图：imageData 存在时渲染原图 <img>，且不再退回 SVG', () => {
    const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQAY3Y2wAAAAAElFTkSuQmCC';
    const q: ExamQuestion = {
      id: 'q1',
      type: 'calculation',
      question: '求最大角',
      imageData: png,
      svg: "<svg viewBox='0 0 10 10'><rect/></svg>",
      answer: '90°',
      explanation: '略',
      difficulty: 'medium',
      source: { year: '2024', exam: '期末' },
    };
    const { container } = render(<SearchResults data={null} generatedData={{ ...base(), examQuestions: [q] }} />);

    const img = container.querySelector('img');
    expect(img).toBeTruthy();
    expect(img!.getAttribute('src')).toBe(png);
    expect(container.querySelector('figure')).toBeNull();
  });
});
