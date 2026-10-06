import { getCurrentStrings } from '../i18n/strings';
import { getStoredLanguage } from '../hooks/useLanguageStore';
import type { DictionaryQueryResponse, SentenceResult, DocResult } from '../types';

/**
 * 查词 / 查句 / 文档三类结果的**纯文本序列化**。
 *
 * **为什么放 utils 而不是各组件内拼字符串**：
 * 词条结果有三个出口 —— 页面上「复制」、导出 txt、收藏详情里的导出/复制。
 * 三处各拼一次的结果必然漂移（加一个字段要改三处，忘一处就"某入口缺内容"）。
 * 出口口径必须一致，这是本项目反复出现的 bug 类型（见 docs/issues.md）。
 *
 * 与知识笔记的区别：那边数据是结构化的（`GeneratedKnowledge`），走
 * `generateKnowledgeNote` 的三格式分支；这边是平铺的结果对象，
 * 只需要一份可读文本，不需要 html/docx 结构。
 */

const ts = () => {
  const lang = getStoredLanguage();
  return new Date().toLocaleString(lang === 'zh' ? 'zh-CN' : undefined);
};

const footer = () => {
  const s = getCurrentStrings();
  return `\n\n---\n${s.exportNote.exportedAt}: ${ts()}\n${s.exportNote.source}: ${s.app.brand}`;
};

/** 把可能为 undefined 的数组安全拼成顿号串 */
const joinTerms = (list?: string[] | null): string =>
  (list ?? []).filter(Boolean).join('、');

/**
 * 词条 → 纯文本。
 *
 * 覆盖页面上**能看到的每一个字段**（释义、例句、关键词、同反义词、关联术语、
 * 常用搭配、词性标签、词源、注册域）—— 缺一条就是"导出比页面少一块"。
 */
export function serializeWordResult(result: DictionaryQueryResponse): string {
  const s = getCurrentStrings();
  const lines: string[] = [`# ${result.word}`];

  if (result.phonetic) lines.push(`/${result.phonetic}/`);
  if (result.isPhrase) lines.push(`(${s.translate.phraseBadge})`);

  if (result.definitions.length > 0) {
    lines.push('', `## ${s.favorites.definition}`);
    result.definitions.forEach((def, i) => {
      // 词性可能为空（AI 未给或未收录的词），此时不能输出 `[]` ——
      // 方括号会让"释义正文"看起来像被什么东西包着，可读性更差
      const pos = def.pos ? `[${def.pos}] ` : '';
      lines.push(`${i + 1}. ${pos}${def.meaning}`);
      if (def.example?.en) {
        lines.push(`   ${def.example.en}`);
        if (def.example.zh) lines.push(`   ${def.example.zh}`);
      }
    });
  }

  if (result.keywords && result.keywords.length > 0) {
    lines.push('', `## ${s.translate.keywords}`);
    result.keywords.forEach((k) => {
      lines.push(`- ${k.term}${k.definition ? `（${k.definition}）` : ''}`);
    });
  }

  // synonyms / antonyms 这两个 key 本身就带冒号（'Synonyms:'），别再补一个
  if (result.synonyms && result.synonyms.length > 0) {
    lines.push('', `${s.translate.synonyms} ${joinTerms(result.synonyms)}`);
  }
  if (result.antonyms && result.antonyms.length > 0) {
    lines.push('', `${s.translate.antonyms} ${joinTerms(result.antonyms)}`);
  }
  // 这三个带"（点击查词）"后缀，直接当标题用会让导出文件出现 UI 提示语
  if (result.relatedTerms && result.relatedTerms.length > 0) {
    lines.push('', `${s.favorites.relatedTerms}: ${joinTerms(result.relatedTerms)}`);
  }
  if (result.collocations && result.collocations.length > 0) {
    lines.push('', `${s.favorites.commonCollocations}: ${joinTerms(result.collocations)}`);
  }
  if (result.register) {
    lines.push('', `${s.translate.register}: ${result.register}`);
  }
  if (result.etymology) {
    lines.push('', `${s.translate.etymology}: ${result.etymology}`);
  }

  return lines.join('\n') + footer();
}

/**
 * 查句结果 → 纯文本（原文 + 译文对照 + 关键词 + 语法说明 + 风格）。
 *
 * `includeMeta` 控制风格与页脚是否写出：复制时只要内容本身，
 * 导出文件才需要"这是哪个风格生成的 / 什么时候导的"。
 */
export function serializeSentenceResult(result: SentenceResult, includeMeta = true): string {
  const s = getCurrentStrings();
  const lines: string[] = [
    `${s.translate.original}: ${result.original}`,
    `${s.translate.translated}: ${result.translation}`,
  ];

  if (result.keywords && result.keywords.length > 0) {
    lines.push(
      `${s.translate.keywords}: ` +
        result.keywords.map((k) => (k.definition ? `${k.term}（${k.definition}）` : k.term)).join('、')
    );
  }
  if (result.grammarNotes && result.grammarNotes.length > 0) {
    lines.push(`${s.translate.grammarNote}:`);
    result.grammarNotes.forEach((g) => lines.push(`- ${g}`));
  }
  if (result.relatedTerms && result.relatedTerms.length > 0) {
    lines.push(`${s.translate.relatedTermsSearch}: ${joinTerms(result.relatedTerms)}`);
  }
  if (includeMeta) {
    lines.push(`${s.translate.exportStyle}: ${result.style}`);
  }

  const body = lines.join('\n');
  return includeMeta ? body + footer() : body;
}

/**
 * 文档 → 纯文本。
 *
 * 正文是 Markdown 源码，这里**原样保留**而不是剥标记：这是用户自己（或AI）
 * 产出的内容，导出通道不该替他改写。需要排版结果走 docx / html。
 */
export function serializeDocumentResult(result: Pick<DocResult, 'title' | 'content'>): string {
  return `# ${result.title}\n\n${result.content}` + footer();
}

/** 问答对话 → 纯文本 / Markdown（`md=true` 时加粗 Q/A 前缀） */
export function serializeQA(
  messages: { role: string; content: string }[],
  md = false
): string {
  const s = getCurrentStrings();
  const body = messages
    .map((msg) => {
      const prefix = msg.role === 'user' ? 'Q' : 'A';
      return md ? `**${prefix}:** ${msg.content}` : `${prefix}: ${msg.content}`;
    })
    .join('\n\n');
  return md ? body + `\n\n---\n*${s.exportNote.exportedAt}: ${ts()} | ${s.exportNote.source}: ${s.app.brand}*` : body;
}