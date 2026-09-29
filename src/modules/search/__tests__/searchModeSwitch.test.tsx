import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { HistoryProvider } from '../../../hooks/HistoryContext';
import { SearchModule } from '../index';
import { getCurrentStrings } from '../../../i18n/strings';
import type { SearchGenerateResponse, HistoryItem } from '../../../types';

/**
 * 搜索 ↔ 问答 模式切换的内容归属契约。
 *
 * "浏览中"的语义 = **这份内容正显示在屏幕上**。因此离开搜索视图时内容必须一起消失，
 * 否则切回搜索旧结果原样复活、历史侧栏又指着它是"浏览中"，这个状态永远退不出去
 * （既看不到时间，也不会登记 lastViewedAt）。词典/翻译模块的 handleModeChange
 * 一直是"切模式即清结果"，本用例把搜索模块钉在同一口径上。
 *
 * 回归背景：搜索模块只做过"切回搜索时清问答消息"，反向从不清搜索内容 ——
 * 于是 搜索→问答→搜索 之后旧结果还在、条目仍是"浏览中"。
 */

const s = getCurrentStrings();

const ITEM_PREFIX = 'ai-office-assistant-history:';
const TOPIC = '加速度';
const SUMMARY = `${TOPIC}是描述速度变化快慢的物理量。`;

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

const topData = (): SearchGenerateResponse => ({
  topic: TOPIC,
  summary: SUMMARY,
  mindMap: [{ id: 'root', title: TOPIC, level: 'root', children: [] }],
  concepts: [
    {
      type: 'definition',
      title: TOPIC,
      content: { elementary: '初等说明', advanced: '高等说明' },
      example: '汽车每小时行驶 100 公里。',
    },
  ],
  examples: [],
  relatedResults: [],
  knowledgeContext: { prerequisites: [], relatedTopics: [], learningPath: [] },
  examQuestions: [],
  interestingFacts: [],
});

/** 预置一条"已生成过"的搜索历史：命中后状态机直接恢复，无需真的跑流式生成 */
const seedSearchRecord = (lastViewedAt: number) => {
  const item: HistoryItem = {
    id: 'search-1',
    type: 'search',
    query: TOPIC,
    timestamp: lastViewedAt,
    lastViewedAt,
    data: {
      id: 'search-1',
      result: { type: 'concept', title: TOPIC, definition: '', points: [], example: '' },
      generatedData: topData(),
      messages: [],
    },
  };
  window.localStorage.setItem(ITEM_PREFIX + item.id, JSON.stringify(item));
};

const storedRecord = (id: string): HistoryItem | null => {
  const raw = window.localStorage.getItem(ITEM_PREFIX + id);
  return raw ? (JSON.parse(raw) as HistoryItem) : null;
};

beforeEach(() => {
  window.localStorage.clear();
  vi.resetAllMocks();
  mockSearchApi.validate.mockResolvedValue({ success: true, data: { valid: true, suggestions: [] } });
  mockSearchApi.analyze.mockResolvedValue({
    success: true,
    data: { isSpecific: true, isKnowledgePoint: true, canonicalTopic: TOPIC, topic: TOPIC },
  });
});

afterEach(cleanup);

const renderModule = () => render(
  <HistoryProvider>
    <SearchModule />
  </HistoryProvider>
);

/**
 * 模式按钮用回车触发搜索，避免与搜索框右侧的"搜索"提交按钮同文案冲突；
 * 模式按钮在 DOM 里排在输入框之前，取第一个即模式选择器。
 */
const modeButton = (label: string) => screen.getAllByText(label)[0];

const runSearch = async (query: string) => {
  const input = screen.getByRole('textbox');
  fireEvent.change(input, { target: { value: query } });
  await act(async () => {
    fireEvent.keyDown(input, { key: 'Enter' });
  });
};

describe('搜索/问答模式切换 — 离开视图即结束"浏览中"', () => {
  it('切到问答：搜索内容消失、登记最后浏览时刻；切回搜索不再显示"浏览中"', async () => {
    seedSearchRecord(1);
    renderModule();
    await runSearch(TOPIC);

    // 内容显示中，侧栏把它标成"浏览中"
    expect(screen.getByText(SUMMARY)).toBeTruthy();
    expect(screen.getByText(s.history.browsing)).toBeTruthy();

    // 切到问答 = 离开搜索视图
    fireEvent.click(modeButton(s.search.modeQA));

    // 离开的那一刻登记最后浏览时刻（种子值是 1，必须被刷新）
    expect(storedRecord('search-1')?.lastViewedAt).toBeGreaterThan(1);
    // 问答模式下屏幕上没有任何搜索内容 → 不该再有人是"浏览中"
    expect(screen.queryByText(s.history.browsing)).toBeNull();

    // 切回搜索：内容必须已经消失（旧实现这里原样复活并重新变回"浏览中"）
    fireEvent.click(modeButton(s.search.modeSearch));
    expect(screen.queryByText(SUMMARY)).toBeNull();
    expect(screen.queryByText(s.history.browsing)).toBeNull();
    // 记录本身还在（内容已落进历史，点历史条目可原样恢复）
    expect(storedRecord('search-1')).not.toBeNull();
  });

  it('内容从未显示过时切模式：不产生任何登记写入', () => {
    seedSearchRecord(1);
    renderModule();

    // 没有搜索、没有内容，直接切到问答再切回来
    fireEvent.click(modeButton(s.search.modeQA));
    expect(storedRecord('search-1')?.lastViewedAt).toBe(1);

    fireEvent.click(modeButton(s.search.modeSearch));
    expect(storedRecord('search-1')?.lastViewedAt).toBe(1);
  });
});
