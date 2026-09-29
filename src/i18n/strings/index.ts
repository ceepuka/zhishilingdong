/**
 * i18n · 字符串层入口
 * ------------------------------------------------------------------
 * 用法：
 *   const s = useStrings();
 *   s.search.sections.mindMap        // 直接取值
 *   fmt(s.common.minutesAgo, { n: 5 })  // 占位符填充 → "5分钟前"
 *
 * 设计取舍：
 *   - **嵌套对象 + TypeScript 推断**（而非 'a.b.c' 字符串 key）：
 *     拼错 key 直接编译报错，重构时 IDE 能自动改名。
 *   - **English 作类型基准**：英文对象是唯一的结构来源，中文对象漏写 key 立即报错。
 *   - **回退到英文**：中文对象里缺某个 key 时运行时不会崩，只是显示英文。
 *   - 非 React 场景（utils、service、状态机）用 `getCurrentStrings()`。
 */

import { commonEn, commonZh, type CommonStrings } from './common';
import { settingsEn, settingsZh, type SettingsStrings } from './settings';
import { searchEn, searchZh, type SearchStrings } from './search';
import { translateEn, translateZh, type TranslateStrings } from './translate';
import { miscEn, miscZh, type MiscStrings } from './misc';
import { getStoredLanguage } from '../../hooks/useLanguageStore';

export type Strings = CommonStrings & SettingsStrings & SearchStrings & TranslateStrings & MiscStrings;

export type { CommonStrings, SettingsStrings, SearchStrings, TranslateStrings, MiscStrings };

type Dict = Record<string, unknown>;

function isPlainObject(v: unknown): v is Dict {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** 以 base 为底，用 override 覆盖（数组整体替换，不做合并） */
function deepMerge<T extends Dict>(base: Dict, override: Dict): T {
  const out: Dict = { ...base };
  for (const key of Object.keys(override)) {
    const b = out[key];
    const o = override[key];
    if (isPlainObject(b) && isPlainObject(o)) {
      out[key] = deepMerge(b, o);
    } else if (o !== undefined) {
      out[key] = o;
    }
  }
  return out as T;
}

export const STRINGS_EN: Strings = {
  ...commonEn,
  ...settingsEn,
  ...searchEn,
  ...translateEn,
  ...miscEn,
};

/** 中文表：漏写任何 key 都会由 English 补上，避免运行时炸 undefined */
export const STRINGS_ZH: Strings = deepMerge<Strings>(
  STRINGS_EN,
  { ...commonZh, ...settingsZh, ...searchZh, ...translateZh, ...miscZh },
);

/** 界面语言 → 文案表。目前仅 zh → 中文，其余一律英文界面 */
export function stringsForLanguage(language: string): Strings {
  return language === 'zh' ? STRINGS_ZH : STRINGS_EN;
}

/** 当前用户语言对应的文案表（非 React 场景用） */
export function getCurrentStrings(): Strings {
  return stringsForLanguage(getStoredLanguage());
}

/** 占位符填充：`fmt('共 {n} 项', { n: 3 })` → `'共 3 项'` */
export function fmt(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (raw, key: string) => {
    const value = vars[key];
    return value === undefined ? raw : String(value);
  });
}
