import { useState, useImperativeHandle, forwardRef, useRef, useEffect, useCallback } from 'react';
import { WordResult, SentenceResult, TranslateStyle, TranslateMode, FavoriteItem, HistoryItem, DictHistoryData, TranslateHistoryData } from '../../types';
import type { LanguageCode, SourceLanguageCode } from '../../i18n/languages';
import { isLanguageCode } from '../../i18n/languages';
import { TranslateInput } from './TranslateInput';
import { WordResult as WordResultComponent } from './WordResult';
import { SentenceResult as SentenceResultComponent } from './SentenceResult';
import { HistorySidebar } from '../../components/history/HistorySidebar';
import { useHistory, useViewingHistory } from '../../hooks/HistoryContext';
import { useLanguage } from '../../hooks/useLanguage';
import { useStrings } from '../../hooks/useStrings';
import { aiService } from '../../services/aiServiceProvider';
import { mockWordResult, mockSentenceResult } from './mockData';

interface ModuleRef {
  showFavorite?: (item: FavoriteItem) => void;
  reset?: () => void;
}

/** CJK 兜底推断（检测失败时） */
const guessLang = (text: string): LanguageCode => (/[\u4e00-\u9fff]/.test(text) ? 'zh' : 'en');

/** 源语言 = 目标语言时，自动改判目标语言，避免"翻译成同一种语言" */
const avoidSameLanguage = (src: LanguageCode, tgt: LanguageCode): LanguageCode =>
  src === tgt ? (src === 'en' ? 'zh' : 'en') : tgt;

export const TranslateModule = forwardRef<ModuleRef>((_, ref) => {
  const { language: userLanguage } = useLanguage();
  const s = useStrings();

  const [mode, setMode] = useState<TranslateMode>('dictionary');
  // 源语言默认"自动检测"；目标语言默认用户语言
  const [sourceLang, setSourceLang] = useState<SourceLanguageCode>('auto');
  const [targetLang, setTargetLang] = useState<LanguageCode>(userLanguage);
  const [detectedSource, setDetectedSource] = useState<LanguageCode | null>(null);
  const [wordResult, setWordResult] = useState<WordResult | null>(null);
  const [sentenceResult, setSentenceResult] = useState<SentenceResult | null>(null);
  const [translateStyle, setTranslateStyle] = useState<TranslateStyle>('business');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { getHistoryByType, addHistory, removeHistory, clearHistory } = useHistory();

  // 用户是否手动改过目标语言；没改过则跟随"用户语言"设置
  const targetTouchedRef = useRef(false);
  useEffect(() => {
    if (!targetTouchedRef.current) setTargetLang(userLanguage);
  }, [userLanguage]);

  /**
   * 当前正在浏览的历史条目 —— **就是记录的身份（用户输入的那串文本）**，不是模型返回的字段。
   *
   * 为什么不能从结果里派生（早期写法是 `wordResult?.word` / `sentenceResult?.original`）：
   * 记录是拿用户输入当 `query` 建的，而模型可能返回归一化后的词形（大小写、词形还原……），
   * 两者一旦不一致，Provider 就解析不出对应条目 → 这条记录**永远不会登记 lastViewedAt**
   * （表现为关闭标签页后时间一直停在旧值）。
   */
  const [viewingQuery, setViewingQuery] = useState<string | null>(null);

  const translateHistory = getHistoryByType(mode, viewingQuery || undefined);

  // 声明"当前正在浏览的记录"：登记最后浏览时刻的时机由 Provider 统一负责
  // （内容消失 / 切换查词·翻译模式 / 卸载 / 退出应用页面），模块不再散写 touch。
  useViewingHistory(mode, viewingQuery);

  const handleRemove = (id: string) => {
    const item = translateHistory.find(h => h.id === id);
    if (item && item.query === viewingQuery) {
      setWordResult(null);
      setSentenceResult(null);
      setViewingQuery(null);
    }
    removeHistory(id);
  };

  const sidebarConfig = {
    title: mode === 'dictionary' ? s.translate.dictHistory : s.translate.sentenceHistory,
    icon: (
      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        {mode === 'dictionary' ? (
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        ) : (
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
        )}
      </svg>
    ),
    color: 'amber' as const,
  };

  useImperativeHandle(ref, () => ({
    showFavorite: (item: FavoriteItem) => {
      if (item.type === 'dictionary') {
        const data = item.data as WordResult;
        setMode('dictionary');
        setWordResult(data);
        setSentenceResult(null);
        addHistory(data.word, 'dictionary', { id: `dict-${Date.now()}`, result: data });
        setViewingQuery(data.word);
      } else if (item.type === 'translation') {
        const data = item.data as SentenceResult;
        setMode('translate');
        setSentenceResult(data);
        setWordResult(null);
        addHistory(data.original, 'translate', { id: `trans-${Date.now()}`, result: data });
        setViewingQuery(data.original);
      }
    },
    reset: () => {
      setWordResult(null);
      setSentenceResult(null);
      setViewingQuery(null);
      setMode('dictionary');
      setSourceLang('auto');
      setTargetLang(userLanguage);
      targetTouchedRef.current = false;
      setDetectedSource(null);
      setTranslateStyle('business');
    },
  }));

  /** 解析实际源语言：显式选择直接用；"自动检测"则调用 AI 检测 */
  const resolveSource = useCallback(async (text: string): Promise<LanguageCode> => {
    if (sourceLang !== 'auto') return sourceLang;
    try {
      const res = await aiService.translate.detect(text);
      const raw = res.success && res.data ? res.data.sourceLang : '';
      const code: LanguageCode = isLanguageCode(raw) ? raw : guessLang(text);
      setDetectedSource(code);
      return code;
    } catch {
      const guess = guessLang(text);
      setDetectedSource(guess);
      return guess;
    }
  }, [sourceLang]);

  const pushDictHistory = (query: string, data: WordResult) => {
    // addHistory 已把 lastViewedAt 初始化为创建时刻（此前这里散写的 touchHistory
    // 传的是 `dict-<ts>`，与条目 id `dictionary-<ts>` 根本对不上，纯空转）
    addHistory(query, 'dictionary', { id: `dict-${Date.now()}`, result: data });
    setViewingQuery(query);
  };

  const pushTransHistory = (query: string, data: SentenceResult) => {
    addHistory(query, 'translate', { id: `trans-${Date.now()}`, result: data });
    setViewingQuery(query);
  };

  const handleTranslate = async (text: string) => {
    const trimmedText = text.trim();
    if (!trimmedText) return;

    setIsLoading(true);
    setError(null);

    try {
      if (mode === 'dictionary') {
        const src = await resolveSource(trimmedText);
        const response = await aiService.translate.queryWord(trimmedText, src, targetLang);

        if (!response.success) {
          setError(response.error?.message || s.common.aiKeyRequired);
          return;
        }
        const data = response.data || {
          ...(mockWordResult[trimmedText.toLowerCase()] || {
            word: trimmedText,
            phonetic: '',
            definitions: [{ pos: '', meaning: s.translate.noResult }],
          }),
        };
        setWordResult(data);
        setSentenceResult(null);
        pushDictHistory(trimmedText, data);
      } else {
        const src = await resolveSource(trimmedText);
        const tgt = avoidSameLanguage(src, targetLang);
        const response = await aiService.translate.queryTranslate(trimmedText, src, tgt, translateStyle);

        if (!response.success) {
          setError(response.error?.message || s.common.aiKeyRequired);
          return;
        }
        const data = response.data || mockSentenceResult(trimmedText, translateStyle);
        setWordResult(null);
        setSentenceResult(data);
        pushTransHistory(trimmedText, data);
      }
    } catch (err) {
      console.error('Translate error:', err);
      if (mode === 'dictionary') {
        const fallback = mockWordResult[trimmedText.toLowerCase()] || {
          word: trimmedText,
          phonetic: '',
          definitions: [{ pos: '', meaning: s.translate.lookupFailed }],
        };
        setWordResult(fallback);
        setSentenceResult(null);
        pushDictHistory(trimmedText, fallback);
      } else {
        const fallback = mockSentenceResult(trimmedText, translateStyle);
        setWordResult(null);
        setSentenceResult(fallback);
        pushTransHistory(trimmedText, fallback);
      }
    } finally {
      setIsLoading(false);
    }
  };

  /** 点击"关键词"再查一次（短语/多词查询结果里出现） */
  const handleKeywordLookup = (term: string) => {
    const trimmed = term.trim();
    if (!trimmed) return;
    setWordResult(null);
    void handleTranslate(trimmed);
  };

  /** 翻译风格切换：用当前结果的源/目标语言重新翻译 */
  const handleStyleChange = (style: TranslateStyle) => {
    setTranslateStyle(style);
    if (!sentenceResult) return;
    const text = sentenceResult.original.trim();
    if (!text) return;

    const src: LanguageCode = isLanguageCode(sentenceResult.sourceLang) ? sentenceResult.sourceLang : guessLang(text);
    const tgt: LanguageCode = isLanguageCode(sentenceResult.targetLang) ? sentenceResult.targetLang : targetLang;

    setIsLoading(true);
    aiService.translate
      .queryTranslate(text, src, avoidSameLanguage(src, tgt), style)
      .then((response) => {
        if (response.success && response.data) {
          setSentenceResult(response.data);
          pushTransHistory(text, response.data);
        } else {
          const fallback = mockSentenceResult(text, style);
          setSentenceResult(fallback);
          pushTransHistory(text, fallback);
        }
      })
      .catch(() => {
        const fallback = mockSentenceResult(text, style);
        setSentenceResult(fallback);
        pushTransHistory(text, fallback);
      })
      .finally(() => setIsLoading(false));
  };

  const handleModeChange = (newMode: TranslateMode) => {
    setMode(newMode);
    setWordResult(null);
    setSentenceResult(null);
    // 离开当前视图 = 内容消失：清掉声明，交给 Provider 在"消失那一刻"登记最后浏览时刻
    setViewingQuery(null);
  };

  const handleSwapLanguages = () => {
    if (sourceLang === 'auto') return;
    const nextSource = targetLang;
    const nextTarget = sourceLang;
    setSourceLang(nextSource);
    setTargetLang(nextTarget);
    targetTouchedRef.current = true;
  };

  const handleHistorySelect = (item: HistoryItem) => {
    // "最后浏览时刻"由 HistorySidebar 统一维护，这里无需 touch
    // 声明的身份始终取条目自己的 query（`handleTranslate` 那条路会在 push*History 里设置）
    setViewingQuery(item.query);
    if (item.type === 'dictionary') {
      setMode('dictionary');
      if (item.data && 'result' in item.data) {
        setWordResult((item.data as DictHistoryData).result);
        setSentenceResult(null);
      } else {
        void handleTranslate(item.query);
      }
    } else {
      setMode('translate');
      if (item.data && 'result' in item.data) {
        setSentenceResult((item.data as TranslateHistoryData).result);
        setWordResult(null);
      } else {
        void handleTranslate(item.query);
      }
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
          items={translateHistory}
          config={sidebarConfig}
          currentViewing={viewingQuery}
          onSelect={handleHistorySelect}
          onRemove={handleRemove}
          onClear={() => {
            clearHistory(mode);
            setWordResult(null);
            setSentenceResult(null);
          }}
          onClose={() => setSidebarOpen(false)}
        />
      </aside>

      {!sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(true)}
          className="absolute top-4 left-4 z-10 w-10 h-10 bg-white dark:bg-zinc-900 rounded-xl shadow-md border border-slate-100 dark:border-zinc-800 hover:shadow-lg hover:border-amber-200 text-slate-600 dark:text-zinc-300 hover:text-amber-600 flex items-center justify-center transition-all duration-200"
          title={s.translate.expandHistory}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
          </svg>
        </button>
      )}

      <main className="flex-1 overflow-y-auto">
        <div className="min-h-full bg-gradient-to-br from-slate-50 dark:from-zinc-950 via-white dark:via-zinc-900 to-slate-50 dark:to-zinc-950">
          <div className="max-w-3xl mx-auto px-6 py-10">
            <div className="text-center mb-10">
              <h1 className="text-4xl font-bold text-slate-800 dark:text-zinc-50 mb-3">{s.tabs.translate}</h1>
              <p className="text-lg text-slate-500 dark:text-zinc-400">
                {mode === 'dictionary' ? s.translate.modeDict : s.translate.modeSentence}
              </p>
            </div>

            <TranslateInput
              onTranslate={handleTranslate}
              mode={mode}
              onModeChange={handleModeChange}
              sourceLang={sourceLang}
              targetLang={targetLang}
              onSourceChange={setSourceLang}
              onTargetChange={(code) => { targetTouchedRef.current = true; setTargetLang(code); }}
              detectedSource={detectedSource}
              onSwap={handleSwapLanguages}
            />

            {isLoading && (
              <div className="mt-8 bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-slate-200 dark:border-zinc-800 p-8">
                <div className="flex flex-col items-center justify-center">
                  <div className="w-12 h-12 border-4 border-amber-200 dark:border-amber-800 border-t-amber-500 rounded-full animate-spin mb-4" />
                  <p className="text-slate-500 dark:text-zinc-400">
                    {mode === 'dictionary' ? s.translate.loadingDict : s.translate.loadingSentence}
                  </p>
                </div>
              </div>
            )}

            {!isLoading && error && (
              <div className="mt-8 bg-red-50 dark:bg-red-500/10 rounded-xl border border-red-200 dark:border-red-500/30 p-6">
                <p className="text-red-600 dark:text-red-400 text-center font-medium">{error}</p>
              </div>
            )}

            {!isLoading && !error && wordResult && (
              <WordResultComponent result={wordResult} onLookup={handleKeywordLookup} />
            )}
            {!isLoading && !error && sentenceResult && (
              <SentenceResultComponent result={sentenceResult} onStyleChange={handleStyleChange} />
            )}
          </div>
        </div>
      </main>
    </div>
  );
});
