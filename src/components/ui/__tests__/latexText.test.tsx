import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { LatexText } from '../LatexText';

afterEach(cleanup);

const hasKatex = (el: HTMLElement) => !!el.querySelector('.katex');

describe('LatexText — 含公式文本的统一渲染入口', () => {
  it('显式 $...$ 围符渲染为 KaTeX', () => {
    const { container } = render(<LatexText text="合力 $F = ma$ 决定加速度" />);
    expect(hasKatex(container)).toBe(true);
    // 正文保留
    expect(container.textContent).toContain('合力');
    expect(container.textContent).toContain('决定加速度');
  });

  it('裸 LaTeX（无 $ 围符）也能渲染 —— 试题常见形态', () => {
    const { container } = render(<LatexText text="在 \triangle ABC 中" />);
    expect(hasKatex(container)).toBe(true);
    expect(container.textContent).toContain('在');
    expect(container.textContent).toContain('中');
  });

  it('裸 \\sqrt{...} 渲染为 KaTeX（选择题选项）', () => {
    const { container } = render(<LatexText text="\sqrt{13}" />);
    expect(hasKatex(container)).toBe(true);
  });

  it('混合文本与裸公式：CJK 原样、公式渲染，顺序不乱', () => {
    const { container } = render(<LatexText text="则边 \sqrt{13} 的长为" />);
    expect(hasKatex(container)).toBe(true);
    const text = container.textContent ?? '';
    expect(text.indexOf('则边')).toBeLessThan(text.indexOf('的长为'));
  });

  it('普通文本不产生 KaTeX', () => {
    const { container } = render(<LatexText text="今天天气不错" />);
    expect(hasKatex(container)).toBe(false);
    expect(container.textContent).toBe('今天天气不错');
  });

  it('看似 LaTeX 但 KaTeX 解析失败时原样输出，绝不吞内容', () => {
    const { container } = render(<LatexText text="路径 C:\Users\foo 不存在" />);
    expect(hasKatex(container)).toBe(false);
    expect(container.textContent).toContain('C:\\Users\\foo');
    expect(container.textContent).toContain('不存在');
  });

  it('KaTeX 解析失败时用 latex-fallback 视觉包裹（textContent 仍保留原文，给用户明确信号）', () => {
    // 真实的"反斜杠被吞"场景，模型已经写出坏 LaTeX 后——
    // 这种"反斜杠都没了"的文本（如 "rac{a}{b}" 无 \）按设计不会被 splitBareLatex 拾取，
    // 也不会被认作公式（避免误识别 snake_case 等）。真正的 fallback 测试要构造
    // "有反斜杠但语法坏"的 LaTeX（KaTeX 解析会 throw 的情形）。
    const malformed = '结果为 $\\frac{a}{$';
    const { container } = render(<LatexText text={malformed} />);
    // 绝不渲染成 KaTeX（花括号未闭合，KaTeX 抛错）
    expect(hasKatex(container)).toBe(false);
    // 原文保留（屏幕阅读器/复制/测试可读）
    expect(container.textContent).toContain('\\frac{a}{');
    // 视觉信号：必须用 latex-fallback 类包裹
    const fallback = container.querySelector('.latex-fallback');
    expect(fallback).not.toBeNull();
    // 且原文在 fallback 内
    expect(fallback?.textContent).toContain('\\frac{a}{');
  });

  it('KaTeX 解析失败时 hover 标题提示"公式源码（未能渲染）"', () => {
    const { container } = render(<LatexText text="未闭合 $\\sqrt{2$" />);
    expect(hasKatex(container)).toBe(false);
    const fallback = container.querySelector('.latex-fallback');
    expect(fallback?.getAttribute('title')).toContain('公式源码');
  });

  it('空值渲染为空', () => {
    const { container } = render(<LatexText text={undefined} />);
    expect(container.textContent).toBe('');
  });
});

/**
 * 块级围符回归。
 *
 * 真实 bug：MATH_SPLIT 原先只有 `$[^$\n]+$`，对 `$$E=mc^2$$` 会从**第二个** `$`
 * 开始匹配，于是首尾各漏一个 `$` 出来 —— 公式渲染了，但边上挂着两个美元符号。
 * 模型写块级公式时很爱用 `$$`，所以必须在切分正则里把 `$$` 排在 `$` 前面。
 */
describe('LatexText — 块级围符 $$ / \\[ \\]', () => {
  it('$$...$$ 渲染为 KaTeX，且不残留 $ 符号', () => {
    const { container } = render(<LatexText text="由牛顿第二定律 $$F=ma$$ 可知" />);
    expect(hasKatex(container)).toBe(true);
    expect(container.textContent).not.toContain('$');
    expect(container.textContent).toContain('由牛顿第二定律');
    expect(container.textContent).toContain('可知');
  });

  it('\\[...\\] 围符同样渲染，且不残留方括号围符', () => {
    // 注意：JSX 字符串属性**不处理反斜杠转义**，必须用表达式容器传 JS 字符串
    const { container } = render(<LatexText text={'代入得 \\[a^2+b^2=c^2\\]'} />);
    expect(hasKatex(container)).toBe(true);
    expect(container.textContent).not.toContain('\\[');
    expect(container.textContent).not.toContain('\\]');
  });

  it('单个 $ 不是围符，原样保留（价格类文本不被误判为公式）', () => {
    const { container } = render(<LatexText text="总价 $5 元" />);
    expect(hasKatex(container)).toBe(false);
    expect(container.textContent).toContain('$5');
  });
});
