import { HTMLAttributes } from 'react';

interface TagProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'primary' | 'accent';
}

export function Tag({ variant = 'default', className = '', children, ...props }: TagProps) {
  const variants = {
    default: 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 border-slate-200 dark:border-zinc-800',
    primary: 'bg-teal-50 text-teal-700 dark:text-teal-400 border-teal-200',
    accent: 'bg-amber-50 text-amber-700 border-amber-200',
  };

  return (
    <span
      className={`inline-block px-3 py-1 bg-white dark:bg-zinc-900 border rounded-full text-sm cursor-pointer transition-all hover:border-teal-400 hover:text-teal-600 ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}
