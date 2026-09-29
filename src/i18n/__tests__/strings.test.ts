import { describe, it, expect } from 'vitest';
import { commonEn, commonZh } from '../strings/common';
import { fmt } from '../strings';

/**
 * 版权声明契约：`App.tsx` 的页脚靠 `split('{author}')` 把作者名切出来、
 * 单独渲染成 GitHub 链接，并靠 `fmt` 填充 `{year}`。
 * 文案里一旦漏掉占位符，链接会**静默消失**（不报错、只少一段），
 * 所以用测试把这个契约钉住。
 */
describe('版权声明文案（app.copyright）', () => {
  it.each([
    ['en', commonEn.app.copyright],
    ['zh', commonZh.app.copyright],
  ])('%s 版必须含 {year} 与 {author} 占位符', (_lang, template) => {
    expect(template).toContain('{year}');
    expect(template).toContain('{author}');
  });

  it('切分 {author} + 填充 {year} 后，年号就位、作者名留在可链接的独立片段', () => {
    const [before, after] = commonEn.app.copyright.split('{author}');
    const lead = fmt(before, { year: 2026 });
    expect(lead).toBe('© 2026 ');
    expect(after).toBe(' · All rights reserved');
  });
});
