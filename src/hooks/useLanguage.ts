import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { LanguageCode, languageSpeech } from '../i18n/languages';
import {
  subscribeLanguage,
  getLanguageSnapshot,
  setStoredLanguage,
} from './useLanguageStore';

export type { LanguageCode } from '../i18n/languages';

/** 界面文案实际支持的语言（其余语言回退到英文界面） */
export type UILanguage = 'zh-CN' | 'en-US';

function toUILanguage(code: LanguageCode): UILanguage {
  return code === 'zh' ? 'zh-CN' : 'en-US';
}

/**
 * 用户语言 Hook。
 *
 * - `language`：用户语言（标准 code，决定 AI 输出语言）
 * - `uiLanguage`：界面文案语言（当前仅 zh-CN / en-US 两套）
 *
 * 默认取系统语言（navigator.language），并跨组件共享同一份状态。
 */
export function useLanguage() {
  const language = useSyncExternalStore(
    subscribeLanguage,
    getLanguageSnapshot,
    getLanguageSnapshot,
  );

  useEffect(() => {
    try {
      document.documentElement.lang = languageSpeech(language) ?? language;
    } catch { /* ignore */ }
  }, [language]);

  const setLanguage = useCallback((code: LanguageCode) => setStoredLanguage(code), []);
  const setLanguageZh = useCallback(() => setStoredLanguage('zh'), []);
  const setLanguageEn = useCallback(() => setStoredLanguage('en'), []);

  return {
    language,
    uiLanguage: toUILanguage(language),
    setLanguage,
    setLanguageZh,
    setLanguageEn,
  };
}
