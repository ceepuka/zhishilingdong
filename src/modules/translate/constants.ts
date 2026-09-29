/** 查词 / 翻译模块的输入约束与工具 */

/** 查词输入上限（短语/多词也要能被 AI 快速处理） */
export const DICT_MAX_INPUT = 120;

/** 翻译输入上限（长句/段落的合理上限） */
export const TRANSLATE_MAX_INPUT = 3000;

export function getMaxInput(mode: 'dictionary' | 'translate'): number {
  return mode === 'dictionary' ? DICT_MAX_INPUT : TRANSLATE_MAX_INPUT;
}

/** 超长截断：返回截断后的文本与是否发生了截断 */
export function truncateInput(text: string, max: number): { text: string; truncated: boolean } {
  if (text.length <= max) return { text, truncated: false };
  return { text: text.slice(0, max), truncated: true };
}
