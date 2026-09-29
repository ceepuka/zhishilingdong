import { useCallback, useSyncExternalStore } from 'react';
import { FavoriteItem, KnowledgeCardData, WordResult, SentenceResult, DocResult, GeneratedKnowledge } from '../types';
import { getCurrentStrings } from '../i18n/strings';

const STORAGE_KEY = 'ai-office-assistant-favorites';
const SPACES_KEY = 'ai-office-assistant-favorite-spaces';

/**
 * 收藏数量上限。超出后按时间从旧到新淘汰（最新的留在最前）。
 * 注意：淘汰是**静默**的，所以上限值本身也是一个"内容会消失"的边界，
 * 不能设得过小；100 条足够覆盖常规使用。
 */
const MAX_FAVORITES = 100;

export interface FavoriteSpace {
  id: string;
  name: string;
  color: string;
  icon: string;
  createdAt: number;
}

/**
 * 本地存储写入结果的降级状态。
 *   - null      : 正常
 *   - 'slimmed' : 完整内容写不下，已剥离图片数据后保存（文字内容完整）
 *   - 'failed'  : 完全写不进去（额度真的满了）
 *
 * 为什么需要它：`localStorage.setItem` 超配额会抛异常，旧实现只 `console.error`，
 * 于是**界面显示已收藏、刷新后收藏消失**，用户完全无从判断发生了什么。
 */
export type StorageWarning = 'slimmed' | 'failed' | null;

let sharedFavorites: FavoriteItem[] = [];
let sharedSpaces: FavoriteSpace[] = [];
let storageWarning: StorageWarning = null;
const listeners = new Set<() => void>();

function readStorage(): FavoriteItem[] {
  try {
    const item = window.localStorage.getItem(STORAGE_KEY);
    return item ? JSON.parse(item) : [];
  } catch (error) {
    // 解析失败说明存的是脏数据（旧版本格式 / 被截断的写入）。不静默吞掉 —— 至少留下线索。
    console.warn('Failed to read favorites (corrupted payload?):', error);
    return [];
  }
}

function readSpaces(): FavoriteSpace[] {
  try {
    const item = window.localStorage.getItem(SPACES_KEY);
    return item ? JSON.parse(item) : [];
  } catch {
    return [];
  }
}

/**
 * 降级副本：剥掉体积最大的字段（base64 图片数据、手绘 SVG），保留全部文字内容。
 *
 * 收藏的知识卡里，`concept.imageData` 是 base64 data URL（可达数 MB），
 * 单个收藏就可能撑爆 localStorage 的 ~5MB 额度。
 * 与其整条收藏保存失败，不如"存得下多少存多少" —— 图片仍能靠
 * imageQuery 图库检索 / svg 通道补回来。
 */
function slimFavorites(items: FavoriteItem[]): FavoriteItem[] {
  const stripMedia = (obj: unknown): unknown => {
    if (!obj || typeof obj !== 'object') return obj;
    const copy = { ...(obj as Record<string, unknown>) };
    delete copy.imageData;
    delete copy.svg;
    return copy;
  };

  return items.map((item) => {
    const data = item.data;
    if (!data || typeof data !== 'object') return item;
    const d = data as Record<string, unknown>;

    if (item.type === 'knowledge') {
      return {
        ...item,
        data: {
          ...d,
          concepts: Array.isArray(d.concepts) ? d.concepts.map(stripMedia) : d.concepts,
          examQuestions: Array.isArray(d.examQuestions) ? d.examQuestions.map(stripMedia) : d.examQuestions,
        },
      };
    }
    if (item.type === 'dictionary') {
      return { ...item, data: stripMedia(d) };
    }
    return item;
  });
}

/**
 * 写入收藏：完整内容 → 失败则降级剥离图片 → 仍失败才置为 failed。
 * 返回是否还有"内容被降级"的隐患，由调用方通过 `storageWarning` 暴露给 UI。
 */
function saveStorage(items: FavoriteItem[]) {
  storageWarning = null;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    return;
  } catch {
    // 配额不足之类的写入失败 —— 先降级再试
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(slimFavorites(items)));
    storageWarning = 'slimmed';
  } catch (error) {
    storageWarning = 'failed';
    console.error('Failed to save favorites (storage full):', error);
  }
}

function saveSpaces(spaces: FavoriteSpace[]) {
  try {
    window.localStorage.setItem(SPACES_KEY, JSON.stringify(spaces));
  } catch (error) {
    console.error('Failed to save spaces:', error);
  }
}

function notify() {
  listeners.forEach((l) => l());
}

sharedFavorites = readStorage();
sharedSpaces = readSpaces();

if (sharedSpaces.length === 0) {
  const collections = getCurrentStrings().favorites.collections;
  sharedSpaces = [
    { id: 'default', name: collections.default, color: 'teal', icon: 'star', createdAt: Date.now() },
    { id: 'work', name: collections.work, color: 'blue', icon: 'briefcase', createdAt: Date.now() },
    { id: 'study', name: collections.study, color: 'purple', icon: 'book', createdAt: Date.now() },
  ];
  saveSpaces(sharedSpaces);
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) {
      sharedFavorites = readStorage();
      notify();
    } else if (e.key === SPACES_KEY) {
      sharedSpaces = readSpaces();
      notify();
    }
  });
}

let currentSnapshot: { favorites: FavoriteItem[]; spaces: FavoriteSpace[]; storageWarning: StorageWarning } | null = null;

/**
 * 收藏的"身份标识"：标题。
 *
 * 历史实现用 `JSON.stringify(f.data) === JSON.stringify(data)` 做去重，
 * 对一个可能带几 MB base64 的对象逐条深度序列化 —— 既是性能陷阱，
 * 也和 UI 星标状态（`isFavorite` 只比标题）**判定口径不一致**，
 * 会出现"按钮显示已收藏、点一下却又新增一条"的错位。
 * 这里统一成同一口径：同类型 + 同收藏夹 + 同标题 = 同一条收藏。
 */
function favoriteTitle(data: unknown): string {
  if (!data || typeof data !== 'object') return '';
  const d = data as Record<string, unknown>;
  const candidate = d.topic || d.title || d.word || d.original;
  return typeof candidate === 'string' ? candidate : '';
}

export function useFavorites() {
  const subscribe = useCallback((callback: () => void) => {
    listeners.add(callback);
    return () => { listeners.delete(callback); };
  }, []);

  const getSnapshot = useCallback(() => {
    if (!currentSnapshot ||
        currentSnapshot.favorites !== sharedFavorites ||
        currentSnapshot.spaces !== sharedSpaces ||
        currentSnapshot.storageWarning !== storageWarning) {
      currentSnapshot = { favorites: sharedFavorites, spaces: sharedSpaces, storageWarning };
    }
    return currentSnapshot;
  }, []);

  const { favorites, spaces, storageWarning: warning } = useSyncExternalStore(subscribe, getSnapshot);

  const addFavorite = useCallback((data: KnowledgeCardData | WordResult | SentenceResult | DocResult | GeneratedKnowledge, type: FavoriteItem['type'], label?: string, spaceId: string = 'default') => {
    const title = favoriteTitle(data);
    const exists = sharedFavorites.some(
      (f) => f.type === type && f.spaceId === spaceId && favoriteTitle(f.data) === title
    );
    if (exists) return;

    const newFavorite: FavoriteItem = {
      id: `${type}-${Date.now()}`,
      type,
      data,
      label: label || '',
      timestamp: Date.now(),
      spaceId,
    };
    sharedFavorites = [newFavorite, ...sharedFavorites].slice(0, MAX_FAVORITES);
    saveStorage(sharedFavorites);
    notify();
  }, []);

  const removeFavorite = useCallback((id: string) => {
    sharedFavorites = sharedFavorites.filter((f) => f.id !== id);
    saveStorage(sharedFavorites);
    notify();
  }, []);

  const isFavorite = useCallback((data: KnowledgeCardData | WordResult | SentenceResult | DocResult | GeneratedKnowledge | Record<string, unknown>, type: FavoriteItem['type'], spaceId: string = 'default') => {
    const title = favoriteTitle(data) || JSON.stringify(data);
    return sharedFavorites.some(
      (f) => f.type === type && f.spaceId === spaceId && (favoriteTitle(f.data) || JSON.stringify(f.data)) === title
    );
  }, []);

  const getFavoritesByType = useCallback((type: FavoriteItem['type']) => {
    return sharedFavorites.filter((f) => f.type === type);
  }, [favorites]);

  const getFavoritesBySpace = useCallback((spaceId: string) => {
    return sharedFavorites.filter((f) => f.spaceId === spaceId);
  }, [favorites]);

  const clearFavorites = useCallback(() => {
    sharedFavorites = [];
    saveStorage([]);
    notify();
  }, []);

  /** 用户确认过存储降级提示后清掉横幅 */
  const dismissStorageWarning = useCallback(() => {
    storageWarning = null;
    notify();
  }, []);

  const addSpace = useCallback((name: string, color: string = 'teal', icon: string = 'star') => {
    const newSpace: FavoriteSpace = {
      id: `space-${Date.now()}`,
      name,
      color,
      icon,
      createdAt: Date.now(),
    };
    sharedSpaces = [...sharedSpaces, newSpace];
    saveSpaces(sharedSpaces);
    notify();
    return newSpace;
  }, []);

  const removeSpace = useCallback((spaceId: string) => {
    if (spaceId === 'default') return;
    sharedSpaces = sharedSpaces.filter((s) => s.id !== spaceId);
    sharedFavorites = sharedFavorites.filter((f) => f.spaceId !== spaceId);
    saveSpaces(sharedSpaces);
    saveStorage(sharedFavorites);
    notify();
  }, []);

  const updateSpace = useCallback((spaceId: string, updates: Partial<Pick<FavoriteSpace, 'name' | 'color' | 'icon'>>) => {
    sharedSpaces = sharedSpaces.map((s) =>
      s.id === spaceId ? { ...s, ...updates } : s
    );
    saveSpaces(sharedSpaces);
    notify();
  }, []);

  return {
    favorites,
    spaces,
    storageWarning: warning,
    addFavorite,
    removeFavorite,
    isFavorite,
    getFavoritesByType,
    getFavoritesBySpace,
    clearFavorites,
    dismissStorageWarning,
    addSpace,
    removeSpace,
    updateSpace,
  };
}
