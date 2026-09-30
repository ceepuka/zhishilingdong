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

  it('翻译返回带 key 的对照项，两侧片段都能在原串 / 译串里找到', async () => {
    const res = await mockAIService.translate.queryTranslate('Hello world', 'en', 'zh', 'casual');
    const segs = res.data?.segments ?? [];
    const original = res.data?.original ?? '';
    const translation = res.data?.translation ?? '';

    expect(segs.length).toBeGreaterThan(0);
    for (const seg of segs) {
      // key 从 1 起的正整数 —— 前端完全靠它配对，所以必须存在且可用
      expect(Number.isInteger(seg.key) && (seg.key as number) > 0).toBe(true);
      // 两侧片段都是各自原串的子串，前端才能定位出高亮区间
      expect(original.includes(seg.source)).toBe(true);
      expect(translation.includes(seg.target)).toBe(true);
    }
    expect(res.data?.sourceLang).toBe('en');
    expect(res.data?.targetLang).toBe('zh');
  });
});
