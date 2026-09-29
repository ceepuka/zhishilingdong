import { TabType } from '../../types';
import { useStrings } from '../../hooks/useStrings';

interface TabNavProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

/** 图标与语言无关，文案从 strings 层取 */
const TAB_ICONS: Record<TabType, string> = {
  search: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z',
  translate: 'M3 21v-4m0 0V5a2 2 0 012-2h6a2 2 0 012 2v12m-6 0v4m0 0h6m-6 0h6',
  doc: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  favorites: 'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z',
};

export function TabNav({ activeTab, onTabChange }: TabNavProps) {
  const s = useStrings();
  const tabs: { id: TabType; label: string; icon: string }[] = [
    { id: 'search', label: s.tabs.search, icon: TAB_ICONS.search },
    { id: 'translate', label: s.tabs.translate, icon: TAB_ICONS.translate },
    { id: 'doc', label: s.tabs.doc, icon: TAB_ICONS.doc },
    { id: 'favorites', label: s.tabs.favorites, icon: TAB_ICONS.favorites },
  ];

  return (
    <div className="flex space-x-1 bg-slate-100 dark:bg-zinc-800 rounded-lg p-1">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
            activeTab === tab.id
              ? 'bg-white dark:bg-zinc-900 text-teal-600 shadow-sm'
              : 'text-slate-600 dark:text-zinc-300 hover:text-teal-600'
          }`}
          title={tab.label}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
          </svg>
          {(tab.id === 'favorites' && activeTab === 'favorites') || tab.id !== 'favorites' ? tab.label : null}
        </button>
      ))}
    </div>
  );
}
