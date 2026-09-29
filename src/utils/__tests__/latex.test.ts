import { describe, it, expect } from 'vitest';
import { normalizeLatex, renderLatexSafe, splitBareLatex } from '../latex';

describe('latex util — LaTeX 归一化与安全渲染', () => {
  describe('normalizeLatex', () => {
    it('剥掉成对 $$...$$ 围栏', () => {
      expect(normalizeLatex('$$F = ma$$')).toBe('F = ma');
      expect(normalizeLatex('$$\\frac{a}{b}$$')).toBe('\\frac{a}{b}');
    });

    it('剥掉成对 \\[...\\] 围栏（display math）', () => {
      expect(normalizeLatex('\\[E = mc^2\\]')).toBe('E = mc^2');
    });

    it('剥掉成对 \\(...\\) 围栏（inline math）', () => {
      expect(normalizeLatex('\\(\\sin\\theta\\in[0,1]\\)')).toBe('\\sin\\theta\\in[0,1]');
    });

    it('剥掉单个 $...$ 围栏', () => {
      expect(normalizeLatex('$x^2 + y^2 = r^2$')).toBe('x^2 + y^2 = r^2');
    });

    it('纯 LaTeX 不带围栏时原样返回', () => {
      expect(normalizeLatex('F = ma')).toBe('F = ma');
      expect(normalizeLatex('\\frac{a}{b}')).toBe('\\frac{a}{b}');
    });

    it('空值/非字符串安全降级', () => {
      expect(normalizeLatex('')).toBe('');
      expect(normalizeLatex(null as any)).toBe('');
      expect(normalizeLatex(undefined as any)).toBe('');
    });

    it('不去除表达式内部的 ^ / _ 等运算符号', () => {
      expect(normalizeLatex('$$x^2 + y^2 = z^2$$')).toBe('x^2 + y^2 = z^2');
      expect(normalizeLatex('F = G\\frac{m_1 m_2}{r^2}')).toBe('F = G\\frac{m_1 m_2}{r^2}');
    });
  });

  describe('renderLatexSafe', () => {
    it('合法 LaTeX 返回 ok=true 并产出 KaTeX HTML', () => {
      const r = renderLatexSafe('F = ma');
      expect(r.ok).toBe(true);
      expect(r.html).toContain('katex');
      expect(r.tex).toBe('F = ma');
    });

    it('带 $$ 围栏的 LaTeX 也能正常渲染（自动剥掉）', () => {
      const r = renderLatexSafe('$$E = mc^2$$');
      expect(r.ok).toBe(true);
      expect(r.html).toContain('katex');
    });

    it('解析失败时 ok=false 且 html 为空，由调用方决定降级', () => {
      // 用真正会触发 KaTeX 解析错误的输入：未闭合的 \\frac
      const r = renderLatexSafe('\\frac{1}{');
      expect(r.ok).toBe(false);
      expect(r.html).toBe('');
      expect(r.tex).toBe('\\frac{1}{');
    });

    it('空输入返回 ok=true + html=""（无需渲染）', () => {
      const r = renderLatexSafe('');
      expect(r.ok).toBe(true);
      expect(r.html).toBe('');
    });
  });

  describe('splitBareLatex — 识别无 $ 围符的裸 LaTeX（试题常见）', () => {
    it('\\triangle 命令被切出为数学片，CJK 文本保持普通片', () => {
      const pieces = splitBareLatex('在 \\triangle ABC 中');
      expect(pieces).toEqual([
        { math: false, value: '在 ' },
        { math: true, value: '\\triangle ABC' },
        { math: false, value: ' 中' },
      ]);
    });

    it('\\sqrt{...} 独立成片（几何题选项）', () => {
      const pieces = splitBareLatex('\\sqrt{13}');
      expect(pieces).toEqual([{ math: true, value: '\\sqrt{13}' }]);
    });

    it('连续数学表达式（含 ^\\circ）被整体切出', () => {
      const pieces = splitBareLatex('已知 a = 3, b = 4, C = 60^\\circ，则边 c 的长为');
      const math = pieces.filter((p) => p.math);
      expect(math).toHaveLength(1);
      expect(math[0].value).toContain('a = 3');
      expect(math[0].value).toContain('60^\\circ');
      // 中文逗号处断开，其后保持普通文本
      expect(pieces[pieces.length - 1].math).toBe(false);
      expect(pieces[pieces.length - 1].value).toContain('则边 c 的长为');
    });

    it('两个 \\sqrt 被中文隔开时切成两片数学', () => {
      const mathPieces = splitBareLatex('\\sqrt{13} 或 \\sqrt{37}').filter((p) => p.math);
      expect(mathPieces.map((p) => p.value)).toEqual(['\\sqrt{13}', '\\sqrt{37}']);
    });

    it('无强信号时整段为普通文本（不误切）', () => {
      expect(splitBareLatex('求最大角的大小。')).toEqual([{ math: false, value: '求最大角的大小。' }]);
      expect(splitBareLatex('已知 a = 5, b = 7, c = 8')).toEqual([
        { math: false, value: '已知 a = 5, b = 7, c = 8' },
      ]);
    });

    it('snake_case 变量名不误判为数学（下划线后无花括号）', () => {
      const pieces = splitBareLatex('设置 learning_rate 参数');
      expect(pieces).toEqual([{ math: false, value: '设置 learning_rate 参数' }]);
    });

    it('带花括号的上下标视为信号', () => {
      const pieces = splitBareLatex('求和 S_{n} 的值');
      expect(pieces.some((p) => p.math && p.value.includes('S_{n}'))).toBe(true);
    });

    it('空串返回空数组', () => {
      expect(splitBareLatex('')).toEqual([]);
    });

    it('裸命令若 KaTeX 解析不通过，调用方应按普通文本兜底（此处校验可判定性）', () => {
      // Windows 路径里的 \Users 会被信号命中，但 KaTeX 解析失败 → 组件层回退为原文
      const pieces = splitBareLatex('C:\\Users\\foo');
      expect(pieces.some((p) => p.math)).toBe(true);
      expect(renderLatexSafe(pieces.find((p) => p.math)!.value).ok).toBe(false);
    });
  });
});
