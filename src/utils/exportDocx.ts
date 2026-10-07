import JSZip from 'jszip';
import { readableLatexInText } from './latexToText';
import { getCurrentStrings } from '../i18n/strings';
import { safeFilename, triggerDownload } from './clipboard';
import { renderMindMapImage } from './canvasRenderer';
import type { ExportFigure } from './canvasRenderer';
import type { FigureMap } from './exportFigures';
import type { MindMapNode } from '../types';

/**
 * Word（.docx）导出 —— 用 JSZip 手写最小 OOXML，不引 `docx` 包。
 *
 * **为什么不直接用现成的 PDF 方案那套**：docx 本质是 zip 包（`[Content_Types].xml`
 * + `word/document.xml` + 关系文件），`docx` 这类库主要价值在自动处理编号、
 * 表格样式、图片嵌入 —— 本项目导出内容是纯文字 + 标题 + 列表，唯一一张图
 * （思维导图截图）的 DrawingML 也就二十来行，自己拼 XML 只有几百行，
 * 却换来「零新增运行时代码体积」的收益。
 * 注意这与项目"单文件 HTML 内联发布"的形式约束直接相关：
 * 打包器会把所有 import 打进同一个 HTML，依赖越少产物越小。
 *
 * **为什么必须有它**：jsPDF 写中文实测是乱码（jsPDF 内置 14 种字体全是
 * latin-1 编码，`text('中文')` 出来是 `N-e mK Õ`）。而 Word 走 OOXML 的
 * UTF-8 XML，中文完全正常。所以 docx 才是"能真正拿到 Word 里用"的格式。
 */

/** OOXML 里 XML 特殊字符必须转义，漏一个整个文档在 Word 里就打不开 */
function esc(text: string): string {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** 段落样式映射：我们的语义标题 → Word 内置 Heading 样式 */
const HEADING_STYLE: Record<number, string> = {
  1: 'Heading1',
  2: 'Heading2',
  3: 'Heading3',
  4: 'Heading4',
  5: 'Heading5',
  6: 'Heading6',
};

/**
 * 从 Markdown 提取行内 `$...$` / `$$...$$` 公式，替换成纯文本占位。
 *
 * docx 里塞不进 KaTeX 渲染结果（那需要图片或 OMML，太重），
 * 所以公式以**可读的纯文本**形式出现 —— 至少可读、可编辑，
 * 总比 `$E=mc^2$` 的美元符号裸露要好。
 *
 * 实现复用 `latexToText.ts`（与 PDF 导出同一份）——
 * 公式降级规则必须只有一处：否则 Word 里显示 `(a)/(b)` 而 PDF 里显示
 * `frac (a)(b)`，同一份内容两种出口又不一样了。
 */

type Block =
  | { kind: 'heading'; level: number; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'bullets'; items: string[] }
  | { kind: 'numbers'; items: string[] }
  | { kind: 'quote'; text: string }
  /**
   * 图片行（`![alt](figure:concept:0)`）。
   *
   * 序列化层（`export.ts`）刻意只写**标记**不写 base64 —— 那份 md 同时是
   * "复制"出口的正文，塞进几百 KB base64 会毁掉剪贴板体验。
   * 真正的位图由这里按 `figures` 里的 key 取出来嵌进 `word/media/*`。
   */
  | { kind: 'figure'; alt: string; src: string }
  | { kind: 'rule' };

/**
 * 极简 Markdown → 结构化块。
 *
 * 只认导出内容里**实际会出现**的语法（标题 / 列表 / 引用 / 分隔线 / 段落）。
 * 刻意不做完整 CommonMark：这里是导出通道不是渲染通道，
 * 覆盖不全的代价是"少个缩进"，而引一个完整解析器会让产物大几十 KB。
 */
function parseMarkdown(md: string): Block[] {
  const blocks: Block[] = [];
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i++;
      continue;
    }

    // 分隔线（排除 `---` 表格分隔符那种三连符号的上下文，交由表格分支处理）
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      blocks.push({ kind: 'rule' });
      i++;
      continue;
    }

    // 图片行：整行就是一个 `![alt](src)`（序列化层只在图存在时才写这一行）
    const figure = /^!\[([^\]]*)\]\(([^)]+)\)$/.exec(trimmed);
    if (figure) {
      blocks.push({ kind: 'figure', alt: figure[1], src: figure[2] });
      i++;
      continue;
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(trimmed);
    if (heading) {
      blocks.push({ kind: 'heading', level: heading[1].length, text: heading[2] });
      i++;
      continue;
    }

    // 引用块：连续 > 开头的内容合并成一段
    if (/^>\s?/.test(trimmed)) {
      const parts: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i].trim())) {
        parts.push(lines[i].trim().replace(/^>\s?/, ''));
        i++;
      }
      blocks.push({ kind: 'quote', text: parts.join(' ') });
      continue;
    }

    // 无序 / 有序列表：连续同类行合并
    const bullet = /^[-*+]\s+(.*)$/.exec(trimmed);
    const numbered = /^(\d+)[.)]\s+(.*)$/.exec(trimmed);
    if (bullet || numbered) {
      const ordered = !!numbered;
      const items: string[] = [];
      while (i < lines.length) {
        const t = lines[i].trim();
        const b = /^[-*+]\s+(.*)$/.exec(t);
        const n = /^(\d+)[.)]\s+(.*)$/.exec(t);
        if (ordered && n) items.push(n[2]);
        else if (!ordered && b) items.push(b[1]);
        else if (!t) break; // 空行终止列表
        else if (/^[-*+]\s+/.test(t) || /^\d+[.)]\s+/.test(t)) {
          // 序列表里混进无序项：换个序号继续，别把两种混成一份
          items.push(t.replace(/^(?:[-*+]|\d+[.)])\s+/, ''));
        } else break;
        i++;
      }
      blocks.push({ kind: ordered ? 'numbers' : 'bullets', items });
      continue;
    }

    /**
     * 表格：Markdown 表格是导出内容里唯一的表格形态（对比表）。
     * docx 里的真表格需要 `w:tbl` + 网格定义，比段落重得多；
     * 这里退化成「用双空格分隔的段落」—— 内容一字不丢，排版差一点，
     * 比为了排版引入半套表格实现划算。
     */
    if (trimmed.includes('|') && i + 1 < lines.length && /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(lines[i + 1])) {
      const rowTexts: string[] = [];
      while (i < lines.length && lines[i].trim().includes('|')) {
        const cells = lines[i].trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
        // 跳过 |---|---| 分隔行
        if (!cells.every((c) => /^:?-{2,}:?$/.test(c) || c === '')) {
          rowTexts.push(cells.join('　|　'));
        }
        i++;
      }
      blocks.push({ kind: 'paragraph', text: rowTexts.join('\n') });
      continue;
    }

    // 普通段落：连续非空行合并（Markdown 软换行 = 同一段）
    const parts: string[] = [];
    while (i < lines.length) {
      const t = lines[i].trim();
      if (
        !t ||
        /^#{1,6}\s/.test(t) ||
        /^!\[/.test(t) ||
        /^[-*+]\s+/.test(t) ||
        /^\d+[.)]\s+/.test(t) ||
        /^>\s?/.test(t) ||
        /^(-{3,}|\*{3,}|_{3,})$/.test(t)
      ) break;
      parts.push(t);
      i++;
    }
    blocks.push({ kind: 'paragraph', text: parts.join(' ') });
  }

  return blocks;
}

/** 单行文本 → OOXML 段落。支持 `**粗体**` 与 `` `等宽` ``（仅这两种，够用） */
function renderRuns(text: string): string {
  const raw = readableLatexInText(text);
  // 先按 ** 和 ` 切段，段内做转义
  const segments = raw.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter((s) => s !== '');
  return segments
    .map((seg) => {
      const bold = /^\*\*[^*]+\*\*$/.test(seg);
      const code = /^`[^`]+`$/.test(seg);
      const body = esc(bold ? seg.slice(2, -2) : code ? seg.slice(1, -1) : seg);
      if (!body) return '';
      const props: string[] = [];
      if (bold) props.push('<w:b/>');
      if (code) props.push('<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/><w:shd w:val="clear" w:fill="F1F5F9"/>');
      const rPr = props.length ? `<w:rPr>${props.join('')}</w:rPr>` : '';
      return `<w:r>${rPr}<w:t xml:space="preserve">${body}</w:t></w:r>`;
    })
    .join('');
}

function paragraphXml(text: string, style?: string): string {
  const pPr = style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : '';
  return `<w:p>${pPr}${renderRuns(text)}</w:p>`;
}

/** 渲染图片块要用的资源：图字典 + 媒体登记器（rId 由登记器统一分配） */
interface FigureRenderCtx {
  figures?: FigureMap;
  /** 登记一张要写进 `word/media/*` 的位图，返回它的关系 id */
  addMedia: (ext: 'png' | 'jpeg', bytes: Uint8Array) => string;
}

/** 从 `figure:concept:0` 形式的 src 里取出真正的图（取不到返回 undefined → 调用方降级） */
function figureFor(src: string, figures?: FigureMap): ExportFigure | undefined {
  const key = /^figure:(.+)$/.exec(src.trim())?.[1];
  if (!key) return undefined;
  const fig = figures?.get(key);
  return fig && fig.bytes.length > 0 ? fig : undefined;
}

function blocksToXml(blocks: Block[], ctx: FigureRenderCtx): string {
  const parts: string[] = [];

  for (const block of blocks) {
    switch (block.kind) {
      case 'heading':
        parts.push(paragraphXml(block.text, HEADING_STYLE[block.level] ?? 'Heading6'));
        break;
      case 'paragraph':
        parts.push(paragraphXml(block.text));
        break;
      case 'bullets':
      case 'numbers': {
        const ordered = block.kind === 'numbers';
        // 有序列表用 Word 内置 ListNumber 样式；它依赖 numbering 定义，
        // 缺 numbering.xml 时 Word 会退回普通段落 —— 所以同时补一份最小的。
        for (const item of block.items) {
          const pPr = ordered
            ? '<w:pPr><w:pStyle w:val="ListNumber"/><w:numPr><w:ilvl w:val="0"/><w:numId w:val="2"/></w:numPr></w:pPr>'
            : '<w:pPr><w:pStyle w:val="ListBullet"/><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr>';
          parts.push(`<w:p>${pPr}${renderRuns(item)}</w:p>`);
        }
        break;
      }
      case 'quote':
        parts.push(
          `<w:p><w:pPr><w:ind w:left="480"/><w:pBdr><w:left w:val="single" w:sz="18" w:space="8" w:color="94A3B8"/></w:pBdr></w:pPr>${renderRuns(block.text)}</w:p>`
        );
        break;
      case 'figure': {
        const fig = figureFor(block.src, ctx.figures);
        if (fig) {
          // 宽度先占满正文可用宽，高度由宽高比推出（再由 imageParagraphXml 的
          // 高度上限兜底，防止一张竖长图吃掉整页）。居中显示。
          const heightPt = PORTRAIT_TEXT_W_PT / Math.max(0.05, fig.aspect);
          const relId = ctx.addMedia(fig.ext, fig.bytes);
          parts.push(
            imageParagraphXml(
              { bytes: fig.bytes, ext: fig.ext, widthPt: PORTRAIT_TEXT_W_PT, heightPt },
              relId,
              PORTRAIT_TEXT_W_PT,
              PORTRAIT_TEXT_H_PT * 0.45
            )
          );
        } else if (block.alt) {
          // 拿不到字节（远程图被跨域挡住等）：留一行图题，别让读者以为这里本来就没图
          parts.push(`<w:p><w:pPr><w:jc w:val="center"/></w:pPr>${renderRuns(`（${block.alt}）`)}</w:p>`);
        }
        break;
      }
      case 'rule':
        parts.push(
          '<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="CBD5E1"/></w:pBdr></w:pPr></w:p>'
        );
        break;
    }
  }

  return parts.join('');
}

/** 最小 numbering.xml：两个 abstractNum（项目符号 / 数字），供列表样式引用 */
function numberingXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:abstractNum w:abstractNumId="0">
    <w:multiLevelType w:val="hybridMultilevel"/>
    <w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:lvlJc w:val="left"/>
      <w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr>
      <w:rPr><w:rFonts w:ascii="Symbol" w:hAnsi="Symbol" w:hint="default"/></w:rPr></w:lvl>
  </w:abstractNum>
  <w:abstractNum w:abstractNumId="1">
    <w:multiLevelType w:val="hybridMultilevel"/>
    <w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/><w:lvlJc w:val="left"/>
      <w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr></w:lvl>
  </w:abstractNum>
  <w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>
  <w:num w:numId="2"><w:abstractNumId w:val="1"/></w:num>
</w:numbering>`;
}

/**
 * styles.xml
 *
 * **`w:eastAsia="Microsoft YaHei"` 是中文能正常显示的关键**：OOXML 里中西文
 * 各走一套字体属性，只设 `w:ascii`（西文）时中文会落到 Word 默认字体，
 * 在部分系统上变成方框。雅黑是 Windows 通用中文字体，缺它时 Word 会自动回退。
 *
 * **`Title` 必须与 PDF 的首标题同格式**（左对齐 / 20pt / `#0F172A` / 下方一条
 * 青色分割线，对应 canvasRenderer 的 `title` 块：`C.title` 文字 + `C.accent` 下划线）。
 * 旧版是居中 + 22pt + 青色，同一份内容两个出口长得不一样，用户直接看出"不一致"。
 */
function stylesXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault><w:rPr>
      <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Microsoft YaHei" w:cs="Calibri"/>
      <w:sz w:val="22"/><w:szCs w:val="22"/>
    </w:rPr></w:rPrDefault>
    <w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="288" w:lineRule="auto"/></w:pPr></w:pPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/><w:qFormat/>
  </w:style>
${[1, 2, 3, 4, 5, 6]
  .map(
    (lv) => `  <w:style w:type="paragraph" w:styleId="Heading${lv}">
    <w:name w:val="heading ${lv}"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>
    <w:pPr><w:keepNext/><w:outlineLvl w:val="${lv - 1}"/><w:spacing w:before="${280 - lv * 30}" w:after="120"/></w:pPr>
    <w:rPr><w:b/><w:color w:val="1E293B"/><w:sz w:val="${36 - lv * 3}"/></w:rPr>
  </w:style>`
  )
  .join('\n')}
  <w:style w:type="paragraph" w:styleId="Title">
    <w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>
    <w:pPr><w:spacing w:before="0" w:after="200"/><w:pBdr><w:bottom w:val="single" w:sz="12" w:space="6" w:color="0D9488"/></w:pBdr></w:pPr>
    <w:rPr><w:b/><w:color w:val="0F172A"/><w:sz w:val="40"/><w:szCs w:val="40"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="ListBullet">
    <w:name w:val="List Bullet"/><w:basedOn w:val="Normal"/><w:qFormat/>
    <w:pPr><w:numPr><w:numId w:val="1"/></w:numPr><w:spacing w:after="60"/></w:pPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="ListNumber">
    <w:name w:val="List Number"/><w:basedOn w:val="Normal"/><w:qFormat/>
    <w:pPr><w:numPr><w:numId w:val="2"/></w:numPr><w:spacing w:after="60"/></w:pPr>
  </w:style>
</w:styles>`;
}

/**
 * 纵向正文页的可用区（pt）= (11906 - 1440×2)/20 × (16838 - 1440×2)/20。
 *
 * 与 `buildDocx` 里 `portraitSect` 的 `w:pgSz` / `w:pgMar` **同源** ——
 * 改了一处不改另一处，示意图就会溢出到页边距外被 Word 裁掉。
 */
const PORTRAIT_TEXT_W_PT = (11906 - 1440 * 2) / 20;
const PORTRAIT_TEXT_H_PT = (16838 - 1440 * 2) / 20;

/**
 * 附录页里要嵌的思维导图位图。
 *
 * 单位是 **pt 的逻辑尺寸**，不是像素 —— 位图的实际像素由 `renderMindMapImage`
 * 内部按 2× 超采样决定，这里的 `widthPt/heightPt` 只用来算 `wp:extent`（显示大小）。
 */
export interface AppendixImage {
  bytes: Uint8Array;
  /** 'png' 文字锐利 / 'jpeg' 体积小（canvas 不支持 toDataURL('image/png') 时的兜底） */
  ext: 'png' | 'jpeg';
  widthPt: number;
  heightPt: number;
}

/** 横向附录页：图优先，文字是**降级**（canvas 不可用时至少不丢内容） */
export interface LandscapeAppendix {
  title: string;
  /** 缩进文字（每层 4 空格）—— 只在没有 image 时用 */
  lines: string[];
  image?: AppendixImage;
}

/**
 * 内嵌图片段落（DrawingML inline）。
 *
 * 导图在这里是**位图截图**，不是重画的形状：Word 里画真形状 + 连线要成套
 * DrawingML，手写成本极高；而位图还有个额外好处 —— KaTeX 公式被一起"拍"进图里，
 * 纯文字版只能把公式降级成 ASCII（`\frac{a}{b}` → `(a)/(b)`）。
 *
 * ⚠️ 下面这些部件缺一个 Word 就报"内容有问题"：
 *   `word/media/*` + `[Content_Types].xml` 的 `Default Extension` +
 *   `word/_rels/document.xml.rels` 的 image 关系 + `w:document` 上的
 *   `xmlns:r` / `xmlns:wp` 声明。
 * `wp:extent` / `a:ext` 是**显示尺寸**（EMU，1pt = 12700 EMU），与位图实际像素无关。
 */
function imageParagraphXml(image: AppendixImage, relId: string, maxWpt: number, maxHpt: number): string {
  // 等比缩放到横向页可用区；上限 1.35 与 PDF 导图页同口径（避免小图被拉糊）
  const fit = Math.min(maxWpt / image.widthPt, maxHpt / image.heightPt, 1.35);
  const cx = Math.round(image.widthPt * fit * 12700);
  const cy = Math.round(image.heightPt * fit * 12700);
  return (
    `<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:drawing>` +
    `<wp:inline distT="0" distB="0" distL="0" distR="0">` +
    `<wp:extent cx="${cx}" cy="${cy}"/>` +
    `<wp:effectExtent l="0" t="0" r="0" b="0"/>` +
    `<wp:docPr id="1" name="MindMap"/>` +
    `<wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr>` +
    `<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">` +
    `<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
    `<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
    `<pic:nvPicPr><pic:cNvPr id="1" name="MindMap"/><pic:cNvPicPr/></pic:nvPicPr>` +
    `<pic:blipFill><a:blip r:embed="${relId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
    `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>` +
    `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>` +
    `</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`
  );
}

/**
 * 生成 docx Blob。
 *
 * `md` 是完整 Markdown（含一级标题作为文档标题）。导出内容里公式以
 * 可读纯文本出现 —— docx 渲染真公式需要 OMML 或图片，成本远大于收益。
 *
 * @param landscapeAppendix 横向附录页（思维导图页）。docx 的横向页靠**分节符**
 *   实现：正文节的 `sectPr` 要放在**正文最后一段的 pPr 里**（它标记"这一节结束"，
 *   写在 body 末尾会让整节方向都错），最后一节的 `sectPr` 放 body 末尾。
 *   不传则不生成，文档只有纵向一页节。
 *   `image` 有值时导图以**内嵌位图**呈现（= 从画布截图），否则退回缩进文字。
 */
export async function buildDocx(
  md: string,
  title: string,
  landscapeAppendix?: LandscapeAppendix,
  /**
   * 已采集的示意图（概念配图 / 试题配图）。正文里的 `![alt](figure:key)` 标记
   * 靠它换成真位图；不传时标记退化成一行图题。
   */
  figures?: FigureMap
): Promise<Blob> {
  const s = getCurrentStrings();

  const zip = new JSZip();

  // ------------------------------------------------------------ 媒体登记
  //
  // 导图位图与正文示意图**共用同一套 rId / media 分配**。旧实现把 `rId3`
  // 硬编码给导图，一旦正文也要插图就会撞号 —— 两个 `r:embed` 指向同一个 id，
  // Word 只会含糊地说"内容有问题"，查起来极其费劲。
  const media: { name: string; bytes: Uint8Array }[] = [];
  const mediaExts = new Set<'png' | 'jpeg'>();
  const mediaRels: string[] = [];
  const addMedia = (ext: 'png' | 'jpeg', bytes: Uint8Array): string => {
    const name = `figure${media.length + 1}.${ext}`;
    media.push({ name, bytes });
    mediaExts.add(ext);
    // rId1 styles / rId2 numbering 已占，媒体从 rId3 起
    const id = `rId${3 + media.length - 1}`;
    mediaRels.push(
      `  <Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${name}"/>`
    );
    return id;
  };

  // 空字节 = 没截到图。这里就地归一化，避免"rels 声明了 image 关系、
  // media 目录里却没有文件"的悬空引用（Word 会报文档损坏）。
  const mindMapImage =
    landscapeAppendix?.image && landscapeAppendix.image.bytes.length > 0
      ? landscapeAppendix.image
      : undefined;

  /**
   * 文档正文。
   *
   * 首行 `# xxx` 与文档标题同文时**整块丢弃** —— 上面 `titleXml` 已经用 `Title`
   * 样式渲染过同一个标题了，再输出一遍就是重复标题。
   *
   * ⚠️ 旧实现是把它**降级成普通段落**（而不是丢弃），于是 Word 里出现了
   * "居中大号标题 + 紧接一行同样文字的小号正文"这种双标题，用户实测反馈
   * "Word 首标题格式和 PDF 不一致"。降级是错的：要么它是标题（用 Title 渲染），
   * 要么它不该出现（丢弃），没有"变成正文"这种第三种身份。
   *
   * 首标题与 `title` **不同文**时保留为 Heading1 —— 说明这份内容有自己的标题，
   * 不是文档标题的重复。
   */
  // 有导图页（附录）时，正文里的导图文字大纲必须剥掉 —— 它是给 txt/md/html
  // 出口准备的载体，而 Word 已经有独立的横向导图页，留着就是同一份导图出现两遍，
  // 且在 docx 里必然失去层级（见 stripMindMapSection 说明）。
  // 剥离放在 buildDocx 内部而不是调用方：这是"有附录页"这条不变式的一部分，
  // 谁调用都绕不过去。
  const bodySource = landscapeAppendix ? stripMindMapSection(md, s.exportNote.mindMap) : md;

  const blocks = parseMarkdown(bodySource);
  const bodyBlocks: Block[] = blocks.filter((b, idx) => {
    if (idx !== 0 || b.kind !== 'heading' || b.level !== 1) return true;
    return b.text.trim() !== title.trim();
  });
  // 渲染正文会**顺带登记**要用到的媒体（示意图），所以必须在写 zip 之前完成
  const bodyXml = blocksToXml(bodyBlocks, { figures, addMedia });

  const timestamp = new Date().toISOString();
  zip.folder('docProps')!
    .file(
      'core.xml',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>${esc(title)}</dc:title>
  <dc:creator>${esc(s.app.brand)}</dc:creator>
  <cp:lastModifiedBy>${esc(s.app.brand)}</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">${timestamp}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${timestamp}</dcterms:modified>
</cp:coreProperties>`
    )
    .file(
      'app.xml',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>${esc(s.app.brand)}</Application>
</Properties>`
    );

  const titleXml = `<w:p><w:pPr><w:pStyle w:val="Title"/></w:pPr>${renderRuns(title)}</w:p>`;

  const portraitSect =
    `<w:sectPr><w:pgSz w:w="11906" w:h="16838"/>` +
    `<w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="851" w:footer="992" w:gutter="0"/>` +
    `</w:sectPr>`;
  const landscapeSect =
    `<w:sectPr><w:pgSz w:w="16838" w:h="11906" w:orient="landscape"/>` +
    `<w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="851" w:footer="992" w:gutter="0"/>` +
    `</w:sectPr>`;

  /**
   * 横向页正文区尺寸（pt）= (16838 - 1134×2)/20 × (11906 - 1134×2)/20。
   * 位图按这个可用区等比缩放，超过就会溢出到页边距外被裁掉。
   */
  const LANDSCAPE_TEXT_W_PT = (16838 - 1134 * 2) / 20;
  const LANDSCAPE_TEXT_H_PT = (11906 - 1134 * 2) / 20;

  /**
   * 附录（思维导图横向页）。
   *
   * 有 `image` 就嵌图（= 从画布截图，公式一起进图），没有才退回**缩进层级 +
   * 项目符号**的文字版 —— canvas 不可用（如单测环境）时至少内容不丢。
   */
  const appendixXml = landscapeAppendix
    ? `<w:p><w:pPr>${portraitSect}</w:pPr></w:p>` +
      `<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr>${renderRuns(landscapeAppendix.title)}</w:p>` +
      (mindMapImage
        ? imageParagraphXml(
            mindMapImage,
            addMedia(mindMapImage.ext, mindMapImage.bytes),
            LANDSCAPE_TEXT_W_PT,
            LANDSCAPE_TEXT_H_PT - 52
          )
        : landscapeAppendix.lines
            .map((line) => {
              const indent = line.match(/^\s*/)?.[0].length ?? 0;
              const text = line.trim();
              if (!text) return '';
              const indentTwips = Math.min(6, Math.floor(indent / 2)) * 240;
              const pPr = indentTwips > 0 ? `<w:pPr><w:ind w:left="${indentTwips}"/></w:pPr>` : '';
              return `<w:p>${pPr}${renderRuns(text)}</w:p>`;
            })
            .join(''))
    : '';

  // ------------------------------------------------------------ 写包
  //
  // **顺序要求**：正文与附录都要先渲染完（它们会登记媒体），才能定下
  // `[Content_Types].xml` 里的图片扩展名声明和 rels 里的 image 关系 ——
  // 提前写就会出现"声明了 png、包里却没有 png"这种悬空引用，Word 直接报损坏。
  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>${[...mediaExts]
    .map((ext) => `\n  <Default Extension="${ext}" ContentType="image/${ext}"/>`)
    .join('')}
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`
  );

  zip.folder('_rels')!.file(
    '.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`
  );

  zip.folder('word')!
    .file(
      '_rels/document.xml.rels',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>${
    mediaRels.length ? `\n${mediaRels.join('\n')}` : ''
  }
</Relationships>`
    )
    .file('styles.xml', stylesXml())
    .file('numbering.xml', numberingXml());

  // 位图字节：JSZip 收到 Uint8Array 会按二进制原样写入（不要转成 string，
  // 否则二进制被当文本编码一遍，Word 打开就是"图片损坏"）。
  for (const m of media) zip.file(`word/media/${m.name}`, m.bytes);

  zip.file(
    'word/document.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing">
  <w:body>
    ${titleXml}
    ${bodyXml}
    ${appendixXml}
    ${landscapeAppendix ? landscapeSect : portraitSect}
  </w:body>
</w:document>`
  );

  return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}

/**
 * 导出为 Word 文件。
 *
 * 单独 `async`：JSZip 是异步的，调用方必须 await —— 之前所有导出都是同步的，
 * 接进来的组件要按异步处理（`exporting` 状态正好覆盖这个窗口）。
 */
export async function exportDocx(md: string, title: string, fallbackName?: string): Promise<void> {
  const blob = await buildDocx(md, title);
  triggerDownload(blob, `${safeFilename(title, fallbackName ?? 'document')}.docx`);
}

/**
 * 从正文 Markdown 里剥掉「思维导图」文字大纲区块。
 *
 * **为什么必须剥**：`generateKnowledgeNote` 为了让 txt / md / html 出口也有导图
 * 内容，会把导图序列化成 `## 思维导图结构` + `- 节点` 大纲；而 Word 出口**另外**
 * 有一张横向导图页。两者并存 = 同一份导图在 Word 里出现两遍。
 *
 * 更糟的是这段大纲在 docx 里必然**失去层级**：`parseMarkdown` 的列表分支不解析
 * 嵌套缩进（`- ` 前的空格被 trim 掉），父节点和子节点会渲染成同一层 ——
 * 用户看到的就是一串平铺项。相比之下 PDF 出口走结构化数据、本来就没有这段，
 * 这正是"Word 和 PDF 内容不一致"的来源之一。
 *
 * 精确匹配 `## {label}` 整行，不碰同名的三级标题或正文里出现的同名短语。
 */
function stripMindMapSection(md: string, label: string): string {
  const target = `## ${label}`.trim();
  const lines = md.split('\n');
  const out: string[] = [];
  let skipping = false;

  for (const line of lines) {
    const t = line.trim();
    if (!skipping) {
      if (t === target) {
        skipping = true;
        continue;
      }
      out.push(line);
      continue;
    }
    // 跳过中：遇到下一个二级标题、或页脚分隔线 → 结束跳过，且当前行保留
    if (/^##\s/.test(t) || /^-{3,}$/.test(t)) {
      skipping = false;
      out.push(line);
    }
  }

  return out.join('\n');
}

/** 缩进文字版导图 —— 只在截不出图时用（降级路径） */
function mindMapTextLines(nodes: MindMapNode[], depth = 0): string[] {
  const out: string[] = [];
  nodes.forEach((n) => {
    out.push(`${'    '.repeat(depth)}- ${n.title}`);
    if (n.children?.length) out.push(...mindMapTextLines(n.children, depth + 1));
  });
  return out;
}

/**
 * 知识笔记 → Word，**思维导图单独一张横向页**。
 *
 * 用户要求"思维导图单独给一页（横向）"。正文复用 `generateKnowledgeNote().md`
 * —— 与 txt / md / html / pdf 出口**同一份序列化**，避免两处内容漂移。
 *
 * 导图页是**从画布截图**（`renderMindMapImage`）：跟手写 DrawingML 形状相比，
 * 截图不改绘制代码、还能把 KaTeX 公式一起拍进去。截图失败则退回缩进文字。
 */
export async function exportKnowledgeDocx(
  md: string,
  title: string,
  mindMap: MindMapNode[] | undefined,
  fallbackTitle: string,
  /** 已采集的示意图，与 PDF / HTML 出口共用同一份（见 export.ts 的采集说明） */
  figures?: FigureMap
): Promise<void> {
  const s = getCurrentStrings();

  let appendix: LandscapeAppendix | undefined;
  if (mindMap && mindMap.length > 0) {
    const lines = mindMapTextLines(mindMap);

    // 布局 + 绘制 + 导出 PNG 全在 renderMindMapImage 里，与 PDF 横向导图页
    // 共用同一份绘制源（paintMindMap）—— 两个出口的导图必须长得一样。
    let image: AppendixImage | undefined;
    try {
      const shot = renderMindMapImage(mindMap);
      if (shot.bytes.length > 0) {
        image = {
          bytes: shot.bytes,
          ext: shot.mime === 'image/png' ? 'png' : 'jpeg',
          widthPt: shot.widthPt,
          heightPt: shot.heightPt,
        };
      }
    } catch {
      // canvas 不可用（无 document 等）→ 静默退回缩进文字。
      // **导出不能因为"配图失败"而整份失败**，正文比附录图重要得多。
      image = undefined;
    }

    appendix = { title: `${title} · ${s.search.sections.mindMap}`, lines, image };
  }

  const blob = await buildDocx(md, title, appendix, figures);
  triggerDownload(blob, `${safeFilename(title, fallbackTitle)}.docx`);
}