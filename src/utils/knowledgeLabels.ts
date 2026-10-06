import type { Strings } from '../i18n/strings';

/**
 * 知识内容的枚举值 → 展示文案。
 *
 * **为什么独立成模块**：这三个 label 至少被两处出口消费 ——
 * 页面上（`components/knowledge/KnowledgeContentView`）和导出时（`utils/export.ts`）。
 * 之前它们定义在组件文件里，工具层要用就得从 `.tsx` 反向 import，
 * 于是各写一份映射 —— 结果是页面上写「简答题」而导出里写「简答」这类漂移。
 * 放到 utils 下，页面与导出共用同一份，**枚举文案只有一个来源**。
 *
 * 全部是纯函数 + 显式传 `s`（不引useStrings），这样非 React 环境也能调。
 */

export function conceptTypeLabel(s: Strings, t: string): string {
  return t === 'definition' ? s.search.concept.typeDefinition
    : t === 'formula' ? s.search.concept.typeFormula
    : t === 'theorem' ? s.search.concept.typeTheorem
    : s.search.concept.typePrinciple;
}

export function examTypeLabel(s: Strings, t: string): string {
  return t === 'choice' ? s.search.question.typeChoice
    : t === 'fill' ? s.search.question.typeFill
    : t === 'calculation' ? s.search.question.typeCalculation
    : s.search.question.typeEssay;
}

export function difficultyLabel(s: Strings, d: string): string {
  return d === 'easy' ? s.search.question.difficultyEasy
    : d === 'medium' ? s.search.question.difficultyMedium
    : s.search.question.difficultyHard;
}

export function factTypeLabel(s: Strings, t: string): string {
  return t === 'story' ? s.search.fact.typeStory
    : t === 'application' ? s.search.fact.typeApplication
    : t === 'history' ? s.search.fact.typeHistory
    : s.search.fact.typeInteresting;
}