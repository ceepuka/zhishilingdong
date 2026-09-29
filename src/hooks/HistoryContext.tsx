import { createContext, useContext, useCallback, useState, useRef, useMemo, ReactNode, useEffect } from 'react';
import { HistoryItem, QASession, ChatMessage, HistoryData, SearchHistoryData, GeneratedKnowledge, KnowledgeCardData } from '../types';

/**
 * 历史记录存储布局：**一条记录一个键**（`ai-office-assistant-history:<id>`）。
 *
 * 为什么不是一个"整表键"：整表键下每次写入都要重写全部记录，多标签页同时打开时，
 * 后写的那个标签页会拿它内存里的旧快照把整张表盖掉 —— 另一个标签页刚新建的记录
 * 凭空消失、刚登记的 lastViewedAt 被退回（"整表覆盖写、后写者赢"）。
 * 一条记录一个键之后：
 *   - 写入天然是**单条原子操作**，两个标签页改不同记录互不影响；
 *   - 删除就是 `removeItem`，不会被"别的标签页还留着旧快照"复活；
 *   - 写入量与记录内容量脱钩，退出页面时那次同步落盘只写被改动的那一条。
 *
 * 另一条不变量：**写前重读磁盘**。内存副本只用于渲染，任何"读改写"都必须先读回
 * 磁盘上的最新副本（`readItem`）—— 别的标签页刚写的改动，本页可能还没收到 storage
 * 事件，用陈旧内存直接写回就是一次静默回退。
 */
const ITEM_PREFIX = 'ai-office-assistant-history:';
/** 旧版整表键：只在首次迁移时读一次 */
const LEGACY_KEY = 'ai-office-assistant-history';
/**
 * 存储架构标记。迁移必须**一次性**：只要标记在，就再也不读旧整表键。
 * 否则跑旧代码的标签页往旧键里写回快照，本页下次挂载又会吸收一遍 → 删掉的条目复活。
 */
const SCHEMA_KEY = 'ai-office-assistant-history.schema';
const SCHEMA_VERSION = '2';
/** 记录上限（内存视图按 lastViewedAt 从旧到新截断；删键另有独立的磁盘校验） */
const MAX_ITEMS = 100;

/**
 * "正在浏览"期间的心跳间隔。
 *
 * 为什么要心跳（而不是只在离开时写一次）：**离开那一刻的落盘不可靠**。
 * 关闭整个浏览器时 `beforeunload` 不触发（只剩 `pagehide`），处理函数确实执行了、
 * 也确实调了 `localStorage.setItem`，但渲染进程紧接着被杀，localStorage 的异步提交
 * 没来得及刷进磁盘 —— 重开后读到的还是上一次的值。所以不变量不能是"离开时写一次"，
 * 只能是"磁盘值落后于真实浏览时刻不超过一个周期"。
 *
 * 30s 与侧栏相对时间的粒度对齐（"刚刚"= 1 分钟内），再密就是纯浪费。
 */
export const VIEWING_HEARTBEAT_MS = 30_000;

const itemKey = (id: string) => `${ITEM_PREFIX}${id}`;

/** 时间基准：显示与排序都只看 lastViewedAt */
const byLastViewed = (a: HistoryItem, b: HistoryItem) => b.lastViewedAt - a.lastViewedAt;

/** 旧数据一次性转换：补齐 lastViewedAt（旧模型下 timestamp 即最后浏览时间） */
const migrate = (item: HistoryItem): HistoryItem => ({
  ...item,
  lastViewedAt: typeof item.lastViewedAt === 'number' ? item.lastViewedAt : item.timestamp,
});

// ---------------- 磁盘原语（全部容错） ----------------

/** 读单条：写前重读的唯一入口。读不到/坏了都返回 null，由调用方回退到内存副本 */
const readItem = (id: string): HistoryItem | null => {
  try {
    const raw = window.localStorage.getItem(itemKey(id));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as HistoryItem;
    return parsed?.id ? migrate(parsed) : null;
  } catch {
    return null;
  }
};

const writeItem = (item: HistoryItem) => {
  try {
    window.localStorage.setItem(itemKey(item.id), JSON.stringify(item));
  } catch (error) {
    console.error('Failed to save history:', error);
  }
};

const dropItem = (id: string) => {
  try {
    window.localStorage.removeItem(itemKey(id));
  } catch {
    /* ignore */
  }
};

/** 读全表（单条解析失败只跳过那一条） */
const readAll = (): HistoryItem[] => {
  const items: HistoryItem[] = [];
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (!key || !key.startsWith(ITEM_PREFIX)) continue;
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw) as HistoryItem;
        if (parsed?.id) items.push(migrate(parsed));
      } catch {
        /* 单条坏数据跳过 */
      }
    }
  } catch {
    /* localStorage 不可用 → 当空表 */
  }
  return items.sort(byLastViewed);
};

/**
 * 同一 `(type, query)` 只允许一条记录。
 *
 * 为什么需要：id 是生成时的时间戳（`search-1726…`），两个标签页各自生成同一个主题
 * 时谁都看不见对方的 id，于是造出两条同主题记录 —— 列表里看起来就是"一个标签页
 * 建的记录另一个标签页没有"。加载时按 `(type, query)` 归并，保留 lastViewedAt 较新
 * 的那条，把重复键删掉（幂等，两个标签页同时算结果一致）。
 */
const dedupe = (items: HistoryItem[]): { kept: HistoryItem[]; droppedIds: string[] } => {
  const best = new Map<string, HistoryItem>();
  const droppedIds: string[] = [];
  for (const item of items) {
    const key = `${item.type}\u0000${item.query}`;
    const seen = best.get(key);
    if (!seen) {
      best.set(key, item);
    } else if (item.lastViewedAt > seen.lastViewedAt) {
      droppedIds.push(seen.id);
      best.set(key, item);
    } else {
      droppedIds.push(item.id);
    }
  }
  return { kept: [...best.values()], droppedIds };
};

/** 首次迁移：把旧版整表数据摊成"一条一个键"，然后删旧键 + 落架构标记。只做一次 */
const absorbLegacyOnce = () => {
  let marker: string | null = null;
  try {
    marker = window.localStorage.getItem(SCHEMA_KEY);
  } catch {
    return;
  }
  if (marker === SCHEMA_VERSION) return;

  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(LEGACY_KEY);
  } catch {
    return;
  }
  if (raw) {
    try {
      const legacy = JSON.parse(raw) as HistoryItem[];
      for (const item of legacy) {
        if (item?.id && !window.localStorage.getItem(itemKey(item.id))) {
          window.localStorage.setItem(itemKey(item.id), JSON.stringify(migrate(item)));
        }
      }
    } catch {
      /* 旧表坏了就直接丢掉，不影响后续使用 */
    }
    try {
      window.localStorage.removeItem(LEGACY_KEY);
    } catch {
      /* ignore */
    }
  }
  try {
    window.localStorage.setItem(SCHEMA_KEY, SCHEMA_VERSION);
  } catch {
    /* ignore */
  }
};

/** 启动：迁移（一次性）+ 归并重复 + 排序 */
const bootstrap = (): HistoryItem[] => {
  absorbLegacyOnce();
  const { kept, droppedIds } = dedupe(readAll());
  for (const id of droppedIds) dropItem(id);
  return kept.sort(byLastViewed);
};

/** "正在浏览"的声明：模块只说自己在看哪一条，登记时机由 Provider 统一负责 */
export interface ViewingDeclaration {
  types: HistoryItem['type'][];
  query: string;
}

interface HistoryContextType {
  history: HistoryItem[];
  /**
   * 声明"当前正在浏览的记录"（推荐用 `useViewingHistory`）。
   *
   * 为什么放在 Provider 而不是侧栏/各模块：**退出应用页面时 React 不会卸载任何组件**，
   * 只有常驻的 Provider 才能同时覆盖"内容消失（React 卸载）"与"退出应用页面（页面级事件）"
   * 两类离开；集中在一处也杜绝了"某个模块忘了在离开路径上登记"的漏点。
   */
  setViewing: (viewing: ViewingDeclaration | null) => void;
  addHistory: (query: string, type: HistoryItem['type'], data?: HistoryData) => void;
  updateSession: (type: HistoryItem['type'], query: string, messages: ChatMessage[]) => void;
  getSession: (type: HistoryItem['type'], query: string) => HistoryData | undefined;
  updateQASession: (query: string, messages: QASession['messages']) => void;
  getQASession: (query: string) => QASession | undefined;
  updateSearchSession: (query: string, messages: ChatMessage[]) => void;
  updateSearchSessionWithData: (query: string, generatedData: GeneratedKnowledge, messages?: ChatMessage[]) => void;
  getSearchSession: (query: string) => SearchHistoryData | undefined;
  touchHistory: (id: string) => void;
  removeHistory: (id: string) => void;
  getHistoryByType: (type: HistoryItem['type'] | HistoryItem['type'][], currentViewing?: string) => HistoryItem[];
  clearHistory: (type?: HistoryItem['type'] | HistoryItem['type'][]) => void;
}

const HistoryContext = createContext<HistoryContextType | null>(null);

export const HistoryProvider = ({ children }: { children: ReactNode }) => {
  const [history, setHistory] = useState<HistoryItem[]>(bootstrap);

  /**
   * 内存视图（只用于渲染）。
   *
   * 为什么还要 ref：退出应用页面时的登记是**同步**发生的（pagehide 回调里），
   * 那一刻 React 的提交与 effect 都不一定跑得到，所以列表快照保存在这个引用里；
   * 但**写操作一律先重读磁盘**（见 `mutate`），不以它为真相。
   */
  const historyRef = useRef(history);

  /**
   * 上限裁剪：只在内存视图确实超限时才做，且**按磁盘真相裁剪**。
   *
   * 为什么不能直接删本页排序的尾巴：本页内存可能落后（别的标签页刚建的、刚刷新的
   * 记录本页还不知道），凭本页顺序把它算成"旧的"直接删键就是一次真实的数据丢失。
   */
  const trimDisk = useCallback(() => {
    const onDisk = readAll();
    for (const item of onDisk.slice(MAX_ITEMS)) dropItem(item.id);
  }, []);

  /** 所有变更的收口：更新内存视图 + 同步 React 状态（写盘由各调用点负责） */
  const commit = useCallback(
    (items: HistoryItem[]) => {
      const sorted = [...items].sort(byLastViewed);
      const kept = sorted.slice(0, MAX_ITEMS);
      historyRef.current = kept;
      setHistory(kept);
      if (sorted.length > MAX_ITEMS) trimDisk();
    },
    [trimDisk]
  );

  const upsert = useCallback(
    (item: HistoryItem) => {
      writeItem(item);
      commit([item, ...historyRef.current.filter((i) => i.id !== item.id)]);
    },
    [commit]
  );

  /**
   * 读改写：**以磁盘上的最新副本为基准**。
   *
   * 内存副本可能落后于磁盘（别的标签页刚改过、storage 事件还没处理到），
   * 直接 `produce(内存副本)` 再写回 = 静默回退别人的改动。
   */
  const mutate = useCallback(
    (id: string, produce: (item: HistoryItem) => HistoryItem) => {
      const base = readItem(id) ?? historyRef.current.find((i) => i.id === id);
      if (!base) return;
      upsert(produce(base));
    },
    [upsert]
  );

  /**
   * `(type, query)` → 记录。id 是生成时的随机时间戳，本页内存里没有不等于磁盘上没有 ——
   * 内存未命中时扫一遍磁盘，避免两个标签页为同一个主题各造一条记录。
   */
  const findByQuery = useCallback(
    (types: HistoryItem['type'][], query: string): HistoryItem | null => {
      const inMemory = historyRef.current.find((i) => types.includes(i.type) && i.query === query);
      if (inMemory) return readItem(inMemory.id) ?? inMemory;
      return readAll().find((i) => types.includes(i.type) && i.query === query) ?? null;
    },
    []
  );

  const addHistory = useCallback(
    (query: string, type: HistoryItem['type'], data?: HistoryData) => {
      const existing = findByQuery([type], query);
      if (existing) {
        // 复现已有记录 = 正在浏览它：刷新最后浏览时刻（timestamp 保持创建时刻不变）。
        // lastViewedAt 取 max：别的标签页可能刚把它刷新过，不能倒退回去。
        upsert({
          ...existing,
          lastViewedAt: Math.max(Date.now(), existing.lastViewedAt),
          data: data !== undefined ? { ...data, id: existing.id } : existing.data,
        });
        return;
      }
      const now = Date.now();
      // id 用时间戳 + 随机后缀：两个标签页在同一毫秒各建一条不同主题的记录时，
      // 纯时间戳会撞成同一个键 → 后写的直接把前一条盖掉（静默丢数据）。
      const id = `${type}-${now}-${Math.random().toString(36).slice(2, 6)}`;
      upsert({
        id,
        type,
        query,
        timestamp: now,
        lastViewedAt: now,
        data: data !== undefined ? { ...data, id } : data,
      });
    },
    [findByQuery, upsert]
  );

  const updateSession = useCallback(
    (type: HistoryItem['type'], query: string, messages: ChatMessage[]) => {
      const item = findByQuery([type], query);
      if (!item) return;
      mutate(item.id, (current) => ({
        ...current,
        data: {
          ...(current.data || {}),
          id: current.id,
          messages,
          timestamp: Date.now(),
        } as HistoryData,
      }));
    },
    [findByQuery, mutate]
  );

  const getSession = useCallback(
    (type: HistoryItem['type'], query: string): HistoryData | undefined =>
      history.find((h) => h.type === type && h.query === query)?.data,
    [history]
  );

  const updateQASession = useCallback(
    (query: string, messages: QASession['messages']) => {
      updateSession('qa', query, messages);
    },
    [updateSession]
  );

  const getQASession = useCallback(
    (query: string): QASession | undefined => {
      const data = getSession('qa', query);
      if (data && 'messages' in data && 'id' in data) return data;
      return undefined;
    },
    [getSession]
  );

  const updateSearchSession = useCallback(
    (query: string, messages: ChatMessage[]) => {
      updateSession('search', query, messages);
    },
    [updateSession]
  );

  const updateSearchSessionWithData = useCallback(
    (query: string, generatedData: GeneratedKnowledge, messages: ChatMessage[] = []) => {
      const item = findByQuery(['search'], query);
      if (!item) return;
      mutate(item.id, (current) => ({
        ...current,
        data: {
          result:
            (current.data as SearchHistoryData)?.result ||
            ({ type: 'concept', title: '', definition: '', points: [], example: '' } as KnowledgeCardData),
          generatedData,
          messages,
        } as SearchHistoryData,
      }));
    },
    [findByQuery, mutate]
  );

  const getSearchSession = useCallback(
    (query: string): SearchHistoryData | undefined => {
      const data = getSession('search', query);
      if (data && 'result' in data && ('generatedData' in data || 'messages' in data)) {
        return data as SearchHistoryData;
      }
      return undefined;
    },
    [getSession]
  );

  // touch = 登记"最后浏览时刻"（排序与显示的唯一时间基准）。
  // 调用方只有 Provider 自己（见 flushViewing），业务模块不再散写 touch。
  // lastViewedAt 取 max → 单调不回退：别的标签页刚刷新过的时间不会被本页写旧。
  const touchHistory = useCallback(
    (id: string) => {
      mutate(id, (item) => ({ ...item, lastViewedAt: Math.max(Date.now(), item.lastViewedAt) }));
    },
    [mutate]
  );

  const removeHistory = useCallback(
    (id: string) => {
      dropItem(id);
      commit(historyRef.current.filter((h) => h.id !== id));
    },
    [commit]
  );

  const getHistoryByType = useCallback(
    (type: HistoryItem['type'] | HistoryItem['type'][], currentViewing?: string) => {
      const types = Array.isArray(type) ? type : [type];
      const filtered = history.filter((h) => types.includes(h.type));

      if (currentViewing) {
        return [...filtered].sort((a, b) => {
          if (a.query === currentViewing) return -1;
          if (b.query === currentViewing) return 1;
          return b.lastViewedAt - a.lastViewedAt;
        });
      }

      return [...filtered].sort(byLastViewed);
    },
    [history]
  );

  const clearHistory = useCallback(
    (type?: HistoryItem['type'] | HistoryItem['type'][]) => {
      const types = type ? (Array.isArray(type) ? type : [type]) : null;
      const doomed = types ? historyRef.current.filter((h) => types.includes(h.type)) : historyRef.current;
      for (const item of doomed) dropItem(item.id);
      commit(types ? historyRef.current.filter((h) => !types.includes(h.type)) : []);
    },
    [commit]
  );

  // ---------------- "正在浏览"状态（单独处理，不寄生在侧栏上） ----------------

  const [viewing, setViewing] = useState<ViewingDeclaration | null>(null);

  /**
   * 解析出"浏览中"条目的唯一 id。
   * 声明只给 query（同一个 query 可能在不同类型里各有一条），必须回到记录表里定位；
   * 解析不到（条目被删了 / 还没建出来）就是 null —— 此时没有可登记的条目。
   */
  const viewingId = useMemo(() => {
    if (!viewing) return null;
    return history.find((h) => viewing.types.includes(h.type) && h.query === viewing.query)?.id ?? null;
  }, [viewing, history]);

  const viewingIdRef = useRef<string | null>(null);

  /**
   * 声明的原样副本（同步写入，不等 React 提交）。
   * 关闭标签页时只有同步可读的东西靠得住，所以除了"已解析出的条目 id"，
   * 还要留一份声明本身 —— 解析没成功时用它回磁盘找。
   */
  const viewingDeclRef = useRef<ViewingDeclaration | null>(null);

  /** 声明入口：同步记下原样声明，再交给 React 状态 */
  const declareViewing = useCallback((viewing: ViewingDeclaration | null) => {
    viewingDeclRef.current = viewing;
    setViewing(viewing);
  }, []);

  /**
   * React 侧离开（内容消失 / 声明方卸载）：登记**刚离开的那条**。
   *
   * 只认 `viewingIdRef`，不做磁盘兜底 —— 这条路径的语义是"上一个已解析出的条目停止被浏览"。
   * `viewingIdRef` 里存的正是上一次提交解析出的 id（见下面的 effect），而 cleanup 恰好
   * 在"新 id 写入 ref"之前执行，所以读到的一直是刚刚离开的那条。
   *
   * 反过来，**进入**一条内容时也会触发一次 cleanup（上一次 id 是 null），此时 ref 为 null，
   * 这里什么都不做 —— "进入"的登记由上面那个 effect **主动**做，不靠这条 cleanup 路径
   * 顺带完成（cleanup 只在"上一个条目停止被浏览"时才有语义，混在一起会登记错条目）。
   */
  const flushViewing = useCallback(() => {
    const id = viewingIdRef.current;
    if (id) touchHistory(id);
  }, [touchHistory]);

  /**
   * 页面级离开（关闭标签页 / 刷新 / 切后台 / 冻结）：登记"正在浏览的那条"。
   *
   * 这条路径不能只信 `viewingIdRef`：`viewingId` 是 `useMemo` 从 state 派生的，页面正在卸载时
   * 它可能还没解析好（条目刚建、内存尚未收敛），ref 还是 null —— 那就什么都不会写，
   * 表现为关掉标签页后时间停在旧值。所以解析不出来时退一步，按声明的 `(type, query)`
   * 直接回磁盘找：找到就登记，找不到才是真的没有可登记的条目。
   *
   * 与 React 侧的分工是刻意的：兜底只在**页面级离开**发生。若两条路径共用兜底，
   * "进入一条内容"的那次 cleanup 也会命中磁盘兜底 → 一进页面就把时间刷成现在，
   * 违背"只在浏览消失的一刻登记"。
   */
  const flushOnPageLeave = useCallback(() => {
    if (viewingIdRef.current) {
      touchHistory(viewingIdRef.current);
      return;
    }
    const decl = viewingDeclRef.current;
    if (!decl) return;
    const found = findByQuery(decl.types, decl.query);
    if (found) touchHistory(found.id);
  }, [touchHistory, findByQuery]);

  useEffect(() => {
    viewingIdRef.current = viewingId;
    /**
     * 进入即登记：给磁盘留一条兜底基线。
     *
     * 为什么不只靠"离开那一刻"：那一刻的落盘不可靠（见 VIEWING_HEARTBEAT_MS 的注释）。
     * 进入时写一次，即使进程随后被直接杀掉，值也不会停在"上一次浏览"那种陈年旧值上。
     *
     * 可见性：浏览中侧栏显示的是"浏览中"徽标而不是时间（见 HistorySidebar），
     * 所以这次写入对用户不可见；正常离开路径下紧随其后的 flushViewing 会用更晚的
     * 时刻覆盖它，语义仍是"最后浏览时间"。
     */
    if (viewingId) touchHistory(viewingId);
    return flushViewing;
  }, [viewingId, flushViewing, touchHistory]);

  /**
   * 浏览期间心跳：把"进程被杀 → 最后一次写入丢失"的损失限制在一个周期内。
   *
   * 页面在后台时不心跳 —— 切后台的那一刻 `visibilitychange → hidden` 已经登记过，
   * "正在浏览"本身也结束了。
   */
  useEffect(() => {
    if (!viewingId) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      touchHistory(viewingId);
    }, VIEWING_HEARTBEAT_MS);
    return () => window.clearInterval(timer);
  }, [viewingId, touchHistory]);

  /**
   * 页面级离开：**退出应用页面**（关闭标签页 / 刷新 / 切到其他 Tab / 切后台 / 页面被冻结）时
   * React 不会卸载任何组件，上面的 cleanup 不会执行 —— 只靠卸载路径登记的话，
   * lastViewedAt 会停在"上一次在应用内离开该条目的时刻"（表现为退出时没有刷新）。
   *
   * 监听挂在常驻的 Provider 上（而不是可能被收起/卸载的侧栏上），四类信号都覆盖：
   *   - visibilitychange → hidden：切到其他 Tab / 最小化 / 移动端切后台
   *   - pagehide：刷新 / 关闭 / 跳走（含 bfcache 进出）
   *   - beforeunload：关闭/刷新前的最后机会（部分环境只有它可用）
   *   - freeze：Chrome Page Lifecycle，后台标签被冻结（进程可能随后被回收）。
   *     注意它是 **document 上的事件**，挂到 window 上永远不会触发。
   * 落盘是同步的（touchHistory → readItem → writeItem），所以回调里写完即生效。
   */
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flushOnPageLeave();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', flushOnPageLeave);
    window.addEventListener('beforeunload', flushOnPageLeave);
    document.addEventListener('freeze', flushOnPageLeave);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', flushOnPageLeave);
      window.removeEventListener('beforeunload', flushOnPageLeave);
      document.removeEventListener('freeze', flushOnPageLeave);
    };
  }, [flushOnPageLeave]);

  /**
   * 跨标签页同步：另一个标签页改了某条记录（新建/更新/删除）时，本标签页收敛过去。
   *
   * 这是"多标签页"的另一半 —— 写入侧已经做到单条原子（不会整表覆盖），
   * 但如果本标签页的内存副本陈旧，它下一次写入仍会把自己不知道的改动带偏，
   * 所以落盘即真相：外部改了就直接采纳。
   */
  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      // key 为 null = 另一个标签页调用了 clear()
      if (event.key === null) {
        historyRef.current = readAll();
        setHistory(historyRef.current);
        return;
      }
      if (!event.key.startsWith(ITEM_PREFIX)) return;

      const id = event.key.slice(ITEM_PREFIX.length);
      const rest = historyRef.current.filter((h) => h.id !== id);
      if (event.newValue) {
        try {
          const parsed = JSON.parse(event.newValue) as HistoryItem;
          if (parsed?.id) rest.push(migrate(parsed));
        } catch {
          /* 坏数据当删除处理 */
        }
      }
      const sorted = rest.sort(byLastViewed);
      historyRef.current = sorted;
      setHistory(sorted);
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  return (
    <HistoryContext.Provider
      value={{
        history,
        setViewing: declareViewing,
        addHistory,
        updateSession,
        getSession,
        updateQASession,
        getQASession,
        updateSearchSession,
        updateSearchSessionWithData,
        getSearchSession,
        touchHistory,
        removeHistory,
        getHistoryByType,
        clearHistory,
      }}
    >
      {children}
    </HistoryContext.Provider>
  );
};

export const useHistory = () => {
  const context = useContext(HistoryContext);
  if (!context) {
    throw new Error('useHistory must be used within a HistoryProvider');
  }
  return context;
};

/**
 * 声明"当前正在浏览的记录"：内容显示时调用，内容消失 / 组件卸载自动注销。
 *
 * 模块只负责回答"我现在在看哪一条"，**登记 lastViewedAt 的时机全部由 Provider 负责**：
 *   - 进入（解析出条目 id）时写一次兜底基线；
 *   - 浏览期间每 VIEWING_HEARTBEAT_MS 心跳一次；
 *   - 声明变化 / 组件卸载（内容消失）时登记刚离开的那条；
 *   - 页面级离开（关标签页 / 刷新 / 切后台 / 关整个浏览器）时登记正在浏览的那条。
 * 四者取 max，单调不回退。之所以要前两条，是因为**离开那一刻的落盘不可靠**（见
 * VIEWING_HEARTBEAT_MS）；这样既没有"某个模块忘了在离开路径上 touch"的漏点，
 * 也不依赖侧栏是否挂载、更不依赖进程能不能活到把最后一次写入刷进磁盘。
 */
export function useViewingHistory(
  type: HistoryItem['type'] | HistoryItem['type'][],
  query: string | null | undefined
) {
  const { setViewing } = useHistory();
  // 依赖用字符串化的类型签名：调用方常直接传数组字面量，数组身份每次渲染都变 → 会反复登记
  const typeKey = Array.isArray(type) ? type.join('|') : type;
  useEffect(() => {
    if (!query) {
      setViewing(null);
      return;
    }
    setViewing({ types: typeKey.split('|') as HistoryItem['type'][], query });
    return () => setViewing(null);
  }, [typeKey, query, setViewing]);
}
