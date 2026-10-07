import { describe, it, expect } from 'vitest';
import {
  collectKnowledgeFigures,
  svgWithIntrinsicSize,
  type FigureLoader,
} from '../exportFigures';
import type { GeneratedKnowledge } from '../../types';

/**
 * 导出示意图采集。
 *
 * 这层的价值全在**取舍**上：三种图源（base64 直出 / 远程直链 / 手绘 SVG）
 * 里，哪一种能拿到字节、哪一种拿不到、拿不到时怎样降级。而这些在浏览器里
 * 的失败方式是静默的 —— 图不出现，没有任何报错。所以必须用替身把三种情况
 * 都钉死。
 *
 * 用 stub loader 而不是真 canvas：Node 里没有 `document.createElement('canvas')`，
 * 真实现会让测试变成"测浏览器"。
 */

/** 1×1 的真 PNG（base64），保证 dataUrlToBytes 解出来是非空字节 */
const PNG_1X1 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

interface LoaderStub extends FigureLoader {
  decoded: string[];
  rasterCalls: number;
}

/** 记录被解码/栅格化的图源；`blocked` 里的子串会让 decode 失败（模拟跨域被挡） */
function stubLoader(blocked: string[] = []): LoaderStub {
  const stub: LoaderStub = {
    decoded: [],
    rasterCalls: 0,
    async decode(src: string) {
      stub.decoded.push(src);
      if (blocked.some((b) => src.includes(b))) throw new Error('figure load failed');
      return { image: { stub: true }, width: 800, height: 500 };
    },
    rasterize() {
      stub.rasterCalls += 1;
      return `data:image/png;base64,${PNG_1X1}`;
    },
  };
  return stub;
}

function knowledge(
  concepts: Array<{ title: string; image?: string; imageData?: string; svg?: string }>,
  examQuestions: Array<{ image?: string; imageData?: string; svg?: string }> = []
): GeneratedKnowledge {
  return {
    topic: '复数',
    mindMap: [],
    concepts,
    examples: [],
    relatedResults: [],
    knowledgeContext: { prerequisites: [], relatedTopics: [], learningPath: [] },
    examQuestions,
    interestingFacts: [],
  } as unknown as GeneratedKnowledge;
}

describe('exportFigures — 三种图源的取舍', () => {
  it('imageData（base64 直出）直接取原始字节，不重编码', async () => {
    const loader = stubLoader();
    const src = `data:image/png;base64,${PNG_1X1}`;
    const figs = await collectKnowledgeFigures(knowledge([{ title: '复平面', imageData: src }]), loader);

    const fig = figs.get('concept:0')!;
    expect(fig).toBeTruthy();
    expect(fig.ext).toBe('png');
    expect(fig.bytes.length).toBeGreaterThan(0);
    // 原始 data URL 原样带走 —— HTML 出口直接内联它，不重新编一遍 base64
    expect(fig.dataUrl).toBe(src);
    expect(fig.caption).toBe('复平面');
    expect(fig.aspect).toBeCloseTo(800 / 500, 3);
    // 已经是位图，不该走栅格化
    expect(loader.rasterCalls).toBe(0);
  });

  it('svg（模型手绘）必须栅格化：Word 的 DrawingML 不认 SVG', async () => {
    const loader = stubLoader();
    const figs = await collectKnowledgeFigures(
      knowledge([{ title: '示意图', svg: '<svg viewBox="0 0 400 200"><line x1="0" y1="0" x2="10" y2="10"/></svg>' }]),
      loader
    );

    const fig = figs.get('concept:0')!;
    expect(fig.ext).toBe('png');
    expect(loader.rasterCalls).toBe(1);
    // 送进解码的应该是 data URL 形态的 SVG，而不是源码本身
    expect(loader.decoded[0].startsWith('data:image/svg+xml')).toBe(true);
  });

  it('不安全 / 不完整的 SVG 直接不采集（交给 sanitizeInlineSvg 拦）', async () => {
    const loader = stubLoader();
    const figs = await collectKnowledgeFigures(
      knowledge([
        { title: '注入', svg: '<svg viewBox="0 0 10 10"><script>alert(1)</script></svg>' },
        { title: '没有尺寸', svg: '<svg><circle r="5"/></svg>' },
      ]),
      loader
    );

    expect(figs.size).toBe(0);
    expect(loader.decoded).toHaveLength(0);
  });

  it('远程直链拿不到时**不进 map**（调用方退化成提示行，而不是假装没图）', async () => {
    const loader = stubLoader(['cdn.example.com']);
    const figs = await collectKnowledgeFigures(
      knowledge([{ title: '权威图', image: 'https://cdn.example.com/a.png' }]),
      loader
    );

    expect(figs.has('concept:0')).toBe(false);
  });

  it('单张图失败不影响其他图（导出不能因为配图失败而整份失败）', async () => {
    const loader = stubLoader(['cdn.example.com']);
    const figs = await collectKnowledgeFigures(
      knowledge([
        { title: '能拿到', imageData: `data:image/png;base64,${PNG_1X1}` },
        { title: '拿不到', image: 'https://cdn.example.com/b.png' },
        { title: '也能拿到', imageData: `data:image/jpeg;base64,${PNG_1X1}` },
      ]),
      loader
    );

    expect(figs.has('concept:0')).toBe(true);
    expect(figs.has('concept:1')).toBe(false);
    expect(figs.has('concept:2')).toBe(true);
  });

  it('key 用数据下标，两个出口才能对齐同一个位置', async () => {
    const loader = stubLoader();
    const figs = await collectKnowledgeFigures(
      knowledge(
        [{ title: 'a' }, { title: 'b', imageData: `data:image/png;base64,${PNG_1X1}` }],
        [{ imageData: `data:image/png;base64,${PNG_1X1}` }, {}]
      ),
      loader
    );

    expect([...figs.keys()].sort()).toEqual(['concept:1', 'question:0']);
  });

  it('没有图的字段不产生 key（别把空槽位也占上）', async () => {
    const loader = stubLoader();
    const figs = await collectKnowledgeFigures(knowledge([{ title: '纯文字' }]), loader);

    expect(figs.size).toBe(0);
  });
});

describe('exportFigures — SVG 尺寸推导', () => {
  it('只有 viewBox 时补出 width/height（否则浏览器给 300×150 默认值，栅格化必糊）', () => {
    const r = svgWithIntrinsicSize('<svg viewBox="0 0 320 240"><rect/></svg>');

    expect(r.width).toBe(320);
    expect(r.height).toBe(240);
    expect(r.svg).toContain('width="320"');
    expect(r.svg).toContain('height="240"');
  });

  it('已有 width/height 时不改（尊重模型给的原始尺寸）', () => {
    const r = svgWithIntrinsicSize('<svg width="100" height="50" viewBox="0 0 320 240"><rect/></svg>');

    expect(r.width).toBe(100);
    expect(r.height).toBe(50);
    expect(r.svg).not.toContain('width="320"');
  });

  it('子元素带 width/height 时不能误判成画布尺寸（实测踩过：图整体缩水一圈）', () => {
    // <rect width="300" height="180"> 是子元素的尺寸，不是画布尺寸。
    // 全局搜索会命中它 → 误以为"已有尺寸" → 跳过注入 → Chrome 给无尺寸 SVG
    // 默认的 240×150，于是 320×200 的示意图被栅格化成 240×150。
    const r = svgWithIntrinsicSize(
      '<svg viewBox="0 0 320 200" xmlns="http://www.w3.org/2000/svg"><rect width="300" height="180"/></svg>'
    );

    expect(r.width).toBe(320);
    expect(r.height).toBe(200);
    expect(r.svg).toContain('width="320"');
    expect(r.svg).toContain('height="200"');
  });

  it('width="100%" 这种百分比必须忽略，回落到 viewBox', () => {
    // 把百分比数字当像素宽度是最容易犯的错：图会被拉成 100×… 的细条
    const r = svgWithIntrinsicSize('<svg width="100%" height="100%" viewBox="0 0 640 480"><rect/></svg>');

    expect(r.width).toBe(640);
    expect(r.height).toBe(480);
  });

  it('完全没有尺寸信息时给一个安全兜底，不让调用方拿到 0 尺寸', () => {
    const r = svgWithIntrinsicSize('<svg><rect/></svg>');

    expect(r.width).toBeGreaterThan(0);
    expect(r.height).toBeGreaterThan(0);
  });
});
