import { useState, useCallback, useRef } from 'react';
import { aiService } from '../../services/aiServiceProvider';
import { getCurrentStrings } from '../../i18n/strings';
import { sanitizeConcepts, sanitizeKnowledgeContext, sanitizeExamQuestions, sanitizeInterestingFacts } from '../../services/baseAIProvider';
import { classifyThrown, interruptionFromCode } from '../../services/streaming/interruption';
import {
  SearchValidateResponse,
  SearchAnalyzeResponse,
  SearchGenerateResponse,
  KnowledgeGraphNode,
  ChatMessage,
  FollowupMessage,
} from '../../types';

export type SearchState =
  | 'IDLE'
  | 'VALIDATING'
  | 'INVALID'
  | 'ANALYZING'
  | 'KNOWLEDGE_GRAPH'
  | 'GENERATING'
  | 'DISPLAYING'
  | 'FOLLOWUP';

interface StateMachineContext {
  state: SearchState;
  query: string;
  canonicalTopic?: string;
  validationResult?: SearchValidateResponse;
  analysisResult?: SearchAnalyzeResponse;
  graphData?: KnowledgeGraphNode[];
  generatedData?: SearchGenerateResponse;
  /** 当前正在渲染的步骤，用于 UI 显示准确的 loading 文案 */
  generatingStep?: GeneratingStep;
  /**
   * 首字到达前的等待状态：模型（尤其思考型）可能几十秒不给正文，
   * 此时用 thinking=true + startedAt 让 UI 显示"模型思考中…（已 Ns）"，
   * 避免界面长时间零反馈被误认为卡死。
   */
  thinking?: boolean;
  /** 生成开始时间戳（用于计算已等待时长） */
  generateStartedAt?: number;
  followupMessages: ChatMessage[];
  error?: string;
}

/**
 * 生成步骤（与提示词里 JSON 字段产出顺序一致）。
 * 页面顺序 = 生成顺序：summary → mindMap → concepts → …，
 * 这样流式渲染时内容是从上往下"长"出来的，不会出现先出图后补文字的跳动。
 */
export type GeneratingStep =
  | 'summary'
  | 'overview'
  | 'mindMap'
  | 'concepts'
  | 'knowledgeContext'
  | 'examQuestions'
  | 'interestingFacts';

interface StateMachineActions {
  search: (query: string) => Promise<void>;
  selectGraphNode: (node: KnowledgeGraphNode) => Promise<void>;
  followup: (question: string) => Promise<void>;
  reset: () => void;
  setQuery: (query: string) => void;
  restoreFromSession: (query: string, generatedData: SearchGenerateResponse, messages: ChatMessage[]) => void;
}

interface UseSearchStateMachineOptions {
  onRedirectToQA?: (query: string) => void;
  /**
   * 已有历史会话查询：analyze 得出 canonicalTopic 后、生成前调用。
   * 返回已存在的会话（generatedData + messages）则直接恢复，跳过重新生成；
   * 返回 undefined 则正常生成。这样"查历史"用的是归一化主题，而非原始输入。
   */
  findExistingSession?: (canonicalTopic: string) => { generatedData: SearchGenerateResponse; messages: ChatMessage[] } | undefined;
}

/**
 * 合并流式快照。
 *
 * 增量解析偶尔会"回退"（例如字符串尾部正好停在转义符上，全长解析失败
 * 后退回上一个安全切割点），因此这里只在**新值非空**时才覆盖旧值，
 * 保证已经渲染出来的内容不会因为一次解析抖动而闪回。
 */
function mergeSnapshot(
  prev: SearchGenerateResponse | undefined,
  incoming: SearchGenerateResponse
): SearchGenerateResponse {
  if (!prev) return incoming;
  const pickArr = <T,>(a: T[] | undefined, b: T[] | undefined): T[] => (b && b.length > 0) ? b : (a ?? []);
  const pickStr = (a: string | undefined, b: string | undefined): string => (b && b.length > 0) ? b : (a ?? '');
  const kc = incoming.knowledgeContext;
  const kcHasContent = !!kc && (
    (kc.prerequisites?.length ?? 0) > 0 ||
    (kc.relatedTopics?.length ?? 0) > 0 ||
    (kc.learningPath?.length ?? 0) > 0 ||
    (kc.commonConclusions?.length ?? 0) > 0
  );
  return {
    ...prev,
    ...incoming,
    topic: incoming.topic || prev.topic,
    summary: pickStr(prev.summary, incoming.summary),
    conceptsOverview: pickStr(prev.conceptsOverview, incoming.conceptsOverview),
    mindMap: pickArr(prev.mindMap, incoming.mindMap),
    concepts: pickArr(prev.concepts, incoming.concepts),
    examples: pickArr(prev.examples, incoming.examples),
    relatedResults: pickArr(prev.relatedResults, incoming.relatedResults),
    knowledgeContext: kcHasContent ? kc : prev.knowledgeContext,
    examQuestions: pickArr(prev.examQuestions, incoming.examQuestions),
    interestingFacts: pickArr(prev.interestingFacts, incoming.interestingFacts),
  };
}

/** knowledgeContext 里是否有任何实质内容（各子字段任一非空即视为有内容） */
function knowledgeContextHasContent(kc?: SearchGenerateResponse['knowledgeContext']): boolean {
  if (!kc) return false;
  return (
    (kc.prerequisites?.length ?? 0) > 0 ||
    (kc.relatedTopics?.length ?? 0) > 0 ||
    (kc.learningPath?.length ?? 0) > 0 ||
    (kc.commonConclusions?.length ?? 0) > 0 ||
    (kc.confusables?.length ?? 0) > 0
  );
}

/**
 * 快照里是否有"可展示内容"。
 * 覆盖所有实质字段（summary / conceptsOverview / mindMap / concepts / examples /
 * relatedResults / knowledgeContext / examQuestions / interestingFacts），
 * 任一非空即视为"有内容"。
 * —— 之前只认 summary/mindMap/concepts 三者，模型若只产出 knowledgeContext / examQuestions /
 *    interestingFacts（前三者恰好为空）会被误判为"无内容" → 页面空白。这是真实边界漏洞。
 */
function hasUsableContent(d?: SearchGenerateResponse): boolean {
  return !!d && (
    !!d.summary ||
    !!d.conceptsOverview ||
    (d.mindMap?.length ?? 0) > 0 ||
    (d.concepts?.length ?? 0) > 0 ||
    (d.examples?.length ?? 0) > 0 ||
    (d.relatedResults?.length ?? 0) > 0 ||
    knowledgeContextHasContent(d.knowledgeContext) ||
    (d.examQuestions?.length ?? 0) > 0 ||
    (d.interestingFacts?.length ?? 0) > 0
  );
}

/** 区块产出顺序（与提示词里 JSON 字段顺序、页面渲染顺序三者一致），用于推导"正在生成哪一块" */
const STEP_ORDER: Array<[string, GeneratingStep]> = [
  ['summary', 'summary'],
  ['mindMap', 'mindMap'],
  // 总述属于「核心概念」区块（渲染在核心概念标题下），因此紧跟 mindMap、排在 concepts 之前
  ['conceptsOverview', 'overview'],
  ['concepts', 'concepts'],
  ['knowledgeContext', 'knowledgeContext'],
  ['examQuestions', 'examQuestions'],
  ['interestingFacts', 'interestingFacts'],
];

/** 把流式中的助手消息插入/更新到消息列表（同一条消息原地增长，避免刷屏） */
function upsertStreamMessage(messages: ChatMessage[], id: string, content: string): ChatMessage[] {
  const idx = messages.findIndex(m => m.id === id);
  if (idx === -1) {
    return [...messages, { id, role: 'assistant' as const, content, timestamp: Date.now() }];
  }
  const next = [...messages];
  next[idx] = { ...next[idx], content };
  return next;
}

/** 根据已完成的字段，推导当前正在写哪一块（UI 展示用） */
function deriveStep(completedKeys: string[]): GeneratingStep | undefined {
  for (const [key, step] of STEP_ORDER) {
    if (!completedKeys.includes(key)) return step;
  }
  return 'interestingFacts';
}

/** 渲染节流间隔（ms）：网络 chunk 可能非常碎，没必要每个都触发一次 React 渲染 */
const RENDER_THROTTLE_MS = 60;

/**
 * 把底层错误码 / 错误消息映射为用户可读的友好文案。
 *
 * 关键：所有中断（超时/网络/协议/模型上限/安全策略/HTTP 错误）现在都由 withFallback
 * 以 success:false + 标准 code 透传，这里按 code 给出**可操作**的提示，
 * 而不是把技术性原始消息（如"首字节超时：60000ms 内未收到任何数据"）直接甩给用户，
 * 也不是把所有失败都说成笼统的"生成失败"。
 */
function toFriendlyError(code: string | undefined, rawMessage: string | undefined): string {
  const e = getCurrentStrings().search.errors;
  switch (code) {
    case 'STREAM_TIMEOUT':
      return e.firstByteTimeout;
    case 'STREAM_NETWORK':
      return e.networkError;
    case 'STREAM_PROTOCOL':
      return e.streamProtocol;
    case 'STREAM_ABORTED':
      return e.cancelled;
    case 'STREAM_INCOMPLETE':
    case 'OUTPUT_TRUNCATED':
      return e.incomplete;
    case 'GENERATE_FAILED':
      // 内容侧解析失败：技术细节（"已收到 N 字符"）只进 interruption.detail 供排查，
      // 不给用户看 —— 用户要的是"没写完，怎么处理"，不是解析器内部状态。
      return e.generateFailed;
    case 'CONTENT_FILTERED':
      return e.contentFiltered;
    case 'INVALID_API_KEY':
      return e.invalidApiKey;
    case 'QUOTA_EXCEEDED':
      return e.quotaExceeded;
    case 'RATE_LIMITED':
      return e.rateLimited;
    case 'SERVER_ERROR':
      return e.serverError;
    default:
      return rawMessage || e.generateError;
  }
}

export function useSearchStateMachine(options?: UseSearchStateMachineOptions): [StateMachineContext, StateMachineActions] {
  const [context, setContext] = useState<StateMachineContext>({
    state: 'IDLE',
    query: '',
    followupMessages: [],
  });

  const setContextWithUpdate = useCallback((updates: Partial<StateMachineContext> | ((prev: StateMachineContext) => Partial<StateMachineContext>)) => {
    setContext(prev => {
      const resolvedUpdates = typeof updates === 'function' ? updates(prev) : updates;
      return { ...prev, ...resolvedUpdates };
    });
  }, []);

  /** 取消控制器：重新搜索 / 重置时，中断仍在进行的流式请求 */
  const abortRef = useRef<AbortController | null>(null);

  /**
   * 流式生成：一次调用，AI 边写、渲染边读共享缓冲区里的快照。
   *
   * 与旧的"等全文回来再分 6 块依次弹出"不同，这里是真流式 ——
   * 第一个字段成形就会出现在界面上，后续内容持续追加。
   *
   * @returns 是否生成出了有效内容
   */
  const runGenerate = useCallback(async (topic: string, context?: SearchAnalyzeResponse): Promise<boolean> => {
    // 中断上一次未完成的流式请求，避免两次结果交错写入
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setContextWithUpdate({
      state: 'GENERATING',
      generatedData: undefined,
      generatingStep: undefined,
      followupMessages: [],
      thinking: true,
      generateStartedAt: Date.now(),
    });

    let latest: SearchGenerateResponse | undefined;
    let lastRenderAt = 0;
    let reasoningSeen = false;

    try {
      const res = await aiService.search.generateStream(
        topic,
        (snap) => {
          latest = mergeSnapshot(latest, snap.data);
          const now = Date.now();
          // 网络 chunk 可能很碎，节流避免每个字符都触发一次 React 渲染
          if (snap.complete || now - lastRenderAt >= RENDER_THROTTLE_MS) {
            lastRenderAt = now;
            const data = latest;
            const step = deriveStep(snap.completedKeys);
            // 正文首字已到 → 思考阶段结束
            setContextWithUpdate({ generatedData: data, generatingStep: step, thinking: false });
          }
        },
        controller.signal,
        // 思维链：模型在思考但正文还没开始。只在首次收到时标记一次
        // （高频回调，绝不能每个分片都 setState）
        () => {
          if (!reasoningSeen) {
            reasoningSeen = true;
            setContextWithUpdate({ thinking: true });
          }
        },
        context
      );

      if (controller.signal.aborted) return false;

      if (!res.success || !res.data) {
        // AI 报错但可能已流出部分 JSON → 把已收到的部分展示出来，避免界面永远卡"正在生成思维导图..."
        // 关键：把**中断归因**挂到已展示的数据上，由内容末尾的分档提示说明"为什么没写完"
        // （网络中断 / 超时 / 模型上限），而不是在内容上方压一条技术性错误横幅。
        // 技术细节保留在 `interruption.detail` 里（可观测），不进用户视野。
        if (hasUsableContent(latest)) {
          const partial = latest!;
          setContextWithUpdate({
            state: 'DISPLAYING',
            generatedData: partial.interruption
              ? partial
              : { ...partial, interruption: interruptionFromCode(res.error?.code, res.error?.message) },
            followupMessages: [],
            error: undefined,
            generatingStep: undefined,
            thinking: false,
          });
          return true;
        }
        // 没有任何可展示内容：只要服务层给了明确 code 就写具体原因；
        // 否则返回 false 交给上层 search() 兜底写"生成失败"。
        if (res.error?.code) {
          setContextWithUpdate({
            state: 'IDLE',
            error: toFriendlyError(res.error.code, res.error.message),
            generatingStep: undefined,
            generatedData: undefined,
            thinking: false,
          });
        }
        return false;
      }

      // 以服务端最终结果为基准再合并一次，确保被节流跳过的尾部内容不丢
      const finalData = mergeSnapshot(latest, res.data);
      if (!hasUsableContent(finalData)) {
        // 全空：没有任何可展示的内容。显式写"生成失败"并回 IDLE，不要渲染空卡片、
        // 也不要依赖上层 search() 的 prev.error 兜底（那样既脆弱又可能残留旧错误）。
        setContextWithUpdate({
          state: 'IDLE',
          error: getCurrentStrings().search.errors.generateFailed,
          generatingStep: undefined,
          generatedData: undefined,
          thinking: false,
        });
        return false;
      }

      setContextWithUpdate({
        state: 'DISPLAYING',
        generatedData: finalData,
        followupMessages: [],
        error: undefined,
        generatingStep: undefined,
        thinking: false,
      });
      return true;
    } catch (err) {
      // 任何异常（JSON 修复失败、网络断开、sanitize 报错、首字节超时...）→ 绝不让界面卡在"生成中"
      // 统一走分类器：拿得到标准 code 就用本地化文案，拿不到才回落到原始消息。
      const info = classifyThrown(err);
      const errorMessage = toFriendlyError(info.code, info.detail ?? (err instanceof Error ? err.message : undefined));
      if (latest) {
        // 同上：已渲染的内容照常展示，原因由内容末尾的中断提示承载，不再叠一条错误横幅
        setContextWithUpdate({
          state: 'DISPLAYING',
          generatedData: latest.interruption ? latest : { ...latest, interruption: info },
          followupMessages: [],
          error: undefined,
          generatingStep: undefined,
          thinking: false,
        });
        return true;
      }
      setContextWithUpdate({
        state: 'IDLE',
        error: errorMessage,
        generatingStep: undefined,
        generatedData: undefined,
        // 关键：清掉 thinking，否则 UI 会继续显示"模型正在思考…"秒表
        thinking: false,
      });
      return false;
    }
  }, [setContextWithUpdate]);

  const search = useCallback(async (query: string) => {
    try {
      setContextWithUpdate({
        state: 'VALIDATING',
        query,
        canonicalTopic: undefined,
        generatedData: undefined,
        followupMessages: [],
        error: undefined,
      });

      const validateResponse = await aiService.search.validate(query);
      if (!validateResponse.success) {
        setContextWithUpdate({
          state: 'IDLE',
          error: validateResponse.error?.message || getCurrentStrings().common.aiKeyRequired,
        });
        return;
      }
      if (!validateResponse.data?.valid) {
        setContextWithUpdate({
          state: 'INVALID',
          validationResult: validateResponse.data,
        });
        return;
      }

      setContextWithUpdate({ state: 'ANALYZING', validationResult: validateResponse.data });

      const analyzeResponse = await aiService.search.analyze(query);
      if (!analyzeResponse.success || !analyzeResponse.data) {
        setContextWithUpdate({ state: 'IDLE', error: getCurrentStrings().search.errors.analyzeFailed });
        return;
      }

      const analysisResult = analyzeResponse.data;
      setContextWithUpdate({ analysisResult });

      // 非知识点 → 自动切换到问答模式
      if (analysisResult.isKnowledgePoint === false) {
        setContextWithUpdate({ state: 'IDLE' });
        options?.onRedirectToQA?.(query);
        return;
      }

      const canonicalTopic = analysisResult.canonicalTopic || query;
      setContextWithUpdate({ canonicalTopic });

      // 先按归一化主题查已有历史会话：命中则直接恢复，不再重复生成
      const existing = options?.findExistingSession?.(canonicalTopic);
      if (existing?.generatedData) {
        setContextWithUpdate({
          state: 'DISPLAYING',
          canonicalTopic,
          generatedData: existing.generatedData,
          followupMessages: existing.messages || [],
          error: undefined,
          generatingStep: undefined,
          thinking: false,
        });
        return;
      }

      if (analysisResult.isSpecific) {
        const ok = await runGenerate(canonicalTopic, analysisResult);
        if (!ok) {
          // runGenerate 在异常路径里已写入更具体的错误（如异常消息），这里不要覆盖它
          setContextWithUpdate(prev => ({ state: 'IDLE', error: prev.error || getCurrentStrings().search.errors.generateFailed }));
          return;
        }
      } else {
        setContextWithUpdate({
          state: 'KNOWLEDGE_GRAPH',
          graphData: analysisResult.graphData,
        });
      }
    } catch (err) {
      setContextWithUpdate({ state: 'IDLE', error: err instanceof Error ? err.message : getCurrentStrings().search.errors.unknownError });
    }
  }, [setContextWithUpdate, options, runGenerate]);

  const selectGraphNode = useCallback(async (node: KnowledgeGraphNode) => {
    try {
      const topic = node.topic || node.title;
      setContextWithUpdate({ state: 'GENERATING', query: topic, canonicalTopic: topic, generatedData: undefined, generatingStep: undefined });

      const ctx: SearchAnalyzeResponse = {
        isSpecific: true,
        isKnowledgePoint: true,
        canonicalTopic: topic,
        topic,
        knowledgeType: node.type,
        category: node.category,
      };

      const ok = await runGenerate(topic, ctx);
      if (!ok) {
        setContextWithUpdate({ state: 'KNOWLEDGE_GRAPH', error: getCurrentStrings().search.errors.generateFailed });
        return;
      }
    } catch (err) {
      setContextWithUpdate({ state: 'KNOWLEDGE_GRAPH', error: err instanceof Error ? err.message : getCurrentStrings().search.errors.unknownError });
    }
  }, [runGenerate, setContextWithUpdate]);

  const followup = useCallback(async (question: string) => {
    if (!context.query || !context.generatedData) return;

    try {
      const userMessage: ChatMessage = {
        id: Date.now().toString(),
        role: 'user',
        content: question,
        timestamp: Date.now(),
      };

      const history: FollowupMessage[] = context.followupMessages.map(m => ({
        role: m.role,
        content: m.content,
      }));

      setContextWithUpdate({
        state: 'FOLLOWUP',
        followupMessages: [...context.followupMessages, userMessage],
      });

      // 先占位一条空助手消息，后续流式增量原地更新它
      const streamId = `assistant-${Date.now()}`;
      let lastRenderAt = 0;

      const followupResponse = await aiService.search.followupStream(
        context.query,
        question,
        history,
        'search',
        (delta) => {
          const now = Date.now();
          if (delta.complete || now - lastRenderAt >= RENDER_THROTTLE_MS) {
            lastRenderAt = now;
            const reply = delta.reply;
            setContextWithUpdate(prev => ({
              followupMessages: upsertStreamMessage(prev.followupMessages, streamId, reply),
            }));
          }
        }
      );

      if (!followupResponse.success || !followupResponse.data) {
        setContextWithUpdate({ state: 'DISPLAYING', error: getCurrentStrings().search.errors.followUpFailed });
        return;
      }

      setContextWithUpdate(prev => ({
        state: 'DISPLAYING',
        followupMessages: upsertStreamMessage(prev.followupMessages, streamId, followupResponse.data!.reply),
      }));
    } catch (err) {
      setContextWithUpdate({ state: 'DISPLAYING', error: err instanceof Error ? err.message : getCurrentStrings().search.errors.unknownError });
    }
  }, [context.query, context.generatedData, context.followupMessages, setContextWithUpdate]);

  const reset = useCallback(() => {
    // 中断仍在进行的流式请求，避免旧结果覆盖重置后的界面
    abortRef.current?.abort();
    abortRef.current = null;
    setContext({
      state: 'IDLE',
      query: '',
      followupMessages: [],
    });
  }, []);

  const setQuery = useCallback((query: string) => {
    setContextWithUpdate({ query });
  }, [setContextWithUpdate]);

  const restoreFromSession = useCallback((query: string, raw: SearchGenerateResponse, messages: ChatMessage[]) => {
    // 旧版本 localStorage 会话可能存有格式偏差的数据，恢复时统一清洗，避免渲染崩溃并阻止脏数据回流
    const generatedData: SearchGenerateResponse = {
      ...raw,
      summary: typeof raw.summary === 'string' ? raw.summary : undefined,
      mindMap: Array.isArray(raw.mindMap) ? raw.mindMap : [],
      concepts: sanitizeConcepts(raw.concepts),
      knowledgeContext: sanitizeKnowledgeContext(raw.knowledgeContext),
      examQuestions: sanitizeExamQuestions(raw.examQuestions),
      interestingFacts: sanitizeInterestingFacts(raw.interestingFacts),
    };
    setContext({
      state: 'DISPLAYING',
      query,
      canonicalTopic: query,
      generatedData,
      followupMessages: messages,
    });
  }, []);

  return [
    context,
    {
      search,
      selectGraphNode,
      followup,
      reset,
      setQuery,
      restoreFromSession,
    },
  ];
}
