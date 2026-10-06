import { describe, it, expect } from 'vitest';
import { buildKnowledgePdf, type CanvasCtxFactory } from '../exportPdf';
import type { CanvasCtx } from '../canvasRenderer';
import type { GeneratedKnowledge } from '../../types';

/**
 * PDF 导出回归 —— 锁住用户实测反馈的两条核心诉求。
 *
 * 背景（用户拿产物做对照，前后两轮反馈）：
 *  1. "打印 pdf 文字不可复制" → 打印产出的是位图 PDF（0 字体 0 文本）
 *  2. "完全剔除了思维导图等图片" → 导图在正文里退化成缩进列表，连线与框全丢
 *  3. "公式没渲染，pdf 看不见" → v1.8.0 的**非嵌字体矢量 PDF 在 Windows 上整页空白**
 *     （STSong-Light + UniGB-UCS2-H 结构完全合规，但 Chrome/Edge/pdf.js 都没有
 *     可用的 CJK 字形，155 个 Tj 全画不出字）
 *
 * 现行方案 = **每页一张位图（浏览器渲染，系统字库）+ 一层隐形文字**：
 *  - 位图保证"看得见"（不依赖阅读器字体）；
 *  - 隐形文字（渲染模式 `3 Tr`）保证"复制得到 / 搜得到"。
 * 两者缺一，上面 1 或 3 就会回归。所以本文件的断言就是这两条。
 */

/**
 * 测试用 canvas 上下文替身。
 *
 * **为什么必须注入替身**：生产工厂要 `document.createElement('canvas')`，
 * Node 里没有 DOM（此前测试直接调 `buildKnowledgePdf` → "2d context unavailable"
 * 全部失败）。`renderKnowledgePages` 的 ctx 工厂参数就是为此留的缝。
 *
 * `toJpeg` 刻意返回**头 8 字节完全相同**的假 JPEG — 真实 JPEG 就是这样
 * （前 8 字节是同一段 JFIF 标记）。曾经的去重 key 用"尺寸 + 头 8 字节"，
 * 于是同尺寸的每一页都算成同一张图，整份 PDF 只剩一张位图、第 2 页起
 * 全部复用第 1 页 —— 这个替身能让那个 bug 立刻现形。
 */
function stubFactory(): { factory: CanvasCtxFactory; pages: number[] } {
  const pages: number[] = [];
  const factory: CanvasCtxFactory = (widthPt, heightPt, landscape): CanvasCtx => {
    const id = pages.length + 1;
    pages.push(id);
    const canvas = new Uint8Array(128);
    // 统一 JPEG SOI + APP0/JFIF 头（FF D8 FF E0 00 10 4A 46）
    canvas.set([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46], 0);
    canvas[20] = id; // 真正的差异藏在头 8 字节之后
    return {
      pageWidthPt: widthPt,
      pageHeightPt: heightPt,
      landscape,
      measureText: (text: string, fontSizePx: number) => {
        let w = 0;
        for (const ch of text) w += ch.charCodeAt(0) > 0x2e80 ? fontSizePx : fontSizePx * 0.55;
        return w;
      },
      fillText() {},
      fillRect() {},
      drawLine() {},
      drawBezier() {},
      toJpeg() {
        return { bytes: canvas, width: Math.round(widthPt * 2), height: Math.round(heightPt * 2) };
      },
    };
  };
  return { factory, pages };
}

/**
 * 用 pdfjs 加载 PDF。
 *
 * **必须给 cMapUrl**：本生成器用 UniGB-UCS2-H 编码，pdfjs 在 Node 下没有内置
 * 这张 CMap，不给就报 "translateFont failed" 并把整页文字提取成空 ——
 * 那时页面数仍读得出来，测试看着"通过"，但**文字可复制性完全没被验证到**。
 * 这正是最要避免的假绿：测试通过了，用户的复制功能却是坏的。
 */
async function loadPdf(bytes: Uint8Array) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  // 不用 node:path —— 项目没装 @types/node，import 会让 tsc 失败。
  // 相对路径在这里可用：vitest 的 cwd 是项目根。
  const cmaps = 'node_modules/pdfjs-dist/cmaps/';
  return pdfjs.getDocument({ data: bytes.slice(), cMapUrl: cmaps, cMapPacked: true }).promise;
}

/** pdfjs 的 TextItem 有 `str`，TextMarkedContent 没有 —— 收窄一次省得各处 cast */
async function pageText(doc: { getPage: (n: number) => Promise<any>; numPages: number }): Promise<string> {
  let all = '';
  for (let i = 1; i <= doc.numPages; i++) {
    const tc = await (await doc.getPage(i)).getTextContent();
    all += tc.items.map((it: unknown) => (it as { str?: string }).str ?? '').join('\n');
  }
  return all;
}

/** 从 PDF 字节里读出每页引用了哪些 image XObject（用于"每页是独立位图"的断言）。 */
function pageImageRefs(s: string): string[][] {
  return [...s.matchAll(/\/XObject << ([^\]]*?) >>/g)].map((m) =>
    [...m[1].matchAll(/\/X\w+ (\d+) 0 R/g)].map((x) => x[1])
  );
}

const longSummary =
  '复数是实数的扩充，引入虚数单位 $i$ 使得所有二次方程都有解，属于代数学基础分支。' +
  '学习中需要掌握代数表示、几何意义、共轭与模、四则运算，并按此顺序递进，' +
  '同时注意虚部是实数 $b$ 而不是 $bi$，两个复数在虚部非零时不能比较大小。';

/** 生成 n 个概念，用来把正文撑到多页（页数相关断言的输入必须够长）。 */
function concepts(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    type: 'definition' as const,
    title: `概念 ${i + 1}`,
    content: {
      elementary: `第 ${i + 1} 个概念的初等解释：$i \\times i=-1$，其中 $a,b \\in \\mathbb{R}$。`,
      advanced: `第 ${i + 1} 个概念的高等解释：设 $z_1=a+bi$，$z_2=c+di$，则 $z_1 z_2=(ac-bd)+(ad+bc)i$。`,
    },
    notation: 'z=a+bi \\quad (a,b \\in \\mathbb{R})',
    keyPoints: [`要点一 ${i + 1}：$\\frac{z_1}{z_2} = \\frac{z_1 \\overline{z_2}}{z_2 \\overline{z_2}}$。`],
  }));
}

const sample = (): GeneratedKnowledge => ({
  topic: '复数',
  summary: longSummary,
  conceptsOverview: '复数是通过引入虚数单位将实数系扩充而来的代数对象，是代数学的基础分支之一。',
  mindMap: [
    {
      id: 'root',
      title: '复数',
      level: 'root',
      children: [
        {
          id: 'b1',
          title: '基本概念',
          level: 'branch',
          children: [
            { id: 'l1', title: '虚数单位', level: 'leaf', description: '满足 i² = -1 的特殊数。' },
            { id: 'l2', title: '代数形式', level: 'leaf', description: 'z = a + bi。' },
          ],
        },
        {
          id: 'b2',
          title: '几何意义',
          level: 'branch',
          children: [
            { id: 'l3', title: '复平面', level: 'leaf' },
            { id: 'l4', title: '模与辐角', level: 'leaf', description: '|z| 表示到原点的距离。' },
          ],
        },
      ],
    },
  ],
  concepts: concepts(8),
  examples: [],
  relatedResults: [],
  knowledgeContext: { prerequisites: ['实数'], relatedTopics: ['棣莫弗定理'], learningPath: ['掌握代数形式'] },
  examQuestions: [
    {
      id: 'q1',
      type: 'choice',
      question: '已知复数 $z=\\frac{2}{1-i}$，则虚部为（ ）',
      options: ['-1', '1', '-i', 'i'],
      answer: 'B',
      explanation: '$z = 1 + i$，虚部为 1。',
      difficulty: 'easy',
      source: { year: '2022', exam: '全国高考', section: '甲卷' },
    },
  ],
  interestingFacts: [{ id: 'f1', title: '从幽灵到工具', content: '卡尔达诺称负数开方为诡辩量。', type: 'history' }],
});

function pdf(): { bytes: Uint8Array; s: string } {
  const bytes = buildKnowledgePdf(sample(), stubFactory().factory);
  return { bytes, s: new TextDecoder('latin1').decode(bytes) };
}

describe('知识笔记 PDF — 每页是独立位图（看得见的前提）', () => {
  it('页面超过一页时，每页各引用一张自己的位图（去重 key 必须覆盖全部字节）', () => {
    const { bytes, s } = pdf();
    const refs = pageImageRefs(s);
    expect(refs.length).toBeGreaterThanOrEqual(2); // 正文确实跨页了，断言才有意义

    const portraitRefs = refs.filter((r) => r.length > 0);
    expect(portraitRefs.length).toBeGreaterThanOrEqual(2);
    // 关键不变量：引用到的 xObject 互不相同
    const flat = portraitRefs.flat();
    expect(new Set(flat).size).toBe(flat.length);

    // 且字节里真的存了这么多张图
    const imageObjs = (s.match(/\/Subtype \/Image/g) || []).length;
    expect(imageObjs).toBeGreaterThanOrEqual(new Set(flat).size);
    expect(bytes.byteLength).toBeGreaterThan(0);
  });

  it('每张位图都是整页铺满的 DCTDecode（JPEG），不是矢量文字', () => {
    const { s } = pdf();
    expect(s).toContain('/Filter /DCTDecode');
    expect(s).toContain('/ColorSpace /DeviceRGB');
    // 位图页的尺寸必须与 MediaBox 一致（导图页是横向 841.89x595.28）
    const boxes = [...s.matchAll(/\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/g)].map((m) => [+m[1], +m[2]]);
    expect(boxes.length).toBeGreaterThanOrEqual(2);
    // 横向页确实宽 > 高
    expect(boxes.some(([w, h]) => w > h)).toBe(true);
    expect(boxes[0][1]).toBeGreaterThan(boxes[0][0]); // 第一页纵向
  });
});

describe('知识笔记 PDF — 文字可复制（位图页必须补隐形文字层）', () => {
  it('内容流里有隐形文字（渲染模式 3 Tr）+ hex 编码的中文', () => {
    const { s } = pdf();
    expect(s).toContain('3 Tr');
    // 中文以 UTF-16BE hex 写入（latin1 硬塞会变乱码）
    expect(s).toMatch(/<[0-9A-F]{8,}> Tj/);
    expect(s).not.toContain('$i$');
  });

  it('pdfjs 能把正文文字提取出来（提炼不出 = 用户复制不到）', async () => {
    const doc = await loadPdf(pdf().bytes);
    const all = await pageText(doc);
    const flat = all.replace(/\s+/g, '');

    expect(flat).toContain('复数');       // 标题/正文
    expect(flat).toContain('虚数单位');   // 导图节点
    expect(flat).toContain('棣莫弗定理'); // 关联主题
    expect(flat).toContain('诡辩量');     // 趣味知识
    // 选项必须用 A/B/C/D（与页面、与 txt/md/html 出口一致，不是 1/2/3/4）
    expect(flat).toContain('A.-1B.1C.-iD.i');
  });

  it('公式降级成可读文本，不露 LaTeX 源码', async () => {
    const doc = await loadPdf(pdf().bytes);
    const all = await pageText(doc);

    expect(all).not.toMatch(/\$[^$\n]*\$/);   // 围符
    expect(all).not.toContain('\\frac');      // 裸 LaTeX 命令
    expect(all).not.toContain('\\mathbb');    // notation 字段（无围符）
    expect(all).not.toContain('quad');
    expect(all.replace(/\s+/g, '')).toContain('∈ℝ'); // 降级后的可读符号在
    expect(all).toContain('i²');              // i^2 → i²
  });

  it('ToUnicode CMap 覆盖正文中出现的每个汉字（漏字= 那个字复制不出来）', () => {
    const { s } = pdf();
    const cmap = /beginbfchar([\s\S]*?)endbfchar/.exec(s)?.[1] ?? '';
    ['复', '数', '实', '扩', '充', '二', '次', '方', '程'].forEach((ch) => {
      const code = ch.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0');
      expect(cmap).toContain(code);
    });
  });

  it('声明 CJK 字体与 ToUnicode（隐形文字层靠它做编码→Unicode 映射）', () => {
    const { s } = pdf();
    expect(s).toContain('/Subtype /Type0');
    expect(s).toContain('/Encoding /UniGB-UCS2-H');
    expect(s).toContain('/ToUnicode');
    // 位图已经带字形了，字体**不需要**嵌入 —— 体积不因中文膨胀
    expect(s).not.toContain('FontFile');
    expect(s).not.toContain('FontFile2');
    expect(s).not.toContain('FontFile3');
  });

  it('生成的 PDF 以 %PDF- 开头且结构完整', () => {
    const { s } = pdf();
    expect(s.startsWith('%PDF-1.7')).toBe(true);
    expect(s).toContain('trailer');
    expect(s).toContain('startxref');
    expect(s.trimEnd().endsWith('%%EOF')).toBe(true);
  });
});

describe('知识笔记 PDF — 位图流的字节对齐与字号单位（都是"看得见但看不清"的坑）', () => {
  /**
   * 回归：image 对象在 `stream\n` 之后**多写了一个换行**。
   * 那个 0x0A 会成为流数据的第一个字节，而 /Length 仍按 JPEG 原长声明 ——
   * 解码器读到的其实是"前导换行 + JPEG 少一个字节"（实测尾部 EOI 的 D9 被吃掉）。
   * 判据：紧跟 `stream\n` 的必须是 JPEG 的 SOI（FF D8），且按声明长度切完正好接 `endstream`。
   */
  it('每张位图流都从 JPEG 的 SOI 开始，且 /Length 与真实字节数一致', () => {
    const { bytes } = pdf();
    const latin = new TextDecoder('latin1').decode(bytes);
    const re = /\/Filter \/DCTDecode \/Length (\d+) >>\nstream\n/g;

    const found: { declared: number; first: number[]; tail: string }[] = [];
    for (const m of latin.matchAll(re)) {
      const declared = Number(m[1]);
      const start = m.index! + m[0].length;
      found.push({
        declared,
        first: [bytes[start], bytes[start + 1]],
        tail: latin.slice(start + declared, start + declared + 10),
      });
    }

    expect(found.length).toBeGreaterThanOrEqual(2); // 确实有多个位图，断言才有意义
    for (const f of found) {
      expect(f.first).toEqual([0xff, 0xd8]);            // 不是 [0x0a, 0xff]
      expect(f.tail.startsWith('\nendstream')).toBe(true); // 声明长度正好覆盖整张图
    }
  });

  /**
   * 回归：`layoutSegs` 按 pt 排版（`seg.size * PT_TO_PX`），`drawSegs` 却把 `seg.size`
   * 当 px 画 —— 所有显式给了 `size` 的片段都缩到 0.375×：标题 20pt 画成 20px、
   * 小节标题 14pt 画成 14px、选项字母 10px、出处小字 9px。行盒仍按正常字号预留，
   * 于是导出的 PDF 里小节标题与选项字母小到看不清、还悬在行盒上半空。
   *
   * 判据：写进 PDF 的字号（`Tf`）必须是排版时用的那个 pt 值。
   */
  it('字号单位与排版一致：标题/正文写进 PDF 的是 pt，不是被缩小的 px', () => {
    const { s } = pdf();
    const sizes = [...s.matchAll(/\/F_CJK ([\d.]+) Tf/g)].map((m) => Number(m[1]));
    const uniq = [...new Set(sizes.map((v) => Math.round(v * 100) / 100))].sort((a, b) => a - b);

    // Block 模型里显式用到的 pt 字号必须原样落到 PDF：
    // 20 标题 / 14 小节标题 / 11.5 二级小节 / 10.5 正文 / 10 列表序号 / 9 出处小字
    for (const pt of [20, 14, 11.5, 10.5, 10, 9]) expect(uniq).toContain(pt);
    // 缩水值一律不许出现（这就是它们 ÷ PT_TO_PX 的结果）
    for (const shrunk of [7.5, 5.25, 4.3125, 3.75, 3.375]) expect(uniq).not.toContain(shrunk);
  });
  it('没有"孤行标题"：除最后一页外，每页最后一行都不是标题字号（keep with next）', async () => {
    const doc = await loadPdf(pdf().bytes);

    const offenders: string[] = [];
    for (let i = 1; i <= doc.numPages - 1; i++) {
      const page = await doc.getPage(i);
      const tc = await page.getTextContent();
      const items = tc.items.filter((it: unknown) => typeof (it as { str?: string }).str === 'string' && (it as { str: string }).str.trim());
      const last = items[items.length - 1] as { str: string; transform: number[] } | undefined;
      if (!last) continue;
      // 本文件里 Tm 无缩放，transform[3] 就是写进内容流的字号
      const size = last.transform[3];
      if (size > 10.6) offenders.push(`p${i} 末行 ${size}pt ${JSON.stringify(last.str.slice(0, 20))}`);
    }

    expect(offenders).toEqual([]);
  });
});

describe('知识笔记 PDF — 思维导图横向独占一页（用户反馈的第二个缺陷）', () => {
  it('有横向页且导图文字进了那一页的文字层', async () => {
    const doc = await loadPdf(pdf().bytes);

    const orientation: string[] = [];
    let mindMapPageFound = false;
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const vp = page.getViewport({ scale: 1 });
      orientation.push(vp.width > vp.height ? 'landscape' : 'portrait');
      if (i === doc.numPages) {
        const tc = await page.getTextContent();
        const flat = tc.items.map((it: unknown) => (it as { str?: string }).str ?? '').join('').replace(/\s+/g, '');
        // 节点标题可能因框宽而折行，所以按"去空白"比对
        mindMapPageFound = flat.includes('虚数单位') && flat.includes('基本概念');
      }
    }

    expect(orientation[0]).toBe('portrait'); // 正文纵向
    expect(orientation.length).toBeGreaterThan(1); // 导图另起一页
    expect(orientation[orientation.length - 1]).toBe('landscape'); // 末页横向
    expect(mindMapPageFound).toBe(true);
  });

  it('横向页的画布尺寸真的是横向（宽高被交换过一次就等于没换）', () => {
    const dims: string[] = [];
    const factory = stubFactory();
    const recording: CanvasCtxFactory = (w, h, l) => {
      dims.push(`${w}x${h}:${l ? 'L' : 'P'}`);
      return factory.factory(w, h, l);
    };
    buildKnowledgePdf(sample(), recording);

    expect(dims.length).toBeGreaterThanOrEqual(2);
    const [w, h] = dims[dims.length - 1].split(':')[0].split('x').map(Number);
    expect(w).toBeGreaterThan(h);            // 导图页画布必须宽 > 高
    expect(dims[dims.length - 1]).toContain(':L');
    const [pw, ph] = dims[0].split(':')[0].split('x').map(Number);
    expect(ph).toBeGreaterThan(pw);          // 正文页纵向
  });

  it('没有思维导图时不产生空白横向页', () => {
    const bytes = buildKnowledgePdf({ ...sample(), mindMap: [] }, stubFactory().factory);
    const s = new TextDecoder('latin1').decode(bytes);
    const boxes = [...s.matchAll(/\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/g)].map((m) => [+m[1], +m[2]]);
    expect(boxes.every(([w, h]) => h > w)).toBe(true);
  });
});
