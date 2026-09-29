import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { MarkdownContent } from '../MarkdownContent';

afterEach(cleanup);

const hasKatex = (el: HTMLElement) => !!el.querySelector('.katex');

/**
 * Markdown + LaTeX 共存的回归。
 *
 * 背景：文档正文一直是裸 ReactMarkdown 渲染的 —— Markdown 不认识 LaTeX，
 * 于是 AI 写进正文的 `$E=mc^2$` 会原样露出源码（项目铁律要求所有 AI 文本走 LatexText）。
 */
describe('MarkdownContent — 结构交给 Markdown、文本交给 LatexText', () => {
  it('标题/列表/加粗等 Markdown 结构正常渲染', () => {
    const { container } = render(
      <MarkdownContent content={'# 报告标题\n\n- 第一点\n- **加粗**第二点'} />
    );
    expect(container.querySelector('h1')?.textContent).toBe('报告标题');
    expect(container.querySelectorAll('li').length).toBe(2);
    expect(container.querySelector('strong')?.textContent).toBe('加粗');
  });

  it('正文里的行内公式渲染为 KaTeX', () => {
    const { container } = render(<MarkdownContent content={'由质能方程 $E=mc^2$ 可知'} />);
    expect(hasKatex(container)).toBe(true);
    expect(container.textContent).not.toContain('$');
  });

  it('块级公式 $$...$$ 渲染为 KaTeX，不残留 $ 符号', () => {
    const { container } = render(<MarkdownContent content={'推导如下：\n\n$$F=ma$$'} />);
    expect(hasKatex(container)).toBe(true);
    expect(container.textContent).not.toContain('$');
  });

  it('表格单元格里的公式也渲染（不只段落）', () => {
    const md = '| 名称 | 公式 |\n| --- | --- |\n| 质能方程 | $E=mc^2$ |';
    const { container } = render(<MarkdownContent content={md} />);
    expect(container.querySelector('table')).not.toBeNull();
    expect(hasKatex(container)).toBe(true);
  });

  it('代码块内的 $..$ 是字面量，绝不当公式渲染', () => {
    const md = '示例：\n\n```\necho "$HOME/$USER"\n```\n';
    const { container } = render(<MarkdownContent content={md} />);
    expect(hasKatex(container)).toBe(false);
    expect(container.querySelector('code')?.textContent).toContain('$HOME/$USER');
  });

  it('空内容不渲染', () => {
    const { container } = render(<MarkdownContent content="" />);
    expect(container.textContent).toBe('');
  });
});
