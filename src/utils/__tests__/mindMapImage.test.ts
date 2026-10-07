import { describe, it, expect } from 'vitest';
import { renderMindMapImage, type CanvasCtx } from '../canvasRenderer';
import type { MindMapNode } from '../../types';

/**
 * 思维导图独立图片 —— Word 附录页用的「从画布截图」。
 *
 * 这里用桩 ctx 跑，验证的是**布局 → 绘制的调用链**和图像格式选择：
 * 真实栅格化像素没有断言的价值（那是浏览器的事，端到端探针里看）。
 *
 * 两个出口（PDF 横向页 / Word 内嵌图）共用 `paintMindMap`，
 * 所以这里断言的"画了什么"等价于 PDF 导图页会画什么。
 */
interface Recorder {
  texts: string[];
  rects: number;
  beziers: number;
  dims: { w: number; h: number; landscape: boolean } | null;
}

function stubCtx(withPng: boolean) {
  const rec: Recorder = { texts: [], rects: 0, beziers: 0, dims: null };
  const createCtx = (widthPt: number, heightPt: number, landscape = false): CanvasCtx => {
    rec.dims = { w: widthPt, h: heightPt, landscape };
    const ctx: CanvasCtx = {
      pageWidthPt: widthPt,
      pageHeightPt: heightPt,
      landscape,
      measureText: (text: string, fontSizePx: number) => {
        let w = 0;
        for (const ch of text) w += ch.charCodeAt(0) > 0x2e80 ? fontSizePx : fontSizePx * 0.55;
        return w;
      },
      fillText: (text) => {
        rec.texts.push(text);
      },
      fillRect: () => {
        rec.rects++;
      },
      drawLine: () => {
        rec.rects++;
      },
      drawBezier: () => {
        rec.beziers++;
      },
      toJpeg: () => ({
        bytes: new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]),
        width: 10,
        height: 10,
      }),
    };
    if (withPng) {
      ctx.toPng = () => ({
        bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        width: 10,
        height: 10,
      });
    }
    return ctx;
  };
  return { createCtx, rec };
}

function sample(): MindMapNode[] {
  return [
    {
      id: 'root',
      title: '复数',
      level: 'root',
      children: [
        {
          id: 'a',
          title: '代数形式',
          level: 'branch',
          children: [
            // ⚠️ 描述只画在**叶子**节点上（layoutMindMap 的 hasDesc = isLeaf && description），
            // 所以公式降级的样本必须挂在最底层，否则这条断言永远碰不到描述盒
            { id: 'a1', title: '共轭与模', level: 'leaf', description: '设 $z=a+bi$，其中 $i^2=-1$' },
          ],
        },
        { id: 'b', title: '几何意义', level: 'branch' },
      ],
    },
  ];
}

describe('导图图片 — 格式选择', () => {
  it('ctx 支持 toPng 时出 PNG（文字锐利，Word 里缩放后才不糊）', () => {
    const { createCtx } = stubCtx(true);
    const out = renderMindMapImage(sample(), createCtx);

    expect(out.mime).toBe('image/png');
    expect(Array.from(out.bytes.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47]);
  });

  it('只有 toJpeg 时退回 JPEG（不能因为没 PNG 就出不了图）', () => {
    const { createCtx } = stubCtx(false);
    const out = renderMindMapImage(sample(), createCtx);

    expect(out.mime).toBe('image/jpeg');
    expect(out.bytes.length).toBeGreaterThan(0);
    expect(out.bytes[0]).toBe(0xff);
  });
});

describe('导图图片 — 内容真的画上去了', () => {
  it('节点标题、连线、形状都落到画布上', () => {
    const { createCtx, rec } = stubCtx(true);
    renderMindMapImage(sample(), createCtx);

    expect(rec.texts).toContain('复数');
    expect(rec.texts).toContain('代数形式');
    expect(rec.beziers).toBeGreaterThan(0);
    // 根 + 子 + 描述盒，至少三块
    expect(rec.rects).toBeGreaterThanOrEqual(3);
  });

  it('描述里的公式降级成可读文本（位图页没有 KaTeX，不降级会把 $ 源码拍进图）', () => {
    const { createCtx, rec } = stubCtx(true);
    renderMindMapImage(sample(), createCtx);
    const all = rec.texts.join('\n');

    expect(all).toContain('z=a+bi');
    expect(all).not.toContain('$');
  });

  it('深一层子节点也在（层级没被截断）', () => {
    const { createCtx, rec } = stubCtx(true);
    renderMindMapImage(sample(), createCtx);

    expect(rec.texts).toContain('共轭与模');
  });
});

describe('导图图片 — 尺寸契约', () => {
  it('报出的 pt 尺寸与画布创建尺寸一致（调用方按它算 wp:extent）', () => {
    const { createCtx, rec } = stubCtx(true);
    const out = renderMindMapImage(sample(), createCtx);

    expect(rec.dims).toEqual({ w: out.widthPt, h: out.heightPt, landscape: out.widthPt >= out.heightPt });
  });

  it('尺寸有限且为正（NaN 会让 Word 拿到 cx="NaN" 直接损坏）', () => {
    const { createCtx } = stubCtx(true);
    const out = renderMindMapImage(sample(), createCtx);

    expect(Number.isFinite(out.widthPt)).toBe(true);
    expect(Number.isFinite(out.heightPt)).toBe(true);
    expect(out.widthPt).toBeGreaterThan(0);
    expect(out.heightPt).toBeGreaterThan(0);
  });

  it('横向导图的图也是横向的（不做纵横翻转）', () => {
    const { createCtx } = stubCtx(true);
    const wide: MindMapNode[] = Array.from({ length: 5 }, (_, i) => ({
      id: `r${i}`,
      title: `分支主题 ${i}`,
      level: 'root' as const,
      children: [{ id: `c${i}`, title: `子项 ${i}`, level: 'leaf' as const }],
    }));
    const out = renderMindMapImage(wide, createCtx);

    expect(out.widthPt).toBeGreaterThan(out.heightPt);
  });
});
