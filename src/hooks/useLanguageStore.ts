/**
 * useLanguageStore —— 用户语言的"纯存储读写层"（与 React 无关）
 * ------------------------------------------------------------------
 * 与 useAIConfigStore 同构：单例 store + subscribe/emit，
 * 供 useSyncExternalStore 跨组件共享，也供 baseAIProvider 在
 * 非 React 环境直接读取"当前用户语言"来约束 AI 输出语言。
 *
 * 存储的是标准 LanguageCode（如 zh / en / fr），而非 UI 语言（zh-CN / en-US）。
 * 这样即便 UI 只提供中/英两套文案，AI 仍能以用户的真实母语输出。
 */

import {
  LanguageCode,
  isLanguageCode,
  normalizeLanguage,
} from '../i18n/languages';

export const LANGUAGE_STORAGE_KEY = 'ai-office-assistant-language';

let cached: LanguageCode | null = null;
let listeners: Array<() => void> = [];

/** 系统语言 → 标准 code（浏览器语言可能是 fr-FR、zh-TW 等，统一归一化） */
function systemDefaultLanguage(): LanguageCode {
  try {
    const nav = (typeof navigator !== 'undefined' && navigator.language) || 'en';
    return normalizeLanguage(nav, 'en');
  } catch {
    return 'en';
  }
}

function readFromStorage(): LanguageCode {
  try {
    const raw = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    // 兼容旧版本直接存 'zh-CN' / 'en-US' 的写法：normalizeLanguage 会归一化
    if (raw) return normalizeLanguage(raw, systemDefaultLanguage());
  } catch { /* ignore */ }
  return systemDefaultLanguage();
}

/** 当前用户语言（同步读，带缓存） */
export function getStoredLanguage(): LanguageCode {
  if (!cached) cached = readFromStorage();
  return cached;
}

/** 快照（供 useSyncExternalStore，引用稳定） */
export function getLanguageSnapshot(): LanguageCode {
  return getStoredLanguage();
}

export function subscribeLanguage(callback: () => void): () => void {
  listeners.push(callback);
  return () => { listeners = listeners.filter(l => l !== callback); };
}

function emitLanguageChange(): void {
  cached = null;
  for (const l of listeners) l();
}

export function setStoredLanguage(code: LanguageCode): void {
  if (!isLanguageCode(code)) return;
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, code);
  } catch { /* ignore */ }
  cached = code;
  emitLanguageChange();
}

/**
 * AI 内容语言：与用户语言一致。
 * 集中在这里，方便以后做"界面语言 ≠ 内容语言"的解耦。
 */
export function getAIContentLanguage(): LanguageCode {
  return getStoredLanguage();
}
