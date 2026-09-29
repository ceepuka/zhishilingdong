import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { SearchResults } from '../SearchResults';
import type { GeneratedKnowledge } from '../../../types';

// vitest 未开启 globals，RTL 的自动 cleanup 不会注册；同一文件多次 render 会互相污染
afterEach(cleanup);

/**
 * 流式渲染时序回归测试。
 *
 * 真实字段产出顺序：summary → mindMap → conceptsOverview → concepts → …
 * 「总述」(conceptsOverview) 比「概念列表」(concepts) 早一个字段到达，
 * 因此它必须能在 concepts 还为空时就渲染出来；否则用户会看到
 * "总述迟迟不显示，直到概念卡片冒出来才一起蹦出来"。
 */

const OVERVIEW = '勾股定理的核心是直角三角形三边关系，下文按定义→公式→定理的顺序展开。';
const CONCEPT_TITLE = '勾股定理';

const midStream = (): GeneratedKnowledge => ({
  topic: CONCEPT_TITLE,
  summary: '勾股定理描述直角三角形两直角边与斜边的数量关系。',
  conceptsOverview: OVERVIEW,
  mindMap: [{ id: 'root', title: CONCEPT_TITLE, level: 'root', children: [] }],
  // 关键：概念列表还没开始产出
  concepts: [],
  examples: [],
  relatedResults: [],
  knowledgeContext: { prerequisites: [], relatedTopics: [], learningPath: [] },
  examQuestions: [],
  interestingFacts: [],
});

describe('SearchResults 流式渲染时序', () => {
  it('总述先于概念列表到达时就立即渲染，不被 concepts 门控卡住', () => {
    render(<SearchResults data={null} generatedData={midStream()} loading />);

    expect(screen.getByText(OVERVIEW)).toBeTruthy();
  });

  it('概念列表到达后，总述与概念卡片同时可见', () => {
    const data: GeneratedKnowledge = {
      ...midStream(),
      concepts: [
        {
          type: 'theorem',
          title: CONCEPT_TITLE,
          content: { elementary: '直角三角形两条直角边的平方和等于斜边的平方', advanced: 'a² + b² = c²' },
          keyPoints: [],
          pitfalls: [],
        },
      ],
    };

    render(<SearchResults data={null} generatedData={data} loading />);

    expect(screen.getByText(OVERVIEW)).toBeTruthy();
    expect(screen.getAllByText(CONCEPT_TITLE).length).toBeGreaterThan(0);
  });

  it('总述与概念列表都为空时不渲染核心概念区块', () => {
    const data: GeneratedKnowledge = { ...midStream(), conceptsOverview: undefined, concepts: [] };

    const { container } = render(<SearchResults data={null} generatedData={data} />);

    expect(container.textContent).not.toContain(OVERVIEW);
  });
});
