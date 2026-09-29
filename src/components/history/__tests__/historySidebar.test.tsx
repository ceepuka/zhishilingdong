import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { HistorySidebar } from '../HistorySidebar';
import { HistoryProvider, useHistory } from '../../../hooks/HistoryContext';
import { getCurrentStrings } from '../../../i18n/strings';
import { fmt } from '../../../hooks/useStrings';
import type { HistoryItem } from '../../../types';

/** 旧版整表键：现仅用于"吸收旧数据"用例 */
const LEGACY_KEY = 'ai-office-assistant-history';
/** 新布局：一条记录一个键 */
const ITEM_PREFIX = 'ai-office-assistant-history:';

const seedStorage = (items: HistoryItem[]) => {
  for (const item of items) {
    window.localStorage.setItem(ITEM_PREFIX + item.id, JSON.stringify(item));
  }
};

const storedItems = (): HistoryItem[] => {
  const out: HistoryItem[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (!key || !key.startsWith(ITEM_PREFIX)) continue;
    const raw = window.localStorage.getItem(key);
    if (raw) out.push(JSON.parse(raw) as HistoryItem);
  }
  return out;
};

afterEach(cleanup);
beforeEach(() => {
  window.localStorage.clear();
});

/**
 * 历史记录"最后浏览时刻"的**显示契约**（侧栏只负责呈现）。
 *
 * 不变量：
 * 1. 显示 = now - lastViewedAt（两个时刻相减，时钟每秒走表）；
 * 2. 排序也以 lastViewedAt 为唯一基准；
 * 3. 旧数据（无 lastViewedAt）在 Provider 加载时一次性转换为 lastViewedAt = timestamp。
 *
 * 注意：登记（touch）不在这里 —— 侧栏已不是"浏览中"状态的所有者，
 * 登记契约在 `src/hooks/__tests__/historyViewing.test.tsx`。
 */
describe('HistorySidebar — 显示与排序（最后浏览时刻模型）', () => {
  const s = getCurrentStrings();

  const makeItem = (overrides: Partial<HistoryItem>): HistoryItem => ({
    id: 'search-1',
    type: 'search',
    query: '量子力学',
    timestamp: Date.now(),
    lastViewedAt: Date.now(),
    ...overrides,
  });

  /** 与真实组合一致：Provider 持有 history，侧栏从中取条目 */
  const Harness = ({ currentViewing }: { currentViewing: string | null }) => {
    const { getHistoryByType } = useHistory();
    const items = getHistoryByType('search', currentViewing || undefined);
    return (
      <HistorySidebar
        items={items}
        config={{ title: '测试', icon: <span />, color: 'teal' }}
        currentViewing={currentViewing}
        onSelect={() => {}}
        onRemove={() => {}}
        onClear={() => {}}
        onClose={() => {}}
      />
    );
  };

  const renderSidebar = (seed: HistoryItem[], currentViewing: string | null) => {
    seedStorage(seed);
    return render(
      <HistoryProvider>
        <Harness currentViewing={currentViewing} />
      </HistoryProvider>
    );
  };

  it('刚离开浏览（lastViewedAt 在 1 分钟内）→ 显示"刚刚"，不是"x分钟前"', () => {
    const item = makeItem({
      timestamp: Date.now() - 10 * 60000, // 创建于 10 分钟前
      lastViewedAt: Date.now() - 30_000,  // 30 秒前刚停止浏览
    });
    const { container } = renderSidebar([item], null);
    expect(container.textContent).toContain(s.common.justNow);
    expect(container.textContent).not.toContain(fmt(s.common.minutesAgo, { n: 10 }));
  });

  it('离开浏览 5 分钟 → 显示"5分钟前"', () => {
    const item = makeItem({
      timestamp: Date.now() - 60 * 60000,
      lastViewedAt: Date.now() - 5 * 60000,
    });
    const { container } = renderSidebar([item], null);
    expect(container.textContent).toContain(fmt(s.common.minutesAgo, { n: 5 }));
    expect(container.textContent).not.toContain(s.common.justNow);
  });

  it('正在浏览的条目显示"浏览中"徽标（不显示相对时间）', () => {
    const item = makeItem({ timestamp: Date.now() - 60 * 60000, lastViewedAt: Date.now() - 60 * 60000 });
    const { container } = renderSidebar([item], item.query);
    expect(container.textContent).toContain(s.history.browsing);
    expect(container.textContent).not.toContain(fmt(s.common.minutesAgo, { n: 60 }));
  });

  it('旧数据（整表键、无 lastViewedAt）→ 加载时摊成单条键并迁移 lastViewedAt = timestamp', () => {
    const created = Date.now() - 8 * 60000;
    const legacy = { ...makeItem({ timestamp: created }) };
    delete (legacy as Partial<HistoryItem>).lastViewedAt; // 模拟旧数据
    window.localStorage.setItem(LEGACY_KEY, JSON.stringify([legacy]));

    const { container } = renderSidebar([], null);

    // 显示按迁移后的 lastViewedAt（= 创建时刻 8 分钟前）
    expect(container.textContent).toContain(fmt(s.common.minutesAgo, { n: 8 }));

    // 已持久化为新数据格式（单条键），旧整表键已删除（否则删掉的条目会被旧副本反复复活）
    const migrated = storedItems().find((h) => h.id === legacy.id);
    expect(migrated?.lastViewedAt).toBe(created);
    expect(window.localStorage.getItem(LEGACY_KEY)).toBeNull();
  });

  it('排序以 lastViewedAt 为唯一基准：创建更晚但浏览更早的条目排在后面', () => {
    const viewedLater = makeItem({
      id: 'search-a',
      query: '条目A',
      timestamp: Date.now() - 60 * 60000,   // 更早创建
      lastViewedAt: Date.now() - 1 * 60000, // 最近浏览
    });
    const viewedEarlier = makeItem({
      id: 'search-b',
      query: '条目B',
      timestamp: Date.now() - 1 * 60000,      // 更晚创建
      lastViewedAt: Date.now() - 30 * 60000,  // 更早浏览
    });

    const { container } = renderSidebar([viewedEarlier, viewedLater], null);
    const text = container.textContent || '';
    expect(text.indexOf('条目A')).toBeLessThan(text.indexOf('条目B'));
  });
});
