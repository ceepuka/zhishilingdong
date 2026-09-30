import { useMemo, useState } from 'react';
import { SentenceResult as SentenceResultType, TranslateStyle } from '../../types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Tag } from '../../components/ui/Tag';
import { TermList } from '../../components/ui/TermList';
import { GenerationNotice } from '../../components/ui/GenerationNotice';
import { downloadFile } from '../../utils/export';
import { useFavorites } from '../../hooks/useFavorites';
import { useSpeechSynthesis } from '../../hooks/useSpeechSynthesis';
import { languageLabel, languageSpeech } from '../../i18n/languages';
import { useStrings } from '../../hooks/useStrings';
import type { Strings } from '../../i18n/strings';
import {
  buildRuns,
  collectRanges,
  sharedKeys,
  type RenderRun,
  type TranslateSegmentPair,
} from './alignment';
interface SentenceResultProps {
  result: SentenceResultType;
  /** 点击关键词再查一次（跳词典查词模式） */
  onLookup?: (term: string) => void;
  /** 点击关联术语去知识搜索 */
  onSearchTopic?: (term: string) => void;
}

function styleOptions(s: Strings): { id: TranslateStyle; label: string }[] {
  return [
    { id: 'academic', label: `${s.translate.styleAcademic}${s.translate.styleSuffix}` },
    { id: 'business', label: `${s.translate.styleBusiness}${s.translate.styleSuffix}` },
    { id: 'casual', label: `${s.translate.styleCasual}${s.translate.styleSuffix}` },
  ];
}

export function SentenceResult({ result, onLookup, onSearchTopic }: SentenceResultProps) {
  const s = useStrings();
  const styles = styleOptions(s);
  /** 当前结果用的风格 —— 风格在翻译前选，所以这里只做展示 */
  const usedStyle = styles.find((st) => st.id === result.style)?.label ?? result.style;
  const { favorites, isFavorite, addFavorite, removeFavorite } = useFavorites();
  const fav = isFavorite(result, 'translation');
  const [speaking, setSpeaking] = useState<'original' | 'translation' | null>(null);
  const { speak, isSpeaking } = useSpeechSynthesis();

  // 选词映射：pinned 为点击锁定，hovered 为悬停；hovered 优先。
  // 状态按 **key**（AI 填的对照编号）索引 —— 不是数组下标，也不是字符位置。
  const [pinnedKey, setPinnedKey] = useState<number | null>(null);
  const [hoveredKey, setHoveredKey] = useState<number | null>(null);
  const activeKey = hoveredKey ?? pinnedKey;

  /** AI 给的对照项（含 key）。缺 key 的条目会在 collectRanges 里被当"无键"跳过。 */
  const pairs = useMemo<TranslateSegmentPair[]>(() => {
    const raw = Array.isArray(result.segments) ? result.segments : [];
    return raw.map((s) => ({
      key: (s as { key?: number })?.key,
      source: String(s?.source ?? ''),
      target: String(s?.target ?? ''),
    }));
  }, [result.segments]);

  /**
   * 两侧渲染都**只从 `original` / `translation` 切区间**，绝不拼接 `segments`：
   * `Good morning → 早上好` 这种语序相反的情况下，按 segments 的顺序拼译文会得到
   * 「好早上」。key 只决定"哪里能高亮"，永远不决定"文字是什么"—— 见 alignment.ts。
   */
  const { sourceRuns, targetRuns, hasMapping } = useMemo(() => {
    const sourceRanges = collectRanges(result.original, pairs, 'source');
    const targetRanges = collectRanges(result.translation, pairs, 'target');
    const highlightable = sharedKeys(sourceRanges, targetRanges);

    if (highlightable.size === 0) {
      return {
        sourceRuns: [{ text: result.original, key: null }] as RenderRun[],
        targetRuns: [{ text: result.translation, key: null }] as RenderRun[],
        hasMapping: false,
      };
    }

    return {
      sourceRuns: buildRuns(result.original, sourceRanges, highlightable),
      targetRuns: buildRuns(result.translation, targetRanges, highlightable),
      hasMapping: true,
    };
  }, [result.original, result.translation, pairs]);

  const srcLang = result.sourceLang ? languageLabel(result.sourceLang) : s.translate.original;
  const tgtLang = result.targetLang ? languageLabel(result.targetLang) : s.translate.translated;

  const handlePlayAudio = (text: string, type: 'original' | 'translation') => {
    setSpeaking(type);
    const code = type === 'original' ? result.sourceLang : result.targetLang;
    const lang = languageSpeech(code || '') || (type === 'original' ? 'en-US' : 'zh-CN');
    speak(text, { lang, rate: 0.9 });
    setTimeout(() => setSpeaking(null), 5000);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(result.translation);
  };

  const handleExport = () => {
    const keywordsText = result.keywords
      ? `\n\n${s.translate.keywords}：` +
        result.keywords.map((k) => (k.definition ? `${k.term}（${k.definition}）` : k.term)).join('、')
      : '';
    const grammarText = result.grammarNotes
      ? `\n\n${s.translate.grammarNote}：\n` + result.grammarNotes.map((g) => '- ' + g).join('\n')
      : '';
    const content =
      `${s.translate.original}：` + result.original +
      `\n${s.translate.translated}：` + result.translation +
      `\n${s.translate.exportStyle}：` + result.style +
      keywordsText + grammarText +
      `\n\n---\n${s.exportNote.exportedAt}: ` + new Date().toLocaleString() +
      `\n${s.exportNote.source}: ${s.app.brand}`;
    const filename = s.translate.exportFilePrefix + result.original.slice(0, 20) + '.txt';
    downloadFile(content, filename, 'txt');
  };

  const handleToggleFavorite = () => {
    if (fav) {
      const item = favorites.find(
        (f) => f.type === 'translation' && JSON.stringify(f.data) === JSON.stringify(result)
      );
      if (item) removeFavorite(item.id);
    } else {
      addFavorite(result, 'translation');
    }
  };

  /** 用户在原文里划选一段文字 → 高亮同 key 的译文片段 */
  const handleSourceMouseUp = () => {
    if (!hasMapping) return;
    const sel = window.getSelection?.();
    if (!sel || sel.isCollapsed) return;
    if (!sel.toString().trim()) return;

    // 直接读选区起点所在片段的 data-key：同一段文字在原文里出现多次时，
    // 靠文本搜索只会命中第一处，划选第二处会高亮到错误的位置。
    const anchor = sel.anchorNode;
    const el = (anchor instanceof Element ? anchor : anchor?.parentElement) as Element | null;
    const fromDom = (el?.closest?.('[data-key]') as HTMLElement | null)?.dataset?.key;
    const key = fromDom === undefined ? NaN : Number(fromDom);
    if (Number.isInteger(key) && key > 0) setPinnedKey(key);
  };

  const highlightClass = (active: boolean) =>
    active
      ? 'bg-teal-100 dark:bg-teal-500/25 text-teal-900 dark:text-teal-100 rounded px-0.5 transition-colors'
      : 'transition-colors';

  /**
   * 把切好的 run 序列渲染成 span。`key === null` 的 run 是"无键文字"：
   * 不可交互、无高亮，但照样原样显示 —— 对不上照只能是"不高亮"，不能是"不显示"。
   */
  const renderRuns = (runs: RenderRun[]) =>
    runs.map((run, i) => {
      const key = run.key;
      if (key === null) return <span key={i}>{run.text}</span>;
      return (
        <span
          key={i}
          data-key={key}
          onMouseEnter={() => setHoveredKey(key)}
          onMouseLeave={() => setHoveredKey(null)}
          onClick={() => setPinnedKey((p) => (p === key ? null : key))}
          className={`cursor-pointer ${highlightClass(activeKey === key)}`}
        >
          {run.text}
        </span>
      );
    });

  return (
    <Card className="animate-slide-up">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <span className="px-2 py-1 bg-amber-100 text-amber-700 text-xs font-medium rounded">
            {s.translate.sentenceModeBadge}
          </span>
          {/* 风格在翻译前选择（见 TranslateInput），这里只展示这次用的是哪种 */}
          <span className="px-2 py-1 bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 text-xs font-medium rounded">
            {usedStyle}
          </span>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={handleCopy}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            {s.translate.copyTranslation}
          </Button>          <Button variant="secondary" size="sm" onClick={handleExport}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            {s.translate.export}
          </Button>
          <Button variant="secondary" size="sm" onClick={handleToggleFavorite}>
            {fav ? `❤️ ${s.common.favorited}` : `⭐ ${s.common.favorite}`}
          </Button>
        </div>
      </div>

      {hasMapping && (
        <p className="mb-3 text-xs text-slate-400 dark:text-zinc-500">
          {s.translate.alignmentHint}
        </p>      )}

      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-slate-500">{srcLang}</h4>
            <button
              onClick={() => handlePlayAudio(result.original, 'original')}
              disabled={speaking === 'original' || isSpeaking}
              className="p-1 hover:bg-slate-100 rounded transition-colors"
              title={s.translate.readOriginal}
            >
              <svg className={`w-4 h-4 text-slate-500 ${speaking === 'original' || isSpeaking ? 'animate-pulse text-teal-600' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              </svg>
            </button>
          </div>
          <div
            className="bg-slate-50 dark:bg-zinc-950 rounded-xl p-4 text-slate-700 dark:text-zinc-200 min-h-[120px] leading-relaxed"
            data-testid="translate-source-text"
            onMouseUp={handleSourceMouseUp}
          >
            {renderRuns(sourceRuns)}
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-slate-500">{tgtLang}</h4>
            <button
              onClick={() => handlePlayAudio(result.translation, 'translation')}
              disabled={speaking === 'translation' || isSpeaking}
              className="p-1 hover:bg-slate-100 rounded transition-colors"
              title={s.translate.readTranslation}
            >
              <svg className={`w-4 h-4 text-slate-500 ${speaking === 'translation' || isSpeaking ? 'animate-pulse text-teal-600' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              </svg>
            </button>
          </div>
          <div
            className="bg-teal-50 dark:bg-teal-500/10 rounded-xl p-4 text-slate-700 dark:text-zinc-200 min-h-[120px] leading-relaxed"
            data-testid="translate-target-text"
          >
            {renderRuns(targetRuns)}
          </div>
        </div>
      </div>

      {result.relatedTerms && result.relatedTerms.length > 0 && (
        <div className="mt-6">
          <h4 className="text-sm font-medium text-slate-500 mb-2">{s.translate.relatedTermsSearch}</h4>
          <div className="flex flex-wrap gap-2">
            {result.relatedTerms.map((term, index) => (
              <Tag
                key={index}
                variant="primary"
                onClick={onSearchTopic ? () => onSearchTopic(term) : undefined}
                title={onSearchTopic ? s.translate.relatedTermsSearch : undefined}
              >
                {term}
              </Tag>
            ))}
          </div>
        </div>
      )}

      {result.keywords && result.keywords.length > 0 && (
        <div className="mt-6">
          <h4 className="text-sm font-medium text-slate-500 mb-2">{s.translate.keywordHint}</h4>
          <TermList
            items={result.keywords}
            onSelect={onLookup}
            actionLabel={s.translate.keywordsLookupAction}
          />
        </div>
      )}

      {result.grammarNotes && result.grammarNotes.length > 0 && (
        <div className="mt-6">
          <h4 className="text-sm font-medium text-slate-500 mb-3">{s.translate.grammarNote}</h4>
          <div className="space-y-2">
            {result.grammarNotes.map((note, index) => (
              <div
                key={index}
                className="flex items-start gap-2 bg-amber-50 dark:bg-amber-500/10 rounded-xl p-3 border border-amber-100 dark:border-amber-500/20"
              >
                <span className="text-amber-500 text-sm font-medium mt-0.5 shrink-0">{index + 1}.</span>
                <p className="text-sm text-slate-700 dark:text-zinc-200">{note}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 中断/续写提示固定放在**内容最后**（禁止挂页顶或内容上方：那等于先报错再看内容） */}
      {result.interruption || result.truncated || result.continued ? (
        <div className="mt-6">
          <GenerationNotice data={result} />
        </div>
      ) : null}
    </Card>
  );
}
