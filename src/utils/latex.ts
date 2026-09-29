/**
 * 公式渲染：LaTeX 归一化 + 安全渲染
 * ------------------------------------------------------------------
 * 解决的 3 个真实痛点：
 *   1) 模型常把 LaTeX 包在 `$$...$$` / `\[...\]` / `\(...\)` 围栏里再写进 notation 字段，
 *      KaTeX 不识别这些围栏，会整段报红。
 *   2) 流式过程中半截 LaTeX（`F = \frac{m_1 m_2`）也会让 KaTeX 报错。
 *   3) 之前的 `dangerouslySetInnerHTML` + 红色 `katex-error` 兜底，体验很差。
 *
 * 本文件提供：
 *   - normalizeLatex  剥掉常见围栏（$$ / \[ \] / \( \)），保留内部纯 LaTeX
 *   - renderLatexSafe 用 throwOnError:true 试解析；成功返回 HTML，失败返回 ok:false
 *      由调用方决定是降级为等宽代码块，还是别的方式
 */

import katex from 'katex';

/** 去掉 LaTeX 表达式最外层的 $$ / \[ \] / \( \) 等围栏，只保留内部纯 LaTeX */
export function normalizeLatex(raw: string | null | undefined): string {
  if (!raw) return '';
  let s = String(raw).trim();

  // $$ ... $$ （成对，可能跨行）
  s = s.replace(/^\$\$([\s\S]*)\$\$$/g, '$1').trim();
  // \[ ... \] （成对，可能跨行）
  s = s.replace(/^\\\[([\s\S]*)\\]$/g, '$1').trim();
  // \( ... \) （行内成对）
  s = s.replace(/^\\\(([\s\S]*)\\\)$/g, '$1').trim();
  // 单个 $ ... $ 围栏（成对；只剥最外层，避免误伤 a^2+b^2=c^2 这种不含 $ 的内容）
  s = s.replace(/^\$([^$\n]+)\$$/g, '$1').trim();

  return s;
}

export interface SafeLatexResult {
  /** 渲染好的 HTML（成功时）；失败时为空字符串 */
  html: string;
  /** KaTeX 是否成功解析 */
  ok: boolean;
  /** 归一化后的纯 LaTeX（无论成功失败都给出来，方便 UI 兜底显示原文） */
  tex: string;
}

/**
 * 安全渲染：成功返回 KaTeX HTML；失败时 ok:false，调用方降级为等宽代码块。
 *
 * 注意：必须用 throwOnError:true —— 配 throwOnError:false 时 KaTeX 会把错误以
 * `<span class="katex-error">` 形式塞进 DOM 并涂红，前端很难做干净的兜底。
 *
 * `strict:'ignore'` 让 `\[` `\]` 这种没包裹内容的写法不报错（部分模型会这样写）。
 */
export function renderLatexSafe(raw: string | null | undefined, displayMode = false): SafeLatexResult {
  const tex = normalizeLatex(raw);
  if (!tex) return { html: '', ok: true, tex: '' };
  try {
    const html = katex.renderToString(tex, {
      throwOnError: true,
      displayMode,
      strict: 'ignore',
      output: 'html',
    });
    return { html, ok: true, tex };
  } catch {
    return { html: '', ok: false, tex };
  }
}

/* ------------------------------------------------------------------
 * 裸 LaTeX 识别（无 `$` 围符）
 * ------------------------------------------------------------------
 * 真实痛点（用户实测截图）：模型并不总是乖乖用 `$...$` 包裹，尤其**试题**里
 * 常常直接写裸 LaTeX —— `\triangle ABC`、`\sqrt{13}`、`60^\circ`。
 * 这些内容即使走了渲染器也识别不出来，只能原样露出（"公式报红"的最新形态）。
 *
 * 策略：只认**强信号**，且必须能被 KaTeX 解析成功才算数学，双重保险避免误伤：
 *   - 反斜杠命令（≥2 字母）：`\triangle` `\sqrt` `\vec` `\frac` `\circ` …
 *   - 带花括号的上下标：`^{...}` `_{...}`
 * 刻意**不**把 `x^2` / `learning_rate` 这类当信号（无花括号），
 * 避免把 `snake_case` 变量名误渲染成下标。
 */

/** 强信号：反斜杠命令（≥2 字母）或 带花括号的上下标 */
const BARE_LATEX_SIGNAL = /\\[a-zA-Z]{2,}|[\^_]\s*\{/g;

/**
 * 不属于数学片的字符：CJK 汉字、CJK 标点/全角符号、`$`（交给围符分支处理）、换行。
 * 其余（ASCII 字母数字、运算符、空格、常见数学 Unicode）都允许并入数学片。
 */
const NOT_MATH_CHAR = /[\u3000-\u303F\u4E00-\u9FFF\uFF00-\uFFEF$\r\n]/;

function isMathChar(ch: string): boolean {
  return !!ch && !NOT_MATH_CHAR.test(ch);
}

export interface BarePiece {
  /** 该片段是否为（裸）数学 */
  math: boolean;
  value: string;
}

/**
 * 把一段**不含围符**的纯文本切成"普通文本 / 裸数学"片段。
 * 数学片一律已去掉空白；调用方应对 `math` 片再走 renderLatexSafe 校验，
 * 解析失败就按普通文本输出（绝不吞内容）。
 */
export function splitBareLatex(plain: string): BarePiece[] {
  if (!plain) return [];
  const pieces: BarePiece[] = [];
  let cursor = 0;
  BARE_LATEX_SIGNAL.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = BARE_LATEX_SIGNAL.exec(plain))) {
    if (m.index < cursor) continue; // 已被上一片覆盖
    // 向左扩展（不越过 cursor、不越过非数学字符）
    let start = m.index;
    while (start > cursor && isMathChar(plain[start - 1])) start--;
    // 向右扩展
    let end = m.index + m[0].length;
    while (end < plain.length && isMathChar(plain[end])) end++;
    // 修剪首尾空白
    let s = start;
    let e = end;
    while (s < e && /\s/.test(plain[s])) s++;
    while (e > s && /\s/.test(plain[e - 1])) e--;
    if (s <= e) {
      if (s > cursor) pieces.push({ math: false, value: plain.slice(cursor, s) });
      pieces.push({ math: true, value: plain.slice(s, e) });
    }
    // 前进到**修剪后的末尾 e**（而非 end）：被 trim 掉的首尾空白要留给下一片普通文本，
    // 否则 "ABC 中" 这种中间空格会被吞掉（真实 bug）。
    // 信号本身不可能以空白结尾，故 e > m.index 恒成立，循环必定前进。
    cursor = e;
    BARE_LATEX_SIGNAL.lastIndex = e;
  }
  if (cursor < plain.length) pieces.push({ math: false, value: plain.slice(cursor) });
  return pieces;
}

