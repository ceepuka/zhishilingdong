import { SearchResults, type GeneratingStep } from '../SearchResults';
import { KnowledgeGraph } from '../KnowledgeGraph';
import { QASection } from '../QASection';
import { HotTags } from './HotTags';
import { GeneratedKnowledge, KnowledgeGraphNode, ChatMessage } from '../../../types';
import { useFavorites } from '../../../hooks/useFavorites';
import { useStrings } from '../../../hooks/useStrings';

interface SearchContainerProps {
  onSearch: (query: string) => void;
  onNodeClick: (node: KnowledgeGraphNode) => void;
  onFollowUp: (question: string) => void;
  state: string;
  graphData: KnowledgeGraphNode[] | null;
  generatedData: GeneratedKnowledge | null;
  followupMessages: ChatMessage[];
  error: string | null;
  generatingStep?: GeneratingStep;
}

export const SearchContainer = ({
  onSearch,
  onNodeClick,
  onFollowUp,
  state,
  graphData,
  generatedData,
  followupMessages,
  error,
  generatingStep,
}: SearchContainerProps) => {
  const { favorites, addFavorite, removeFavorite, isFavorite } = useFavorites();
  const s = useStrings();

  const handleToggleFavorite = () => {
    if (!generatedData) return;

    // 直接收藏新格式 GeneratedKnowledge（含 summary/mindMap/concepts/examQuestions 等全部内容），
    // 不再压缩成旧的 KnowledgeCardData（那会丢失大量字段）。
    const currentIsFavorite = isFavorite(generatedData, 'knowledge');

    if (currentIsFavorite) {
      const existingFavorite = favorites.find(
        f => f.type === 'knowledge' &&
             (((f.data as Record<string, unknown>).topic as string) === generatedData.topic ||
              ((f.data as Record<string, unknown>).title as string) === generatedData.topic)
      );
      if (existingFavorite) {
        removeFavorite(existingFavorite.id);
      }
    } else {
      addFavorite(generatedData, 'knowledge', generatedData.topic);
    }
  };

  const data = generatedData?.relatedResults?.[0] || null;

  return (
    <>
      <HotTags onSearch={onSearch} />

      <div className="space-y-6">
        {state === 'IDLE' && error && !generatedData && (
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-slate-200 dark:border-zinc-800 p-10 flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center mb-4">
              <svg className="w-7 h-7 text-slate-400 dark:text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
            </div>
            <p className="text-sm text-slate-500 dark:text-zinc-400 max-w-md">{s.search.errors.generateFailedEmpty}</p>
            {/* 没有任何内容时，具体原因就写在这里（没有"内容最后"可衔接） */}
            <p className="mt-2 text-sm text-red-500 dark:text-red-400 max-w-md">{error}</p>
          </div>
        )}

        {state === 'INVALID' && (
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-slate-200 dark:border-zinc-800 p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <svg className="w-5 h-5 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-slate-800 dark:text-zinc-50">{s.search.invalidTitle}</h3>
            </div>
            <p className="text-slate-600 dark:text-zinc-300">{s.search.invalidHint}</p>
          </div>
        )}

        {state === 'KNOWLEDGE_GRAPH' && graphData && (
          <div>
            <h2 className="text-xl font-semibold text-slate-800 dark:text-zinc-50 mb-4">{s.search.graph.directory}</h2>
            <KnowledgeGraph nodes={graphData} onNodeClick={onNodeClick} />
          </div>
        )}

        {(state === 'GENERATING' || state === 'DISPLAYING' || state === 'FOLLOWUP') && generatedData && (
          <SearchResults
            data={data}
            generatedData={generatedData}
            loading={state === 'GENERATING'}
            generatingStep={generatingStep}
            onToggleFavorite={handleToggleFavorite}
            isFavorite={isFavorite(generatedData, 'knowledge')}
          />
        )}

        {(state === 'DISPLAYING' || state === 'FOLLOWUP') && generatedData && (
          <QASection
            messages={followupMessages}
            onSend={onFollowUp}
            hasContext={true}
            hideInput={false}
            isLoading={state === 'FOLLOWUP'}
          />
        )}

        {/* 错误提示衔接在**内容最后**：内容区已经渲染出东西时，错误属于"末尾发生了什么"
            （例如追问失败），就该贴在内容尾部，而不是压在页面顶部把内容整体推下去。
            没有内容的情况由上面的空状态卡承载具体原因。 */}
        {error && !(state === 'IDLE' && !generatedData) && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400">
            {error}
          </div>
        )}
      </div>
    </>
  );
};