import { useEffect, useRef, useState } from 'react';

/**
 * 导出格式下拉菜单（复制之外的统一导出入口）。
 *
 * **为什么抽出来**：五个模块（查词 / 查句 / 搜索 / 问答 / 文档 / 收藏）
 * 都要"点按钮→ 选格式 → 导出"，之前只有 `DocResult` 有一份手写下拉，
 * 其余模块是"只有一个 md 按钮"或"只有一个 txt 按钮"。
 * 格式列表、loading 态、点击外部关闭这三段逻辑各写一遍必然漂移。
 *
 * 菜单宽度写死（`w-56` + `whitespace-nowrap`）——
 * 曾按最长文案自适应（`w-max`），"导出为 Markdown" 在中文界面下会把菜单撑到 900px。
 */

export interface ExportOption {
  format: string;
  label: string;
  icon?: string;
  /** 副标题：说明这一步会发生什么（如 PDF 的中文可选中/可搜索） */
  hint?: string;
}

export function ExportMenu({
  options,
  onSelect,
  exporting,
  exportingLabel,
  triggerLabel,
  triggerIcon = '📥',
  notify,
  notifyStrings,
}: {
  options: ExportOption[];
  /** 允许同步或异步：docx 走 JSZip 是异步的 */
  onSelect: (format: string) => void | Promise<void>;
  exporting?: boolean;
  exportingLabel?: string;
  triggerLabel: string;
  triggerIcon?: string;
  notify?: (kind: 'ok' | 'error', msg: string) => void;
  notifyStrings?: { exportDone: string; exportFailed: string };
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setOpen(false);
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  const handleSelect = async (format: string) => {
    setOpen(false);
    try {
      await onSelect(format);
      if (notify && notifyStrings) notify('ok', notifyStrings.exportDone);
    } catch {
      if (notify && notifyStrings) notify('error', notifyStrings.exportFailed);
    }
  };

  return (
    // 注意不要用 `w-max`：它按最长内容宽度撑开，中文文案下能到 900px，
    // 右对齐后左边缘溢出到视口外（实测 x = -151），菜单项点不到。
    // 改成固定宽度 + `whitespace-nowrap`，既能自适应长短文案，又不会溢出。
    <div className="relative z-30 shrink-0" ref={menuRef}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        disabled={exporting}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-zinc-200 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 rounded-lg transition-colors disabled:opacity-60"
      >
        {exporting ? (exportingLabel ?? '…') : `${triggerIcon} ${triggerLabel}`}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-56 bg-white dark:bg-zinc-900 rounded-lg shadow-lg border border-slate-200 dark:border-zinc-800 z-50 py-1">
          {options.map((opt) => (
            <button
              key={opt.format}
              type="button"
              onClick={() => void handleSelect(opt.format)}
              className="w-full px-4 py-2 text-left text-sm text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors"
            >
              <span className="flex items-center gap-2 whitespace-nowrap">
                {opt.icon && <span aria-hidden>{opt.icon}</span>}
                {opt.label}
              </span>
              {/* hint 允许换行（PDF 那条提示较长），不跟上面一起 nowrap */}
              {opt.hint && (
                <span className="mt-0.5 block text-[11px] leading-snug text-slate-400 dark:text-zinc-500">{opt.hint}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}