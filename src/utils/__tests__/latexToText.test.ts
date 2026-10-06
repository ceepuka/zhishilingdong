import { describe, it, expect } from 'vitest';
import { readableLatexInText, readableLatexExpression } from '../latexToText';

describe('latexToText — 公式形式降级为可读文本', () => {
  describe('围符识别', () => {
    it('剥 $$...$$ 围符', () => {
      expect(readableLatexInText('$$F = ma$$')).toBe('F = ma');
    });

    it('剥 $...$ 围符', () => {
      expect(readableLatexInText('设 $i^2 = -1$ 则')).toBe('设 i² = -1 则');
    });

    it('剥成对 \\(...\\) 围符（AI 输出的 LaTeX 标准围符）', () => {
      expect(readableLatexInText('满足 \\(\\sin \\theta \\in [0, 1]\\) 的解')).toBe('满足 sin θ ∈ [0, 1] 的解');
    });

    it('剥成对 \\[...\\] 围符（display math）', () => {
      expect(readableLatexInText('关系：\\[E = mc^2\\]')).toBe('关系：E = mc²');
    });

    it('空输入与非字符串安全降级', () => {
      expect(readableLatexInText('')).toBe('');
      expect(readableLatexInText(undefined as any)).toBe('');
      expect(readableLatexInText(null as any)).toBe('');
    });

    it('混合多种围符并存（每个都剥）', () => {
      expect(readableLatexInText('设 $x$ 满足 \\(x \\geq 0\\)，证明 \\[x^2 = 4\\]'))
        .toBe('设 x 满足 x ≥ 0，证明 x² = 4');
    });
  });

  describe('符号降级', () => {
    it('关系符', () => {
      expect(readableLatexInText('$\\leq \\geq \\neq \\approx \\equiv$'))
        .toBe('≤ ≥ ≠ ≈ ≡');
    });

    it('集合 / 逻辑', () => {
      expect(readableLatexInText('$\\in \\notin \\subset \\cup \\cap \\emptyset \\forall \\exists$'))
        .toBe('∈ ∉ ⊂ ∪ ∩ ∅ ∀ ∃');
    });

    it('箭头', () => {
      expect(readableLatexInText('$\\to \\rightarrow \\Rightarrow \\mapsto$'))
        .toBe('→ → ⇒ ↦');
    });

    it('算术运算符', () => {
      expect(readableLatexInText('$\\pm \\times \\div \\cdot$'))
        .toBe('± × ÷ ·');
    });

    it('希腊字母（小写）', () => {
      expect(readableLatexInText('$\\alpha \\beta \\gamma \\theta \\pi \\omega$'))
        .toBe('α β γ θ π ω');
    });

    it('希腊字母（大写）', () => {
      expect(readableLatexInText('$\\Alpha \\Beta \\Delta \\Pi \\Omega$'))
        .toBe('Α Β Δ Π Ω');
    });

    it('黑板体集合（单字）', () => {
      expect(readableLatexInText('$\\mathbb{R} \\mathbb{N} \\mathbb{Z} \\mathbb{C}$'))
        .toBe('ℝ ℕ ℤ ℂ');
    });

    it('黑板体多字：保留字母（黑板体多字符号认不出）', () => {
      expect(readableLatexInText('$\\mathbb{abc}$')).toBe('abc');
    });

    it('无穷 / 偏导 / 算子', () => {
      expect(readableLatexInText('$\\infty \\partial \\nabla \\sum \\int$'))
        .toBe('∞ ∂ ∇ ∑ ∫');
    });

    it('三角函数：保留字母（数学界习惯）', () => {
      expect(readableLatexInText('$\\sin \\theta + \\cos \\phi$'))
        .toBe('sin θ + cos φ');
    });
  });

  describe('上下标', () => {
    it('单字符上标', () => {
      expect(readableLatexInText('$x^2 + y^2 = r^2$')).toBe('x² + y² = r²');
    });

    it('单字符下标', () => {
      expect(readableLatexInText('$a_1 + a_2 = a_3$')).toBe('a₁ + a₂ = a₃');
    });

    it('多字符上标：转括号保语义', () => {
      expect(readableLatexInText('$x^{2y}$')).toBe('x^(2y)');
    });

    it('多字符下标：转括号保语义', () => {
      expect(readableLatexInText('$a_{ij}$')).toBe('a_(ij)');
    });

    it('字母上下标（用 Unicode 字母-上标）', () => {
      expect(readableLatexInText('$x^n + y^m$')).toBe('xⁿ + yᵐ');
    });
  });

  describe('带参命令', () => {
    it('\\frac{a}{b} → (a)/(b)（带参命令先于花括号转括号）', () => {
      expect(readableLatexInText('$\\frac{a}{b}$')).toBe('(a)/(b)');
    });

    it('嵌套 \\frac：内层与外层都剥（参数匹配必须支持一层嵌套花括号）', () => {
      // 曾经的写法 `\{([^{}]*)\}` 匹配不了 `{z_1 \overline{z_2}}` 这种参数 ——
      // 于是整条 \frac 漏成字面 "frac(...)"，用户看到的还是 LaTeX 源码。
      expect(readableLatexInText('$\\frac{\\frac{a}{b}}{c}$')).toBe('((a)/(b))/(c)');
      expect(readableLatexInText('$\\frac{z_1 \\overline{z_2}}{z_2}$')).toBe('(z₁ ‾z₂‾)/(z₂)');
    });

    it('\\sqrt{x} → sqrt(x)', () => {
      expect(readableLatexInText('$\\sqrt{2}$')).toBe('sqrt(2)');
    });

    it('\\sqrt[n]{x} → root(n)(x)（n 次根）', () => {
      expect(readableLatexInText('$\\sqrt[3]{x}$')).toBe('root(3)(x)');
    });

    it('\\mathbf{R} → R（粗体 R）', () => {
      expect(readableLatexInText('$\\mathbf{R}$')).toBe('R');
    });
  });

  describe('未知命令 / 边角', () => {
    it('未知 \\foo 命令：去反斜杠保字母', () => {
      expect(readableLatexInText('$\\foo$')).toBe('foo');
    });

    it('裸 LaTeX 正文里的命令也降级（不碰散文，只碰数学命令）', () => {
      expect(readableLatexInText('i \\times i=-1'))
        .toBe('i × i=-1');
      expect(readableLatexInText('a,b \\in \\mathbb{R} 且 n \\in \\mathbb{Z}'))
        .toBe('a,b ∈ ℝ 且 n ∈ ℤ');
      expect(readableLatexInText('取模 |z|=\\sqrt{a^2+b^2}'))
        .toBe('取模 |z|=sqrt(a²+b²)');
    });

    it('空括号 `()` 被消除', () => {
      expect(readableLatexInText('${}$')).toBe('');
    });

    it('空白命令 \\; \\quad \\, 都被剥成空格', () => {
      expect(readableLatexInText('$\\;$')).toBe('');
      expect(readableLatexInText('$\\quad$')).toBe('');
      expect(readableLatexInText('$a\\,b$')).toBe('a b');
    });
  });

  describe('回归：之前 PDF 露出来的源码现在收掉了', () => {
    it('"i^2=-1" 在 $ 内 → "i² = -1"', () => {
      expect(readableLatexInText('设 $i^2 = -1$ 则')).toBe('设 i² = -1 则');
    });

    it('"\\mathbb{R}" 在 $ 内 → "ℝ"', () => {
      expect(readableLatexInText('$\\mathbb{R}$ 上的算子')).toBe('ℝ 上的算子');
    });

    it('"\\(z \\mid z = a + bi, a, b \\in \\mathbb{R}\\)" → "z | z = a + bi, a, b ∈ ℝ"', () => {
      // \\( 与 \\) 是 LaTeX 标准围符，识别后剥掉；剩下命令符号降级
      expect(readableLatexInText('\\(z \\mid z = a + bi, a, b \\in \\mathbb{R}\\)'))
        .toBe('z | z = a + bi, a, b ∈ ℝ');
    });
  });

  describe('```latex 围栏块（export.ts 自己就会生成这种块）', () => {
    const F = '```';

    it('围栏内容按"确定是公式"全量降级', () => {
      expect(readableLatexInText(`${F}latex\nz=a+bi \\quad (a,b \\in \\mathbb{R})\n${F}`))
        .toBe('z=a+bi (a,b ∈ ℝ)');
    });

    it('围栏与正文被 Markdown 解析器 join 成一行时也认得出（换行不能是硬条件）', () => {
      expect(readableLatexInText(`${F}latex z=a+bi \\quad (a,b \\in \\mathbb{R}) ${F}`))
        .toBe('z=a+bi (a,b ∈ ℝ)');
    });

    it('无语言围栏只脱围栏，内部继续按围符 / 裸命令处理', () => {
      expect(readableLatexInText(`${F}\n$E=mc^2$\n${F}`)).toBe('E=mc²');
    });

    it('非数学语言的围栏原样保留（代码块不能被当公式吃坏）', () => {
      const code = `${F}python\nprint("C:\\tmp", x[^a-z])\n${F}`;
      expect(readableLatexInText(code)).toContain('print("C:\\tmp", x[^a-z])');
    });
  });

  describe('readableLatexExpression — 已知整段是 LaTeX 时全量降级', () => {
    it('notation 字段（契约：纯 LaTeX，不加围符）', () => {
      expect(readableLatexExpression('z=a+bi \\quad (a,b \\in \\mathbb{R})'))
        .toBe('z=a+bi (a,b ∈ ℝ)');
    });

    it('带嵌套参数的分式', () => {
      expect(readableLatexExpression('\\frac{z_1}{z_2} = \\frac{z_1 \\overline{z_2}}{z_2 \\overline{z_2}} \\quad (z_2 \\neq 0)'))
        .toBe('(z₁)/(z₂) = (z₁ ‾z₂‾)/(z₂ ‾z₂‾) (z₂ ≠ 0)');
    });

    it('集合记法的转义花括号保住花括号形状', () => {
      expect(readableLatexExpression('\\{z \\mid z=a+bi, a,b \\in \\mathbb{R}\\}'))
        .toBe('{z | z=a+bi, a,b ∈ ℝ}');
    });

    it('空输入安全', () => {
      expect(readableLatexExpression('')).toBe('');
    });
  });

  describe('不能吃坏散文（这是"裸 LaTeX 兜底"的边界）', () => {
    it('snake_case 保持原样（裸 `_x` 不做下标）', () => {
      expect(readableLatexInText('变量命名用 snake_case')).toBe('变量命名用 snake_case');
    });

    it('正则里的 [^a-z] 不是上标', () => {
      expect(readableLatexInText('正则 [^a-z] 表示否定')).toBe('正则 [^a-z] 表示否定');
    });

    it('Windows 路径里的反斜杠不被当命令', () => {
      // 注意：这里的反斜杠必须由源码字面量给出（String.raw），
      // 否则会先被 JS 字符串转义吃掉，测的就不是真东西了
      expect(readableLatexInText(String.raw`把文件放到 C:\Users\asus 下面`))
        .toBe(String.raw`把文件放到 C:\Users\asus 下面`);
    });

    it('纯散文原样返回', () => {
      expect(readableLatexInText('牛顿第二定律指出，物体加速度与合力成正比。'))
        .toBe('牛顿第二定律指出，物体加速度与合力成正比。');
    });
  });
});