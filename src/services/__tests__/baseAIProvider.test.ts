import { describe, it, expect } from 'vitest';
import {
  sanitizeConcepts,
  sanitizeKnowledgeContext,
  sanitizeExamQuestions,
  sanitizeInterestingFacts,
  sanitizeGraphData,
  toStringList,
  BaseAIProvider,
} from '../baseAIProvider';

describe('sanitizeConcepts（真实 AI 格式偏差归一化）', () => {
  it('标准格式原样保留', () => {
    const raw = [
      { type: 'formula', title: 'F=ma', content: { elementary: '力大跑得快', advanced: '加速度与合外力成正比' }, notation: 'F = ma' },
    ];
    const out = sanitizeConcepts(raw);
    expect(out).toHaveLength(1);
    expect(out[0].type).toBe('formula');
    expect(out[0].content.elementary).toBe('力大跑得快');
    expect(out[0].content.advanced).toBe('加速度与合外力成正比');
    expect(out[0].notation).toBe('F = ma');
  });

  it('content 为字符串 → 两层解释同文（不崩溃）', () => {
    const out = sanitizeConcepts([{ type: 'definition', title: '复数', content: '复数是实数的扩展' }]);
    expect(out[0].content.elementary).toBe('复数是实数的扩展');
    expect(out[0].content.advanced).toBe('复数是实数的扩展');
  });

  it('条目为纯字符串 → 转为概念对象（修复渲染崩溃）', () => {
    const out = sanitizeConcepts(['惯性定律', '牛顿第二定律']);
    expect(out).toHaveLength(2);
    expect(out[0].title).toBe('惯性定律');
    expect(out[0].content.elementary).toBeTruthy();
  });

  it('content 缺失、解释平铺在概念对象上 → 兜底提取', () => {
    const out = sanitizeConcepts([{ type: 'definition', title: 'X', elementary: '初等', advanced: '高等' }]);
    expect(out[0].content.elementary).toBe('初等');
    expect(out[0].content.advanced).toBe('高等');
  });

  it('content 只有单层 → 另一层补齐', () => {
    const out = sanitizeConcepts([{ title: 'X', content: { advanced: '只有高等' } }]);
    expect(out[0].content.elementary).toBe('只有高等');
    expect(out[0].content.advanced).toBe('只有高等');
  });

  it('type 非法 → 回退 definition；image 非 URL → 丢弃', () => {
    const out = sanitizeConcepts([{ type: 'unknown-kind', title: 'X', content: '文', image: '不是URL' }]);
    expect(out[0].type).toBe('definition');
    expect(out[0].image).toBeUndefined();
  });

  it('image 为合法 URL → 保留（含无后缀图床直链 / data:image 内联图）', () => {
    const out = sanitizeConcepts([{ title: 'X', content: '文', image: 'https://a.b/c.png' }]);
    expect(out[0].image).toBe('https://a.b/c.png');
    const out2 = sanitizeConcepts([{ title: 'Y', content: '文', image: 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Newton_Law.jpg' }]);
    expect(out2[0].image).toBe('https://upload.wikimedia.org/wikipedia/commons/a/ab/Newton_Law.jpg');
    const out3 = sanitizeConcepts([{ title: 'Z', content: '文', image: 'https://images.unsplash.com/photo-123?w=800&q=60' }]);
    expect(out3[0].image).toBe('https://images.unsplash.com/photo-123?w=800&q=60');
    // 无后缀直链（Wikimedia Special:FilePath 这类）不再被误杀
    const out4 = sanitizeConcepts([{ title: 'W', content: '文', image: 'https://commons.wikimedia.org/wiki/Special:FilePath/triangle.svg' }]);
    expect(out4[0].image).toBe('https://commons.wikimedia.org/wiki/Special:FilePath/triangle.svg');
  });

  it('概念 svg 示意图：合法保留、危险内容丢弃', () => {
    const ok = sanitizeConcepts([{ title: 'X', content: '文', svg: "<svg viewBox='0 0 320 200'><line x1='0' y1='0' x2='100' y2='100'/></svg>" }]);
    expect(ok[0].svg).toContain('<line');
    const bad = sanitizeConcepts([{ title: 'Y', content: '文', svg: "<svg viewBox='0 0 10 10'><script>alert(1)</script></svg>" }]);
    expect(bad[0].svg).toBeUndefined();
  });

  it('关键要点 / 易错提醒（含别名字段）→ 归一为字符串数组', () => {
    const out = sanitizeConcepts([{
      title: 'X',
      content: '文',
      keyPoints: ['要点一', '要点二'],
      pitfalls: ['误区一'],
    }]);
    expect(out[0].keyPoints).toEqual(['要点一', '要点二']);
    expect(out[0].pitfalls).toEqual(['误区一']);
    // 别名：points / misconceptions
    const alias = sanitizeConcepts([{ title: 'Y', content: '文', points: ['A'], misconceptions: ['B'] }]);
    expect(alias[0].keyPoints).toEqual(['A']);
    expect(alias[0].pitfalls).toEqual(['B']);
    // 空数组 → 不落字段
    const empty = sanitizeConcepts([{ title: 'Z', content: '文', keyPoints: [] }]);
    expect(empty[0].keyPoints).toBeUndefined();
  });

  it('非数组/缺 title/非对象条目 → 安全过滤', () => {
    expect(sanitizeConcepts(null)).toEqual([]);
    expect(sanitizeConcepts('abc')).toEqual([]);
    expect(sanitizeConcepts([{ content: '无标题' }, 42, null])).toEqual([]);
  });
});

describe('sanitizeKnowledgeContext', () => {
  it('标准数组原样保留', () => {
    const out = sanitizeKnowledgeContext({ prerequisites: ['A', 'B'], relatedTopics: ['C'], learningPath: ['D'] });
    expect(out.prerequisites).toEqual(['A', 'B']);
    expect(out.commonConclusions).toBeUndefined();
  });

  it('字段为顿号/逗号分隔字符串 → 拆为数组', () => {
    const out = sanitizeKnowledgeContext({ prerequisites: '受力分析、运动学', relatedTopics: '经典力学,自由落体', learningPath: '' });
    expect(out.prerequisites).toEqual(['受力分析', '运动学']);
    expect(out.relatedTopics).toEqual(['经典力学', '自由落体']);
    expect(out.learningPath).toEqual([]);
  });

  it('易混辨析：对象数组 / "概念：区别"字符串 / 脏条目 → 安全归一', () => {
    const obj = sanitizeKnowledgeContext({
      confusables: [{ topic: '质量', difference: '质量是物体固有属性，重量是重力大小' }],
    });
    expect(obj.confusables).toEqual([{ topic: '质量', difference: '质量是物体固有属性，重量是重力大小' }]);

    const str = sanitizeKnowledgeContext({ confusables: ['速度：描述运动快慢，加速度描述速度变化快慢'] });
    expect(str.confusables).toEqual([{ topic: '速度', difference: '描述运动快慢，加速度描述速度变化快慢' }]);

    // 缺 difference / 非对象 / 无分隔符字符串 → 丢弃
    const dirty = sanitizeKnowledgeContext({
      confusables: [{ topic: '有头无尾' }, 42, null, '没有分隔符'],
    });
    expect(dirty.confusables).toBeUndefined();
  });

  it('非法输入 → 空数组兜底', () => {
    expect(sanitizeKnowledgeContext(null).prerequisites).toEqual([]);
    expect(sanitizeKnowledgeContext('abc').relatedTopics).toEqual([]);
  });
});

describe('sanitizeExamQuestions', () => {
  it('标准格式保留，缺 id 自动补', () => {
    const out = sanitizeExamQuestions([{ type: 'choice', question: 'Q?', options: ['A', 'B'], answer: 'A', explanation: 'E', difficulty: 'easy', source: { year: '2024', exam: '高考', section: '理综' } }]);
    expect(out[0].id).toBe('q1');
    expect(out[0].options).toEqual(['A', 'B']);
    expect(out[0].source).toEqual({ year: '2024', exam: '高考', section: '理综' });
  });

  it('options 为整串 → 拆为数组并剥掉自带字母前缀（UI 单独渲染 A/B/C/D）', () => {
    const out = sanitizeExamQuestions([{ question: 'Q?', options: 'A.1；B.2；C.3；D.4', answer: 'A', explanation: 'E' }]);
    expect(out[0].options).toEqual(['1', '2', '3', '4']);
    expect(out[0].type).toBe('choice');
  });

  it('options 为对象 {A:..,B:..} → 归一为数组', () => {
    const out = sanitizeExamQuestions([{ question: 'Q?', options: { A: '甲', B: '乙' }, answer: 'B' }]);
    expect(out[0].options).toEqual(['甲', '乙']);
    expect(out[0].type).toBe('choice');
  });

  it('options 写在题干里 → 切出选项并还原干净题干', () => {
    const stem = '下列说法正确的是（  ）\nA. 速度大加速度就大\nB. 加速度是速度的变化率\nC. 加速度方向总是与速度相同\nD. 加速度为零物体一定静止';
    const out = sanitizeExamQuestions([{ question: stem, type: 'choice', answer: 'B' }]);
    expect(out[0].question).toBe('下列说法正确的是（  ）');
    expect(out[0].options).toEqual([
      '速度大加速度就大',
      '加速度是速度的变化率',
      '加速度方向总是与速度相同',
      '加速度为零物体一定静止',
    ]);
  });

  it('中文题型名 → 正确映射（不再一律降级成 essay）', () => {
    const out = sanitizeExamQuestions([
      { question: 'Q1', type: '选择题', options: ['甲', '乙'], answer: 'A' },
      { question: 'Q2', type: '填空题', answer: '9.8' },
      { question: 'Q3', type: '计算题', answer: '5m/s' },
      { question: 'Q4', type: '证明题', answer: '略' },
    ]);
    expect(out.map(q => q.type)).toEqual(['choice', 'fill', 'calculation', 'essay']);
  });

  it('题型缺失 → 按内容反推（有选项→选择题；有空位→填空题；有计算→计算题）', () => {
    const out = sanitizeExamQuestions([
      { question: '下列关于……', options: ['甲', '乙', '丙', '丁'], answer: 'C' },
      { question: '重力加速度 g = ____ m/s²', answer: '9.8' },
      { question: '质量为2kg的物体受10N合力，求加速度大小', answer: '5' },
      { question: '简述牛顿第一定律的内容', answer: '略' },
    ]);
    expect(out.map(q => q.type)).toEqual(['choice', 'fill', 'calculation', 'essay']);
  });

  it('标了选择题却拿不出选项 → 不硬撑，按内容重判题型', () => {
    const out = sanitizeExamQuestions([{ question: '重力加速度 g = ____ m/s²', type: 'choice', answer: '9.8' }]);
    expect(out[0].type).toBe('fill');
    expect(out[0].options).toBeUndefined();
  });

  it('选择题答案归一化为选项字母（便于 UI 高亮正确项）', () => {
    const out = sanitizeExamQuestions([
      { question: 'Q1', type: 'choice', options: ['甲', '乙'], answer: '选B' },
      { question: 'Q2', type: 'choice', options: ['甲', '乙'], answer: '答案：A' },
      { question: 'Q3', type: 'choice', options: ['加速度减小', '加速度增大'], answer: '正确选项是加速度增大' },
    ]);
    expect(out.map(q => q.answer)).toEqual(['B', 'A', 'B']);
  });

  it('答案为数组（填空题多空 / 多选题）→ 拼接为可读字符串', () => {
    const out = sanitizeExamQuestions([{ question: 'Q', type: 'fill', answer: ['3', '4'] }]);
    expect(out[0].answer).toBe('3；4');
  });

  it('难度中文/别名 → 归一化为标准枚举', () => {
    const out = sanitizeExamQuestions([
      { question: 'Q1', difficulty: '简单' },
      { question: 'Q2', difficulty: '中等' },
      { question: 'Q3', difficulty: '困难' },
      { question: 'Q4', difficulty: '乱写' },
    ]);
    expect(out.map(q => q.difficulty)).toEqual(['easy', 'medium', 'hard', 'medium']);
  });

  it('svg 示意图：合法保留、非法丢弃（防注入）', () => {
    const ok = sanitizeExamQuestions([{ question: 'Q', svg: "<svg viewBox='0 0 100 100'><circle cx='50' cy='50' r='40'/></svg>" }]);
    expect(ok[0].svg).toContain('<circle');
    const bad = sanitizeExamQuestions([{ question: 'Q', svg: "<svg viewBox='0 0 10 10' onclick='alert(1)'><rect/></svg>" }]);
    expect(bad[0].svg).toBeUndefined();
    const noViewBox = sanitizeExamQuestions([{ question: 'Q', svg: '<svg><rect/></svg>' }]);
    expect(noViewBox[0].svg).toBeUndefined();
  });

  it('type/difficulty 非法 → 回退默认值；source 缺失 → 空串兜底', () => {
    const out = sanitizeExamQuestions([{ question: 'Q?', answer: 'A', explanation: 'E' }]);
    expect(out[0].type).toBe('essay');
    expect(out[0].difficulty).toBe('medium');
    expect(out[0].source.year).toBe('');
  });

  it('image 非法 URL → 丢弃', () => {
    const out = sanitizeExamQuestions([{ question: 'Q?', image: 'javascript:alert(1)', answer: 'A', explanation: 'E' }]);
    expect(out[0].image).toBeUndefined();
  });

  it('imageData：合法 base64 图片数据保留（原图直填通道）', () => {
    const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQAY3Y2wAAAAAElFTkSuQmCC';
    const out = sanitizeExamQuestions([{ question: '三角形ABC', imageData: png, answer: 'A', explanation: 'E' }]);
    expect(out[0].imageData).toBe(png);
  });

  it('imageData：非图片数据 / 伪造 base64 / 超体积 → 丢弃', () => {
    const bad1 = sanitizeExamQuestions([{ question: 'Q', imageData: 'data:text/html;base64,PHNjcmlwdD4=', answer: 'A', explanation: 'E' }]);
    expect(bad1[0].imageData).toBeUndefined();
    const bad2 = sanitizeExamQuestions([{ question: 'Q', imageData: 'iVBORw0KGgo=', answer: 'A', explanation: 'E' }]);
    expect(bad2[0].imageData).toBeUndefined();
    const huge = 'data:image/png;base64,' + 'A'.repeat(4_000_001);
    const bad3 = sanitizeExamQuestions([{ question: 'Q', imageData: huge, answer: 'A', explanation: 'E' }]);
    expect(bad3[0].imageData).toBeUndefined();
  });

  it('imageData 别名 image_data / imageBase64 也能识别', () => {
    const png = 'data:image/png;base64,AAAA';
    const a = sanitizeExamQuestions([{ question: 'Q', image_data: png, answer: 'A', explanation: 'E' }]);
    expect(a[0].imageData).toBe(png);
    const b = sanitizeExamQuestions([{ question: 'Q', imageBase64: png, answer: 'A', explanation: 'E' }]);
    expect(b[0].imageData).toBe(png);
  });

  it('原图与 SVG 可共存于数据层（渲染层决定优先级：原图优先）', () => {
    const out = sanitizeExamQuestions([{
      question: 'Q',
      imageData: 'data:image/png;base64,AAAA',
      svg: "<svg viewBox='0 0 10 10'><rect/></svg>",
      answer: 'A',
      explanation: 'E',
    }]);
    expect(out[0].imageData).toBe('data:image/png;base64,AAAA');
    expect(out[0].svg).toContain('<rect');
  });
});

describe('sanitizeInterestingFacts', () => {
  it('趣味知识：条目为字符串也能转对象', () => {
    const out = sanitizeInterestingFacts(['牛顿被苹果砸中……']);
    expect(out[0].content).toBe('牛顿被苹果砸中……');
    expect(out[0].type).toBe('story');
  });

  it('趣味知识：非数组 → 空数组', () => {
    expect(sanitizeInterestingFacts('x')).toEqual([]);
  });
});

describe('toStringList', () => {
  it('数组过滤非字符串项', () => {
    expect(toStringList(['a', 1, null, 'b'])).toEqual(['a', '1', 'b']);
  });
});

describe('sanitizeGraphData', () => {
  it('标准结构原样保留，节点 category 保留', () => {
    const out = sanitizeGraphData([
      { id: 'root', title: '物理', type: 'hierarchy', category: '物理', children: [
        { id: 'b1', title: '力学', type: 'concept', category: '物理', children: [
          { id: 'l1', title: '牛顿第二定律', type: 'formula', category: '物理', topic: '牛顿第二定律' },
        ] },
      ] },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].category).toBe('物理');
    expect(out[0].children![0].category).toBe('物理');
    expect(out[0].children![0].children![0].topic).toBe('牛顿第二定律');
  });

  it('节点缺 category → 从父节点继承；根节点缺 category → 用 title 兜底', () => {
    const out = sanitizeGraphData([
      { id: 'root', title: '数学', type: 'hierarchy', children: [
        { id: 'b1', title: '代数', type: 'concept', children: [
          { id: 'l1', title: '函数', type: 'concept' },
        ] },
      ] },
    ]);
    expect(out[0].category).toBe('数学'); // 根节点用 title 兜底
    expect(out[0].children![0].category).toBe('数学'); // 分支继承根
    expect(out[0].children![0].children![0].category).toBe('数学'); // 叶子继承
  });

  it('type 非法 → 回退 concept；缺 title 的脏条目 → 过滤', () => {
    const out = sanitizeGraphData([
      { id: 'a', title: '化学', type: 'weird', category: '化学' },
      { id: 'b' }, // 缺 title → 过滤
      'not-an-object', // 非对象 → 过滤
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].type).toBe('concept');
  });

  it('非数组 → 空数组', () => {
    expect(sanitizeGraphData(undefined)).toEqual([]);
    expect(sanitizeGraphData({})).toEqual([]);
  });
});

/** 仅暴露 protected 的提示词构造，用于锁定提示词契约（公式 / 图源 / 制图规范） */
class PromptProbe extends BaseAIProvider {
  protected getProviderId(): string {
    return 'probe';
  }
  public promptFor(topic: string, context?: { category?: string; knowledgeType?: string }): string {
    return this.buildGeneratePrompt(topic, context as any);
  }
  public followupSystemFor(topic: string, mode?: 'search' | 'qa'): string {
    return this.buildFollowupSystemPrompt(topic, mode);
  }
}

describe('buildGeneratePrompt — 提示词契约', () => {
  const prompt = new PromptProbe().promptFor('勾股定理');

  it('要求所有字段（含试题）的数学符号统一用 $...$ 包裹', () => {
    expect(prompt).toContain('$...$');
    expect(prompt).toContain('题干、选项、答案、解析');
    // 反面示例（缺围符）必须写进提示词，让模型明确知道"裸 LaTeX 不可接受"
    expect(prompt).toContain('\\triangle ABC');
    expect(prompt).toContain('\\sqrt{13}');
  });

  it('严格指定可信图源域名（白名单）', () => {
    expect(prompt).toContain('必须**只填下列**可信图源域名');
    expect(prompt).toContain('upload.wikimedia.org');
    expect(prompt).toContain('commons.wikimedia.org');
    expect(prompt).toContain('cdn.kastatic.org');
  });

  it('试题配图"原图优先"，且给出 imageData 直填通道与非字符区域判据', () => {
    expect(prompt).toContain('原图优先');
    expect(prompt).toContain('imageData');
    expect(prompt).toContain('无法作为字符识别');
  });

  it('imageData 同时覆盖 concepts 与 examQuestions，并禁止伪造 base64', () => {
    expect(prompt).toContain('concepts[].imageData');
    expect(prompt).toContain('examQuestions[].imageData');
    expect(prompt).toContain('会在后台校验中被丢弃');  // 伪造 base64 会被后台丢弃
    expect(prompt).toContain('纯文本模型');
  });

  it('严谨性铁律：答案与解析必须自洽、不准自我怀疑、宁可不出题', () => {
    // 截图中"答案是1，解析是2"和"此题若... / 改原题..."两个症状的根源
    expect(prompt).toContain('宁缺毋滥');
    expect(prompt).toContain('解析必须与答案一致');
    expect(prompt).toContain('自我怀疑');
    expect(prompt).toContain('必须放弃这道题');  // 不确定时宁可不命题
  });

  it('含"如图"的试题：无图不出题（防止编造）', () => {
    // 截图 2 的"如图，AB是⊙O的直径..."没有图却强行作答的根因
    expect(prompt).toContain('"如图"');
    expect(prompt).toContain('必须**至少满足其一');  // 必须有原图/可信链接/精确 SVG
    expect(prompt).toContain('考试改编');          // 否则舍弃或改写，改写必须标注
  });

  it('解析只写本题推导：禁止离题话术/自我标榜/罗列多题/多套解法', () => {
    // 截图"几道经典题""信雅达千字文""采用 2022 年全国乙卷真题"等离题乱编的根因
    expect(prompt).toContain('解析只写本题推导');
    expect(prompt).toContain('禁止一切离题内容');
    expect(prompt).toContain('这是一道经典题');       // 反例：自我标榜/点评
    expect(prompt).toContain('只写一套解法');          // 反例：多套解法交织
    expect(prompt).toContain('不得罗列');              // 反例：罗列多题
  });

  it('SVG 规则含学科制图惯例（三角形对边 a/b/c、法线、电路元件画法）', () => {
    expect(prompt).toMatch(/对边.*a=BC/);
    expect(prompt).toContain('法线');
    expect(prompt).toContain('电阻');  // 电路元件按步骤画（正面教学）
    expect(prompt).toContain('受力分析');
  });
});

describe('buildCategoryDirective — 分类驱动生成提示词', () => {
  const probe = new PromptProbe();

  it('物理类输入注入物理专属规范（方向性/量纲/受力·电路·光学制图）', () => {
    const p = probe.promptFor('牛顿第二定律', { category: '物理', knowledgeType: 'formula' });
    expect(p).toContain('学科专属规范 · 物理');
    expect(p).toContain('方向性');
    expect(p).toContain('受力分析');
  });

  it('化学类输入注入化学专属规范（化学式/键角/装置）', () => {
    const p = probe.promptFor('化学键', { category: '化学', knowledgeType: 'concept' });
    expect(p).toContain('学科专属规范 · 化学');
    expect(p).toContain('键角');
  });

  it('交叉学科 / "其他" 不注入特定学科规则，只给通用归类提醒（避免无关规则干扰）', () => {
    const p = probe.promptFor('生物化学', { category: '生物化学', knowledgeType: 'process' });
    expect(p).toContain('不要套用不相关的学科制图规范');
    expect(p).not.toContain('学科专属规范 · 物理');
    expect(p).not.toContain('学科专属规范 · 化学');
  });

  it('无 category（如知识图谱节点）→ 通用归类提醒、不注入学科规则', () => {
    const p = probe.promptFor('勾股定理', { category: undefined, knowledgeType: 'theorem' });
    expect(p).toContain('其他');
    expect(p).not.toContain('学科专属规范');
  });
});

describe('buildFollowupSystemPrompt — 对话公式书写契约', () => {
  const probe = new PromptProbe();

  it('QA 模式与追问模式都要求公式用 $...$ 包裹', () => {
    const qa = probe.followupSystemFor('', 'qa');
    expect(qa).toContain('公式书写规则');
    expect(qa).toContain('$...$');

    const followup = probe.followupSystemFor('牛顿第二定律', 'search');
    expect(followup).toContain('公式书写规则');
    expect(followup).toContain('$...$');
  });

  it('显式要求"反斜杠绝不能省"并给出反例（防止模型把 \\frac 简写成 rac）', () => {
    const qa = probe.followupSystemFor('', 'qa');
    expect(qa).toContain('反斜杠绝不能省');
    // 反例必须出现：把 \frac 写成 rac 是错的
    expect(qa).toContain('\\frac');
    expect(qa).toContain('rac');
    // 同样覆盖 \triangle / \sqrt 等常见命令
    expect(qa).toContain('\\triangle');
    expect(qa).toContain('\\sqrt');
  });
});
