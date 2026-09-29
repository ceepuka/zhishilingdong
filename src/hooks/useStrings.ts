/**
 * useStrings —— 组件里取当前界面文案
 * ------------------------------------------------------------------
 * const s = useStrings();
 * <h3>{s.search.sections.mindMap}</h3>
 * <span>{fmt(s.common.minutesAgo, { n: 5 })}</span>
 *
 * 语言切换由 useLanguageStore 统一广播，这里跟着重渲染即可。
 */

import { useSyncExternalStore } from 'react';
import { getLanguageSnapshot, subscribeLanguage } from './useLanguageStore';
import { stringsForLanguage, type Strings } from '../i18n/strings';

export { fmt } from '../i18n/strings';
export type { Strings } from '../i18n/strings';

export function useStrings(): Strings {
  const language = useSyncExternalStore(
    subscribeLanguage,
    getLanguageSnapshot,
    getLanguageSnapshot,
  );
  return stringsForLanguage(language);
}
