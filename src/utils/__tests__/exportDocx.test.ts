import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { buildDocx, type AppendixImage, type LandscapeAppendix } from '../exportDocx';
import { getCurrentStrings } from '../../i18n/strings';
import type { ExportFigure } from '../canvasRenderer';
import type { FigureMap } from '../exportFigures';

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
async function readZip(
  md: string,
  title = '测试标题',
  appendix?: LandscapeAppendix,
  figures?: FigureMap
) {
  const blob = await buildDocx(md, title, appendix, figures);
  const zip = await JSZip.loadAsync(blob);
  const files = Object.keys(zip.files);
  const doc = await zip.file('word/document.xml')!.async('string');
  const styles = await zip.file('word/styles.xml')!.async('string');
  return { files, doc, styles, blob, zip };
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

  /**
   * 首标题只允许出现一次。
   *
   * 旧实现把 md 首行 `# xxx` **降级成普通段落**（本意是躲开顶部标题的重复），
   * 结果是 Word 里出现"居中大标题 + 紧接一行同文字的小号正文"的双标题，
   * 用户实测反馈"Word 首标题格式和 PDF 不一致"。
   * 要么它是标题（用 Title 渲染），要么它不该出现（丢弃），没有第三种身份。
   */
  it('首标题与文档标题同文时只出现一次', async () => {
    const { doc } = await readZip('# 复数\n\n正文内容', '复数');

    expect((doc.match(/<w:pStyle w:val="Title"\/>/g) ?? [])).toHaveLength(1);
    expect((doc.match(/>复数</g) ?? [])).toHaveLength(1);
  });

  it('首标题与文档标题不同文时保留为 Heading1（那是内容自己的标题）', async () => {
    const { doc } = await readZip('# 内容标题\n\n正文', '文档标题');

    expect(doc).toContain('Heading1');
    expect((doc.match(/>内容标题</g) ?? [])).toHaveLength(1);
    expect((doc.match(/>文档标题</g) ?? [])).toHaveLength(1);
  });

  it('Title 样式与 PDF 首标题同格式（左对齐 / 20pt / #0F172A / 青色下划线）', async () => {
    const { styles } = await readZip('# t');
    const style = /<w:style w:type="paragraph" w:styleId="Title">([\s\S]*?)<\/w:style>/.exec(styles);
    expect(style).toBeTruthy();
    const body = style![1];

    expect(body).not.toContain('w:jc w:val="center"');
    expect(body).toContain('w:sz w:val="40"');
    expect(body).toContain('w:color w:val="0F172A"');
    expect(body).toContain('w:color="0D9488"');
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

/**
 * 导图附录页 —— **从画布截图**（内嵌位图）。
 *
 * 这条链的失败方式很隐蔽：图不显示时 Word 只给个红叉、甚至整份文档报"内容有问题"，
 * 而 zip 结构本身是合法的。所以必须逐件锁住 —— 位图、`Content_Types` 声明、
 * rels 关系、`w:document` 的命名空间，缺任何一件都是坏文档。
 */
function fakeImage(over: Partial<AppendixImage> = {}): AppendixImage {
  // 最小 PNG 头（89 50 4E 47 0D 0A 1A 0A）+ 一点载荷
  const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
  return { bytes, ext: 'png', widthPt: 800, heightPt: 500, ...over };
}

describe('docx — 导图附录页（截图嵌图）', () => {
  const withImage = (image?: AppendixImage): LandscapeAppendix => ({
    title: '标题 · 思维导图',
    lines: ['- 根节点', '    - 子节点'],
    image,
  });

  it('位图、Content_Types 声明、rels 关系、命名空间四件齐备', async () => {
    const { files, doc, zip } = await readZip('# t', '标题', withImage(fakeImage()));
    const ct = await zip.file('[Content_Types].xml')!.async('string');
    const rels = await zip.file('word/_rels/document.xml.rels')!.async('string');

    expect(files).toContain('word/media/figure1.png');
    expect(ct).toContain('<Default Extension="png" ContentType="image/png"/>');
    expect(rels).toContain('relationships/image');
    expect(rels).toContain('Target="media/figure1.png"');
    expect(doc).toContain('w:drawing');
    expect(doc).toContain('<wp:inline');
    expect(doc).toContain('r:embed="rId3"');
    // 命名空间必须挂在 w:document 上，否则 wp:/r: 前缀无解、Word 直接拒收
    expect(doc).toContain('xmlns:wp=');
    expect(doc).toContain('xmlns:r=');
  });

  it('位图按二进制原样写入（被当文本编码一遍 = 图片损坏）', async () => {
    const img = fakeImage();
    const { zip } = await readZip('# t', '标题', withImage(img));
    const stored = await zip.file('word/media/figure1.png')!.async('uint8array');

    expect(Array.from(stored)).toEqual(Array.from(img.bytes));
  });

  it('嵌图后不再重复输出缩进文字（否则同一份导图出现两遍）', async () => {
    const { doc } = await readZip('# t', '标题', withImage(fakeImage()));

    expect(doc).toContain('思维导图');
    expect(doc).not.toContain('子节点');
  });

  it('wp:extent / a:ext 等比且不超出横向页可用区（超了就溢出被裁）', async () => {
    const { doc } = await readZip('# t', '标题', withImage(fakeImage()));
    const m = /<wp:extent cx="(\d+)" cy="(\d+)"\/>/.exec(doc)!;

    expect(m).toBeTruthy();
    const [cx, cy] = [Number(m[1]), Number(m[2])];
    const PT = 12700;
    // 横向正文区 (16838-2268)/20 × (11906-2268)/20 pt
    expect(cx).toBeLessThanOrEqual(Math.round((16838 - 2268) / 20 * PT));
    expect(cy).toBeLessThanOrEqual(Math.round((11906 - 2268) / 20 * PT));
    // 长宽比不变（拉伸变形是最容易犯的错）
    expect(Math.abs(cx / cy - 800 / 500)).toBeLessThan(0.01);
  });

  it('没有位图时退回缩进文字（canvas 不可用也不能丢内容）', async () => {
    const { files, doc } = await readZip('# t', '标题', withImage(undefined));

    expect(doc).toContain('子节点');
    expect(doc).toContain('w:ind');
    expect(doc).not.toContain('w:drawing');
    expect(files).not.toContain('word/media/figure1.png');
  });

  it('空字节 = 没截到图：不写 media、也不留悬空的关系声明', async () => {
    const { files, doc, zip } = await readZip('# t', '标题', withImage(fakeImage({ bytes: new Uint8Array(0) })));
    const rels = await zip.file('word/_rels/document.xml.rels')!.async('string');

    expect(files).not.toContain('word/media/figure1.png');
    expect(rels).not.toContain('relationships/image');
    expect(doc).not.toContain('w:drawing');
    expect(doc).toContain('子节点');
  });

  it('JPEG 兜底时扩展名与 ContentType 同步（否则 Word 认不出图）', async () => {
    const { files, zip } = await readZip('# t', '标题', withImage(fakeImage({ ext: 'jpeg' })));
    const ct = await zip.file('[Content_Types].xml')!.async('string');
    const rels = await zip.file('word/_rels/document.xml.rels')!.async('string');

    expect(files).toContain('word/media/figure1.jpeg');
    expect(ct).toContain('<Default Extension="jpeg" ContentType="image/jpeg"/>');
    expect(rels).toContain('Target="media/figure1.jpeg"');
  });

  it('不传附录时文档只有一节（多一个空 sectPr 会多出一整页空白）', async () => {
    const { doc } = await readZip('# t', '标题');

    expect(doc.match(/<w:sectPr>/g)).toHaveLength(1);
    expect(doc).not.toContain('w:drawing');
  });
});

/**
 * 正文里的「思维导图结构」文字大纲 —— 有导图页时必须剥掉。
 *
 * `generateKnowledgeNote` 为了让 txt / md / html 出口也有导图，会把导图序列化成
 * `## 思维导图结构` + `- 节点` 大纲，而 Word 出口**另外**还有一张横向导图页 →
 * 用户看到同一份导图出现两遍，且文字版在 docx 里必然丢失层级（`parseMarkdown`
 * 不解析嵌套缩进），成了一串平铺项。PDF 走结构化数据、本来就没这段，
 * 这正是"Word 和 PDF 内容不一致"的来源之一。
 */
describe('docx — 剥离正文里的导图文字大纲', () => {
  const withImage = (): LandscapeAppendix => ({
    title: '标题 · 思维导图',
    lines: ['- 根节点'],
    image: fakeImage(),
  });

  /** 语言无关：导图区块标题取自 i18n，不写死中/英 */
  const outlineSection = () => {
    const label = getCurrentStrings().exportNote.mindMap;
    return `## ${label}\n\n- 复数\n- 虚数单位\n`;
  };

  it('有导图页时剥掉大纲，但后面的区块一个字都不能少', async () => {
    const md = `# t\n\n## 核心概念\n\n内容\n\n${outlineSection()}\n## 试题\n\n题目正文`;
    const { doc } = await readZip(md, 't', withImage());

    expect(doc).not.toContain('虚数单位');
    expect(doc).toContain('核心概念');
    expect(doc).toContain('题目正文');
  });

  it('大纲落在文末时不会连页脚一起吃掉', async () => {
    const md = `# t\n\n## 核心概念\n\n内容\n\n${outlineSection()}\n---\n导出时间: 2026`;
    const { doc } = await readZip(md, 't', withImage());

    expect(doc).not.toContain('虚数单位');
    expect(doc).toContain('导出时间');
  });

  it('没有导图页时保留大纲（那是唯一的导图载体）', async () => {
    const md = `# t\n\n${outlineSection()}`;
    const { doc } = await readZip(md, 't');

    expect(doc).toContain('虚数单位');
  });
});

/**
 * 正文示意图 —— 用户反馈的"所有文档会丢失示意图内容"。
 *
 * 序列化层只在**图确实拿得到**时才写一行 `![alt](figure:key)` 标记
 * （md 会被"复制"出口复用，塞 base64 会毁掉剪贴板），真位图在这里替换进去。
 */
describe('docx — 正文示意图', () => {
  const figure = (over: Partial<ExportFigure> = {}): ExportFigure => ({
    image: { stub: true },
    bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]),
    dataUrl: 'data:image/png;base64,xx',
    ext: 'png',
    aspect: 2,
    caption: '复平面',
    ...over,
  });

  it('标记换成内嵌位图：media、rels、drawing 三件齐备', async () => {
    const figures: FigureMap = new Map([['concept:0', figure()]]);
    const { files, doc, zip } = await readZip('# t\n\n![复平面](figure:concept:0)', 't', undefined, figures);
    const rels = await zip.file('word/_rels/document.xml.rels')!.async('string');

    expect(files).toContain('word/media/figure1.png');
    expect(rels).toContain('Target="media/figure1.png"');
    expect(rels).toContain('relationships/image');
    expect(doc).toContain('w:drawing');
    expect(doc).toContain('r:embed="rId3"');
    // 标记本身不能被当正文漏出来
    expect(doc).not.toContain('figure:concept:0');
  });

  it('拿不到字节时退成一行图题，不静默消失', async () => {
    const { files, doc } = await readZip('# t\n\n![复平面](figure:concept:0)', 't');
    const media = files.filter((f) => f.startsWith('word/media/') && !f.endsWith('/'));

    expect(media).toHaveLength(0);
    expect(doc).not.toContain('w:drawing');
    expect(doc).toContain('（复平面）');
  });

  it('导图页与正文图共用 rId 空间，两个 embed 绝不撞号', async () => {
    const figures: FigureMap = new Map([['concept:0', figure()]]);
    const appendix: LandscapeAppendix = { title: '导图', lines: [], image: fakeImage() };
    const { doc } = await readZip('# t\n\n![复平面](figure:concept:0)', 't', appendix, figures);

    const ids = [...doc.matchAll(/r:embed="(rId\d+)"/g)].map((m) => m[1]);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
  });

  it('图题的宽高比决定显示尺寸（拉伸变形是最容易犯的错）', async () => {
    const figures: FigureMap = new Map([['concept:0', figure({ aspect: 4 })]]);
    const { doc } = await readZip('# t\n\n![x](figure:concept:0)', 't', undefined, figures);
    const m = /<wp:extent cx="(\d+)" cy="(\d+)"\/>/.exec(doc)!;

    expect(m).toBeTruthy();
    expect(Number(m[1]) / Number(m[2])).toBeCloseTo(4, 1);
  });
});