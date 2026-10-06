
/**
 * 零嵌入 CJK PDF 生成器 —— 中文字体来自 **PDF 阅读器自带的标准 CJK 字体**。
 *
 * ## 为什么不用 jsPDF 写中文（这是本文件存在的全部理由）
 *
 * jsPDF 内置的 14 种标准字体全是 latin-1 编码，`doc.text('中文')` 写进 PDF 后
 * 内容流里是 `N-e mK Õ` —— 每个汉字被打成两个乱码字节，**屏幕上还是"方块字"**。
 * 要修就得嵌入 CJK 字体，而一份可用的中文字体子集也有数百 KB 到数 MB，
 * 与"单文件 HTML 内联发布"的产物体积约束（当前 2.5 MB）直接冲突。
 * 实测：SimHei 子集 308 字 = 81 KB 可行；但要覆盖 3500 常用字就是 1.5–2 MB，
 * 而 subset-font 在大字符集上根本没有真正子集化（21557 字仍输出 7 MB）。
 *
 * ## 本方案怎么解决
 *
 * PDF 规范（ISO 32000）**预定义了大量 CJK 字体族**（STSong-Light、HeiseiMin-W3、
 * MSung-Light…）。声明这种字体时用 `/Encoding /UniGB-UCS2-H` 指向一个标准 CMap，
 * **不嵌 FontFile** —— 字形由阅读器自带的 CJK 字体提供。
 * 于是：**0 字节字体嵌入，中文正常显示，体积完全不变**。
 *
 * ## 为什么必须自带 ToUnicode
 *
 * CMap（编码 → CID）与 ToUnicode（CID → Unicode）是**两回事**。
 * 只有前者时阅读器能画字，但选中/复制/检索拿到的是错的或空的 Unicode。
 * 所以每个文件都自带一份 ToUnicode CMap，把 CID 映射回原始码位。
 * 这也是"PDF 文字可复制"的技术判据。
 *
 * ## 适用范围与限制（必须诚实告知用户）
 *
 * - 依赖阅读器**自带 CJK 字体**。Edge / Chrome / Acrobat / WPS / macOS 预览 都有；
 *   极少数精简阅读器可能缺。这是本方案唯一的外部依赖。
 * - `UniGB-UCS2-H` 面向**简体中文**；繁体需换`ETen-B5-H`，日文 `UniJIS-UCS2-H`。
 * - 本项目 UI 支持中英双语，故按语言选择编码（CMap 与 ToUnicode 都随之切换）。
 */

/** 页面尺寸（pt，1pt = 1/72 inch） */
const A4 = { w: 595.28, h: 841.89 } as const;
const A4_LANDSCAPE = { w: A4.h, h: A4.w } as const;

// ---------------------------------------------------------------- 内容流构造

/** 文本转 UTF-16BE hex 串。UniGB-UCS2-H 下 CID 即 UCS-2 码值，故可直接用码位当 CID。 */
function textToHex(text: string): string {
  let out = '';
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    // 用代理对表达 BMP 之外的字符（罕见，但导出内容理论上可能出现 emoji）
    if (cp > 0xffff) {
      const v = cp - 0x10000;
      const hi = 0xd800 + (v >> 10);
      const lo = 0xdc00 + (v & 0x3ff);
      out += hi.toString(16).padStart(4, '0').toUpperCase();
      out += lo.toString(16).padStart(4, '0').toUpperCase();
    } else {
      out += cp.toString(16).padStart(4, '0').toUpperCase();
    }
  }
  return out;
}

/** PDF 字符串转义（画括号/反斜杠等特殊字符时用） */
function pdfString(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

/** FNV-1a 32 位内容哈希：给图片去重当 key 用（必须覆盖全部字节，见 imageByKey）。 */
function hashBytes(bytes: Uint8Array): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i++) {
    h ^= bytes[i];
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}

export type Color = [number, number, number];

export interface TextRun {
  kind: 'text';
  x: number;
  y: number;
  size: number;
  color: Color;
  bold: boolean;
  /** 直接给出 CJK 文本（走 UniGB-UCS2-H 编码） */
  text?: string;
  /** 拉丁文本（走内置 Helvetica，宽度更好且无需 CJK 编码） */
  latin?: string;
  maxWidth?: number;
  /**
   * 隐形文字层：用 `3 Tr`（不显形渲染模式）把文字写进内容流。
   *
   * **为什么需要**：位图页里的字没有任何文字信息，用户复制 / Ctrl+F 全是空的。
   * 扫描件 PDF 的标准做法就是"图 + 隐形文字层"，这里同理 ——
   * 画面上仍是位图，文字层只服务于复制与检索。
   * 因为不显形，所以**不受"阅读器缺 CJK 字形"影响**，STSong 画不出来也无所谓；
   * 但反过来说 ToUnicode 必须齐，否则复制出来是乱码。
   */
  invisible?: boolean;
}

export interface RectRun {
  kind: 'rect';
  x: number;
  y: number;
  w: number;
  h: number;
  fill?: Color;
  stroke?: Color;
  lineWidth?: number;
  radius?: number;
}

export interface LineRun {
  kind: 'bezier';
  x1: number;
  y1: number;
  cx1: number;
  cy1: number;
  cx2: number;
  cy2: number;
  x2: number;
  y2: number;
  color: Color;
  lineWidth: number;
}

export interface PageRun {
  kind: 'line';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: Color;
  lineWidth: number;
  dash?: number[];
}

export interface ImageRun {
  kind: 'image';
  x: number;
  y: number;
  w: number;
  h: number;
  /** 已编码的 JPEG bytes（DCTDecode）。 */
  jpeg: Uint8Array;
  /** JPEG 原始像素尺寸（用于 PDF /Width /Height 元数据）。 */
  imgW: number;
  imgH: number;
}

export type Run = TextRun | RectRun | LineRun | PageRun | ImageRun;

export interface PdfPage {
  /** 横向页用于思维导图 */
  landscape?: boolean;
  runs: Run[];
}

// ---------------------------------------------------------------- PDF 组装

export class PdfBuilder {
  private pages: PdfPage[] = [];
  /** 所有页面用到的字符（决定 ToUnicode CMap 的内容） */
  private chars = new Set<string>();
  private encoding = 'UniGB-UCS2-H';
  private baseFont = 'STSong-Light';

  setCjkFont(encoding: string, baseFont: string) {
    this.encoding = encoding;
    this.baseFont = baseFont;
  }

  /**
   * 由外部交来完整页面列表（顺序即页序）。
   *
   * **必须外部驱动页面顺序**：本项目的 PDF 要混排纵向正文页与横向导图页，
   * 而方向是**内容决定**的（导图天生横向），构建器在生成过程中无法预知。
   * 页面若由构建器内部按需 push，就没法在正文中间插一张横向页。
   */
  setPages(pages: { landscape: boolean; runs: Run[] }[]) {
    this.pages = pages.map((p) => ({ landscape: p.landscape, runs: p.runs }));
  }

  /** 登记一条页面上的所有字符（决定 ToUnicode CMap 内容） */
  registerChars(text: string) {
    for (const ch of text) this.chars.add(ch);
  }

  addPage(landscape = false): Run[] {
    const page: PdfPage = { landscape, runs: [] };
    this.pages.push(page);
    return page.runs;
  }

  get pageCount() {
    return this.pages.length;
  }

  /** 把一页的 runs 编译成内容流 */
  private buildContent(page: PdfPage): string {
    const out: string[] = [];
    const h = page.landscape ? A4_LANDSCAPE.h : A4.h;

    // 默认字体（CJK）
    out.push('BT');
    out.push(`/F_CJK 10 Tf`);
    out.push('1 0 0 1 0 0 Tm');
    out.push('14 TL');
    out.push('ET');



    for (const run of page.runs) {
      switch (run.kind) {
        case 'text': {
          const [r, g, b] = run.color;
          out.push('BT');
          // y 轴翻转：PDF 原点在左下，我们的坐标在左上
          out.push(`${r} ${g} ${b} rg`);
          const fontSize = run.size;
          out.push(`/${run.latin ? 'F_LAT' : 'F_CJK'} ${fontSize} Tf`);
          // 渲染模式：3 = 不显形（隐形文字层），2 = 填充+描边（伪粗体），0 = 正常
          const mode = run.invisible ? '3 Tr' : run.bold ? '2 Tr 0.06 w' : '0 Tr';
          out.push(mode);
          out.push('1 0 0 1 ' + run.x.toFixed(2) + ' ' + (h - run.y).toFixed(2) + ' Tm');
          const content = run.text ?? run.latin ?? '';
          if (run.text) {
            [...content].forEach((ch) => this.chars.add(ch));
            out.push(`<${textToHex(content)}> Tj`);
          } else {
            out.push(`(${pdfString(content)}) Tj`);
          }
          out.push('0 Tr');
          out.push('ET');

          break;
        }
        case 'rect': {
          const ops: string[] = ['q'];
          if (run.fill) ops.push(`${run.fill[0] / 255} ${run.fill[1] / 255} ${run.fill[2] / 255} rg`);
          if (run.stroke) {
            ops.push(`${run.stroke[0] / 255} ${run.stroke[1] / 255} ${run.stroke[2] / 255} RG`);
            ops.push(`${(run.lineWidth ?? 0.6).toFixed(2)} w`);
          }
          const y = h - run.y - run.h;
          if (run.radius && run.radius > 0) {
            // 圆角矩形：4 段贝塞尔近似（k = 0.5523 是圆弧的经典常数）
            const r = Math.min(run.radius, run.w / 2, run.h / 2);
            const k = r * 0.5523;
            const x = run.x;
            const ry = y + run.h;
            ops.push(`${x + r} ${ry} m`);
            ops.push(`${x + run.w - r} ${ry} l`);
            ops.push(`${x + run.w - r + k} ${ry} ${x + run.w} ${ry - r + k} ${x + run.w} ${ry - r} c`);
            ops.push(`${x + run.w} ${y + r} l`);
            ops.push(`${x + run.w} ${y + r - k} ${x + run.w - r + k} ${y} ${x + run.w - r} ${y} c`);
            ops.push(`${x + r} ${y} l`);
            ops.push(`${x + r - k} ${y} ${x} ${y + r - k} ${x} ${y + r} c`);
            ops.push(`${x} ${ry - r} l`);
            ops.push(`${x} ${y + r - k + 0} ${x + r - k} ${ry} ${x + r} ${ry} c`);
            ops.push('h');
          } else {
            ops.push(`${run.x} ${y} ${run.w} ${run.h} re`);
          }
          ops.push(run.fill && run.stroke ? 'B' : run.fill ? 'f' : 'S');
          ops.push('Q');
          out.push(ops.join('\n'));
          break;
        }
        case 'bezier': {
          const y1 = h - run.y1, cy1 = h - run.cy1, cy2 = h - run.cy2, y2 = h - run.y2;
          out.push('q');
          out.push(`${run.color[0] / 255} ${run.color[1] / 255} ${run.color[2] / 255} RG`);
          out.push(`${run.lineWidth.toFixed(2)} w`);
          out.push('1 J 1 j');
          out.push(`${run.x1.toFixed(2)} ${y1.toFixed(2)} m`);
          out.push(`${run.cx1.toFixed(2)} ${cy1.toFixed(2)} ${run.cx2.toFixed(2)} ${cy2.toFixed(2)} ${run.x2.toFixed(2)} ${y2.toFixed(2)} c`);
          out.push('S');
          out.push('Q');
          break;
        }
        case 'line': {
          const dash = run.dash?.length ? `[${run.dash.join(' ')}] 0 d ` : '[] 0 d ';
          out.push('q');
          out.push(`${run.color[0] / 255} ${run.color[1] / 255} ${run.color[2] / 255} RG`);
          out.push(`${run.lineWidth.toFixed(2)} w`);
          out.push(dash);
          out.push(`${run.x1.toFixed(2)} ${(h - run.y1).toFixed(2)} m`);
          out.push(`${run.x2.toFixed(2)} ${(h - run.y2).toFixed(2)} l`);
          out.push('S');
          out.push('Q');
          break;
        }
        case 'image': {
          // 内容流里只发"画图"指令，XObject 字节流在 build() 时单独生成。
          // 由调用方在 xObjects 数组里登记 run 对应的 xObject 名，buildContent
          // 通过 /${xName} Do 引用。xName 与 entryName 由调用方约定（"X{数字}"）。
          out.push('q');
          const sx = run.w;
          const sy = run.h;
          // PDF 坐标系 y 翻转：图片左上角在 (run.x, h - run.y - run.h)
          out.push(`${sx.toFixed(2)} 0 0 ${sy.toFixed(2)} ${run.x.toFixed(2)} ${(h - run.y - run.h).toFixed(2)} cm`);
          out.push(`/X${(run as ImageRun & { xName?: number }).xName ?? 0} Do`);
          out.push('Q');
          break;
        }
      }
      // 移除空操作行
    }

    return out.filter(Boolean).join('\n');
  }

  private buildToUnicodeCMap(): string {
    const list = [...this.chars]
      // 剔除代理区与不可见字符，避免生成非法的 bfchar
      .filter((ch) => {
        const cp = ch.codePointAt(0)!;
        if (cp >= 0xd800 && cp <= 0xdfff) return false;
        if (cp < 0x20) return false;
        return true;
      })
      .map((ch) => {
        const cp = ch.codePointAt(0)!;
        const u = cp.toString(16).padStart(4, '0').toUpperCase();
        return `<${u}> <${u}>`;
      });

    return (
      `/CIDInit /ProcSet findresource begin\n` +
      `12 dict begin\nbegincmap\n` +
      `/CIDMapName /Adobe-Identity-UCS def\n/CMapType 2 def\n` +
      `/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def\n` +
      `1 begincodespacerange\n<0000> <FFFF>\nendcodespacerange\n` +
      `${list.length} beginbfchar\n${list.join('\n')}\nendbfchar\n` +
      `endcmap\nCMapName currentdict /CMap defineresource pop\nend\nend`
    );
  }

  /** 输出完整 PDF（Uint8Array） */
  build(): Uint8Array {
    if (this.pages.length === 0) this.addPage();

    // 扫一遍所有页面收集字符 —— ToUnicode CMap 必须覆盖每一个出现过的字，
    // 漏一个就意味着那个字复制出来是错的或空的
    this.chars.clear();
    for (const p of this.pages) {
      for (const r of p.runs) {
        if (r.kind === 'text' && r.text) this.registerChars(r.text);
      }
    }

    // 收集所有 image run 的字节 + 像素尺寸 + 分配 xObject id。
    // **按内容去重** —— 同一张图片多次出现只写一次。
    //
    // ⚠️ key 必须覆盖**全部字节**：早先用"尺寸 + 头 8 字节"，而同尺寸的 JPEG
    // 头 8 字节是同一段 JFIF 标记 —— 于是每页的图都算出同一个 key，
    // 整份 PDF 只留一张图，第 2 页起全部复用第 1 页的位图（实测三页只有 1 个 /XObject）。
    const imageMap = new Map<string, { id: number; jpeg: Uint8Array; imgW: number; imgH: number }>();
    const imageByKey = (j: Uint8Array, w: number, h: number) => `${w}x${h}-${hashBytes(j)}`;
    for (const p of this.pages) {
      for (const r of p.runs) {
        if (r.kind === 'image') {
          const key = imageByKey(r.jpeg, r.imgW, r.imgH);
          if (!imageMap.has(key)) {
            // 临时占位 id，alloc 阶段重写
            imageMap.set(key, { id: -1, jpeg: r.jpeg, imgW: r.imgW, imgH: r.imgH });
          }
          (r as ImageRun & { xName: number }).xName = imageMap.size; // 临时，仅用于 buildContent
        }
      }
    }

    // 对象编号规划：
    // 1 Catalog / 2 Pages / 3 Font-CJK / 4 Descendant / 5 FontDescriptor
    // 6 ToUnicode / 7 Font-Latin(Helvetica)
    // 8 FontDescriptor-Latin / 9.. 每页 Page 与 Contents 各两个
    // 然后是 image xObject（每张图一个）
    const objNo: Record<string, number> = {};
    let next = 1;
    const alloc = (k: string) => (objNo[k] = next++);

    alloc('catalog');
    alloc('pages');
    alloc('fontCjk');
    alloc('descendant');
    alloc('fdCjk');
    alloc('toUnicode');
    alloc('fontLatin');
    alloc('fdLatin');

    const pageIds: number[] = [];
    for (let i = 0; i < this.pages.length; i++) {
      pageIds.push(next);
      alloc('page' + (i + 1));
      alloc('content' + (i + 1));
    }

    // 给 image xObject 分配 id（写进 map.value.id，并记下"page X 的 image run 实际引用哪个"）
    const imageIdByKey = new Map<string, number>();
    const imagesById = new Map<number, { jpeg: Uint8Array; imgW: number; imgH: number }>();
    let imageCounter = 0;
    for (const [key, info] of imageMap.entries()) {
      imageCounter++;
      const id = next++;
      imageIdByKey.set(key, id);
      info.id = id;
      imagesById.set(id, info);
    }
    // 同步更新 image run 上的 xName（之前是 imageMap.size 临时值）
    let imgIdx = 0;
    for (const p of this.pages) {
      for (const r of p.runs) {
        if (r.kind === 'image') {
          const key = imageByKey(r.jpeg, r.imgW, r.imgH);
          (r as ImageRun & { xName: number }).xName = imageIdByKey.get(key)!;
          imgIdx++;
        }
      }
    }

    const objects = new Map<number, string>();
    objects.set(objNo.catalog, `<< /Type /Catalog /Pages ${objNo.pages} 0 R >>`);
    objects.set(
      objNo.pages,
      `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`
    );

    // CJK 字体：不嵌 FontFile，靠阅读器自带
    objects.set(
      objNo.fontCjk,
      `<< /Type /Font /Subtype /Type0 /BaseFont /${this.baseFont} /Encoding /${this.encoding} ` +
        `/DescendantFonts [${objNo.descendant} 0 R] /ToUnicode ${objNo.toUnicode} 0 R >>`
    );
    objects.set(
      objNo.descendant,
      `<< /Type /Font /Subtype /CIDFontType0 /BaseFont /${this.baseFont} ` +
        `/CIDSystemInfo << /Registry (Adobe) /Ordering (GB1) /Supplement 2 >> ` +
        `/FontDescriptor ${objNo.fdCjk} 0 R /DW 1000 >>`
    );
    objects.set(
      objNo.fdCjk,
      `<< /Type /FontDescriptor /FontName /${this.baseFont} /Flags 4 ` +
        `/FontBBox [-25 -254 1000 880] /ItalicAngle 0 /Ascent 880 /Descent -254 ` +
        `/CapHeight 880 /StemV 58 >>`
    );

    const cmap = this.buildToUnicodeCMap();
    objects.set(
      objNo.toUnicode,
      `<< /Length ${cmap.length} >>\nstream\n${cmap}\nendstream`
    );

    // 拉丁字体：Helvetica 是 PDF 内置标准字体，无需嵌入
    objects.set(
      objNo.fontLatin,
      `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>`
    );
    objects.set(objNo.fdLatin, `<< /Type /FontDescriptor /FontName /Helvetica /Flags 32 >>`);

    // 页面与内容流
    this.pages.forEach((p, i) => {
      const pid = pageIds[i];
      const cid = objNo['content' + (i + 1)];
      const size = p.landscape ? A4_LANDSCAPE : A4;
      // 收集本页实际引用的 image xObject id
      const xRefEntries: string[] = [];
      const seenXNames = new Set<number>();
      for (const r of p.runs) {
        if (r.kind === 'image') {
          const xid = (r as ImageRun & { xName: number }).xName;
          if (xid !== undefined && !seenXNames.has(xid)) {
            seenXNames.add(xid);
            xRefEntries.push(`/X${xid} ${xid} 0 R`);
          }
        }
      }
      const xObjectDict = xRefEntries.length
        ? ` /XObject << ${xRefEntries.join(' ')} >>`
        : '';

      objects.set(
        pid,
        `<< /Type /Page /Parent ${objNo.pages} 0 R /MediaBox [0 0 ${size.w} ${size.h}] ` +
          `/Resources << /Font << /F_CJK ${objNo.fontCjk} 0 R /F_LAT ${objNo.fontLatin} 0 R >>${xObjectDict} ` +
          `/ProcSet [/PDF /Text /ImageC] >> /Contents ${cid} 0 R >>`
      );
      const content = this.buildContent(p);
      objects.set(cid, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
    });

    // image xObject：DCTDecode（JPEG 自带色彩转换，PDF 端不再做颜色管理）
    for (const [id, info] of imagesById.entries()) {
      objects.set(
        id,
        `<< /Type /XObject /Subtype /Image /Width ${info.imgW} /Height ${info.imgH} ` +
          `/BitsPerComponent 8 /ColorSpace /DeviceRGB /Filter /DCTDecode ` +
          `/Length ${info.jpeg.length} >>\nstream\n`
      );
    }

    // 组装文件
    const encoder = new TextEncoder();
    const chunks: Uint8Array[] = [];
    let pos = 0;
    const push = (s: string) => {
      const bytes = encoder.encode(s);
      chunks.push(bytes);
      pos += bytes.length;
    };

    // 第二行是 PDF 规范建议的二进制标记（4 字节 > 0x7F），提示传输层这是二进制文件。
    // 用 TextEncoder 写不出这些字节，直接用 charCode 拼进 latin1 数组。
    push('%PDF-1.7\n');
    chunks.push(new Uint8Array([0x25, 0xE2, 0xE3, 0xCF, 0xD3, 0x0A]));
    pos += 6;

    const offsets = new Map<number, number>();
    // 对象按编号顺序写入
    for (const id of [...objects.keys()].sort((a, b) => a - b)) {
      const isImage = imagesById.has(id);
      offsets.set(id, pos);
      // ⚠️ image 对象的字典字符串已经以 `stream\n` 结尾，**后面不能再补换行**。
      // 多出的那个 0x0A 会成为流数据的第一个字节，而 /Length 仍按 JPEG 原长声明
      // → 解码器读到的是"前导换行 + JPEG 少了最后一个字节"（实测尾部 EOI 的 D9 被吃掉）。
      // 文本流是整串一次性 push 的（`stream\n${content}`），没有这个问题。
      push(`${id} 0 obj\n${objects.get(id)!}${isImage ? '' : '\n'}`);
      if (isImage) {
        const info = imagesById.get(id)!;
        chunks.push(info.jpeg);
        pos += info.jpeg.length;
        push('\nendstream\nendobj\n');
      } else {
        push('endobj\n');
      }
    }

    const xrefPos = pos;
    const maxId = Math.max(...objects.keys());
    let xref = `xref\n0 ${maxId + 1}\n0000000000 65535 f \n`;
    for (let i = 1; i <= maxId; i++) {
      const off = offsets.get(i);
      xref += off === undefined
        ? '0000000000 65535 f \n'
        : String(off).padStart(10, '0') + ' 00000 n \n';
    }
    push(xref);
    push(`trailer\n<< /Size ${maxId + 1} /Root ${objNo.catalog} 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`);

    const total = chunks.reduce((s, c) => s + c.length, 0);
    const out = new Uint8Array(total);
    let off = 0;
    for (const c of chunks) {
      out.set(c, off);
      off += c.length;
    }
    return out;
  }
}

// 说明：早先这里还有一套"按 em 估算宽度 + 折行"的排版工具（measureTextPt /
// wrapText），是上一版**矢量文字 PDF** 用的。现在页面由 canvasRenderer 画成位图，
// 折行与度量都在那边用真 canvas `measureText` 做，这两个函数已无调用方，删掉。
