import { useEffect, useState } from 'react';
import { TranslateMode } from '../../types';
import type { LanguageCode, SourceLanguageCode } from '../../i18n/languages';
import { languageLabel, TARGET_LANGUAGE_OPTIONS } from '../../i18n/languages';
import { TextArea } from '../../components/ui/Input';
import { useStrings, fmt } from '../../hooks/useStrings';
import { getMaxInput, truncateInput } from './constants';

interface Props {
  onTranslate: (text: string) => void;
  mode: TranslateMode;
  onModeChange: (mode: TranslateMode) => void;
  /** 源语言：auto（自动检测）或具体语言 */
  sourceLang: SourceLanguageCode;
  /** 目标语言：默认用户语言 */
  targetLang: LanguageCode;
  onSourceChange: (code: SourceLanguageCode) => void;
  onTargetChange: (code: LanguageCode) => void;
  /** 自动检测到的源语言（用于在"自动检测"项后展示） */
  detectedSource?: LanguageCode | null;
  onSwap?: () => void;
}

const selectClass =
  'px-2.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 ' +
  'text-slate-700 dark:text-zinc-200 focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100 transition-all';

export function TranslateInput({
  onTranslate,
  mode,
  onModeChange,
  sourceLang,
  targetLang,
  onSourceChange,
  onTargetChange,
  detectedSource,
  onSwap,
}: Props) {
  const s = useStrings();
  const [text, setText] = useState('');
  const [truncatedNotice, setTruncatedNotice] = useState(false);

  const maxInput = getMaxInput(mode);

  // 切换查词/翻译时，输入上限变化 → 超长内容立即截断
  useEffect(() => {
    setText((prev) => {
      const { text: next, truncated } = truncateInput(prev, maxInput);
      if (truncated) setTruncatedNotice(true);
      return next;
    });
  }, [maxInput]);

  const applyLimit = (raw: string) => {
    const { text: next, truncated } = truncateInput(raw, maxInput);
    setTruncatedNotice(truncated);
    setText(next);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    applyLimit(e.target.value);
  };

  const handleTranslate = () => {
    if (!text.trim()) return;
    onTranslate(text.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && mode === 'dictionary') {
      e.preventDefault();
      handleTranslate();
    }
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleTranslate();
    }
  };

  const nearLimit = text.length >= maxInput * 0.9;

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl card-shadow p-6 mb-6">
      {/* 顶部：模式切换 + 语言选择 */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
        <div className="flex items-center gap-2 bg-slate-100 dark:bg-zinc-800 rounded-lg p-1">
          <button
            onClick={() => onModeChange('dictionary')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
              mode === 'dictionary'
                ? 'bg-white dark:bg-zinc-900 text-teal-700 dark:text-teal-400 shadow-sm'
                : 'text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200'
            }`}
          >
            {s.translate.modeDictShort}
          </button>
          <button
            onClick={() => onModeChange('translate')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
              mode === 'translate'
                ? 'bg-white dark:bg-zinc-900 text-teal-700 dark:text-teal-400 shadow-sm'
                : 'text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200'
            }`}
          >
            {s.translate.modeTranslateShort}
          </button>
        </div>

        {/* 源语言 → 目标语言（经典双下拉） */}
        <div className="flex items-center gap-2">
          <select
            value={sourceLang}
            onChange={(e) => onSourceChange(e.target.value as SourceLanguageCode)}
            className={selectClass}
            title={s.translate.sourceLanguage}
          >
            <option value="auto">
              {s.translate.autoDetect}{detectedSource ? ` · ${languageLabel(detectedSource)}` : ''}
            </option>
            {TARGET_LANGUAGE_OPTIONS.map((l) => (
              <option key={l.code} value={l.code}>{l.native}</option>
            ))}
          </select>

          <button
            onClick={onSwap}
            disabled={sourceLang === 'auto'}
            title={sourceLang === 'auto' ? s.translate.swapDisabled : s.translate.swapLanguages}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4M16 17H4m0 0l4 4m-4-4l4-4" />
            </svg>
          </button>

          <select
            value={targetLang}
            onChange={(e) => onTargetChange(e.target.value as LanguageCode)}
            className={selectClass}
            title={s.translate.targetLanguage}
          >
            {TARGET_LANGUAGE_OPTIONS.map((l) => (
              <option key={l.code} value={l.code}>{l.native}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 输入区 */}
      {mode === 'dictionary' ? (
        <div className="relative">
          <input
            type="text"
            value={text}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={s.translate.dictPlaceholder}
            className="w-full pl-4 pr-24 py-3 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-slate-700 dark:text-zinc-200 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100 transition-all text-lg"
          />
          <button
            onClick={handleTranslate}
            disabled={!text.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-1.5 bg-gradient-to-r from-teal-500 to-teal-600 text-white text-sm font-medium rounded-lg hover:from-teal-600 hover:to-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {s.translate.lookupBtn}
          </button>
        </div>
      ) : (
        <div className="relative">
          <TextArea
            value={text}
            onChange={handleChange}
            placeholder={s.translate.sentencePlaceholder}
            rows={4}
            className="pr-24"
          />
          <button
            onClick={handleTranslate}
            disabled={!text.trim()}
            className="absolute right-2 bottom-2 px-4 py-1.5 bg-gradient-to-r from-teal-500 to-teal-600 text-white text-sm font-medium rounded-lg hover:from-teal-600 hover:to-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {s.translate.translateBtn}
          </button>
        </div>
      )}

      {/* 字数与截断提示 */}
      <div className="flex items-center justify-between mt-2 px-1 min-h-[16px]">
        {truncatedNotice ? (
          <span className="text-xs text-amber-600 dark:text-amber-400">
            {fmt(s.translate.truncatedNotice, { n: maxInput })}
          </span>        ) : (
          <span />
        )}
        <span className={`text-xs ${nearLimit ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400 dark:text-zinc-500'}`}>
          {text.length}/{maxInput}
        </span>
      </div>
    </div>
  );
}
