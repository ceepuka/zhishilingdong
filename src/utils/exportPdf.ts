import type { GeneratedKnowledge, KnowledgeCardData } from '../types';
import { PdfBuilder, type Run } from './pdfCore';
import {
  renderKnowledgePages,
  renderMarkdownPages,
  createRealCanvasCtx,
  type CanvasCtx,
  type CanvasPageOutput,
} from './canvasRenderer';

/**
 * 知识笔记 / 文档 → PDF（Canvas 渲染成位图 + 隐形文字层）。
 *
 * ## 为什么这样写（与上一版路线不同）
 *
 * 上一版用 PDF 内置 CJK 字体（STSong-Light + UniGB-UCS2-H）+ 自带 ToUnicode CMap，
 * 不嵌 FontFile。字节结构完全合规、文字也能被 pdf.js 正确**提取**，
 * 但 **Chrome / Edge / pdf.js 在 Windows 上都不给它配 CJK 字形**，
 * 实测渲染出来的页面**几乎全白**（用户桌面上的 复数.pdf 就是这样，
 * 页面上只有淡到看不见的鬼影）—— PDF 里那 155 个 Tj 全画不出字。
 *
 * 根因不是 CMap 缺，是阅读器栈里压根没有可用的 CJK 字形可选，
 * 跟"用哪个内置字体声明"无关。修复只能走"真把字形塞进产物"：
 *  1. vendor 一份 5MB 中文 TTF 进单文件 HTML —— 体积爆炸；
 *  2. 运行时下载字体 / 读系统字库 —— 浏览器不暴露系统字体字节，做不到；
 *  3. **交给浏览器渲染层**：CSS / Canvas 本来就会去系统字库取字形
 *     （等价于用户说的"操作系统有一整套字库，运行时动态链接"）。
 *
 * 这里走第 3 条：用 canvasRenderer 把每页画成 JPEG，嵌成图片 XObject（DCTDecode）。
 * 视觉效果与页面所见完全一致，跨阅读器零差异，零字体风险。
 *
 * ## 位图的代价，用隐形文字层补回来
 *
 * 纯位图页里的字**不能被复制、检索、Ctrl+F** —— 这是上一版用户明确抱怨过的点。
 * 所以每一页在图片之后，再按 canvasRenderer 记录的坐标写一层 PDF 渲染模式 `3 Tr`
 * 的**隐形文字**（扫描件 PDF 的标准做法）。文字不显形，因此不受"缺 CJK 字形"
 * 影响，但选择 / 复制 / 检索都有内容。
 */

/** 可注入的 canvas 上下文工厂（生产 = 真 canvas；测试 = stub，见 __tests__）。 */
export type CanvasCtxFactory = (widthPt: number, heightPt: number, landscape?: boolean) => CanvasCtx;

/** 把渲染好的多页转成 PDF 字节：每页一张整页位图 + 一层隐形文字。 */
function pagesToPdfBytes(pages: CanvasPageOutput[]): Uint8Array {
  const builder = new PdfBuilder();

  for (const page of pages) {
    const jpeg = page.ctx.toJpeg();
    const runs = builder.addPage(page.landscape);

    // 1) 整页位图铺满 MediaBox（宽度用页面实际 pt 尺寸，不用常量推）
    runs.push({
      kind: 'image',
      x: 0,
      y: 0,
      w: page.widthPt,
      h: page.heightPt,
      jpeg: jpeg.bytes,
      imgW: jpeg.width,
      imgH: jpeg.height,
    } as Run);

    // 2) 隐形文字层：位置来自"真正画字那一刻"的记录，必须整段用 CJK 字体
    //    （Helvetica/WinAnsi 编码塞中文会变乱码），ToUnicode 由 PdfBuilder 汇总。
    for (const line of page.lines) {
      if (!line.text.trim()) continue;
      runs.push({
        kind: 'text',
        x: line.xPt,
        y: line.baselinePt,
        size: line.sizePt,
        color: [0, 0, 0],
        bold: false,
        text: line.text,
        invisible: true,
      } as Run);
    }
  }

  return builder.build();
}

/**
 * 知识笔记 → PDF。
 *
 * 思维导图单独一张**横向页**，接在正文之后（用户原要求"单独给一页（横向）"）。
 * 没有导图时不产生空白横向页。
 */
export function buildKnowledgePdf(
  data: KnowledgeCardData | GeneratedKnowledge,
  createCtx: CanvasCtxFactory = createRealCanvasCtx
): Uint8Array {
  const pages = renderKnowledgePages(data, createCtx);
  return pagesToPdfBytes(pages);
}

/**
 * Markdown 文本 → PDF（给"文档生成"模块用）。
 *
 * 文档模块的正文是 AI 写的 Markdown **原文**，不是结构化知识数据，
 * 所以这里走简化的路径：剥掉 Markdown 标记留下可读文本 + 保留标题层级。
 * 复用同一套 Canvas 渲染，因此文字同样清晰（不嵌字体）。
 */
export function buildMarkdownPdf(md: string, title: string, createCtx: CanvasCtxFactory = createRealCanvasCtx): Uint8Array {
  const pages = renderMarkdownPages(md, title, createCtx);
  return pagesToPdfBytes(pages);
}
