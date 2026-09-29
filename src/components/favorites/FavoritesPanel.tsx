import { FavoriteItem } from '../../types';

interface FavoritesPanelProps {
  favorites: FavoriteItem[];
  onClick: () => void;
}

export function FavoritesPanel({ favorites, onClick }: FavoritesPanelProps) {
  return (
    <button
      onClick={onClick}
      className="relative w-10 h-10 rounded-lg text-slate-500 dark:text-zinc-400 hover:text-teal-600 dark:hover:text-teal-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-all flex items-center justify-center"
      title="收藏空间"
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
      </svg>
      {favorites.length > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-teal-600 text-white text-xs rounded-full flex items-center justify-center px-1">
          {favorites.length > 9 ? '9+' : favorites.length}
        </span>
      )}
    </button>
  );
}