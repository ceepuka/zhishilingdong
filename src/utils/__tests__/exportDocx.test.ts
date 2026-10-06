import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { buildDocx } from '../exportDocx';

/**
 * docx 产物结构回归。
 *
 * docx 是 OOXML（zip 包），**结构错了不会报错、只会让 Word 打不开或显示空白** ——
 * 这种失败在浏览器里无法直接观察到，所以必须靠测试锁住包内文件与关键标记。
 *
 * 重点验证三件容易错的事：
 * 1. zip 里必须齐备 `[Content_Types].xml` / `_rels/.rels` / `word/document.xml`
 *    —— 少任何一个 Word 直接报"内容有问题"。
 * 2. XML 特殊字符必须转义。漏一个 `<` 或 `&`，整份文档解析失败。
 * 3. 中文字体靠 `w:eastAsia`，只设 `w:ascii`（西文）时中文会落到 Word 默认字体，
 *    在部分系统上是方框。
 */
async function readZip(md: string, title = '测试标题') {
  const blob = await buildDocx(md, title);
  const zip = await JSZip.loadAsync(blob);
  const files = Object.keys(zip.files);
  const doc = await zip.file('word/document.xml')!.async('string');
  const styles = await zip.file('word/styles.xml')!.async('string');
  return { files, doc, styles, blob };
}

describe('docx — zip 包结构', () => {
  it('包含 Word 必需的四个部件', async () => {
    const { files } = await readZip('# 标题\n\n正文');

    expect(files).toContain('[Content_Types].xml');
    expect(files).toContain('_rels/.rels');
    expect(files).toContain('word/document.xml');
    expect(files).toContain('word/_rels/document.xml.rels');
  });

  it('列表样式依赖 numbering.xml，缺了有序列表会退化成普通段落', async () => {
    const { files } = await readZip('# 标题\n\n- a\n- b');

    expect(files).toContain('word/numbering.xml');
    expect(files).toContain('word/styles.xml');
  });

  it('产出的是 zip（.docx 不是纯文本，写错内容 Word 打不开）', async () => {
    const { blob } = await readZip('# 标题');
    // ZIP 本地文件头 magic：PK\x03\x04
    const head = new Uint8Array(await blob.slice(0, 4).arrayBuffer());

    expect(Array.from(head)).toEqual([0x50, 0x4b, 0x03, 0x04]);
  });
});

describe('docx — 内容映射', () => {
  it('标题映射到 Word 标题样式', async () => {
    const { doc } = await readZip('# 一级\n\n## 二级\n\n### 三级');

    expect(doc).toContain('Heading2');
    expect(doc).toContain('Heading3');
    // 一级标题应作为文档大标题
    expect(doc).toContain('Title');
  });

  it('无序列表引用 bullet 编号定义', async () => {
    const { doc } = await readZip('# t\n\n- 第一项\n- 第二项');

    expect(doc).toContain('ListBullet');
    expect(doc).toContain('numId');
    expect(doc).toContain('第一项');
    expect(doc).toContain('第二项');
  });

  it('有序列表引用 numbering 编号定义', async () => {
    const { doc } = await readZip('# t\n\n1. 第一步\n2. 第二步');

    expect(doc).toContain('ListNumber');
    expect(doc).toContain('第一步');
  });

  it('中文原样进 XML（不做任何转义或 latin1 化）', async () => {
    const { doc } = await readZip('# 牛顿第二定律\n\n合力决定加速度');

    expect(doc).toContain('牛顿第二定律');
    expect(doc).toContain('合力决定加速度');
  });

  it('中文字体走 eastAsia（否则中文可能显示为方框）', async () => {
    const { styles } = await readZip('# 标题');

    expect(styles).toContain('w:eastAsia');
  });
});

describe('docx — XML 转义（漏一个就整份文档打不开）', () => {
  it('转义 < > & " \'', async () => {
    const { doc } = await readZip('# 标题\n\nA < B & C > D "引号" \'单引号\'');

    expect(doc).toContain('&lt;');
    expect(doc).toContain('&gt;');
    expect(doc).toContain('&amp;');
    expect(doc).toContain('&quot;');
    expect(doc).toContain('&apos;');
  });

  it('裸标签不会被当成真实 XML 元素注入', async () => {
    const { doc } = await readZip('# t\n\n<script>alert(1)</script>');

    expect(doc).not.toContain('<script>');
    expect(doc).toContain('&lt;script&gt;');
  });
});

describe('docx — 行内公式降级为可读文本', () => {
  it('剥掉 $ 包裹但保留公式内容', async () => {
    const { doc } = await readZip('# t\n\n合力 $F=ma$ 决定加速度');

    expect(doc).toContain('F=ma');
    expect(doc).not.toContain('$F=ma$');
  });

  it('分数补除号（frac (a)(b) 读起来像连乘，除法语义会丢）', async () => {
    const { doc } = await readZip('# t\n\n$\\frac{a}{b}$');

    expect(doc).toContain('(a)/(b)');
    expect(doc).not.toContain('\\frac');
  });

  it('平方根保留 sqrt 字样', async () => {
    const { doc } = await readZip('# t\n\n$\\sqrt{x^2+y^2}$');

    expect(doc).toContain('sqrt(x²+y²)');
  });

  it('```latex 围栏块被降级（export.ts 自己就会生成这种块，不能被当正文漏过）', async () => {
    const { doc } = await readZip('# t\n\n```latex\nz=a+bi \\quad (a,b \\in \\mathbb{R})\n```');

    expect(doc).toContain('z=a+bi (a,b ∈ ℝ)');
    expect(doc).not.toContain('\\mathbb');
    expect(doc).not.toContain('quad');
  });

  it('裸 LaTeX（无围符）也要降级：notation 字段契约就是"不加围符的纯 LaTeX"', async () => {
    // 用户反馈的"公式没渲染"就是这条漏网：之前只认 $ 围符，
    // notation / 正文里的裸命令原样漏进 Word。
    const { doc } = await readZip('# t\n\n记作 $\\text{Re}(z)$，满足 i \\times i=-1，且 a,b \\in \\mathbb{R}');

    expect(doc).toContain('记作 Re(z)');
    expect(doc).toContain('i × i=-1');
    expect(doc).toContain('a,b ∈ ℝ');
    expect(doc).not.toContain('\\times');
    expect(doc).not.toContain('\\in');
  });
});