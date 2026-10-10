/**
 * 语言目录（Language Catalog）
 * ------------------------------------------------------------------
 * 全应用唯一的语言清单，供三处共用：
 *   1. 用户语言设置（useLanguage / useLanguageStore）—— 决定 AI 输出语言
 *   2. 查词翻译模块的「源语言 / 目标语言」下拉框
 *   3. 语音朗读（Web Speech API 的 BCP-47 代码）
 *
 * 每个语言同时保存三种形态：
 *   - code    内部标识（稳定，不随文案变化）
 *   - native  母语写法（下拉框展示，用户最易识别）
 *   - english 英文名（注入 AI prompt 时最不容易被误解）
 *   - speech  BCP-47 语音代码（朗读用，可空）
 */

/** 可选语言（不含"自动检测"） */
export type LanguageCode =
  | 'zh' | 'en' | 'ja' | 'ko' | 'fr' | 'de' | 'es' | 'ru'
  | 'pt' | 'it' | 'ar' | 'th' | 'vi' | 'hi';

/** 源语言可以是"自动检测" */
export type SourceLanguageCode = LanguageCode | 'auto';

export interface LanguageMeta {
  code: LanguageCode;
  /** 母语写法，用于下拉框 */
  native: string;
  /** 中文名，用于中文界面的辅助说明 */
  zhName: string;
  /** 英文名，注入 prompt 使用 */
  english: string;
  /** BCP-47 语音代码（朗读用），无则 undefined */
  speech?: string;
}

export const LANGUAGES: LanguageMeta[] = [
  { code: 'zh', native: '中文', zhName: '中文', english: 'Simplified Chinese', speech: 'zh-CN' },
  { code: 'en', native: 'English', zhName: '英语', english: 'English', speech: 'en-US' },
  { code: 'ja', native: '日本語', zhName: '日语', english: 'Japanese', speech: 'ja-JP' },
  { code: 'ko', native: '한국어', zhName: '韩语', english: 'Korean', speech: 'ko-KR' },
  { code: 'fr', native: 'Français', zhName: '法语', english: 'French', speech: 'fr-FR' },
  { code: 'de', native: 'Deutsch', zhName: '德语', english: 'German', speech: 'de-DE' },
  { code: 'es', native: 'Español', zhName: '西班牙语', english: 'Spanish', speech: 'es-ES' },
  { code: 'ru', native: 'Русский', zhName: '俄语', english: 'Russian', speech: 'ru-RU' },
  { code: 'pt', native: 'Português', zhName: '葡萄牙语', english: 'Portuguese', speech: 'pt-PT' },
  { code: 'it', native: 'Italiano', zhName: '意大利语', english: 'Italian', speech: 'it-IT' },
  { code: 'ar', native: 'العربية', zhName: '阿拉伯语', english: 'Arabic', speech: 'ar-SA' },
  { code: 'th', native: 'ไทย', zhName: '泰语', english: 'Thai', speech: 'th-TH' },
  { code: 'vi', native: 'Tiếng Việt', zhName: '越南语', english: 'Vietnamese', speech: 'vi-VN' },
  { code: 'hi', native: 'हिन्दी', zhName: '印地语', english: 'Hindi', speech: 'hi-IN' },
];

const LANGUAGE_MAP: Record<string, LanguageMeta> = LANGUAGES.reduce((acc, l) => {
  acc[l.code] = l;
  return acc;
}, {} as Record<string, LanguageMeta>);

/** 常见别名 / 中文名 / 英文名 → 标准 code（兼容旧数据与 AI 回包的不确定写法） */
const LANGUAGE_ALIASES: Record<string, LanguageCode> = (() => {
  const map: Record<string, LanguageCode> = {};
  for (const l of LANGUAGES) {
    map[l.code] = l.code;
    map[l.english.toLowerCase()] = l.code;
    map[l.native.toLowerCase()] = l.code;
    map[l.zhName] = l.code;
  }
  // 常见非标准写法兜底
  Object.assign(map, {
    '中文': 'zh', '简体中文': 'zh', 'chinese': 'zh', 'zh-cn': 'zh', 'zh-hans': 'zh', 'zh-tw': 'zh', '繁体中文': 'zh',
    '英文': 'en', '英语': 'en', 'english': 'en', 'en-us': 'en', 'en-gb': 'en',
    '日文': 'ja', '日语': 'ja', 'japanese': 'ja', 'ja-jp': 'ja',
    '韩语': 'ko', '韩文': 'ko', 'korean': 'ko', 'ko-kr': 'ko',
    '法语': 'fr', '法文': 'fr', 'french': 'fr',
    '德语': 'de', '德文': 'de', 'german': 'de',
    '西班牙语': 'es', '西班牙文': 'es', 'spanish': 'es',
    '俄语': 'ru', '俄文': 'ru', 'russian': 'ru',
    '葡萄牙语': 'pt', 'portuguese': 'pt',
    '意大利语': 'it', 'italian': 'it',
    '阿拉伯语': 'ar', 'arabic': 'ar',
    '泰语': 'th', 'thai': 'th',
    '越南语': 'vi', 'vietnamese': 'vi',
    '印地语': 'hi', 'hindi': 'hi',
  });
  return map;
})();

export function isLanguageCode(v: unknown): v is LanguageCode {
  return typeof v === 'string' && !!LANGUAGE_MAP[v];
}

/** 归一化任意语言写法 → 标准 code；识别不了时回退 fallback */
export function normalizeLanguage(v: unknown, fallback: LanguageCode = 'en'): LanguageCode {
  if (typeof v !== 'string') return fallback;
  const trimmed = v.trim();
  const key = trimmed.toLowerCase();
  const direct = LANGUAGE_ALIASES[key] ?? LANGUAGE_ALIASES[trimmed];
  if (direct) return direct;
  // 处理带地区的 BCP-47 标签（fr-FR / ja-JP / zh-TW → 主语言子标签）
  const primary = key.split(/[-_]/)[0];
  return LANGUAGE_ALIASES[primary] ?? fallback;
}

export function getLanguageMeta(code: string): LanguageMeta | undefined {
  return LANGUAGE_MAP[code];
}

/** 母语写法（下拉框展示）；未知 code 原样返回 */
export function languageLabel(code: string): string {
  return LANGUAGE_MAP[code]?.native ?? code;
}

/** 英文名（注入 prompt，模型最稳）；未知 code 原样返回 */
export function languageEnglish(code: string): string {
  return LANGUAGE_MAP[code]?.english ?? code;
}

/** BCP-47 语音代码（朗读用） */
export function languageSpeech(code: string): string | undefined {
  return LANGUAGE_MAP[code]?.speech;
}

/**
 * BCP-47 语音代码 → 母语名（朗读降级提示用）。
 *
 * 用于"本机没装 X 语言语音，改用 Y 代读"这类提示：提示里要给用户看的是
 * 「英语」「中文」这种人话，而不是 `en-US` / `zh-CN` 这种代码。
 * 反查不中时原样返回代码，宁可难看也不丢信息。
 */
export function speechLanguageLabel(bcp47: string): string {
  const primary = (bcp47 || '').split(/[-_]/)[0].toLowerCase();
  const meta = LANGUAGES.find((l) => l.speech?.toLowerCase().startsWith(primary));
  return meta ? meta.native : bcp47;
}

/** 目标语言下拉选项（不含"自动检测"） */
export const TARGET_LANGUAGE_OPTIONS = LANGUAGES;

/** 源语言下拉选项（含"自动检测"） */
export const SOURCE_LANGUAGE_OPTIONS: { code: SourceLanguageCode; native: string; zhName: string }[] = [
  { code: 'auto', native: '自动检测', zhName: '自动检测源语言' },
  ...LANGUAGES.map((l) => ({ code: l.code, native: l.native, zhName: l.zhName })),
];
