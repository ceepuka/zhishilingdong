import { useState, useCallback, useImperativeHandle, forwardRef } from 'react';
import { DocType, DocResult as DocResultType, EmailTone, FavoriteItem, HistoryItem, DocHistoryData } from '../../types';
import { DocEditor } from './DocEditor';
import { DocResult } from './DocResult';
import { HistorySidebar } from '../../components/history/HistorySidebar';
import { useHistory, useViewingHistory } from '../../hooks/HistoryContext';
import { aiService } from '../../services/aiServiceProvider';
import { generateGeneral, generateEmail, generateReport, generateMeeting, generatePPT, generateNotes, generateContract, generateResume, generatePress, generateProposal, generateWeekly } from './templates';
import { useStrings } from '../../hooks/useStrings';
import { useLanguage } from '../../hooks/useLanguage';
import { StreamTimeoutError } from '../../services/streaming/sseReader';

/** 流式渲染节流间隔（ms） */
const DOC_RENDER_THROTTLE_MS = 60;

interface GenerateOptions {
  topic: string;
  tone?: EmailTone;
  from?: string;
  to?: string;
}

interface ModuleRef {
  showFavorite?: (item: FavoriteItem) => void;
  reset?: () => void;
}

export const DocModule = forwardRef<ModuleRef>((_, ref) => {
  const s = useStrings();
  const { language } = useLanguage();
  const [docType, setDocType] = useState<DocType>('general');
  const [result, setResult] = useState<DocResultType | null>(null);
  const [lastOptions, setLastOptions] = useState<GenerateOptions | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [currentTopic, setCurrentTopic] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { getHistoryByType, addHistory, removeHistory, clearHistory } = useHistory();

  const viewingQuery = currentTopic;
  
  const docHistory = getHistoryByType('doc', viewingQuery || undefined);

  // 声明"当前正在浏览的记录"：登记最后浏览时刻的时机由 Provider 统一负责
  // （内容消失 / 卸载 / 退出应用页面），模块不再散写 touch。
  useViewingHistory('doc', viewingQuery);

  const handleRemove = (id: string) => {
    const item = docHistory.find(h => h.id === id);
    if (item && item.query === viewingQuery) {
      setResult(null);
      setLastOptions(null);
      setCurrentTopic(null);
    }
    removeHistory(id);
  };

  const sidebarConfig = {
    title: s.doc.docHistory,
    icon: (
      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    color: 'blue' as const,
  };

  useImperativeHandle(ref, () => ({
    showFavorite: (item: FavoriteItem) => {
      if (item.type === 'document') {
        const data = item.data as DocResultType;
        setResult(data);
        setDocType(data.type);
        setCurrentTopic(item.label || data.title);
        addHistory(item.label || data.title, 'doc', {
          id: `doc-${Date.now()}`,
          result: data,
        });
      }
    },
    reset: () => {
      setResult(null);
      setLastOptions(null);
      setDocType('general');
      setCurrentTopic(null);
    },
  }));

  /** 本地模板兜底：AI 不可用时仍给出一份可用的文档骨架 */
  const buildTemplateContent = useCallback(
    (topic: string, tone?: EmailTone, from?: string, to?: string): string => {
      switch (docType) {
        case 'general': return generateGeneral(topic, language);
        case 'email': return generateEmail(topic, tone || 'formal', from || s.doc.defaultSender, to || s.doc.defaultReceiver, language);
        case 'report': return generateReport(topic, language);
        case 'meeting': return generateMeeting(topic, language);
        case 'ppt': return generatePPT(topic, language);
        case 'notes': return generateNotes(topic, language);
        case 'contract': return generateContract(topic, language);
        case 'resume': return generateResume(topic, language);
        case 'press': return generatePress(topic, language);
        case 'proposal': return generateProposal(topic, language);
        case 'weekly': return generateWeekly(topic, language);
        default: return generateGeneral(topic, language);
      }
    },
    [docType, language, s.doc.defaultSender, s.doc.defaultReceiver]
  );

  const commitResult = useCallback((topic: string, docResult: DocResultType, options: GenerateOptions) => {
    addHistory(topic, 'doc', { id: `doc-${Date.now()}`, result: docResult });
    setLastOptions(options);
    setResult(docResult);
  }, [addHistory]);

  const handleGenerate = useCallback(async (options: GenerateOptions) => {
    const { topic, tone, from, to } = options;
    if (!topic.trim()) return;

    setIsLoading(true);
    setCurrentTopic(topic);
    setError(null);

    // 先放一个空壳，让结果区立刻出现；随后流式往里灌 content
    let latest: DocResultType = { type: docType, title: topic, content: '', tone };
    setResult(latest);
    let lastRenderAt = 0;

    try {
      const response = await aiService.document.generateStream(
        docType,
        topic,
        from || '',
        tone,
        (partial) => {
          latest = {
            type: docType,
            title: partial.title || latest.title || topic,
            content: typeof partial.content === 'string' ? partial.content : latest.content,
            tone: partial.tone ?? tone,
            // 中断/续写标记由服务层在收尾那次回调里带上；中间态沿用上一次的值
            truncated: partial.truncated ?? latest.truncated,
            continued: partial.continued ?? latest.continued,
            interruption: partial.interruption ?? latest.interruption,
          };
          const now = Date.now();
          // 节流：保证结尾一定刷新，中间不过度重渲染
          if (partial.complete || now - lastRenderAt >= DOC_RENDER_THROTTLE_MS) {
            lastRenderAt = now;
            setResult(latest);
          }
        }
      );

      if (!response.success) {
        setError(response.error?.message || s.common.aiKeyRequired);
        setResult(null);
        return;
      }

      if (response.data?.content) {
        const docResult: DocResultType = {
          type: docType,
          title: response.data.title || topic,
          content: response.data.content,
          tone: response.data.tone || tone,
          // 把"是否被中断/是否续写过"一并落库，UI 才能给出分档提示（历史记录也保留）
          truncated: response.data.truncated,
          continued: response.data.continued,
          interruption: response.data.interruption,
        };
        commitResult(topic, docResult, options);
      } else {
        commitResult(
          topic,
          { type: docType, title: topic, content: buildTemplateContent(topic, tone, from, to), tone },
          options
        );
      }
    } catch (error) {
      console.error('Document generate error:', error);
      // 首字节超时给专属文案（更友好、可操作）；其他异常展示原始信息
      const msg =
        error instanceof StreamTimeoutError
          ? s.search.errors.firstByteTimeout
          : error instanceof Error ? error.message : s.common.aiKeyRequired;
      setError(msg);
      commitResult(
        topic,
        { type: docType, title: topic, content: buildTemplateContent(topic, tone, from, to), tone },
        options
      );
    } finally {
      setIsLoading(false);
    }
  }, [docType, buildTemplateContent, commitResult, s]);

  const handleRegenerate = () => {
    if (lastOptions) {
      handleGenerate(lastOptions);
    }
  };

  const handleHistorySelect = (item: HistoryItem) => {
    // "最后浏览时刻"由 HistorySidebar 统一维护，这里无需 touch
    setCurrentTopic(item.query);
    if (item.data && 'result' in item.data) {
      const docData = item.data as DocHistoryData;
      setResult(docData.result);
      setDocType(docData.result.type);
    } else {
      handleGenerate({ topic: item.query });
    }
  };

  return (
    <div className="flex h-full bg-slate-50 dark:bg-zinc-950 relative">
      <aside
        className={`flex flex-col transition-all duration-300 ease-out flex-shrink-0 ${
          sidebarOpen ? 'w-72' : 'w-0'
        } overflow-hidden`}
      >
        <HistorySidebar
          items={docHistory}
          config={sidebarConfig}
          currentViewing={viewingQuery}
          onSelect={handleHistorySelect}
          onRemove={handleRemove}
          onClear={() => {
            clearHistory('doc');
            setResult(null);
            setLastOptions(null);
            setCurrentTopic(null);
          }}
          onClose={() => setSidebarOpen(false)}
        />
      </aside>

      {!sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(true)}
          className="absolute top-4 left-4 z-10 w-10 h-10 bg-white dark:bg-zinc-900 rounded-xl shadow-md border border-slate-100 dark:border-zinc-800 hover:shadow-lg hover:border-blue-200 text-slate-600 dark:text-zinc-300 hover:text-blue-600 flex items-center justify-center transition-all duration-200"
          title={s.doc.expandHistory}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </button>
      )}

      <main className="flex-1 overflow-y-auto">
        <div className="min-h-full bg-gradient-to-br from-slate-50 dark:from-zinc-950 via-white dark:via-zinc-900 to-slate-50 dark:to-zinc-950">
          <div className="max-w-3xl mx-auto px-6 py-10">
            <div className="text-center mb-10">
              <h1 className="text-4xl font-bold text-slate-800 dark:text-zinc-50 mb-3">{s.tabs.doc}</h1>
              <p className="text-lg text-slate-500 dark:text-zinc-400">{s.doc.pageSubtitle}</p>
            </div>

            <DocEditor docType={docType} onDocTypeChange={setDocType} onGenerate={handleGenerate} />

            {isLoading && (
              <div className="mt-8 bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-slate-200 dark:border-zinc-800 p-8">
                <div className="flex flex-col items-center justify-center">
                  <div className="w-12 h-12 border-4 border-blue-200 dark:border-blue-800 border-t-blue-500 rounded-full animate-spin mb-4" />
                  <p className="text-slate-500 dark:text-zinc-400">{s.doc.generating}</p>
                </div>
              </div>
            )}

            {!isLoading && error && (
              <div className="mt-8 bg-red-50 dark:bg-red-500/10 rounded-xl border border-red-200 dark:border-red-500/30 p-6">
                <p className="text-red-600 dark:text-red-400 text-center font-medium">
                  {error}
                </p>
              </div>
            )}
            
            {!isLoading && !error && result && (
              <DocResult
                result={result}
                onRegenerate={handleRegenerate}
              />
            )}
          </div>
        </div>
      </main>
    </div>
  );
});