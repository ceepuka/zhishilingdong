import type { MindMapNode } from '../types';

/**
 * 思维导图布局算法（纯函数，无 DOM 依赖）。
 *
 * **为什么从 `KnowledgeContentView.tsx` 抽出来**：
 * 布局原先埋在组件文件里，而导出（PDF 横向单页 / Word 内嵌图）也需要同一套坐标。
 * 工具层从组件反向 import 是错的依赖方向，且更实际的问题是**两份布局必然漂移** ——
 * 页面上的导图和导出文件里的导图会长得不一样。
 * 抽成纯函数后，页面与导出**共用同一份布局**（与本项目其他"单一来源"约束一致）。
 *
 * 坐标系：左上角为原点，x 向右、y 向下（与 SVG/DOM 一致，不是 PDF 的坐标系）。
 * 导出时由调用方做y 轴翻转。
 *
 * 双向展开：根节点居中，子节点按数量左右均分（左半在前几个，右半在后几个），
 * 叶节点的 description 以"描述盒"形式挂在节点外侧。
 */

export interface PositionedNode {
  id: string;
  title: string;
  description?: string;
  /** 节点框左上角 */
  x: number;
  y: number;
  w: number;
  h: number;
  /** 0 = 根，1..3 = 层级 */
  level: number;
  descId?: string;
  /** 描述盒中心与尺寸（仅叶子带描述时存在） */
  descX?: number;
  descY?: number;
  descW?: number;
  descH?: number;
}

export interface Line {
  /** SVG path 的 d属性：`M x y C ...` */
  path: string;
}

/** 层级间距（根→一级→二级→三级） */
export const LEVEL_GAPS = [70, 55, 45, 40];
export const NODE_SPACING = 16;
export const DESC_GAP = 8;
export const DESC_WIDTH = 120;
export const DESC_FONT_SIZE = 12;
export const DESC_LINE_HEIGHT = 17;
const DESC_CSS_PADDING_X = 8;
const DESC_CSS_PADDING_Y = 4;

interface MeasuredNode {
  node: MindMapNode;
  level: number;
  descId: string;
  size: { w: number; h: number };
  descSize: { w: number; h: number };
  subtreeW: number;
  subtreeH: number;
  topOffset: number;
  bottomOffset: number;
  hasDesc: boolean;
  children: MeasuredNode[];
}

function calculateDescSize(text: string): { w: number; h: number } {
  const w = DESC_WIDTH;
  const innerW = w - DESC_CSS_PADDING_X * 2;
  // 按等宽 em 估算实际占用宽度 —— 不能一律按半角字符数算，
  // 否则 sin(α±β)=sinαcosβ±cosαsinβ 这类含希腊字母的公式会被严重低估，
  // 导致描述盒高度不够、文字溢出（真实 bug）。
  const widthEm = estimateTextWidthEm(text);
  const emPerLine = innerW / DESC_FONT_SIZE;
  const lines = Math.max(1, Math.ceil(widthEm / emPerLine));
  const h = lines * DESC_LINE_HEIGHT + DESC_CSS_PADDING_Y * 2;
  return { w, h };
}

/**
 * 估算文本占用的宽度，单位是 **em**（相对当前字号）。
 *
 * 各字符类的宽度（em）：
 *   - 半角字母/数字/英文标点/空格 → 0.55
 *   - CJK 汉字、全角标点          → 1.0（汉字本来就是 1em 见方）
 *   - 希腊字母 α β γ θ Δ 等        → 0.95（数学字体里也是全角级宽度，是溢出的主因）
 *   - 数学符号 ± ≤ ≥ √ × ÷ ∈ 等    → 0.8
 *   - 上标/下标（^ _ 后面那个字符）→ 0.4（视觉上更窄）
 *
 * 估算**刻意偏大**：宁可描述盒高一点（略空），也绝不能低估而溢出。
 */
export function estimateTextWidthEm(text: string): number {
  const GREEK = /[\u0391-\u03C9]/;
  const CJK = /[\u4E00-\u9FFF\u3000-\u303F\uFF00-\uFFEF]/;
  const MATH_SYMBOL = /[±≤≥≠≈√∞∑∏∫×÷·∈∉⊂⊆∪∩→←↔⇒⇔°′″]/;

  let em = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '^' || ch === '_') {
      if (i + 1 < text.length) {
        em += 0.4;
        i++;
      }
      continue;
    }
    if (ch === '\n' || ch === '\r') {
      const perLine = (DESC_WIDTH - DESC_CSS_PADDING_X * 2) / DESC_FONT_SIZE;
      em = Math.ceil(em / perLine) * perLine;
      continue;
    }
    if (GREEK.test(ch)) { em += 0.95; continue; }
    if (CJK.test(ch)) { em += 1.0; continue; }
    if (MATH_SYMBOL.test(ch)) { em += 0.8; continue; }
    em += 0.55;
  }
  return em;
}

function calculateNodeSize(title: string, level: number): { w: number; h: number } {
  const baseSizes = [
    { w: 120, h: 48 },
    { w: 100, h: 40 },
    { w: 90, h: 36 },
    { w: 82, h: 32 },
  ];
  const base = baseSizes[Math.min(level, 3)];
  const charWidth = [10, 9, 8.5, 8][Math.min(level, 3)];
  const minPadding = [20, 16, 14, 12][Math.min(level, 3)];
  const calcWidth = Math.max(title.length, 2) * charWidth + minPadding;
  return {
    w: Math.max(base.w, Math.min(calcWidth, [180, 150, 130, 110][Math.min(level, 3)])),
    h: base.h,
  };
}

function getNodeChildren(node: MindMapNode): MindMapNode[] {
  return node.children || [];
}

function isLeaf(node: MindMapNode): boolean {
  return getNodeChildren(node).length === 0;
}

function measureNode(
  node: MindMapNode,
  level: number,
  descHeights: Record<string, number> = {},
  descId = ''
): MeasuredNode {
  const children = getNodeChildren(node);
  const size = calculateNodeSize(node.title, level);
  const hasDesc = isLeaf(node) && !!node.description;
  const estimatedDescSize = hasDesc ? calculateDescSize(node.description!) : { w: 0, h: 0 };
  const realDescH = hasDesc && descId ? descHeights[descId] : undefined;
  const descSize = hasDesc
    ? { w: estimatedDescSize.w, h: realDescH ?? estimatedDescSize.h }
    : { w: 0, h: 0 };

  const measuredChildren = children.map((c, i) =>
    measureNode(c, level + 1, descHeights, descId ? `${descId}-${i}` : `root-${i}`)
  );

  let subtreeH: number;
  let subtreeW: number;
  let topOffset: number;
  let bottomOffset: number;

  if (children.length === 0) {
    if (hasDesc) {
      subtreeH = Math.max(size.h, descSize.h);
      subtreeW = size.w + DESC_GAP + descSize.w;
    } else {
      subtreeH = size.h;
      subtreeW = size.w;
    }
    topOffset = subtreeH / 2;
    bottomOffset = subtreeH / 2;
  } else {
    const gap = LEVEL_GAPS[Math.min(level, 3)];
    const childrenTotalH = measuredChildren.reduce(
      (sum, c) => sum + c.subtreeH + NODE_SPACING,
      -NODE_SPACING
    );

    // 子树高度必须**至少**等于节点自身高度：子节点少而节点本身高时，
    // 只按"子节点总高"算会让兄弟节点的子树带互相重叠，父节点也被顶到带外。
    // 节点中心落在整条子树带的正中央（topOffset = subtreeH / 2），
    // 这样 `layoutMeasuredNode` 里 `startY + child.topOffset` 才是"该子树带的中点"。
    subtreeH = Math.max(size.h, childrenTotalH);
    subtreeW = size.w + gap + Math.max(...measuredChildren.map((c) => c.subtreeW));

    topOffset = subtreeH / 2;
    bottomOffset = subtreeH / 2;
  }

  return {
    node,
    level,
    descId,
    size,
    descSize,
    subtreeW,
    subtreeH,
    topOffset,
    bottomOffset,
    hasDesc,
    children: measuredChildren,
  };
}

/** 三次贝塞尔连线：从父节点边缘到子节点边缘，水平出、水平入 */
function buildConnectionPath(
  parentX: number, parentY: number, parentW: number,
  childX: number, childY: number, childW: number,
  dirX: number
): string {
  const parentEdgeX = parentX + dirX * parentW / 2;
  const childEdgeX = childX - dirX * childW / 2;
  const dx = Math.abs(childEdgeX - parentEdgeX);
  const cp1x = parentEdgeX + dirX * dx * 0.5;
  const cp2x = childEdgeX - dirX * dx * 0.5;
  return `M${parentEdgeX} ${parentY} C${cp1x} ${parentY}, ${cp2x} ${childY}, ${childEdgeX} ${childY}`;
}

function layoutMeasuredNode(
  mNode: MeasuredNode,
  x: number,
  y: number,
  dirX: number,
  positioned: PositionedNode[],
  lines: Line[]
) {
  const { node, level, size, hasDesc, children } = mNode;

  const pNode: PositionedNode = {
    id: node.id,
    title: node.title,
    description: hasDesc ? node.description : undefined,
    x: x - size.w / 2,
    y: y - size.h / 2,
    w: size.w,
    h: size.h,
    level,
    descId: hasDesc ? mNode.descId : undefined,
  };

  if (hasDesc) {
    pNode.descX = x + dirX * (size.w / 2 + DESC_GAP + mNode.descSize.w / 2);
    pNode.descY = y;
    pNode.descW = mNode.descSize.w;
    pNode.descH = mNode.descSize.h;
  }

  positioned.push(pNode);

  if (children.length > 0) {
    const gap = LEVEL_GAPS[Math.min(level, 3)];
    const totalSpan = children.reduce(
      (sum, c) => sum + c.subtreeH + NODE_SPACING,
      -NODE_SPACING
    );
    let startY = y - totalSpan / 2;

    children.forEach(child => {
      const childCenterY = startY + child.topOffset;
      const childNodeX = x + dirX * (size.w / 2 + gap + child.size.w / 2);

      lines.push({
        path: buildConnectionPath(
          x, y, size.w,
          childNodeX,
          childCenterY,
          child.size.w,
          dirX
        ),
      });

      layoutMeasuredNode(child, childNodeX, childCenterY, dirX, positioned, lines);

      startY += child.subtreeH + NODE_SPACING;
    });
  }
}

/**
 * 计算思维导图布局。
 *
 * @param nodes 导图数据
 * @param descHeights 浏览器里实测的描述盒高度。传入时用实测值（更准），
 *   不传则用按字符宽度估算的高度 —— **导出场景没有 DOM，只能用估算**。
 * @param originX 根节点中心的 x
 * @param originY 根节点中心的 y
 */
export function layoutMindMap(
  nodes: MindMapNode[],
  descHeights: Record<string, number> = {},
  originX = 450,
  originY = 350
): { positioned: PositionedNode[]; lines: Line[] } {
  const positioned: PositionedNode[] = [];
  const lines: Line[] = [];

  nodes.forEach((root, rootIdx) => {
    const measured = measureNode(root, 0, descHeights, `root-${rootIdx}`);
    const children = measured.children;

    const size = measured.size;
    const pNode: PositionedNode = {
      id: root.id,
      title: root.title,
      description: measured.hasDesc ? root.description : undefined,
      x: originX - size.w / 2,
      y: originY - size.h / 2,
      w: size.w,
      h: size.h,
      level: 0,
      descId: measured.hasDesc ? measured.descId : undefined,
    };
    if (measured.hasDesc) {
      pNode.descX = originX + (size.w / 2 + DESC_GAP + measured.descSize.w / 2);
      pNode.descY = originY;
      pNode.descW = measured.descSize.w;
      pNode.descH = measured.descSize.h;
    }
    positioned.push(pNode);

    const total = children.length;
    const rightCount = Math.ceil(total / 2);
    const rightChildren = children.slice(0, rightCount);
    const leftChildren = children.slice(rightCount);

    const rightSpan = rightChildren.reduce(
      (sum, c) => sum + c.subtreeH + NODE_SPACING,
      -NODE_SPACING
    );
    let rightY = originY - rightSpan / 2;
    const gap = LEVEL_GAPS[0];
    rightChildren.forEach(child => {
      const childCenterY = rightY + child.topOffset;
      const childNodeX = originX + size.w / 2 + gap + child.size.w / 2;

      lines.push({
        path: buildConnectionPath(
          originX, originY, size.w,
          childNodeX,
          childCenterY,
          child.size.w,
          1
        ),
      });

      layoutMeasuredNode(child, childNodeX, childCenterY, 1, positioned, lines);
      rightY += child.subtreeH + NODE_SPACING;
    });

    const leftSpan = leftChildren.reduce(
      (sum, c) => sum + c.subtreeH + NODE_SPACING,
      -NODE_SPACING
    );
    let leftY = originY - leftSpan / 2;
    leftChildren.forEach(child => {
      const childCenterY = leftY + child.topOffset;
      const childNodeX = originX - size.w / 2 - gap - child.size.w / 2;

      lines.push({
        path: buildConnectionPath(
          originX, originY, size.w,
          childNodeX,
          childCenterY,
          child.size.w,
          -1
        ),
      });

      layoutMeasuredNode(child, childNodeX, childCenterY, -1, positioned, lines);
      leftY += child.subtreeH + NODE_SPACING;
    });
  });

  return { positioned, lines };
}

/** 布局内容的包围盒（导出时用来等比缩放铺满横向页） */
export function mindMapBounds(positioned: PositionedNode[]) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  positioned.forEach((n) => {
    minX = Math.min(minX, n.x);
    maxX = Math.max(maxX, n.x + n.w);
    minY = Math.min(minY, n.y);
    maxY = Math.max(maxY, n.y + n.h);
    if (n.descX !== undefined && n.descW !== undefined) {
      minX = Math.min(minX, n.descX - n.descW / 2);
      maxX = Math.max(maxX, n.descX + n.descW / 2);
    }
    if (n.descY !== undefined && n.descH !== undefined) {
      minY = Math.min(minY, n.descY - n.descH / 2);
      maxY = Math.max(maxY, n.descY + n.descH / 2);
    }
  });
  if (!Number.isFinite(minX)) return { minX: 0, minY: 0, width: 1, height: 1 };
  return { minX, minY, width: Math.max(1, maxX - minX), height: Math.max(1, maxY - minY) };
}

/** 解析 SVG path 的 `M x y C ...` 为坐标序列（导出 PDF 时要自己画贝塞尔） */
export function parseConnectionPath(path: string): {
  start: [number, number];
  controls: [[number, number], [number, number]];
  end: [number, number];
} | null {
  const m = /^M\s*([\d.-]+)\s+([\d.-]+)\s+C\s*([\d.-]+)\s+([\d.-]+)\s*,\s*([\d.-]+)\s+([\d.-]+)\s*,\s*([\d.-]+)\s+([\d.-]+)$/.exec(path);
  if (!m) return null;
  return {
    start: [+m[1], +m[2]],
    controls: [[+m[3], +m[4]], [+m[5], +m[6]]],
    end: [+m[7], +m[8]],
  };
}