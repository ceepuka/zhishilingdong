import { KnowledgeCardData, MindMapNode, Concept, Example, KnowledgeType, TranslateStyle, EmailTone, DocType, KnowledgeContext, ExamQuestion, InterestingFact } from './index';

export interface AIResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: AIError;
  metadata?: AIMetadata;
}

export interface AIError {
  code: string;
  message: string;
  retryable: boolean;
}

/**
 * 生成中断归因（分类模型定义这里，服务层/状态机/UI 共用同一套语义）。
 * 详细分类说明见 `services/streaming/interruption.ts`。
 */
export type InterruptionKind =
  | 'length'
  | 'content_filter'
  | 'incomplete'
  | 'timeout'
  | 'network'
  | 'protocol'
  | 'http'
  | 'aborted'
  | 'parse';

/** 中断归属方：模型侧 / 链路侧 / 内容侧 / 用户侧 */
export type InterruptionSide = 'model' | 'link' | 'content' | 'user';

export interface GenerationInterruption {
  kind: InterruptionKind;
  /** 归因方，UI 据此决定文案档次与配色 */
  side: InterruptionSide;
  /** 标准错误码（与 AIError.code 一致） */
  code: string;
  /** 是否值得用户手动重试 */
  retryable: boolean;
  /** 发起过的 HTTP 请求次数（含续写/重发） */
  attempts?: number;
  /** 是否触发过续写/重发（attempts > 1） */
  continued?: boolean;
  /** 中断最终是否被续写补全 */
  resolved: boolean;
  /** 原始技术细节（诊断用，不直接展示） */
  detail?: string;
  /** HTTP 状态码（kind='http' 时） */
  httpStatus?: number;
}

export interface AIMetadata {
  latency: number;
  /** 具体模型 ID（如 glm-4.7-flash / qwen3.7-plus） */
  model: string;
  tokenUsage: {
    prompt: number;
    completion: number;
    total: number;
  };
}

export interface SearchValidateResponse {
  valid: boolean;
  suggestions?: string[];
  reason?: string;
}

export interface SearchAnalyzeResponse {
  isSpecific: boolean;
  isKnowledgePoint: boolean;
  canonicalTopic: string;
  topic?: string;
  category?: string;
  knowledgeType?: KnowledgeType;
  graphData?: KnowledgeGraphNode[];
}

export interface KnowledgeGraphNode {
  id: string;
  title: string;
  type: KnowledgeType;
  topic?: string;
  /** 该节点所属学科（如"物理""化学""数学"），供分类驱动生成提示词；子节点可继承父节点的学科 */
  category?: string;
  children?: KnowledgeGraphNode[];
}

export interface SearchGenerateResponse {
  topic: string;
  summary?: string;
  /** 核心概念区块的总述（渲染在「核心概念」标题下、概念卡片之前） */
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
   * true 表示最后一个区块（通常是趣味知识）内容不完整，UI 需要明确提示用户，
   * 不能让半截内容伪装成完整结果。
   */
  truncated?: boolean;
  /**
   * 是否触发过"超限自动续写"（模型一次没写完、系统自动接着写）。
   * 仅用于 UI 提示，不影响数据本身。
   */
  continued?: boolean;
  /**
   * 中断归因：**为什么**没生成完（模型输出上限 / 网络中断 / 超时 / 被安全策略拦截 / 网关静默截断…）。
   *
   * `truncated` 只能回答"是否不完整"，回答不了"为什么"——把它们混为一谈会让 UI
   * 把网络中断误报成"模型输出上限被截断"。UI 应按此字段分档提示（见 GenerationNotice）。
   */
  interruption?: GenerationInterruption;
}

export interface FollowupMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * 流式生成过程中吐出的一份"可渲染快照"。
 * AI 写入共享缓冲区，渲染侧按自己的节奏读取这个结构。
 */
export interface StreamSnapshot<T> {
  /** 当前已生成的部分数据（已过清洗器，可安全渲染） */
  data: T;
  /** 整段 JSON 是否已完整闭合 */
  complete: boolean;
  /** 已完整闭合的顶层字段名（UI 用来收骨架屏） */
  completedKeys: string[];
}

/** 流式文本增量（追问 / 文档等纯文本场景） */
export interface StreamTextDelta {
  text: string;
  complete: boolean;
}

export interface SearchFollowupResponse {
  reply: string;
  relatedKnowledge?: KnowledgeCardData[];
}

export interface TranslateDetectResponse {
  /** 检测出的源语言（语言 code，如 zh / en / fr） */
  sourceLang: string;
  /** 输入是否属于短语/多词（而非单个词），供查词模块决定是否给出关键词 */
  isPhrase: boolean;
  confidence: number;
}

/**
 * 译文对照项（用于"选词标记的实时映射"）。
 *
 * `key` 是 AI 按**原文出现顺序**填的对照编号（1、2、3…），同一组对照两侧同键。
 * 它是唯一的配对依据 —— 不同语言语序可以相反（Good morning → 早上好，
 * Good 对应译文末尾的「好」），按下标或字符位置配对都会错。
 * 不便于对照的片段 AI 就不放进数组（= 无键，界面上不高亮）。
 */
export interface TranslationSegment {
  key?: number;
  /** 原文片段（词 / 词组 / 短语） */
  source: string;
  /** 与 source 同键的译文片段 */
  target: string;
}

export interface DictionaryQueryResponse {
  word: string;
  /** 输入是否为短语/多词 */
  isPhrase?: boolean;
  phonetic: string;
  definitions: {
    pos: string;
    meaning: string;
    example?: {
      en: string;
      zh: string;
    };
  }[];
  /** 短语/多词查询时，AI 分析出的关键词（最多 10 个），可点击继续查词 */
  keywords?: string[];
  synonyms?: string[];
  antonyms?: string[];
  relatedTerms?: string[];
  collocations?: string[];
  register?: string;
  etymology?: string;
  /** 词条配图：AI 给出的可靠来源图片直链 */
  image?: string;
  /** 配图检索关键词（供生图服务/图库兜底，语言由 AI 决定） */
  imageQuery?: string;
}

export interface TranslateQueryResponse {
  original: string;
  translation: string;
  style: TranslateStyle;
  /** 源语言 code（便于朗读/展示） */
  sourceLang?: string;
  /** 目标语言 code */
  targetLang?: string;
  /** 逐段对齐，用于原文↔译文选词实时映射 */
  segments?: TranslationSegment[];
  relatedTerms?: string[];
  keywords?: string[];
  grammarNotes?: string[];
}

export interface DocumentGenerateResponse {
  type: DocType;
  title: string;
  content: string;
  tone?: EmailTone;
  /** 正文是否被中断（未完整生成） */
  truncated?: boolean;
  /** 是否触发过自动续写/重发 */
  continued?: boolean;
  /** 中断归因（同 SearchGenerateResponse.interruption） */
  interruption?: GenerationInterruption;
}

export type ExportFormat = 'txt' | 'md' | 'pdf';

export interface DocumentExportResponse {
  blob: Blob;
  filename: string;
  format: ExportFormat;
}

/**
 * 流式方法说明：
 *   所有 *Stream 方法都在一次调用内完成（不拆成多次 fetch），
 *   通过 onPartial / onDelta 回调把增量推给渲染层。
 *   不支持流式的厂商会自动降级为一次性返回，签名与行为保持不变。
 */
export interface AIService {
  search: {
    validate(input: string): Promise<AIResponse<SearchValidateResponse>>;
    analyze(input: string): Promise<AIResponse<SearchAnalyzeResponse>>;
    generate(topic: string, context?: SearchAnalyzeResponse): Promise<AIResponse<SearchGenerateResponse>>;
    /** 流式生成：一次调用，边生成边回调可渲染快照 */
    generateStream(
      topic: string,
      onPartial: (snapshot: StreamSnapshot<SearchGenerateResponse>) => void,
      signal?: AbortSignal,
      /** 思维链增量回调（可选）：思考中的模型先输出 reasoning，用它在 UI 上显示"模型思考中" */
      onReasoning?: (chunk: string) => void,
      /** 分类上下文（学科 category + 知识形态 knowledgeType），用于按学科定制生成提示词 */
      context?: SearchAnalyzeResponse
    ): Promise<AIResponse<SearchGenerateResponse>>;
    followup(topic: string, question: string, history: FollowupMessage[], mode?: 'search' | 'qa'): Promise<AIResponse<SearchFollowupResponse>>;
    /** 流式追问：逐字回调 reply */
    followupStream(
      topic: string,
      question: string,
      history: FollowupMessage[],
      mode: 'search' | 'qa' | undefined,
      onDelta: (partial: { reply: string; complete: boolean }) => void,
      signal?: AbortSignal
    ): Promise<AIResponse<SearchFollowupResponse>>;
  };
  translate: {
    detect(text: string): Promise<AIResponse<TranslateDetectResponse>>;
    queryWord(word: string, sourceLang: string, targetLang: string): Promise<AIResponse<DictionaryQueryResponse>>;
    queryTranslate(text: string, sourceLang: string, targetLang: string, style?: TranslateStyle): Promise<AIResponse<TranslateQueryResponse>>;
  };
  document: {
    generate(type: DocType, topic: string, requirements?: string, tone?: EmailTone): Promise<AIResponse<DocumentGenerateResponse>>;
    /** 流式文档生成：markdown 正文边生成边回调 */
    generateStream(
      type: DocType,
      topic: string,
      requirements: string | undefined,
      tone: EmailTone | undefined,
      onPartial: (partial: Partial<DocumentGenerateResponse> & { complete: boolean }) => void,
      signal?: AbortSignal
    ): Promise<AIResponse<DocumentGenerateResponse>>;
    export(content: string, format: ExportFormat, metadata?: { title: string }): Promise<AIResponse<DocumentExportResponse>>;
  };
}