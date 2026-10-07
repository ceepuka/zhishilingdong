import { sanitizeInlineSvg } from './inlineSvg';
import { dataUrlToBytes, type ExportFigure } from './canvasRenderer';
import type { GeneratedKnowledge, KnowledgeCardData } from '../types';

/**
 * 导出用示意图采集 —— 把数据里的图变成"能画到 canvas 上 + 能塞进 Word 的字节"。
 *
 * ## 为什么需要这一层
 *
 * 页面上的配图有四条来源（见 `KnowledgeContentView.ConceptIllustration`）：
 *   1. `image`     —— 可靠来源图片直链
 *   2. `imageData` —— 多模态模型直出的 base64（`data:image/png;base64,...`）
 *   3. 关键词检索  —— 运行时异步 hook 去图库现查
 *   4. `svg`       —— 模型手绘的内联 SVG
 *
 * 导出链此前**一条都没接**：概念配图在 txt / md / html / docx / pdf 五个出口
 * 全部静默消失（连"这里有张图"的提示都没有），用户拿到的文档比页面上少内容。
 *
 * ## 三条来源的可行性（这是本文件的核心取舍）
 *
 * - **`imageData`**：字节已经在手里，最可靠。PNG / JPEG 直接取原始字节（无损、
 *   不做二次编码），交给两个出口共用。
 * - **`svg`**：Word 的 DrawingML 不接受 SVG（`a:blip` 只认位图），必须**栅格化**。
 *   注意 `sanitizeInlineSvg` 只保证"有 viewBox 或 width+height"，只有 viewBox 时
 *   浏览器给的 `naturalWidth` 是 300×150 默认值 —— 所以这里显式补 width/height。
 * - **`image`（远程直链）**：纯前端 + `file://` 场景下**基本拿不到** —— 读取像素受
 *   CORS 限制，服务器不给 `Access-Control-Allow-Origin` 时 canvas 会被污染、
 *   `toDataURL` 直接抛 SecurityError。**这里不静默吞掉**：拿不到就返回 undefined，
 *   调用方退化成"本题原有配图，无法随文字导出"那行提示，而不是让人以为这题本来没图。
 * - **关键词检索图**：它是渲染期的 hook 结果，**数据里根本不存在**，导出无从获取。
 *
 * 所有失败一律降级、绝不抛出 —— 导出不能因为"配图失败"整份失败，正文比配图重要。
 */

/** 单张图的字节上限：一份超长 base64 能把单文件产物撑爆，也拖慢 JSZip */
const FIGURE_MAX_BYTES = 3 * 1024 * 1024;

/** 远程图加载超时（ms）。挂住的 URL 不能让整个导出卡死 */
const LOAD_TIMEOUT_MS = 8000;

/** `concept:0` / `question:2` —— 图在数据里的位置标识，两个出口靠它对齐 */
export type FigureMap = Map<string, ExportFigure>;

/** 解码 + 位图化的浏览器实现（测试注入替身，避免依赖真实 canvas） */
export interface FigureLoader {
  /** 解码一张图，返回可 `drawImage` 的对象与自然尺寸 */
  decode(src: string): Promise<{ image: unknown; width: number; height: number }>;
  /** 把已解码的图重绘成 PNG，返回 data URL（SVG / 远程图走这条） */
  rasterize(image: unknown, width: number, height: number): string;
}

/** 已经是位图的 data URL（这种直接取原始字节，不重编码） */
const BITMAP_DATA_URL = /^data:image\/(png|jpeg|jpg);base64,/i;

/** 自然尺寸上限，防止异常尺寸的图把画布开爆 */
const MAX_RASTER_EDGE = 2400;

/**
 * 给 SVG 补上明确的 width/height。
 *
 * 只有 viewBox 的 SVG 在 `new Image()` 里会退化成 300×150，
 * 按那个尺寸栅格化出来是一张糊图。这里从 viewBox 反推真实尺寸并注入根标签。
 */
export function svgWithIntrinsicSize(svg: string): { svg: string; width: number; height: number } {
  /**
   * ⚠️ 尺寸只能在**根标签**上找，不能在整段源码里找。
   *
   * 子元素天生就带 `width` / `height`（`<rect width="300" height="180">`），
   * 全局搜索会把第一个子元素的尺寸当成画布尺寸 —— 于是"已经有尺寸"的分支被
   * 误判命中、**跳过 viewBox 注入**，`<img>` 随后退回浏览器给无尺寸 SVG 的
   * 默认值（实测 240×150）。结果是每个 AI 手绘示意图都被缩水一圈。
   */
  const root = /^<svg[^>]*>/i.exec(svg)?.[0] ?? '';

  // 只认纯数字（或带 px）的属性值 —— `width="100%"` 这种必须忽略，否则会把
  // 百分比数字（100）当成像素宽度，图被拉成一条细线。
  const wAttr = /\swidth\s*=\s*["'](\d+(?:\.\d+)?)(?:px)?["']/i.exec(root);
  const hAttr = /\sheight\s*=\s*["'](\d+(?:\.\d+)?)(?:px)?["']/i.exec(root);
  if (wAttr && hAttr) {
    return { svg, width: Number(wAttr[1]), height: Number(hAttr[1]) };
  }

  const vb = /viewBox\s*=\s*["']\s*([-\d.eE]+)[\s,]+([-\d.eE]+)[\s,]+([\d.eE]+)[\s,]+([\d.eE]+)/i.exec(root);
  if (vb) {
    const width = Number(vb[3]);
    const height = Number(vb[4]);
    if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
      return { svg: svg.replace(/^<svg/i, `<svg width="${width}" height="${height}"`), width, height };
    }
  }

  return { svg, width: 300, height: 150 };
}

/** SVG 源码 → 可加载的 data URL */
function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/**
 * 把一条图源变成可导出的图。
 * @returns 拿不到字节时 undefined（调用方降级，绝不抛）
 */
async function loadFigure(
  src: string,
  caption: string,
  loader: FigureLoader
): Promise<ExportFigure | undefined> {
  try {
    const decoded = await loader.decode(src);
    const width = Math.max(1, Math.round(decoded.width));
    const height = Math.max(1, Math.round(decoded.height));

    // 1) 已经是 PNG / JPEG 的 data URL —— 直接用原始字节（无损、体积也小）
    if (BITMAP_DATA_URL.test(src)) {
      const bytes = dataUrlToBytes(src);
      if (bytes.length > 0 && bytes.length <= FIGURE_MAX_BYTES) {
        return {
          image: decoded.image,
          bytes,
          dataUrl: src,
          ext: /png/i.test(src.slice(0, 24)) ? 'png' : 'jpeg',
          aspect: width / height,
          caption,
        };
      }
    }

    // 2) 其余（SVG / 远程直链）一律重绘成 PNG：
    //    Word 不认 SVG；远程图也只有重绘这一条路能拿到字节。
    //    这一步在跨域图上会因画布被污染而抛 SecurityError —— 由外层 catch 接住。
    const cap = MAX_RASTER_EDGE;
    const scale = Math.min(1, cap / Math.max(width, height));
    const dataUrl = loader.rasterize(decoded.image, Math.round(width * scale), Math.round(height * scale));
    const bytes = dataUrlToBytes(dataUrl);
    if (bytes.length === 0 || bytes.length > FIGURE_MAX_BYTES) return undefined;

    return { image: decoded.image, bytes, dataUrl, ext: 'png', aspect: width / height, caption };
  } catch {
    return undefined;
  }
}

/** 按页面同一优先级挑出这条数据里的图源（拿不到就 undefined） */
function pickConceptSource(concept: {
  image?: string;
  imageData?: string;
  svg?: string;
}): string | undefined {
  // 与 ConceptIllustration 一致：直链 > 图片数据 > 手绘 SVG
  // （中间那一级"关键词检索"是渲染期 hook 的结果，数据里没有，导出无从取用）
  if (concept.image) return concept.image;
  if (concept.imageData) return concept.imageData;
  const svg = sanitizeInlineSvg(concept.svg);
  if (svg) return svgToDataUrl(svgWithIntrinsicSize(svg).svg);
  return undefined;
}

function pickQuestionSource(q: { image?: string; imageData?: string; svg?: string }): string | undefined {
  // 页面试题的顺序是 (image || imageData) 优先，加载失败才回退 SVG
  if (q.image) return q.image;
  if (q.imageData) return q.imageData;
  const svg = sanitizeInlineSvg(q.svg);
  if (svg) return svgToDataUrl(svgWithIntrinsicSize(svg).svg);
  return undefined;
}

/**
 * 采集一份知识数据里所有**导出得到**的示意图。
 *
 * 只处理 `GeneratedKnowledge`（有 concepts / examQuestions 的结构）——
 * 知识卡片（`KnowledgeCardData`）本身没有配图字段。
 */
export async function collectKnowledgeFigures(
  data: KnowledgeCardData | GeneratedKnowledge,
  loader: FigureLoader = browserFigureLoader
): Promise<FigureMap> {
  const out: FigureMap = new Map();
  const jobs: Promise<void>[] = [];

  if ('concepts' in data && Array.isArray(data.concepts) && typeof data.concepts[0] !== 'string') {
    (data.concepts as Array<{ title: string; image?: string; imageData?: string; svg?: string }>).forEach(
      (concept, i) => {
        const src = pickConceptSource(concept);
        if (!src) return;
        jobs.push(
          loadFigure(src, concept.title, loader).then((fig) => {
            if (fig) out.set(`concept:${i}`, fig);
          })
        );
      }
    );
  }

  if ('examQuestions' in data && Array.isArray(data.examQuestions)) {
    data.examQuestions.forEach((q, i) => {
      const src = pickQuestionSource(q);
      if (!src) return;
      // 试题图不配图题：它就长在题干下面，页面也没给图注，写一行"第 N 题"是噪音
      jobs.push(
        loadFigure(src, '', loader).then((fig) => {
          if (fig) out.set(`question:${i}`, fig);
        })
      );
    });
  }

  await Promise.all(jobs);
  return out;
}

/** 浏览器实现：真实解码 + 真实栅格化 */
export const browserFigureLoader: FigureLoader = {
  decode(src: string) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      let settled = false;
      const done = (fn: () => void) => {
        if (settled) return;
        settled = true;
        fn();
      };
      // 远程图必须带 crossOrigin，否则像素读不回来（canvas 会被污染）；
      // 同源 / data URL 带上也无害。
      if (/^https?:/i.test(src)) img.crossOrigin = 'anonymous';
      img.onload = () =>
        done(() => resolve({ image: img, width: img.naturalWidth, height: img.naturalHeight }));
      img.onerror = () => done(() => reject(new Error('figure load failed')));
      // 挂住的 URL 不能拖死导出
      setTimeout(() => done(() => reject(new Error('figure load timeout'))), LOAD_TIMEOUT_MS);
      img.src = src;
    });
  },

  rasterize(image: unknown, width: number, height: number) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2d context unavailable');
    // 先铺白底：SVG 常带透明背景，直接画上去在 Word / PDF 里会是黑的或透的
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(image as CanvasImageSource, 0, 0, width, height);
    // 跨域图在这一步抛 SecurityError → 由 loadFigure 的 catch 收掉
    return canvas.toDataURL('image/png');
  },
};
