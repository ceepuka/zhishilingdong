import { describe, it, expect } from 'vitest';
import { mockAIService } from '../../../services/mockAIService';

describe('查词/翻译服务（新契约）', () => {
  it('detect 仅返回源语言 code + isPhrase', async () => {
    const zh = await mockAIService.translate.detect('你好');
    expect(zh.data?.sourceLang).toBe('zh');
    expect(zh.data?.isPhrase).toBe(false);
    expect(zh.data).not.toHaveProperty('targetLang');

    const en = await mockAIService.translate.detect('take into account');
    expect(en.data?.sourceLang).toBe('en');
    expect(en.data?.isPhrase).toBe(true);
  });

  it('短语 / 多词查询返回最多 10 个关键词', async () => {
    const res = await mockAIService.translate.queryWord('take into account', 'en', 'zh');
    expect(res.data?.isPhrase).toBe(true);
    expect(res.data?.keywords && res.data.keywords.length).toBeGreaterThan(0);
    expect((res.data?.keywords ?? []).length).toBeLessThanOrEqual(10);
  });

  it('单词查询不返回关键词', async () => {
    const res = await mockAIService.translate.queryWord('sample', 'en', 'zh');
    expect(res.data?.isPhrase).toBe(false);
    expect(res.data?.keywords ?? []).toHaveLength(0);
  });

  it('翻译返回逐段对齐的 segments，且覆盖原文', async () => {
    const res = await mockAIService.translate.queryTranslate('Hello world', 'en', 'zh', 'casual');
    const segs = res.data?.segments ?? [];
    expect(segs.length).toBeGreaterThan(0);
    expect(segs.map((s: { source: string }) => s.source).join('')).toBe('Hello world');
    expect(res.data?.sourceLang).toBe('en');
    expect(res.data?.targetLang).toBe('zh');
  });
});
