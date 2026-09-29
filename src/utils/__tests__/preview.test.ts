import { describe, it, expect } from 'vitest';
import { toPlainPreview } from '../preview';

/**
 * 列表预览纯文本化回归。
 *
 * 背景：收藏列表的摘要原先直接对 AI 原文 `slice(0, 60)`，
 * 于是预览里会露出 `$x>0$` 这类公式源码、`## 标题` / `**重点**` 这类 Markdown 标记，
 * 而且截断点可能正好落在 `$...$` 中间，只剩半截公式。
 */
describe('toPlainPreview — 预览必须先降级为纯文本再截断', () => {
  it('去掉行内公式围符，保留可读内容', () => {
    expect(toPlainPreview('若 $x>0$ 则函数单调递增')).toBe('若 x>0 则函数单调递增');
  });

  it('去掉块级公式围符（$$ 与 \\[ \\]）', () => {
    expect(toPlainPreview('由 $$F=ma$$ 得')).toBe('由 F=ma 得');
    expect(toPlainPreview('即 \\[a^2+b^2=c^2\\] 成立')).toBe('即 a^2+b^2=c^2 成立');
  });

  it('去掉 Markdown 标记（标题 / 加粗 / 列表 / 引用 / 表格竖线）', () => {
    const md = '## 一级标题\n\n- **重点**内容\n> 引用\n\n| 列A | 列B |';
    expect(toPlainPreview(md)).toBe('一级标题 重点内容 引用 列A 列B');
  });

  it('链接保留可见文字、图片整段丢弃', () => {
    expect(toPlainPreview('见 [官方文档](https://example.com) 说明')).toBe('见 官方文档 说明');
    expect(toPlainPreview('图 ![示意图](https://example.com/a.png) 结束')).toBe('图 结束');
  });

  it('折叠所有空白为单空格（预览是一行）', () => {
    expect(toPlainPreview('第一行\n\n第二行\t第三行')).toBe('第一行 第二行 第三行');
  });

  it('截断时不留半截反斜杠命令', () => {
    const long = `${'前'.repeat(50)} \\frac{a}{b} 后面还有很长很长的内容`;
    const out = toPlainPreview(long, 60);
    expect(out.endsWith('…')).toBe(true);
    // 结尾不允许出现被剪断的命令（如 `\fra`）或孤立反斜杠
    expect(/\\[a-zA-Z]*$/.test(out.replace('…', ''))).toBe(false);
  });

  it('短文本不追加省略号', () => {
    expect(toPlainPreview('很短')).toBe('很短');
  });

  it('空值 / undefined 返回空串', () => {
    expect(toPlainPreview(undefined)).toBe('');
    expect(toPlainPreview(null)).toBe('');
    expect(toPlainPreview('')).toBe('');
  });
});
