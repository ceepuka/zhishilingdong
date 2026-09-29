import { describe, it, expect } from 'vitest';
import { normalizeLanguage, languageEnglish, languageLabel, isLanguageCode } from '../languages';

describe('语言归一化 normalizeLanguage', () => {
  it('兼容旧版本直接存储的 zh-CN / en-US', () => {
    expect(normalizeLanguage('zh-CN')).toBe('zh');
    expect(normalizeLanguage('en-US')).toBe('en');
  });

  it('中文名 / 英文名 / 母语写法 → 标准 code', () => {
    expect(normalizeLanguage('英文')).toBe('en');
    expect(normalizeLanguage('Japanese')).toBe('ja');
    expect(normalizeLanguage('法语')).toBe('fr');
    expect(normalizeLanguage('日本語')).toBe('ja');
  });

  it('带地区的 BCP-47 标签 → 主语言 code', () => {
    expect(normalizeLanguage('fr-FR')).toBe('fr');
    expect(normalizeLanguage('ja-JP')).toBe('ja');
    expect(normalizeLanguage('zh-TW')).toBe('zh');
  });

  it('无法识别 → 回退 fallback', () => {
    expect(normalizeLanguage('xx-YY', 'en')).toBe('en');
    expect(normalizeLanguage(undefined, 'zh')).toBe('zh');
  });
});

describe('语言展示与注入', () => {
  it('languageEnglish 用于 prompt 注入', () => {
    expect(languageEnglish('zh')).toBe('Simplified Chinese');
    expect(languageEnglish('en')).toBe('English');
  });

  it('languageLabel 为母语写法', () => {
    expect(languageLabel('zh')).toBe('中文');
    expect(languageLabel('en')).toBe('English');
  });

  it('isLanguageCode 判定', () => {
    expect(isLanguageCode('de')).toBe(true);
    expect(isLanguageCode('zz')).toBe(false);
    expect(isLanguageCode(null)).toBe(false);
  });
});
