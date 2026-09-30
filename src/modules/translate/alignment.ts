/**
 * 译文「逐段对照」—— 按 AI 填好的 **key** 配对，前端只做拼字与高亮。
 *
 * ## 数据模型
 *
 * AI 返回一组对照项，每一项自带 key：
 *
 * ```json
 * [{ "key": 1, "source": "Good",    "target": "好"   },
 *  { "key": 2, "source": "morning", "target": "早上" }]
 * ```
 *
 * key 由 AI 按**原文出现顺序**编号（1、2、3…），同一组对照两侧同键。
 * 不便于对照的片段 AI 就不放进数组里 —— 界面上表现为「无键」，不高亮，属正常。
 *
 * ## 为什么配对只能用 key，不能用数组下标 / 文本位置
 *
 * 不同语言的语序可以完全相反。`Good morning → 早上好` 里，`Good` 对应译文**末尾**的
 * 「好」，`morning` 对应**开头**的「早上」。所以：
 *
 * - 按下标配对 → 错（这正是最初的 bug：`Good` 会高亮到「早上」）；
 * - 按字符位置做单调扫描 → 也错（先定位到「好」在 2，游标到 3，再找「早上」就找不到了）；
 * - 只有 **key 是唯一可靠的对应关系**，且两侧的顺序彼此独立。
 *
 * ## 渲染原则（改之前先读）
 *
 * **屏幕上的文字只能来自 `original` / `translation` 两个权威字符串，不能来自 segments 的拼接。**
 * 早先的实现是 `segments.map(s => s.target).join('')` 直接当译文渲染，于是模型少给一段、
 * 多一个空格、或把顺序写乱，用户看到的文字就跟着错，而且和「复制译文」「导出」用的
 * `result.translation` 对不上 —— 同一份内容三个出口三份文本。
 *
 * key 只决定"哪里能高亮"，永远不决定"文字是什么"。对齐失败的正确降级是
 * 「这段不高亮」，绝不是「这段不显示」。
 */

export interface TranslateSegmentPair {
  /** AI 填的对照编号，> 0 的整数；缺失 / 0 / 非整数 = 无键 */
  key?: number
  source: string
  target: string
}

export interface KeyedRange {
  key: number
  start: number
  end: number
}

export interface RenderRun {
  text: string
  /** null = 无键文字：原样显示，不可交互、无高亮 */
  key: number | null
}

/** 只有 > 0 的整数才是有效键；其余（含 undefined / 0）一律当"无键" */
function normalizeKey(key: unknown): number | null {
  const n = Number(key)
  return Number.isInteger(n) && n > 0 ? n : null
}

/**
 * 在一侧文本里找这个片段。就两步：原样找 → 去掉首尾空白再找。
 * **不做模糊匹配、不做顺序修复、猜不到就返回 null** —— 猜错比不高亮更误导。
 */
function findFragment(text: string, fragment: string): { start: number; end: number } | null {
  if (!fragment) return null

  const at = text.indexOf(fragment)
  if (at >= 0) return { start: at, end: at + fragment.length }

  const trimmed = fragment.trim()
  if (trimmed && trimmed !== fragment) {
    const at2 = text.indexOf(trimmed)
    if (at2 >= 0) return { start: at2, end: at2 + trimmed.length }
  }

  return null
}

/**
 * 收集某一侧的带键区间，按**字符位置**升序排列并去掉重叠。
 *
 * 注意这里必须按位置排序、不能按 key 顺序：`Good(键1) → 好` 在译文里排在
 * `morning(键2) → 早上` 的**后面**，按 key 顺序排会得到 [2,3) → [0,2) 的逆序区间。
 */
export function collectRanges(
  text: string,
  pairs: TranslateSegmentPair[],
  side: 'source' | 'target'
): KeyedRange[] {
  const raw: KeyedRange[] = []

  for (const p of pairs) {
    const key = normalizeKey(p.key)
    if (key === null) continue
    const found = findFragment(text, side === 'source' ? p.source : p.target)
    if (found) raw.push({ key, ...found })
  }

  raw.sort((a, b) => a.start - b.start || a.end - b.end)

  const out: KeyedRange[] = []
  let cursor = 0
  for (const r of raw) {
    if (r.start < cursor) continue // 重叠 → 丢弃，同一段文字只渲染一次
    out.push(r)
    cursor = r.end
  }
  return out
}

/** 两侧都有键的编号 —— 只有这些才值得高亮（一侧有键另一边没有，高亮过去只会误导） */
export function sharedKeys(sourceRanges: KeyedRange[], targetRanges: KeyedRange[]): Set<number> {
  const target = new Set(targetRanges.map((r) => r.key))
  return new Set(sourceRanges.map((r) => r.key).filter((k) => target.has(k)))
}

/**
 * 把权威字符串按区间切成可渲染的 run 序列。
 * 不变量：`runs.map(r => r.text).join('') === text`（一个字都不丢、不加、不换序）。
 */
export function buildRuns(text: string, ranges: KeyedRange[], highlightable: Set<number>): RenderRun[] {
  const runs: RenderRun[] = []
  let cursor = 0

  for (const r of ranges) {
    if (!highlightable.has(r.key)) continue
    if (r.start > cursor) runs.push({ text: text.slice(cursor, r.start), key: null })
    runs.push({ text: text.slice(r.start, r.end), key: r.key })
    cursor = r.end
  }

  if (cursor < text.length) runs.push({ text: text.slice(cursor), key: null })
  return runs
}
