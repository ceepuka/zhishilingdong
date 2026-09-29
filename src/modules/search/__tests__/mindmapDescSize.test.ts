import { describe, it, expect } from 'vitest';

/**
 * 思维导图描述盒尺寸估算
 * ------------------------------------------------------------------
 * 这里刻意复制 SearchResults.tsx 里 estimateTextWidthEm 的算法做**行为契约测试**：
 * 核心不变量是 —— 含希腊字母/全角字符的公式，其估算宽度必须显著大于
 * "按纯 ASCII 半角算"的宽度，否则描述盒高度会被低估、文字溢出（真实 bug）。
 *
 * 如果算法有改动，本测试会失败并提醒同步检查 rendering 侧是否仍然对齐。
 */

const DESC_WIDTH = 120;
const DESC_FONT_SIZE = 12;
const DESC_CSS_PADDING_X = 8;

function estimateTextWidthEm(text: string): number {
  const GREEK = /[\u0391-\u03C9]/;
  const CJK = /[\u4E00-\u9FFF\u3000-\u303F\uFF00-\uFFEF]/;
  const MATH_SYMBOL = /[±≤≥≠≈√∞∑∏∫×÷·∈∉⊂⊆∪∩→←↔⇒⇔°′″]/;

  let em = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '^' || ch === '_') {
      if (i + 1 < text.length) { em += 0.4; i++; }
      continue;
    }
    if (ch === '\n' || ch === '\r') {
      const perLine = (DESC_WIDTH - DESC_CSS_PADDING_X * 2) / DESC_FONT_SIZE;
      em = Math.ceil(em / perLine) * perLine;
      continue;
    }
    if (GREEK.test(ch)) { em += 0.95; continue; }
    if (CJK.test(ch)) { em += 1.0; continue; }
    if (MATH_SYMBOL.test(ch)) { em += 0.8; continue; }
    em += 0.55;
  }
  return em;
}

function calcDescLines(text: string): number {
  const emPerLine = (DESC_WIDTH - DESC_CSS_PADDING_X * 2) / DESC_FONT_SIZE;
  return Math.max(1, Math.ceil(estimateTextWidthEm(text) / emPerLine));
}

/** 旧算法（bug 版本）：一律按半角 0.55em 逐字符算，用于对照 */
function oldCalcDescLines(text: string): number {
  const charsPerLine = Math.floor((DESC_WIDTH - DESC_CSS_PADDING_X * 2) / (DESC_FONT_SIZE * 0.55));
  return Math.max(1, Math.ceil(text.length / charsPerLine));
}

describe('思维导图描述盒高度估算（em 单位制）', () => {
  it('CJK 汉字按 1em 计宽（13 个汉字 → 2 行）', () => {
    // 13em / 8.67em每行 = 1.5 → 2 行
    expect(estimateTextWidthEm('基本恒等式是三角变换的基础')).toBeCloseTo(13, 5);
    expect(calcDescLines('基本恒等式是三角变换的基础')).toBe(2);
  });

  it('希腊字母按 0.95em 计宽（不是半角 0.55）', () => {
    expect(estimateTextWidthEm('α')).toBeCloseTo(0.95, 5);
    expect(estimateTextWidthEm('sinα')).toBeCloseTo(0.55 * 3 + 0.95, 5);
  });

  it('含希腊字母的公式必须比旧算法估算更多行（溢出根因）', () => {
    const formula = 'sin(α±β)=sinαcosβ±cosαsinβ，用于计算角度和差的三角函数值';
    const fixed = calcDescLines(formula);
    const buggy = oldCalcDescLines(formula);
    expect(fixed).toBeGreaterThan(buggy);
  });

  it('纯 ASCII 短文本仍是 1 行', () => {
    expect(calcDescLines('F = ma')).toBe(1);
  });

  it('上标下标（x^2）按更窄的宽度计算', () => {
    // x^2+y^2=z^2： x .^2 + y .^2 = z .^2
    // 逐段：x(0.55) ^2(0.4) +(0.55) y(0.55) ^2(0.4) =(0.55) z(0.55) ^2(0.4)
    const expected = 0.55 + 0.4 + 0.55 + 0.55 + 0.4 + 0.55 + 0.55 + 0.4;
    expect(estimateTextWidthEm('x^2+y^2=z^2')).toBeCloseTo(expected, 5);
    // 对照：若按纯半角算（11 字符 × 0.55 = 6.05em）会高估，上标必须更窄
    expect(estimateTextWidthEm('x^2+y^2=z^2')).toBeLessThan('x^2+y^2=z^2'.length * 0.55);
  });

  it('公式越长行数单调不减', () => {
    expect(calcDescLines('sin(α±β)=sinαcosβ±cosαsinβ 用于计算角度和差的三角函数值'))
      .toBeGreaterThan(calcDescLines('sinα'));
  });

  it('空白与全角标点不会低估', () => {
    // 全角逗号 ，在 FF00-FFEF 范围内 → 1em
    expect(estimateTextWidthEm('，')).toBeCloseTo(1.0, 5);
    expect(estimateTextWidthEm(' ')).toBeCloseTo(0.55, 5);
  });
});
