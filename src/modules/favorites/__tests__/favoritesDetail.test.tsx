import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import type { ComponentType } from 'react';

/**
 * 收藏详情渲染回归。
 *
 * 这块以前是**手写的降级渲染**：纯 `<p>{text}</p>`（公式全部裸露成 `$...$` 源码）、
 * mindMap 只取前 8 个标题当标签（没有真正的思维导图）、没有配图、
 * 没有 notation / keyPoints / pitfalls / knowledgeContext。
 *
 * 现在收藏与搜索共用 `KnowledgeContentView`，本文件锁住"两边渲染一致"这件事。
 */

const STORAGE_KEY = 'ai-office-assistant-favorites';

const KNOWLEDGE_TOPIC = '牛顿第二定律';
const MINDMAP_ONLY_TOPIC = '只有导图没有概念列表';
const DOC_TITLE = '实验报告';
const LEGACY_TITLE = '旧格式公式卡';

const FAVORITES = [
  {
    id: 'k1',
    type: 'knowledge',
    label: KNOWLEDGE_TOPIC,
    timestamp: 1700000000000,
    spaceId: 'default',
    data: {
      topic: KNOWLEDGE_TOPIC,
      summary: '合力 $F=ma$ 决定加速度',
      conceptsOverview: '总述：加速度 $a$ 与合力 $F$ 成正比',
      mindMap: [
        {
          id: 'r',
          title: KNOWLEDGE_TOPIC,
          level: 'root',
          children: [{ id: 'c1', title: '公式形式', level: 'branch', description: 'F=ma' }],
        },
      ],
      concepts: [
        {
          type: 'formula',
          title: '第二定律公式',
          content: { elementary: '合外力等于质量乘加速度', advanced: '$\\vec{F}=m\\vec{a}$ 为矢量式' },
          notation: 'F = ma',
          image: 'https://example.com/newton.png',
          keyPoints: ['要点：同向性'],
          pitfalls: ['易错：质量不可变'],
          example: '例：$m=2$ 时 $F=4$ 则 $a=2$',
        },
      ],
      knowledgeContext: {
        prerequisites: ['力'],
        relatedTopics: ['惯性'],
        learningPath: ['第一步：受力分析'],
      },
      examQuestions: [
        {
          id: 'q1',
          type: 'choice',
          question: '合力 $F$ 与加速度的关系是',
          options: ['$F=ma$', '$F=mv$'],
          answer: 'A',
          explanation: '由 $F=ma$ 直接得到',
          difficulty: 'easy',
          source: { year: '2024', exam: '高考' },
        },
      ],
      interestingFacts: [{ id: 'f1', title: '小知识', content: '含 $a$ 的趣味内容', type: 'fun' }],
    },
  },
  {
    // 回归数据：有 topic 和 mindMap，但**没有 concepts**。
    // 旧实现的 `typeof topic === 'string' && Array.isArray(concepts)` 判据会把它
    // 误判成旧格式，转去渲染 title/definition/points → 详情页几乎空白。
    id: 'k2',
    type: 'knowledge',
    label: MINDMAP_ONLY_TOPIC,
    timestamp: 1700000000001,
    spaceId: 'default',
    data: {
      topic: MINDMAP_ONLY_TOPIC,
      mindMap: [
        {
          id: 'r2',
          title: MINDMAP_ONLY_TOPIC,
          level: 'root',
          children: [{ id: 'c2', title: '分支A', level: 'branch' }],
        },
      ],
    },
  },
  {
    // 历史遗留格式（KnowledgeCardData）：顶层有 type，没有 topic → 必须走旧分支兜底渲染
    id: 'k3',
    type: 'knowledge',
    label: '',
    timestamp: 1700000000003,
    spaceId: 'default',
    data: {
      type: 'formula',
      title: LEGACY_TITLE,
      formula: '\\frac{a}{b}',
      definition: '旧格式定义 $x$',
      points: ['旧格式要点'],
    },
  },
  {
    id: 'd1',
    type: 'document',
    label: '',
    timestamp: 1700000000002,
    spaceId: 'default',
    data: {
      type: 'general',
      title: DOC_TITLE,
      content: `# ${DOC_TITLE}\n\n公式 $E=mc^2$ 与 $$F=ma$$`,
    },
  },
];

let FavoritesModule: ComponentType<Record<string, never>>;

beforeAll(async () => {
  // useFavorites 在模块加载时就读 localStorage，所以必须"先播种、再导入"。
  // 这个模块图很大（i18n + baseAIProvider + 知识渲染链），首次转换可能超过默认 10s hook 超时。
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(FAVORITES));
  const mod = await import('../index');
  FavoritesModule = mod.FavoritesModule as unknown as ComponentType<Record<string, never>>;
}, 60000);

afterEach(cleanup);

/** 渲染收藏页并点开指定标题的收藏 */
function openItem(title: string) {
  const utils = render(<FavoritesModule />);
  fireEvent.click(screen.getByText(title));
  return utils;
}

const katexCount = (el: HTMLElement) => el.querySelectorAll('.katex').length;

describe('收藏详情 — 知识卡片与搜索页渲染一致', () => {
  it('公式渲染为 KaTeX，不再露出 $...$ 源码', () => {
    const { container } = openItem(KNOWLEDGE_TOPIC);

    expect(katexCount(container)).toBeGreaterThan(0);
    // 关键断言：正文里不应再出现裸露的公式围符
    expect(container.textContent).not.toContain('$');
    // 非公式文本照常保留
    expect(container.textContent).toContain('合力');
  });

  it('概览（summary）在详情页完整呈现，且与标题同处一张卡 —— 此前收藏侧整段丢失', () => {
    const { container } = openItem(KNOWLEDGE_TOPIC);

    const h2 = container.querySelector('h2')!;
    // h2 → 标题行（flex）→ 标题卡；概览必须和标题在同一张卡里（与搜索页完全一致）
    const card = h2.parentElement!.parentElement!;
    expect(card.className).toContain('from-teal-50');
    expect(card.textContent).toContain('合力');
    expect(card.textContent).toContain('决定加速度');
    // 概览里的 $F=ma$ 走 KaTeX，不是裸露源码
    expect(katexCount(container)).toBeGreaterThan(0);
  });

  it('渲染真正的思维导图（含叶子节点的描述框），而不是标题标签列表', () => {
    const { container } = openItem(KNOWLEDGE_TOPIC);

    expect(container.querySelector('[data-testid="knowledge-mindmap"]')).not.toBeNull();
    // 分支节点与它的描述都要出现（旧实现只平铺了根节点标题）
    expect(container.textContent).toContain('公式形式');
    expect(container.textContent).toContain('F=ma');
  });

  it('概念配图、关键要点、易错提醒、知识脉络、试题一起还原（旧实现全部丢失）', () => {
    const { container } = openItem(KNOWLEDGE_TOPIC);

    expect(container.querySelector('img[src="https://example.com/newton.png"]')).not.toBeNull();
    expect(container.textContent).toContain('要点：同向性');
    expect(container.textContent).toContain('易错：质量不可变');
    expect(container.textContent).toContain('第一步：受力分析');
    // 试题的选项也要在（选项内容含公式，走 KaTeX）
    expect(container.textContent).toContain('F=mv');
  });

  it('回归：有 topic + mindMap 但没有 concepts 时，思维导图仍然渲染（旧实现整页近乎空白）', () => {
    const { container } = openItem(MINDMAP_ONLY_TOPIC);

    expect(container.textContent).toContain(MINDMAP_ONLY_TOPIC);
    expect(container.textContent).toContain('分支A');
    expect(container.querySelector('[data-testid="knowledge-mindmap"]')).not.toBeNull();
  });

  it('旧格式知识卡（KnowledgeCardData）走兜底分支，公式与要点同样渲染', () => {
    const { container } = openItem(LEGACY_TITLE);

    expect(container.textContent).toContain('旧格式定义');
    expect(container.textContent).toContain('旧格式要点');
    // `\frac{a}{b}` 既有围符内公式 `$x$`、也有裸 LaTeX，两者都必须渲染成 KaTeX
    expect(katexCount(container)).toBeGreaterThan(0);
    expect(container.textContent).not.toContain('$x$');
  });
});

describe('收藏详情 — 文档收藏渲染 Markdown 与公式', () => {
  it('Markdown 结构渲染成真实元素，公式渲染为 KaTeX', () => {
    const { container } = openItem(DOC_TITLE);

    expect(container.querySelector('h1')?.textContent).toBe(DOC_TITLE);
    expect(katexCount(container)).toBeGreaterThan(0);
    // 旧实现用 whitespace-pre-wrap 直接输出原文：`# 标题`、`$E=mc^2$` 会原样裸露
    expect(container.textContent).not.toContain('# 实验报告');
    expect(container.textContent).not.toContain('$E=mc^2$');
  });
});

describe('收藏列表 — 摘要预览是纯文本', () => {
  it('知识摘要剥离公式围符，不出现裸露的 $ 与 Markdown 标记', () => {
    render(<FavoritesModule />);

    const preview = screen.getByText('合力 F=ma 决定加速度');
    expect(preview.textContent).not.toContain('$');
  });

  it('文档摘要剥离标题标记与公式围符', () => {
    render(<FavoritesModule />);

    const preview = screen.getByText('实验报告 公式 E=mc^2 与 F=ma');
    expect(preview.textContent).not.toContain('#');
  });
});
