import { describe, it, expect } from 'vitest';
import { generateKnowledgeNote } from '../export';
import type { GeneratedKnowledge } from '../../types';

/**
 * 知识笔记导出回归。
 *
 * 背景：概览（summary）原先只出现在「复制」生成的 Markdown 里，导出文件
 * （txt / md / html 三种格式）整段没有它 —— 同一份内容的两个出口口径不一致，
 * 用户会认为"导出丢了内容"。本文件锁住"概览三个格式都必须有"。
 */

const base = (): GeneratedKnowledge => ({
  topic: '牛顿第二定律',
  summary: '合力 $F=ma$ 决定加速度',
  mindMap: [],
  concepts: [],
  examples: [],
  relatedResults: [],
  knowledgeContext: { prerequisites: [], relatedTopics: [], learningPath: [] },
  examQuestions: [],
  interestingFacts: [],
});

describe('知识笔记导出 — 概览（summary）不得丢失', () => {
  it('txt / md / html 三种格式都包含概览', () => {
    const { txt, md, html } = generateKnowledgeNote(base());

    expect(txt).toContain('合力 $F=ma$ 决定加速度');
    expect(md).toContain('合力 $F=ma$ 决定加速度');
    expect(html).toContain('合力 $F=ma$ 决定加速度');
  });

  it('概览排在标题之后（作为引导段，而不是混在末尾）', () => {
    const { md } = generateKnowledgeNote(base());

    expect(md.indexOf('# 牛顿第二定律')).toBeLessThan(md.indexOf('合力 $F=ma$ 决定加速度'));
  });

  it('没有概览时不产出 undefined 字样', () => {
    const { txt, md, html } = generateKnowledgeNote({ ...base(), summary: undefined });

    expect(txt).not.toContain('undefined');
    expect(md).not.toContain('undefined');
    expect(html).not.toContain('undefined');
  });
});
