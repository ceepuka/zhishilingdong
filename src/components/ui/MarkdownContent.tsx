/**
 * MarkdownContent —— 支持公式的 Markdown 渲染入口
 * ------------------------------------------------------------------
 * 为什么需要它：
 *
 *   文档正文是 Markdown，一直用裸 `ReactMarkdown` 渲染。但 **Markdown 本身不认识 LaTeX** ——
 *   AI 写进正文的 `$E=mc^2$`、`$$F=ma$$`、`\frac{a}{b}` 会原样显示成源码。
 *   这违反了项目铁律「所有 AI 文本都必须经由 `LatexText` 渲染」，
 *   表现就是"文档里的公式不渲染"，和收藏里公式不渲染是同一类问题的两个入口。
 *
 * 做法：
 *   仍然让 ReactMarkdown 负责**结构**（标题/列表/表格/引用），
 *   但把所有承载文本的元素（p / li / td / th / h1~h6 / blockquote）里的
 *   **字符串子节点**交给 `LatexText` —— 于是公式得到渲染，
 *   而 `**加粗**`、表格、列表等 Markdown 语义完全不受影响。
 *
 *   例外：`<code>` / `<pre>` 内部一律不解析公式（代码块里的 `$` 是字面量），
 *   以免把代码示例渲染坏。
 *
 * 递归策略：只对**白名单内联标签**（strong/em/del/a/span/sup/sub）继续下钻，
 * 其它元素原样保留（它们自己有对应的 override 处理）。
 */
import { cloneElement, createElement, Fragment, isValidElement, type ComponentType, type ReactElement, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { LatexText } from './LatexText';

/** 内联标签：其子节点需要继续做公式识别 */
const INLINE_RECURSE = new Set(['strong', 'em', 'del', 'a', 'span', 'sup', 'sub', 'b', 'i']);

/** 这些标签内部的文本是字面量，绝不解析公式 */
const NO_LATEX = new Set(['code', 'pre']);

function latexize(children: ReactNode): ReactNode {
  if (typeof children === 'string') return <LatexText text={children} />;
  if (typeof children === 'number' || children === null || children === undefined) return children;
  if (Array.isArray(children)) {
    return children.map((child, i) => <Fragment key={i}>{latexize(child)}</Fragment>);
  }
  if (isValidElement(children)) {
    const el = children as ReactElement<{ children?: ReactNode }>;
    const tag = typeof el.type === 'string' ? el.type : '';
    if (NO_LATEX.has(tag)) return children;
    if (INLINE_RECURSE.has(tag)) {
      return cloneElement(el, undefined, latexize(el.props.children));
    }
    return children;
  }
  return children;
}

/**
 * 生成一个"文本子节点走 LatexText"的元素渲染器。
 * `node`（hast 节点）由 react-markdown 注入，必须剔除、不能落到 DOM 上。
 */
function withLatex(tag: string): ComponentType<any> {
  // react-markdown 为每个标签生成不同的 props 类型，这里只关心 children，
  // 其余属性（className/style/...）原样透传，所以用宽松类型 + 剔除 node。
  return function LatexAwareElement(props: Record<string, unknown> & { children?: ReactNode }) {
    const rest: Record<string, unknown> = { ...props };
    delete rest.node;
    delete rest.children;
    return createElement(tag, rest, latexize(props.children));
  };
}

export interface MarkdownContentProps {
  /** Markdown 原文 */
  content: string;
  /** 外层容器类名（排版交给调用方，如 prose 系列） */
  className?: string;
}

export function MarkdownContent({ content, className }: MarkdownContentProps) {
  if (!content) return null;
  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: withLatex('p'),
          li: withLatex('li'),
          td: withLatex('td'),
          th: withLatex('th'),
          blockquote: withLatex('blockquote'),
          h1: withLatex('h1'),
          h2: withLatex('h2'),
          h3: withLatex('h3'),
          h4: withLatex('h4'),
          h5: withLatex('h5'),
          h6: withLatex('h6'),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
