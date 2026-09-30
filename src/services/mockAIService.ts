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
      const data = mockWordResult[lowerWord] || defaultWordData;

      // 短语/多词：模拟 AI 分析出的关键词（最多 10 个）
      const keywords = isPhrase
        ? Array.from(new Set(word.split(/[\s,，、;；]+/).map((w) => w.trim()).filter((w) => w.length > 1))).slice(0, 10)
        : undefined;

      return {
        success: true,
        data: {
          word: data.word || word,
          isPhrase,
          phonetic: data.phonetic,
          definitions: data.definitions.map((d: { pos: string; meaning: string; example?: { en: string; zh: string } }) => ({
            pos: d.pos,
            meaning: d.meaning,
            example: d.example ? { en: d.example.en, zh: d.example.zh } : undefined,
          })),
          keywords,
          synonyms: data.synonyms,
          antonyms: data.antonyms,
          relatedTerms: data.relatedTerms,
          collocations: data.collocations || [],
          register: data.register || '',
          etymology: data.etymology || '',
        },
      };
    },

    async queryTranslate(text: string, sourceLang?: string, targetLang?: string, style?: string): Promise<AIResponse<TranslateQueryResponse>> {
      await delay(400);

      const translations: Record<string, string> = {
        'hello': '你好',
        'hello world': '你好世界',
        'good morning': '早上好',
        'thank you': '谢谢',
        'how are you': '你好吗',
        'goodbye': '再见',
      };

      const trimmed = text.toLowerCase();
      let translation = translations[trimmed] || text;

      const zhEnTranslations: Record<string, string> = {
        '你好': 'hello',
        '谢谢': 'thank you',
        '再见': 'goodbye',
        '早上好': 'good morning',
      };
      if (zhEnTranslations[text]) {
        translation = zhEnTranslations[text];
      }

      const translateStyle = (style as 'academic' | 'business' | 'casual') || 'casual';

      // 对照表（演示用）：按空白切块，逐块配一个 key（从 1 起）。
      // 配不上对（译文块不够）的原文块**不放进数组** —— 界面上就是"无键"，不高亮。
      const srcParts = text.split(/(\s+)/).filter((s) => s.length > 0);
      const tgtParts = translation.split(/(\s+)/).filter((s) => s.length > 0);
      const segments = srcParts
        .slice(0, tgtParts.length)
        .map((source, i) => ({ key: i + 1, source, target: tgtParts[i] }))
        .filter((seg) => seg.target.length > 0);

      return {
        success: true,
        data: {
          original: text,
          translation,
          style: translateStyle,
          sourceLang: sourceLang || (/[\u4e00-\u9fff]/.test(text) ? 'zh' : 'en'),
          targetLang: targetLang || (/[\u4e00-\u9fff]/.test(text) ? 'en' : 'zh'),
          segments,
          relatedTerms: ['相关词汇'],
          keywords: text.split(' ').filter(w => w.length > 2),
          grammarNotes: ['语法说明'],
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