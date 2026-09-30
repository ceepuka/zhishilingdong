import { useImperativeHandle, forwardRef, useEffect, useCallback, useRef } from 'react';
import { KnowledgeCardData, HistoryItem, FavoriteItem, KnowledgeGraphNode, GeneratedKnowledge } from '../../types';
import { HistorySidebar } from '../../components/history/HistorySidebar';
import { useHistory, useViewingHistory } from '../../hooks/HistoryContext';
import { useSearchStateMachine } from './useSearchStateMachine';
import { useSearchMode } from './hooks/useSearchMode';
import { SearchModeSelector } from './components/SearchModeSelector';
import { SearchContainer } from './components/SearchContainer';
import { QAContainer } from './components/QAContainer';
import { SearchInput } from './components/SearchInput';
import { WaitTimer } from './SearchResults';
import { useStrings } from '../../hooks/useStrings';

interface ModuleRef {
  showFavorite?: (item: FavoriteItem) => void;
  reset?: () => void;
}

interface SearchModuleProps {
  /** 其他模块（翻译的关联术语）跳过来的搜索词：挂载后自动发起一次搜索 */
  initialQuery?: string | null;
  /** 已消费，通知外层清空，避免下次挂载重复搜索 */
  onInitialQueryConsumed?: () => void;
}

export const SearchModule = forwardRef<ModuleRef, SearchModuleProps>(({ initialQuery, onInitialQueryConsumed }, ref) => {
  const s = useStrings();
  const {
    mode,
    qaMessages,
    sidebarOpen,
    switchMode,
    sendMessage,
    clearQAMessages,
    loadQASession,
    toggleSidebar,
    resetState,
    isLoading: qaIsLoading,
  } = useSearchMode();

  const { history, getHistoryByType, addHistory, updateSearchSessionWithData, getSearchSession, removeHistory, clearHistory } = useHistory();

  const handleRedirectToQA = useCallback((rawQuery: string) => {
    switchMode('qa');
    sendMessage(rawQuery);
  }, [switchMode, sendMessage]);

  // 已有历史会话查询：按 normalize 后的主题查，命中则直接恢复（由状态机在 analyze 后调用）
  const findExistingSession = useCallback((topic: string) => {
    const session = getSearchSession(topic);
    if (session && session.generatedData) {
      return { generatedData: session.generatedData, messages: session.messages || [] };
    }
    return undefined;
  }, [getSearchSession]);

  const [stateMachineContext, stateMachineActions] = useSearchStateMachine({
    onRedirectToQA: handleRedirectToQA,
    findExistingSession,
  });
  const { state, query, canonicalTopic, graphData, generatedData, followupMessages, error, generatingStep } = stateMachineContext;
  const { search, selectGraphNode, followup, reset, setQuery, restoreFromSession } = stateMachineActions;

  const viewingQuery = mode === 'search'
    ? (canonicalTopic || query || null)
    : (qaMessages.length > 0 ? qaMessages[0].content : null);

  const searchHistory = getHistoryByType(mode === 'qa' ? 'qa' : 'search', viewingQuery || undefined);

  // 声明"当前正在浏览的记录"：浏览中消失（内容被清 / 换记录 / 切模式 / 卸载）与
  // 退出应用页面（关标签页 / 刷新 / 切后台）时的 lastViewedAt 登记，都由 Provider 统一负责。
  // 这里不再需要在切换记录/切换模式等离开路径上散写 touch。
  useViewingHistory(mode === 'qa' ? 'qa' : 'search', viewingQuery);

  /**
   * 切到问答模式 = 离开搜索视图：搜索内容必须跟着消失。
   *
   * "浏览中"的语义是"这份内容正显示在屏幕上"。内容只要还留在 state 里，切回搜索时它就
   * 原样复活，历史侧栏也照样指着它是"浏览中" —— 既看不到时间，也不会登记 lastViewedAt，
   * "浏览中"于是永远退不出去。词典/翻译模块的 handleModeChange 一直是"切模式即清结果"，
   * 这里对齐同一口径：内容消失 → 走卸载路径 → 登记最后浏览时刻。
   * 内容本身已由 updateSearchSessionWithData 落进历史，点历史条目即可原样恢复，不丢东西。
   */
  useEffect(() => {
    if (mode === 'qa') reset();
  }, [mode, reset]);

  // 记录已处理过的 canonicalTopic，避免 history 数组每次变化都重复执行创建/删除逻辑
  const processedTopicRef = useRef<string | null>(null);

  // 用 canonicalTopic 作为历史标题：当归一化主题确定后，创建/更新历史记录
  useEffect(() => {
    if (mode !== 'search' || !canonicalTopic) return;
    if (state !== 'GENERATING' && state !== 'DISPLAYING') return;
    if (processedTopicRef.current === canonicalTopic) return;
    processedTopicRef.current = canonicalTopic;

    // 若原始输入与归一化主题不同，移除旧的原始输入历史条目
    if (query && query !== canonicalTopic) {
      const oldItem = history.find(h => h.type === 'search' && h.query === query);
      if (oldItem) removeHistory(oldItem.id);
    }

    // 创建归一化主题的历史条目（若不存在）——直接检查 history 数组，避免 getSearchSession 因缺 result 字段返回 undefined
    const exists = history.some(h => h.type === 'search' && h.query === canonicalTopic);
    if (!exists) {
      // addHistory 内部已把 lastViewedAt 初始化为创建时刻，这里无需再 touch
      // （历史上这里散写了一次 touchHistory，传的 id 还不一定命中真实条目）
      addHistory(canonicalTopic, 'search', {
        id: `search-${Date.now()}`,
        result: { type: 'concept', title: canonicalTopic, definition: '', points: [], example: '' },
        generatedData: undefined,
        messages: [],
        timestamp: Date.now(),
      });
    }
  }, [canonicalTopic, state, mode, query, history, addHistory, removeHistory]);

  // 同步生成数据到历史会话
  useEffect(() => {
    if (mode === 'search' && canonicalTopic && generatedData) {
      updateSearchSessionWithData(canonicalTopic, generatedData, followupMessages);
    }
  }, [mode, canonicalTopic, generatedData, followupMessages, updateSearchSessionWithData]);

  const handleRemove = (id: string) => {
    const item = searchHistory.find(h => h.id === id);
    if (item && item.query === viewingQuery) {
      reset();
      clearQAMessages();
    }
    removeHistory(id);
  };

  const sidebarConfig = {
    title: mode === 'qa' ? s.search.history.qa : s.search.history.search,
    icon: (
      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        {mode === 'qa' ? (
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        ) : (
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        )}
      </svg>
    ),
    color: 'teal' as const,
  };

  useImperativeHandle(ref, () => ({
    showFavorite: (item: FavoriteItem) => {
      if (item.type === 'knowledge') {
        switchMode('search');
        reset();
        clearQAMessages();
        const data = item.data as GeneratedKnowledge | KnowledgeCardData;
        // 新格式 GeneratedKnowledge 用 topic；旧 KnowledgeCardData 用 title
        const title = (data as GeneratedKnowledge).topic || (data as KnowledgeCardData).title || item.label || '';
        setQuery(title);
        // 新格式：直接恢复完整 generatedData 到历史；旧格式：保留原 card 结构兜底
        if ('topic' in data && 'concepts' in data) {
          addHistory(title, 'search', {
            id: `search-${Date.now()}`,
            result: { type: 'concept', title, definition: '', points: [], example: '' },
            generatedData: data as GeneratedKnowledge,
            messages: [],
            timestamp: Date.now(),
          });
        } else {
          addHistory(title, 'search', {
            id: `search-${Date.now()}`,
            result: data as KnowledgeCardData,
            generatedData: undefined,
            messages: [],
            timestamp: Date.now(),
          });
        }
      }
    },
    reset: () => {
      reset();
      clearQAMessages();
      switchMode('search');
      resetState();
    },
  }));

  const handleSearch = (searchQuery: string) => {
    if (!searchQuery.trim()) return;

    // 新搜索开始，重置已处理主题标记，允许本次搜索重新创建历史记录
    processedTopicRef.current = null;
    // 历史命中判定已移入状态机：analyze 得出归一化主题后、生成前，再按主题查历史并恢复。
    // 这里不再用原始输入提前查历史（原始输入与归一化主题可能不同，会查不到）。
    search(searchQuery);
  };

  /**
   * 跨模块跳转进来的搜索词：挂载后自动搜一次。
   *
   * 用 ref 守门而不是依赖 `handleSearch`（它每次渲染都是新函数，进依赖会每帧重跑）；
   * 消费后由外层把 state 清空，所以"切走再切回搜索"不会莫名其妙又搜一遍。
   */
  const consumedInitialQueryRef = useRef<string | null>(null);
  useEffect(() => {
    if (!initialQuery || consumedInitialQueryRef.current === initialQuery) return;
    consumedInitialQueryRef.current = initialQuery;
    onInitialQueryConsumed?.();
    handleSearch(initialQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery]);

  const handleNodeClick = (node: KnowledgeGraphNode) => {
    const topic = node.topic || node.title;
    const session = getSearchSession(topic);
    if (session && session.generatedData) {
      restoreFromSession(topic, session.generatedData, session.messages || []);
      return;
    }

    processedTopicRef.current = null;
    selectGraphNode(node);
    // 历史记录由 canonicalTopic effect 创建
  };

  const handleFollowUp = (question: string) => {
    followup(question);
  };

  const handleHistoryClick = (item: HistoryItem) => {
    if (item.type === 'qa') {
      switchMode('qa');
      loadQASession(item.query);
    } else {
      const session = getSearchSession(item.query);
      if (session && session.generatedData) {
        restoreFromSession(item.query, session.generatedData, session.messages || []);
      } else {
        processedTopicRef.current = null;
        search(item.query);
      }
    }
  };

  const isLoading = state === 'VALIDATING' || state === 'ANALYZING' || state === 'GENERATING';

  return (
    <div className="flex h-full bg-slate-50 dark:bg-zinc-950 relative">
      <aside 
        className={`flex flex-col transition-all duration-300 ease-out flex-shrink-0 ${
          sidebarOpen ? 'w-72' : 'w-0'
        } overflow-hidden`}
      >
        <HistorySidebar
          items={searchHistory}
          config={sidebarConfig}
          currentViewing={viewingQuery}
          onSelect={handleHistoryClick}
          onRemove={handleRemove}
          onClear={() => {
            clearHistory(mode);
            reset();
            clearQAMessages();
          }}
          onClose={toggleSidebar}
        />
      </aside>

      {!sidebarOpen && (
        <button
          onClick={toggleSidebar}
          className="absolute top-4 left-4 z-10 w-10 h-10 bg-white dark:bg-zinc-900 rounded-xl shadow-md border border-slate-100 dark:border-zinc-800 hover:shadow-lg hover:border-teal-200 text-slate-600 dark:text-zinc-300 hover:text-teal-600 flex items-center justify-center transition-all duration-200"
          title={s.search.history.expandSearch}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </button>
      )}

      <main className="flex-1 overflow-y-auto">
        <div className="min-h-full bg-gradient-to-br from-slate-50 dark:from-zinc-950 via-white dark:via-zinc-900 to-slate-50 dark:to-zinc-950">
          <div className="max-w-4xl mx-auto px-6 py-10">
            <div className="text-center mb-10">
              <h1 className="text-4xl font-bold text-slate-800 dark:text-zinc-50 mb-3">{s.search.pageTitle}</h1>
              <p className="text-lg text-slate-500 dark:text-zinc-400">{s.search.pageSubtitle}</p>
            </div>

            <div className="mb-6">
              <SearchModeSelector mode={mode} onModeChange={switchMode} />
              
              {mode === 'search' ? (
                <SearchInput onSearch={handleSearch} />
              ) : (
                <QAContainer 
                  onSendMessage={sendMessage}
                  onNewConversation={clearQAMessages}
                  messages={qaMessages}
                  isLoading={qaIsLoading}
                />
              )}
            </div>

            {mode === 'search' && (
              <SearchContainer
                onSearch={handleSearch}
                onNodeClick={handleNodeClick}
                onFollowUp={handleFollowUp}
                state={state}
                graphData={graphData ?? null}
                generatedData={generatedData ?? null}
                followupMessages={followupMessages ?? []}
                error={error ?? null}
                generatingStep={generatingStep}
              />
            )}

            {isLoading && !generatedData && (
              <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-slate-200 dark:border-zinc-800 p-8">
                <div className="flex flex-col items-center justify-center">
                  <div className="w-12 h-12 border-4 border-teal-200 dark:border-teal-800 border-t-teal-500 rounded-full animate-spin mb-4" />
                  <p className="text-slate-500 dark:text-zinc-400">
                    {state === 'VALIDATING' && s.search.steps.validating}
                    {state === 'ANALYZING' && s.search.steps.analyzing}
                    {/* 正文首字到达前不知道写到哪一块，用中性文案；
                        这里绝不能写死"正在生成知识导图" —— 会让用户以为整个
                        生成阶段都在画思维导图，也会掩盖总述等内容尚未出现的困惑 */}
                    {state === 'GENERATING' && s.search.steps.generic}
                  </p>
                  {/* 首字等待计时：思考型模型可能几十秒不给正文，明确"在动、不是卡死" */}
                  {state === 'GENERATING' && <WaitTimer />}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
});