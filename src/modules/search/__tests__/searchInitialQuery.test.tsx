import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { HistoryProvider } from '../../../hooks/HistoryContext';
import { SearchModule } from '../index';
import type { SearchGenerateResponse, HistoryItem } from '../../../types';

/**
 * 跨模块跳转入口：翻译模式的「关联术语」要能带着词跳到知识搜索并**直接发起搜索**。
 *
 * 为什么是"挂载后消费"而不是"切标签页时调 ref"：切过去的那一刻 SearchModule 才挂载，
 * ref 还是 null，谁也调不到它。所以词只能通过 props 交给它自己消费。
 * 关键不变量：**同一个词只消费一次** —— 否则切走再切回来会莫名其妙又搜一遍。
 */

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
  concepts: [],
  examples: [],
  relatedResults: [],
  knowledgeContext: { prerequisites: [], relatedTopics: [], learningPath: [] },
  examQuestions: [],
  interestingFacts: [],
});

/** 预置一条已生成过的搜索历史：命中后状态机直接恢复，不必真跑流式生成 */
const seedSearchRecord = () => {
  const item: HistoryItem = {
    id: 'search-1',
    type: 'search',
    query: TOPIC,
    timestamp: Date.now(),
    lastViewedAt: Date.now(),
    data: {
      id: 'search-1',
      result: { type: 'concept', title: TOPIC, definition: '', points: [], example: '' },
      generatedData: topData(),
      messages: [],
    },
  };
  window.localStorage.setItem(ITEM_PREFIX + item.id, JSON.stringify(item));
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

describe('SearchModule — 消费外部带进来的搜索词', () => {
  it('挂载后自动发起搜索并展示结果，同时通知外层已消费', async () => {
    seedSearchRecord();
    const onConsumed = vi.fn();

    render(
      <HistoryProvider>
        <SearchModule initialQuery={TOPIC} onInitialQueryConsumed={onConsumed} />
      </HistoryProvider>,
    );

    expect(await screen.findByText(SUMMARY)).toBeTruthy();
    expect(onConsumed).toHaveBeenCalledTimes(1);
  });

  it('没有带词时不发起任何搜索', () => {
    seedSearchRecord();
    const onConsumed = vi.fn();

    const { container } = render(
      <HistoryProvider>
        <SearchModule onInitialQueryConsumed={onConsumed} />
      </HistoryProvider>,
    );

    expect(onConsumed).not.toHaveBeenCalled();
    expect(container.textContent).not.toContain(SUMMARY);
  });
});
