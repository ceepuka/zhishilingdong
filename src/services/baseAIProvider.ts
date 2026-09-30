/**
 * BaseAIProvider —— 所有模型厂商的抽象基类
 * ------------------------------------------------------------------
 * 职责：
 *   1. 统一 HTTP 调用（chat completions）
 *   2. 统一 API Key / 模型 / Base URL 读取（从 useAIConfig 的存储层直接读）
 *   3. 统一错误响应映射（401/429/quota → AIError 标准化）
 *   4. 复用 jsonRepair 4 层 JSON 解析修复
 *   5. 复用 withFallback 包装器 + successResponse / sanitizeMindMap
 *
 * 子类只需实现：
   *   - abstract getProviderId(): string
   *   - getDepthConfig(depth): { temperature, max_tokens }    （可选覆盖）
   *   - mapErrorResponse(raw): AIError                          （可选覆盖，归一化错误体）
   *   - getSystemPromptPrefix(): string                          （可选覆盖，中文助手前缀）
 */

import type {
  AIService, AIResponse, AIError,
  SearchValidateResponse, SearchAnalyzeResponse, SearchGenerateResponse,
  SearchFollowupResponse, StreamSnapshot,
  TranslateDetectResponse, DictionaryQueryResponse, TranslateQueryResponse,
  DocumentGenerateResponse, ExportFormat, TranslateStyle, EmailTone, DocType,
  FollowupMessage, MindMapNode, NodeLevel, KnowledgeGraphNode, KnowledgeType,
  Concept, KnowledgeContext, ExamQuestion, InterestingFact,
} from '../types';
import type { AIDepth, ProviderConfig } from '../types/aiProviders';
import {
  getProviderInfo,
  resolveActiveModelId,
  resolveBaseUrl,
  getModelCapabilities,
  type ModelCapabilities,
} from '../types/aiProviders';
import { getStoredAIConfig } from '../hooks/useAIConfigStore';
import { getAIContentLanguage } from '../hooks/useLanguageStore';
import { languageEnglish, normalizeLanguage, type LanguageCode } from '../i18n/languages';
import { parseJSONResponse } from '../utils/jsonRepair';
import { sanitizeInlineSvg } from '../utils/inlineSvg';
import { readSSEStream, StreamProtocolError, StreamTimeoutError, StreamNetworkError, StreamAbortedError } from './streaming/sseReader';
import { StreamingJSONParser, isCompleteJSON, analyzeJSON } from './streaming/partialJSON';
import {
  classifyThrown,
  canContinueAfter,
  createInterruption,
  kindFromFinishReason,
  GenerationInterruptedError,
  type GenerationInterruption,
  type InterruptionKind,
} from './streaming/interruption';

/**
 * 关闭思考模式的参数，按厂商分派（不同厂商的关闭参数名完全不同，传错会 400）。
 *
 * 背景：思考型模型（智谱 GLM-5.x、千问 Qwen3.x、Kimi K3 等）默认开启"思维链"，
 * 会先输出大段 reasoning_content 再给正文。思维链会**吃掉 max_tokens 预算**——本项目
 * 要的是结构化 JSON 的快速流式呈现，思维链收益远小于代价（首字延迟几十秒 + 正文被截断）。
 * 因此显式关闭思考。
 *
 * 各厂商正确的关闭参数（实测核对）：
 *   - 千问(dashscope) / 硅基(siliconflow)：`enable_thinking: false`
 *   - 智谱(zhipu)：`thinking: { type: 'disabled' }`（⚠️ 传 `thinking: false` 会 400，
 *     正确值是对象 `{type:'disabled'}`；GLM-5.3 起强制思考、关不掉，但 5.2/5.1 可关）
 *   - DeepSeek：`reasoning_effort: 'none'`（v4 系列默认非思考，显式关闭更稳）
 */
const DISABLE_THINKING_PARAMS: Record<string, Record<string, unknown>> = {
  dashscope: { enable_thinking: false },
  siliconflow: { enable_thinking: false },
  zhipu: { thinking: { type: 'disabled' } },
};

// ============== 输出超限：自动续写（最多 MAX_GENERATION_ATTEMPTS 次）==============

/**
 * 单次生成最多尝试次数：首轮 1 次 + 自动续写 ≤ 2 次。
 * 输出被 max_tokens 截断（finish_reason === 'length'）或 JSON 未闭合时，
 * 会把已生成内容回填给模型要求"接着写"，直到完整或达到次数上限。
 */
export const MAX_GENERATION_ATTEMPTS = 3;

/**
 * 单轮流式调用的返回值。
 * finishReason 必须带出来 —— 它决定中断归因（length / content_filter / 静默截断）。
 */
interface StreamRoundResult {
  content: string;
  model: string;
  latencyMs: number;
  streamed: boolean;
  truncated: boolean;
  /** 服务端给出的结束原因（'length' / 'content_filter' / 'stop' / undefined） */
  finishReason?: string;
}

/** 续写循环的最终结果（含中断归因，供 UI 与状态机使用） */
export interface ContinuationResult {
  content: string;
  model: string;
  latencyMs: number;
  streamed: boolean;
  /** 达到次数上限后仍不完整（或中断后无法续写） */
  truncated: boolean;
  /** 实际发起的 HTTP 请求次数 */
  attempts: number;
  /** 是否触发过续写/重发（attempts > 1） */
  continued: boolean;
  /** 发生过中断才有值；resolved=true 表示最终已被续写补全 */
  interruption?: GenerationInterruption;
}

/**
 * 流式首字节超时（毫秒）。
 *
 * 背景：fetch 拿到响应后，服务端可能在"已建立连接但迟迟不发任何字节"的状态挂很久
 * （网关缓冲、排队、被服务端静默切断等）。如果不限时，UI 会卡在"模型思考中…已等待 X 秒"
 * 永远不下去 —— 511 秒、几分钟甚至更长。超过该时长仍没收到**任何**字节（正文或思维链）
 * 就主动 abort 上抛 StreamTimeoutError，让 UI 友好提示"等待响应超时"。
 *
 * 默认 60s：思考型模型首字节常见 10~30s，60s 已足够宽裕；超过 60s 基本属于链路异常。
 * 已收到至少一个字节后不再计时，避免误杀慢速流。
 */
export const FIRST_BYTE_TIMEOUT_MS = 60_000;

/**
 * search.generateStream 续写判定所需的「核心必出字段」。
 *
 * 续写不仅要判断"JSON 括号闭合"，还要判断"核心字段是否都出齐"——否则模型可能
 * 输出一个括号闭合、但缺末尾区块（如 interestingFacts / examQuestions）的 JSON 就收尾，
 * 若只判括号闭合会跳过续写 → 内容悄悄不完整。
 *
 * 用"核心字段集"而非"全部字段"：`summary` / `conceptsOverview` / `examples` /
 * `relatedResults` 是可选项或可为空，模型漏了它们不应触发续写（否则会耗满次数空转）。
 */
const REQUIRED_GENERATE_KEYS = ['mindMap', 'concepts', 'knowledgeContext', 'examQuestions', 'interestingFacts'];

/**
 * 构造 search.generateStream 的续写完整性判定：括号闭合 + 核心字段齐全。
 * 复用 partialJSON 的 analyzeJSON（权威解析），不再另写括号配对逻辑。
 */
export function buildGenerateCompleteChecker() {
  return (accumulated: string): boolean => {
    const analyzed = analyzeJSON(accumulated);
    if (!analyzed) return false;             // 还没有 JSON 起始符
    if (!analyzed.complete) return false;    // 括号未闭合 → 肯定没写完
    // 括号闭合了，再校验核心字段是否齐全
    return REQUIRED_GENERATE_KEYS.every((k) => analyzed.completedKeys.includes(k));
  };
}

/** 续写时最多回填的"已生成内容"字符数，避免 prompt 过大拖慢首字 */
const CONTINUATION_CONTEXT_LIMIT = 12000;

/**
 * 严格判断文本里是否已出现一个"完整闭合的顶层 JSON 对象"。
 *
 * 与 parseJSONResponse 的关键区别：这里**不做任何修复**。
 * 否则被 max_tokens 截断的 JSON 会被 repairTruncatedJSON 补成合法 JSON，
 * 让"没写完就续写"这条链路被悄悄跳过。
 *
 * 实现上复用 StreamingJSONParser 的 `isCompleteJSON`（权威判定）——它同时正确追踪
 * `{}` 与 `[]` 嵌套、字符串转义、markdown 围栏剥离，避免另写一套括号配对逻辑导致
 * 两套判定漂移（曾出现"只判 `{}` 漏判 `[]`，`{"a":[1,2}` 被误判完整"的边界漏洞）。
 */
export function hasCompleteJSONObject(raw: string): boolean {
  return isCompleteJSON(raw);
}

/** 按字符集粗略推断源语言（AI 检测失败时的兜底） */
function inferSourceLangByScript(text: string): LanguageCode {
  const t = (text || '').trim();
  if (/[\u4e00-\u9fff]/.test(t)) return 'zh';
  if (/[\u3040-\u30ff]/.test(t)) return 'ja';
  if (/[\uac00-\ud7af]/.test(t)) return 'ko';
  if (/[\u0600-\u06ff]/.test(t)) return 'ar';
  if (/[\u0e00-\u0e7f]/.test(t)) return 'th';
  if (/[\u0900-\u097f]/.test(t)) return 'hi';
  if (/[\u0400-\u04ff]/.test(t)) return 'ru';
  return 'en';
}

/** 粗略判断是否短语/多词（AI 判定缺失时兜底） */
function defaultIsPhrase(text: string): boolean {
  const t = (text || '').trim();
  if (!t) return false;
  if (/[\u4e00-\u9fff]/.test(t)) return t.length > 2;
  return /\s/.test(t);
}

/** 翻译风格 → 中文描述（注入 prompt） */
const TRANSLATE_STYLE_LABELS: Record<TranslateStyle, string> = {
  academic: '学术严谨（术语准确、书面语）',
  business: '商务正式（专业、得体）',
  casual: '日常口语（自然、地道）',
};

// ============== 公共：思维导图清洗 ==============

function sanitizeMindMapNode(node: any, level: NodeLevel, depth: number, idPrefix: string): MindMapNode {
  const hasChildren = Array.isArray(node.children) && node.children.length > 0;
  const isLeaf = !hasChildren || depth >= 4;
  const safeId = String(node.id || '').replace(/[^a-zA-Z0-9_-]/g, '');
  const uniqueId = safeId ? `${idPrefix}-${safeId}` : `${idPrefix}-n${Math.random().toString(36).slice(2, 6)}`;
  if (isLeaf) {
    return {
      id: uniqueId,
      title: String(node.title || '未命名'),
      level: 'leaf',
      description: node.description ? String(node.description) : undefined,
    };
  }
  let childLevel: NodeLevel;
  if (level === 'root') childLevel = 'branch';
  else if (level === 'branch') childLevel = 'subBranch';
  else childLevel = 'leaf';
  return {
    id: uniqueId,
    title: String(node.title || '未命名'),
    level,
    description: undefined,
    children: node.children.map((c: any, i: number) =>
      sanitizeMindMapNode(c, childLevel, depth + 1, `${uniqueId}-${i + 1}`)
    ),
  };
}

export function sanitizeMindMap(nodes: any[], topic: string): MindMapNode[] {
  if (!Array.isArray(nodes) || nodes.length === 0) return [];
  const numLevelToNodeLevel = (lvl: any): NodeLevel => {
    if (typeof lvl === 'string') {
      if (lvl === 'root' || lvl === 'branch' || lvl === 'subBranch' || lvl === 'leaf') return lvl;
    }
    const num = Number(lvl);
    if (num <= 1) return 'root';
    if (num === 2) return 'branch';
    if (num === 3) return 'subBranch';
    return 'leaf';
  };
  const hasRoot = nodes.length === 1 && (
    nodes[0].level === 'root' || nodes[0].level === 1 || nodes[0].title === topic
  );
  if (hasRoot) return [sanitizeMindMapNode(nodes[0], 'root', 0, 'r')];
  const root: MindMapNode = {
    id: 'root',
    title: topic,
    level: 'root',
    description: undefined,
    children: nodes.map((n, i) => {
      const lvl = numLevelToNodeLevel(n.level);
      const childLevel = lvl === 'root' ? 'branch' : (lvl === 'branch' ? 'subBranch' : 'leaf');
      return sanitizeMindMapNode(n, childLevel === 'branch' ? 'branch' : childLevel, 1, `r-b${i + 1}`);
    }),
  };
  return [root];
}

/**
 * 知识图谱数据清洗（analyze 阶段 isSpecific=false 时产出）。
 * 真实 AI 返回的 graphData 结构不可信：缺 category、type 非法、id 缺失、title 非字符串、
 * children 非数组等都要归一化；节点 category 缺失时从父节点继承（保证每个节点都能拿到学科）。
 */
export function sanitizeGraphData(raw: any): KnowledgeGraphNode[] {
  if (!Array.isArray(raw) || raw.length === 0) return [];
  const VALID_TYPES: KnowledgeType[] = ['concept', 'process', 'formula', 'timeline', 'compare', 'hierarchy', 'theorem'];

  const clean = (node: any, inheritedCategory: string | undefined, depth: number): KnowledgeGraphNode | null => {
    if (!node || typeof node !== 'object') return null;
    const title = asStr(node.title ?? node.name);
    if (!title) return null;
    const type: KnowledgeType = VALID_TYPES.includes(node.type) ? node.type : 'concept';
    // 节点自带 category 优先；缺失则继承父节点（根节点缺 category 用 title 兜底）
    const category = asStr(node.category) || inheritedCategory || (depth === 0 ? title : '');
    const id = asStr(node.id) || `${depth === 0 ? 'root' : 'node'}-${title}`;
    const topic = asStr(node.topic || node.canonicalTopic);
    const children = Array.isArray(node.children)
      ? node.children.map((c: any) => clean(c, category || inheritedCategory, depth + 1)).filter((c: KnowledgeGraphNode | null): c is KnowledgeGraphNode => c !== null)
      : [];
    return { id, title, type, category, topic: topic || undefined, children };
  };

  return raw.map((n: any) => clean(n, undefined, 0)).filter((n: KnowledgeGraphNode | null): n is KnowledgeGraphNode => n !== null);
}

// ============== 公共：生成数据清洗（真实 AI 返回格式不可信，统一归一化）==============

const asStr = (v: any): string => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '');

/** 对照键：只认 > 0 的整数，其余（缺失 / 0 / 字符串数字之外）一律 0 = 无键 */
const asKey = (v: any): number => {
  const n = typeof v === 'number' ? v : parseInt(String(v ?? ''), 10);
  return Number.isInteger(n) && n > 0 ? n : 0;
};

/**
/**
 * 图片 URL 校验（**严格白名单**）。
 *
 * 痛点：AI 给的图链大量是「看着像图片、实际打开 403/防盗链」的 URL
 * （如百度 ?source=1、CSDN/CSDN博客中转、知乎/公众号转存等），
 * 这些 URL 通过普通的 http(s) 校验却无法被 <img> 加载，UI 全是破图占位。
 *
 * 「换个思路」：放弃让 AI 凭空给图，改为只信任**可外链的可靠图床**。
 * 任何不在白名单的 URL 一律丢弃（落空），由 commons 兜底搜索。
 * 真实 AI 不擅长给图，与其要求它给（白熊效应 → 给假链），
 * 不如直接用图库检索拿真图。
 */
const TRUSTED_IMAGE_HOSTS = [
  // Wikimedia 全家（教材/百科配图最稳的来源；Special:FilePath 也走 upload.wikimedia.org）
  'upload.wikimedia.org',
  'commons.wikimedia.org',
  'upload.wikimedia.com', // 极少用，留作兜底
  // 可汗学院
  'cdn.kastatic.org',
  'kasandbox.org',
  'khanacademy.org',
  // Unsplash
  'images.unsplash.com',
  // GitHub raw
  'raw.githubusercontent.com',
  'user-images.githubusercontent.com',
  '*.githubusercontent.com',
  // 谷歌
  'lh3.googleusercontent.com',
  'lh4.googleusercontent.com',
  'lh5.googleusercontent.com',
  'lh6.googleusercontent.com',
  '*.googleusercontent.com',
  '*.gstatic.com',
  // jsDelivr (npm 图)
  'cdn.jsdelivr.net',
  // 一些大学/政府站
  'math.mit.edu',
  'ocw.mit.edu',
  '*.ocw.mit.edu',
];

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|avif|bmp|tif?f)$/i;

function isTrustedImageHost(host: string): boolean {
  const h = host.toLowerCase();
  for (const t of TRUSTED_IMAGE_HOSTS) {
    if (t.startsWith('*.')) {
      if (h.endsWith(t.slice(2)) || h === t.slice(2)) return true;
    } else if (h === t) {
      return true;
    }
  }
  return false;
}

const isImageURL = (s: string): boolean => {
  const v = (s || '').trim();
  if (!v) return false;
  // 内联图（极少见；svg 走 svg 字段，这里只放行栅格）
  if (/^data:image\/(png|jpe?g|gif|webp|avif);/i.test(v)) return true;
  // 仅信任 https（http 大图床几乎都强制 https 了）
  if (!/^https:\/\//i.test(v)) return false;
  let url: URL;
  try { url = new URL(v); } catch { return false; }
  if (!isTrustedImageHost(url.hostname)) {
    // 兜底：非白名单域，但路径是已知图片扩展名且无 query（直链文件）→ 放行
    // （Baidu 之类 ?source=1 / ?token= / ?from= 的防盗链 URL 会在这里被拒）
    if (url.search === '' && IMAGE_EXT.test(url.pathname)) return true;
    return false;
  }
  // 白名单域名也要排除可疑的防盗链 query（?source= ?token= ?sign= ?from= ?referer=）
  const params = url.searchParams;
  for (const key of params.keys()) {
    const k = key.toLowerCase();
    if (k === 'source' || k === 'token' || k === 'sign' || k === 'from' || k === 'referer') return false;
  }
  return true;
};

/** 图片数据直出（base64 data URL）校验：多模态模型把图片数据塞进字段的场景 */
const isDataImageURL = (s: string): boolean => {
  const v = (s || '').trim();
  if (!v) return false;
  // 只放行常见栅格图 base64，限制体积上限（约 4MB）防恶意/异常大字段
  if (!/^data:image\/(png|jpe?g|gif|webp);base64,/i.test(v)) return false;
  return v.length < 4_000_000;
};


/** 把数组或顿号/逗号分隔的字符串归一为 string[] */
export function toStringList(v: any): string[] {
  if (Array.isArray(v)) return v.map(asStr).map((s) => s.trim()).filter(Boolean);
  const s = asStr(v);
  if (!s) return [];
  return s.split(/[、,，;；\n]+/).map((x) => x.trim()).filter(Boolean);
}

/** 概念归一化：兼容 content 为字符串/缺省/平铺字段、条目为纯字符串等真实 AI 常见偏差 */
export function sanitizeConcepts(raw: any): Concept[] {
  if (!Array.isArray(raw)) return [];
  const out: Concept[] = [];
  for (const item of raw) {
    if (typeof item === 'string') {
      const title = item.trim();
      if (title) out.push({ type: 'definition', title, content: { elementary: title, advanced: title } });
      continue;
    }
    if (!item || typeof item !== 'object') continue;
    const title = asStr(item.title ?? item.name).trim();
    if (!title) continue;

    let elementary = '';
    let advanced = '';
    const content = item.content;
    if (typeof content === 'string') {
      // content 是字符串 → 两层解释同文
      elementary = advanced = content.trim();
    } else if (content && typeof content === 'object') {
      elementary = asStr(content.elementary ?? content.basic ?? content.simple).trim();
      advanced = asStr(content.advanced ?? content.detail ?? content.detailed).trim();
    }
    // 兼容平铺在概念对象上的两层解释
    if (!elementary && !advanced) {
      elementary = asStr(item.elementary ?? item.basic).trim();
      advanced = asStr(item.advanced ?? item.detail).trim();
    }
    if (!elementary && advanced) elementary = advanced;
    if (!advanced && elementary) advanced = elementary;

    const typeRaw = asStr(item.type);
    const type = (['definition', 'formula', 'theorem', 'principle'].includes(typeRaw) ? typeRaw : 'definition') as Concept['type'];
    const image = asStr(item.image);
    const imageData = asStr(item.imageData ?? item.image_data ?? item.imageBase64);
    // 关键要点 / 易错提醒：模型可能用 points、misconceptions 等别名，统一归一为字符串数组
    const keyPoints = toStringList(item.keyPoints ?? item.points ?? item.key_points);
    const pitfalls = toStringList(item.pitfalls ?? item.misconceptions ?? item.commonMistakes);
    out.push({
      type,
      title,
      content: { elementary, advanced },
      notation: asStr(item.notation) || undefined,
      image: isImageURL(image) ? image : undefined,
      // 多模态模型直出的图片数据（base64 data URL），承载"富文本拿不到直链"的场景
      imageData: isDataImageURL(imageData) ? imageData : undefined,
      svg: sanitizeInlineSvg(item.svg),
      // 配图检索关键词：语言由 AI 决定（中文词走中文源、英文词走 Commons）
      imageQuery: asStr(item.imageQuery ?? item.image_query ?? item.imageSearch ?? item.pictureQuery).trim() || undefined,
      keyPoints: keyPoints.length > 0 ? keyPoints : undefined,
      pitfalls: pitfalls.length > 0 ? pitfalls : undefined,
      example: asStr(item.example) || undefined,
    });
  }
  return out;
}

/** 知识脉络归一化：字段可能是逗号分隔字符串而非数组 */
export function sanitizeKnowledgeContext(raw: any): KnowledgeContext {
  const base: KnowledgeContext = { prerequisites: [], relatedTopics: [], learningPath: [] };
  if (!raw || typeof raw !== 'object') return base;
  // 易混辨析：数组元素可能是 {topic, difference} 对象，也可能是 "概念：区别" 这样的字符串
  const confusables = Array.isArray(raw.confusables)
    ? raw.confusables
        .map((c: any) => {
          if (typeof c === 'string') {
            const idx = c.search(/[：:]/);
            if (idx === -1) return null;
            return { topic: c.slice(0, idx).trim(), difference: c.slice(idx + 1).trim() };
          }
          if (!c || typeof c !== 'object') return null;
          const topic = asStr(c.topic ?? c.name ?? c.title).trim();
          const difference = asStr(c.difference ?? c.distinction ?? c.desc).trim();
          return topic && difference ? { topic, difference } : null;
        })
        .filter(Boolean)
    : undefined;
  return {
    prerequisites: toStringList(raw.prerequisites),
    relatedTopics: toStringList(raw.relatedTopics),
    learningPath: toStringList(raw.learningPath),
    commonConclusions: raw.commonConclusions === undefined ? undefined : toStringList(raw.commonConclusions),
    confusables: confusables && confusables.length > 0 ? confusables : undefined,
  };
}

/**
 * 题型别名 → 标准枚举。
 * 真实模型经常返回中文（"选择题""单选"）或变体（"single_choice"），
 * 旧的严格白名单会把它们全部降级成 essay，导致选择题丢选项、填空题没空位。
 */
const EXAM_TYPE_ALIASES: Record<string, ExamQuestion['type']> = {
  // 选择题
  choice: 'choice', single: 'choice', singlechoice: 'choice', 'single-choice': 'choice',
  'single_choice': 'choice', multi: 'choice', multiple: 'choice', 'multiple-choice': 'choice',
  '选择题': 'choice', '单选': 'choice', '单选题': 'choice', '多选': 'choice', '多选题': 'choice',
  '不定项': 'choice', '不定项选择题': 'choice', '客观题': 'choice',
  // 填空题
  fill: 'fill', blank: 'fill', 'fill-in': 'fill', 'fill_blank': 'fill', 'fill-in-the-blank': 'fill',
  '填空题': 'fill', '填空': 'fill', '完形填空': 'fill',
  // 计算题
  calculation: 'calculation', calc: 'calculation', compute: 'calculation',
  '计算题': 'calculation', '计算': 'calculation', '应用题': 'calculation',
  // 问答/解答/证明
  essay: 'essay', qa: 'essay', short: 'essay', 'short-answer': 'essay', proof: 'essay',
  '问答题': 'essay', '解答题': 'essay', '简答': 'essay', '简答题': 'essay',
  '证明题': 'essay', '证明': 'essay', '论述题': 'essay', '开放题': 'essay',
};

/** 难度别名 → 标准枚举 */
const DIFFICULTY_ALIASES: Record<string, ExamQuestion['difficulty']> = {
  easy: 'easy', simple: 'easy', basic: 'easy', '简单': 'easy', '基础': 'easy', '容易': 'easy', '低': 'easy',
  medium: 'medium', middle: 'medium', normal: 'medium', '中等': 'medium', '一般': 'medium', '中': 'medium',
  hard: 'hard', difficult: 'hard', '困难': 'hard', '难': 'hard', '高': 'hard', '较难': 'hard',
};

function normalizeTypeToken(raw: string): string {
  return raw.trim().toLowerCase().replace(/[\s_]/g, '');
}

/** 题干中的"空位"特征：____、（  ）、［ ］ 等 */
const BLANK_PATTERN = /_{3,}|＿{2,}|\[\s{2,}\]|［\s{2,}］|（\s{2,}）|\(\s{2,}\)|\{\s{2,}\}/;

/**
 * 从一段文本里按 A. B. C. D. 标号切出选项。
 * 要求至少 2 个标号且字母连续递增，避免把题干里的单个字母误判成选项。
 */
function splitOptionBlob(text: string): string[] {
  if (!text) return [];
  const re = /(?:^|[\s\n，,;；])([A-Ha-h])[\.、．:：\)）]\s*/g;
  const marks: { start: number; end: number; letter: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    marks.push({ start: m.index, end: m.index + m[0].length, letter: m[1].toUpperCase() });
  }
  if (marks.length < 2) return [];

  // 字母必须连续递增：A,B,C,D（允许多选从任意字母起，但必须连续）
  let sequential = true;
  for (let i = 1; i < marks.length; i++) {
    if (marks[i].letter.charCodeAt(0) !== marks[i - 1].letter.charCodeAt(0) + 1) { sequential = false; break; }
  }
  if (!sequential) return [];

  const out = marks.map((mk, i) => {
    const stop = i + 1 < marks.length ? marks[i + 1].start : text.length;
    return text.slice(mk.end, stop).trim();
  });
  return out.filter(Boolean);
}

/** 去掉选项文本自带的 "A." / "B、" 前缀（UI 会单独渲染字母徽章，避免 A. A. xxx） */
function stripOptionPrefix(s: string): string {
  return s.replace(/^\s*[A-Ha-h]\s*[\.、．:：\)）]\s*/, '').trim();
}

/**
 * 选项归一化。真实返回形态极多：
 *   ["xxx","yyy"]                      标准
 *   ["A. xxx","B. yyy"]                带前缀
 *   {A:"xxx", B:"yyy"}                 对象
 *   {options:[...]}                    嵌套
 *   "A．xxx B．yyy C．zzz"              一整串
 */
function normalizeOptions(raw: any): string[] {
  let list: string[] = [];

  if (Array.isArray(raw)) {
    list = raw.map((v) => {
      if (v && typeof v === 'object') return asStr((v as any).text ?? (v as any).content ?? (v as any).value ?? (v as any).label);
      return asStr(v);
    });
  } else if (raw && typeof raw === 'object') {
    if (Array.isArray((raw as any).options)) return normalizeOptions((raw as any).options);
    list = Object.entries(raw).map(([k, v]) => {
      const val = v && typeof v === 'object'
        ? asStr((v as any).text ?? (v as any).content ?? (v as any).value)
        : asStr(v);
      return /^[A-Ha-h]$/.test(k.trim()) ? val : `${k}. ${val}`;
    });
  } else if (typeof raw === 'string') {
    list = splitOptionBlob(raw);
    if (list.length === 0) list = raw.split(/\n+/).map((s) => s.trim()).filter(Boolean);
  }

  list = list.map(stripOptionPrefix).filter(Boolean);

  // 只有一项但内部其实塞了整串选项 → 再拆一次
  if (list.length < 2 && list[0]) {
    const inner = splitOptionBlob(list[0]);
    if (inner.length >= 2) list = inner.map(stripOptionPrefix).filter(Boolean);
  }
  return list;
}

/**
 * 选择题答案归一化：尽量收敛成选项字母（"B"），
 * 便于 UI 高亮正确项；无法判断时原样保留。
 */
function normalizeChoiceAnswer(answer: string, options: string[]): string {
  const trimmed = (answer || '').trim();
  if (!trimmed || options.length === 0) return trimmed;

  // 短答案里能读到明确字母：B / 选B / 答案：B / （B）
  if (trimmed.length <= 16) {
    const m = trimmed.match(/(?:^|[^A-Za-z])([A-Ha-h])(?:$|[^A-Za-z])/);
    if (m) return m[1].toUpperCase();
  }
  // 长答案：按内容匹配到某个选项 → 还原成字母
  const idx = options.findIndex((o) => o && o.length >= 2 && trimmed.includes(o));
  if (idx >= 0) return String.fromCharCode(65 + idx);
  return trimmed;
}

/** 答案可能是数组（填空题多空 / 多选题），拼成可读字符串 */
function normalizeAnswer(raw: any): string {
  if (Array.isArray(raw)) {
    return raw.map((v) => (v && typeof v === 'object' ? asStr((v as any).text ?? (v as any).value) : asStr(v)))
      .map((s) => s.trim()).filter(Boolean).join('；');
  }
  if (raw && typeof raw === 'object') {
    return asStr((raw as any).text ?? (raw as any).value ?? (raw as any).answer);
  }
  return asStr(raw);
}

/** 依据题干/选项反推题型（模型没给或给了非法值时兜底） */
function inferType(question: string, options: string[]): ExamQuestion['type'] {
  if (options.length >= 2) return 'choice';
  if (BLANK_PATTERN.test(question)) return 'fill';
  // 计算题：出现"求/计算/解得…"且题干带数字（数字常在"求"之前，不能只往后找）
  if (/(计算|求解|求|算出|解得|为多少|等于多少)/.test(question) && /\d/.test(question)) return 'calculation';
  return 'essay';
}

/**
 * 试题归一化。
 *
 * 相比旧版解决的问题：
 *   1. 题型支持中文/英文别名，不再一律降级成 essay
 *   2. 题型缺失时按"有无选项 / 有无空位 / 是否计算"反推
 *   3. 选项支持对象、整串、嵌套等多种形态，并剥掉自带字母前缀
 *   4. 选项写在题干里时，从题干切出选项并还原干净题干
 *   5. 选择题答案收敛为选项字母，UI 可高亮正确项
 *   6. 答案支持数组（填空多空、多选）
 *   7. 支持 svg 示意图（几何题配图）
 */
export function sanitizeExamQuestions(raw: any): ExamQuestion[] {
  if (!Array.isArray(raw)) return [];
  const out: ExamQuestion[] = [];
  for (let idx = 0; idx < raw.length; idx++) {
    const item = raw[idx];
    if (!item || typeof item !== 'object') continue;

    let question = asStr(item.question ?? item.title ?? item.stem ?? item.content).trim();
    if (!question) continue;

    let options = normalizeOptions(item.options);
    // 选项被塞进题干（常见于真实真题粘贴）：切出来并还原题干
    if (options.length < 2) {
      const fromStem = splitOptionBlob(question);
      if (fromStem.length >= 2) {
        options = fromStem.map(stripOptionPrefix).filter(Boolean);
        const firstMark = question.search(/(?:^|[\s\n，,;；])[A-Ha-h][\.、．:：\)）]/);
        if (firstMark > 0) question = question.slice(0, firstMark).trim();
      }
    }

    const typeRaw = asStr(item.type);
    let type: ExamQuestion['type'];
    const alias = EXAM_TYPE_ALIASES[typeRaw] ?? EXAM_TYPE_ALIASES[normalizeTypeToken(typeRaw)];
    if (alias) {
      type = alias;
    } else {
      type = inferType(question, options);
    }
    // 标了选择题却拿不出 ≥2 个选项 → 说明题型判定不可信，按内容重判
    if (type === 'choice' && options.length < 2) type = inferType(question, []);
    // 填空题不该有选项（有则多半是误标），保留题干空位语义
    if (type === 'fill' && options.length > 0 && !BLANK_PATTERN.test(question) && !/_{2,}/.test(question)) {
      type = options.length >= 2 ? 'choice' : type;
    }
    // 非选择题的 options 无意义，丢弃避免 UI 渲染出空壳选项区
    if (type !== 'choice') options = [];

    const diffRaw = asStr(item.difficulty);
    const difficulty = (DIFFICULTY_ALIASES[diffRaw] ?? DIFFICULTY_ALIASES[normalizeTypeToken(diffRaw)] ?? 'medium') as ExamQuestion['difficulty'];

    let answer = normalizeAnswer(item.answer ?? item.answers ?? item.result);
    if (type === 'choice') answer = normalizeChoiceAnswer(answer, options);

    const src = item.source && typeof item.source === 'object' ? item.source : {};
    const image = asStr(item.image);
    const imageData = asStr(item.imageData ?? item.image_data ?? item.imageBase64);
    out.push({
      id: asStr(item.id) || `q${idx + 1}`,
      type,
      question,
      image: isImageURL(image) ? image : undefined,
      // 试题配图"直接填数据"通道：富文本内嵌图（原图）比模型手绘更可靠
      imageData: isDataImageURL(imageData) ? imageData : undefined,
      svg: sanitizeInlineSvg(item.svg ?? item.diagram ?? item.figure),
      options: options.length > 0 ? options : undefined,
      answer,
      explanation: asStr(item.explanation ?? item.analysis ?? item.solution),
      difficulty,
      source: {
        year: asStr(src.year ?? src.Year),
        exam: asStr(src.exam ?? src.examName),
        section: asStr(src.section) || undefined,
      },
    });
  }
  return out;
}

/** 趣味知识归一化 */
export function sanitizeInterestingFacts(raw: any): InterestingFact[] {
  if (!Array.isArray(raw)) return [];
  const out: InterestingFact[] = [];
  let idx = 0;
  for (const item of raw) {
    if (typeof item === 'string') {
      const s = item.trim();
      if (s) out.push({ id: `f${++idx}`, title: s.slice(0, 30), content: s, type: 'story' });
      continue;
    }
    if (!item || typeof item !== 'object') continue;
    const content = asStr(item.content ?? item.description ?? item.text).trim();
    if (!content) continue;
    const typeRaw = asStr(item.type);
    const type = (['story', 'application', 'history', 'fun'].includes(typeRaw) ? typeRaw : 'story') as InterestingFact['type'];
    out.push({
      id: asStr(item.id) || `f${++idx}`,
      title: asStr(item.title).trim() || content.slice(0, 30),
      content,
      type,
    });
  }
  return out;
}

// ============== 公共：响应包装器 ==============

export function successResponse<T>(data: T): AIResponse<T> {
  return { success: true, data };
}

/** withFallback 的行为选项 */
export interface FallbackOptions {
  /**
   * 严格模式：**不再把异常吞成 success:true**。
   *
   * 默认（宽松）模式保留业务兜底：模型真的产不出结果时返回 fallback 空结构体，
   * 让 UI 有东西可渲染（如 mock 数据、模板正文）。
   *
   * 严格模式用于**内容生成类**调用（generate / generateStream）。原因：
   * 生成类调用把异常吞成"成功但空"后，状态机只能看到 success:true + 空数据，
   * 于是把已流出的部分内容丢弃、回 IDLE、显示出笼统的"生成失败"——
   * 用户既看不到已收到的内容，也看不到原因（"内容未完全生成就自动截止，且无任何提示"）。
   * 严格模式下异常统一转成 success:false + 标准 code，由上层决定展示部分内容还是错误。
   */
  strict?: boolean;
}

export function withFallback<T>(
  operation: (...args: any[]) => Promise<T>,
  fallback: T | ((args: any[]) => T),
  errorPrefix: string,
  options: FallbackOptions = {}
): (...args: any[]) => Promise<AIResponse<T>> {
  return async (...args: any[]) => {
    try {
      const result = await operation(...args);
      return successResponse(result);
    } catch (error) {
      if (error instanceof Error && error.message.includes('密钥未配置或已失效')) {
        return { success: false, error: { code: 'NO_API_KEY', message: error.message, retryable: false } } as AIResponse<T>;
      }
      // ---- 生成中断（链路/网络/模型/内容）一律**透传**，绝不吞成 fallback ----
      // 这些异常都带着明确的分类与标准 code（见 streaming/interruption.ts）：
      //   STREAM_TIMEOUT / STREAM_NETWORK / STREAM_PROTOCOL / STREAM_ABORTED
      //   OUTPUT_TRUNCATED / CONTENT_FILTERED / STREAM_INCOMPLETE / GENERATE_FAILED
      //   INVALID_API_KEY / QUOTA_EXCEEDED / RATE_LIMITED / SERVER_ERROR
      // 透传后 UI 才能显示**具体原因**（"网络中断"/"等待响应超时"/"密钥可能失效"），
      // 而不是笼统的"生成失败"；也避免"success:true + 空数据"把已收到内容挡在门外。
      if (isInterruptionError(error)) {
        const info = classifyThrown(error);
        console.error(`${errorPrefix} error (生成中断，透传 ${info.code}):`, error);
        return {
          success: false,
          error: { code: info.code, message: error instanceof Error ? error.message : info.code, retryable: info.retryable },
        } as AIResponse<T>;
      }
      if (options.strict) {
        // 严格模式：认不出的异常也不再伪装成功，交给上层展示真实原因
        const message = error instanceof Error ? error.message : String(error);
        console.error(`${errorPrefix} error (严格模式，不兜底):`, error);
        return {
          success: false,
          error: { code: 'GENERATE_FAILED', message, retryable: true },
        } as AIResponse<T>;
      }
      console.error(`${errorPrefix} error:`, error);
      const fallbackFn = fallback as (...args: any[]) => T;
      const fallbackValue = typeof fallback === 'function' ? fallbackFn(args) : (fallback as T);
      return successResponse(fallbackValue);
    }
  };
}

/** 该异常是否属于"生成中断"（分类模型能给出明确原因，必须透传而不是兜底） */
function isInterruptionError(error: unknown): boolean {
  return (
    error instanceof GenerationInterruptedError ||
    error instanceof StreamTimeoutError ||
    error instanceof StreamNetworkError ||
    error instanceof StreamProtocolError ||
    error instanceof StreamAbortedError ||
    // HTTP 错误（callModel/callModelStream 会把厂商错误挂在 aiError 上）
    typeof (error as { aiError?: unknown })?.aiError === 'object' &&
      (error as { aiError?: unknown }).aiError !== null
  );
}

// ============== 深度配置（默认）==============

type DepthConfig = { temperature: number; max_tokens: number };

/** prepareRequest 的返回值：额外带一份运行时元信息，供调用方判断能力裁剪结果 */
interface RequestMeta {
  /** 实际使用的模型 ID */
  model: string;
  /** 这次请求是否真的按流式发出（由型号静态能力声明决定） */
  streaming: boolean;
}

interface PreparedRequest {
  url: string;
  headers: Record<string, string>;
  payload: Record<string, unknown>;
  meta: RequestMeta;
}

// ============== BaseAIProvider 抽象基类 ==============

export abstract class BaseAIProvider {
  // -------- 子类必须实现 --------
  protected abstract getProviderId(): string;

  // -------- 子类可选覆盖 --------

  /**
   * 按深度 + 模型能力返回 temperature / max_tokens。
   *
   * 关键：max_tokens 必须夹在模型自身的输出上限内。超过上限时多数厂商会直接
   * 返回 400（而不是截断），导致这一整块内容全部丢失 —— 这是"生成经常失败"
   * 最隐蔽的一个来源。推理型模型还要额外留出思考 token 的预算。
   */
  protected getDepthConfig(depth: AIDepth, modelContextLength?: number, caps?: ModelCapabilities): DepthConfig {
    // 期望预算（按深度）。
    // 注意：本项目的 JSON 包含 summary + mindMap + conceptsOverview + 多个 concept（含 keyPoints/pitfalls）
    // + knowledgeContext（含 confusables） + examQuestions + interestingFacts，输出量很大。
    // 旧值（max=8192 / high=6144 / medium=2048）实测会让大多数旗舰模型在末尾区块（趣味知识）撞墙，
    // 表现为"卡文迪什…通过著名的"那种半句话截断 —— 现在已同时检测并提示截断（见 callModelWithJSON），
    // 这里把预算也提高一档，让截断更不容易发生。
    const base: Record<AIDepth, DepthConfig> = {
      max:    { temperature: 0.3, max_tokens: 16384 },
      high:   { temperature: 0.3, max_tokens: 12288 },
      medium: { temperature: 0.7, max_tokens: 4096 },
    };
    let cfg = base[depth];

    if (caps) {
      // 推理模型要把思考过程也装进去，预算不能压太狠
      const want = caps.reasoning ? Math.max(cfg.max_tokens, 8192) : cfg.max_tokens;
      cfg = { ...cfg, max_tokens: Math.min(want, caps.maxOutputTokens) };
    }

    if (modelContextLength && modelContextLength > 0) {
      // 按模型支持窗口的 40% 作为输出上限（保守，防止 OOM）
      const safeMax = Math.floor(modelContextLength * 0.4);
      return { ...cfg, max_tokens: Math.max(512, Math.min(cfg.max_tokens, safeMax)) };
    }
    return cfg;
  }

  /** 统一错误体归一化：子类可覆盖针对特定厂商的响应格式 */
  protected mapErrorResponse(raw: any, statusCode: number): AIError {
    // 尝试 OpenAI 标准格式
    const msg: string =
      raw?.error?.message ||
      raw?.message ||
      raw?.msg ||
      (typeof raw === 'string' ? raw : null) ||
      `HTTP ${statusCode}`;

    const code: string = String(raw?.error?.code || raw?.code || statusCode);

    // 常见语义匹配 -> 标准化 code + message
    const lowerMsg = msg.toLowerCase();
    if (
      statusCode === 401 ||
      lowerMsg.includes('invalid api key') ||
      lowerMsg.includes('invalid token') ||
      lowerMsg.includes('unauthorized') ||
      lowerMsg.includes('未授权')
    ) {
      return { code: 'INVALID_API_KEY', message: '密钥可能失效，请重新配置', retryable: false };
    }
    if (lowerMsg.includes('quota') || lowerMsg.includes('balance') || lowerMsg.includes('额度') || lowerMsg.includes('余额')) {
      return { code: 'QUOTA_EXCEEDED', message: '密钥余额不足，请充值后重试', retryable: false };
    }
    if (statusCode === 429 || lowerMsg.includes('rate limit') || lowerMsg.includes('限流')) {
      return { code: 'RATE_LIMITED', message: '请求过于频繁，请稍后重试', retryable: true };
    }
    if (statusCode >= 500 || lowerMsg.includes('server error') || lowerMsg.includes('内部错误')) {
      return { code: 'SERVER_ERROR', message: `模型服务异常：${msg}`, retryable: true };
    }
    return { code, message: msg, retryable: statusCode >= 500 || statusCode === 429 };
  }

  /** systemPrompt 前缀：部分模型中文能力弱时可加前缀 */
  protected getSystemPromptPrefix(): string { return ''; }

  /**
   * 「输出语言」指令：绑用户设置的语言。
   *
   * 用户语言默认取系统语言，存在 useLanguageStore 中；
   * 这里在每次组装 prompt 时实时读取，保证用户改了设置后立刻生效。
   */
  protected buildLanguageDirective(): string {
    const name = languageEnglish(getAIContentLanguage());
    return `\n\n【输出语言】用户语言为 ${name}。所有面向用户阅读的自然语言内容（标题、定义、解释、示例、要点、题干、说明等）都必须使用 ${name} 书写；JSON 的字段名与枚举值（如 type / difficulty / style 的取值）保持英文不变。`;
  }

  /** 文档类 systemPrompt（含输出语言约束） */
  protected buildDocSystemPrompt(): string {
    return '你是一个专业文档助手。请生成格式化的文档内容。' + this.buildLanguageDirective();
  }

  /**
   * 续写提示词：把已生成内容回填，要求模型"接着写、不重复"。
   * 对 JSON 同样适用（要求继续合法 JSON 并正确闭合）。
   *
   * 注意措辞：中断原因不止"达到长度上限"一种（还可能是链路中断后重试），
   * 所以这里**不写死**原因，只说"被中断"，避免给模型错误的上下文暗示。
   */
  protected buildJSONContinuationPrompt(partial: string): string {
    const tail = partial.length > CONTINUATION_CONTEXT_LIMIT
      ? partial.slice(-CONTINUATION_CONTEXT_LIMIT)
      : partial;
    return `你上一条回复在输出中途被中断，下面是已经输出的内容（可能不完整）：
<<<已生成内容开始
${tail}
已生成内容结束>>>

请【紧接着】上面的内容继续输出，把剩余部分补完，要求：
1. 只输出"续写部分"本身，一个字都不要重复已经出现过的内容，也**不得**推翻、改写或重新解释前面已经写好的结论——前面写什么，你就顺着往下接，把它补完整；
2. 不要添加任何解释、标题、过渡语、开场白或 markdown 代码块围栏，也**不得**插入与当前内容无关的新话题；
3. **必须**严格延续原有格式：前面是 JSON 就继续合法的 JSON 文本（注意正确闭合字符串、数组与花括号）；**不得**重新开始一个新的 JSON。`;
  }

  /**
   * 带去重续写的流式调用。
   *
   * 背景：生成结构化知识/文档的 JSON 体积大，一次写不完或中途断掉都很常见，
   * 旧实现只有"模型撞上 max_tokens"这一种情况会续写，**链路类中断（网络断开/超时/协议错）
   * 在首轮就直接抛错终止**，于是"内容没写完就截止，且没有任何提示"。
   *
   * 现在的策略 —— 中断分类驱动（详见 streaming/interruption.ts）：
   *   - 每一轮的文本增量都实时回调 onDelta（UI 无感地继续"长"出来）
   *   - 每轮结束后用 isComplete 判断是否已完整；未完整且中断**值得续写**就再发一轮
   *   - 续写轮把已生成内容回填（buildContinuePrompt）；若**一个字都没拿到**，
   *     说明没有可续写的上下文，改为按**原始 prompt** 重发一次（瞬时抖动可自愈）
   *   - 链路类中断（network/timeout/protocol）与模型超限一样会走续写，不再直接终止
   *   - 总请求数硬上限 maxAttempts（默认 3：首轮 + 至多 2 次续写/重发），绝不无限重试
   *
   * @returns truncated=true 表示达到次数上限后仍不完整；
   *          interruption 仅在"发生过中断"时存在（resolved=true 表示已被续写补全）
   */
  protected async callModelStreamWithContinuation(
    prompt: string,
    systemPrompt: string | undefined,
    depth: AIDepth,
    onDelta: (chunk: string) => void,
    signal: AbortSignal | undefined,
    isComplete: (accumulated: string) => boolean,
    buildContinuePrompt: (accumulated: string) => string,
    maxAttempts: number = MAX_GENERATION_ATTEMPTS,
    onReasoning?: (chunk: string) => void
  ): Promise<ContinuationResult> {
    const limit = Math.max(1, maxAttempts);
    let accumulated = '';
    let model = '';
    let latencyMs = 0;
    let streamed = false;
    let attempts = 0;
    /** 最近一次中断（决定最终给用户的提示档次） */
    let lastInterruption: GenerationInterruption | undefined;
    /** "一个字都没拿到"时的重发是否已用过（用户确认的边界：只允许 1 次） */
    let resendUsed = false;

    while (attempts < limit) {
      attempts++;
      // 注意语义：这是"本轮开始前"是否已有内容 —— 决定本轮用哪份 prompt
      // （有内容 → 回填续写；没内容 → 原始 prompt 重发），
      // 不要在 catch 里复用它判断"有没有内容可保留"（那时要用本轮结束后的量）。
      const hasPriorContent = accumulated.trim().length > 0;
      const usePrompt = hasPriorContent && attempts > 1 ? buildContinuePrompt(accumulated) : prompt;

      let res: StreamRoundResult;
      try {
        res = await this.callModelStream(
          usePrompt,
          systemPrompt,
          depth,
          (chunk) => {
            accumulated += chunk;
            onDelta(chunk);
          },
          signal,
          onReasoning
        );
      } catch (e) {
        // 用户取消：直接上抛，不做任何重试（不是故障）
        if (signal?.aborted) throw e;
        const info = classifyThrown(e);
        // 注意：必须用**本轮结束时**的累积量判断有没有内容，而不是循环开头那个快照。
        // 本轮可能已经吐了几千字符才断（"流到一半断掉"），用过期快照会导致
        // 明明有内容却被当成"什么都没有"直接上抛，把已收到的内容整段丢掉。
        const hasContentNow = accumulated.trim().length > 0;
        lastInterruption = { ...info, attempts, continued: attempts > 1, resolved: false };

        // 还能不能再来一轮？
        //   - 次数没耗尽
        //   - 该中断类型值得自动再试
        //   - 无内容时，重发只允许 1 次（避免网络彻底断掉时白等三轮）
        const canRetry =
          attempts < limit &&
          canContinueAfter(info.kind, { hasContent: hasContentNow, retryable: info.retryable }) &&
          (hasContentNow || !resendUsed);

        if (!canRetry) {
          // 一个字都没拿到 → 没有可展示的内容，异常上抛（withFallback 透传 code）
          if (!hasContentNow) throw e;
          // 已有内容 → 保留并结束（truncated=true + interruption 提示原因）
          break;
        }
        if (!hasContentNow) resendUsed = true;
        console.warn(
          `[stream] 第 ${attempts}/${limit} 轮中断（${info.kind}${info.detail ? `：${info.detail}` : ''}）→ ${hasContentNow ? '回填续写' : '原请求重发'}`
        );
        continue;
      }

      model = res.model || model;
      latencyMs += res.latencyMs;
      streamed = streamed || res.streamed;

      if (signal?.aborted) break;

      // 写完整了（括号闭合 + 核心字段齐全）→ 收工
      if (isComplete(accumulated)) break;

      // 没写完：归因（模型侧 length/content_filter，或网关静默截断）
      const kind: InterruptionKind = kindFromFinishReason(res.finishReason);
      const info = createInterruption(kind, { attempts, continued: attempts > 1 });
      lastInterruption = { ...info, resolved: false };

      // 续写轮没拿到任何新内容 → 再续也不会增长，提前结束，避免空转耗次数
      // （例如"只收到思维链、正文为空"的轮次）
      const noNewContent = !res.content.trim();
      const canContinue =
        attempts < limit &&
        canContinueAfter(kind, { hasContent: accumulated.trim().length > 0 }) &&
        !(attempts > 1 && noNewContent);

      if (!canContinue) break;
      // 本轮一个字都没拿到 → 下一轮是"原请求重发"（不是回填续写），记账以免重复重发
      if (!accumulated.trim()) resendUsed = true;
    }

    const complete = isComplete(accumulated);
    return {
      content: accumulated,
      model,
      latencyMs,
      streamed,
      truncated: !complete,
      attempts,
      continued: attempts > 1,
      // 发生过中断才带 interruption；resolved 表示最终被续写补全
      interruption: lastInterruption
        ? { ...lastInterruption, attempts, continued: attempts > 1, resolved: complete }
        : undefined,
    };
  }

  // -------- 核心：读当前 provider 的运行时配置 --------

  protected readOwnConfig(): ProviderConfig {
    const stored = getStoredAIConfig();
    return stored.providers[this.getProviderId()];
  }

  /** 读取 API Key；如未配置抛业务错误（withFallback 会捕获走 Mock） */
  protected requireApiKey(cfg: ProviderConfig): string {
    if (!cfg.apiKey || cfg.status !== 'valid') {
      throw new Error('密钥未配置或已失效');
    }
    return cfg.apiKey;
  }

  // -------- 核心：请求准备（流式与非流式共用）--------

  protected prepareRequest(
    prompt: string,
    systemPrompt?: string,
    depth: AIDepth = 'medium',
    stream = false
  ): PreparedRequest {
    const providerId = this.getProviderId();
    const root = getStoredAIConfig();
    const cfg = root.providers[providerId];
    const apiKey = this.requireApiKey(cfg);
    const baseUrl = resolveBaseUrl(providerId, cfg, root.customProviders);
    const model = resolveActiveModelId(providerId, root.activeModelId, cfg, root.customProviders);

    const messages: { role: string; content: string }[] = [];
    const sysPrefix = this.getSystemPromptPrefix();
    const finalSystem = (sysPrefix && systemPrompt)
      ? `${sysPrefix}\n${systemPrompt}`
      : (sysPrefix || systemPrompt);
    if (finalSystem) messages.push({ role: 'system', content: finalSystem });
    messages.push({ role: 'user', content: prompt });

    // 按 model 的 contextLength + 能力画像调参数
    // 注意：能力画像必须用**解析后实际发请求的 model** —— 用户 localStorage 里的
    // activeModelId 可能指向已被下架/改名的旧型号，此时能力要与回退后的型号一致
    const ctxLen = getProviderInfo(providerId, root.customProviders)?.models.find((m) => m.id === model)?.contextLength;
    const caps = getModelCapabilities(providerId, model, root.customProviders, cfg);
    const dcfg = this.getDepthConfig(depth, ctxLen, caps);

    // 流式：只看**静态能力声明**。型号配置里声明支持流式就发 stream:true，
    // 不再维护任何"运行时黑名单/自愈"猜测状态 —— 发出去的请求若拿不到增量，
    // 由 callModelStream 按真实链路状态诚实处理（返回已收内容 / 抛错）。
    const wantStream = stream && caps.streaming;

    // 输出预算字段名：OpenAI o 系列等推理模型只认 max_completion_tokens
    const tokenParam = caps.maxTokensParam ?? 'max_tokens';

    const payload: Record<string, unknown> = {
      model,
      messages,
      // 推理型模型会忽略甚至拒绝 temperature，直接不发
      ...(caps.reasoning ? {} : { temperature: dcfg.temperature }),
      [tokenParam]: dcfg.max_tokens,
    };

    // JSON 强约束：仅在模型明确支持时开启（不支持的厂商会 400）
    if (caps.jsonMode && this.useJsonMode()) {
      payload.response_format = { type: 'json_object' };
    }

    if (wantStream) payload.stream = true;

    // 关闭思考模式：思考型模型默认开启思维链，会先吐大段 reasoning_content 再给正文，
    // 既拖慢首字、又吃掉 max_tokens 预算导致正文 JSON 被截断（"生成失败"的隐蔽来源）。
    // 本项目要的是结构化知识的快速流式呈现，思考收益远小于等待成本。
    // 参数按厂商分派（见 DISABLE_THINKING_PARAMS）——避免严格网关因未知字段直接 400。
    const disableThinking = DISABLE_THINKING_PARAMS[providerId];
    if (disableThinking) {
      Object.assign(payload, disableThinking);
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      // 流式响应必须显式声明，否则部分网关会做缓冲
      'Accept': wantStream ? 'text/event-stream' : 'application/json',
    };

    return {
      url: baseUrl,
      headers,
      payload,
      meta: { model, streaming: wantStream },
    };
  }

  /** 是否启用 response_format:{type:'json_object'}。子类可按厂商特性关闭 */
  protected useJsonMode(): boolean {
    return true;
  }

  // -------- 核心：callModel（chat completions HTTP 调用）--------

  protected async callModel(
    prompt: string,
    systemPrompt?: string,
    depth: AIDepth = 'medium',
    signal?: AbortSignal
  ): Promise<{ content: string; model: string; latencyMs: number; truncated: boolean; finishReason?: string }> {
    const { url, headers, payload } = this.prepareRequest(prompt, systemPrompt, depth, false);

    const startedAt = Date.now();
    const resp = await this.fetchOrThrow(url, { method: 'POST', headers, body: JSON.stringify(payload), signal });

    const latencyMs = Date.now() - startedAt;

    if (!resp.ok) {
      let raw: any = {};
      try { raw = await resp.json(); } catch { /* ignore */ }
      const aiErr = this.mapErrorResponse(raw, resp.status);
      // 把错误消息抛为 Error，让 withFallback 捕获
      const e = new Error(aiErr.message);
      (e as any).aiCode = aiErr.code;
      (e as any).aiError = aiErr;
      (e as any).httpStatus = resp.status;
      // 特殊：密钥无效 -> 消息含"密钥未配置或已失效"关键字（触发 withFallback NO_API_KEY 分支）
      if (aiErr.code === 'INVALID_API_KEY' || aiErr.code === 'QUOTA_EXCEEDED') {
        const e2 = new Error(aiErr.message);
        (e2 as any).aiError = aiErr;
        (e2 as any).httpStatus = resp.status;
        throw e2;
      }
      throw e;
    }

    const data = await resp.json().catch(() => ({}));
    const content: string = data?.choices?.[0]?.message?.content || '';
    const usedModel: string = data?.model || payload.model;
    // 非流式同样要判 finish_reason：'length' 表示撞上 max_tokens，content 是半截的
    const finishReason: string | undefined = data?.choices?.[0]?.finish_reason;
    const truncated = finishReason === 'length';
    if (truncated) {
      console.warn('[ai] 输出被 max_tokens 截断（finish_reason=length），内容可能不完整');
    }
    return { content: content as string, model: usedModel as string, latencyMs, truncated, finishReason };
  }

  /**
   * 统一的 fetch 包装：把**传输层失败**翻译成明确的异常类型。
   *
   * 不加这层的话，断网 / DNS 失败 / 网关拒绝会以裸 `TypeError: Failed to fetch` 冒泡，
   * 一路被兜底逻辑吞掉（"success:true + 空数据"），用户既看不到内容也看不到原因。
   */
  private async fetchOrThrow(url: string, init: RequestInit): Promise<Response> {
    try {
      return await fetch(url, init);
    } catch (e) {
      const signal = init.signal as AbortSignal | undefined;
      if (signal?.aborted) throw new StreamAbortedError();
      // 浏览器/网关超时也会走这里（AbortError 但非用户触发）
      if ((e as { name?: string })?.name === 'AbortError') {
        throw new StreamNetworkError('请求被中断（网关或浏览器超时）');
      }
      throw new StreamNetworkError(
        `无法连接到模型服务：${e instanceof Error ? e.message : String(e)}`
      );
    }
  }

  // -------- 核心：callModelStream（流式调用，链路状态诚实处理）--------

  /**
   * 流式调用：每收到一段文本就回调 onDelta，实现"边生成边渲染"。
   *
   * 设计原则 —— **不猜测、不打补丁、拿到什么链路状态就诚实处理什么**：
   *   - 型号静态能力声明不支持流式（caps.streaming=false）→ 直接走非流式（这是配置，不是猜测）
   *   - 其余情况一律发 stream:true，**不维护任何运行时黑名单/自愈状态**
   *   - 收到增量 → 立即 onDelta 实时渲染（"有多少内容显示多少内容"）
   *   - 传输层失败 / 协议解析失败 / 首字节超时 → 直接抛错，**不再降级重发非流式**
   *     （重发意味着让用户白等一整轮；同一条链路再发一次大概率同样失败）
   *
   * 错误向上冒泡，由 withFallback 识别为"链路错误"后以 success:false 透传给 UI，
   * 让用户看到具体原因（超时/网络/协议），而不是笼统的"生成失败"。
   *
   * @returns streamed=true 表示真的走了流式
   */
  protected async callModelStream(
    prompt: string,
    systemPrompt: string | undefined,
    depth: AIDepth,
    onDelta: (chunk: string) => void,
    signal?: AbortSignal,
    onReasoning?: (chunk: string) => void
  ): Promise<StreamRoundResult> {
    const req = this.prepareRequest(prompt, systemPrompt, depth, true);
    const { url, headers, payload, meta } = req;
    const providerId = this.getProviderId();

    // 型号静态能力声明不支持流式 → 直接走非流式（配置层结论，不涉及运行时猜测）
    if (!meta.streaming) {
      console.warn(
        `[stream] ${providerId}/${meta.model} 型号静态声明不支持流式，本次走非流式`
      );
      const direct = await this.callModel(prompt, systemPrompt, depth, signal);
      if (direct.content) onDelta(direct.content);
      return { ...direct, streamed: false };
    }

    const startedAt = Date.now();
    // 传输层失败（断网 / DNS / 网关拒绝）→ fetchOrThrow 归类为 StreamNetworkError，
    // 交给续写循环判断"是否值得换一轮接着写"，而不是在这里直接降级重发。
    const resp = await this.fetchOrThrow(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal,
    });

    if (!resp.ok) {
      let raw: any = {};
      try { raw = await resp.json(); } catch { /* ignore */ }
      const aiErr = this.mapErrorResponse(raw, resp.status);
      const e = new Error(aiErr.message);
      (e as any).aiCode = aiErr.code;
      (e as any).aiError = aiErr;
      (e as any).httpStatus = resp.status;
      throw e;
    }

    // 注：部分厂商忽略 stream 参数直接返回完整 JSON（content-type 非 event-stream），
    // readSSEStream 仍会尝试按 SSE 读一次；若读不出增量会返回空 text，下方按真实状态处理。

    try {
      const result = await readSSEStream(resp, onDelta, signal, onReasoning, FIRST_BYTE_TIMEOUT_MS);
      const latencyMs = Date.now() - startedAt;

      // 链路状态诚实处理：有多少内容就返回多少内容。
      // 增量已经在 readSSEStream 内部通过 onDelta 实时推给上层渲染了，
      // 这里的返回值只是"最终聚合结果"，供上层判断完整性与收尾。
      if (result.text) {
        // 收到了正文（无论是否还收到思维链）→ 正常流式返回。
        // finishReason 必须带上去：续写循环据此区分"模型输出上限"(length)、
        // "被安全策略拦截"(content_filter) 与"网关静默截断"(无结束标记)。
        return {
          content: result.text,
          model: result.model || (payload.model as string),
          latencyMs,
          streamed: result.streamed,
          truncated: result.truncated,
          finishReason: result.finishReason,
        };
      }

      // 没收到正文。两种真实情况：
      //   a. 收到过思维链（模型在思考但正文没产出）→ 返回空，receivedReasoning 语义已在内部处理
      //   b. 完全没收到任何字节（服务端没按 SSE 干活）→ 返回空，streamed=false
      // 两种情况都**不猜测**：空内容向上冒泡，由续写循环决定是"原请求重发"还是收尾。
      if (result.receivedReasoning) {
        console.warn(`[stream] ${providerId}/${meta.model} 本轮只收到思维链、正文为空`);
      } else if (!result.streamed) {
        console.warn(`[stream] ${providerId}/${meta.model} 本轮未收到任何 SSE 增量（网关可能忽略了 stream 参数）`);
      }
      return {
        content: '',
        model: result.model || (payload.model as string),
        latencyMs,
        streamed: result.streamed,
        truncated: result.truncated,
        finishReason: result.finishReason,
      };
    } catch (e) {
      if (signal?.aborted) throw e;
      // 三类链路中断都**原样上抛**，由续写循环按分类决定是否再试一轮
      // （注意：此时已收到的增量已经在 onDelta 里落到上层的累积缓冲中，不会丢）
      if (e instanceof StreamTimeoutError) {
        console.warn(`[stream] ${providerId}/${meta.model} 首字节超时 ${e.elapsedMs}ms`);
        throw e;
      }
      if (e instanceof StreamProtocolError) {
        console.warn(`[stream] ${providerId}/${meta.model} SSE 协议解析失败：${e.message}`);
        throw e;
      }
      if (e instanceof StreamNetworkError) {
        console.warn(`[stream] ${providerId}/${meta.model} 传输层中断：${e.message}`);
        throw e;
      }
      throw e;
    }
  }

  /** callModel + JSON 约束 prompt + 解析 */
  protected async callModelWithJSON<T>(
    prompt: string,
    systemPrompt?: string,
    depth: AIDepth = 'medium',
    signal?: AbortSignal
  ): Promise<{ data: T; model: string; latencyMs: number; truncated: boolean }> {
    const { content, model, latencyMs, truncated } = await this.callModel(
      prompt + '\n\n请严格按照上述JSON格式返回，不要包含任何其他文字或解释。',
      systemPrompt,
      depth,
      signal
    );
    const parsed = parseJSONResponse<T>(content);
    if (parsed !== null) return { data: parsed, model, latencyMs, truncated };
    // 内容被 max_tokens 截断时 JSON 必然解析失败：带上明确的分类（模型输出上限），
    // 让上层提示用户"换输出上限更高的模型"，而不是笼统的"生成失败"。
    if (truncated) {
      throw new GenerationInterruptedError(
        createInterruption('length', { detail: `已收到 ${content.length} 字符` }),
        `模型输出达到上限被截断，JSON 未闭合（已收到 ${content.length} 字符）。请在设置里换用输出上限更高的模型，或减少单次生成的内容量。`,
        content
      );
    }
    // 内容到了但解析不出 JSON → 内容侧 parse 中断
    const preview = content.slice(0, 500).replace(/\n/g, '\\n');
    throw new GenerationInterruptedError(
      createInterruption('parse', { code: 'GENERATE_FAILED', detail: `length=${content.length}, preview: ${preview}` }),
      `Failed to parse JSON response (length=${content.length}, preview: ${preview})`,
      content
    );
  }

  // ============== 业务方法默认骨架（各 provider 共享同一套 prompt）==============
  // 说明：所有业务 prompt 集中在此，GenericAIProvider 继承即获得全量业务方法。

  // ============== 提示词（流式与非流式共用同一份，避免两边漂移）==============

  protected buildGenerateSystemPrompt(): string {
    return `你是一个严谨的知识内容生成专家。
核心原则：内容准确性 > 完整性。所有内容必须基于权威来源，宁可少也不能错。` + this.buildLanguageDirective();
  }

  /**
   * 分类驱动指令：根据 analyze 产出的学科（category）与知识形态（knowledgeType），
   * 只注入与该主题高度相关的内容/制图规范，避免无关学科规则干扰模型判断。
   *
   * category 是开放字符串（AI 自己归类，含交叉学科与"其他"），这里用关键词匹配
   * 落到一组"学科规则块"；匹配不到或归"其他"时，注入通用的中性规则即可。
   */
  protected buildCategoryDirective(category?: string, knowledgeType?: string): string {
    const c = (category || '').toLowerCase();

    // 交叉学科：明确的两个学科合成词，不套用单一学科的专属规范（避免把"生物化学"误判成纯化学）。
    const crossDiscipline = ['生物化学', '物理化学', '生物物理', '数学物理', '化学工程', '生物信息', '计算化学', '天体物理', '地球化学', 'biochemistry', 'physical chemistry', 'biophysics', 'chemical engineering'];
    const isCross = crossDiscipline.some((k) => c.includes(k));

    const pick = (keywords: string[], block: string): string =>
      keywords.some((k) => c.includes(k)) ? block : '';

    // 数学/几何：函数图象、几何制图、符号、例题多为计算
    const mathBlock = `
【学科专属规范 · 数学/几何】
- 概念、公式、例题、试题里的所有数学符号、算式、几何标记一律用 $...$ 包裹（如 $\\triangle ABC$、$60^\\circ$、$c=\\sqrt{13}$）。
- 配图优先用几何图/函数图象的制图规范（三角形对边命名、函数过对点、直角/等长边/平行标记）。
- 例题与试题偏计算：给"生活场景 + 可验算的数字演算"，答案必须能经得起代入推导。
- 结论、公式要给出适用条件（定义域、前提假设）。`;

    // 物理：受力/电路/光学制图、量纲与方向性
    const physicsBlock = `
【学科专属规范 · 物理】
- 强调物理量的方向性、量纲、单位与适用条件（矢量用箭头，公式含单位）。
- 配图按受力分析 / 电路 / 光学的制图规范：力从作用点出发、元件符号规范、法线过入射点且垂直镜面。
- 例题与试题：受力分析画图、电路串并联拓扑、公式代入要带单位运算。
- 易错点（pitfalls）重点写方向性、单位换算、矢量/标量区别。`;

    // 化学：化学式、方程式、键角/结构式、装置
    const chemistryBlock = `
【学科专属规范 · 化学】
- 化学式、离子式、反应方程式一律用 $...$ 包裹；配平要正确，条件（加热、催化剂、光照）写清楚。
- 涉及结构/键角/装置时，制图遵循化学惯例（键角标注、原子连接顺序、装置从左到右），不要画错原子连接。
- 例题与试题：配平、摩尔计算、物质推断要步骤清晰、答案可验算。
- 易错点重点写：配平、条件、物质状态符号、同分异构。`;

    // 生物：过程/结构描述、概念层级
    const biologyBlock = `
【学科专属规范 · 生物】
- 强调过程（如光合作用、细胞呼吸）的步骤顺序与结构（细胞器、组织）的层级关系。
- 概念多用 definition + process 形态，mindMap 突出"结构 → 功能 → 过程"的层级。
- 例题与试题：偏概念辨析、过程排序、结构功能对应，少纯计算。
- 易错点重点写：概念易混（如光合/呼吸、有丝/减数）、术语精确。`;

    // 文史哲/语言/经济/社会等：重概念、事件、比较、记忆
    const humanityBlock = `
【学科专属规范 · 文史社科】
- 强调概念的准确界定、事件的时间线、人物/学说的比较，多用 timeline / compare / hierarchy 形态。
- 例题与试题：偏概念辨析、时间排序、人物/事件对应、观点比较，少计算。
- 易错点重点写：易混概念、易记错的时间/人物/术语。
- 尽量不用公式；若涉及专有名词，保留原文/标准译名。`;

    // 计算机/信息技术
    const csBlock = `
【学科专属规范 · 计算机/信息技术】
- 强调概念定义、算法步骤、数据结构/协议层级，配图可用流程图/层次图表达。
- 例题与试题：偏概念辨析、算法步骤排序、复杂度判断，代码片段用 $...$ 或普通文本块包裹。
- 易错点重点写：术语精确、易混概念（如进程/线程、TCP/UDP）。`;

    const disciplineBlock = isCross
      ? ''
      : (
        pick(['数学', 'math', '几何', '代数', '函数', '概率', '统计'], mathBlock) ||
        pick(['物理', 'physics', '力学', '电磁', '光学', '热学', '量子'], physicsBlock) ||
        pick(['化学', 'chemistry'], chemistryBlock) ||
        pick(['生物', 'biology', '医学', 'medicine'], biologyBlock) ||
        pick(['历史', '语文', '文学', '英语', '语言', '政治', '哲学', '经济', '金融', '社会', '心理', '地理', '艺术', '体育', '法律'], humanityBlock) ||
        pick(['计算机', '信息', '编程', 'computer', '程序'], csBlock) ||
        ''
      );

    if (!disciplineBlock) {
      // 交叉学科/其他：不注入特定学科规则，只给一条通用提醒，避免无关规则干扰
      return `\n【学科归类】本主题属「${category || '其他'}」（${knowledgeType || 'concept'} 形态）。按该主题自身的学科惯例组织内容与配图，不要套用不相关的学科制图规范。`;
    }

    return `\n【学科归类】本主题属「${category || '其他'}」（${knowledgeType || 'concept'} 形态）。以下是**仅与本学科相关**的规范，只遵守这一块，其它学科的规范不要套用、不要去想。${disciplineBlock}`;
  }

  protected buildGeneratePrompt(topic: string, context?: SearchAnalyzeResponse): string {
    const categoryDirective = this.buildCategoryDirective(context?.category, context?.knowledgeType);

    return `请生成主题"${topic}"的结构化知识内容（基于权威教材与公开资料；拿不准的内容必须直接省略，否则会误导读者）。
${categoryDirective}

【严谨性铁律（最高优先级，覆盖下列所有具体规则）】
**宁缺毋滥**——给错比不给更糟糕。所有内容必须满足：
1. **答案必须可验证**：客观题（选择题/填空题/计算题）的答案必须能经得起推导。若题目条件不全、需要"如图"却无图、或典型陷阱拿不准 → **必须**放弃这道题（examQuestions 中不包含它），**否则**读者会拿到一道错题。
2. **解析必须与答案一致**：explanation 的最终结论必须与 answer 完全相同。例如答案是 $1$，解析就必须推导出 $1$；若解析算出 $2$，说明答案或解析有错，**必须**重新推导到两者一致，**否则**必须放弃这道题。
3. **解析必须给出确信的推导**：**必须**直接写出确定的推理过程。若你发现自己需要写"此题若……"/"改原题可能问的是……"/"可能题目问的是另一个角……"这类自我怀疑的话，说明你没有把握，**必须**放弃这道题。
4. **来源必须真实**：年份/考试名/卷别（source 字段）、图片链接、base64 图片数据**必须**真实可查——**应该**只填你能确定的；**否则**（查不到）**必须**填空字符串，而不是填写任何推测内容。
5. **解析只写本题推导，禁止一切离题内容**：explanation 字段**只许**包含"解这一道题"的分步推导与最终结论，一步到底、用一套解法。**严禁**出现以下任何离题话术——"这道题是 xxx 真题""采用 xxxx 年 xx 考试真题""这是一道经典题/易错题""下面讲几道题""先看背景/考点概述""信雅达""本题考的是……这类套话开场"；也**严禁**在一段解析里罗列多道题、多套互相矛盾的解法、或反复自我推翻重写。**发现自己在写这些，必须**删掉重写，只保留干净的单题推导。

【含"如图"的试题约束】
题干出现"如图"/"如图所示"时，**必须**为该题配图，并按以下顺序取用：
1) 能给出原图数据 → **必须**填 examQuestions[].imageData（原图优先）；
2) 能找到可信图源直链 → **必须**填 examQuestions[].image；
3) 能精确手绘 SVG → **必须**填 examQuestions[].svg（见【SVG 字段规则】）。
以上三者**必须**至少满足其一，**否则**该题无法作答，**必须**按以下两种方式之一处理：
- **舍弃**这道题（examQuestions 中不包含它）；
- 或**改写**为不依赖图形的等价题型（纯文字即可作答），并**必须**在题干末尾注明"（xxxx年xx考试改编）"，标明这是改编题。

【公式书写规则（最高优先级，适用于本文所有字段）】
凡出现数学符号（变量、公式、运算、几何符号、角度、根号、向量、上下标、单位符号等），
一律用 $...$ 包裹成行内 LaTeX。正文、列表、题干、选项、答案、解析都适用。
- 正确：$\\triangle ABC$、$60^\\circ$、$c=\\sqrt{13}$、$\\vec{F}=m\\vec{a}$、$F_x=ma_x$
- 错误：\\triangle ABC、60^\\circ、\\sqrt{13}、\\vec{F}（缺 $ 围符，前端无法渲染，会原样露出源码）
- 中文**必须**放在 $...$ 之外；**只许**用行内公式 $...$，**而不是** $$ 或 \\[ \\]（前端只识别 $...$，用其它围符会原样露出源码）

【输出顺序与内容】
**必须**按下列顺序输出（顺序即页面展示顺序），**不得**调换。

1) summary：用一两句话定位该主题，让读者一眼看清它是什么、属于哪个学科分支。

2) mindMap：1 个根节点 + 3~5 个一级分支 + 每个分支 2~4 个叶子（树深 3 层；复杂主题可用 4 层）。仅叶子带 description（1~2 句）。

3) conceptsOverview：核心概念区块的引导段，3~4 句，说清三件事：本主题是什么；下文几个概念之间的递进关系（谁是谁的基础、谁是谁的推广）；建议的学习顺序。这是"核心概念"区块的引导，**必须**与 summary 不同（不得复述 summary）。

4) concepts：3~4 个最重要的概念（按学习顺序，通常：定义 → 公式 → 定理/原理）。type 只能取英文值之一：definition / formula / theorem / principle。
- title 用教材规范术语
- elementary 用生活化比喻讲直觉；advanced 用教材式严谨表述
- 含公式填 notation（纯 LaTeX 表达式，不加任何围符，KaTeX 直接渲染）
- 公式 / 定理 / 方法类概念配 example：定量给"生活场景 + 可验算数字演算"；定性给真实典型场景；纯直观概念留空
- keyPoints：3~4 条让读者一眼抓住重点（写"用的时候要注意什么"，不与初等/高等解释重复；含公式用 $...$ 包裹）
- pitfalls：1~2 条易错提醒（适用条件 / 方向性 / 单位 / 前提；含公式用 $...$ 包裹）；没有典型误区就 []

5) knowledgeContext：
- prerequisites：2~3 条具体前置知识
- relatedTopics：3~5 条关联知识点
- learningPath：3 步，每步"阶段名：具体学什么、达到什么效果"
- commonConclusions：2~3 条可直接用的结论 / 推导式 / 核心规律
- confusables：1~2 条易混辨析（topic 填易混概念名，difference 一句话点明核心区别）；没有就 []

6) examQuestions：1~3 道真题（优先近 3 年；确无直接考查的可放宽近 5 年；都没有就 []）。
- type 只能取四个英文值之一：choice（选择题）/ fill（填空题）/ calculation（计算题）/ essay（问答·解答·证明题）
- choice 必须给 options：4 个选项组成的数组，只写选项内容本身、不带"A."前缀；answer 只写选项字母（如 "B"）
- fill：题干用 ____ 标空位；answer 写应填内容（多个空用；分隔）
- calculation / essay：answer 写最终结论或关键结果；explanation 写分步推导
- **explanation 只写本题**：直接从"解/设/由题可得"开始，一步接一步推到 answer；**只写一套解法**，不得罗列"法一/法二"多套方案，不得写"本题考的是……""这是真题/经典题/易错题"之类开场或点评，不得在解析里出现另一道题、另一组数字或与本题无关的背景介绍。推导的**最后一行结论必须等于 answer**。
- source.year 填真实年份字符串；exam 填考试名；section 填卷别（没有就空字符串）
- 题干、选项、答案、解析中的**所有**数学符号一律用 $...$ 包裹（如 $\\triangle ABC$、$60^\\circ$、$\\sqrt{13}$、$a=5$）
- 配图优先级：原图 > 模型手绘，见下方【试题配图规则】

【试题配图规则（原图优先）】
试题里的图形（几何图形、函数图像、电路图、实验装置、统计图表等）**必须**优先用**原图**，顺序为：
1) examQuestions[].imageData：能直接给出图片数据时**必须**填 base64 data URL（data:image/png;base64,...）。
   提示：试题原文中"一大片无法作为字符识别、且承载图形语义的区域"就是一张图 —— **必须**把它作为图片数据直接填入；若改用文字描述，图形在页面上就无法呈现。
2) examQuestions[].image：能确定是该图的**可信图源直链**时**必须**填写（域名单见下方【image 字段的填写】）；不确定就填空字符串。
3) examQuestions[].svg：以上都没有、且你确信能手绘准确时，**必须**用 SVG 表达（见【SVG 字段规则】）。
三者**必须**至多填一个有意义的；都没有就都留空。

7) interestingFacts：1~2 条，优先写发现过程中的真实故事（谁、什么情境、如何想到），2~4 句通俗易懂。

【image 字段的填写（可信图源直链，优先于手绘 SVG）】
**公开图库直链是「图文并茂」最可靠、最省心的方式**——能用就优先用，比你自己手绘 SVG 更准、更真实。
**必须**只填下列**可信图源域名**的直链，其它域名一律不得填写（填写也会被系统丢弃）：
  upload.wikimedia.org、commons.wikimedia.org、cdn.kastatic.org（可汗学院）、
  images.unsplash.com、raw.githubusercontent.com、lh3.googleusercontent.com、
  cdn.jsdelivr.net、ocw.mit.edu、math.mit.edu
- **必须**是 https 直链且指向具体图片文件（.png/.jpg/.svg/.webp 等）；**应该**直接给图片文件地址，**而不是**页面地址，也**不要**带 ?source= / ?token= / ?from= 之类防盗链参数（否则会被系统丢弃）。
- **积极引用**：对数学/物理/化学/生物等理科概念，Wikimedia Commons 里通常有对应的**标准示意图**
  （如"加速度"的矢量图、"勾股定理"的几何证明图、"串联电路"的电路图）。你熟知这些图在
  Commons 的规范文件名（如 File:xxx.svg），按规范拼出 upload.wikimedia.org 直链即可。
  **必须**只填**能确定对应正确示意图**的直链；若只是"猜到有个图但不确定具体文件名/是否真实存在"，**必须**填空字符串（留空系统会用图库检索兜底，或走 SVG 手绘；宁可留空也不给 404 链接）。
- concepts[].image：该概念**标准示意图**的可信直链（优先填）。
- examQuestions[].image：仅在拿不到原图数据（imageData）时考虑；真题的专属图形通常
  Commons 里没有，此时**应该**改用 imageData 或 SVG 表达，**而不是**硬填一个无关的图。

【imageData 字段（直接填图片数据，可选）】
- 仅当你具备多模态能力、能把图**以图片数据直接输出**时填写：填 base64 data URL（形如 data:image/png;base64,xxxx）。
- concepts[].imageData：该概念的示意图；examQuestions[].imageData：该题的图形（原图优先，优于 SVG）。
- **纯文本模型（无视觉能力 / 看不到任何图）必须避开此项**：
  - **必须**填严格空字符串（imageData: ""）；**否则**自行生成的 base64（如 "data:image/png;base64,iVBOR..." 这种随机字符串）会在后台校验中被丢弃
  - **应该**直接留空 imageData，**而不是**凭"印象里见过这道题"编造一段 base64 —— 后台会校验，未通过的会被丢弃
  - 没有图时**应该**走 SVG 兜底，或直接不出有图的题（参见上方【严谨性铁律】和【含"如图"的试题约束】）

【imageQuery 字段】
- concepts[].imageQuery：1~3 个最能命中该知识点标准示意图的检索关键词。
- 用该知识点本身最常用的语言（由你判断：物理 / 化学 / 数学 / 计算机常用英文，语文 / 中国历史 / 地理等用中文，专有名词按学科惯例）。不强制，看哪个最准用哪个。
- 抽象概念没有标准示意图时**必须**填空字符串。

【SVG 字段规则（配图首选，教你具体怎么画）】
配图优先级：真实图片(image/imageData) > 你手绘的 SVG。但几何图、函数图象、电路图这类**标准示意图**，
本就是你该亲手画的标准图形——按下面的**绘图步骤**画，能保证正确。

**通用画法（先立骨架，再补标记）**
1. 先想清楚要表达的核心关系（几何：边的相对位置；函数：单调/交点/对称；电路：串并联拓扑）。
2. 用 viewBox='0 0 320 200'，把图形主体放在画布中央，四周留 10~20 单位边距。
3. 先画主线条（骨架），再补标记（顶点字母、角度弧、受力箭头、元件符号、坐标刻度）。
4. **必须**只画题干/解析里**明确存在**的元素；**否则**脑补题干没给的条件会画出错误的图。

**数学·几何（三角形/圆/平行线）—— 按步骤画**
- 三角形：先定三个顶点坐标（如 A(40,160) B(280,160) C(160,40)），再按"对边"原则命名——**角 A 的对边是边 a=BC、角 B 的对边 b=CA、角 C 的对边 c=AB**。**顶点的字母（A、B、C）写在顶点旁，边的字母（a、b、c）写在对应边的中点旁**——角代号绝不能写到边的中间，边长代号也绝不能写到顶点上。
- 直角：在直角顶点处画一个小正方形（边长 6~8）表示直角符号，不要画成弧。
- 等长边：在两条相等边的中点各画一短横线（单横=一对等边，双横=另一对）。
- 角标记：在角内部画小圆弧（半径 12~16），弧旁标角名（∠A 或字母 A）。
- 圆：先定圆心 + 半径；直径要过圆心，圆心画一个小点；圆周角/圆心角用弧标出。
- 平行线：两平行线上各画一个同向的小箭头（或单斜杠）标记平行。

**数学·函数图象 —— 按步骤画**
- 先画坐标轴：x 轴向右、y 轴向上，带箭头；**x 标在 x 轴右端箭头旁、y 标在 y 轴上端箭头旁、O 标在原点处**——三个代号各归其位，不能互换或漂移。
- 再标刻度：关键刻度点（如 -1、0、1、2）画小竖线并标数值。
- 后画曲线：一次函数画直线（过两个已知点）；二次函数画抛物线（先定顶点，再对称展开）；反比例画双曲线（两支，关于原点对称）；三角画波浪（标出周期和振幅）。
- 关键点（交点/顶点/零点）用小圆点标出并标坐标。
- 用 path 画平滑曲线时，控制点要让曲线光滑、不出现尖角。

**物理·电路 —— 按步骤画**
- 电源：长竖线(正极)+短竖线(负极) 的电池符号，或用圆圈里标 + -。
- 电阻：锯齿形折线（或用矩形框）；电容：两条等长平行竖线；开关：一根斜线搭在断点上。
- 灯泡：圆圈里画 X；电流表/电压表：圆圈里标 A / V。
- 元件代号（R、C、S、L、A、V 等）**必须**标在对应元件符号的旁边，**不能**标到别的元件或导线上去。
- 导线：**必须**用横平竖直的折线连接各元件；交叉处若非连接点，**不得**画实心点，**否则**会被误判为连通节点。
- 先确定串并联拓扑：串联元件在同一回路顺次排；并联元件在不同支路上（支路两端接同一对节点）。

**物理·受力分析 —— 按步骤画**
- 先画物体（矩形/圆/斜面上的方块）。
- 力从**作用点**（物体中心或接触点）出发，画带箭头的线段，箭旁标力的符号（**符号必须紧跟箭头，不能落到别的力或物体上**）。
- 重力 G 竖直向下；支持力 N 垂直于接触面向上；摩擦力 f 沿接触面（与运动趋势相反）；拉力/推力沿绳/推的方向。
- 斜面上：重力分解为沿斜面分量和垂直斜面分量，用虚线表示分解线。

**物理·光学 —— 按步骤画**
- 先画镜面/透镜（直线或双弧）。
- 再画法线：过入射点、垂直于镜面的虚线。
- 入射光线、反射光线、折射光线都画带箭头的实线，**角度相对法线标注**（入射角=反射角）。

**绘制硬性要求（避免画错）**
- **必须**输出完整 <svg ...>...</svg> 且带 viewBox；画布**应该**紧凑，图形占满 80% 以上。
- **只许**使用基础元素：line / polyline / polygon / path / circle / rect / ellipse / text / g；**严禁**混入 <script>、事件属性（onclick 等）、外部图片引用、<use>、url(http...) 之类会触发渲染器拦截的写法。
- 属性**必须**一律用单引号，例如 <line x1='20' y1='160' x2='300' y2='160' stroke='#334155' stroke-width='1.5'/>。
- 线条**必须**细：stroke-width 统一 1～2（推荐 1.5）；元件符号**应该**紧凑（约为画布高度 1/8）。
- 配色**应该**用深色线条配浅色填充，保证在浅色背景上清晰可见。
- 图中文字标签**应该**用字母/数字（A、B、C、F、θ、x、y），**而不是**中文（中文在 SVG 里可能渲染异常）；公式标签**应该**简短。
- 若确实无法按上面步骤画对标准示意图，**应该**把 svg 留空字符串（而不是硬画一张错的图）；但几何/电路/函数这类标准图你**应该**按步骤画，能画对。

**画完自检（重要，输出前必须逐条核对"怎么检查"）**
画完 SVG 后，**必须**在心里把图形"读一遍"、逐条核对。**只核对与这张图相关的那部分**——
先判断这张图属于哪一类（几何 / 函数图象 / 电路 / 受力 / 光学），再**只**套用对应类别的自检项；
**无关类别的条目不要套用、不要去想**，否则无关内容会干扰你对当前图的判断。
每一条都要知道"检查的方法"，而不是只凭感觉扫一眼。

**通用自检（任何图都必须查）**
1. **字母代号的位置是否正确**：角、边、顶点、物理量、元件的字母代号**必须**标在它**对应对象的位置**上——角的字母（∠A 或 A）**必须**写在角的顶点附近（角开口处）、**不能**写在边的中间；边的字母（a、b、c）**必须**写在对应边的中点旁、**不能**写在顶点上；顶点的字母**必须**落在顶点旁；力的符号（G、N、f、F）**必须**标在箭头旁；元件代号（R、C、L 等）**必须**标在元件符号旁。**检查方法**：逐个字母问"它代表哪个对象"，确认它紧邻该对象、没落在别的对象上。
2. **数值一致**：图里标的坐标、角度、边长**必须**与题干/解析里给的数值**完全一致**（题干说 60°，图上就必须**看起来是** 60°、**不能画成 30° 的样子**；题干说 A、B、C 三点，图上就不能出现没有来历的 D 点）。**检查方法**：把题干数值逐条抄出来，与图中每个标注一一对照。
3. **没有多余元素**：**必须**没有题干/解析里不存在的点、线、标注；**否则**这张图会把读者带偏。
4. **发现任何一处对不上，必须**回到对应步骤重画，而不是带着错误输出。

**几何图自检（仅画三角形/圆/平行线时套用）**
- **点是否画在线上**：顶点**必须**正好落在边的端点（而不是飘在边上或线外）；圆心**必须**到圆上所有点等距；切点/交点**必须**正好落在两条线的交点处；直径端点**必须**落在圆周上。**检查方法**：把每个点的坐标代入它"应该在"的那条线/那个圆的方程，看是否成立。
- **标记对号**：直角符号**必须**落在真正的直角顶点（不是相邻的锐角）；等长边短横**必须**打在相等那两条边的中点；平行箭头**必须**画在相互平行的那两条线上。**检查方法**：对每个标记，找它"对应"的几何对象，确认二者位置重合。

**函数图象自检（仅画函数图象时套用）**
- **是否过对点、是否在对的象限**：图象**必须**经过题干给定的关键点（如过 (0,0)、(1,2)），整体走势**必须**落在正确的象限/单调区间（如 $k>0$ 的正比例函数**必须**过一、三象限；开口向上的抛物线**必须**顶点在最低处且两侧向上延伸）。**检查方法**：把题干坐标点逐个代入函数式，验证"点是否在曲线上"，再对照斜率/二次项符号判断开口与象限。
- **曲线光滑**：用 path 画平滑曲线时，控制点**必须**让曲线光滑、不出现尖角（折线除外）。

**电路图自检（仅画电路图时套用）**
- **元件是否真正连进电路**：每个元件（电阻、电容、开关、灯泡、电流表/电压表）的**两个引脚必须都接到导线上**，而不是悬空或只接一端；导线交叉处非连接点**必须**是跳线（不画实心点），连接点才画实心点。**检查方法**：沿电流路径从电源正极走一遍回路，看电流能否顺利流经每一个元件再回到负极，没有断头。

**受力分析自检（仅画受力图时套用）**
- **力是否从作用点出发、方向是否正确**：每个力**必须**从作用点（物体中心或接触点）出发画箭头，方向**必须**符合——重力 G 竖直向下、支持力 N 垂直接触面向上、摩擦力 f 沿接触面（与运动趋势相反）、拉力/推力沿绳/推的方向；斜面分解力用虚线。**检查方法**：对每个力，确认起点在作用点、箭头方向与力的性质一致。

**光学自检（仅画光学图时套用）**
- **法线与角度**：法线**必须**过入射点、垂直于镜面；入射角**必须**等于反射角（角度相对法线标注）；折射光线**必须**按介质改变方向。**检查方法**：确认法线过入射点且垂直镜面，再核对入射角=反射角。

【输出格式】
严格输出标准 JSON（字段顺序与上述一致）：
{
  "topic": "${topic}",
  "summary": "...",
  "mindMap": [{"id":"root","title":"${topic}","level":"root","children":[{"id":"b1","title":"一级分支","level":"branch","children":[{"id":"l1","title":"叶子","level":"leaf","description":"一句话"}]}]}],
  "conceptsOverview": "...",
  "concepts": [{"type":"definition","title":"","content":{"elementary":"","advanced":""},"notation":"","image":"","imageData":"","svg":"","imageQuery":"","keyPoints":[],"pitfalls":[],"example":""}],
  "knowledgeContext": {"prerequisites":[],"relatedTopics":[],"learningPath":[],"commonConclusions":[],"confusables":[{"topic":"","difference":""}]},
  "examQuestions": [{"id":"","type":"choice","question":"","image":"","imageData":"","svg":"","options":[],"answer":"","explanation":"","difficulty":"medium","source":{"year":"","exam":"","section":""}}],
  "interestingFacts": [{"id":"","title":"","content":"","type":"story"}]
}

注意：
- 只返回 JSON 本身，不要任何前后解释、不要 markdown 代码块
- 字符串中的双引号必须转义为 \\"
- 字符串中不要包含换行符，用 \\n 表示
- 空内容用空字符串或空数组，不要省略字段`;
  }

  protected buildFollowupSystemPrompt(topic: string, mode?: 'search' | 'qa'): string {
    const isQA = mode === 'qa';
    const base = isQA
      ? `你是一个博学耐心的学习问答助手，像一位善于讲解的老师。
回答要求：
1. 先直接给出结论/答案，再展开解释，不要绕弯子
2. 内容准确，基于权威教材和可靠资料；不确定的地方应该明确说明"此处存疑"，而不是编造
3. 条理清晰：复杂内容用分点或分步讲解，简单问题一句话说清即可，不要为分点而分点
4. 善用生活化类比和具体例子，让零基础的人也能听懂；涉及公式时用 LaTeX 书写
5. 长度按问题需要调整：事实性问题简短作答，原理性问题讲透为止
【公式书写规则（最高优先级，逐字符保留）】
凡出现数学符号（变量、公式、运算、几何符号、角度、根号、上下标、单位等），一律用 $...$ 包裹成行内公式（如 $F=ma$、$60^\\circ$、$\\sqrt{2}$），中文放在 $...$ 之外。
- **反斜杠绝不能省**：'\\frac' 不能写 'rac'、'\\triangle' 不能写 'riangle'、'\\vec' 不能写 'vec'、'\\sqrt' 不能写 'sqrt' —— 反斜杠是 LaTeX 命令的"开关"，省略后整段公式渲染失败。
- **逐字符保留公式源码**：不得简写、合并、改写任何反斜杠命令（如 '\\frac{a}{b}' → 'a/b' 是错的），用户需要的是"能渲染的公式"而不是"看着像公式的文字"。`
      : `你是一个知识问答助手，正在讲解"${topic}"。
回答要求：紧扣该知识点，先直接回答再展开解释；内容准确基于教材，不确定处应该明确说明存疑而不是编造；善用类比和例子；复杂问题分点讲清，简单问题不啰嗦。
【公式书写规则（最高优先级，逐字符保留）】
凡出现数学符号（变量、公式、运算、几何符号、角度、根号、上下标、单位等），一律用 $...$ 包裹成行内公式（如 $F=ma$、$60^\\circ$、$\\sqrt{2}$），中文放在 $...$ 之外。
- **反斜杠绝不能省**：'\\frac' 不能写 'rac'、'\\triangle' 不能写 'riangle'、'\\vec' 不能写 'vec'、'\\sqrt' 不能写 'sqrt' —— 反斜杠是 LaTeX 命令的"开关"，省略后整段公式渲染失败。
- **逐字符保留公式源码**：不得简写、合并、改写任何反斜杠命令（如 '\\frac{a}{b}' → 'a/b' 是错的），用户需要的是"能渲染的公式"而不是"看着像公式的文字"。`;
    return base + this.buildLanguageDirective();
  }

  protected buildFollowupPrompt(topic: string, question: string, history: FollowupMessage[], mode?: 'search' | 'qa'): string {
    const isQA = mode === 'qa';
    const historyStr = history.map((msg) => `${msg.role === 'user' ? '用户' : '助手'}: ${msg.content}`).join('\n');
    return isQA
      ? `历史对话：\n${historyStr}\n\n当前问题：${question}\n\n返回JSON格式：{"reply": "回答内容", "relatedKnowledge": []}`
      : `主题：${topic}\n历史对话：\n${historyStr}\n\n当前问题：${question}\n\n返回JSON格式：{"reply": "回答内容", "relatedKnowledge": []}`;
  }

  protected buildDocPrompt(type: DocType, topic: string, requirements?: string, tone?: EmailTone): string {
    const docTypeLabels: Record<DocType, string> = {
      general: '通用文档',
      email: '商务邮件',
      report: '报告大纲',
      meeting: '会议纪要',
      ppt: 'PPT结构',
      notes: '学习笔记',
      contract: '合同模板',
      resume: '简历',
      press: '新闻稿',
      proposal: '项目提案',
      weekly: '周报',
    };
    return `请生成一份${docTypeLabels[type]}类型的文档。\n\n主题：${topic}\n要求：${requirements || ''}\n语气：${tone || ''}\n\n返回JSON格式：{"type": "${type}", "title": "文档标题", "content": "文档内容（markdown格式）", "tone": "${tone || ''}"}`;
  }

  /** 生成结果的统一清洗出口（流式与非流式共用，保证最终数据完全一致） */
  protected sanitizeGenerateResult(raw: any, topic: string): SearchGenerateResponse {
    const d = raw as SearchGenerateResponse;
    d.topic = asStr(d.topic) || topic;
    d.summary = asStr(d.summary);
    // 总述：核心概念区块的引导段（渲染在「核心概念」标题下）；模型可能用 overview / overviewText 等别名
    d.conceptsOverview = asStr(d.conceptsOverview ?? (d as any).overview ?? (d as any).overviewText);
    if (d.mindMap) d.mindMap = sanitizeMindMap(d.mindMap, topic);
    d.concepts = sanitizeConcepts(d.concepts);
    d.knowledgeContext = sanitizeKnowledgeContext(d.knowledgeContext);
    d.examQuestions = sanitizeExamQuestions(d.examQuestions);
    d.interestingFacts = sanitizeInterestingFacts(d.interestingFacts);
    return d;
  }

  public buildService(): AIService {
    // 先 capture this，避免丢失上下文
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;

    return {
      search: {
        validate: withFallback(
          async (input: string) => {
            const systemPrompt = '你是一个输入验证助手。你的任务很轻：只拦截"乱敲的无意义输入"，其余一律放行。' + self.buildLanguageDirective();
            const prompt = `请判断以下输入是否为"乱敲的无意义输入"："${input}"

判定标准（务必从宽，宁可放行也不误拦）：
- 无效（valid=false）：明显是乱敲的字符——纯随机字母/数字/符号的无序堆砌、键盘乱按（如 "asdfghjkl"、"gibberish123!@#"、"。。。"）、纯表情符号且无语义、明显错乱到无法辨认任何意图的输入
- 有效（valid=true）：只要输入表达了任何可理解的意图，无论多简短或多口语化，都判有效——包括：
  ① 正常的问题、知识点、话题、人名、角色名、网络热梗、游戏设定等一切有意义的内容；
  ② 口语/方言/网络用语（如"啥是""咋回事""emo了"）；
  ③ 只有一个字或一个词的输入（如"数学""猫"）也有效；
  ④ 疑问句、陈述句、短语、甚至一个关键词，都有效。
- 牢记：**绝大多数用户输入都是有效信息，只有真正乱敲的才拦截**；拿不准时一律判 valid=true 放行。

返回JSON格式：{"valid": true/false, "suggestions": ["建议1", "建议2"], "reason": "原因"}`;
            const r = await self.callModelWithJSON<SearchValidateResponse>(prompt, systemPrompt);
            return r.data;
          },
          { valid: true, suggestions: [] },
          'Search validate'
        ),
        analyze: withFallback(
          async (input: string) => {
            const systemPrompt = '你是一个意图识别助手。只做一件事：判断用户想系统学习一个知识点，还是只想简单问答，并为输入分门别类。' + self.buildLanguageDirective();
            const prompt = `分析用户输入："${input}"

第一步·判断意图（isKnowledgePoint）：
- true：用户想学习/了解某个**可系统展开的学科知识点**——概念、定理、公式、定律、现象、事件、学科主题等。即使问的是它的某个侧面（应用、例子、历史、怎么学），也归此类。
- false：其余一切——一次性的简单问答、闲聊问候、单一事实查证、算数计算、写作/翻译/编程等事务性请求。
- **判定只认一条闭合标准（不要逐类枚举）**：只有当你确信输入指向一个"能围绕它讲出一套知识体系"的学科主题时才判 true；**拿不准、或它更像一个"名字/梗/现象/短语"而非学科概念时，一律判 false 走问答**——这覆盖网络热梗、作品角色名、游戏设定、口语闲聊等一切"有意义但非知识点"的输入，无需逐个识别它们是哪一类。
- true 的例子：加速度、牛顿第二定律、复数的应用有哪些、光合作用需要光吗、三角函数怎么学、万有引力是谁提出的
- false 的例子：你好、123×456等于多少、帮我写一封邮件、今天天气怎么样、林黛玉是谁、抽象是什么梗、原神的元素反应

第二步·提取核心知识点（canonicalTopic）：
- 去掉所有疑问词和修饰成分，只保留最核心的学科概念本身：
  "加速度是什么"→"加速度"；"复数的应用有哪些"→"复数"；"光合作用需要光吗"→"光合作用"；"三角函数怎么学"→"三角函数"；"万有引力是谁提出的"→"万有引力"
- isKnowledgePoint 为 false 时留空字符串

第三步·判断范围（isSpecific）：
- true：具体知识点，可直接展开讲解（如"勾股定理""复数""光合作用"）
- false：宽泛学科/类别，需要先展示知识图谱供选择（如"数学""物理""高中化学"）

第四步·分门别类（category，isKnowledgePoint 为 true 时填写）：
- 用**最贴切的一个学科名称**归类，优先用规范学科名。推荐优先从下列常用类目里选：数学、物理、化学、生物、地理、历史、语文/文学、英语/语言学、政治/哲学、经济/金融、计算机/信息技术、艺术/音乐/美术、体育、心理学、社会学、医学、天文、环境科学
- **交叉学科取交叉归属**：分子物理、生物化学、生物物理、物理化学、数学物理、化学工程等交叉领域，用能体现交叉的名词（如"生物化学""物理化学"），不要硬拆成单一学科；分类拿不准主次时，把主导学科写在前面（如"生物物理"偏物理、"生物化学"偏化学/生物）
- **常见的、不便归入标准学科的知识，归"其他"**：不要强行套一个学科名（如"生活常识""冷知识""百科杂项"这类就填"其他"）
- isKnowledgePoint 为 false 时，category 填"问答"
- **语言**：category 与 canonicalTopic 会展示给用户，用用户的输出语言书写（如英文用户填 "Mathematics" 而非 "数学"）；canonicalTopic 若原文已是用户母语则保留原文，否则翻译成用户语言。

第五步·生成知识图谱（graphData，仅当 isSpecific=false 且 isKnowledgePoint=true 时填写）：
- 输入是宽泛学科/类别（如"数学""物理""高中化学"），需要先展示知识图谱供用户选择具体知识点。
- 产出一棵 2~3 层的树：根节点是学科名（title 用 canonicalTopic），一级分支是该学科下的主要方向/章节（如"物理"→力学/电磁学/热学/光学），二级分支是具体知识点（叶子，可点击直接生成）。
- **每个节点都必须带 category 字段**：根节点填该学科名（如"物理"）；分支节点若仍是同一学科就填同一学科名；若某分支本身是交叉学科或子学科（如"生物物理"），填它自己的学科名。这样后续按节点生成时能拿到正确的学科分类。
- 每个节点的 type 取英文值之一：concept / process / formula / timeline / compare / hierarchy / theorem。
- 节点 id 用稳定的英文/拼音 slug（如 "physics"、"physics-mechanics"、"physics-mechanics-kinematics"）。
- 叶子节点（无 children）的 topic 填该知识点的完整名称（用于点击后直接生成）。
- isSpecific=true 或 isKnowledgePoint=false 时，graphData 填 []（空数组）。

返回JSON：{"isSpecific": true/false, "isKnowledgePoint": true/false, "canonicalTopic": "核心知识点", "topic": "同canonicalTopic", "category": "所属学科（交叉学科取交叉归属，不便归类的填\"其他\"）", "knowledgeType": "concept/process/formula/timeline/compare/hierarchy/theorem", "graphData": [{"id":"root","title":"学科名","type":"hierarchy","category":"学科","children":[{"id":"branch1","title":"方向","type":"concept","category":"学科","children":[{"id":"leaf1","title":"知识点","type":"concept","category":"学科","topic":"知识点完整名"}]}]}]}`;
            const r = await self.callModelWithJSON<SearchAnalyzeResponse>(prompt, systemPrompt);
            // 归一化 graphData：AI 返回的图谱结构不可信（缺 category/type 非法/children 非数组），统一清洗
            if (r.data) {
              (r.data as any).graphData = sanitizeGraphData((r.data as any).graphData);
            }
            return r.data;
          },
          { isSpecific: true, isKnowledgePoint: true, canonicalTopic: '', topic: '', category: '', knowledgeType: 'concept' },
          'Search analyze'
        ),
        generate: withFallback(
          async (topic: string, context?: SearchAnalyzeResponse) => {
            const r = await self.callModelWithJSON<SearchGenerateResponse>(
              self.buildGeneratePrompt(topic, context),
              self.buildGenerateSystemPrompt(),
              'high'
            );
            // 全字段归一化：真实 AI 返回格式可能有偏差，统一清洗后再交给 UI
            const data = self.sanitizeGenerateResult(r.data, topic);
            if (r.truncated) data.truncated = true;
            if (r.truncated) data.interruption = createInterruption('length', { attempts: 1, resolved: false });
            return data;
          },
          { topic: '', mindMap: [], concepts: [], examples: [], relatedResults: [], knowledgeContext: { prerequisites: [], relatedTopics: [], learningPath: [] }, examQuestions: [], interestingFacts: [] },
          'Search generate',
          { strict: true }
        ),
        /**
         * 流式生成：一次调用，边生成边产出可渲染快照。
         *
         * 与 generate 共用同一份提示词和同一套清洗出口，
         * 因此"流式中途看到的"和"最终落库的"是同一套数据，不会打架。
         */
        generateStream: withFallback(
          async (
            topic: string,
            onPartial: (snapshot: StreamSnapshot<SearchGenerateResponse>) => void,
            signal?: AbortSignal,
            onReasoning?: (chunk: string) => void,
            context?: SearchAnalyzeResponse
          ) => {
            const parser = new StreamingJSONParser<any>();
            /**
             * 最后一份"解析成功、可渲染"的原始快照。
             *
             * 为什么需要它：增量解析允许任意截断位置（尾部补括号修复），
             * 但**恰好停在半个转义序列上**时那一瞬间是解析不出来的；如果流就在
             * 那一刻结束，`finish()` 拿不到 data —— 可前面明明已经吐出了成千上万字符。
             * 此时把整个结果判成"解析失败"是错误归因：用户看到的是
             * "内容都显示出来了，却在顶部弹出 JSON 解析失败的红色横幅"。
             */
            let lastRenderable: any = null;
            // 清洗节流：sanitizeGenerateResult 是全量深清洗（含 SVG 清洗等重活），
            // 若每个 SSE chunk（每秒可达数十个）都跑一遍，内容越大主线程越卡，
            // 渲染掉帧后用户看到的就是"憋半天然后一次性全出来"。统一按时间片产出快照。
            const EMIT_INTERVAL_MS = 80;
            let lastEmit = 0;
            const emit = (snap: { data: any; complete: boolean; completedKeys: string[] }) => {
              const now = Date.now();
              // 完整快照或距上次产出超过时间片 → 立即清洗并回调；否则等尾部补发
              if (snap.complete || now - lastEmit >= EMIT_INTERVAL_MS) {
                lastEmit = now;
                // 每个增量都过一遍清洗器：它对残缺数据同样安全（缺失字段自动补空）
                const cleaned = self.sanitizeGenerateResult(snap.data, topic);
                onPartial({
                  data: cleaned,
                  complete: snap.complete,
                  completedKeys: snap.completedKeys,
                });
              }
            };
            const streamResult = await self.callModelStreamWithContinuation(
              self.buildGeneratePrompt(topic, context),
              self.buildGenerateSystemPrompt(),
              'high',
              (chunk) => {
                const snap = parser.push(chunk);
                if (snap.data) {
                  // 记下最后一份可渲染快照：尾部若不可恢复，用它兜底而不是丢掉整段内容
                  lastRenderable = snap.data;
                  emit(snap);
                }
              },
              signal,
              // 续写判定 = 括号闭合 + 核心字段齐全（复用解析层权威判定）
              buildGenerateCompleteChecker(),
              (acc) => self.buildJSONContinuationPrompt(acc),
              MAX_GENERATION_ATTEMPTS,
              onReasoning
            );
            // 尾部补发：被节流跳过的最后一段增量，以 complete 快照强制产出一次（不丢尾部内容）
            const finalSnap = parser.finish();
            if (finalSnap.data) {
              emit({ data: finalSnap.data, complete: true, completedKeys: finalSnap.completedKeys });
            }

            /**
             * 以 `finish()` 的结果为准；尾部恰好不可恢复时回退到最后一份可渲染快照。
             *
             * 边界（用户实测暴露）：流结束时最后一次解析失败（例如正好停在半个转义序列上），
             * 但此前已产出并渲染了大量内容。这种情况**不是**"生成失败"，绝不能把
             * 已渲染的内容报废成一条技术性错误横幅 —— 正确归因是内容侧中断
             * （incomplete：末尾区块可能不完整），由 UI 在内容末尾分档提示。
             */
            const renderableData = finalSnap.data ?? lastRenderable;
            if (!renderableData) {
              // 全程一个字都没解析出来（连 JSON 起始符都没有）→ 明确抛错。
              // 严格模式下会透传为 success:false + code，UI 显示具体原因；
              // 绝不再吞成"成功但空数据"（那会让页面空白且毫无提示）。
              throw new GenerationInterruptedError(
                createInterruption('parse', {
                  detail: `流式生成结束但未解析出有效 JSON（已收到 ${streamResult.content.length} 字符）`,
                  attempts: streamResult.attempts,
                  continued: streamResult.continued,
                }),
                `流式生成结束但未解析出有效 JSON（已收到 ${streamResult.content.length} 字符）`,
                streamResult.content
              );
            }

            const data = self.sanitizeGenerateResult(renderableData, topic);
            // 达到次数上限后仍不完整 / 被链路中断 / 尾部不可恢复 → truncated 让 UI 提示末尾可能不完整
            if (streamResult.truncated || !finalSnap.data) data.truncated = true;
            if (streamResult.continued) data.continued = true;
            // 中断归因（kind/side/attempts/resolved）→ UI 按原因分档提示，而不是一律说"输出上限"
            if (streamResult.interruption) {
              data.interruption = streamResult.interruption;
            } else if (!finalSnap.data) {
              data.interruption = createInterruption('incomplete', {
                detail: `流式生成结束但尾部 JSON 不可恢复，已保留最后一份可渲染内容（已收到 ${streamResult.content.length} 字符）`,
                attempts: streamResult.attempts,
                continued: streamResult.continued,
              });
            }
            return data;
          },
          (args: any) => {
            const [topic] = args as [string];
            return { topic, mindMap: [], concepts: [], examples: [], relatedResults: [], knowledgeContext: { prerequisites: [], relatedTopics: [], learningPath: [] }, examQuestions: [], interestingFacts: [] };
          },
          'Search generateStream',
          { strict: true }
        ),
        followup: withFallback(
          async (topic: string, question: string, history: FollowupMessage[], mode?: 'search' | 'qa') => {
            const r = await self.callModelWithJSON<SearchFollowupResponse>(
              self.buildFollowupPrompt(topic, question, history, mode),
              self.buildFollowupSystemPrompt(topic, mode)
            );
            return r.data;
          },
          { reply: '抱歉，我无法回答这个问题。', relatedKnowledge: [] },
          'Search followup'
        ),
        /** 流式追问：逐字吐出 reply，UI 边收边渲染 */
        followupStream: withFallback(
          async (
            topic: string,
            question: string,
            history: FollowupMessage[],
            mode: 'search' | 'qa' | undefined,
            onDelta: (partial: { reply: string; complete: boolean }) => void,
            signal?: AbortSignal
          ) => {
            const parser = new StreamingJSONParser<SearchFollowupResponse>();
            let latestReply = '';
            await self.callModelStreamWithContinuation(
              self.buildFollowupPrompt(topic, question, history, mode),
              self.buildFollowupSystemPrompt(topic, mode),
              'medium',
              (chunk) => {
                const snap = parser.push(chunk);
                const reply = snap.data?.reply;
                if (typeof reply === 'string' && reply !== latestReply) {
                  latestReply = reply;
                  onDelta({ reply, complete: snap.complete });
                }
              },
              signal,
              (acc) => hasCompleteJSONObject(acc),
              (acc) => self.buildJSONContinuationPrompt(acc)
            );
            const finalSnap = parser.finish();
            const finalReply = typeof finalSnap.data?.reply === 'string' && finalSnap.data.reply
              ? finalSnap.data.reply
              : latestReply;
            if (finalReply !== latestReply) onDelta({ reply: finalReply, complete: true });
            const related = (finalSnap.data?.relatedKnowledge ?? []) as SearchFollowupResponse['relatedKnowledge'];
            return { reply: finalReply, relatedKnowledge: related };
          },
          { reply: '抱歉，我无法回答这个问题。', relatedKnowledge: [] },
          'Search followupStream',
          { strict: true }
        ),
      },
      translate: {
        /** 仅检测源语言（不检测目标语言，目标语言由用户设置决定） */
        detect: withFallback(
          async (text: string) => {
            const systemPrompt = '你是一个语言检测助手。只负责判断文本的源语言，不要翻译，不要改写。';
            const prompt = `请检测以下文本的源语言，并判断它是"单词"还是"短语/多词"。

文本：
"""
${text}
"""

返回JSON格式：{"sourceLang": "语言代码", "isPhrase": true/false, "confidence": 0.0~1.0}
注意：
- sourceLang 必须返回下列语言代码之一，不要返回中文名或英文名：
  zh, en, ja, ko, fr, de, es, ru, pt, it, ar, th, vi, hi
- isPhrase：文本含多个词、短语或短句时为 true；仅一个词时为 false`;
            const r = await self.callModelWithJSON<TranslateDetectResponse>(prompt, systemPrompt);
            const raw = r.data as any;
            return {
              sourceLang: normalizeLanguage(raw?.sourceLang, inferSourceLangByScript(text)),
              isPhrase: typeof raw?.isPhrase === 'boolean' ? raw.isPhrase : defaultIsPhrase(text),
              confidence: typeof raw?.confidence === 'number' ? raw.confidence : 0.9,
            };
          },
          (args: any) => {
            const [text] = args as [string];
            return {
              sourceLang: inferSourceLangByScript(text),
              isPhrase: defaultIsPhrase(text),
              confidence: 0.9,
            };
          },
          'Translate detect'
        ),
        /** 查词：支持单词，也支持短语/多词（此时额外给出最多 10 个关键词） */
        queryWord: withFallback(
          async (word: string, sourceLang: string, targetLang: string) => {
            const src = languageEnglish(normalizeLanguage(sourceLang, inferSourceLangByScript(word)));
            const tgt = languageEnglish(normalizeLanguage(targetLang, getAIContentLanguage()));
            const systemPrompt = `你是一个专业词典助手，精通 ${src} 与 ${tgt}。请给出准确、丰富的词典释义。`;
            const prompt = `请查询以下内容（可能是单词，也可能是短语/多词）的详细释义。

源语言：${src}
释义语言：${tgt}

内容：
"""
${word}
"""

请严格按照以下JSON格式返回：
{
  "word": "查询内容原样",
  "isPhrase": true/false,
  "phonetic": "音标（短语可留空字符串）",
  "definitions": [
    { "pos": "词性/用法标签", "meaning": "释义（用${tgt}编写）", "example": { "en": "例句原文", "zh": "例句译文（用${tgt}编写）" } }
  ],
  "keywords": ["关键词1", "..."],
  "synonyms": ["近义表达"],
  "antonyms": ["反义表达"],
  "relatedTerms": ["关联术语"],
  "collocations": ["常用搭配"],
  "register": "语域说明（正式/非正式/学术/口语）",
  "etymology": "词源说明（可为空字符串）",
  "image": "配图直链（可为空字符串）",
  "imageQuery": "配图检索关键词（可为空字符串）"
}

要求：
1. 释义与例句翻译一律使用${tgt}
2. isPhrase 为 true（短语/多词）时，必须额外给出 keywords：把该短语/句子拆解为最值得单独学习的**关键词/核心词**（保持源语言原形），**最多 10 个**，按重要性排序；单词查询时 keywords 返回空数组
3. 例句要地道、贴合真实用法，尽量给出常用搭配
4. **配图（放宽处理，交给 AI）**：
   - image：能确定一张真实存在、能直接访问的配图直链（实物图/概念图，来自维基百科/Commons/教材官网等可靠来源）时**应该**填写；拿不准时**应该**留空字符串（交给 imageQuery 兜底检索），**而不是**编造 URL
   - imageQuery：无论是否给出 image，都给出 1~2 个最能命中该词条配图的中文或英文检索关键词（例如"苹果 实物图"或"apple fruit"），供程序在拿不到直链时兜底生图/检索；抽象虚词可填空字符串`;
            const r = await self.callModelWithJSON<DictionaryQueryResponse>(prompt, systemPrompt);
            const raw = r.data as any;
            const defs = Array.isArray(raw?.definitions)
              ? raw.definitions
                  .map((d: any) => ({
                    pos: asStr(d?.pos),
                    meaning: asStr(d?.meaning),
                    example: d?.example
                      ? {
                          en: asStr(d.example.en ?? d.example.source ?? ''),
                          zh: asStr(d.example.zh ?? d.example.target ?? d.example.translation ?? ''),
                        }
                      : undefined,
                  }))
                  .filter((d: any) => d.meaning || d.pos)
              : [];
            const keywords = toStringList(raw?.keywords).slice(0, 10);
            return {
              word: asStr(raw?.word) || word,
              isPhrase: typeof raw?.isPhrase === 'boolean' ? raw.isPhrase : defaultIsPhrase(word),
              phonetic: asStr(raw?.phonetic),
              definitions: defs.length > 0 ? defs : [{ pos: '', meaning: '暂无释义，请换一个词试试' }],
              keywords: keywords.length > 0 ? keywords : undefined,
              synonyms: toStringList(raw?.synonyms),
              antonyms: toStringList(raw?.antonyms),
              relatedTerms: toStringList(raw?.relatedTerms),
              collocations: toStringList(raw?.collocations),
              register: asStr(raw?.register),
              etymology: asStr(raw?.etymology),
              image: isImageURL(raw?.image) ? raw.image : undefined,
              imageQuery: asStr(raw?.imageQuery ?? raw?.image_query ?? raw?.imageSearch).trim() || undefined,
            };
          },
          (args: any) => {
            const [word] = args as [string];
            return {
              word,
              isPhrase: defaultIsPhrase(word),
              phonetic: '',
              definitions: [{ pos: '', meaning: '暂无该内容的释义，请稍后重试' }],
              keywords: [],
              synonyms: [],
              antonyms: [],
              relatedTerms: [],
              collocations: [],
              register: '',
              etymology: '',
              image: undefined,
              imageQuery: undefined,
            };
          },
          'Query word'
        ),
        /** 翻译：额外返回 segments（逐段对齐），供"选词标记的实时映射" */
        queryTranslate: withFallback(
          async (text: string, sourceLang: string, targetLang: string, style?: TranslateStyle) => {
            const srcCode = normalizeLanguage(sourceLang, inferSourceLangByScript(text));
            const tgtCode = normalizeLanguage(targetLang, getAIContentLanguage());
            const src = languageEnglish(srcCode);
            const tgt = languageEnglish(tgtCode);
            const styleLabel = TRANSLATE_STYLE_LABELS[style || 'casual'] || TRANSLATE_STYLE_LABELS.casual;
            const systemPrompt = `你是一个专业翻译助手，精通 ${src} 与 ${tgt}。请提供准确、自然的翻译，并做逐段对齐与要点分析。`;
            const prompt = `请将以下文本从${src}翻译到${tgt}，翻译风格：${styleLabel}

原文：
"""
${text}
"""

请返回JSON，字段如下：
- original: 原文（原样）
- translation: 译文（保持指定风格，用${tgt}书写）
- style: "academic" | "business" | "casual"
- sourceLang: "${srcCode}"
- targetLang: "${tgtCode}"
- segments: **原文↔译文的对照表，这是重点**。把原文切成若干"词 / 词组 / 短语"块，逐块给出对应译文，并给每一块填一个 key：
  · key 从 1 开始，按该块**在原文中出现的先后顺序**依次编号（1、2、3…）；同一组对照的 source 与 target 用同一个 key；
  · source 必须是原文里的**原样子串**（该带空格、标点就带上），target 是它对应的译文片段；
  · 不同语言的语序可以完全相反，译文的先后顺序**不需要与原文一致**。例如 Good morning → 早上好，应给 key1 = Good/好、key2 = morning/早上（key1 的译文反而排在 key2 后面）——**不要为了顺序好看改写译文**；
  · 粒度要细到词 / 词组 / 短语，通常 3-20 块，**不要整句一块**，否则高亮失去意义；
  · 不便于对照的虚词、标点**不要放进来**（界面上表现为不高亮，属正常）。
- relatedTerms: 3-5 个关联术语（用${tgt}）
- keywords: 3-6 个关键词
- grammarNotes: 2-3 条语法或选词说明（用${tgt}）

示例：{"original":"Good morning","translation":"早上好","style":"casual","sourceLang":"en","targetLang":"zh","segments":[{"key":1,"source":"Good","target":"好"},{"key":2,"source":"morning","target":"早上"}],"relatedTerms":["greeting"],"keywords":["good","morning"],"grammarNotes":["问候语气"]}`;
            const r = await self.callModelWithJSON<TranslateQueryResponse>(prompt, systemPrompt);
            const raw = r.data as any;
            const segments = Array.isArray(raw?.segments)
              ? raw.segments
                  .map((s: any) => ({ key: asKey(s?.key), source: asStr(s?.source), target: asStr(s?.target) }))
                  // 无键（key = 0）或两侧都空的条目直接丢掉 —— 前端只按 key 配对
                  .filter((s: any) => s.key > 0 && s.source && s.target)
                  .slice(0, 300)
              : [];
            const styleRaw = asStr(raw?.style);
            return {
              original: asStr(raw?.original) || text,
              translation: asStr(raw?.translation) || text,
              style: (['academic', 'business', 'casual'].includes(styleRaw) ? styleRaw : (style || 'casual')) as TranslateStyle,
              sourceLang: srcCode,
              targetLang: tgtCode,
              segments: segments.length > 0 ? segments : undefined,
              relatedTerms: toStringList(raw?.relatedTerms),
              keywords: toStringList(raw?.keywords),
              grammarNotes: toStringList(raw?.grammarNotes),
            };
          },
          (args: any) => {
            const [text, , targetLang, style] = args as [string, string, string, TranslateStyle | undefined];
            return {
              original: text,
              translation: text,
              style: style || 'casual',
              sourceLang: inferSourceLangByScript(text),
              targetLang: normalizeLanguage(targetLang, getAIContentLanguage()),
              // 兜底路径拿不到对照关系（原文即译文），宁可不给 segments，也不给假配对
              segments: undefined,
              relatedTerms: [],
              keywords: [],
              grammarNotes: [],
            };
          },
          'Query translate'
        ),
      },
      document: {
        generate: withFallback(
          async (type: DocType, topic: string, requirements?: string, tone?: EmailTone) => {
            const r = await self.callModelWithJSON<DocumentGenerateResponse>(
              self.buildDocPrompt(type, topic, requirements, tone),
              self.buildDocSystemPrompt(),
              'high'
            );
            return r.data;
          },
          (args: any) => {
            const [type, topic, , tone] = args as [DocType, string, string | undefined, EmailTone | undefined];
            return {
              type,
              title: topic,
              content: `# ${topic}\n\n文档生成失败，请重试。`,
              tone,
            };
          },
          'Document generate',
          { strict: true }
        ),
        /** 流式文档生成：markdown 正文边生成边渲染 */
        generateStream: withFallback(
          async (
            type: DocType,
            topic: string,
            requirements: string | undefined,
            tone: EmailTone | undefined,
            onPartial: (partial: Partial<DocumentGenerateResponse> & { complete: boolean }) => void,
            signal?: AbortSignal
          ) => {
            const systemPrompt = self.buildDocSystemPrompt();
            const parser = new StreamingJSONParser<DocumentGenerateResponse>();
            let latestContent = '';
            let latestTitle = '';
            const streamResult = await self.callModelStreamWithContinuation(
              self.buildDocPrompt(type, topic, requirements, tone),
              systemPrompt,
              'high',
              (chunk) => {
                const snap = parser.push(chunk);
                if (!snap.data) return;
                const content = typeof snap.data.content === 'string' ? snap.data.content : latestContent;
                const title = typeof snap.data.title === 'string' ? snap.data.title : latestTitle;
                if (content === latestContent && title === latestTitle) return;
                latestContent = content;
                latestTitle = title;
                onPartial({
                  type,
                  title,
                  content,
                  tone,
                  complete: snap.complete,
                });
              },
              signal,
              (acc) => hasCompleteJSONObject(acc),
              (acc) => self.buildJSONContinuationPrompt(acc),
              MAX_GENERATION_ATTEMPTS
            );
            const finalSnap = parser.finish();
            const result: DocumentGenerateResponse = {
              type,
              title: finalSnap.data?.title || latestTitle || topic,
              content: finalSnap.data?.content || latestContent,
              tone,
            };
            // 文档同样要把"是否被中断"透出给 UI（此前完全没接，用户只能看到半截正文且零提示）
            if (streamResult.truncated) result.truncated = true;
            if (streamResult.continued) result.continued = true;
            if (streamResult.interruption) result.interruption = streamResult.interruption;
            onPartial({ ...result, complete: true });
            return result;
          },
          (args: any) => {
            const [type, topic, , tone] = args as [DocType, string, string | undefined, EmailTone | undefined];
            return {
              type,
              title: topic,
              content: `# ${topic}\n\n文档生成失败，请重试。`,
              tone,
            };
          },
          'Document generateStream',
          { strict: true }
        ),
        export: async (content: string, format: ExportFormat, metadata?: { title: string }) => {
          return successResponse({
            blob: new Blob([content], { type: 'text/plain' }),
            filename: `${metadata?.title || 'document'}.${format}`,
            format,
          });
        },
      },
    };
  }
}
