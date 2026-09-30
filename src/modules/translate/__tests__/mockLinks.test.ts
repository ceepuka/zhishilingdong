import { describe, it, expect, vi, afterAll } from 'vitest';
import { mockAIService } from '../../../services/mockAIService';
import { mockWordResult } from '../mockData';

/**
 * Mock 的演示动作几乎全是"点一下某个词"（关联术语 / 常用搭配 / 关键词）。
 * 这些目标词必须**点下去就有内容** —— 落到空词条在演示里等于断链。
 *
 * 这条测试是全量守卫：以后往词条里加 relatedTerms / collocations 时，
 * 只要新词不在词表也不在兜底词表里，这里立刻会红。
 */
describe('Mock 可点击目标全部有内容', () => {
  vi.useFakeTimers();
  afterAll(() => vi.useRealTimers());

  it('每个可点词查下去都不会只剩「暂无该单词的释义」', async () => {
    const targets = new Set<string>();
    for (const entry of Object.values(mockWordResult)) {
      for (const t of entry.relatedTerms ?? []) targets.add(t);
      for (const t of entry.collocations ?? []) targets.add(t);
      for (const k of entry.keywords ?? []) targets.add(k.term);
    }
    expect(targets.size).toBeGreaterThan(300);

    const dead: string[] = [];
    for (const term of targets) {
      // mock 内部是 delay(300)：用假时钟跳过等待，否则 300+ 次查询要跑几分钟
      const pending = mockAIService.translate.queryWord(term, 'en', 'zh');
      await vi.advanceTimersByTimeAsync(400);
      const res = await pending;
      const meanings = (res.data?.definitions ?? []).map((d) => d.meaning);
      if (meanings.every((m) => !m || m.includes('暂无该单词的释义'))) dead.push(term);
    }

    expect(dead).toEqual([]);
  });

  it('词素也查不到时如实返回「暂无」，不编造释义', async () => {
    const pending = mockAIService.translate.queryWord('zzzqxv', 'en', 'zh');
    await vi.advanceTimersByTimeAsync(400);
    const res = await pending;

    expect(res.data?.definitions?.[0]?.meaning).toContain('暂无该单词的释义');
  });

  it('未收录但有可解释词素时给降级拆解释义（并标注是 Demo 降级）', async () => {
    const pending = mockAIService.translate.queryWord('quantum mechanics', 'en', 'zh');
    await vi.advanceTimersByTimeAsync(400);
    const res = await pending;
    const meaning = res.data?.definitions?.[0]?.meaning ?? '';

    expect(meaning).not.toContain('暂无该单词的释义');
    expect(meaning).toContain('量子');
    expect(meaning).toContain('Demo 数据未收录');
  });
});
