/**
 * 知识内容渲染（共享实现，单一来源）
 * ------------------------------------------------------------------
 * 为什么要有这个文件：
 *
 *   原先 `SearchResults.tsx` 把「思维导图 / 概念卡 / 配图 / 试题卡」全部私有实现在
 *   自己内部，而**收藏模块又手写了一套降级版**（纯 `<p>` 文本、mindMap 只取前 8 个
 *   标题当标签、没有配图、没有 notation / keyPoints / pitfalls / knowledgeContext）。
 *   结果是同一份数据在两处渲染成两种东西：
 *     - 收藏里公式显示成 `$E=mc^2$` 源码（没有走 LatexText）
 *     - 收藏里没有思维导图（只渲染平铺标签）
 *     - 每新增一个字段，只有搜索侧会显示，收藏侧永远落后（双实现必然漂移）
 *
 *   本文件把渲染抽成**唯一实现**，搜索与收藏都从这里取，杜绝再次漂移。
 *
 * 约束：所有 AI 文本一律经过 `LatexText`（项目铁律：它是 AI 文本的唯一渲染入口），
 *      新增字段时必须在此处补渲染，否则就是"某个入口看不到这个字段"。
 */
import { useState, useRef, useLayoutEffect, Fragment, useMemo } from 'react';
import type { ReactNode } from 'react';
import { GeneratedKnowledge, MindMapNode, ExamQuestion, Concept } from '../../types';
import { sanitizeConcepts, sanitizeKnowledgeContext, sanitizeExamQuestions, sanitizeInterestingFacts } from '../../services/baseAIProvider';
import { SvgFigure } from '../ui/SvgFigure';
import { useKnowledgeImage } from '../../hooks/useCommonsImage';
import { renderLatexSafe, normalizeLatex } from '../../utils/latex';
import {
  layoutMindMap,
  DESC_WIDTH,
  DESC_FONT_SIZE,
  DESC_LINE_HEIGHT,
} from '../../utils/mindMapLayout';
import { LatexText } from '../ui/LatexText';
import { GenerationNotice } from '../ui/GenerationNotice';
import { useStrings, fmt } from '../../hooks/useStrings';
import type { Strings } from '../../i18n/strings';

/**
 * 思维导图节点的递归清洗。
 *
 * 为什么必须做：`calculateNodeSize()` 会读 `title.length`，
 * 只要有一个节点缺 `title`（旧数据 / 流式半截数据 / 模型漏字段），
 * 整页渲染就会抛异常 → **白屏**。收藏数据来自 localStorage，脏数据概率更高。
 * 这里递归保证每个节点都有 id/title，非法节点整支丢弃（宁缺勿崩）。
 */
function sanitizeMindMap(raw: unknown, depth = 0): MindMapNode[] {
  if (!Array.isArray(raw) || depth > 8) return [];
  const out: MindMapNode[] = [];
  for (let i = 0; i < raw.length; i++) {
    const n = raw[i] as Partial<MindMapNode> | null | undefined;
    if (!n || typeof n !== 'object') continue;
    const title = typeof n.title === 'string' ? n.title.trim() : '';
    if (!title) continue;
    out.push({
      id: typeof n.id === 'string' && n.id ? n.id : `mm-${depth}-${i}`,
      title,
      level: n.level ?? 'branch',
      description: typeof n.description === 'string' && n.description.trim() ? n.description : undefined,
      children: sanitizeMindMap(n.children, depth + 1),
    });
  }
  return out;
}

/**
 * 渲染前统一归一化（幂等：数据已经是清洗过的；这里只是兜底，防止意外脏数据）。
 *
 * 收藏的历史数据来自 localStorage，可能缺字段、类型错乱，因此这里对**每个字段**
 * 都做保底，而不是信任调用方。缺数组一律给 `[]`，绝不给 `undefined` ——
 * 否则下游 `data.concepts.map` 会直接白屏。
 */
export function normalizeGenerated(raw: GeneratedKnowledge | null | undefined): GeneratedKnowledge | null {
  if (!raw || typeof raw !== 'object') return null;
  return {
    ...raw,
    topic: typeof raw.topic === 'string' ? raw.topic : '',
    summary: typeof raw.summary === 'string' ? raw.summary : undefined,
    conceptsOverview: typeof raw.conceptsOverview === 'string' ? raw.conceptsOverview : undefined,
    mindMap: sanitizeMindMap(raw.mindMap),
    concepts: sanitizeConcepts(raw.concepts),
    examples: Array.isArray(raw.examples) ? raw.examples : [],
    relatedResults: Array.isArray(raw.relatedResults) ? raw.relatedResults : [],
    knowledgeContext: sanitizeKnowledgeContext(raw.knowledgeContext),
    examQuestions: sanitizeExamQuestions(raw.examQuestions),
    interestingFacts: sanitizeInterestingFacts(raw.interestingFacts),
  };
}

/**
 * 数据是否"长得像"新格式知识内容（GeneratedKnowledge）。
 *
 * 边界（原收藏实现的真实 bug）：旧实现用 `typeof topic === 'string' && Array.isArray(concepts)`
 * 判新格式，于是**有 topic 但 concepts 缺失/为空数组**的数据会掉进旧分支，
 * 去渲染 `title/definition/points` 这些根本不存在的字段 → 整页近乎空白。
 *
 * 正确判据：新格式的标志是 `topic`；旧 `KnowledgeCardData` 的标志是顶层 `type`
 * （'concept' | 'process' | 'formula' | ...）。
 */
const LEGACY_KNOWLEDGE_TYPES = new Set(['concept', 'process', 'formula', 'timeline', 'compare', 'hierarchy', 'theorem']);

export function isGeneratedKnowledge(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  if (typeof d.topic === 'string') return true;
  return !(typeof d.type === 'string' && LEGACY_KNOWLEDGE_TYPES.has(d.type));
}

/* ==================================================================
 * 思维导图
 * ================================================================== */

export function MindMap({ nodes }: { nodes: MindMapNode[] }) {
  const measureRef = useRef<HTMLDivElement>(null);
  const [descHeights, setDescHeights] = useState<Record<string, number>>({});

  useLayoutEffect(() => {
    if (!measureRef.current) return;
    const children = measureRef.current.children;
    const heights: Record<string, number> = {};
    for (let i = 0; i < children.length; i++) {
      const el = children[i] as HTMLElement;
      const id = el.dataset.descId;
      if (id) heights[id] = el.offsetHeight;
    }
    setDescHeights(heights);
  }, [nodes]);

  const { positioned, lines } = layoutMindMap(nodes, descHeights);

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  positioned.forEach(n => {
    minX = Math.min(minX, n.x);
    maxX = Math.max(maxX, n.x + n.w);
    minY = Math.min(minY, n.y);
    maxY = Math.max(maxY, n.y + n.h);
    if (n.descX !== undefined && n.descW !== undefined) {
      minX = Math.min(minX, n.descX - n.descW / 2);
      maxX = Math.max(maxX, n.descX + n.descW / 2);
    }
    if (n.descY !== undefined && n.descH !== undefined) {
      minY = Math.min(minY, n.descY - n.descH / 2);
      maxY = Math.max(maxY, n.descY + n.descH / 2);
    }
  });
  const contentW = maxX - minX;
  const contentH = maxY - minY;
  const W = Math.max(900, contentW + 80);
  const H = Math.max(500, contentH + 80);

  const initialX = W / 2 - (minX + maxX) / 2;
  const initialY = H / 2 - (minY + maxY) / 2;

  const [offset, setOffset] = useState({ x: initialX, y: initialY });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });

  const onMouseDown = (e: React.MouseEvent) => {
    setDragging(true);
    dragStart.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (dragging) setOffset({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y });
  };
  const onMouseUp = () => setDragging(false);

  const levelStyles = [
    'from-teal-500 to-teal-600 border-teal-400',
    'from-blue-500 to-blue-600 border-blue-400',
    'from-amber-500 to-amber-600 border-amber-400',
    'from-emerald-500 to-emerald-600 border-emerald-400',
  ];

  return (
    <div
      data-testid="knowledge-mindmap"
      className="overflow-hidden cursor-grab active:cursor-grabbing relative select-none border border-slate-200 dark:border-zinc-700 rounded-lg bg-slate-50/30 dark:bg-zinc-900/30"
      style={{ height: '500px' }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >
      <div
        ref={measureRef}
        className="absolute"
        style={{ left: -9999, top: -9999, width: DESC_WIDTH, visibility: 'hidden', pointerEvents: 'none' }}
      >
        {positioned
          .filter(n => n.description && n.descId)
          .map(n => (
            <div
              key={n.descId}
              data-desc-id={n.descId}
              // 关键：测量盒的样式必须与下方**实际渲染盒完全一致**（同宽、同字号、同行高、同内边距、
              // 同断词规则），否则 max-content 高度会偏小，描述文字就会溢出盒子。
              className="text-xs leading-snug px-2 py-1 rounded border break-words"
              style={{
                width: DESC_WIDTH,
                textAlign: 'center',
                marginBottom: 4,
                fontSize: DESC_FONT_SIZE,
                lineHeight: `${DESC_LINE_HEIGHT}px`,
                wordBreak: 'break-word',
                overflowWrap: 'anywhere',
                whiteSpace: 'normal',
              }}
            >
              <LatexText text={n.description} />
            </div>
          ))}
      </div>
      <div
        className="absolute"
        style={{ width: W, height: H, left: '50%', top: '50%', transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px)` }}
      >
        <svg className="absolute inset-0 pointer-events-none" width={W} height={H} style={{ overflow: 'visible' }}>
          {lines.map((l, i) => (
            <path key={i} d={l.path} stroke="currentColor" strokeWidth={2} fill="none" strokeLinecap="round" className="text-slate-300 dark:text-zinc-600" />
          ))}
        </svg>
        {positioned.map((n) => (
          <div key={n.id}>
            <div
              className={`absolute rounded-lg bg-gradient-to-br ${levelStyles[n.level]} border-2 flex items-center justify-center shadow-md transition-transform hover:scale-105`}
              style={{ left: n.x, top: n.y, width: n.w, height: n.h }}
              title={n.title}
            >
              <span className="text-white font-medium text-center px-2 text-xs sm:text-sm leading-tight overflow-hidden text-ellipsis whitespace-nowrap max-w-full block"><LatexText text={n.title} /></span>
            </div>
            {n.description && n.descX !== undefined && n.descY !== undefined && n.descW !== undefined && n.descH !== undefined && (
              <div
                // 样式必须与上方测量盒保持一致（这是防溢出的前提）
                className="absolute text-xs leading-snug text-slate-600 dark:text-zinc-400 bg-slate-50 dark:bg-zinc-800/50 px-2 py-1 rounded border border-slate-200 dark:border-zinc-700 break-words"
                style={{
                  left: n.descX - n.descW / 2,
                  top: n.descY,
                  width: n.descW,
                  // 用固定 height（而非 minHeight）+ 隐藏溢出：即使测量有微小偏差也不会撑破盒子
                  height: n.descH,
                  overflow: 'hidden',
                  fontSize: DESC_FONT_SIZE,
                  lineHeight: `${DESC_LINE_HEIGHT}px`,
                  textAlign: 'center',
                  transform: 'translateY(-50%)',
                  wordBreak: 'break-word',
                  overflowWrap: 'anywhere',
                  whiteSpace: 'normal',
                }}
              >
                <LatexText text={n.description} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ==================================================================
 * 试题卡
 * ================================================================== */

/**
 * 单道试题卡片。
 *
 * 相比旧版针对"选择题/填空题适配不好"的改进：
 *   - 选择题：选项可点选并即时判对错；查看答案后高亮正确项
 *   - 填空题：题干里的空位（____）渲染成虚线填空线，视觉上像真实卷面
 *   - 配图：优先渲染 AI 画的内联 SVG 示意图，其次才是外链图片
 */
export function ExamQuestionCard({ question }: { question: ExamQuestion }) {
  const s = useStrings();
  const [picked, setPicked] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [figureFailed, setFigureFailed] = useState(false);

  const options = question.options ?? [];
  const answerLetter = question.type === 'choice' ? (question.answer || '').trim().toUpperCase() : '';
  const correctIdx =
    answerLetter.length === 1 && /[A-H]/.test(answerLetter) ? answerLetter.charCodeAt(0) - 65 : -1;

  const TYPE_META: Record<ExamQuestion['type'], { label: string; cls: string }> = {
    choice: { label: s.search.question.typeChoice, cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
    fill: { label: s.search.question.typeFill, cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
    calculation: { label: s.search.question.typeCalculation, cls: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
    essay: { label: s.search.question.typeEssay, cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  };
  const typeMeta = TYPE_META[question.type] ?? TYPE_META.essay;
  const diffMeta =
    question.difficulty === 'easy'
      ? { label: s.search.question.difficultyEasy, cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' }
      : question.difficulty === 'medium'
      ? { label: s.search.question.difficultyMedium, cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' }
      : { label: s.search.question.difficultyHard, cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' };

  /** 填空题：把题干里的空位渲染成卷面上的填空线；题干支持行内 $...$ 公式 */
  const renderStem = () => {
    if (question.type !== 'fill') return <LatexText text={question.question} />;
    const parts = question.question.split(/_{3,}|＿{2,}/);
    if (parts.length === 1) return <LatexText text={question.question} />;
    return parts.map((part, i) => (
      <Fragment key={i}>
        <LatexText text={part} />
        {i < parts.length - 1 && (
          <span className="inline-block mx-1 min-w-[3.5rem] border-b-2 border-dashed border-slate-400 dark:border-zinc-500 align-baseline" />
        )}
      </Fragment>
    ));
  };

  const optionState = (i: number): 'correct' | 'wrong' | 'neutral' => {
    if (correctIdx < 0) return 'neutral';
    if (i === correctIdx) return revealed || picked !== null ? 'correct' : 'neutral';
    if (picked === i) return 'wrong';
    return 'neutral';
  };

  return (
    <div className="bg-white dark:bg-zinc-800 rounded-xl p-5 shadow-sm border border-slate-100 dark:border-zinc-700">
      <div className="flex items-center gap-2 mb-3">
        <span className={`px-2 py-1 rounded text-xs font-medium ${typeMeta.cls}`}>{typeMeta.label}</span>
        <span className={`px-2 py-1 rounded text-xs font-medium ${diffMeta.cls}`}>{diffMeta.label}</span>
      </div>

      <p className="text-slate-700 dark:text-zinc-200 mb-3 leading-relaxed">{renderStem()}</p>

      {/* 试题配图：**原图优先** —— 可信图源直链 / 直接填入的图片数据(imageData) >
          模型手绘 SVG。原图最可靠；加载失败才回退 SVG，绝不显示裂图。 */}
      {(question.image || question.imageData) && !figureFailed ? (
        <div className="mb-3 rounded-lg overflow-hidden border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
          <img
            src={question.image || question.imageData}
            alt={s.search.question.imageAlt}
            className="w-full max-h-64 object-contain"
            loading="lazy"
            onError={() => setFigureFailed(true)}
          />
        </div>
      ) : (
        <SvgFigure svg={question.svg} maxHeight={220} />
      )}

      {question.type === 'choice' && options.length > 0 && (
        <div className="space-y-2 mb-3">
          {options.map((option, i) => {
            const st = optionState(i);
            return (
              <button
                key={i}
                type="button"
                onClick={() => setPicked(i)}
                className={`w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors ${
                  st === 'correct'
                    ? 'bg-emerald-50 dark:bg-emerald-900/20'
                    : st === 'wrong'
                    ? 'bg-red-50 dark:bg-red-900/20'
                    : 'hover:bg-slate-50 dark:hover:bg-zinc-700/50'
                }`}
              >
                <span
                  className={`w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-xs ${
                    st === 'correct'
                      ? 'bg-emerald-500 text-white'
                      : st === 'wrong'
                      ? 'bg-red-500 text-white'
                      : 'bg-slate-100 dark:bg-zinc-700 text-slate-500 dark:text-zinc-400'
                  }`}
                >
                  {String.fromCharCode(65 + i)}
                </span>
                <span
                  className={`text-sm ${
                    st === 'correct'
                      ? 'text-emerald-700 dark:text-emerald-400 font-medium'
                      : st === 'wrong'
                      ? 'text-red-700 dark:text-red-400 line-through'
                      : 'text-slate-600 dark:text-zinc-300'
                  }`}
                >
                  <LatexText text={option} />
                </span>
                {st === 'correct' && <span className="ml-auto text-xs text-emerald-600">{s.search.actions.correctAnswer}</span>}
              </button>
            );
          })}
        </div>
      )}

      <details
        className="group"
        onToggle={(e) => {
          if ((e.currentTarget as HTMLDetailsElement).open) setRevealed(true);
        }}
      >
        <summary className="cursor-pointer text-sm font-medium text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 flex items-center gap-2">
          <svg className="w-4 h-4 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
          {s.search.actions.showAnswer}
        </summary>
        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-zinc-700">
          <p className="text-sm font-medium text-slate-800 dark:text-zinc-50 mb-1">{s.search.actions.answer}</p>
          <LatexText className="text-slate-600 dark:text-zinc-300 text-sm" text={question.answer || '—'} />
          <p className="text-sm font-medium text-slate-800 dark:text-zinc-50 mt-2 mb-1">{s.search.actions.explanation}</p>
          <LatexText className="text-slate-600 dark:text-zinc-300 text-sm leading-relaxed" text={question.explanation} />
          {question.source && (question.source.year || question.source.exam) && (
            <div className="mt-3 flex items-center gap-2 text-xs text-slate-500 dark:text-zinc-500">
              <span className="px-2 py-1 bg-slate-100 dark:bg-zinc-800 rounded">
                {question.source.year} {question.source.exam}
              </span>
              {question.source.section && (
                <span className="px-2 py-1 bg-slate-100 dark:bg-zinc-800 rounded">
                  {question.source.section}
                </span>
              )}
            </div>
          )}
        </div>
      </details>
    </div>
  );
}

/* ==================================================================
 * 概念配图
 * ================================================================== */

/**
 * 概念配图：四级兜底，优先权威图，不要求模型具备画图能力。
 *
 *   1) image     —— AI 给出的**可靠来源**图片直链，最准（不限于某个图库：
 *                    教材出版社官网、维基百科/Commons、可汗学院、大学开放课程都算）
 *   2) imageData —— 具备识图画图能力的多模态模型直出的图片数据（base64 data URL），
 *                    解决"知识示意图是富文本、拿不到独立直链"的无图问题
 *   3) 关键词检索 —— 拿不到直链/数据时，按 AI 给出的关键词去免费图库现查
 *                    （中文关键词走中文源、英文关键词走 Commons，由 AI 自己决定用哪种语言）
 *   4) svg        —— 都没有才用模型手绘的内联 SVG
 *
 * 图片加载失败一律静默隐藏，绝不显示裂图。
 * 概念配图**不自动生图**（省成本、避免生图乱配），拿不到就优雅占位。
 */
export function ConceptIllustration({ concept }: { concept: Concept }) {
  // 直接用 AI 给出的关键词 —— 语言由 AI 决定，前端不猜测、不翻译
  const query = concept.imageQuery?.trim() || '';
  const needSearch = !concept.image && !concept.imageData && !concept.svg && !!query;
  const s = useStrings();
  const found = useKnowledgeImage(needSearch ? query : undefined, needSearch);
  const [imageFailed, setImageFailed] = useState(false);

  // 1. 优先 AI 给出的权威/可靠来源直链
  if (concept.image && !imageFailed) {
    return (
      <div className="mb-4 rounded-lg overflow-hidden border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
        <img
          src={concept.image}
          alt={`${concept.title}${s.search.concept.figureSuffix}`}
          className="w-full max-h-64 object-contain"
          loading="lazy"
          onError={() => setImageFailed(true)}
        />
      </div>
    );
  }

  // 2. 多模态模型直出的图片数据（base64）
  if (concept.imageData && !imageFailed) {
    return (
      <div className="mb-4 rounded-lg overflow-hidden border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
        <img
          src={concept.imageData}
          alt={`${concept.title}${s.search.concept.figureSuffix}`}
          className="w-full max-h-64 object-contain"
          loading="lazy"
          onError={() => setImageFailed(true)}
        />
      </div>
    );
  }

  // 3. 按关键词检索到的图（带图源署名）
  if (found) {
    return (
      <div className="mb-4 rounded-lg overflow-hidden border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
        <img
          src={found.url}
          alt={`${concept.title}${s.search.concept.figureSuffix}`}
          className="w-full max-h-64 object-contain"
          loading="lazy"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
        <div className="px-2 py-1 text-[11px] text-slate-400 dark:text-zinc-500 border-t border-slate-100 dark:border-zinc-700">
          {fmt(s.search.concept.imageSource, { source: found.source, license: found.license ? ` · ${found.license}` : '' })}
        </div>
      </div>
    );
  }

  // 4. 最后才用模型手绘的 SVG
  return <SvgFigure svg={concept.svg} caption={`${concept.title}${s.search.concept.figureSuffix}`} maxHeight={240} />;
}

/* ==================================================================
 * 标签文案（搜索的 markdown 导出与卡片徽章共用，导出处也从这里取，避免两套）
 * ================================================================== */

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

/* ==================================================================
 * 知识内容主体
 * ================================================================== */

/**
 * 知识内容视图（搜索页与收藏详情页的唯一实现）。
 *
 * 结构：**标题头（标题 + 概览 summary）→ 思维导图 → 核心概念（总述 + 概念卡 + 示例卡）
 * → 知识脉络 → 试题 → 趣味知识 → 中断提示**。
 * 中断提示放在最末 —— 它描述的是"末尾没写完"，就该紧接内容尾部，而不是压在内容上方。
 *
 * 【为什么标题头和 summary 也在本组件内】
 * 第一轮收敛内容主体时，标题头被留在了外壳里（`SearchResults` 的标题卡），
 * summary 也跟着留在那儿 —— 结果收藏详情渲染了标题头却**整段丢失概览**，
 * 用户看到的是"收藏内容不全"。
 * 教训：凡是**模型生成的内容字段**，必须和它的容器一起落在本组件内。
 * summary 的容器就是标题卡（它是紧跟标题的引导段，样式上属于标题头），
 * 所以标题头一并收进来；而 `headerActions`（收藏详情的"返回列表"按钮）
 * 由外壳以插槽传入，保证搜索页与收藏页各自的页面级操作不被绑定。
 *
 * 外壳只保留真正的页面级部件：复制/导出/收藏操作栏、loading、错误态。
 */
export function KnowledgeContentView({
  data: rawData,
  /** 页面外壳的操作区（如收藏详情的"返回列表"），渲染在标题行右侧；搜索页不传 */
  headerActions,
  /** 标题兜底：`data.topic` 为空时使用（收藏列表里存下来的 label） */
  fallbackTitle,
}: {
  data: GeneratedKnowledge | null | undefined;
  headerActions?: ReactNode;
  fallbackTitle?: string;
}) {
  const s = useStrings();
  const data = useMemo(() => normalizeGenerated(rawData), [rawData]);

  if (!data) return null;

  const heading = data.topic || fallbackTitle || '';

  return (
    <>
      {/* 1. 标题头：标题 + 概览（summary）。
          概览是紧跟标题的引导段（"用一两句话定位该主题"），因此和标题同卡。
          两者都独立门控 —— 概览不挂在任何后续区块之下，否则流式/半截数据下不显示。 */}
      {(heading || data.summary) && (
        <div className="bg-gradient-to-br from-teal-50 to-emerald-50 dark:from-teal-900/30 dark:to-emerald-900/30 rounded-xl p-6 border border-teal-100 dark:border-teal-800 flex flex-col gap-3">
          {heading && (
            <div className="flex items-start justify-between gap-4">
              <h2 className="text-2xl font-bold text-slate-800 dark:text-zinc-50">{heading}</h2>
              {headerActions}
            </div>
          )}
          {data.summary && (
            <LatexText className="text-slate-700 dark:text-zinc-200 text-base leading-relaxed" text={data.summary} />
          )}
        </div>
      )}

      {/* 2. 思维导图 */}
      {data.mindMap.length > 0 && (
        <div className="bg-gradient-to-b from-slate-50 dark:from-zinc-950 to-white dark:to-zinc-900 rounded-xl p-4">
          <div>
            <h3 className="font-semibold text-slate-800 dark:text-zinc-50">{s.search.sections.mindMap}</h3>
          </div>
          <MindMap nodes={data.mindMap} />
        </div>
      )}

      {/* 核心概念区块：只要「总述」或「概念列表」任意一个先到就立刻渲染。
          流式产出顺序是 conceptsOverview → concepts，若把总述一起挂在
          concepts.length > 0 的门控下，总述会一直等到概念列表出现才显示，
          表现为"总述迟迟不出现、跟概念一起蹦出来"。 */}
      {(data.conceptsOverview || data.concepts.length > 0) && (
        <div>
          <h3 className="font-semibold text-slate-800 dark:text-zinc-50 mb-4">{s.search.sections.coreConcepts}</h3>
          {/* 总述：核心概念区块的引导段，是核心概念的一部分（不是独立章节） */}
          {data.conceptsOverview && (
            <div className="mb-4 rounded-xl p-4 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700">
              <span className="inline-block mb-2 px-2 py-0.5 rounded text-xs font-medium bg-slate-200 text-slate-700 dark:bg-zinc-700 dark:text-zinc-300">
                {s.search.sections.overview}
              </span>
              <LatexText className="text-slate-600 dark:text-zinc-300 text-sm leading-relaxed" text={data.conceptsOverview} />
            </div>
          )}
          {/* 完全上下布局：每个概念的定义卡片与示例卡片各自独立、依次排列 */}
          <div className="flex flex-col gap-4">
            {data.concepts.map((concept, index) => (
              <Fragment key={index}>
                {/* 定义卡片 */}
                <div className="bg-white dark:bg-zinc-800 rounded-xl p-5 shadow-sm border border-slate-100 dark:border-zinc-700 hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-2 mb-3">
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        concept.type === 'definition'
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                          : concept.type === 'formula'
                          ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                          : concept.type === 'theorem'
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                          : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                      }`}
                    >
                      {conceptTypeLabel(s, concept.type)}
                    </span>
                    <h4 className="font-semibold text-slate-800 dark:text-zinc-50"><LatexText text={concept.title} /></h4>
                  </div>
                  {/* 配图：AI 给可靠来源直链 → 按 AI 关键词免费图库检索 → 模型手绘 SVG */}
                  <ConceptIllustration concept={concept} />
                  <div className="space-y-3">
                    <div>
                      <span className="text-xs font-medium text-blue-600 dark:text-blue-400">{s.search.concept.elementary}</span>
                      <LatexText className="text-slate-600 dark:text-zinc-300 text-sm leading-relaxed mt-1 block" text={concept.content?.elementary} />
                    </div>
                    <div>
                      <span className="text-xs font-medium text-purple-600 dark:text-purple-400">{s.search.concept.advanced}</span>
                      <LatexText className="text-slate-600 dark:text-zinc-300 text-sm leading-relaxed mt-1 block" text={concept.content?.advanced} />
                    </div>
                    {concept.notation && (() => {
                      // 安全渲染：剥掉 $$ / \[ \] / \( \) 围栏；解析失败则降级为等宽代码块，
                      // 避免 KaTeX 抛红（也避免流式过程中半截 LaTeX 整段报红）
                      const r = renderLatexSafe(concept.notation);
                      if (r.ok) {
                        return (
                          <div className="mt-3 p-3 bg-slate-50 dark:bg-zinc-900 rounded-lg overflow-x-auto text-center">
                            <span dangerouslySetInnerHTML={{ __html: r.html }} />
                          </div>
                        );
                      }
                      return (
                        <div className="mt-3 p-3 bg-slate-50 dark:bg-zinc-900 rounded-lg overflow-x-auto">
                          <code className="font-mono text-base text-slate-700 dark:text-zinc-200 whitespace-pre-wrap break-words">
                            {normalizeLatex(concept.notation)}
                          </code>
                        </div>
                      );
                    })()}
                    {/* 关键要点：扫一眼抓重点 */}
                    {concept.keyPoints && concept.keyPoints.length > 0 && (
                      <div className="pt-1">
                        <span className="text-xs font-medium text-teal-600 dark:text-teal-400">{s.search.concept.keyPoints}</span>
                        <ul className="mt-1.5 space-y-1">
                          {concept.keyPoints.map((kp, i) => (
                            <li key={i} className="flex gap-2 text-sm">
                              <span className="text-teal-500 dark:text-teal-400 shrink-0">•</span>
                              <LatexText className="text-slate-600 dark:text-zinc-300 leading-relaxed" text={kp} />
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {/* 易错提醒：常见误区 */}
                    {concept.pitfalls && concept.pitfalls.length > 0 && (
                      <div className="pt-1">
                        <span className="text-xs font-medium text-rose-600 dark:text-rose-400">{s.search.concept.pitfalls}</span>
                        <ul className="mt-1.5 space-y-1">
                          {concept.pitfalls.map((p, i) => (
                            <li key={i} className="flex gap-2 text-sm">
                              <span className="text-rose-500 dark:text-rose-400 shrink-0">!</span>
                              <LatexText className="text-slate-600 dark:text-zinc-300 leading-relaxed" text={p} />
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
                {/* 示例卡片：独立于定义卡片，可选（无示例则不渲染） */}
                {concept.example && (
                  <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-5 border border-amber-200 dark:border-amber-800">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-1 rounded text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400">
                        {s.search.concept.example}
                      </span>
                      <h4 className="font-semibold text-slate-800 dark:text-zinc-50"><LatexText text={concept.title} /></h4>
                    </div>
                    <LatexText className="text-slate-600 dark:text-zinc-300 text-sm leading-relaxed" text={concept.example} />
                  </div>
                )}
              </Fragment>
            ))}
          </div>
        </div>
      )}

      {data.knowledgeContext &&
        (data.knowledgeContext.prerequisites.length > 0 ||
          data.knowledgeContext.relatedTopics.length > 0 ||
          data.knowledgeContext.learningPath.length > 0 ||
          (data.knowledgeContext.commonConclusions?.length ?? 0) > 0 ||
          (data.knowledgeContext.confusables?.length ?? 0) > 0) && (
        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/30 dark:to-purple-900/30 rounded-xl p-5 border border-indigo-100 dark:border-indigo-800">
          <h3 className="font-semibold text-slate-800 dark:text-zinc-50 mb-4">{s.search.sections.knowledgeContext}</h3>

          {/* 学习路径：有先后顺序，用带序号的流程展示，而不是散落的标签 */}
          {data.knowledgeContext.learningPath.length > 0 && (
            <div className="mb-4">
              <span className="text-xs font-medium text-teal-600 dark:text-teal-400">{s.search.context.learningPath}</span>
              <div className="mt-2">
                {data.knowledgeContext.learningPath.map((item, i, arr) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <div className="flex flex-col items-center shrink-0 pt-0.5">
                      <span className="w-5 h-5 rounded-full bg-teal-500 text-white text-[11px] flex items-center justify-center font-medium">
                        {i + 1}
                      </span>
                      {i < arr.length - 1 && (
                        <span className="w-px flex-1 min-h-[14px] bg-teal-300 dark:bg-teal-700 mt-1" />
                      )}
                    </div>
                    <p className="text-sm text-slate-600 dark:text-zinc-300 leading-relaxed pb-3"><LatexText text={item} /></p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 前置知识 / 关联主题：并列两栏 */}
          {(data.knowledgeContext.prerequisites.length > 0 || data.knowledgeContext.relatedTopics.length > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {data.knowledgeContext.prerequisites.length > 0 && (
                <div>
                  <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400">{s.search.context.prerequisites}</span>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {data.knowledgeContext.prerequisites.map((item, i) => (
                      <LatexText key={i} className="px-2 py-1 bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300 rounded text-xs" text={item} />
                    ))}
                  </div>
                </div>
              )}
              {data.knowledgeContext.relatedTopics.length > 0 && (
                <div>
                  <span className="text-xs font-medium text-purple-600 dark:text-purple-400">{s.search.context.relatedTopics}</span>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {data.knowledgeContext.relatedTopics.map((item, i) => (
                      <LatexText key={i} className="px-2 py-1 bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300 rounded text-xs" text={item} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 易混辨析：划清与相近概念的边界 */}
          {data.knowledgeContext.confusables && data.knowledgeContext.confusables.length > 0 && (
            <div className="mt-4 pt-4 border-t border-indigo-100 dark:border-indigo-800">
              <span className="text-xs font-medium text-rose-600 dark:text-rose-400">{s.search.context.distinctions}</span>
              <div className="mt-2 space-y-1.5">
                {data.knowledgeContext.confusables.map((c, i) => (
                  <p key={i} className="text-sm text-slate-600 dark:text-zinc-300 leading-relaxed">
                    <LatexText className="font-medium text-slate-800 dark:text-zinc-100" text={c.topic} />
                    <span className="mx-1.5 text-slate-400 dark:text-zinc-500">—</span>
                    <LatexText text={c.difference} />
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* 常用结论 */}
          {data.knowledgeContext.commonConclusions && data.knowledgeContext.commonConclusions.length > 0 && (
            <div className="mt-4 pt-4 border-t border-indigo-100 dark:border-indigo-800">
              <span className="text-xs font-medium text-amber-600 dark:text-amber-400">{s.search.context.conclusions}</span>
              <div className="mt-2 space-y-2">
                {data.knowledgeContext.commonConclusions.map((item, i) => (
                  <p key={i} className="text-slate-600 dark:text-zinc-300 text-sm">
                    {i + 1}. <LatexText text={item} />
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {data.examQuestions.length > 0 && (
        <div>
          <h3 className="font-semibold text-slate-800 dark:text-zinc-50 mb-4">{s.search.sections.examQuestions}</h3>
          <div className="space-y-4">
            {data.examQuestions.map((question, i) => (
              <ExamQuestionCard key={question.id || `q-${i}`} question={question} />
            ))}
          </div>
        </div>
      )}

      {data.interestingFacts.length > 0 && (
        <div>
          <h3 className="font-semibold text-slate-800 dark:text-zinc-50 mb-4">{s.search.sections.interestingFacts}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.interestingFacts.map((fact) => (
              <div key={fact.id} className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/30 dark:to-orange-900/30 rounded-xl p-5 border border-amber-100 dark:border-amber-800">
                <div className="flex items-center gap-2 mb-3">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    fact.type === 'story' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400' :
                    fact.type === 'application' ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400' :
                    fact.type === 'history' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400' :
                    'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-400'
                  }`}>
                    {fact.type === 'story' ? s.search.fact.typeStory :
                     fact.type === 'application' ? s.search.fact.typeApplication :
                     fact.type === 'history' ? s.search.fact.typeHistory : s.search.fact.typeInteresting}
                  </span>
                  <h4 className="font-semibold text-slate-800 dark:text-zinc-50"><LatexText text={fact.title} /></h4>
                </div>
                <LatexText className="text-slate-600 dark:text-zinc-300 text-sm leading-relaxed" text={fact.content} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 最后：生成中断提示 —— **衔接在内容最后**。
          提示说的是"末尾区块可能不完整 / 为什么没写完"，位置就该落在它描述的地方（内容尾部，
          紧挨最后一块已生成内容）。放在标题下方会变成"先报错、再看内容"，流式过程中还会把
          正在长出来的内容持续往下挤。
          放在本组件内而不是各页外壳里 —— 否则新增入口会忘记接入，模块零提示。 */}
      <GenerationNotice data={data} />
    </>
  );
}
