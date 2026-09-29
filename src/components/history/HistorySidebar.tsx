import { useState } from 'react';
import { useTimeRefresh } from '../../hooks/useTimeRefresh';
import { HistoryItem } from '../../types';
import { useStrings, fmt } from '../../hooks/useStrings';
import { useLanguage } from '../../hooks/useLanguage';
import { formatRelativeTime } from '../../utils/time';
import { ConfirmDialog } from '../ui/ConfirmDialog';

export interface HistorySidebarConfig {
  title: string;
  icon: JSX.Element;
  color: 'teal' | 'amber' | 'blue';
}

export interface HistorySidebarProps {
  items: HistoryItem[];
  config: HistorySidebarConfig;
  currentViewing?: string | null;
  onSelect: (item: HistoryItem) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
  onClose: () => void;
}

const colorStyles: Record<string, { bg: string; hover: string; active: string; border: string; icon: string }> = {
  teal: {
    bg: 'bg-gradient-to-br from-teal-500 to-teal-600',
    hover: 'hover:bg-teal-50',
    active: 'bg-teal-100 border-teal-200',
    border: 'border-teal-500',
    icon: 'group-hover:text-teal-500',
  },
  amber: {
    bg: 'bg-gradient-to-br from-amber-500 to-amber-600',
    hover: 'hover:bg-amber-50',
    active: 'bg-amber-100 border-amber-200',
    border: 'border-amber-500',
    icon: 'group-hover:text-amber-500',
  },
  blue: {
    bg: 'bg-gradient-to-br from-blue-500 to-blue-600',
    hover: 'hover:bg-blue-50',
    active: 'bg-blue-100 border-blue-200',
    border: 'border-blue-500',
    icon: 'group-hover:text-blue-500',
  },
};

export function HistorySidebar({ items, config, currentViewing, onSelect, onRemove, onClear, onClose }: HistorySidebarProps) {
  const s = useStrings();
  const { language } = useLanguage();
  const [confirmOpen, setConfirmOpen] = useState(false);
  // 显示时间 = now - lastViewedAt，时钟每秒走表，"刚刚 → x分钟前"自然递进
  useTimeRefresh(1000);
  const colors = colorStyles[config.color];

  /**
   * 本组件**不登记**"最后浏览时刻"。
   *
   * 登记（touch lastViewedAt）由 HistoryProvider 统一负责，依据各模块用
   * `useViewingHistory()` 声明的"当前浏览中记录"。原因是侧栏并非"浏览中"状态的所有者：
   * 它收起时仍在挂载（宽度归零），关标签页/刷新时更不会被卸载 —— 挂在它上面必然漏。
   * 侧栏只负责把 `currentViewing` 呈现成徽标。
   */

  return (
    <>
      <div className="mx-3 mt-3 bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-slate-100 dark:border-zinc-800 overflow-hidden flex flex-col h-[calc(100vh-2rem)] transition-all duration-300 w-66">
      <div className="p-4 border-b border-slate-50 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className={`w-7 h-7 rounded-xl ${colors.bg} flex items-center justify-center flex-shrink-0`}>
            {config.icon}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-800 dark:text-zinc-50 whitespace-nowrap">{config.title}</h3>
            <p className="text-xs text-slate-400 dark:text-zinc-500 whitespace-nowrap">{fmt(s.history.recordsCount, { n: items.length })}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-lg text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors flex items-center justify-center"
          title={s.history.collapseSidebar}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {items.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-slate-100 dark:bg-zinc-800 flex items-center justify-center">
              <svg className="w-6 h-6 text-slate-300 dark:text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-sm text-slate-400 dark:text-zinc-500">{s.history.empty}</p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {items.slice(0, 15).map((item: HistoryItem) => {
              const isViewing = currentViewing === item.query;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelect(item)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group ${
                    isViewing
                      ? `${colors.active} border shadow-sm`
                      : `${colors.hover} hover:shadow-sm`
                  }`}
                >
                  <svg className={`w-4 h-4 text-slate-400 dark:text-zinc-500 ${colors.icon} transition-colors flex-shrink-0`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {item.type === 'qa' ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    ) : item.type === 'dictionary' ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    ) : item.type === 'translate' ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                    ) : item.type === 'doc' ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    )}
                  </svg>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-slate-700 dark:text-zinc-200 truncate font-medium block">{item.query}</span>
                  </div>
                  {isViewing ? (
                    <span className={`px-1.5 py-0.5 ${colors.bg} text-white text-xs rounded flex-shrink-0`}>
                      {s.history.browsing}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400 dark:text-zinc-500 flex-shrink-0">
                      {formatRelativeTime(s, item.lastViewedAt, language)}
                    </span>
                  )}
                  <span
                    onClick={(e) => { e.stopPropagation(); onRemove(item.id); }}
                    className="w-5 h-5 rounded-md text-slate-300 dark:text-zinc-500 hover:text-red-400 hover:bg-red-50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
                    title={s.history.delete}
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {items.length > 0 && (
        <div className="p-3 border-t border-slate-50">
          <button
            onClick={() => setConfirmOpen(true)}
            className="w-full px-3 py-2 text-sm text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            {s.history.clearHistory}
          </button>
        </div>
      )}
    </div>
    <ConfirmDialog
      isOpen={confirmOpen}
      title={s.history.clearHistoryTitle}
      message={fmt(s.history.clearHistoryMessage, { title: config.title })}
      onConfirm={() => { onClear(); setConfirmOpen(false); }}
      onCancel={() => setConfirmOpen(false)}
    />
    </>
  );
}