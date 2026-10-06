import { useCallback, useEffect, useRef, useState } from 'react';
import { copyText, type CopyResult } from '../../utils/clipboard';

/**
 * 复制 / 导出动作的统一出口（按钮 + 反馈）。
 *
 * **为什么要抽这个组件**，而不是给每个模块写一个 handler：
 *
 * 1. **反馈不能省**。复制有两条路径（Async Clipboard 与 execCommand），
 *    在非安全上下文（本项目的发布形态就是本地 `file://`）、权限被拒、
 *    或浏览器策略下都会失败，而且**失败是静默的**。以前 `DocResult` /
 *    `SentenceResult` 是裸调 `navigator.clipboard`，在 `file://` 下直接抛
 *    `TypeError`，用户点了既没反应也没提示 —— 从外面看就是"这按钮坏了"。
 *
 * 2. **状态必须共享**。同一模块常有两个出口（复制 + 导出），必须显示同一条反馈。
 *    把toast 放在模块级state 里重复实现，等于把"忘了提示"这个 bug 复制 N 份。
 *
 * 所有导出与复制都通过它调用，业务组件不再直接碰 `navigator.clipboard`。
 */

interface ActionFeedback {
  kind: 'ok' | 'error';
  text: string;
}

export function useActionFeedback(timeout = 2400) {
  const [feedback, setFeedback] = useState<ActionFeedback | null>(null);
  const timerRef = useRef<number | null>(null);

  const notify = useCallback((kind: 'ok' | 'error', text: string) => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    setFeedback({ kind, text });
    timerRef.current = window.setTimeout(() => {
      setFeedback(null);
      timerRef.current = null;
    }, timeout);
  }, [timeout]);

  useEffect(() => () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
  }, []);

  return { feedback, notify };
}

/**
 * 复制一段文本并给出反馈。
 *
 * @returns 复制是否成功 —— 调用方据此决定要不要额外处理（例如退回到手选）
 */
export async function copyWithFeedback(
  text: string,
  notify: (kind: 'ok' | 'error', msg: string) => void,
  strings: { copied: string; copyFailed: string }
): Promise<CopyResult> {
  const result = await copyText(text);
  notify(result === 'copied' ? 'ok' : 'error', result === 'copied' ? strings.copied : strings.copyFailed);
  return result;
}

/** 反馈条：贴在触发按钮下方，2.4 秒后自动消失 */
export function ActionFeedbackToast({ feedback }: { feedback: ActionFeedback | null }) {
  if (!feedback) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className={`absolute right-0 top-full mt-1 z-20 whitespace-nowrap rounded-lg border px-3 py-1.5 text-xs font-medium shadow-lg ${
        feedback.kind === 'ok'
          ? 'border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-800 dark:bg-teal-900/60 dark:text-teal-300'
          : 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-900/60 dark:text-rose-300'
      }`}
    >
      {feedback.text}
    </div>
  );
}

/**
 * 复制按钮（统一实现）。
 *
 * `label` 与 `icon` 由调用方给，行为一律走 `copyWithFeedback`。
 */
export function CopyButton({
  text,
  label,
  strings,
  notify,
  variant = 'secondary',
  size = 'sm',
  icon,
  className = '',
}: {
  text: string;
  label: string;
  strings: { copied: string; copyFailed: string };
  notify: (kind: 'ok' | 'error', msg: string) => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => void copyWithFeedback(text, notify, strings)}
      className={buttonClass(variant, size, className)}
    >
      {icon ?? (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      )}
      {label}
    </button>
  );
}

/** 与 Button 组件保持同一套视觉规格（复制按钮要长得像按钮，不能像裸链接） */
function buttonClass(
  variant: 'primary' | 'secondary' | 'ghost' | 'danger',
  size: 'sm' | 'md' | 'lg',
  extra: string
): string {
  const variants = {
    primary: 'bg-teal-500 hover:bg-teal-600 text-white',
    secondary: 'bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-200',
    ghost: 'text-slate-500 hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-zinc-800',
    danger: 'bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-900/20 dark:hover:bg-red-900/30 dark:text-red-400',
  };
  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-5 py-2.5 text-base',
  };
  return `inline-flex items-center gap-1.5 ${variants[variant]} ${sizes[size]} font-medium rounded-lg transition-colors ${extra}`;
}