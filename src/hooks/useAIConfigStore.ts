/**
 * useAIConfigStore —— 多模型配置的"纯存储读写层"（与 React 无关）
 * ------------------------------------------------------------------
 * 职责：
 *   - 读/写 LocalStorage 中的 AI_CONFIG_STORAGE_KEY
 *   - 提供类型安全的 getter / setter / patch
 *   - 全局 store + subscribe/emit（供 useSyncExternalStore 跨组件共享）
 *
 * 供：
 *   - BaseAIProvider（callModel 中直接读当前厂商的 key/status）
 *   - useAIConfig（React Hook 层）
 * 共用同一份存储逻辑，避免重复代码。
 */

import {
  AIConfigRoot,
  ProviderConfig,
  ALL_PROVIDER_IDS,
  createDefaultAIConfig,
  createDefaultProviderConfig,
  getDefaultModelId,
  getProviderInfo,
  resolveActiveModelId,
  resolveBaseUrl,
} from '../types/aiProviders';

export const AI_CONFIG_STORAGE_KEY = 'ai-office-assistant-ai-config';

// ---------- 全局 store（供 useSyncExternalStore 跨组件共享）----------

let cachedRoot: AIConfigRoot | null = null;
let listeners: Array<() => void> = [];

/** 订阅变更（供 useSyncExternalStore 使用）*/
export function subscribeAIConfig(callback: () => void): () => void {
  listeners.push(callback);
  return () => { listeners = listeners.filter(l => l !== callback); };
}

/** 通知所有订阅者 */
function emitAIConfigChange(): void {
  cachedRoot = null;
  for (const l of listeners) l();
}

// ---------- 基础读写 ----------

/** 只认 v2 结构 */
function safeParse(raw: string | null): AIConfigRoot | null {
  if (!raw) return null;
  try {
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== 'object' || obj.version !== 2) return null;

    const cfg = obj as AIConfigRoot;

    // 补全缺失的预设厂商 ProviderConfig
    for (const id of ALL_PROVIDER_IDS) {
      if (!cfg.providers[id]) cfg.providers[id] = createDefaultProviderConfig();
    }

    // 兜底 customProviders
    if (!cfg.customProviders || typeof cfg.customProviders !== 'object') {
      cfg.customProviders = {};
    }

    // 校验 activeProviderId：必须在预设 ∪ customProviders 中
    const validIds = new Set([...ALL_PROVIDER_IDS, ...Object.keys(cfg.customProviders)]);
    if (!cfg.activeProviderId || !validIds.has(cfg.activeProviderId)) {
      cfg.activeProviderId = 'zhipu';
    }

    // 校验 activeModelId：必须在 activeProvider 的 models 中（或 customModel 已覆盖）
    const info = getProviderInfo(cfg.activeProviderId, cfg.customProviders);
    const hasCustomModel = !!cfg.providers[cfg.activeProviderId]?.customModel?.trim();
    if (!hasCustomModel && (!cfg.activeModelId || !info?.models.some(m => m.id === cfg.activeModelId))) {
      cfg.activeModelId = getDefaultModelId(cfg.activeProviderId, cfg.customProviders);
    }

    return cfg;
  } catch { /* fallthrough */ }
  return null;
}

/** 内部读（不触发 emit）*/
function readFromStorage(): AIConfigRoot {
  try {
    const raw = localStorage.getItem(AI_CONFIG_STORAGE_KEY);
    const parsed = safeParse(raw);
    if (parsed) return parsed;
  } catch { /* ignore */ }
  const def = createDefaultAIConfig();
  try {
    localStorage.setItem(AI_CONFIG_STORAGE_KEY, JSON.stringify(def));
  } catch { /* ignore */ }
  return def;
}

export function getStoredAIConfig(): AIConfigRoot {
  if (!cachedRoot) cachedRoot = readFromStorage();
  return cachedRoot;
}

/** 快照（供 useSyncExternalStore，引用稳定）*/
export function getAIConfigSnapshot(): AIConfigRoot {
  return getStoredAIConfig();
}

export function setStoredAIConfig(cfg: AIConfigRoot): void {
  try {
    localStorage.setItem(AI_CONFIG_STORAGE_KEY, JSON.stringify(cfg));
  } catch { /* ignore */ }
  cachedRoot = cfg;
  emitAIConfigChange();
}

/** 原子更新：深拷贝 → apply mutator → 写回 → emit */
export function updateStoredAIConfig(
  mutator: (cfg: AIConfigRoot) => AIConfigRoot | void
): AIConfigRoot {
  const current = getStoredAIConfig();
  const next: AIConfigRoot = JSON.parse(JSON.stringify(current));
  const result = mutator(next);
  const final = result || next;
  setStoredAIConfig(final);
  return final;
}

// ---------- Provider 级别的便捷访问器（供 callModel 高频读）----------

export function getProviderRuntime(providerId: string): {
  apiKey: string; status: ProviderConfig['status']; error: string;
  customBaseUrl: string; customModel: string;
  baseUrl: string; modelId: string;
} {
  const root = getStoredAIConfig();
  const cfg = root.providers[providerId];
  return {
    apiKey: cfg.apiKey,
    status: cfg.status,
    error: cfg.error,
    customBaseUrl: cfg.customBaseUrl,
    customModel: cfg.customModel,
    baseUrl: resolveBaseUrl(providerId, cfg, root.customProviders),
    modelId: resolveActiveModelId(providerId, root.activeModelId, cfg, root.customProviders),
  };
}
