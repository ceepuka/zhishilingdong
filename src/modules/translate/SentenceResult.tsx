import { useMemo, useState } from 'react';
import { SentenceResult as SentenceResultType, TranslateStyle } from '../../types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Tag } from '../../components/ui/Tag';
import { downloadFile } from '../../utils/export';
import { useFavorites } from '../../hooks/useFavorites';
import { useSpeechSynthesis } from '../../hooks/useSpeechSynthesis';
import { languageLabel, languageSpeech } from '../../i18n/languages';
import { useStrings } from '../../hooks/useStrings';
import type { Strings } from '../../i18n/strings';

interface SentenceResultProps {
  result: SentenceResultType;
  onStyleChange: (style: TranslateStyle) => void;
}

function styleOptions(s: Strings): { id: TranslateStyle; label: string }[] {
  return [
    { id: 'academic', label: `${s.translate.styleAcademic}${s.translate.styleSuffix}` },
    { id: 'business', label: `${s.translate.styleBusiness}${s.translate.styleSuffix}` },
    { id: 'casual', label: `${s.translate.styleCasual}${s.translate.styleSuffix}` },
  ];
}

export function SentenceResult({ result, onStyleChange }: SentenceResultProps) {
  const s = useStrings();
  const styles = styleOptions(s);
  const { favorites, isFavorite, addFavorite, removeFavorite } = useFavorites();
  const fav = isFavorite(result, 'translation');
  const [speaking, setSpeaking] = useState<'original' | 'translation' | null>(null);
  const { speak, isSpeaking } = useSpeechSynthesis();

  // 选词映射：pinned 为点击锁定，hovered 为悬停；hovered 优先
  const [pinnedIndex, setPinnedIndex] = useState<number | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const activeIndex = hoveredIndex ?? pinnedIndex;

  const segments = useMemo(() => {
    const raw = result.segments;
    if (!Array.isArray(raw)) return [];
    return raw
      .map((s) => ({ source: String(s?.source ?? ''), target: String(s?.target ?? '') }))
      .filter((s) => s.source.length > 0 || s.target.length > 0);
  }, [result.segments]);

  const hasMapping = segments.length > 1;

  // 若对齐段落未完整覆盖原文/译文，追加剩余部分，保证不丢字
  const sourceJoined = segments.map((s) => s.source).join('');
  const targetJoined = segments.map((s) => s.target).join('');
  const sourceLeftover = hasMapping && result.original.startsWith(sourceJoined)
    ? result.original.slice(sourceJoined.length)
    : '';
  const targetLeftover = hasMapping && result.translation.startsWith(targetJoined)
    ? result.translation.slice(targetJoined.length)
    : '';

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
    const keywordsText = result.keywords ? `\n\n${s.translate.keywords}：` + result.keywords.join('、') : '';
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

  /** 用户在原文里划选一段文字 → 定位到对应译文段落 */
  const handleSourceMouseUp = () => {
    if (!hasMapping) return;
    const sel = window.getSelection?.()?.toString().trim();
    if (!sel) return;
    const idx = segments.findIndex((s) => s.source.includes(sel));
    if (idx >= 0) setPinnedIndex(idx);
  };

  const highlightClass = (active: boolean) =>
    active
      ? 'bg-teal-100 dark:bg-teal-500/25 text-teal-900 dark:text-teal-100 rounded px-0.5 transition-colors'
      : 'transition-colors';

  return (
    <Card className="animate-slide-up">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <span className="px-2 py-1 bg-amber-100 text-amber-700 text-xs font-medium rounded">
            {s.translate.sentenceModeBadge}
          </span>
          <div className="flex gap-2">
            {styles.map((style) => (
              <button
                key={style.id}
                onClick={() => onStyleChange(style.id)}
                className={`px-3 py-1 text-sm rounded-lg transition-all ${
                  result.style === style.id
                    ? 'bg-teal-100 text-teal-700 font-medium'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {style.label}
              </button>
            ))}
          </div>
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
            onMouseUp={handleSourceMouseUp}
          >
            {hasMapping ? (
              <>
                {segments.map((seg, i) => (
                  <span
                    key={i}
                    onMouseEnter={() => setHoveredIndex(i)}
                    onMouseLeave={() => setHoveredIndex(null)}
                    onClick={() => setPinnedIndex((p) => (p === i ? null : i))}
                    className={`cursor-pointer ${highlightClass(activeIndex === i)}`}
                  >
                    {seg.source}
                  </span>
                ))}
                {sourceLeftover}
              </>
            ) : (
              result.original
            )}
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
          <div className="bg-teal-50 dark:bg-teal-500/10 rounded-xl p-4 text-slate-700 dark:text-zinc-200 min-h-[120px] leading-relaxed">
            {hasMapping ? (
              <>
                {segments.map((seg, i) => (
                  <span
                    key={i}
                    onMouseEnter={() => setHoveredIndex(i)}
                    onMouseLeave={() => setHoveredIndex(null)}
                    onClick={() => setPinnedIndex((p) => (p === i ? null : i))}
                    className={`cursor-pointer ${highlightClass(activeIndex === i)}`}
                  >
                    {seg.target}
                  </span>
                ))}
                {targetLeftover}
              </>
            ) : (
              result.translation
            )}
          </div>
        </div>
      </div>

      {result.relatedTerms && result.relatedTerms.length > 0 && (
        <div className="mt-6">
          <h4 className="text-sm font-medium text-slate-500 mb-2">{s.translate.relatedTerms}</h4>
          <div className="flex flex-wrap gap-2">
            {result.relatedTerms.map((term, index) => (
              <Tag key={index} variant="primary">{term}</Tag>
            ))}
          </div>
        </div>
      )}

      {result.keywords && result.keywords.length > 0 && (
        <div className="mt-6">
          <h4 className="text-sm font-medium text-slate-500 mb-2">{s.translate.keywords}</h4>
          <div className="flex flex-wrap gap-2">
            {result.keywords.map((kw, index) => (
              <Tag key={index} variant="primary">{kw}</Tag>
            ))}
          </div>
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
    </Card>
  );
}
