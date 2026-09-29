import { useStrings } from '../../../hooks/useStrings';

interface HotTagsProps {
  onSearch: (query: string) => void;
}

export const HotTags = ({ onSearch }: HotTagsProps) => {
  const s = useStrings();
  const allTags = s.search.hotTags;
  return (
    <div className="flex flex-wrap justify-center items-center gap-2 mb-6">
      {allTags.map((tag) => (
        <button
          key={tag}
          onClick={() => onSearch(tag)}
          className="px-3.5 py-1.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-full text-sm text-slate-600 dark:text-zinc-300 hover:border-teal-400 hover:text-teal-600 hover:shadow-sm transition-all shrink-0"
        >
          {tag}
        </button>
      ))}
    </div>
  );
};