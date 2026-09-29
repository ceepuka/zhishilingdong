import { useState } from 'react';
import { FavoriteItem } from '../../types';
import { useStrings } from '../../hooks/useStrings';
import { useLanguage } from '../../hooks/useLanguage';
import { toPlainPreview } from '../../utils/preview';
import { formatRelativeTime } from '../../utils/time';
import type { Strings } from '../../i18n/strings';

interface FavoriteContentProps {
  favorites: FavoriteItem[];
  onRemove: (id: string) => void;
  onClear: () => void;
  onSelectItem: (item: FavoriteItem) => void;
}

const TYPE_ORDER = ['knowledge', 'dictionary', 'translation', 'document'] as const;

const typeLabel = (s: Strings, type: string): string => s.favorites[({
  knowledge: 'typeKnowledge',
  dictionary: 'typeDictionary',
  translation: 'typeTranslation',
  document: 'typeDocument',
} as const)[type as (typeof TYPE_ORDER)[number]] ?? 'typeFavorite'];

const typeColor: Record<string, string> = {
  knowledge: 'bg-blue-100 text-blue-700',
  dictionary: 'bg-teal-100 text-teal-700',
  translation: 'bg-amber-100 text-amber-700',
  document: 'bg-purple-100 text-purple-700',
};

const typeIcon: Record<string, string> = {
  knowledge: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z',
  dictionary: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
  translation: 'M3 21v-4m0 0V5a2 2 0 012-2h6a2 2 0 012 2v12m-6 0v4m0 0h6m-6 0h6',
  document: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
};

const getTitle = (s: Strings, item: FavoriteItem): string => {
  const data = item.data as Record<string, unknown>;
  if (item.label) return item.label;
  if (item.type === 'knowledge') {
    // 新格式 GeneratedKnowledge 用 topic；旧 KnowledgeCardData 用 title
    return (data.topic as string) || (data.title as string) || s.favorites.typeKnowledge;
  }
  if (item.type === 'dictionary') return (data.word as string) || s.favorites.defaultWord;
  if (item.type === 'translation') return (data.original as string)?.slice(0, 30) || s.favorites.typeTranslation;
  if (item.type === 'document') return (data.title as string) || s.favorites.typeDocument;
  return s.favorites.typeFavorite;
};

/**
 * 列表摘要：必须**先降级为纯文本再截断**。
 *
 * 之前的写法是直接对原文 `slice(0, 60)`，于是预览里会露出
 * `$x>0$` 这种公式源码、`## 标题` / `**重点**` 这种 Markdown 标记，
 * 而且截断点可能正好落在 `$...$` 中间，只剩半截公式。
 */
const getDescription = (item: FavoriteItem): string => {
  const data = item.data as Record<string, unknown>;
  if (item.type === 'knowledge') {
    // 新格式用 summary；旧格式用 definition
    return toPlainPreview((data.summary as string) || (data.definition as string), 60);
  }
  if (item.type === 'dictionary') {
    const defs = data.definitions as Array<{ meaning: string }> | undefined;
    return toPlainPreview(defs?.[0]?.meaning, 60);
  }
  if (item.type === 'translation') return toPlainPreview(data.translation as string, 60);
  if (item.type === 'document') return toPlainPreview(data.content as string, 60);
  return '';
};

export function FavoriteContent({ favorites, onRemove, onClear, onSelectItem }: FavoriteContentProps) {
  const s = useStrings();
  const { language } = useLanguage();
  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(new Set([...TYPE_ORDER]));

  const toggleType = (type: string) => {
    setExpandedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      {TYPE_ORDER.map((type) => {
        const typeFavorites = favorites.filter((f) => f.type === type);
        if (typeFavorites.length === 0) return null;
        return (
          <div key={type} className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-slate-100 dark:border-zinc-800 overflow-hidden">
            <button
              onClick={() => toggleType(type)}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-lg ${typeColor[type]} flex items-center justify-center`}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={typeIcon[type]} />
                  </svg>
                </div>
                <span className="text-base font-semibold text-slate-800 dark:text-zinc-50">{typeLabel(s, type)}</span>
                <span className="text-sm text-slate-400 dark:text-zinc-500">({typeFavorites.length})</span>
              </div>
              <svg className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${expandedTypes.has(type) ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
            {expandedTypes.has(type) && (
              <div className="px-5 pb-5 space-y-3">
                {typeFavorites.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start gap-4 p-4 bg-slate-50 dark:bg-zinc-800/50 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer group"
                    onClick={() => onSelectItem(item)}
                  >
                    <div className={`w-10 h-10 rounded-xl ${typeColor[type]} flex items-center justify-center flex-shrink-0`}>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={typeIcon[type]} />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-base font-medium text-slate-800 dark:text-zinc-50 truncate">{getTitle(s, item)}</p>
                      {getDescription(item) && (
                        <p className="text-sm text-slate-500 dark:text-zinc-400 truncate mt-1">{getDescription(item)}</p>
                      )}
                      <p className="text-xs text-slate-400 dark:text-zinc-500 mt-2">{formatRelativeTime(s, item.timestamp, language)}</p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemove(item.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 w-8 h-8 rounded-lg text-slate-400 dark:text-zinc-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all flex items-center justify-center"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {favorites.length > 0 && (
        <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-slate-100 dark:border-zinc-800 p-4">
          <button
            onClick={onClear}
            className="w-full px-4 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 dark:text-red-400 dark:bg-red-900/20 dark:hover:bg-red-900/30 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            {s.favorites.clearAll}
          </button>
        </div>
      )}
    </div>
  );
}