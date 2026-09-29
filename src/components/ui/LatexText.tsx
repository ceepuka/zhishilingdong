/**
 * LatexText —— 含公式的文本统一渲染入口
 * ------------------------------------------------------------------
 * 解决的问题（用户实测截图）：
 *   1) AI 在正文里写 `$U_S = 10\text{V}$` 这种**带围符**的行内公式，
 *      直接 {text} 输出会原样露出 LaTeX 源码；
 *   2) 更常见的是 AI 写**裸 LaTeX**（尤其试题）：`\triangle ABC`、`\sqrt{13}`、
 *      `60^\circ` —— 没有 `$` 包裹，只认围符的渲染器同样识别不了。
 *
 * 做法（双保险的渲染侧）：
 *   - 先按 `$...$` / `\(...\)` 切出显式公式段；
 *   - 普通文本段再用 `splitBareLatex` 切出裸 LaTeX 片段；
 *   - 两类数学片都走 `renderLatexSafe`；**解析成功才渲染成 KaTeX**，
 *     失败一律原样输出（绝不吞内容，也绝不把 `C:\Users` 这类误当公式）；
 *   - 解析失败的片段会用 `<code class="latex-fallback">` 视觉包裹（等宽字体 +
 *     浅琥珀背景 + 左侧细色条），让用户清楚"这是本该渲染为公式的源码"，
 *     textContent 仍保留原文，屏幕阅读器/复制/测试不受影响。
 *
 * 一致性：所有 AI 生成的文本字段都应经由本组件渲染，避免"有的字段渲染、有的裸露"。
 */
import { Fragment } from 'react';
import { renderLatexSafe, splitBareLatex } from '../../utils/latex';

/**
 * 切分正则：$$...$$（可跨行，块级）| $...$（不跨行，行内）| \[...\] | \(...\)
 * 捕获组保留分隔符。
 *
 * 顺序很关键：`$$` 必须排在 `$` 前面。否则 `$$E=mc^2$$` 会被 `$[^$\n]+$` 从
 * **第二个** `$` 开始匹配成 `$E=mc^2$`，首尾各漏一个 `$` 出来 ——
 * 用户看到的就是公式边上挂着两个多余的美元符号（真实 bug，模型很爱写 `$$`）。
 */
const MATH_SPLIT = /(\$\$[\s\S]+?\$\$|\$[^$\n]+\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\))/g;

/** 渲染一个（已被 KaTeX 校验过的）数学表达式 */
function renderMath(tex: string, key: string, displayMode = false) {
  const r = renderLatexSafe(tex, displayMode);
  if (r.ok) {
    return <span key={key} dangerouslySetInnerHTML={{ __html: r.html }} />;
  }
  // KaTeX 解析失败（流式半截公式、或反斜杠被吞等）→ 原样展示，**绝不吞内容**；
  // 用 fallback 样式给用户视觉信号：这是本该渲染为公式的源码，未能渲染。
  return (
    <code
      key={key}
      className="latex-fallback px-1 py-0.5 rounded font-mono text-[0.92em] bg-amber-50 dark:bg-amber-900/20 text-amber-900 dark:text-amber-200 border-l-2 border-amber-400 dark:border-amber-500"
      title="公式源码（未能渲染）"
    >
      {tex}
    </code>
  );
}

/** 渲染普通文本段：其中可能夹着裸 LaTeX */
function renderPlain(part: string, keyPrefix: string) {
  return (
    <Fragment key={keyPrefix}>
      {splitBareLatex(part).map((piece, i) =>
        piece.math ? renderMath(piece.value, `${keyPrefix}-m${i}`) : <span key={`${keyPrefix}-t${i}`}>{piece.value}</span>
      )}
    </Fragment>
  );
}

export function LatexText({ text, className = '' }: { text?: string; className?: string }) {
  if (!text) return null;
  const parts = text.split(MATH_SPLIT).filter((p) => p !== '');
  return (
    <span className={className}>
      {parts.map((part, i) => {
        // 块级围符：$$...$$ / \[...\]
        const display =
          (part.startsWith('$$') && part.endsWith('$$') && part.length >= 4) ||
          (part.startsWith('\\[') && part.endsWith('\\]'));
        // 行内围符：$...$ / \(...\)
        const inline =
          (!display && part.startsWith('$') && part.endsWith('$') && part.length >= 2) ||
          (part.startsWith('\\(') && part.endsWith('\\)'));
        if (display || inline) {
          // 块级与行内围符都是 2 字符（$$ / \[ / \( ...），行内 $ 是 1 字符
          const fence = display || part.startsWith('\\') ? 2 : 1;
          return renderMath(part.slice(fence, -fence), `d${i}`, display);
        }
        return renderPlain(part, `p${i}`);
      })}
    </span>
  );
}
