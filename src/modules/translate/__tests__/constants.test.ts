import { describe, it, expect } from 'vitest';
import { truncateInput, getMaxInput, DICT_MAX_INPUT, TRANSLATE_MAX_INPUT } from '../constants';

describe('输入长度限制', () => {
  it('超长内容被截断到上限', () => {
    const long = 'a'.repeat(DICT_MAX_INPUT + 50);
    const r = truncateInput(long, DICT_MAX_INPUT);
    expect(r.truncated).toBe(true);
    expect(r.text.length).toBe(DICT_MAX_INPUT);
  });

  it('未超长时原样返回', () => {
    expect(truncateInput('hi', 10)).toEqual({ text: 'hi', truncated: false });
  });

  it('查词与翻译使用不同的上限', () => {
    expect(getMaxInput('dictionary')).toBe(DICT_MAX_INPUT);
    expect(getMaxInput('translate')).toBe(TRANSLATE_MAX_INPUT);
    expect(DICT_MAX_INPUT).toBeLessThan(TRANSLATE_MAX_INPUT);
  });
});
