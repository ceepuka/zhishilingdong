import { HTMLAttributes } from 'react';

interface TagProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'primary' | 'accent';
}

/**
 * 标签。**传了 onClick 才渲染成按钮**（真的可点），否则是纯展示的 span ——
 * 不可点的标签不该长得像能点（悬停变色是"能点"的承诺，兑现不了就别承诺）。
 */
export function Tag({ variant = 'default', className = '', children, onClick, ...props }: TagProps) {
  const variants = {
    default: 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 border-slate-200 dark:border-zinc-800',
    primary: 'bg-teal-50 text-teal-700 dark:text-teal-400 border-teal-200',
    accent: 'bg-amber-50 text-amber-700 border-amber-200',
  };

  const base = `inline-block px-3 py-1 bg-white dark:bg-zinc-900 border rounded-full text-sm transition-all ${variants[variant]} ${className}`;

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`${base} cursor-pointer hover:border-teal-400 hover:text-teal-600`} {...props}>
        {children}
      </button>
    );
  }

  return (
    <span className={base} {...props}>
      {children}
    </span>
  );
}
