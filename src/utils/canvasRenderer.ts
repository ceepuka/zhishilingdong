/**
 * 知识笔记 / Markdown → 多张 JPEG（每张一页），由 PDF 模块嵌入。
 *
 * ## 为什么 Canvas + 系统字体，不再嵌字体
 *
 * 上一版路线是"PDF 内置 CJK 字体（STSong-Light + UniGB-UCS2-H）+ 自带 ToUnicode CMap，
 * 不嵌 FontFile"。理论上零字节字体嵌入、阅读器自带字形即可显示中文。
 *
 * **实测这条路径在浏览器端 PDF Viewer 里行不通** —— Chrome / Edge 内置的
 * Chromium PDF Viewer（PDFium）和 Mozilla pdf.js 都**不会自动提供 `STSong-Light`
 * 字形**，变现路径有字节，屏幕上没字。`111.pdf` 类型件被 pdfjs 解析 4 页
 * text items 全是 0，渲染出来纯空白。Acrobat / WPS / macOS Preview 通常能渲，
 * 但**用户用的是 Chrome / Edge，看到的就是白屏**。
 *
 * 修复只能走"真把字形塞进 PDF"——而真塞字形要么 vendor 一份 5MB 字体进单文件 HTML
 * （体积爆炸），要么运行时下载字体（首次卡、离线废），要么把 glyph 抽出为 PDF
 * path（opentype.js 不直接给原 glyf 字节、子集器与 cff 转换链路反复踩坑）。
 *
 * 用户明确方向："操作系统有一整套字库，动态库链接标准，运行时动态链接。"
 * 浏览器不能直接 link Windows DLL，**但浏览器渲染层已经做了同样的事**：CSS
 * `font-family: 'Microsoft YaHei'` 自动用系统字库、Canvas 用同一套字体栈画文字。
 *
 * **本模块做的事**：在浏览器里用 Canvas 2D + 系统字体栈把每页画成 JPEG，
 * 再交给 PDF 模块嵌为 XObject（DCTDecode）。结果是**每个 PDF 都是位图页**——
 * 文字、思维导图、配色一致，体积可控（单页 ~50-150 KB JPEG），跨阅读器零差异。
 * 文字复制特性失去，但视觉清晰无解。
 */

import type { GeneratedKnowledge, KnowledgeCardData, MindMapNode } from '../types';
import { getCurrentStrings } from '../i18n/strings';
import { getStoredLanguage } from '../hooks/useLanguageStore';
import { examTypeLabel, difficultyLabel, conceptTypeLabel } from './knowledgeLabels';
import { layoutMindMap, mindMapBounds, parseConnectionPath } from './mindMapLayout';
import type { Line as MindMapLine, PositionedNode } from './mindMapLayout';
import { readableLatexInText, readableLatexExpression } from './latexToText';

// ---------------------------------------------------------------- 字体与几何

/** 系统字体栈 —— 浏览器自动挑用户 OS 里实际存在的那一个。 */
const FONT_STACK = [
  '-apple-system',
  'BlinkMacSystemFont',
  '"Segoe UI"',
  '"Microsoft YaHei"',
  '"PingFang SC"',
  '"Hiragino Sans GB"',
  '"Source Han Sans SC"',
  '"Noto Sans CJK SC"',
  'sans-serif',
].join(', ');

/** 页面尺寸（pt，与 PDF 一致）。 */
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 56;

/** Canvas 渲染倍率。2 = 2x DPR，输出相当于 144 DPI 印刷质量。 */
const SCALE = 2;

/** 单位换算：pt × (96/72) = CSS px @96dpi；×SCALE 后 = Canvas px。 */
const PT_TO_PX = (96 / 72) * SCALE;
const px = (pt: number) => pt * PT_TO_PX;
const marginPx = px(MARGIN);

/**
 * 行盒内文字的顶部偏移（em）。
 *
 * ⚠️ **不能给一整 em**。canvas 的 `textBaseline='top'` 把字体 ascent 线对齐到 y，
 * 字形实际占到 ~1.16em。偏移写 1.0em 而行高只有 1.55em 时，每行都溢出到行盒外
 * 0.6em；行内看不出来（下一行起始位置还够远），但**紧接着行盒画的元素 ——
 * 带底色的公式框、分隔线 —— 会正好横切最后一行字**。用户截图里
 * "高等解释…"被 notation 框切掉下半截就是这个原因（探针实测溢出 16px）。
 * 不变量：`TEXT_TOP_GAP + 1.16 <= LINE_H`。
 */
const TEXT_TOP_GAP = 0.16;

/** 正文行高（em）。必须 ≥ TEXT_TOP_GAP + 字形高度。 */
const LINE_H = 1.6;

/**
 * 章节标题的"跟随条款"（keep with next）。
 *
 * 标题后面**至少**要还能放下两行正文，否则整块挪到下一页。
 * 不这么做就会出现"孤行标题"：实测 `趣味知识` 这个 h2 正好落在第 1 页最底部
 * （画完只剩 7pt），它的内容和标题被劈到两页 —— 第 1 页末尾是个光标题，
 * 第 2 页只有一张趣味知识卡。页数一样，但读起来像排版事故。
 */
const KEEP_WITH_NEXT_PX = 10.5 * LINE_H * PT_TO_PX * 2;

// ---------------------------------------------------------------- 颜色

type Color = [number, number, number];

const C = {
  title: [15, 23, 42] as Color,
  h2: [30, 41, 59] as Color,
  h3: [71, 85, 105] as Color,
  body: [51, 65, 85] as Color,
  muted: [148, 163, 184] as Color,
  accent: [13, 148, 136] as Color,
  rule: [226, 232, 240] as Color,
  codeBg: [248, 250, 252] as Color,
  codeBar: [203, 213, 225] as Color,
};

const LEVEL_FILL: Color[] = [
  [204, 251, 241],
  [219, 234, 254],
  [254, 243, 199],
  [220, 252, 231],
];
const LEVEL_BORDER: Color[] = [
  [13, 148, 136],
  [59, 130, 246],
  [245, 158, 11],
  [16, 185, 129],
];
const LEVEL_TEXT: Color[] = [
  [13, 148, 136],
  [29, 78, 216],
  [180, 83, 9],
  [4, 120, 87],
];

// ---------------------------------------------------------------- Block 模型

interface Seg {
  text: string;
  bold?: boolean;
  color?: Color;
  /** 字号，单位 **pt**（与 layoutSegs / drawSegs 一致） */
  size?: number;
}

type Block =
  | { kind: 'title'; text: string }
  | { kind: 'h2'; text: string }
  | { kind: 'h3'; text: string }
  | { kind: 'para'; segs: Seg[] }
  | { kind: 'bullet'; segs: Seg[]; indent?: number; ordered?: number; marker?: string }
  | { kind: 'box'; segs: Seg[]; indent?: number; accentBar?: boolean }
  | { kind: 'rule' };

/** 一页内容：横向 / 纵向 + Block 列表。 */
export interface CanvasPageSpec {
  landscape: boolean;
  blocks?: Block[];
  /** 菜单“思维导图单页”时填这个。 */
  mindMap?: MindMapNode[];
  mindMapTitle?: string;
}

// ---------------------------------------------------------------- 文字度量

/** 测量一段文本在指定字号下的渲染宽度（Canvas px）。
 *
 * 直接 `ctx.measureText` 最准。Canvas 在浏览器环境内置，
 * Node 端（测试 / SSR）用 ctx-stub 接管。 */
function measureTextPx(ctx: CanvasCtx, text: string, fontSizePx: number): number {
  // ctx-stub 接到的 ctx 可能是带 measureText 的替身
  return ctx.measureText(text, fontSizePx);
}

/** 拆 token：拉丁按词断、中文 / 标点按字断。
 *
 * 与 pdfCore.wrapText 同样的策略，但单位是 px。复用 wrapText 的 em 估算比例。
 */
function wrapTextPx(
  ctx: CanvasCtx,
  text: string,
  fontSizePx: number,
  maxWidthPx: number
): string[] {
  const out: string[] = [];
  let cur = '';
  let curW = 0;

  // 拉丁词（含内部标点）作为一个不可分割单元
  const tokens: string[] = [];
  let buf = '';
  for (const ch of text) {
    const isLatin = /[A-Za-z0-9@#$%&*+\-=/\\.,;:!?()[\]{}'"`]/.test(ch);
    if (isLatin) {
      buf += ch;
    } else {
      if (buf) { tokens.push(buf); buf = ''; }
      tokens.push(ch);
    }
  }
  if (buf) tokens.push(buf);

  const flush = () => {
    if (cur) out.push(cur);
    cur = '';
    curW = 0;
  };

  for (const tk of tokens) {
    if (tk === '\n') { flush(); continue; }
    const w = measureTextPx(ctx, tk, fontSizePx);
    // 单 token 超宽（长英文 / URL）→ 硬切
    if (w > maxWidthPx && cur === '') {
      let rest = tk;
      while (rest.length > 1) {
        let cut = rest.length;
        while (cut > 1 && measureTextPx(ctx, rest.slice(0, cut), fontSizePx) > maxWidthPx) cut--;
        out.push(rest.slice(0, cut));
        rest = rest.slice(cut);
      }
      cur = rest;
      curW = measureTextPx(ctx, cur, fontSizePx);
      continue;
    }
    if (curW + w > maxWidthPx && cur !== '') flush();
    cur += tk;
    curW += w;
  }
  flush();
  return out.length ? out : [''];
}

/**
 * 把一段带片段样式的文本**预先切成视觉行**，每行带 `segs` + `width`。
 *
 * 折行前先剥 LaTeX：宽度必须按最终要画的文本算，
 * 否则用带 `$...$` 的原文算宽、画剥掉后的字会行尾溢出。
 */
function layoutSegs(
  ctx: CanvasCtx,
  segs: Seg[],
  defaultSize: number,
  maxWidth: number
): { segs: Seg[]; width: number }[] {
  const out: { segs: Seg[]; width: number }[] = [];
  let cur: Seg[] = [];
  let curW = 0;
  const maxWidthPx = maxWidth * PT_TO_PX;

  for (const raw of segs) {
    const text = readableLatexInText(raw.text);
    if (!text) continue;
    const seg: Seg = { ...raw, text };
    const segSizePx = (seg.size ?? defaultSize) * PT_TO_PX;
    const pieces = wrapTextPx(ctx, text, segSizePx, Math.max(16 * PT_TO_PX, maxWidthPx));
    for (const piece of pieces) {
      const w = measureTextPx(ctx, piece, segSizePx) * (seg.bold ? 1.03 : 1);
      if (curW + w > maxWidthPx && cur.length > 0) {
        out.push({ segs: cur, width: curW });
        cur = [];
        curW = 0;
      }
      cur.push({ ...seg, text: piece });
      curW += w;
    }
  }
  if (cur.length > 0) out.push({ segs: cur, width: curW });
  return out.length > 0 ? out : [{ segs: [], width: 0 }];
}

// ---------------------------------------------------------------- 画原语

/**
 * 抽象的画布接口。生产环境用真 Canvas 2D context；
 * Node 测试用 stub 提供 measureText + 接受调色 / 调字体 / 画几何的替身。
 *
 * 这是有意为之的"依赖倒置" —— 渲染逻辑不直接调 `ctx.fillText`，
 * 避免测试必须装 canvas 包。stub 能精确控制 measureText 返回值，
 * 让算法测试可重复。
 */
export interface CanvasCtx {
  /** 测量文本宽度。生产 = ctx.measureText(text).width；测试 = stub 返回值。 */
  measureText(text: string, fontSizePx: number): number;
  /** 实际渲染接口（测试桩可空实现）。 */
  fillText(text: string, x: number, y: number, opts: { color: Color; fontSizePx: number; bold?: boolean }): void;
  fillRect(x: number, y: number, w: number, h: number, color: Color, radiusPx?: number): void;
  drawLine(x1: number, y1: number, x2: number, y2: number, color: Color, lineWidthPx: number): void;
  drawBezier(p: { x1: number; y1: number; cx1: number; cy1: number; cx2: number; cy2: number; x2: number; y2: number }, color: Color, lineWidthPx: number): void;
  /** 画 canvas 的尺寸（pt）。 */
  pageWidthPt: number;
  pageHeightPt: number;
  landscape?: boolean;
  /**
   * 把当前 canvas 导出为 JPEG 字节 + 原始像素尺寸。
   * 生产 = `canvas.toDataURL('image/jpeg', 0.92)` 后 base64 解码；
   * 测试桩可空实现（返回 dummy 字节 + 1x1 尺寸）。
   */
  toJpeg(): { bytes: Uint8Array; width: number; height: number };
  /**
   * 可选：导出为 **PNG** 字节（无损，文字更锐利）。
   * 生产实现提供；测试桩可省略 —— 导图独立图片（Word 内嵌）优先用它。
   */
  toPng?(): { bytes: Uint8Array; width: number; height: number };
}

function makeFontSpec(sizePx: number, bold?: boolean): string {
  return `${bold ? 'bold ' : ''}${sizePx.toFixed(1)}px ${FONT_STACK}`;
}

/**
 * 画出来的一行字（pt，左上原点）。
 *
 * PDF 页面是位图，位图里的字不能被选中 / 复制 / 检索；
 * 导出时按这些坐标再补一层**隐形文字**（`3 Tr`）才有文字层。
 */
export interface PageTextLine {
  text: string;
  /** 文本左端 x（pt） */
  xPt: number;
  /** 基线 y（pt，自上而下 —— 与 PDF 内容流的坐标翻转统一在 pdfCore 里做） */
  baselinePt: number;
  /** 字号（pt） */
  sizePt: number;
}

// ---------------------------------------------------------------- PageWriter (canvas)

/**
 * 画一页的写入器：管 y 游标、超界时自动开新页。
 *
 * **新页 = 新 canvas 继续画**。所有出参（drawXxx 方法）作用在当前 canvas，
 * 调用方拿到的页引用也自动跟着切。简化判断：不再写"if 还要画新页" 重复。
 *
 * **ctx 工厂由构造参数传入** —— PageWriter 自己不创建 canvas，
 * 跨页时调工厂拿新 ctx。这是依赖倒置，避免 PageWriter 跟 DOM 耦合。
 */
class PageWriter {
  yPx = marginPx;
  ctx: CanvasCtx;
  pages: CanvasCtx[] = [];
  /**
   * 与 `pages` 一一对应的"画了哪些字"记录。
   *
   * **为什么要在画的同时记**：PDF 的页面是位图（见 exportPdf.ts 的说明），
   * 位图里的文字**不可复制、不可检索**。所以每一页还会补一层**隐形文字**
   * （PDF 渲染模式 `3 Tr`，只进内容流不显形）—— 位置必须和画出来的字严丝合缝，
   * 记录点只能在真正调 fillText 的地方，事后重新排版一定对不上。
   */
  readonly pageLines: PageTextLine[][] = [[]];
  private readonly createCtx: (widthPt: number, heightPt: number, landscape?: boolean) => CanvasCtx;

  constructor(first: CanvasCtx, createCtx: (widthPt: number, heightPt: number, landscape?: boolean) => CanvasCtx) {
    this.ctx = first;
    this.pages.push(first);
    this.createCtx = createCtx;
  }

  /** 当前页的文字记录。 */
  get lines(): PageTextLine[] {
    return this.pageLines[this.pageLines.length - 1];
  }

  /** 记一条**实际画出来**的文字（pt 坐标，左上原点；y 记基线）。 */
  record(text: string, xPx: number, topPx: number, sizePx: number) {
    if (!text) return;
    // 坐标与字号都取到 0.01pt。不取整的话 `14 * PT_TO_PX / PT_TO_PX` 会写成
    // `13.999999999999998`（浮点噪声直接进 PDF 内容流，又长又难看）。
    const round2 = (v: number) => Math.round(v * 100) / 100;
    this.lines.push({
      text,
      xPt: round2(xPx / PT_TO_PX),
      // canvas 的 textBaseline='top'，画点上方对齐；PDF 的 Tm 要的是基线。
      // 0.8 是常见中文字体的 ascent 比例，偏差几个像素只影响选区框，不影响复制。
      baselinePt: round2((topPx + sizePx * 0.8) / PT_TO_PX),
      sizePt: round2(sizePx / PT_TO_PX),
    });
  }

  get contentWPt() {
    return this.ctx.pageWidthPt - MARGIN * 2;
  }

  /** 当前 canvas 高度。landscape 时高宽交换。 */
  get pageHeightPt() {
    return this.ctx.pageHeightPt;
  }

  /** 超高空间不足则新开一页。nextCtx 默认调工厂。 */
  ensure(heightPx: number): boolean {
    if (this.yPx + heightPx > px(this.pageHeightPt) - marginPx) {
      const ctx = this.createCtx(this.ctx.pageWidthPt, this.ctx.pageHeightPt, this.ctx.landscape);
      // 背景白
      ctx.fillRect(0, 0, px(ctx.pageWidthPt), px(ctx.pageHeightPt), [255, 255, 255]);
      this.pages.push(ctx);
      this.pageLines.push([]);
      this.ctx = ctx;
      this.yPx = marginPx;
      return true;
    }
    return false;
  }

  fits(heightPx: number) {
    return this.yPx + heightPx <= px(this.pageHeightPt) - marginPx;
  }
}

// ---------------------------------------------------------------- 画 Block

/**
 * 画一段行内片段。
 *
 * ⚠️ **`seg.size` 的单位是 pt，`defaultSizePt` 也是 pt** ——必须与 `layoutSegs`
 * 完全一致。这里曾经踩过：`layoutSegs` 按 pt 换算（`seg.size * PT_TO_PX`），
 * 而本函数直接把 `seg.size` 当 px 用，于是所有显式给了 `size` 的片段
 * 都是**排得下、画得小**——标题 20pt 被画成 20px（实际需要 53px）、
 * 小节标题 14pt 画成 14px、列表序号 10px、出处小字 9px，一律缩到 **0.375×**，
 * 而且行盒仍按正常字号预留，所以看上去像一行小字悬在半空。
 * 表现是导出的 PDF 里"小节标题/选项字母/序号小到看不清"。
 */
function drawSegs(w: PageWriter, segs: Seg[], xPx: number, yPx: number, defaultSizePt: number) {
  let cursorPx = xPx;
  for (const seg of segs) {
    if (!seg.text) continue;
    const text = readableLatexInText(seg.text);
    if (!text) continue;
    const sizePx = (seg.size ?? defaultSizePt) * PT_TO_PX;
    w.ctx.fillText(text, cursorPx, yPx, { color: seg.color ?? C.body, fontSizePx: sizePx, bold: !!seg.bold });
    w.record(text, cursorPx, yPx, sizePx);
    cursorPx += measureTextPx(w.ctx, text, sizePx) * (seg.bold ? 1.03 : 1);
  }
}

function drawFlow(w: PageWriter, segs: Seg[], indentPt: number, sizePt: number) {
  const sizePx = px(sizePt);
  const lineHPx = sizePx * LINE_H;
  const lines = layoutSegs(w.ctx, segs, sizePt, w.contentWPt - indentPt);
  for (const ln of lines) {
    w.ensure(lineHPx);
    drawSegs(w, ln.segs, px(MARGIN + indentPt), w.yPx + sizePx * TEXT_TOP_GAP, sizePt);
    w.yPx += lineHPx;
  }
}

function renderBlocks(w: PageWriter, blocks: Block[]) {
  for (const b of blocks) {
    switch (b.kind) {
      case 'title': {
        const sizePt = 20;
        const sizePx = px(sizePt);
        const lineHPx = sizePx * 1.4;
        const lines = layoutSegs(w.ctx, [{ text: b.text, bold: true, color: C.title, size: sizePt }], sizePt, w.contentWPt);
        w.ensure(lines.length * lineHPx + 24);
        let yPx = w.yPx + sizePx * TEXT_TOP_GAP;
        for (const ln of lines) {
          drawSegs(w, ln.segs, px(MARGIN), yPx, sizePt);
          yPx += lineHPx;
        }
        w.yPx = yPx + 4;
        w.ctx.drawLine(px(MARGIN), w.yPx, px(PAGE_W - MARGIN), w.yPx, C.accent, 1.4);
        w.yPx += 16;
        break;
      }
      case 'h2': {
        const sizePt = 14;
        const sizePx = px(sizePt);
        // ensure 必须覆盖本块**真实占用**（顶部留白 + 行盒），否则块落在页底时
        // 会被放进只剩几十 px 的空间里，直接压到下边距外
        const gapPx = px(12);
        w.ensure(14 + gapPx + sizePx * 1.4 + 6 + KEEP_WITH_NEXT_PX);
        w.yPx += 14;
        drawSegs(w, [{ text: b.text, bold: true, color: C.h2, size: sizePt }], px(MARGIN), w.yPx + gapPx, sizePt);
        w.yPx += gapPx + sizePx * 1.4 + 6;
        break;
      }
      case 'h3': {
        const sizePt = 11.5;
        const sizePx = px(sizePt);
        const gapPx = px(10);
        w.ensure(8 + gapPx + sizePx * 1.4 + 2 + KEEP_WITH_NEXT_PX);
        w.yPx += 8;
        drawSegs(w, [{ text: b.text, bold: true, color: C.h3, size: sizePt }], px(MARGIN), w.yPx + gapPx, sizePt);
        w.yPx += gapPx + sizePx * 1.4 + 2;
        break;
      }
      case 'para':
        drawFlow(w, b.segs, 0, 10.5);
        break;
      case 'bullet': {
        const baseIndent = b.indent ?? 0;
        const indent = baseIndent + 14;
        const marker = b.marker ?? (b.ordered !== undefined ? `${b.ordered}.` : '•');
        const sizePt = 10.5;
        const sizePx = px(sizePt);
        const lineHPx = sizePx * LINE_H;
        const lines = layoutSegs(w.ctx, b.segs, sizePt, w.contentWPt - indent);
        for (const [i, ln] of lines.entries()) {
          w.ensure(lineHPx);
          if (i === 0) {
            drawSegs(w, [{ text: marker, bold: true, color: C.accent, size: 10 }], px(MARGIN + baseIndent), w.yPx + px(10) * TEXT_TOP_GAP, 10);
          }
          drawSegs(w, ln.segs, px(MARGIN + indent), w.yPx + sizePx * TEXT_TOP_GAP, sizePt);
          w.yPx += lineHPx;
        }
        break;
      }
      case 'box': {
        const indent = b.indent ?? 0;
        const sizePt = 10;
        const sizePx = px(sizePt);
        const lineHPx = sizePx * LINE_H;
        const lines = layoutSegs(w.ctx, b.segs, sizePt, w.contentWPt - indent - 12);
        const boxH = lines.length * lineHPx + 12;
        w.ensure(boxH);
        w.ctx.fillRect(px(MARGIN + indent), w.yPx, px(w.contentWPt - indent), boxH, C.codeBg, 3);
        if (b.accentBar) {
          w.ctx.fillRect(px(MARGIN + indent), w.yPx, 2.5, boxH, C.codeBar);
        }
        let yPx = w.yPx + 6 + sizePx * TEXT_TOP_GAP;
        for (const ln of lines) {
          drawSegs(w, ln.segs, px(MARGIN + indent + 9), yPx, sizePt);
          yPx += lineHPx;
        }
        w.yPx += boxH + 8;
        break;
      }
      case 'rule': {
        w.ensure(14);
        w.yPx += 6;
        w.ctx.drawLine(px(MARGIN), w.yPx, px(PAGE_W - MARGIN), w.yPx, C.rule, 0.6);
        w.yPx += 12;
        break;
      }
    }
  }
}

// ---------------------------------------------------------------- 思维导图页

/** 布局坐标 → canvas px 的仿射变换（两个出口共用同一套绘制）。 */
interface MapTransform {
  /** 布局坐标 x → canvas px */
  tx: (x: number) => number;
  /** 布局坐标 y → canvas px */
  ty: (y: number) => number;
  /** 长度 → canvas px */
  ts: (v: number) => number;
  /** 等比缩放系数（决定字号 / 圆角 / 线宽的视觉大小） */
  scale: number;
}

/**
 * 把已经算好布局的思维导图画到任意 ctx 上。
 *
 * **为什么要抽出来**：导图有两个出口 —— PDF 的横向页、Word 内嵌图片（截图）。
 * 之前只有前者会画。现在两处共用这一份绘制，避免"PDF 里长这样、Word 里长那样"。
 * 调用方只负责给变换（铺满页面 or 铺满图片），绘制细节这里一处写死。
 */
function paintMindMap(
  ctx: CanvasCtx,
  positioned: PositionedNode[],
  connLines: MindMapLine[],
  t: MapTransform,
  record?: (text: string, xPx: number, topPx: number, sizePx: number) => void
) {
  const { tx, ty, ts, scale } = t;

  // 连线
  for (const line of connLines) {
    const c = parseConnectionPath(line.path);
    if (!c) continue;
    const lv = Math.min(2, Math.floor(Math.abs(c.end[0] - c.start[0]) / 100));
    ctx.drawBezier(
      {
        x1: tx(c.start[0]), y1: ty(c.start[1]),
        cx1: tx(c.controls[0][0]), cy1: ty(c.controls[0][1]),
        cx2: tx(c.controls[1][0]), cy2: ty(c.controls[1][1]),
        x2: tx(c.end[0]), y2: ty(c.end[1]),
      },
      LEVEL_BORDER[lv] ?? LEVEL_BORDER[2],
      1.1
    );
  }

  // 描述盒
  for (const n of positioned) {
    if (n.descX === undefined || n.descY === undefined || n.descW === undefined || n.descH === undefined) continue;
    const bx = tx(n.descX - n.descW / 2);
    const by = ty(n.descY - n.descH / 2);
    const bw = ts(n.descW);
    const bh = ts(n.descH);
    ctx.fillRect(bx, by, bw, bh, [248, 250, 252], 3);
    const sizePx = Math.max(4.5, 8 * scale * PT_TO_PX);
    // 节点标题/描述里也可能夹公式（`$i^2=-1$`）—— 位图页没有 KaTeX，
    // 不降级就会把 `$...$` 源码画进图里
    const wrapped = wrapTextPx(ctx, readableLatexInText(n.description ?? ''), sizePx, Math.max(16 * PT_TO_PX, bw - 8));
    let yPx = by + 9 * scale * PT_TO_PX;
    for (const ln of wrapped) {
      if (yPx > by + bh - 2) break;
      ctx.fillText(ln, bx + 4, yPx, { color: C.muted, fontSizePx: sizePx });
      record?.(ln, bx + 4, yPx, sizePx);
      yPx += sizePx * 1.35;
    }
  }

  // 节点框 + 标题
  for (const n of positioned) {
    const lv = Math.min(3, n.level);
    const nx = tx(n.x);
    const ny = ty(n.y);
    const nw = ts(n.w);
    const nh = ts(n.h);

    ctx.fillRect(nx, ny, nw, nh, LEVEL_FILL[lv], Math.min(5, 5 * scale));

    const fontSizePx = Math.max(5, (n.level === 0 ? 12 : n.level === 1 ? 10 : 9) * Math.min(scale, 1.15) * PT_TO_PX);
    const wrapped = wrapTextPx(ctx, readableLatexInText(n.title), fontSizePx, Math.max(16 * PT_TO_PX, nw - 8));
    const lh = fontSizePx * 1.3;
    let textYPx = ny + nh / 2 - ((wrapped.length - 1) * lh) / 2 + fontSizePx * 0.5;
    for (const ln of wrapped) {
      const tw = measureTextPx(ctx, ln, fontSizePx);
      ctx.fillText(ln, nx + (nw - tw) / 2, textYPx, { color: LEVEL_TEXT[lv], fontSizePx, bold: true });
      record?.(ln, nx + (nw - tw) / 2, textYPx, fontSizePx);
      textYPx += lh;
    }
  }
}

function renderMindMapPage(w: PageWriter, nodes: MindMapNode[], title: string) {
  const { positioned, lines } = layoutMindMap(nodes);
  const bounds = mindMapBounds(positioned);

  w.yPx = marginPx;
  drawSegs(w, [{ text: title, bold: true, color: C.title, size: 15 }], px(MARGIN), w.yPx + px(15) * TEXT_TOP_GAP, 15);
  w.yPx += 24;
  w.ctx.drawLine(px(MARGIN), w.yPx, px(w.ctx.pageWidthPt - MARGIN), w.yPx, C.accent, 1.2);
  w.yPx += 18;

  // 思维导图可用区域 = 横向页的宽 - 两侧 margin；高 = 总高 - 已用 y
  const availW = w.ctx.pageWidthPt - MARGIN * 2;
  const availH = w.pageHeightPt - MARGIN - w.yPx / PT_TO_PX - 20;
  const scale = Math.min(availW / bounds.width, availH / bounds.height, 1.35);
  const offX = MARGIN + (availW - bounds.width * scale) / 2;
  const offY = w.yPx / PT_TO_PX + (availH - bounds.height * scale) / 2;

  paintMindMap(
    w.ctx,
    positioned,
    lines,
    {
      tx: (x) => px(offX + (x - bounds.minX) * scale),
      ty: (y) => px(offY + (y - bounds.minY) * scale),
      ts: (v) => v * scale * PT_TO_PX,
      scale,
    },
    (text, xPx, topPx, sizePx) => w.record(text, xPx, topPx, sizePx)
  );
}

/** 思维导图独立图片（Word 内嵌 / 任意需要"截图"的出口）。 */
export interface MindMapImageOutput {
  bytes: Uint8Array;
  mime: 'image/png' | 'image/jpeg';
  /** 图片按 pt 计的显示尺寸（= 内容逻辑尺寸，调用方按比例摆放） */
  widthPt: number;
  heightPt: number;
}

/**
 * 思维导图 → 一张独立图片（"从画布截图"）。
 *
 * 与 PDF 导图页**共用 `paintMindMap`** 同一份绘制源，所以两个出口的导图长得一样。
 * 图片按横向 A4 内容区自适应缩放（上限 1.35，避免节点巨大化），留 16pt 白边。
 * 优先 PNG（文字锐利）；ctx 不支持时退回 JPEG。
 */
export function renderMindMapImage(
  nodes: MindMapNode[],
  createCtx: (widthPt: number, heightPt: number, landscape?: boolean) => CanvasCtx = createRealCanvasCtx
): MindMapImageOutput {
  const { positioned, lines } = layoutMindMap(nodes);
  const bounds = mindMapBounds(positioned);

  const PAD = 16;
  const availW = PAGE_H - PAD * 2; // 横向：宽 = 纵向的高
  const availH = PAGE_W - PAD * 2;
  const scale = Math.min(availW / bounds.width, availH / bounds.height, 1.35);
  const widthPt = bounds.width * scale + PAD * 2;
  const heightPt = bounds.height * scale + PAD * 2;

  const ctx = createCtx(widthPt, heightPt, widthPt >= heightPt);
  ctx.fillRect(0, 0, px(widthPt), px(heightPt), [255, 255, 255]);

  paintMindMap(ctx, positioned, lines, {
    tx: (x) => px(PAD + (x - bounds.minX) * scale),
    ty: (y) => px(PAD + (y - bounds.minY) * scale),
    ts: (v) => v * scale * PT_TO_PX,
    scale,
  });

  const png = ctx.toPng?.();
  if (png && png.bytes.length > 0) {
    return { bytes: png.bytes, mime: 'image/png', widthPt, heightPt };
  }
  const jpeg = ctx.toJpeg();
  return { bytes: jpeg.bytes, mime: 'image/jpeg', widthPt, heightPt };
}

// ---------------------------------------------------------------- 内容装配

function hasKnowledgeContext(kc: NonNullable<GeneratedKnowledge['knowledgeContext']>): boolean {
  return Boolean(
    (kc.prerequisites?.length) || (kc.relatedTopics?.length) || (kc.learningPath?.length) ||
    (kc.commonConclusions?.length) || (kc.confusables?.length)
  );
}

function buildKnowledgeBlocks(data: KnowledgeCardData | GeneratedKnowledge): Block[] {
  const s = getCurrentStrings();
  const t = s.exportNote;
  const c = s.search.concept;
  const blocks: Block[] = [];

  const title = 'title' in data && data.title
    ? data.title
    : ('topic' in data && data.topic) ? (data as GeneratedKnowledge).topic : t.defaultTitle;

  blocks.push({ kind: 'title', text: title });

  if ('summary' in data && data.summary) {
    blocks.push({ kind: 'para', segs: [{ text: data.summary, color: C.body }] });
  }

  if ('concepts' in data && data.concepts?.length && typeof data.concepts[0] !== 'string') {
    blocks.push({ kind: 'h2', text: t.coreConcepts });
    const overview = ('conceptsOverview' in data && data.conceptsOverview) ? String(data.conceptsOverview) : '';
    if (overview) {
      blocks.push({ kind: 'para', segs: [{ text: `${t.overview}: `, bold: true, color: C.h3 }, { text: overview }] });
    }
    (data.concepts as Array<{
      type: string; title: string;
      content: { elementary: string; advanced: string };
      notation?: string; example?: string; keyPoints?: string[]; pitfalls?: string[];
    }>).forEach((concept) => {
      blocks.push({ kind: 'h3', text: `${conceptTypeLabel(s, concept.type)}: ${concept.title}` });
      blocks.push({
        kind: 'para',
        segs: [
          { text: `${c.elementary}: `, bold: true, color: C.h3 },
          { text: concept.content.elementary },
        ],
      });
      blocks.push({
        kind: 'para',
        segs: [
          { text: `${c.advanced}: `, bold: true, color: C.h3 },
          { text: concept.content.advanced },
        ],
      });
      if (concept.notation) {
        // notation 是**纯 LaTeX**（提示词明确要求不加围符）→ 不能走围符识别，
        // 必须按"整段就是公式"降级，否则导出里原样露出 \frac / \mathbb 源码
        blocks.push({ kind: 'box', segs: [{ text: readableLatexExpression(concept.notation), color: C.h2 }], accentBar: true });
      }
      if (concept.keyPoints?.length) {
        blocks.push({ kind: 'para', segs: [{ text: `${c.keyPoints}:`, bold: true, color: C.h3 }] });
        concept.keyPoints.forEach((kp) => blocks.push({ kind: 'bullet', segs: [{ text: kp }] }));
      }
      if (concept.pitfalls?.length) {
        blocks.push({ kind: 'para', segs: [{ text: `${c.pitfalls}:`, bold: true, color: C.h3 }] });
        concept.pitfalls.forEach((p) => blocks.push({ kind: 'bullet', segs: [{ text: p }] }));
      }
      if (concept.example) {
        blocks.push({
          kind: 'para',
          segs: [{ text: `${c.example}: `, bold: true, color: C.h3 }, { text: concept.example }],
        });
      }
    });
  }

  const kc = 'knowledgeContext' in data ? data.knowledgeContext : undefined;
  if (kc && hasKnowledgeContext(kc)) {
    blocks.push({ kind: 'h2', text: s.search.sections.knowledgeContext });
    const ctx = s.search.context;
    if (kc.prerequisites?.length) {
      blocks.push({ kind: 'para', segs: [{ text: `${ctx.prerequisites}: `, bold: true, color: C.h3 }, { text: kc.prerequisites.join('、') }] });
    }
    if (kc.relatedTopics?.length) {
      blocks.push({ kind: 'para', segs: [{ text: `${ctx.relatedTopics}: `, bold: true, color: C.h3 }, { text: kc.relatedTopics.join('、') }] });
    }
    if (kc.learningPath?.length) {
      blocks.push({ kind: 'para', segs: [{ text: `${ctx.learningPath}:`, bold: true, color: C.h3 }] });
      kc.learningPath.forEach((step, i) => blocks.push({ kind: 'bullet', segs: [{ text: step }], ordered: i + 1 }));
    }
    if (kc.commonConclusions?.length) {
      blocks.push({ kind: 'para', segs: [{ text: `${ctx.conclusions}:`, bold: true, color: C.h3 }] });
      kc.commonConclusions.forEach((item, i) => blocks.push({ kind: 'bullet', segs: [{ text: item }], ordered: i + 1 }));
    }
    if (kc.confusables?.length) {
      blocks.push({ kind: 'para', segs: [{ text: `${ctx.distinctions}:`, bold: true, color: C.h3 }] });
      kc.confusables.forEach((cf) =>
        blocks.push({ kind: 'bullet', segs: [{ text: `${cf.topic}: `, bold: true }, { text: cf.difference }] })
      );
    }
  }

  if ('examQuestions' in data && data.examQuestions?.length) {
    blocks.push({ kind: 'h2', text: s.search.sections.examQuestions });
    data.examQuestions.forEach((q) => {
      blocks.push({
        kind: 'h3',
        text: `[${examTypeLabel(s, q.type)}][${difficultyLabel(s, q.difficulty)}] ${q.question}`,
      });
      q.options?.forEach((opt, i) =>
        blocks.push({ kind: 'bullet', segs: [{ text: opt }], marker: `${String.fromCharCode(65 + i)}.` })
      );
      if (q.image || q.imageData || q.svg) {
        blocks.push({ kind: 'para', segs: [{ text: s.common.exportActions.figureOmitted, color: C.muted, size: 9.5 }] });
      }
      blocks.push({
        kind: 'para',
        segs: [{ text: `${s.search.actions.answer} `, bold: true, color: C.accent }, { text: q.answer }],
      });
      blocks.push({
        kind: 'para',
        segs: [{ text: `${s.search.actions.explanation} `, bold: true, color: C.h3 }, { text: q.explanation }],
      });
      if (q.source) {
        const src = `${q.source.year} ${q.source.exam}${q.source.section ? ` ${q.source.section}` : ''}`;
        blocks.push({ kind: 'para', segs: [{ text: `(${src})`, color: C.muted, size: 9 }] });
      }
    });
  }

  if ('interestingFacts' in data && data.interestingFacts?.length) {
    blocks.push({ kind: 'h2', text: s.search.sections.interestingFacts });
    data.interestingFacts.forEach((f) => {
      blocks.push({ kind: 'h3', text: f.title });
      blocks.push({ kind: 'para', segs: [{ text: f.content }] });
    });
  }

  blocks.push({ kind: 'rule' });
  const locale = getStoredLanguage() === 'zh' ? 'zh-CN' : undefined;
  blocks.push({
    kind: 'para',
    segs: [{
      text: `${t.exportedAt}: ${new Date().toLocaleString(locale)} | ${t.source}: ${s.app.brand}`,
      color: C.muted,
      size: 9,
    }],
  });

  return blocks;
}

// ---------------------------------------------------------------- 公开 API

export interface CanvasPageOutput {
  widthPt: number;
  heightPt: number;
  landscape: boolean;
  /** 画完的 canvas 上下文（生产 = 真 canvas ctx，测试 = stub）。 */
  ctx: CanvasCtx;
  /** 这一页实际画出来的文字（供 PDF 隐形文字层用，见 PageWriter.pageLines）。 */
  lines: PageTextLine[];
}

/**
 * 把知识数据渲染成多张 canvas（每张一页）。
 *
 * 思维导图独占一张横向页，接在正文之后（与正文出口一致）。
 * 没有导图时不产生空白横向页。
 */
export function renderKnowledgePages(
  data: KnowledgeCardData | GeneratedKnowledge,
  createCtx: (widthPt: number, heightPt: number, landscape?: boolean) => CanvasCtx,
  initCtx?: (ctx: CanvasCtx) => void
): CanvasPageOutput[] {
  const s = getCurrentStrings();

  const title = 'title' in data && data.title
    ? data.title
    : ('topic' in data && data.topic) ? (data as GeneratedKnowledge).topic : s.exportNote.defaultTitle;

  // 第一页：纵向 A4
  const first = createCtx(PAGE_W, PAGE_H, false);
  first.fillRect(0, 0, px(PAGE_W), px(PAGE_H), [255, 255, 255]);
  initCtx?.(first);

  const w = new PageWriter(first, createCtx);
  renderBlocks(w, buildKnowledgeBlocks(data));

  const pages: CanvasPageOutput[] = w.pages.map((p, i) => ({
    widthPt: p.pageWidthPt,
    heightPt: p.pageHeightPt,
    landscape: !!p.landscape,
    ctx: p,
    lines: w.pageLines[i] ?? [],
  }));

  const mindMap = 'mindMap' in data ? data.mindMap : undefined;
  if (mindMap && mindMap.length > 0) {
    const mm = createCtx(PAGE_H, PAGE_W, true); // 横向
    mm.fillRect(0, 0, px(PAGE_H), px(PAGE_W), [255, 255, 255]);
    initCtx?.(mm);
    const ww = new PageWriter(mm, createCtx);
    renderMindMapPage(ww, mindMap, `${title} · ${s.search.sections.mindMap}`);
    pages.push({
      widthPt: mm.pageWidthPt,
      heightPt: mm.pageHeightPt,
      landscape: true,
      ctx: mm,
      lines: ww.pageLines[0] ?? [],
    });
  }

  return pages;
}

// ---------------------------------------------------------------- Markdown → Blocks

type MdBlock =
  | { kind: 'heading'; level: number; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'bullets'; items: string[] }
  | { kind: 'numbers'; items: string[] }
  | { kind: 'quote'; text: string }
  | { kind: 'rule' };

function parseMarkdown(md: string): MdBlock[] {
  const blocks: MdBlock[] = [];
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) { i++; continue; }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      blocks.push({ kind: 'rule' });
      i++;
      continue;
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(trimmed);
    if (heading) {
      blocks.push({ kind: 'heading', level: heading[1].length, text: heading[2] });
      i++;
      continue;
    }

    if (/^>\s?/.test(trimmed)) {
      const parts: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i].trim())) {
        parts.push(lines[i].trim().replace(/^>\s?/, ''));
        i++;
      }
      blocks.push({ kind: 'quote', text: parts.join(' ') });
      continue;
    }

    const bullet = /^[-*+]\s+(.*)$/.exec(trimmed);
    const numbered = /^(\d+)[.)]\s+(.*)$/.exec(trimmed);
    if (bullet || numbered) {
      const ordered = !!numbered;
      const items: string[] = [];
      while (i < lines.length) {
        const t = lines[i].trim();
        const b = /^[-*+]?\s+(.*)$/.exec(t);
        const n = /^(\d+)[.)]\s+(.*)$/.exec(t);
        if (ordered && n) items.push(n[2]);
        else if (!ordered && b) items.push(b[1]);
        else if (!t) break;
        else items.push(t);
        i++;
      }
      blocks.push({ kind: ordered ? 'numbers' : 'bullets', items });
      continue;
    }

    if (trimmed.includes('|') && i + 1 < lines.length && /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(lines[i + 1])) {
      const rowTexts: string[] = [];
      while (i < lines.length && lines[i].trim().includes('|')) {
        const cells = lines[i].trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
        if (!cells.every((c) => /^:?-{2,}:?$/.test(c) || c === '')) {
          rowTexts.push(cells.join('　|　'));
        }
        i++;
      }
      blocks.push({ kind: 'paragraph', text: rowTexts.join('\n') });
      continue;
    }

    const parts: string[] = [];
    while (i < lines.length) {
      const t = lines[i].trim();
      if (!t || /^#{1,6}\s/.test(t) || /^[-*+]\s+/.test(t) || /^\d+[.)]\s+/.test(t) || /^>\s?/.test(t) || /^(-{3,}|\*{3,}|_{3,})$/.test(t)) break;
      parts.push(t);
      i++;
    }
    blocks.push({ kind: 'paragraph', text: parts.join(' ') });
  }

  return blocks;
}

function mdBlocksToCanvasBlocks(blocks: MdBlock[], title: string, brand: string): Block[] {
  const out: Block[] = [{ kind: 'title', text: title }];
  for (const b of blocks) {
    switch (b.kind) {
      case 'heading':
        if (b.level <= 2) out.push({ kind: 'h2', text: b.text });
        else out.push({ kind: 'h3', text: b.text });
        break;
      case 'paragraph':
        out.push({ kind: 'para', segs: [{ text: b.text }] });
        break;
      case 'bullets':
        b.items.forEach((it) => out.push({ kind: 'bullet', segs: [{ text: it }] }));
        break;
      case 'numbers':
        b.items.forEach((it, i) => out.push({ kind: 'bullet', segs: [{ text: it }], ordered: i + 1 }));
        break;
      case 'quote':
        out.push({ kind: 'box', segs: [{ text: b.text }] });
        break;
      case 'rule':
        out.push({ kind: 'rule' });
        break;
    }
  }
  out.push({ kind: 'rule' });
  const locale = getStoredLanguage() === 'zh' ? 'zh-CN' : undefined;
  const s = getCurrentStrings();
  out.push({
    kind: 'para',
    segs: [{
      text: `${s.exportNote.exportedAt}: ${new Date().toLocaleString(locale)} | ${s.exportNote.source}: ${brand}`,
      color: C.muted,
      size: 9,
    }],
  });
  return out;
}

/**
 * 把 Markdown 渲染成多张 canvas（每张一页）。
 */
export function renderMarkdownPages(
  md: string,
  title: string,
  createCtx: (widthPt: number, heightPt: number, landscape?: boolean) => CanvasCtx,
  initCtx?: (ctx: CanvasCtx) => void
): CanvasPageOutput[] {
  const s = getCurrentStrings();
  const blocks = parseMarkdown(md);
  const first = createCtx(PAGE_W, PAGE_H, false);
  first.fillRect(0, 0, px(PAGE_W), px(PAGE_H), [255, 255, 255]);
  initCtx?.(first);
  const w = new PageWriter(first, createCtx);
  renderBlocks(w, mdBlocksToCanvasBlocks(blocks, title, s.app.brand));
  return w.pages.map((p, i) => ({
    widthPt: p.pageWidthPt,
    heightPt: p.pageHeightPt,
    landscape: !!p.landscape,
    ctx: p,
    lines: w.pageLines[i] ?? [],
  }));
}

// ---------------------------------------------------------------- Canvas 生产工厂

/** 生产 Canvas 上下文 + 真实 fillText / fillRect / measureText / drawLine / drawBezier。 */
export function createRealCanvasCtx(widthPt: number, heightPt: number, landscape = false): CanvasCtx {
  // 浏览器环境
  const canvasEl = document.createElement('canvas');
  // ⚠️ **不要按 landscape 交换宽高**：调用方已经按"横向就是宽>高"传参
  // （导图页传 createCtx(PAGE_H, PAGE_W, true)），再交换一次就互相抵消，
  // 结果是"横向页其实是纵向画布" —— 导图按横向宽度排布、画在窄画布上直接裁掉，
  // 而且超页时 createCtx(pageWidthPt, pageHeightPt, landscape) 还会二次交换，
  // 让续页尺寸又变回纵向。
  canvasEl.width = px(widthPt);
  canvasEl.height = px(heightPt);
  const ctx2d = canvasEl.getContext('2d');
  if (!ctx2d) throw new Error('2d context unavailable');
  ctx2d.textBaseline = 'top';

  // JPEG → Uint8Array 解码：用浏览器原生 atob
  function dataUrlToBytes(dataUrl: string): Uint8Array {
    const comma = dataUrl.indexOf(',');
    const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  return {
    pageWidthPt: widthPt,
    pageHeightPt: heightPt,
    landscape,
    measureText(text: string, fontSizePx: number) {
      ctx2d.font = makeFontSpec(fontSizePx, false);
      return ctx2d.measureText(text).width;
    },
    fillText(text, x, y, opts) {
      ctx2d.font = makeFontSpec(opts.fontSizePx, opts.bold);
      ctx2d.fillStyle = `rgb(${opts.color[0]}, ${opts.color[1]}, ${opts.color[2]})`;
      ctx2d.fillText(text, x, y);
    },
    fillRect(x, y, w, h, color, radiusPx) {
      ctx2d.fillStyle = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
      if (radiusPx && radiusPx > 0) {
        const r = Math.min(radiusPx, w / 2, h / 2);
        ctx2d.beginPath();
        ctx2d.moveTo(x + r, y);
        ctx2d.arcTo(x + w, y, x + w, y + h, r);
        ctx2d.arcTo(x + w, y + h, x, y + h, r);
        ctx2d.arcTo(x, y + h, x, y, r);
        ctx2d.arcTo(x, y, x + w, y, r);
        ctx2d.closePath();
        ctx2d.fill();
      } else {
        ctx2d.fillRect(x, y, w, h);
      }
    },
    drawLine(x1, y1, x2, y2, color, lineWidthPx) {
      ctx2d.strokeStyle = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
      ctx2d.lineWidth = lineWidthPx;
      ctx2d.beginPath();
      ctx2d.moveTo(x1, y1);
      ctx2d.lineTo(x2, y2);
      ctx2d.stroke();
    },
    drawBezier(p, color, lineWidthPx) {
      ctx2d.strokeStyle = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
      ctx2d.lineWidth = lineWidthPx;
      ctx2d.beginPath();
      ctx2d.moveTo(p.x1, p.y1);
      ctx2d.bezierCurveTo(p.cx1, p.cy1, p.cx2, p.cy2, p.x2, p.y2);
      ctx2d.stroke();
    },
    toJpeg() {
      const dataUrl = canvasEl.toDataURL('image/jpeg', 0.92);
      return {
        bytes: dataUrlToBytes(dataUrl),
        width: canvasEl.width,
        height: canvasEl.height,
      };
    },
    toPng() {
      const dataUrl = canvasEl.toDataURL('image/png');
      return {
        bytes: dataUrlToBytes(dataUrl),
        width: canvasEl.width,
        height: canvasEl.height,
      };
    },
  };
}