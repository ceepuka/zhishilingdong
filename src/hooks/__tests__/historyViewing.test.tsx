import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import { HistoryProvider, useHistory, useViewingHistory, VIEWING_HEARTBEAT_MS } from '../HistoryContext';
import type { HistoryItem } from '../../types';

const LEGACY_KEY = 'ai-office-assistant-history';
const ITEM_PREFIX = 'ai-office-assistant-history:';
const itemKey = (id: string) => ITEM_PREFIX + id;

/** jsdom 的 visibilityState 是只读的，用 defineProperty 影子覆盖 */
const setVisibilityState = (state: 'visible' | 'hidden') => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
};

const makeItem = (overrides: Partial<HistoryItem>): HistoryItem => ({
  id: 'search-a',
  type: 'search',
  query: '量子力学',
  timestamp: Date.now(),
  lastViewedAt: Date.now(),
  ...overrides,
});

const seedStorage = (items: HistoryItem[]) => {
  for (const item of items) window.localStorage.setItem(itemKey(item.id), JSON.stringify(item));
};

const storedItem = (id: string): HistoryItem | null => {
  const raw = window.localStorage.getItem(itemKey(id));
  return raw ? (JSON.parse(raw) as HistoryItem) : null;
};

/** 模拟"另一个标签页"写盘：直接改 localStorage，再派发 storage 事件（真实浏览器行为） */
const writeFromOtherTab = (item: HistoryItem) => {
  window.localStorage.setItem(itemKey(item.id), JSON.stringify(item));
  window.dispatchEvent(new StorageEvent('storage', { key: itemKey(item.id), newValue: JSON.stringify(item), storageArea: window.localStorage }));
};

const removeFromOtherTab = (id: string) => {
  window.localStorage.removeItem(itemKey(id));
  window.dispatchEvent(new StorageEvent('storage', { key: itemKey(id), newValue: null, storageArea: window.localStorage }));
};

afterEach(() => {
  cleanup();
  setVisibilityState('visible');
});
beforeEach(() => {
  window.localStorage.clear();
});

/**
 * "正在浏览"状态与跨标签页存储的契约。
 *
 * 背景（用户实测）：关闭标签页后"浏览中"记录的 lastViewedAt 不刷新；多标签页同时打开时
 * "整表覆盖写、后写者赢"。根因是两件事混在一起：
 *   1. 登记寄生在侧栏上 —— 但侧栏不是"浏览中"状态的所有者（收起时仍挂载，
 *      关标签页/刷新时更不会被卸载），挂在它上面必然漏掉"退出应用页面"这一整类离开；
 *   2. 存储是"整表一个键" —— 每次写入重写全部记录，后写的标签页会用它内存里的旧快照
 *      盖掉另一个标签页刚写的东西。
 *
 * 修完后的不变量：
 *   A. 模块只声明"在看哪一条"；登记时机全部由常驻的 Provider 负责 ——
 *      进入即写兜底基线、浏览期间心跳、内容消失（声明变化/组件卸载）与页面级离开
 *      （pagehide / visibilitychange / beforeunload）都登记，且落盘是同步的
 *      （退出页面时 React 的 effect 不会跑）；
 *   B. 一条记录一个键 —— 写入单条原子，删除是真删除，外部改动通过 storage 事件收敛。
 *
 * 为什么 A 需要"进入基线 + 心跳"这两条看似多余的路径（用户实测第二轮）：
 * 页面级离开那一刻的落盘**不可靠** —— 关整个浏览器时 beforeunload 不触发，只剩
 * pagehide；处理函数确实执行并写了 localStorage，但进程紧接着被杀、写入没落盘。
 * 所以不变式只能是"磁盘值落后真实浏览时刻不超过一个心跳周期"。
 */
describe('HistoryProvider — 浏览中状态 + 多标签页存储', () => {
  const Harness = ({ type, query }: { type: HistoryItem['type']; query: string | null }) => {
    useViewingHistory(type, query);
    const { history } = useHistory();
    return <div data-testid="list">{history.map((h) => h.query).join('|')}</div>;
  };

  const renderWithViewing = (seed: HistoryItem[], type: HistoryItem['type'], query: string | null) => {
    seedStorage(seed);
    return render(
      <HistoryProvider>
        <Harness type={type} query={query} />
      </HistoryProvider>
    );
  };

  // ---------------- A. 登记时机 ----------------

  it('进入即登记兜底基线；内容消失（声明变为 null）→ 再登记一次更晚的时刻', () => {
    let clock = Date.now() - 30 * 60000;
    const nowSpy = vi.spyOn(Date, 'now').mockImplementation(() => clock);
    try {
      const item = makeItem({ id: 'search-a', query: '量子力学', timestamp: clock, lastViewedAt: clock });
      const { rerender } = renderWithViewing([item], 'search', item.query);

      // 进入即写一次：进程随后被直接杀掉也不会停在旧值上
      expect(storedItem(item.id)?.lastViewedAt).toBe(clock);

      clock += 5 * 60000; // 看了 5 分钟
      rerender(
        <HistoryProvider>
          <Harness type="search" query={null} />
        </HistoryProvider>
      );

      // 离开的那一刻再登记，取更晚的时刻
      expect(storedItem(item.id)?.lastViewedAt).toBe(clock);
    } finally {
      nowSpy.mockRestore();
    }
  });

  /**
   * 回归锁：**只靠"离开那一刻"写盘是不够的**（用户实测：关掉整个浏览器后时间不刷新）。
   *
   * 关整个浏览器时 beforeunload 不触发，只剩 pagehide；处理函数确实跑了、也确实调了
   * localStorage.setItem，但渲染进程紧接着被杀，异步提交没落盘 —— 重开后读到的还是旧值。
   * 所以磁盘值落后真实浏览时刻的上限，必须由心跳兜住。
   */
  it('浏览期间心跳 → 磁盘值落后不超过一个周期', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
      const now = Date.now();
      const item = makeItem({ id: 'search-a', query: '量子力学', timestamp: now, lastViewedAt: now });
      renderWithViewing([item], 'search', item.query);

      const onEnter = storedItem(item.id)!.lastViewedAt;

      act(() => {
        vi.advanceTimersByTime(VIEWING_HEARTBEAT_MS);
      });

      const afterBeat = storedItem(item.id)!.lastViewedAt;
      expect(afterBeat).toBeGreaterThan(onEnter);
      expect(Date.now() - afterBeat).toBeLessThanOrEqual(VIEWING_HEARTBEAT_MS);
    } finally {
      vi.useRealTimers();
    }
  });

  it('页面在后台（hidden）时不心跳', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
      const now = Date.now();
      const item = makeItem({ id: 'search-a', query: '量子力学', timestamp: now, lastViewedAt: now });

      // 只影子覆盖 visibilityState，不派发事件 —— 隔离"心跳"这一条路径
      setVisibilityState('hidden');
      renderWithViewing([item], 'search', item.query);
      const onEnter = storedItem(item.id)!.lastViewedAt;

      act(() => {
        vi.advanceTimersByTime(VIEWING_HEARTBEAT_MS * 3);
      });

      expect(storedItem(item.id)!.lastViewedAt).toBe(onEnter);
    } finally {
      vi.useRealTimers();
    }
  });

  it('声明组件卸载（切换功能页）→ 也登记', () => {
    const stale = Date.now() - 30 * 60000;
    const item = makeItem({ lastViewedAt: stale });
    seedStorage([item]);
    // Provider 常驻、只卸载声明方（真实应用里就是"切功能页"：模块卸载、Provider 不动）
    const Wrapper = ({ show }: { show: boolean }) => (
      <HistoryProvider>{show ? <Harness type="search" query={item.query} /> : null}</HistoryProvider>
    );
    const { rerender } = render(<Wrapper show />);

    rerender(<Wrapper show={false} />);

    expect(storedItem(item.id)!.lastViewedAt).toBeGreaterThan(Date.now() - 5000);
  });

  it('关闭/刷新页面（pagehide）→ 登记正在浏览条目', () => {
    const stale = Date.now() - 30 * 60000;
    const item = makeItem({ lastViewedAt: stale });
    renderWithViewing([item], 'search', item.query);

    act(() => {
      window.dispatchEvent(new Event('pagehide'));
    });

    expect(storedItem(item.id)!.lastViewedAt).toBeGreaterThan(Date.now() - 5000);
  });

  it('切到其他 Tab / 切后台（visibilitychange → hidden）→ 登记', () => {
    const stale = Date.now() - 30 * 60000;
    const item = makeItem({ lastViewedAt: stale });
    renderWithViewing([item], 'search', item.query);

    act(() => {
      setVisibilityState('hidden');
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(storedItem(item.id)!.lastViewedAt).toBeGreaterThan(Date.now() - 5000);
  });

  it('关闭/刷新（beforeunload）→ 登记（页面级离开的最后一道口子）', () => {
    const stale = Date.now() - 30 * 60000;
    const item = makeItem({ lastViewedAt: stale });
    renderWithViewing([item], 'search', item.query);

    act(() => {
      window.dispatchEvent(new Event('beforeunload'));
    });

    expect(storedItem(item.id)!.lastViewedAt).toBeGreaterThan(Date.now() - 5000);
  });

  /**
   * **同步落盘**契约：真实 pagehide/beforeunload 之后 React 的提交与 effect 都不会再执行，
   * 所以必须在事件回调里就直接写 localStorage。
   *
   * 刻意不用 act 包裹 —— dispatchEvent 返回后立刻读，只有"同步写"才读得到新值。
   * act 警告在此处是预期噪声，临时静音。
   */
  it('页面级离开 → localStorage 在事件回调内同步更新（不等 React 提交）', () => {
    let clock = Date.now();
    const nowSpy = vi.spyOn(Date, 'now').mockImplementation(() => clock);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const item = makeItem({ id: 'search-a', query: '量子力学', timestamp: clock, lastViewedAt: clock });
      renderWithViewing([item], 'search', item.query);
      expect(storedItem(item.id)!.lastViewedAt).toBe(clock); // 进入时那条基线

      clock += 60000; // 时间前进 1 分钟，React 不会为它提交任何东西

      window.dispatchEvent(new Event('pagehide'));

      // 只有"在回调里同步写"才读得到推进后的时刻
      expect(storedItem(item.id)!.lastViewedAt).toBe(clock);
    } finally {
      consoleError.mockRestore();
      nowSpy.mockRestore();
    }
  });

  it('没有声明"浏览中"→ 页面级离开不产生任何写入', () => {
    const stale = Date.now() - 30 * 60000;
    const item = makeItem({ lastViewedAt: stale });
    renderWithViewing([item], 'search', null);

    act(() => {
      window.dispatchEvent(new Event('pagehide'));
      window.dispatchEvent(new Event('beforeunload'));
      setVisibilityState('hidden');
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(storedItem(item.id)?.lastViewedAt).toBe(stale);
  });

  it('声明了但记录不存在（条目已被删）→ 页面级离开不报错、不误写', () => {
    const other = makeItem({ id: 'search-other', query: '另一条', lastViewedAt: Date.now() - 30 * 60000 });
    renderWithViewing([other], 'search', '不存在的主题');

    expect(() =>
      act(() => {
        window.dispatchEvent(new Event('pagehide'));
      })
    ).not.toThrow();

    expect(storedItem(other.id)?.lastViewedAt).toBe(other.lastViewedAt);
  });

  /**
   * 回归锁：关闭标签页这条路径**不能只信 React 状态**。
   *
   * `viewingId` 是从 state 派生的 memo，页面卸载时可能还没解析好（条目刚建、本标签页的内存副本
   * 还没收敛 —— 比如记录是另一个标签页写的、storage 事件被节流没投递到本页）。此时如果直接放弃，
   * 就表现为"正在浏览内容时关掉标签页，最后浏览时间仍停在旧值"。
   * 所以解析不出来要按声明的 `(type, query)` 回磁盘兜底。
   */
  it('页面级离开 → 记录只在磁盘上、内存未收敛时，回磁盘兜底登记', () => {
    const stale = Date.now() - 30 * 60000;
    const ghost = makeItem({ id: 'search-ghost', query: '外部写的主题', lastViewedAt: stale });

    // 挂载时还没声明；随后另一个标签页写下这条（storage 事件未投递到本页）
    const { rerender } = render(
      <HistoryProvider>
        <Harness type="search" query={null} />
      </HistoryProvider>
    );
    window.localStorage.setItem(itemKey(ghost.id), JSON.stringify(ghost));

    // 本页开始浏览它 —— 内存里没有这条，viewingId 解析不出来
    rerender(
      <HistoryProvider>
        <Harness type="search" query={ghost.query} />
      </HistoryProvider>
    );

    act(() => {
      window.dispatchEvent(new Event('pagehide'));
    });

    expect(storedItem(ghost.id)!.lastViewedAt).toBeGreaterThan(Date.now() - 5000);
  });

  // ---------------- B. 多标签页（存储层） ----------------

  /**
   * 回归锁：以前整表一个键时，另一个标签页写入会把它内存里的**旧快照**整张表覆盖回来，
   * 本标签页刚建的记录凭空消失。一条记录一个键之后，改 B 不该动到 A。
   */
  it('单条写入是原子的：外部改 B 不影响本地的 A', () => {
    const a = makeItem({ id: 'search-a', query: '条目A', lastViewedAt: Date.now() - 60000 });
    const b = makeItem({ id: 'search-b', query: '条目B', lastViewedAt: Date.now() - 60000 });
    renderWithViewing([a, b], 'search', null);

    writeFromOtherTab({ ...b, lastViewedAt: Date.now() });

    expect(storedItem(a.id)?.lastViewedAt).toBe(a.lastViewedAt);
    expect(storedItem(b.id)!.lastViewedAt).toBeGreaterThan(Date.now() - 5000);
  });

  it('storage 事件 → 本标签页采纳外部新建的记录（列表实时收敛）', () => {
    const a = makeItem({ id: 'search-a', query: '条目A' });
    const { getByTestId } = renderWithViewing([a], 'search', null);

    act(() => {
      writeFromOtherTab(makeItem({ id: 'search-c', query: '外部新建' }));
    });

    expect(getByTestId('list').textContent).toContain('外部新建');
  });

  it('storage 事件 → 外部删除被采纳（不会因为本地还留着旧副本而复活）', () => {
    const a = makeItem({ id: 'search-a', query: '条目A' });
    const b = makeItem({ id: 'search-b', query: '条目B' });
    const { getByTestId } = renderWithViewing([a, b], 'search', null);

    act(() => {
      removeFromOtherTab(b.id);
    });

    const text = getByTestId('list').textContent || '';
    expect(text).toContain('条目A');
    expect(text).not.toContain('条目B');
  });

  it('storage 事件 → 外部改动的时间被采纳（列表顺序随之更新）', () => {
    const older = makeItem({ id: 'search-a', query: '条目A', lastViewedAt: Date.now() - 60 * 60000 });
    const newer = makeItem({ id: 'search-b', query: '条目B', lastViewedAt: Date.now() - 30 * 60000 });
    const { getByTestId } = renderWithViewing([older, newer], 'search', null);
    expect(getByTestId('list').textContent).toBe('条目B|条目A');

    act(() => {
      writeFromOtherTab({ ...older, lastViewedAt: Date.now() });
    });

    expect(getByTestId('list').textContent).toBe('条目A|条目B');
  });

  it('删除记录 = 真的删掉这个键（不是靠整表重写）', () => {
    const a = makeItem({ id: 'search-a', query: '条目A' });
    const b = makeItem({ id: 'search-b', query: '条目B' });
    seedStorage([a, b]);

    const Remover = () => {
      const { removeHistory } = useHistory();
      return <button onClick={() => removeHistory(b.id)}>remove</button>;
    };
    const { getByText } = render(
      <HistoryProvider>
        <Remover />
      </HistoryProvider>
    );

    act(() => {
      getByText('remove').click();
    });

    expect(window.localStorage.getItem(itemKey(b.id))).toBeNull();
    expect(window.localStorage.getItem(itemKey(a.id))).not.toBeNull();
    // 旧整表键不再被使用（避免与单条键形成两份真相）
    expect(window.localStorage.getItem(LEGACY_KEY)).toBeNull();
  });
});
