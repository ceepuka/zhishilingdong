import type { KeywordEntry } from '../../types';

/**
 * 把任意形态的关键词数组收敛成 `KeywordEntry[]`。
 *
 * 输入之所以"任意"：① AI 可能返回裸字符串而不是 `{term, definition}`；
 * ② 收藏夹/历史读的是 localStorage 里的**旧数据**，字段形态不受当前类型约束。
 * 两种情况都必须渲染出来 —— 缺释义只是少一行字，条目本身不能消失。
 */
export function toKeywordEntries(raw: unknown): KeywordEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: KeywordEntry[] = [];
  for (const item of raw) {
    if (typeof item === 'string') {
      const term = item.trim();
      if (term) out.push({ term });
      continue;
    }
    if (!item || typeof item !== 'object') continue;
    const obj = item as { term?: unknown; word?: unknown; definition?: unknown; meaning?: unknown };
    const term = typeof obj.term === 'string' ? obj.term.trim() : typeof obj.word === 'string' ? obj.word.trim() : '';
    if (!term) continue;
    const definition =
      typeof obj.definition === 'string' ? obj.definition.trim() : typeof obj.meaning === 'string' ? obj.meaning.trim() : '';
    out.push(definition ? { term, definition } : { term });
  }
  return out;
}

interface TermListProps {
  /** 词条 + 一句话释义；也接受裸字符串（旧数据 / AI 偷懒形态），内部统一归一化 */
  items: ReadonlyArray<KeywordEntry | string>;
  /** 传入即在整行上挂点击；不传则纯展示（收藏夹等只读场景） */
  onSelect?: (term: string) => void;
  /** 点击动作说明，作为按钮 title（无障碍 + 鼠标悬停提示） */
  actionLabel?: string;
  className?: string;
}

/**
 * 「词 + 一句话释义」列表。
 *
 * 带释义是为了**不用点进去就知道是什么**；但释义只是辅助，主体仍是那个
 * 可以跳去查词/搜索的词 —— 没有 `definition` 的条目照样渲染。
 */
export function TermList({ items, onSelect, actionLabel, className = '' }: TermListProps) {
  const entries = toKeywordEntries(items);
  if (entries.length === 0) return null;

  return (
    <ul
      className={`rounded-xl border border-slate-100 dark:border-zinc-800 divide-y divide-slate-100 dark:divide-zinc-800 overflow-hidden bg-white dark:bg-zinc-900 ${className}`}
    >
      {entries.map((item, index) => {
        const body = (
          <>
            <span className="font-medium text-teal-600 dark:text-teal-400">{item.term}</span>
            {item.definition && (
              <span className="text-sm text-slate-500 dark:text-zinc-400">{item.definition}</span>
            )}
          </>
        );

        return (
          <li key={`${item.term}-${index}`}>
            {onSelect ? (
              <button
                type="button"
                onClick={() => onSelect(item.term)}
                title={actionLabel}
                className="w-full text-left px-3 py-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 hover:bg-teal-50/70 dark:hover:bg-teal-500/10 focus:outline-none focus-visible:bg-teal-50 dark:focus-visible:bg-teal-500/10 transition-colors"
              >
                {body}
              </button>
            ) : (
              <div className="px-3 py-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
