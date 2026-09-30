import { useState, useEffect, useRef } from 'react';
import { TabType } from './types';
import { Header } from './components/layout/Header';
import { SearchModule } from './modules/search';
import { TranslateModule } from './modules/translate';
import { DocModule } from './modules/doc';
import { FavoritesModule } from './modules/favorites';
import { useTheme } from './hooks/useTheme';
import { useStrings, fmt } from './hooks/useStrings';
import { HistoryProvider, useHistory } from './hooks/HistoryContext';
import { ConfirmDialog } from './components/ui/ConfirmDialog';

interface ModuleRef {
  showFavorite?: (item: unknown) => void;
  reset?: () => void;
}

function AppContent() {
  useTheme();
  const s = useStrings();
  const [activeTab, setActiveTab] = useState<TabType>('search');
  const [confirmClearHistory, setConfirmClearHistory] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  /**
   * 跨模块跳转带过来的搜索词。
   *
   * 为什么用 state 而不是直接调 `searchRef.current.search(term)`：切标签页时
   * SearchModule 是**那一刻才挂载**的，ref 还是 null。所以只能把词放在这里，
   * 让搜索模块挂载后自己去消费，消费完回调清空 —— 否则下次挂载（切走再切回）会又搜一遍。
   */
  const [pendingSearchTerm, setPendingSearchTerm] = useState<string | null>(null);
  const searchRef = useRef<ModuleRef>(null);
  const translateRef = useRef<ModuleRef>(null);
  const docRef = useRef<ModuleRef>(null);
  const favoritesRef = useRef<ModuleRef>(null);
  const { clearHistory } = useHistory();

  // 版权声明：`{year}` 由 fmt 填充；作者名从文案里切出来，单独渲染成 GitHub 链接
  const [copyrightBefore, copyrightAfter] = s.app.copyright.split('{author}');
  const copyrightLead = fmt(copyrightBefore, { year: new Date().getFullYear() });

  const handleClearAllHistory = () => {
    clearHistory();
    searchRef.current?.reset?.();
    translateRef.current?.reset?.();
    docRef.current?.reset?.();
    setConfirmClearHistory(false);
    setRefreshKey(prev => prev + 1);
  };

  useEffect(() => {
    const hash = window.location.hash.slice(1) as TabType;
    if (['search', 'translate', 'doc', 'favorites'].includes(hash)) {
      setActiveTab(hash);
    }
  }, []);

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    window.location.hash = tab;
  };

  /** 翻译模式的关联术语 → 切到知识搜索，并用该术语发起搜索 */
  const handleSearchTopic = (term: string) => {
    setPendingSearchTerm(term);
    handleTabChange('search');
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'search':
        return (
          <SearchModule
            key={refreshKey}
            ref={searchRef}
            initialQuery={pendingSearchTerm}
            onInitialQueryConsumed={() => setPendingSearchTerm(null)}
          />
        );
      case 'translate':
        return <TranslateModule key={refreshKey} ref={translateRef} onSearchTopic={handleSearchTopic} />;
      case 'doc':
        return <DocModule key={refreshKey} ref={docRef} />;
      case 'favorites':
        return <FavoritesModule key={refreshKey} ref={favoritesRef} />;
      default:
        return (
          <SearchModule
            key={refreshKey}
            ref={searchRef}
            initialQuery={pendingSearchTerm}
            onInitialQueryConsumed={() => setPendingSearchTerm(null)}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950">
      <Header
        activeTab={activeTab}
        onTabChange={handleTabChange}
        onClearAllHistory={() => setConfirmClearHistory(true)}
      />
      <main className="max-w-6xl mx-auto px-4 py-8">
        {renderContent()}
      </main>
      <footer className="text-center py-6 text-slate-400 dark:text-zinc-500 text-sm">
        <p>{s.app.footer}</p>
        <p className="mt-1.5">
          {copyrightLead}
          <a
            href="https://github.com/ceepuka"
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-500 dark:text-zinc-400 hover:text-teal-500 dark:hover:text-teal-400 transition-colors"
          >
            ceepuka
          </a>
          {copyrightAfter}
        </p>
      </footer>
      <ConfirmDialog
        isOpen={confirmClearHistory}
        title={s.app.clearAllHistoryTitle}
        message={s.app.clearAllHistoryMessage}
        confirmLabel={s.app.confirmClearAll}
        onConfirm={handleClearAllHistory}
        onCancel={() => setConfirmClearHistory(false)}
      />
    </div>
  );
}

function App() {
  return (
    <HistoryProvider>
      <AppContent />
    </HistoryProvider>
  );
}

export default App;