import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import { HistoryProvider, useHistory, useViewingHistory } from '../HistoryContext';
import type { HistoryItem } from '../../types';

/**
 * 多标签页存储契约。
 *
 * 这些不变量都是"内存副本 ≠ 磁盘真相"时的行为：storage 事件是异步的，
 * 后台标签还可能被节流，所以任何一次写入都不能相信内存里的旧快照。
 */

const ITEM_PREFIX = 'ai-office-assistant-history:';
const LEGACY_KEY = 'ai-office-assistant-history';
const SCHEMA_KEY = 'ai-office-assistant-history.schema';
const itemKey = (id: string) => ITEM_PREFIX + id;

const seed = (items: HistoryItem[]) => {
  for (const item of items) window.localStorage.setItem(itemKey(item.id), JSON.stringify(item));
};

const stored = (id: string): HistoryItem | null => {
  const raw = window.localStorage.getItem(itemKey(id));
  return raw ? (JSON.parse(raw) as HistoryItem) : null;
};

const item = (id: string, query: string, lastViewedAt: number): HistoryItem => ({
  id,
  type: 'search',
  query,
  timestamp: lastViewedAt,
  lastViewedAt,
});

/** 把 Provider 的 context 暴露给用例，方便直接调 addHistory / touchHistory */
const renderHarness = () => {
  const api: { current: ReturnType<typeof useHistory> | null } = { current: null };
  const Harness = () => {
    api.current = useHistory();
    return null;
  };
  render(
    <HistoryProvider>
      <Harness />
    </HistoryProvider>
  );
  return api as { current: ReturnType<typeof useHistory> };
};

/** 声明"正在浏览 <query>"，用来驱动 lastViewedAt 登记 */
const Viewer = ({ query }: { query: string }) => {
  useViewingHistory('search', query);
  return null;
};

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(cleanup);

describe('多标签页存储 — 写入以磁盘为准', () => {
  it('关标签页（pagehide）登记时，磁盘上更新的 lastViewedAt 不会被本页写旧', () => {
    const future = Date.now() + 60_000;
    seed([item('search-1', '加速度', future)]);
    // 模拟本页时钟/副本落后于另一个标签页刚写下的时间
    const spy = vi.spyOn(Date, 'now').mockReturnValue(1000);

    render(
      <HistoryProvider>
        <Viewer query="加速度" />
      </HistoryProvider>
    );
    act(() => {
      window.dispatchEvent(new Event('pagehide'));
    });
    spy.mockRestore();

    expect(stored('search-1')?.lastViewedAt).toBe(future);
  });

  it('另一标签页已为同一主题建了记录（本页还没收到 storage 事件）→ 复用它的 id，不新建重复条目', () => {
    const api = renderHarness();
    // 本页挂载之后，另一个标签页才写下这条（storage 事件尚未投递到本页）
    window.localStorage.setItem(itemKey('tabA-1'), JSON.stringify(item('tabA-1', '加速度', 1)));

    act(() => {
      api.current.addHistory('加速度', 'search');
    });

    // 只数"记录键"（`…history:schema` 是架构标记，不是记录）
    const recordIds = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (!key || !key.startsWith(ITEM_PREFIX)) continue;
      const id = key.slice(ITEM_PREFIX.length);
      if (id !== 'schema') recordIds.push(id);
    }
    expect(recordIds).toEqual(['tabA-1']);
    expect(stored('tabA-1')!.lastViewedAt).toBeGreaterThan(1);
  });

  it('超出上限裁掉的是磁盘上真正最旧的记录，不是本页内存里以为最旧的', () => {
    // 101 条：内存里 r0 最旧；随后别的标签页把 r0 刷成最新（本页没收到事件）
    seed(Array.from({ length: 101 }, (_, i) => item(`r${i}`, `主题${i}`, 1000 + i)));
    const api = renderHarness();
    window.localStorage.setItem(itemKey('r0'), JSON.stringify(item('r0', '主题0', 1_000_000_000)));

    act(() => {
      api.current.addHistory('触发裁剪', 'search');
    });

    // 按本页内存排序，r0 会被当"最旧"删掉 → 真数据丢失
    expect(stored('r0')).not.toBeNull();
    // 磁盘真相里最旧的两条（r1 / r2）才是被裁的对象
    expect(stored('r1')).toBeNull();
    expect(stored('r2')).toBeNull();
  });

  it('迁移只做一次：标记写好后，旧整表键再出现也不会被吸收（删掉的条目不复活）', () => {
    seed([item('search-1', '加速度', 1)]);
    const first = renderHarness();
    act(() => {
      first.current.removeHistory('search-1');
    });
    expect(stored('search-1')).toBeNull();
    expect(window.localStorage.getItem(SCHEMA_KEY)).not.toBeNull();
    cleanup();

    // 跑旧代码的标签页往旧整表键里写回快照
    window.localStorage.setItem(LEGACY_KEY, JSON.stringify([item('search-1', '加速度', 1)]));

    const second = renderHarness();
    expect(second.current.history.find((h) => h.id === 'search-1')).toBeUndefined();
    expect(stored('search-1')).toBeNull();
  });

  it('首次迁移：旧整表数据被摊成单条键，旧键清掉', () => {
    window.localStorage.setItem(LEGACY_KEY, JSON.stringify([item('old-1', '量子力学', 1)]));

    const api = renderHarness();

    expect(stored('old-1')?.query).toBe('量子力学');
    expect(window.localStorage.getItem(LEGACY_KEY)).toBeNull();
    expect(api.current.history).toHaveLength(1);
  });
});
