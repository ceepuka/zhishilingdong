/**
 * inlineSvg —— AI 生成的内联 SVG 原理图：安全清洗 + 渲染
 * ------------------------------------------------------------------
 * 为什么需要它：
 *   知识生成里"配图"是高价值但高风险的一环。让模型去猜一个真实存在的图片直链，
 *   命中率极低（要么 404，要么张冠李戴）。而几何图形、受力分析、电路、函数图像
 *   这类**示意图**，本质上是几根线 + 几个标记，模型完全可以直接写出 SVG。
 *
 *   因此本项目采用"双通道配图"：
 *     1. svg  —— 模型自己画的示意图，内联渲染，100% 可见（首选）
 *     2. image —— 真实存在的图片直链（照片、扫描件等），渲染失败自动隐藏
 *
 * 安全策略（内联 SVG 会被插入 DOM，等价于注入 HTML，必须严格过滤）：
 *   - 必须是完整且自闭合的 <svg>...</svg>
 *   - 禁止 script / foreignObject / iframe / animate 之外的事件属性
 *   - 禁止任何事件处理器（onclick / onload / ...）
 *   - 禁止 javascript: 协议
 *   - 禁止外部资源引用（<image href="http...">、use href、@import、url(http...)）
 *   - 限制体积，防止模型把整页百科塞进来
 */

/** 单张 SVG 的体积上限（字符数），超过则丢弃 */
const SVG_MAX_CHARS = 24_000;

/** 危险特征：命中任一即整段丢弃（宁可不出图，也不能注入） */
const UNSAFE_PATTERNS: RegExp[] = [
  /<\s*script/i,
  /<\s*foreignObject/i,
  /<\s*iframe/i,
  /<\s*embed/i,
  /<\s*object/i,
  /<\s*image/i,
  /<\s*use\s/i,
  /<[^>]+\son[a-z]+\s*=/i,          // onclick= / onload= 等事件属性
  /javascript\s*:/i,
  /data\s*:\s*text\/html/i,
  /xlink:href/i,
  /@import/i,
  /url\(\s*['"]?https?:/i,
];

/** 线条粗细上限：模型常写 stroke-width="4~8"，大画布等比缩小后视觉上仍粗笨；压到细线更清爽 */
const STROKE_WIDTH_MAX = 2;

/** 把 SVG 里过粗的 stroke-width 钳到上限（属性写法与内联 style 写法都处理；未超限的原样保留） */
function clampStrokeWidth(s: string): string {
  // stroke-width="4" / stroke-width='4.5' —— 仅超限时改写，避免无谓改动引号/格式
  s = s.replace(/stroke-width\s*=\s*["']\s*(\d+(?:\.\d+)?)\s*["']/gi, (m, n) => {
    const v = Number(n);
    return v > STROKE_WIDTH_MAX ? `stroke-width="${STROKE_WIDTH_MAX}"` : m;
  });
  // style="...stroke-width:6..."（内联样式写法）
  s = s.replace(/stroke-width\s*:\s*(\d+(?:\.\d+)?)/gi, (m, n) => {
    const v = Number(n);
    return v > STROKE_WIDTH_MAX ? `stroke-width:${STROKE_WIDTH_MAX}` : m;
  });
  return s;
}

/**
 * 清洗模型给出的 SVG 源码。
 * @returns 安全可渲染的 SVG 字符串；不合法/不安全一律返回 undefined（调用方不渲染）
 */
export function sanitizeInlineSvg(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const s = raw.trim();
  if (!s) return undefined;
  if (s.length > SVG_MAX_CHARS) return undefined;

  // 必须是完整的一段 svg 根元素
  if (!/^<svg[\s>]/i.test(s)) return undefined;
  if (!/<\/svg>\s*$/i.test(s)) return undefined;

  for (const re of UNSAFE_PATTERNS) {
    if (re.test(s)) return undefined;
  }

  // 既没有 viewBox 也没有固定尺寸的 svg 无法自适应缩放 → 丢弃，避免渲染成 0 尺寸
  const hasViewBox = /viewBox\s*=/i.test(s);
  const hasSize = /\swidth\s*=/i.test(s) && /\sheight\s*=/i.test(s);
  if (!hasViewBox && !hasSize) return undefined;

  // 渲染体验：过粗的线条统一压细（用户可读性 > 模型的审美）
  return clampStrokeWidth(s);
}
