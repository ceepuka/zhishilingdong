/**
 * 生成中断归因类型定义在 types/ai.ts（服务层/状态机/UI 共用同一套语义），
 * 这里显式引入 —— 注意底部 `export * from './ai'` 只做再导出，
 * **不会**把名字带进本文件的局部作用域。
 */
import type { GenerationInterruption, KeywordEntry } from './ai';

export type TabType = 'search' | 'translate' | 'doc' | 'favorites';

export type KnowledgeType = 'concept' | 'process' | 'formula' | 'timeline' | 'compare' | 'hierarchy' | 'theorem';
export type KnowledgeStage = 'basic' | 'advanced';

export interface KnowledgeNode {
  id: string;
  title: string;
  type: KnowledgeType;
  stage: KnowledgeStage;
  category: string;
  definition: string;
  points: string[];
  examples: string[];
  relatedIds: string[];
  explanation: {
    basic: string;
    advanced: string;
    difference: string;
  };
}

export interface ConceptCardData {
  type: 'concept';
  title: string;
  category?: string;
  tags?: string[];
  definition: string;
  points: string[];
  example: string;
}

export interface ProcessStep {
  name: string;
  desc: string;
}

export interface ProcessCardData {
  type: 'process';
  title: string;
  category?: string;
  tags?: string[];
  steps: ProcessStep[];
}

export interface FormulaCardData {
  type: 'formula';
  title: string;
  category?: string;
  tags?: string[];
  formula: string;
  description: string;
}

export interface TimelineEvent {
  time: string;
  event: string;
}

export interface TimelineCardData {
  type: 'timeline';
  title: string;
  category?: string;
  tags?: string[];
  events: TimelineEvent[];
}

export interface CompareItem {
  [key: string]: string;
}

export interface CompareCardData {
  type: 'compare';
  title: string;
  category?: string;
  tags?: string[];
  items: CompareItem[];
  columns: string[];
}

export interface TreeNode {
  name: string;
  children: TreeNode[];
}

export interface HierarchyCardData {
  type: 'hierarchy';
  title: string;
  category?: string;
  tags?: string[];
  tree: TreeNode[];
}

export type KnowledgeCardData =
  | ConceptCardData
  | ProcessCardData
  | FormulaCardData
  | TimelineCardData
  | CompareCardData
  | HierarchyCardData;

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface QASession {
  id: string;
  messages: ChatMessage[];
  timestamp: number;
}

/** 语言类型统一由 i18n/languages 维护，这里做一次转发，方便业务层从 types 引入 */
export type { LanguageCode, SourceLanguageCode } from '../i18n/languages';

export interface WordDefinition {
  pos: string;
  meaning: string;
  example?: {
    en: string;
    zh: string;
  };
}

export interface WordResult {
  word: string;
  /** 是否为短语/多词查询 */
  isPhrase?: boolean;
  phonetic: string;
  definitions: WordDefinition[];
  /** 短语/多词查询时 AI 分析出的关键词（最多 10 个），带释义、可点击继续查词 */
  keywords?: KeywordEntry[];
  synonyms?: string[];
  antonyms?: string[];
  relatedTerms?: string[];
  collocations?: string[];
  register?: string;
  etymology?: string;
  /**
   * 词条配图：AI 给出的**可靠来源**图片直链（词条配图多为实物/概念图，是真实独立图片，
   * 比知识概念好解决得多）。拿不到时由生图服务兜底（可选）。
   */
  image?: string;
  /** 配图检索关键词（用于生图服务/图库兜底，语言由 AI 决定） */
  imageQuery?: string;
  /** 结果可能不完整（续写次数用尽仍未补全），UI 在内容末尾提示 */
  truncated?: boolean;
  /** 本次生成触发过自动续写/重发 */
  continued?: boolean;
  /** 中断归因（模型输出上限 / 网络中断 / 超时 / 安全策略…） */
  interruption?: GenerationInterruption;
}

export type TranslateStyle = 'academic' | 'business' | 'casual';
export type TranslateMode = 'dictionary' | 'translate';

export interface RelatedKnowledgeCard {
  title: string;
  description: string;
  tags: string[];
}

export interface SentenceResult {
  original: string;
  translation: string;
  style: TranslateStyle;
  /** 源语言 code（如 en），用于朗读与语言标注 */
  sourceLang?: string;
  /** 目标语言 code（如 zh） */
  targetLang?: string;
  /** 原文↔译文对照项（key 由 AI 按原文顺序填写），用于"选词标记的实时映射" */
  segments?: { key?: number; source: string; target: string }[];
  relatedTerms?: string[];
  /** 句子里的关键词，带释义、可点击继续查词 */
  keywords?: KeywordEntry[];
  grammarNotes?: string[];
  /** 结果可能不完整（续写次数用尽仍未补全），UI 在内容末尾提示 */
  truncated?: boolean;
  /** 本次生成触发过自动续写/重发 */
  continued?: boolean;
  /** 中断归因（模型输出上限 / 网络中断 / 超时 / 安全策略…） */
  interruption?: GenerationInterruption;
}

export type DocType = 'general' | 'email' | 'report' | 'meeting' | 'ppt' | 'notes' | 'contract' | 'resume' | 'press' | 'proposal' | 'weekly';
export type EmailTone = 'formal' | 'friendly' | 'concise';

export interface DocResult {
  type: DocType;
  title: string;
  content: string;
  tone?: EmailTone;
  /** 正文是否被中断（未完整生成） */
  truncated?: boolean;
  /** 是否触发过自动续写/重发 */
  continued?: boolean;
  /** 中断归因（模型输出上限 / 网络中断 / 超时 / 安全策略…） */
  interruption?: GenerationInterruption;
}

export interface FavoriteItem {
  id: string;
  type: 'knowledge' | 'dictionary' | 'translation' | 'document';
  data: unknown;
  label: string;
  timestamp: number;
  spaceId?: string;
}

export interface FavoriteSpace {
  id: string;
  name: string;
  color: string;
  icon: string;
  createdAt: number;
}

export interface SearchHistoryData {
  result?: KnowledgeCardData;
  generatedData?: GeneratedKnowledge;
  messages?: ChatMessage[];
}

export interface DictHistoryData {
  result: WordResult;
}

export interface TranslateHistoryData {
  result: SentenceResult;
}

export interface DocHistoryData {
  result: DocResult;
}

export type HistoryData = QASession | SearchHistoryData | DictHistoryData | TranslateHistoryData | DocHistoryData;

export interface HistoryItem {
  id: string;
  type: 'search' | 'qa' | 'dictionary' | 'translate' | 'doc';
  query: string;
  /** 创建时刻（不再参与排序与显示） */
  timestamp: number;
  /**
   * 最后浏览时刻：创建时初始化为创建时刻；此后只在"浏览中"消失的那一刻
   * 由 HistorySidebar 统一登记（切换记录 / 清空内容 / 卸载切页，唯一入口）。
   * 历史列表的显示时间与排序都以它为准：显示 = now - lastViewedAt。
   * 旧数据（无此字段）在 HistoryContext 加载时一次性转换为 lastViewedAt = timestamp。
   */
  lastViewedAt: number;
  data?: HistoryData;
}

export type NodeLevel = 'root' | 'branch' | 'subBranch' | 'leaf';

export interface MindMapNode {
  id: string;
  title: string;
  level: NodeLevel;
  description?: string;
  children?: MindMapNode[];
}

export interface Concept {
  type: 'definition' | 'formula' | 'theorem' | 'principle';
  title: string;
  content: {
    elementary: string;
    advanced: string;
  };
  notation?: string;
  /** 权威图片直链：任何**可靠来源**都可以 —— 教材出版社官网、维基百科/Commons、可汗学院、官方题库、大学开放课程等 */
  image?: string;
  /** AI 手绘 SVG 兜底：仅在拿不到权威图时使用（需要模型具备画图能力，不是所有模型都行） */
  svg?: string;
  /**
   * 图片数据直出（base64 data URL，如 `data:image/png;base64,...`）。
   * 知识类示意图多是富文本混排、拿不到独立图片直链 —— 让**具备识图画图能力的多模态模型**
   * 直接把图片数据塞进这个字段，程序端统一渲染，从根本上解决"无图"问题。
   * 与 image/svg 互斥：优先级 image > imageData > imageQuery 检索 > svg。
   */
  imageData?: string;
  /**
   * 配图检索关键词（用于图库兜底检索）。
   * 由 AI 自己决定用什么语言、什么词：
   *   - 概念源自国外 / 权威资料是英文 → 填英文关键词（"Newton's second law"）
   *   - 概念源自国内 / 权威资料是中文 → 填中文关键词（"牛顿第二定律"）
   * 留空则跳过图库检索。
   */
  imageQuery?: string;
  /** 关键要点：3~4 条，帮读者快速抓住这个概念的重点 */
  keyPoints?: string[];
  /** 易错提醒：1~2 条常见误区/踩坑点 */
  pitfalls?: string[];
  example?: string;
}

export interface Example {
  title: string;
  description: string;
  formula?: string;
  steps?: string[];
  result: string;
}

/** 易混辨析：一个容易和本主题混淆的概念，以及怎么区分 */
export interface KnowledgeContextConfusable {
  /** 易混概念名 */
  topic: string;
  /** 与本主题的核心区别（一句话说清） */
  difference: string;
}

export interface KnowledgeContext {
  prerequisites: string[];
  relatedTopics: string[];
  learningPath: string[];
  commonConclusions?: string[];
  /** 易混辨析：1~2 条，帮助划清边界 */
  confusables?: KnowledgeContextConfusable[];
}

export interface ExamQuestion {
  id: string;
  type: 'choice' | 'fill' | 'calculation' | 'essay';
  question: string;
  /** 真题配图直链（仅接受可信图源白名单，渲染失败会自动隐藏） */
  image?: string;
  /** 试题配图的图片数据直填（base64 data URL）：富文本内嵌图"直接提取源数据"的通道 */
  imageData?: string;
  /** AI 直接给出的 SVG 示意图源码（几何题配图/受力分析/电路等） */
  svg?: string;
  options?: string[];
  answer: string;
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard';
  source: {
    year: string;
    exam: string;
    section?: string;
  };
}

export interface InterestingFact {
  id: string;
  title: string;
  content: string;
  type: 'story' | 'application' | 'history' | 'fun';
}

export interface GeneratedKnowledge {
  topic: string;
  summary?: string;
  /** 核心概念区块的总述：渲染在「核心概念」标题下、各概念卡片之前，是核心概念的一部分 */
  conceptsOverview?: string;
  mindMap: MindMapNode[];
  concepts: Concept[];
  examples: Example[];
  relatedResults: KnowledgeCardData[];
  knowledgeContext: KnowledgeContext;
  examQuestions: ExamQuestion[];
  interestingFacts: InterestingFact[];
  /**
   * 输出是否因模型 max_tokens 上限被截断（finish_reason === 'length'）。
   * true 表示最后一个区块内容不完整，UI 需明确提示，不能让半截内容伪装成完整结果。
   */
  truncated?: boolean;
  /** 是否触发过"超限自动续写"（系统在模型一次没写完时自动接着写） */
  continued?: boolean;
  /** 中断归因（为什么没生成完）：模型输出上限 / 网络中断 / 超时 / 安全策略 / 静默截断… */
  interruption?: GenerationInterruption;
}

export interface ScopeTag {
  id: string;
  category: string;
  label: string;
  description: string;
}

export * from './ai';
