import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import type { ComponentType } from 'react';
import {
  buildRuns,
  collectRanges,
  sharedKeys,
  type TranslateSegmentPair,
} from '../alignment';
import type { SentenceResult as SentenceResultType } from '../../../types';

/**
 * 译文「逐段对照」回归 —— 配对靠 AI 填的 key，不靠数组下标、也不靠字符位置。
 *
 * 关键用例是 `Good morning → 早上好`：**两侧语序相反**（Good 对应译文末尾的「好」）。
 * 按下标配对会高亮错（这正是最初的 bug：Good 高亮到「早上」）；
 * 按字符位置做单调扫描也会错（先定位到「好」在 2、游标推到 3，再找「早上」就找不到了）。
 *
 * 另一条被锁住的原则：屏幕上的文字只能来自 `original` / `translation`。
 * 若按 segments 顺序拼译文，这个用例会渲染成「好早上」。
 */

const ORIGINAL = 'Good morning';
const TRANSLATION = '早上好';
const PAIRS: TranslateSegmentPair[] = [
  { key: 1, source: 'Good', target: '好' },
  { key: 2, source: 'morning', target: '早上' },
];

// ---------- 部分 1：纯函数 ----------

describe('alignment — 按 key 收集区间', () => {
  it('两侧语序相反时，每一对都能定位到（不能按位置单调扫描）', () => {
    const src = collectRanges(ORIGINAL, PAIRS, 'source');
    const tgt = collectRanges(TRANSLATION, PAIRS, 'target');

    expect(src).toEqual([
      { key: 1, start: 0, end: 4 }, // Good
      { key: 2, start: 5, end: 12 }, // morning
    ]);
    // 译文里「早上」(key2) 在「好」(key1) 前面 —— 区间按位置排序，不是按 key 排序
    expect(tgt).toEqual([
      { key: 2, start: 0, end: 2 }, // 早上
      { key: 1, start: 2, end: 3 }, // 好
    ]);
  });

  it('两侧共有的 key 才可高亮', () => {
    const src = collectRanges(ORIGINAL, PAIRS, 'source');
    const tgt = collectRanges(TRANSLATION, PAIRS, 'target');
    expect([...sharedKeys(src, tgt)].sort()).toEqual([1, 2]);

    // 只有原文侧能定位到 → 不算配对（高亮过去只会误导）
    const lopsided: TranslateSegmentPair[] = [
      { key: 1, source: 'Good', target: '好' },
      { key: 2, source: 'morning', target: '不存在的译文' },
    ];
    expect([...sharedKeys(collectRanges(ORIGINAL, lopsided, 'source'), collectRanges(TRANSLATION, lopsided, 'target'))])
      .toEqual([1]);
  });

  it('无键条目（缺 key / key=0 / 非整数）不参与配对，文字照常显示', () => {
    const pairs = [
      { source: 'Good', target: '好' }, // 缺 key
      { key: 0, source: ' ', target: '' },
      { key: 1.5, source: 'morn', target: '早' },
      { key: 2, source: 'ing', target: '上' },
    ] as TranslateSegmentPair[];

    const src = collectRanges(ORIGINAL, pairs, 'source');
    const tgt = collectRanges(TRANSLATION, pairs, 'target');
    expect(src.map((r) => r.key)).toEqual([2]);
    expect(tgt.map((r) => r.key)).toEqual([2]);

    // 无键文字仍然逐字保留
    const runs = buildRuns(ORIGINAL, src, sharedKeys(src, tgt));
    expect(runs.map((r) => r.text).join('')).toBe(ORIGINAL);
    expect(runs.filter((r) => r.key !== null)).toHaveLength(1);
  });

  it('不可达的片段直接跳过，不做模糊猜测', () => {
    const pairs: TranslateSegmentPair[] = [
      { key: 1, source: 'Good', target: '好' },
      { key: 2, source: '这句原文里根本没有', target: '早上' },
    ];
    expect(collectRanges(ORIGINAL, pairs, 'source').map((r) => r.key)).toEqual([1]);
  });

  it('重叠区间被丢弃，同一段文字不会渲染两遍', () => {
    // 两个不同的 key 指向同一处文字
    const pairs: TranslateSegmentPair[] = [
      { key: 1, source: 'morning', target: '早上' },
      { key: 2, source: 'orning', target: '早上好' },
    ];
    const src = collectRanges(ORIGINAL, pairs, 'source');
    const tgt = collectRanges(TRANSLATION, pairs, 'target');

    const srcRuns = buildRuns(ORIGINAL, src, sharedKeys(src, tgt));
    expect(srcRuns.map((r) => r.text).join('')).toBe(ORIGINAL);
    expect(srcRuns.filter((r) => r.key !== null)).toHaveLength(1);
  });

  it('不变量：run 拼回来永远逐字等于原串', () => {
    const messy: TranslateSegmentPair[] = [
      { key: 3, source: 'morning', target: '早上' },
      { key: 1, source: 'Good', target: '好' },
      { key: 9, source: '不存在', target: '也不存在' },
    ];
    const src = collectRanges(ORIGINAL, messy, 'source');
    const tgt = collectRanges(TRANSLATION, messy, 'target');
    const hi = sharedKeys(src, tgt);

    expect(buildRuns(ORIGINAL, src, hi).map((r) => r.text).join('')).toBe(ORIGINAL);
    expect(buildRuns(TRANSLATION, tgt, hi).map((r) => r.text).join('')).toBe(TRANSLATION);
  });
});

// ---------- 部分 2：组件渲染 ----------

let SentenceResult: ComponentType<{
  result: SentenceResultType;
  onLookup?: (term: string) => void;
  onSearchTopic?: (term: string) => void;
}>;

beforeAll(async () => {
  // jsdom 没有 Web Speech API，useSpeechSynthesis 的 effect 会直接抛
  Object.defineProperty(window, 'speechSynthesis', {
    configurable: true,
    value: { getVoices: () => [], speak: () => {}, cancel: () => {}, onvoiceschanged: undefined },
  });
  (window as unknown as Record<string, unknown>).SpeechSynthesisUtterance = class {
    constructor(public text: string) {}
  };

  const mod = await import('../SentenceResult');
  SentenceResult = mod.SentenceResult as typeof SentenceResult;
}, 60000);

afterEach(cleanup);

const baseResult = (over: Partial<SentenceResultType>): SentenceResultType =>
  ({
    original: ORIGINAL,
    translation: TRANSLATION,
    style: 'casual',
    sourceLang: 'en',
    targetLang: 'zh',
    ...over,
  }) as SentenceResultType;

const renderWith = (result: SentenceResultType) =>
  render(<SentenceResult result={result} />);

const box = (c: HTMLElement, id: string) => c.querySelector(`[data-testid="${id}"]`) as HTMLElement;
const keyed = (c: HTMLElement, id: string) =>
  [...box(c, id).querySelectorAll('[data-key]')].map((e) => [
    e.getAttribute('data-key'),
    e.textContent,
  ]);

describe('SentenceResult — key 配对高亮', () => {
  it('两侧语序相反（Good morning → 早上好）时，两对都能高亮', () => {
    const { container } = renderWith(baseResult({ segments: PAIRS }));

    expect(keyed(container, 'translate-source-text')).toEqual([
      ['1', 'Good'],
      ['2', 'morning'],
    ]);
    // 译文侧顺序相反：key2 在前、key1 在后 —— 但仍按各自的阅读顺序渲染
    expect(keyed(container, 'translate-target-text')).toEqual([
      ['2', '早上'],
      ['1', '好'],
    ]);
  });

  it('悬停原文的某个 key，只有同 key 的译文被高亮', () => {
    const { container } = renderWith(baseResult({ segments: PAIRS }));

    const goodSource = box(container, 'translate-source-text').querySelector('[data-key="1"]')!;
    fireEvent.mouseEnter(goodSource);

    const litKeys = (id: string) =>
      [...box(container, id).querySelectorAll('[data-key]')]
        .filter((e) => e.className.includes('bg-teal-100'))
        .map((e) => [e.getAttribute('data-key'), e.textContent]);

    // key1 = Good ↔ 好：译文侧高亮的必须是「好」，不是「早上」
    expect(litKeys('translate-source-text')).toEqual([['1', 'Good']]);
    expect(litKeys('translate-target-text')).toEqual([['1', '好']]);
  });

  it('显示文本逐字等于 original / translation（不按 segments 顺序拼接）', () => {
    const { container } = renderWith(baseResult({ segments: PAIRS }));

    expect(box(container, 'translate-source-text').textContent).toBe(ORIGINAL);
    // 若按 segments 顺序拼译文会得到「好早上」
    expect(box(container, 'translate-target-text').textContent).toBe(TRANSLATION);
  });

  it('对照项顺序被打乱也不影响显示文本', () => {
    const { container } = renderWith(
      baseResult({
        segments: [
          { key: 2, source: 'morning', target: '早上' },
          { key: 1, source: 'Good', target: '好' },
        ],
      })
    );

    expect(box(container, 'translate-source-text').textContent).toBe(ORIGINAL);
    expect(box(container, 'translate-target-text').textContent).toBe(TRANSLATION);
  });

  it('无键 / 旧数据（没有 key）退回纯文本，不出现空的对照区', () => {
    const { container } = renderWith(
      baseResult({
        segments: [
          { source: 'Good', target: '好' },
          { source: ' morning', target: '早上' },
        ] as SentenceResultType['segments'],
      })
    );

    expect(box(container, 'translate-target-text').textContent).toBe(TRANSLATION);
    expect(box(container, 'translate-target-text').querySelectorAll('[data-key]')).toHaveLength(0);
  });

  it('完全没有 segments 时同理', () => {
    const { container } = renderWith(baseResult({ segments: undefined }));

    expect(box(container, 'translate-source-text').textContent).toBe(ORIGINAL);
    expect(box(container, 'translate-target-text').textContent).toBe(TRANSLATION);
  });
});
