import {
  AIService,
  AIResponse,
  SearchValidateResponse,
  SearchAnalyzeResponse,
  SearchGenerateResponse,
  SearchFollowupResponse,
  TranslateDetectResponse,
  DictionaryQueryResponse,
  TranslateQueryResponse,
  DocumentGenerateResponse,
  DocumentExportResponse,
  ExportFormat,
  Concept,
  Example,
  MindMapNode,
  DocType,
  EmailTone,
  WordResult,
  ExamQuestion,
  InterestingFact,
  FollowupMessage,
  StreamSnapshot,
  KnowledgeGraphNode,
  KnowledgeType,
  KeywordEntry,
} from '../types';
import {
  mockKnowledgeData,
  generatedKnowledgeData,
  generateReply,
  smartTagsMap,
} from '../modules/search/mockData';
import { mockWordResult } from '../modules/translate/mockData';
import { generateGeneral, generateEmail, generateReport, generateMeeting, generatePPT, generateNotes, generateContract, generateResume, generatePress, generateProposal, generateWeekly } from '../modules/doc/templates';
import { getStoredLanguage } from '../hooks/useLanguageStore';
import { getCurrentStrings } from '../i18n/strings';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const defaultWordData: WordResult = {
  word: '',
  phonetic: '',
  definitions: [{ pos: '', meaning: '暂无该单词的释义' }],
};

/**
 * Mock 模式的一句话释义表（关键词用的兜底）。
 *
 * 关键词现在带释义，没有这张表的话 mock 演示里关键词就只有光秃秃的词，
 * 看不出"词 + 释义"的效果。**只覆盖演示语料里的常用词**，查不到就退化成
 * 只有词（真实 provider 由 AI 填 definition，不走这张表）。
 *
 * 覆盖范围跟着「演示语料」走：常用词 + 短语词条拆出来的词 + 礼貌用语，
 * 保证随便点一个关键词都能看到"词 + 解释"的实际效果。
 */
const mockMiniGlossary: Record<string, string> = {
  // 常用词
  sample: '样本；例子',
  data: '数据；资料',
  structure: '结构；组织方式',
  model: '模型；范例',
  algorithm: '算法；计算程序',
  method: '方法；办法',
  process: '过程；流程',
  system: '系统；体系',
  theory: '理论；学说',
  concept: '概念；观念',
  idea: '想法；主意',
  knowledge: '知识；学识',
  learning: '学习；学问',
  research: '研究；调查',
  analysis: '分析；解析',
  science: '科学；学科',
  technology: '技术；科技',
  language: '语言；语言文字',
  computer: '计算机；电脑',
  network: '网络；网状系统',
  function: '功能；函数',
  equation: '方程；等式',
  formula: '公式；配方',
  theorem: '定理；原理',
  result: '结果；成果',
  problem: '问题；难题',
  solution: '解决方案；答案',
  challenge: '挑战；难题',
  opportunity: '机会；时机',
  development: '发展；开发',
  improvement: '改进；提高',
  innovation: '创新；革新',
  creativity: '创造力；创造性',
  thinking: '思考；思维',
  understanding: '理解；领会',
  wisdom: '智慧；明智',
  vision: '视力；视野；愿景',
  processing: '处理；加工',
  deep: '深的；深刻的',
  natural: '自然的；天生的',
  artificial: '人工的；人造的',
  machine: '机器；机械',
  neural: '神经的',

  // 问候 / 礼貌用语
  good: '好的；令人愉快的',
  morning: '早晨；上午',
  afternoon: '下午',
  evening: '傍晚；晚上',
  hello: '你好；喂',
  world: '世界；世间',
  thank: '感谢；谢谢',
  thanks: '感谢；谢意',
  goodbye: '再见',
  bye: '再见',
  please: '请；请问',
  sorry: '抱歉的；对不起',
  welcome: '欢迎；受欢迎的',
  you: '你；你们',
  your: '你的；你们的',
  how: '怎样；如何',
  are: '是（be 动词复数形式）',
  this: '这；这个',
  that: '那；那个',
  today: '今天',
  tomorrow: '明天',
  meeting: '会议；会面',
  report: '报告；汇报',
  project: '项目；工程',

  // 短语词条拆出来的词 / 常用搭配里的词
  respond: '作出反应；回应',
  well: '好地；令人满意地',
  treatment: '治疗；处理',
  therapy: '疗法；治疗方案',
  environment: '环境；外界条件',
  plant: '植物；种植',
  warm: '温暖的；热心的',
  humid: '潮湿的；湿润的',
  account: '考虑；账目',
  consider: '考虑；认为',
  factor: '因素；要素',
  terms: '术语；条件；说法',
  aspect: '方面；角度',
  notation: '记号；表示法',
  complexity: '复杂性；复杂度',
  training: '训练；培训',
  layer: '层；阶层',
  token: '词元；标记',
  text: '文本；正文',

  // 关联术语里出现、但不在词条表里的词。
  // 这些词在演示里是**可点击目标**（点一下就是查词），没有释义就会落到
  // deriveMockFallbackDefinitions 的兜底或"暂无该单词的释义"——看起来像断链。
  // 每条只给一句话释义，够词条页/关键词列表显示即可，不求词典级完整。
  ai: '人工智能（Artificial Intelligence 的缩写）',
  api: '应用程序接口（Application Programming Interface）',
  sdk: '软件开发工具包（Software Development Kit）',
  gdp: '国内生产总值（Gross Domestic Product）',
  nlp: '自然语言处理（Natural Language Processing）',
  cnn: '卷积神经网络（Convolutional Neural Network）',
  rnn: '循环神经网络（Recurrent Neural Network）',
  gpt: 'GPT 系列生成式预训练模型',
  bert: 'BERT 预训练语言模型',
  transformer: 'Transformer 模型（基于注意力机制的架构）',
  array: '数组；阵列',
  queue: '队列；排队',
  stack: '栈；堆叠',
  tree: '树（数据结构）；树状图',
  graph: '图；图表',
  recursion: '递归',
  iteration: '迭代；反复',
  backpropagation: '反向传播（训练神经网络的算法）',
  tokenization: '分词；标记化',
  database: '数据库',
  library: '库；函数库',
  plugin: '插件',
  middleware: '中间件',
  microservices: '微服务（一种架构风格）',
  monolithic: '单体式的（架构）',
  scalability: '可扩展性',
  performance: '性能；表现',
  greeting: '问候语；招呼',
  salutation: '称呼语；致意',
  regarding: '关于；就……而言',
  tolerance: '耐受性；宽容度',
  biochemistry: '生物化学',
  genetics: '遗传学',
  ecology: '生态学',
  physiology: '生理学',
  evolution: '演化；进化',
  electromagnetism: '电磁学',
  thermodynamics: '热力学',
  relativity: '相对论',
  macroeconomics: '宏观经济学',
  microeconomics: '微观经济学',
  inflation: '通货膨胀',
  unemployment: '失业；失业率',
  robotics: '机器人学',

  // 常用搭配里的"尾巴词"：搭配是多词短语，只要有一个词素能解释，
  // 兜底拆解句就立得住（否则整条短语点下去还是空的）。
  collect: '收集；采集',
  pattern: '模式；范式',
  fully: '完全地；充分地',
  implemented: '实现；落地（implement 的过去分词）',
  deployment: '部署；上线',
  pipeline: '流水线；管道',
  speech: '言语；语音',
  recognition: '识别；认可',
  object: '物体；对象',
  detection: '检测；发现',
  classical: '经典的；古典的',
  mechanics: '力学；机理',
  quantum: '量子；量子的',
  chemical: '化学的；化学物质',
  reaction: '反应；反作用',
  experimental: '实验的；实验性的',
  react: '作出反应；起反应',
  linked: '链接的；相连的',
  list: '列表；清单',
  allow: '允许；使可能',
  regards: '关于；问候',
  respect: '方面；尊重',
  context: '语境；上下文',
  agent: '智能体；代理（能感知环境并采取行动的程序）',
};

/**
 * Mock 版的"关键词分析"：从一段文本里挑出值得单独学的词，并附上一句话释义。
 *
 * 释义来源优先级：词条数据（`mockWordResult`，更权威）> 兜底词表（`mockMiniGlossary`）。
 * **查不到释义的词直接不返回** —— Mock 是给人看的演示，塞一堆没有释义的碎词
 * 反而看不出"关键词带释义"这件事（真实 provider 的降级策略由 TermList 负责，
 * 缺释义只少一行字、不会少一条）。
 */
function deriveMockKeywords(text: string, max: number): KeywordEntry[] {
  const tokens = text
    .split(/[\s,，、;；.。!！?？:：'"“”‘’()（）\[\]【】]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 1);

  const seen = new Set<string>();
  const out: KeywordEntry[] = [];
  for (const term of tokens) {
    const key = term.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const definition =
      mockWordResult[key]?.definitions?.[0]?.meaning || mockMiniGlossary[key];
    if (!definition) continue;
    out.push({ term, definition });
    if (out.length >= max) break;
  }
  return out;
}

/**
 * Mock 版的"未收录词"兜底释义。
 *
 * 为什么需要：Mock 的演示动作几乎全是"点一下某个词"（关联术语 / 常用搭配 / 关键词），
 * 而这些目标词绝大多数不在 68 条词表里。全部落到 `defaultWordData` 的话，演示时
 * 每点一次都是"暂无该单词的释义"——看起来像功能坏了，而这些区块本身是对的。
 *
 * 这里**不编造词义**：只把查得到的词素逐个解释，并明确标注这是演示降级
 * （接入真实模型后同样输入会有准确释义）。一个词素都查不到时保持原样，
 * 让"查不到"这件事如实显示。
 */
function deriveMockFallbackDefinitions(word: string): WordResult['definitions'] {
  const parts = word
    .trim()
    .toLowerCase()
    .split(/[^a-z0-9'’-]+/i)
    .filter(Boolean);

  const explained = parts
    .map((part) => {
      const gloss =
        mockWordResult[part]?.definitions?.[0]?.meaning || mockMiniGlossary[part];
      if (!gloss) return null;
      // 词表释义常带"（……）"补充和分号并列义项，取第一段让拆解句保持简短
      const first = gloss.split(/[；;（(]/)[0].trim();
      return first ? `${part} ${first}` : null;
    })
    .filter((x): x is string => !!x);

  if (explained.length === 0) return defaultWordData.definitions;

  return [
    {
      pos: parts.length > 1 ? 'phrase' : 'word',
      meaning:
        `逐词拆解：${explained.join(' + ')}。` +
        '（Demo 数据未收录该词条的完整释义，配置模型密钥后会有准确解释）',
    },
  ];
}

/**
 * 演示语料表（翻译模式）。
 *
 * 为什么需要它：`queryTranslate` 原先给的是 `relatedTerms: ['相关词汇']` /
 * `grammarNotes: ['语法说明']` 这类**占位垃圾** —— 关联术语点下去会拿去搜知识库，
 * 搜"相关词汇"只会得到一堆无关内容；"语法说明"更是纯噪音。
 *
 * 这里只策展少量典型句子，每条都给真实可用的内容；**没命中就什么都不给**（区块不显示），
 * 不编造。`tokens` 是按**原文词序**排列的译文块：key1 = 第 1 个原文词，
 * 允许译文顺序与原文相反（`Good morning → ['好','早上']`），这是"按 key 配对而非按位置配对"
 * 最直观的演示场景。
 */
const mockSentenceExtras: Record<
  string,
  {
    translation: string;
    tokens?: string[];
    keywords?: KeywordEntry[];
    relatedTerms?: string[];
    grammarNotes?: string[];
  }
> = {
  'good morning': {
    translation: '早上好',
    // key1 = good → 好、key2 = morning → 早上：**译文里"早上"排在"好"之前**，
    // 顺序与原文相反，只有按 key 配对才能正确高亮
    tokens: ['好', '早上'],
    keywords: [
      { term: 'good', definition: '好的；令人愉快的' },
      { term: 'morning', definition: '早晨；上午（中午 12 点前）' },
    ],
    relatedTerms: ['英语问候语', 'greeting', 'good evening'],
    grammarNotes: [
      '英语问候语是固定搭配，不能按字面拆成"好的 + 早上"逐字直译。',
      '译文语序与原文相反（good→好 排在 morning→早上 之后），对照按 key 配对而非按位置配对。',
    ],
  },
  hello: {
    translation: '你好',
    tokens: ['你好'],
    keywords: [{ term: 'hello', definition: '你好；喂（招呼语）' }],
    relatedTerms: ['英语问候语', 'greeting'],
    grammarNotes: ['hello 是比较中性的招呼语，正式场合也通用。'],
  },
  'hello world': {
    translation: '你好世界',
    tokens: ['你好', '世界'],
    keywords: [
      { term: 'hello', definition: '你好；喂（招呼语）' },
      { term: 'world', definition: '世界；世间' },
    ],
    relatedTerms: ['编程入门', 'hello world 程序'],
    grammarNotes: ['"Hello, world!" 是编程语言入门示例的惯用输出，通常作为第一段代码。'],
  },
  'thank you': {
    translation: '谢谢',
    tokens: ['谢谢'],
    keywords: [
      { term: 'thank', definition: '感谢；谢谢' },
      { term: 'you', definition: '你；你们' },
    ],
    relatedTerms: ['英语礼貌用语', 'gratitude'],
    grammarNotes: ['thank you 是一个整体表达，中间的 you 是宾语，不能省略。'],
  },
  'how are you': {
    translation: '你好吗',
    tokens: ['你', '好', '吗'],
    keywords: [
      { term: 'how', definition: '怎样；如何' },
      { term: 'are', definition: '是（be 动词复数形式）' },
      { term: 'you', definition: '你；你们' },
    ],
    relatedTerms: ['英语问候语', '英语疑问句'],
    grammarNotes: ['这是主系表结构的疑问句，语序是"疑问词 + be + 主语"，中文习惯把"吗"放在末尾。'],
  },
  goodbye: {
    translation: '再见',
    tokens: ['再见'],
    keywords: [{ term: 'goodbye', definition: '再见；告别' }],
    relatedTerms: ['英语问候语', 'farewell'],
    grammarNotes: ['goodbye 由 God be with ye 缩合而来，口语里也常用更随意的 bye。'],
  },
  你好: {
    translation: 'hello',
    tokens: ['hello'],
    keywords: [{ term: '你好', definition: '见面的礼貌招呼语' }],
    relatedTerms: ['英语问候语', 'greeting'],
    grammarNotes: ['中文"你好"对应英文 hello / hi，后者更随意，多用于熟人之间。'],
  },
  谢谢: {
    translation: 'thank you',
    tokens: ['thank', 'you'],
    keywords: [{ term: '谢谢', definition: '表示感谢的礼貌用语' }],
    relatedTerms: ['英语礼貌用语', 'gratitude'],
    grammarNotes: ['中文"谢谢"是独立成句的客套语，英文对应 thank you 需要保留主语 you。'],
  },
  再见: {
    translation: 'goodbye',
    tokens: ['goodbye'],
    keywords: [{ term: '再见', definition: '道别时的礼貌用语' }],
    relatedTerms: ['英语问候语', 'farewell'],
    grammarNotes: ['告别场景里 see you / bye 比 goodbye 更口语化。'],
  },
  早上好: {
    translation: 'good morning',
    tokens: ['good', 'morning'],
    keywords: [{ term: '早上好', definition: '上午见面时的问候语' }],
    relatedTerms: ['英语问候语', 'good morning'],
    grammarNotes: ['英文问候语按时间段区分：morning / afternoon / evening 各有一套固定说法。'],
  },
};

const docTemplates: Record<DocType, (topic: string, requirements?: string, tone?: EmailTone) => string> = {
  general: (topic) => generateGeneral(topic, getStoredLanguage()),
  email: (topic: string, _?: string, emailTone?: EmailTone) => {
    const s = getCurrentStrings();
    return generateEmail(
      topic,
      emailTone || 'formal',
      s.doc.defaultSender,
      s.doc.defaultReceiver,
      getStoredLanguage(),
    );
  },
  report: (topic) => generateReport(topic, getStoredLanguage()),
  meeting: (topic) => generateMeeting(topic, getStoredLanguage()),
  ppt: (topic) => generatePPT(topic, getStoredLanguage()),
  notes: (topic) => generateNotes(topic, getStoredLanguage()),
  contract: (topic) => generateContract(topic, getStoredLanguage()),
  resume: (topic) => generateResume(topic, getStoredLanguage()),
  press: (topic) => generatePress(topic, getStoredLanguage()),
  proposal: (topic) => generateProposal(topic, getStoredLanguage()),
  weekly: (topic) => generateWeekly(topic, getStoredLanguage()),
};

export const mockAIService: AIService = {
  search: {
    async validate(input: string): Promise<AIResponse<SearchValidateResponse>> {
      await delay(300);
      const trimmed = input.trim();
      if (!trimmed) {
        return { success: true, data: { valid: false, suggestions: ['物理定律', '化学反应', '数学公式'], reason: '请输入搜索内容' } };
      }
      if (trimmed.length < 2) {
        return { success: true, data: { valid: false, suggestions: [], reason: '请输入至少2个字符' } };
      }
      const suggestions = Object.keys(smartTagsMap).filter(key => key.includes(trimmed))
        .flatMap(key => smartTagsMap[key]).slice(0, 5);
      return { success: true, data: { valid: true, suggestions } };
    },

    async analyze(input: string): Promise<AIResponse<SearchAnalyzeResponse>> {
      await delay(400);
      const trimmed = input.trim();
      const lower = trimmed.toLowerCase();

      // 非知识点判断：事实性问题、计算、邮件、闲聊、作品角色名、网络热梗等
      // 注意：/是谁$/ 仅匹配句尾（如"牛顿是谁"），避免"加速度的定义是谁提出的"这类知识点历史问题被误判
      const nonKnowledgePatterns = [
        /作者是谁/, /结果是多少/, /等于多少/, /天气/, /写一封/, /帮我写/,
        /多少钱/, /几点/, /在哪里/, /是谁$/, /^计算/, /\d+\s*[×x*]\s*\d+/,
        // 作品角色名 / 人名（"X是谁"已在上面覆盖，这里补"X是什么梗""X什么来历"等）
        /是什么梗/, /什么梗/, /是哪里的/, /出自哪/, /的原型/,
      ];
      const isNonKnowledge = nonKnowledgePatterns.some(p => p.test(trimmed));

      if (isNonKnowledge) {
        return {
          success: true,
          data: {
            isSpecific: true,
            isKnowledgePoint: false,
            canonicalTopic: trimmed,
            topic: trimmed,
            category: '问答',
            knowledgeType: 'concept',
          },
        };
      }

      const matchedKey = Object.keys(mockKnowledgeData).find(key => key.toLowerCase() === lower);
      if (matchedKey) {
        const data = mockKnowledgeData[matchedKey];
        return {
          success: true,
          data: {
            isSpecific: true,
            isKnowledgePoint: true,
            canonicalTopic: matchedKey,
            topic: matchedKey,
            category: data.category,
            knowledgeType: data.type,
          },
        };
      }

      // 宽泛学科 → 返回知识图谱（isSpecific=false，带 graphData，每个节点带 category）
      const broadDisciplines: Record<string, { category: string; branches: Array<{ title: string; type: KnowledgeType; leaves: string[] }> }> = {
        '数学': {
          category: '数学',
          branches: [
            { title: '代数', type: 'concept', leaves: ['一元二次方程', '函数', '不等式'] },
            { title: '几何', type: 'concept', leaves: ['三角形', '圆', '立体几何'] },
            { title: '微积分', type: 'formula', leaves: ['导数', '积分', '极限'] },
          ],
        },
        '物理': {
          category: '物理',
          branches: [
            { title: '力学', type: 'concept', leaves: ['牛顿第二定律', '万有引力', '动量'] },
            { title: '电磁学', type: 'formula', leaves: ['电场', '磁场', '电磁感应'] },
            { title: '热学', type: 'process', leaves: ['热力学第一定律', '理想气体'] },
          ],
        },
        '化学': {
          category: '化学',
          branches: [
            { title: '无机化学', type: 'concept', leaves: ['元素周期律', '化学键'] },
            { title: '有机化学', type: 'concept', leaves: ['烷烃', '官能团'] },
            { title: '化学反应', type: 'process', leaves: ['氧化还原', '酸碱中和'] },
          ],
        },
      };

      const broad = broadDisciplines[trimmed];
      if (broad) {
        const graphData: KnowledgeGraphNode[] = [{
          id: `root-${trimmed}`,
          title: trimmed,
          type: 'hierarchy',
          category: broad.category,
          children: broad.branches.map((b, bi) => ({
            id: `b${bi}-${b.title}`,
            title: b.title,
            type: b.type,
            category: broad.category,
            children: b.leaves.map((leaf, li) => ({
              id: `b${bi}-l${li}-${leaf}`,
              title: leaf,
              type: b.type,
              category: broad.category,
              topic: leaf,
            })),
          })),
        }];
        return {
          success: true,
          data: {
            isSpecific: false,
            isKnowledgePoint: true,
            canonicalTopic: trimmed,
            topic: trimmed,
            category: broad.category,
            knowledgeType: 'hierarchy',
            graphData,
          },
        };
      }

      // 归一化：循环剥离常见疑问词（含知识点历史类提问后缀，如"X是谁提出的"→"X"）直至稳定，
      // 支持多重修饰输入（如"介绍什么是X"→"X"）；与真实 AI 的意图判断规则保持一致
      const stripQuestionWords = (s: string): string =>
        s
          .replace(/是谁(提出|发现|发明|创立|推导|证明)的?$/, '')
          .replace(/的(应用|用途|作用|例子)(有哪些|有什么|是什么)?$/, '')
          .replace(/(有哪些|有什么|是什么|怎么样)$/, '')
          .replace(/(怎么|如何)(学|学习|理解|掌握|学好)$/, '')
          .replace(/(需要|是|有)[^吗]*吗$/, '')
          .replace(/的定义$/, '')
          .replace(/的概念$/, '')
          .replace(/^说明/, '')
          .replace(/^解释/, '')
          .replace(/^什么是/, '')
          .replace(/^介绍/, '')
          .trim();

      let canonical = trimmed;
      let prev: string;
      do {
        prev = canonical;
        canonical = stripQuestionWords(canonical);
      } while (canonical !== prev);
      if (!canonical) canonical = trimmed;

      return {
        success: true,
        data: {
          isSpecific: true,
          isKnowledgePoint: true,
          canonicalTopic: canonical,
          topic: canonical,
          category: '通用知识',
          knowledgeType: 'concept',
        },
      };
    },

    async generate(topic: string, _context?: SearchAnalyzeResponse): Promise<AIResponse<SearchGenerateResponse>> {
      await delay(600);
      
      const generatedData = generatedKnowledgeData[topic];
      const knowledgeCardData = mockKnowledgeData[topic];

      let mindMap: MindMapNode[] = [];
      let concepts: Concept[] = [];
      let examples: Example[] = [];
      let relatedResults = knowledgeCardData ? [knowledgeCardData] : [];

      if (generatedData) {
        mindMap = generatedData.mindMap as MindMapNode[];
        // 新格式：concepts 直接为双层解释结构（示例内嵌于概念）
        concepts = generatedData.concepts as Concept[];
        examples = (generatedData.examples as unknown as { title: string; description: string; steps?: string[]; result?: string }[]).map(e => ({
          ...e,
          result: e.result || '暂无结果',
        }));
      } else {
        mindMap = [
          { id: 'root', title: topic, level: 'root', children: [
            { id: 'concept', title: '基本概念', level: 'branch', children: [
              { id: 'c1', title: '定义', level: 'leaf', description: topic + '的基本定义说明。' },
              { id: 'c2', title: '特点', level: 'leaf', description: topic + '的主要特点。' },
            ]},
            { id: 'application', title: '应用场景', level: 'branch', children: [
              { id: 'a1', title: '实际应用', level: 'leaf', description: topic + '在实际中的应用。' },
              { id: 'a2', title: '典型案例', level: 'leaf', description: topic + '的典型应用案例。' },
            ]},
            { id: 'example', title: '典型示例', level: 'branch', children: [
              { id: 'e1', title: '示例1', level: 'leaf', description: topic + '的一个典型示例。' },
              { id: 'e2', title: '示例2', level: 'leaf', description: topic + '的另一个示例。' },
            ]},
          ]},
        ];
        // 对齐真实提示词契约：3 个概念（定义 → 公式 → 原理），
        // 直观概念留空 example，公式/原理类配可验算的示例
        concepts = [
          {
            type: 'definition',
            title: topic,
            content: {
              elementary: `简单来说，${topic}是该领域描述事物核心特征的基础概念，弄清楚"它是什么"是学习的第一步。`,
              advanced: `严谨地说，${topic}是在给定条件下对研究对象本质属性的概括，其定义包含前提条件、研究对象与定量关系三个要素。`,
            },
          },
          {
            type: 'formula',
            title: `${topic}的基本关系式`,
            notation: 'y = f(x)',
            content: {
              elementary: `把它想成一台"转换器"：输入一个量，按比例输出另一个量，比例系数就是${topic}的核心。`,
              advanced: `${topic}的定量关系可表述为输出量与输入量成正比，比例系数由系统本身性质决定，与输入量大小无关。`,
            },
            example: `生活场景：若比例系数为 2，输入 3 个单位时输出为 2 × 3 = 6 个单位；输入扩大到 5 个单位时输出为 10 个单位，比值恒为 2。`,
          },
          {
            type: 'theorem',
            title: `${topic}的适用条件`,
            content: {
              elementary: `就像任何规律都有其适用范围，用${topic}前要先确认前提是否满足。`,
              advanced: `${topic}的成立依赖前提条件；前提不满足时结论不再适用，需要改用更一般的模型描述。`,
            },
            example: `典型场景：在前提条件成立时可直接套用结论快速判断；若前提被破坏（如存在额外干扰因素），则需回到基本定义重新推导。`,
          },
        ];
        examples = [{ title: '示例', description: '这是' + topic + '的一个典型示例。', result: '示例结果' }];
      }

      const branchTopics = (generatedData?.mindMap[0]?.children ?? []).map(n => n.title).filter(Boolean).slice(0, 4);
      const knowledgeContext = generatedData ? {
        prerequisites: ['相关基础知识'],
        relatedTopics: branchTopics.length > 0 ? branchTopics : ['相关主题1', '相关主题2'],
        learningPath: ['概念理解', '原理掌握', '应用实践'],
        commonConclusions: [
          `理解${topic}的关键是抓住定义、原理与公式三者的对应关系`,
          `在满足前提条件时，相关公式与结论可直接用于分析和计算`,
        ],
      } : {
        prerequisites: ['基础概念', '相关知识'],
        relatedTopics: ['相关主题1', '相关主题2'],
        learningPath: ['入门学习', '进阶深入', '实践应用'],
        commonConclusions: [
          `在满足前提条件时，${topic}的核心公式可直接用于定量计算`,
          `定义、原理与公式三者可相互推导验证，构成完整知识闭环`,
        ],
      };

      const examQuestions: ExamQuestion[] = [
        {
          id: 'q1',
          type: 'choice',
          question: `关于${topic}的选择题？`,
          options: ['选项A', '选项B', '选项C', '选项D'],
          answer: '选项A',
          explanation: '这是这道题的详细解析。',
          difficulty: 'easy',
          source: {
            year: '2023',
            exam: '高考全国甲卷',
            section: '数学',
          },
        },
        {
          id: 'q2',
          type: 'fill',
          question: `${topic}的核心公式是______`,
          answer: '公式答案',
          explanation: '这是填空题的详细解析。',
          difficulty: 'medium',
          source: {
            year: '2024',
            exam: '高考全国乙卷',
            section: '数学',
          },
        },
      ];

      const interestingFacts: InterestingFact[] = [
        {
          id: 'f1',
          title: `${topic}的历史故事`,
          content: `${topic}的发现过程充满了传奇色彩...`,
          type: 'story',
        },
      ];

      const summary = generatedData?.concepts[0]
        ? `${topic}：${generatedData.concepts[0].content.advanced}`
        : `${topic}是描述该领域核心内容的重要概念。`;

      // 总述：核心概念区块的引导段。mockData 未逐条维护，这里按概念顺序生成，
      // 保证「总述」在无 Key 演示场景下也不会缺失（真实 AI 会自己写这段）
      const conceptTitles = concepts.map(c => c.title);
      const conceptsOverview = conceptTitles.length > 0
        ? `要掌握"${topic}"，建议按「${conceptTitles.join(' → ')}」的顺序推进：先弄清${conceptTitles[0]}讲的是什么，再依次理解后面的要点，最后用典型场景把整条知识链串起来。`
        : `要准确理解"${topic}"，需要先明确其定义，再结合基本原理与核心公式，下文依次展开。`;

      return {
        success: true,
        data: {
          topic,
          summary,
          conceptsOverview,
          mindMap,
          concepts,
          examples,
          relatedResults,
          knowledgeContext,
          examQuestions,
          interestingFacts,
        },
      };
    },

    /**
     * 流式生成（Mock）：复用 generate 的完整数据，按字段逐块吐出，
     * 模拟真实流式"边生成边渲染"的观感，方便无密钥时调试 UI。
     */
    async generateStream(
      topic: string,
      onPartial: (snapshot: StreamSnapshot<SearchGenerateResponse>) => void,
      signal?: AbortSignal,
      _onReasoning?: (chunk: string) => void,
      _context?: SearchAnalyzeResponse
    ): Promise<AIResponse<SearchGenerateResponse>> {
      await delay(300);
      const full = await mockAIService.search.generate(topic);
      if (!full.success || !full.data) return full;

      const d = full.data;
      const empty: SearchGenerateResponse = {
        topic: d.topic,
        summary: '',
        conceptsOverview: '',
        mindMap: [],
        concepts: [],
        examples: [],
        relatedResults: [],
        knowledgeContext: { prerequisites: [], relatedTopics: [], learningPath: [] },
        examQuestions: [],
        interestingFacts: [],
      };

      // 按真实 AI 写 JSON 的顺序逐块交付（与提示词的字段顺序、页面渲染顺序一致）
      const blocks: Array<{ key: string; patch: Partial<SearchGenerateResponse> }> = [
        { key: 'summary', patch: { summary: d.summary } },
        { key: 'mindMap', patch: { mindMap: d.mindMap } },
        { key: 'conceptsOverview', patch: { conceptsOverview: d.conceptsOverview } },
        { key: 'concepts', patch: { concepts: d.concepts, examples: d.examples, relatedResults: d.relatedResults } },
        { key: 'knowledgeContext', patch: { knowledgeContext: d.knowledgeContext } },
        { key: 'examQuestions', patch: { examQuestions: d.examQuestions } },
        { key: 'interestingFacts', patch: { interestingFacts: d.interestingFacts } },
      ];

      const current: SearchGenerateResponse = { ...empty };
      const completedKeys: string[] = [];
      for (let i = 0; i < blocks.length; i++) {
        if (signal?.aborted) break;
        const b = blocks[i];
        Object.assign(current, b.patch);
        completedKeys.push(b.key);
        await delay(140);
        onPartial({
          data: JSON.parse(JSON.stringify(current)) as SearchGenerateResponse,
          complete: i === blocks.length - 1,
          completedKeys: [...completedKeys],
        });
      }

      return { success: true, data: d };
    },

    async followup(topic: string, question: string, _history?: FollowupMessage[], _mode?: 'search' | 'qa'): Promise<AIResponse<SearchFollowupResponse>> {
      await delay(500);
      const reply = generateReply(question, topic);
      return {
        success: true,
        data: { reply },
      };
    },

    /** 流式追问（Mock）：把回复按小段吐出，模拟打字机 */
    async followupStream(
      topic: string,
      question: string,
      _history?: FollowupMessage[],
      _mode?: 'search' | 'qa',
      onDelta?: (partial: { reply: string; complete: boolean }) => void,
      signal?: AbortSignal
    ): Promise<AIResponse<SearchFollowupResponse>> {
      await delay(300);
      const reply = generateReply(question, topic);
      const step = Math.max(4, Math.ceil(reply.length / 40));
      for (let i = step; i <= reply.length; i += step) {
        if (signal?.aborted) break;
        await delay(35);
        onDelta?.({ reply: reply.slice(0, i), complete: i >= reply.length });
      }
      if (!signal?.aborted) onDelta?.({ reply, complete: true });
      return { success: true, data: { reply } };
    },
  },

  translate: {
    async detect(text: string): Promise<AIResponse<TranslateDetectResponse>> {
      await delay(200);
      const trimmed = text.trim();

      let sourceLang = 'en';
      if (/[\u4e00-\u9fff]/.test(trimmed)) sourceLang = 'zh';
      else if (/[\u3040-\u30ff]/.test(trimmed)) sourceLang = 'ja';
      else if (/[\uac00-\ud7af]/.test(trimmed)) sourceLang = 'ko';
      else if (/[\u0400-\u04ff]/.test(trimmed)) sourceLang = 'ru';

      const isPhrase = sourceLang === 'zh'
        ? trimmed.length > 2
        : /\s/.test(trimmed);

      return {
        success: true,
        data: {
          sourceLang,
          isPhrase,
          confidence: 0.95,
        },
      };
    },

    async queryWord(word: string): Promise<AIResponse<DictionaryQueryResponse>> {
      await delay(300);
      const lowerWord = word.toLowerCase();
      const isPhrase = /\s/.test(word.trim()) || word.trim().length > 20;
      const hit = mockWordResult[lowerWord];
      const data = hit || defaultWordData;
      // 未收录时不直接甩"暂无该单词的释义"——演示里点关联术语/常用搭配几乎必然
      // 落到这里，空词条看起来像坏掉；改为按词素给一条标注了降级的拆解释义。
      const definitions = hit ? data.definitions : deriveMockFallbackDefinitions(word);

      // 短语/多词：模拟 AI 分析出的关键词（最多 10 个），带上一句话释义。
      // 词条自带 keywords 时直接用（人工写的比拆词更准）；否则按词表拆。
      const keywords = isPhrase
        ? data.keywords?.length
          ? data.keywords.slice(0, 10)
          : deriveMockKeywords(word, 10)
        : undefined;

      return {
        success: true,
        data: {
          word: data.word || word,
          isPhrase,
          phonetic: data.phonetic,
          definitions: definitions.map((d: { pos: string; meaning: string; example?: { en: string; zh: string } }) => ({
            pos: d.pos,
            meaning: d.meaning,
            example: d.example ? { en: d.example.en, zh: d.example.zh } : undefined,
          })),
          keywords: keywords?.length ? keywords : undefined,
          synonyms: data.synonyms,
          antonyms: data.antonyms,
          relatedTerms: data.relatedTerms,
          collocations: data.collocations || [],
          register: data.register || '',
          etymology: data.etymology || '',
          imageQuery: data.imageQuery,
        },
      };
    },

    async queryTranslate(text: string, sourceLang?: string, targetLang?: string, style?: string): Promise<AIResponse<TranslateQueryResponse>> {
      await delay(400);

      const curated = mockSentenceExtras[text.trim()] || mockSentenceExtras[text.trim().toLowerCase()];
      const translateStyle = (style as 'academic' | 'business' | 'casual') || 'casual';

      // 译文：演示语料表命中 → 用表里的；否则原样返回（Mock 没有真实翻译能力，不编造）
      const translation = curated?.translation ?? text;

      // 对照表：优先用语料表里手写的 `tokens`（按**原文词序**排列，允许译文顺序与原文相反，
      // 例 Good morning → ['好','早上']，正是"按 key 配对而非按位置配对"的演示场景）。
      // 没有手写数据时退回按空白切块 —— 这只是保底，配不上对就不放进数组（界面上是"无键"）。
      const srcTokens = text.trim().split(/\s+/).filter((s) => s.length > 0);
      const segments = curated?.tokens
        ? curated.tokens
            .slice(0, srcTokens.length)
            .map((target, i) => ({ key: i + 1, source: srcTokens[i], target }))
            .filter((seg) => seg.source && seg.target)
        : (() => {
            const tgtParts = translation.split(/(\s+)/).filter((s) => s.length > 0);
            return srcTokens
              .slice(0, tgtParts.length)
              .map((source, i) => ({ key: i + 1, source, target: tgtParts[i] }))
              .filter((seg) => seg.target.length > 0);
          })();

      return {
        success: true,
        data: {
          original: text,
          translation,
          style: translateStyle,
          sourceLang: sourceLang || (/[\u4e00-\u9fff]/.test(text) ? 'zh' : 'en'),
          targetLang: targetLang || (/[\u4e00-\u9fff]/.test(text) ? 'en' : 'zh'),
          segments: segments.length > 0 ? segments : undefined,
          // 没有策展数据时**不编造**关联术语与语法说明 —— 宁可区块不显示，
          // 也不要出现「相关词汇」「语法说明」这种占位垃圾（点它跳知识搜索会搜出一堆无关内容）
          relatedTerms: curated?.relatedTerms,
          keywords: curated?.keywords ?? deriveMockKeywords(text, 6),
          grammarNotes: curated?.grammarNotes,
        },
      };
    },
  },

  document: {
    async generate(type: DocType, topic: string, requirements?: string, tone?: EmailTone): Promise<AIResponse<DocumentGenerateResponse>> {
      await delay(800);
      const template = docTemplates[type];
      const content = template(topic, requirements || '', tone || 'formal');

      return {
        success: true,
        data: {
          type,
          title: `${topic} - ${type}`,
          content,
          tone,
        },
      };
    },

    /** 流式文档生成（Mock）：markdown 正文按段吐出 */
    async generateStream(
      type: DocType,
      topic: string,
      requirements?: string,
      tone?: EmailTone,
      onPartial?: (partial: Partial<DocumentGenerateResponse> & { complete: boolean }) => void,
      signal?: AbortSignal
    ): Promise<AIResponse<DocumentGenerateResponse>> {
      await delay(300);
      const template = docTemplates[type];
      const content = template(topic, requirements || '', tone || 'formal');
      const step = Math.max(12, Math.ceil(content.length / 30));
      for (let i = step; i <= content.length; i += step) {
        if (signal?.aborted) break;
        await delay(40);
        onPartial?.({
          type,
          title: `${topic} - ${type}`,
          content: content.slice(0, i),
          tone,
          complete: i >= content.length,
        });
      }
      const result: DocumentGenerateResponse = {
        type,
        title: `${topic} - ${type}`,
        content,
        tone,
      };
      if (!signal?.aborted) onPartial?.({ ...result, complete: true });
      return { success: true, data: result };
    },

    async export(content: string, format: ExportFormat, metadata?: { title: string }): Promise<AIResponse<DocumentExportResponse>> {
      await delay(300);
      const title = metadata?.title || 'document';
      let blob: Blob;
      let filename: string;

      switch (format) {
        case 'txt':
          blob = new Blob([content], { type: 'text/plain' });
          filename = `${title}.txt`;
          break;
        case 'md':
          blob = new Blob([content], { type: 'text/markdown' });
          filename = `${title}.md`;
          break;
        case 'pdf':
          const pdfContent = `%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 612 792]\n>>\nendobj\ntrailer\n<<\n/Size 4\n/Root 1 0 R\n>>\nstartxref\n158\n%%EOF`;
          blob = new Blob([pdfContent], { type: 'application/pdf' });
          filename = `${title}.pdf`;
          break;
        default:
          blob = new Blob([content], { type: 'text/plain' });
          filename = `${title}.txt`;
      }

      return {
        success: true,
        data: { blob, filename, format },
      };
    },
  },
};