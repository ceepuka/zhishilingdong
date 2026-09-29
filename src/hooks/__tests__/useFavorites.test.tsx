import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { useFavorites } from '../useFavorites';
import type { GeneratedKnowledge } from '../../types';

/**
 * 收藏本地存储降级回归。
 *
 * 真实边界：`localStorage` 只有 ~5MB，而收藏的知识卡里 `concept.imageData`
 * 是 base64 data URL（单个可达数 MB）。旧实现的 `saveStorage` 捕获异常后只
 * `console.error` —— 内存里 `sharedFavorites` 已经改了，所以界面显示"已收藏"，
 * **刷新后收藏消失**，用户完全无从判断。
 *
 * 现在的契约：写不下 → 先剥离图片数据再试（文字内容必须保住）→ 再不行才报失败，
 * 并且把结果通过 `storageWarning` 交给 UI 显示。
 */

const STORAGE_KEY = 'ai-office-assistant-favorites';
let seq = 0;

function knowledgeWithImage(topic: string): GeneratedKnowledge {
  return {
    topic,
    mindMap: [],
    concepts: [
      {
        type: 'definition',
        title: '配图概念',
        content: { elementary: '初等解释', advanced: '高等解释' },
        imageData: 'data:image/png;base64,AAABBBCCC',
      },
    ],
    examples: [],
    relatedResults: [],
    knowledgeContext: { prerequisites: [], relatedTopics: [], learningPath: [] },
    examQuestions: [],
    interestingFacts: [],
  };
}

function Probe() {
  const { favorites, addFavorite, storageWarning } = useFavorites();
  return (
    <div>
      <span data-testid="count">{favorites.length}</span>
      <span data-testid="warn">{storageWarning ?? 'none'}</span>
      <button
        onClick={() => addFavorite(knowledgeWithImage(`带图-${++seq}`), 'knowledge')}
      >
        add-with-image
      </button>
      <button onClick={() => addFavorite(knowledgeWithImage(`无图-${++seq}`), 'knowledge')}>
        add-plain
      </button>
    </div>
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  cleanup();
});

describe('useFavorites — localStorage 写入降级', () => {
  it('正常写入：无警告，且完整内容（含 base64 图片）落盘', () => {
    render(<Probe />);
    fireEvent.click(screen.getByText('add-plain'));

    expect(screen.getByTestId('warn').textContent).toBe('none');
    expect(window.localStorage.getItem(STORAGE_KEY)).toContain('imageData');
  });

  it('超配额时降级保存：剥离图片数据但保住文字，并给出 slimmed 警告', () => {
    // 模拟"带 base64 就写不下"（其余情况走真实实现）
    const original = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(((
      key: string,
      value: string
    ) => {
      if (String(value).includes('imageData')) {
        throw new DOMException('QuotaExceededError', 'QuotaExceededError');
      }
      return original.call(window.localStorage, key, value);
    }) as Storage['setItem']);

    render(<Probe />);
    fireEvent.click(screen.getByText('add-with-image'));

    expect(screen.getByTestId('warn').textContent).toBe('slimmed');

    const stored = window.localStorage.getItem(STORAGE_KEY) ?? '';
    // 图片数据被剥离，避免"整条收藏都存不进去"
    expect(stored).not.toContain('imageData');
    expect(stored).not.toContain('base64');
    // 但文字内容必须完整保留
    expect(stored).toContain('初等解释');
    expect(stored).toContain('高等解释');
  });

  it('彻底写不进时给出 failed 警告（不再静默失败）', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError', 'QuotaExceededError');
    });

    render(<Probe />);
    fireEvent.click(screen.getByText('add-plain'));

    expect(screen.getByTestId('warn').textContent).toBe('failed');
  });
});
