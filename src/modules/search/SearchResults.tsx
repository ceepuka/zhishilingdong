import { useState, useEffect, useMemo } from 'react';
import { KnowledgeCardData, GeneratedKnowledge, MindMapNode } from '../../types';
import { exportKnowledgeNote } from '../../utils/export';
import {
  KnowledgeContentView,
  normalizeGenerated,
  conceptTypeLabel,
  examTypeLabel,
} from '../../components/knowledge/KnowledgeContentView';
import { useStrings, fmt } from '../../hooks/useStrings';

interface SearchResultsProps {
  data: KnowledgeCardData | null;
  generatedData: GeneratedKnowledge | null;
  loading?: boolean;
  /** 当前正在生成的步骤（由状态机维护），用于显示准确的 loading 文案 */
  generatingStep?: GeneratingStep;
  onToggleFavorite?: () => void;
  isFavorite?: boolean;
}

/** 生成步骤（与提示词里 JSON 字段产出顺序一致） */
export type GeneratingStep =
  | 'summary'
  | 'overview'
  | 'mindMap'
  | 'concepts'
  | 'knowledgeContext'
  | 'examQuestions'
  | 'interestingFacts';

/**
 * 首字等待计时器：挂载后每秒刷新已等待秒数。
 * 只用于"还没收到任何内容"的等待阶段 —— 让长时间的首字延迟可见，而不是让用户以为卡死。
 *
 * 30s 仍未收到任何字节时叠加"响应比预期慢"的提示，让用户意识到可能要主动重试/换模型；
 * 实际兜底在 sseReader（首字节超时 60s 自动 abort）。
 */
export function WaitTimer() {
  const s = useStrings();
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setSeconds((v) => v + 1), 1000);
    return () => clearInterval(timer);
  }, []);
  const showSlowHint = seconds >= 30;
  return (
    <div className="flex flex-col items-center gap-1">
      <p className="text-xs text-slate-400 dark:text-zinc-500">
        {fmt(s.search.waitingFirstToken, { n: String(seconds) })}
      </p>
      <p className={`text-[11px] ${showSlowHint ? 'text-amber-500 dark:text-amber-400' : 'text-slate-300 dark:text-zinc-600'}`}>
        {showSlowHint ? s.search.waitingSlow : s.search.waitingHint}
      </p>
    </div>
  );
}

/**
 * 搜索结果页。
 *
 * 内容主体（思维导图 / 概念 / 知识脉络 / 试题 / 趣味知识）已抽到
 * `components/knowledge/KnowledgeContentView`，与收藏详情共用同**一份**实现 ——
 * 收藏模块以前手写了一套降级渲染（公式裸露、思维导图退化成标签），
 * 双实现漂移是那类"某个入口看不到内容"问题的根因。
 */
export function SearchResults({ generatedData: rawGeneratedData, loading, generatingStep, onToggleFavorite, isFavorite }: SearchResultsProps) {
  const s = useStrings();
  // 渲染前统一归一化（新数据经 provider 清洗是幂等的；旧 localStorage 脏数据在此被修复）
  const generatedData = useMemo(() => normalizeGenerated(rawGeneratedData), [rawGeneratedData]);

  const handleExport = () => {
    if (!generatedData) return;
    exportKnowledgeNote(generatedData, 'md');
  };

  const handleCopy = async () => {
    if (!generatedData) return;
    
    let markdown = `# ${generatedData.topic}\n\n`;

    if (generatedData.summary) {
      markdown += `${generatedData.summary}\n\n`;
    }

    if (generatedData.mindMap && generatedData.mindMap.length > 0) {
      markdown += `## ${s.search.sections.mindMap}\n\n`;
      const walk = (nodes: MindMapNode[], depth: number) => {
        for (const n of nodes) {
          markdown += `${'  '.repeat(depth)}- ${n.title}${n.description ? `：${n.description}` : ''}\n`;
          if (n.children?.length) walk(n.children, depth + 1);
        }
      };
      walk(generatedData.mindMap, 0);
      markdown += '\n';
    }

    if (generatedData.concepts && generatedData.concepts.length > 0) {
      markdown += `## ${s.search.sections.coreConcepts}\n\n`;
      // 总述是核心概念的一部分，导出时放在概念列表之前
      if (generatedData.conceptsOverview) {
        markdown += `**${s.search.sections.overview}：** ${generatedData.conceptsOverview}\n\n`;
      }
      generatedData.concepts.forEach((concept) => {
        markdown += `### ${conceptTypeLabel(s, concept.type)}: ${concept.title}\n\n`;
        markdown += `**${s.search.concept.elementary}:** ${concept.content.elementary}\n\n`;
        markdown += `**${s.search.concept.advanced}:** ${concept.content.advanced}\n\n`;
        if (concept.notation) {
          markdown += `\`\`\`math\n${concept.notation}\n\`\`\`\n\n`;
        }
        if (concept.keyPoints && concept.keyPoints.length > 0) {
          markdown += `**${s.search.concept.keyPoints}:**\n`;
          concept.keyPoints.forEach((kp) => { markdown += `- ${kp}\n`; });
          markdown += '\n';
        }
        if (concept.pitfalls && concept.pitfalls.length > 0) {
          markdown += `**${s.search.concept.pitfalls}:**\n`;
          concept.pitfalls.forEach((p) => { markdown += `- ${p}\n`; });
          markdown += '\n';
        }
        if (concept.example) {
          markdown += `**${s.search.concept.example}:** ${concept.example}\n\n`;
        }
      });
    }

    if (generatedData.knowledgeContext) {
      const kc = generatedData.knowledgeContext;
      markdown += `## ${s.search.sections.knowledgeContext}\n\n`;
      if (kc.prerequisites.length > 0) markdown += `- **${s.search.context.prerequisites}:** ${kc.prerequisites.join('、')}\n`;
      if (kc.relatedTopics.length > 0) markdown += `- **${s.search.context.relatedTopics}:** ${kc.relatedTopics.join('、')}\n`;
      if (kc.learningPath.length > 0) {
        markdown += `\n**${s.search.context.learningPath}:**\n`;
        kc.learningPath.forEach((step, i) => { markdown += `${i + 1}. ${step}\n`; });
      }
      if (kc.commonConclusions && kc.commonConclusions.length > 0) {
        markdown += `\n**${s.search.context.conclusions}:**\n`;
        kc.commonConclusions.forEach((c, i) => { markdown += `${i + 1}. ${c}\n`; });
      }
      if (kc.confusables && kc.confusables.length > 0) {
        markdown += `\n**${s.search.context.distinctions}:**\n`;
        kc.confusables.forEach((c) => { markdown += `- **${c.topic}：** ${c.difference}\n`; });
      }
      markdown += '\n';
    }

    if (generatedData.examQuestions && generatedData.examQuestions.length > 0) {
      markdown += `## ${s.search.sections.examQuestions}\n\n`;
      generatedData.examQuestions.forEach((q) => {
        markdown += `### [${examTypeLabel(s, q.type)}] ${q.question}\n\n`;
        if (q.options && q.options.length > 0) {
          q.options.forEach((opt, i) => { markdown += `${String.fromCharCode(65 + i)}. ${opt}\n`; });
          markdown += '\n';
        }
        markdown += `**${s.search.actions.answer}** ${q.answer}\n\n**${s.search.actions.explanation}** ${q.explanation}\n\n`;
      });
    }

    if (generatedData.interestingFacts && generatedData.interestingFacts.length > 0) {
      markdown += `## ${s.search.sections.interestingFacts}\n\n`;
      generatedData.interestingFacts.forEach((f) => {
        markdown += `### ${f.title}\n\n${f.content}\n\n`;
      });
    }

    try {
      await navigator.clipboard.writeText(markdown);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = markdown;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
  };

  if (loading && !generatedData) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-500 dark:text-zinc-400 text-sm">{s.search.analyzingOverall}</p>
        {/* 首字等待计时：思考型模型可能几十秒不给正文，用秒表明确"在动、不是卡死" */}
        <WaitTimer />
      </div>
    );
  }

  if (!generatedData) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="w-20 h-20 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center">
          <svg className="w-10 h-10 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="text-slate-500 dark:text-zinc-400">{s.search.emptyState}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 内容主体（标题头 + 概览 + 中断提示 + 各内容区块）全部在共享实现里 —— 见
          components/knowledge/KnowledgeContentView。搜索页与收藏详情页共用同一实现，
          外壳只留操作栏与 loading，避免"某个入口内容不全"（概览就曾这样丢过）。 */}
      <KnowledgeContentView data={generatedData} />

      <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-zinc-700">
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleFavorite}
            className={`p-2 rounded-lg transition-colors ${
              isFavorite
                ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'
                : 'bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-700'
            }`}
            title={isFavorite ? s.common.unfavorite : s.common.favorite}
          >
            <svg className="w-5 h-5" fill={isFavorite ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </button>
          <button
            onClick={handleCopy}
            className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm text-slate-600 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            {s.common.copy}
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm text-slate-600 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            {s.search.actions.exportMarkdown}
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center gap-3 py-4 px-4 bg-teal-50 dark:bg-teal-900/20 rounded-xl border border-teal-100 dark:border-teal-800">
          <div className="w-5 h-5 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-teal-700 dark:text-teal-300">
            {generatingStep === 'summary'
              ? s.search.steps.summary
              : generatingStep === 'mindMap'
              ? s.search.steps.mindMap
              : generatingStep === 'overview'
              ? s.search.steps.overview
              : generatingStep === 'concepts'
              ? s.search.steps.concepts
              : generatingStep === 'knowledgeContext'
              ? s.search.steps.knowledgeContext
              : generatingStep === 'examQuestions'
              ? s.search.steps.examQuestions
              : generatingStep === 'interestingFacts'
              ? s.search.steps.interestingFacts
              : s.search.steps.generic}
          </p>
        </div>
      )}
    </div>
  );
}
