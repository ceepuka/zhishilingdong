import { describe, it, expect } from 'vitest';
import { sanitizeInlineSvg } from '../inlineSvg';

describe('sanitizeInlineSvg（AI 内联 SVG 原理图安全清洗）', () => {
  const good = "<svg viewBox='0 0 320 200'><line x1='10' y1='10' x2='200' y2='10' stroke='#334155' stroke-width='2'/></svg>";

  it('合法 SVG 原样保留', () => {
    expect(sanitizeInlineSvg(good)).toBe(good);
  });

  it('过粗线条压细到 2，细线保留', () => {
    expect(sanitizeInlineSvg("<svg viewBox='0 0 320 200'><line x1='10' y1='10' x2='200' y2='10' stroke='#334155' stroke-width='6'/></svg>"))
      .toContain("stroke-width=\"2\"");
    expect(sanitizeInlineSvg("<svg viewBox='0 0 320 200'><path d='M0 0 L10 10' style='stroke-width:8'/></svg>"))
      .toContain('stroke-width:2');
    expect(sanitizeInlineSvg(good)).toBe(good);
  });

  it('非字符串 / 空串 → undefined', () => {
    expect(sanitizeInlineSvg(undefined)).toBeUndefined();
    expect(sanitizeInlineSvg(42)).toBeUndefined();
    expect(sanitizeInlineSvg('   ')).toBeUndefined();
  });

  it('不是 svg 根元素 / 未闭合 / 没有尺寸信息 → 丢弃', () => {
    expect(sanitizeInlineSvg('<div>hi</div>')).toBeUndefined();
    expect(sanitizeInlineSvg("<svg viewBox='0 0 10 10'><rect/>")).toBeUndefined();
    expect(sanitizeInlineSvg('<svg><rect/></svg>')).toBeUndefined();
  });

  it('带 width/height 但无 viewBox → 仍可渲染', () => {
    expect(sanitizeInlineSvg("<svg width='300' height='200'><rect/></svg>")).toContain('<rect');
  });

  it('危险内容一律丢弃：script / 事件属性 / 外链引用 / javascript:', () => {
    expect(sanitizeInlineSvg("<svg viewBox='0 0 10 10'><script>alert(1)</script></svg>")).toBeUndefined();
    expect(sanitizeInlineSvg("<svg viewBox='0 0 10 10' onload='alert(1)'><rect/></svg>")).toBeUndefined();
    expect(sanitizeInlineSvg("<svg viewBox='0 0 10 10'><rect onclick='x()'/></svg>")).toBeUndefined();
    expect(sanitizeInlineSvg("<svg viewBox='0 0 10 10'><image href='http://evil.com/a.png'/></svg>")).toBeUndefined();
    expect(sanitizeInlineSvg("<svg viewBox='0 0 10 10'><a href='javascript:alert(1)'><rect/></a></svg>")).toBeUndefined();
    expect(sanitizeInlineSvg("<svg viewBox='0 0 10 10'><foreignObject><div/></foreignObject></svg>")).toBeUndefined();
  });

  it('体积超限 → 丢弃（防止模型把整页内容塞进来）', () => {
    const big = `<svg viewBox='0 0 10 10'>${'<rect/>'.repeat(10_000)}</svg>`;
    expect(sanitizeInlineSvg(big)).toBeUndefined();
  });
});
