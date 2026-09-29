import { SearchMode } from '../hooks/useSearchMode';
import { useStrings } from '../../../hooks/useStrings';

interface SearchModeSelectorProps {
  mode: SearchMode;
  onModeChange: (mode: SearchMode) => void;
}

export const SearchModeSelector = ({ mode, onModeChange }: SearchModeSelectorProps) => {
  const s = useStrings();
  return (
    <div className="flex justify-center mb-4">
      <div className="inline-flex bg-slate-100 dark:bg-zinc-800 rounded-xl p-1">
        <button
          onClick={() => onModeChange('search')}
          className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
            mode === 'search'
              ? 'bg-white dark:bg-zinc-900 text-slate-800 dark:text-zinc-50 shadow-sm'
              : 'text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200'
          }`}
        >
          <svg className="w-4 h-4 inline-block mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          {s.search.modeSearch}
        </button>
        <button
          onClick={() => onModeChange('qa')}
          className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
            mode === 'qa'
              ? 'bg-white dark:bg-zinc-900 text-slate-800 dark:text-zinc-50 shadow-sm'
              : 'text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200'
          }`}
        >
          <svg className="w-4 h-4 inline-block mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
          {s.search.modeQA}
        </button>
      </div>
    </div>
  );
};