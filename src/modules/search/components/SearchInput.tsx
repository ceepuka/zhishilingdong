import { useState, KeyboardEvent } from 'react';
import { useStrings } from '../../../hooks/useStrings';

interface SearchInputProps {
  onSearch: (query: string) => void;
  placeholder?: string;
}

export function SearchInput({ onSearch, placeholder }: SearchInputProps) {
  const s = useStrings();
  const [value, setValue] = useState('');

  const handleSearch = () => {
    if (value.trim()) {
      onSearch(value.trim());
      setValue('');
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleClear = () => {
    setValue('');
  };

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl card-shadow p-6 mb-6">
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder ?? s.search.inputPlaceholder}
          className="w-full pl-4 pr-24 py-3 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-slate-700 dark:text-zinc-200 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100 transition-all text-lg"
        />
        <button
          onClick={handleSearch}
          disabled={!value.trim()}
          className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-1.5 bg-gradient-to-r from-teal-500 to-teal-600 text-white text-sm font-medium rounded-lg hover:from-teal-600 hover:to-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {s.search.searchBtn}
        </button>
        {value && (
          <button
            onClick={handleClear}
            className="absolute right-24 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-slate-200 dark:bg-zinc-700 hover:bg-slate-300 dark:hover:bg-zinc-600 flex items-center justify-center"
          >
            <svg className="w-3 h-3 text-slate-500 dark:text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}