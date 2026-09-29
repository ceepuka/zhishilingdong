/**
 * i18n · 知识搜索模块
 */

export const searchEn = {
  search: {
    tryThese: 'Try these questions:',
    newConversation: 'New conversation',
    send: 'Send',
    directAskHint: 'Ask directly — no search needed. Try one of these:',
    modeSearch: 'Search',
    modeQA: 'Q&A',
    searchBtn: 'Search',
    pageTitle: 'Search knowledge, explore the world',
    pageSubtitle: 'Enter a keyword to get structured knowledge cards and a knowledge graph',
    inputPlaceholder: 'Enter keywords to search...',
    emptyState: 'Enter a keyword to start searching knowledge',
    analyzingOverall: 'Analyzing and generating the overview...',
    /** 首字未到达前的等待提示（思考型模型可能几十秒不给正文） */
    waitingFirstToken: 'Model is thinking... {n}s elapsed',
    waitingHint: 'Content starts rendering as soon as the first token arrives',
    /**
     * 首字等待过长（>30s 仍无响应）时的加重提示。
     * 注意：实际兜底在 sseReader（首字节超时 60s 自动 abort），
     * 这条文案只是让用户早一点意识到"可能有问题"，不会让用户傻等 511s。
     */
    waitingSlow: 'Response is slower than expected. If this persists, check your network or model settings.',
    invalidTitle: 'Invalid query',
    invalidHint: 'Please enter a more specific knowledge query',
    steps: {
      validating: 'Validating query...',
      analyzing: 'Analyzing knowledge structure...',
      mindMap: 'Building the knowledge map...',
      summary: 'Generating the overview...',
      overview: 'Generating concept overview...',
      concepts: 'Generating core concepts...',
      knowledgeContext: 'Generating knowledge context...',
      examQuestions: 'Generating selected exam questions...',
      interestingFacts: 'Generating fun facts...',
      generic: 'Generating...',
    },
    errors: {
      analyzeFailed: 'Analysis failed',
      generateFailed: 'Generation failed',
      /** 生成失败且没有任何可展示内容时的空状态占位（区别于上面仅作为错误条文案的 generateFailed） */
      generateFailedEmpty: 'Nothing was generated. Please try again, or check your network / model settings.',
      incomplete: 'Generation was incomplete — showing what was received',
      empty: 'Generation returned empty — showing what was received',
      generateErrorPartial: 'Generation error — showing what was received',
      generateError: 'Generation error',
      followUpFailed: 'Follow-up failed',
      unknownError: 'Unknown error',
      /** 流式首字节超时（默认 60s 内没收到任何字节）；可能是网络/网关问题，建议稍后重试或换模型 */
      firstByteTimeout: 'Waiting for the model to respond timed out. Please check your network or try a different model.',
      /** 传输层失败（断网 / 连接被重置 / 网关拒绝） */
      networkError: 'Network error — showing what was received. Please check your connection and try again.',
      /** 流式协议异常（流内 error、数据格式不可解析） */
      streamProtocol: 'The streaming response was interrupted or malformed — showing what was received.',
      /** 用户主动取消 */
      cancelled: 'Generation was cancelled.',
      /** 被模型安全策略拦截 */
      contentFiltered: 'The content was stopped by the model safety policy — showing what was received. Try rewording the topic.',
      invalidApiKey: 'The API key is invalid or expired. Please reconfigure it in settings.',
      quotaExceeded: 'Insufficient balance for this API key. Please top up and try again.',
      rateLimited: 'Too many requests. Please wait a moment and try again.',
      serverError: 'The model service is having problems. Please try again later.',
    },
    history: {
      search: 'Search history',
      qa: 'Q&A history',
      lastViewedAt: 'Last viewed',
      expandSearch: 'Expand search history',
      lastViewedAtPrefix: 'Last viewed',
    },
    actions: {
      exportMarkdown: 'Export Markdown',
      showAnswer: 'Show answer',
      answer: 'Answer:',
      explanation: 'Explanation:',
      correctAnswer: 'Correct',
    },
    question: {
      imageAlt: 'Question figure',
      typeChoice: 'Multiple choice',
      typeFill: 'Fill in the blank',
      typeCalculation: 'Calculation',
      typeEssay: 'Short answer',
      difficultyEasy: 'Easy',
      difficultyMedium: 'Medium',
      difficultyHard: 'Hard',
    },
    concept: {
      figureSuffix: ' figure',
      imageSource: 'Source: {source}{license}',
      typeDefinition: 'Definition',
      typeFormula: 'Formula',
      typeTheorem: 'Theorem',
      typePrinciple: 'Principle',
      elementary: 'Plain-language',
      advanced: 'In-depth',
      keyPoints: 'Key points',
      pitfalls: 'Common pitfalls',
      example: 'Example',
    },
    context: {
      prerequisites: 'Prerequisites',
      relatedTopics: 'Related topics',
      learningPath: 'Learning path',
      distinctions: 'Easily confused with',
      conclusions: 'Useful results',
    },
    fact: {
      typeStory: 'Story',
      typeApplication: 'Application',
      typeHistory: 'History',
      typeInteresting: 'Fun facts',
    },
    sections: {
      mindMap: 'Mind map',
      coreConcepts: 'Core concepts',
      overview: 'Overview',
      knowledgeContext: 'Knowledge context',
      examQuestions: 'Classic exam questions',
      interestingFacts: 'Fun facts',
    },
    notices: {
      truncatedTitle: 'Content truncated by the model output limit',
      truncatedBody: 'The last section (usually "Fun facts") may be incomplete. Switch to a flagship model with a higher output limit, or generate again.',
      continued: 'The content was long, so it was automatically continued and completed — safe to use.',
      /**
       * 中断归因提示（分档）。
       * 为什么分档：`truncated` 只说明"不完整"，说明不了"为什么"——
       * 把网络中断也说成"模型输出上限被截断"是错误归因，会误导用户去换模型。
       */
      /** 后缀：自动续写/重试过若干次仍未补全 */
      retriedSuffix: 'Automatic continuation was attempted {n} time(s) and still could not complete it.',
      incompleteTitle: 'Generation ended early',
      incompleteBody: 'The model or gateway ended the stream without a proper end marker, so the last section may be missing. Generate again or switch to another model.',
      contentFilterTitle: 'Content stopped by the model safety policy',
      contentFilterBody: 'Showing what was received before it was stopped. Try rewording the topic and generating again.',
      networkTitle: 'Generation was interrupted by a network problem',
      networkBody: 'Showing everything received before the interruption. Please check your connection and try again.',
      timeoutTitle: 'The model stopped responding',
      timeoutBody: 'Timed out waiting for the model. Showing everything received before the timeout. Check your network or try a different model.',
      protocolTitle: 'The streaming response was interrupted',
      protocolBody: 'The streaming data could not be parsed properly. Showing everything received before the interruption.',
    },
    graph: {
      nodeConcept: 'Concept',
      nodeProcess: 'Process',
      nodeFormula: 'Formula',
      nodeTimeline: 'Timeline',
      nodeCompare: 'Comparison',
      nodeHierarchy: 'Hierarchy',
      directory: 'Knowledge directory',
      childCount: '{n} items',
      expandHint: 'Expand to view the full knowledge hierarchy',
      noData: 'No data',
    },
    qa: {
      title: 'Q&A',
      followUpTitle: 'Follow-up',
      defaultPlaceholder: 'Ask your question and get an answer directly...',
      followUpPlaceholder: 'Keep asking about the current topic...',
      cannotAnswer: "Sorry, I can't answer that question.",
      networkError: 'Network error, please try again later.',
    },
    hotTags: ['Newton’s Second Law', 'Pythagorean Theorem', 'Photosynthesis', 'Trigonometry', 'Chemical Elements', 'Artificial Intelligence'],
    qaExamples: [
      'Explain the basics of quantum mechanics',
      'What is artificial intelligence?',
      'How should I learn programming?',
      'How many planets are in the Solar System?',
    ],
    followUpExamples: [
      'What is artificial intelligence?',
      "What is Newton's Second Law?",
      'How does photosynthesis work?',
      'How is the Pythagorean Theorem used?',
    ],
    mockReplies: {
      greeting: ['Hello! I am your smart assistant, glad to help.', 'Hi! Anything I can help with?', 'Hello! Ask me anything, anytime.'],
      thanks: ["You're welcome! Ask me anything, anytime.", 'Happy to help!', "No problem — enjoy your study!"],
      goodbye: ['Goodbye! Looking forward to helping you next time.', 'Bye! Have a great day.', 'See you! Come back with questions anytime.'],
      fallback: [
        'I can help with all kinds of questions, including knowledge lookup, translation and document drafting.',
        "That's an interesting question! Let me break it down for you.",
        'Let me give you a detailed answer.',
      ],
      followUpTemplate: '{reply} Here is the answer about "{question}".',
    },
  },
};

export type SearchStrings = typeof searchEn;

export const searchZh: SearchStrings = {
  search: {
    tryThese: '试试这些问题：',
    newConversation: '新对话',
    send: '发送',
    directAskHint: '直接提问，无需先搜索。试试下面的问题：',
    modeSearch: '搜索',
    modeQA: '问答',
    searchBtn: '搜索',
    pageTitle: '搜索知识，探索世界',
    pageSubtitle: '输入关键词，获取结构化的知识卡片和知识图谱',
    inputPlaceholder: '输入搜索关键词...',
    emptyState: '输入关键词搜索知识',
    analyzingOverall: '正在分析并生成知识点概览...',
    /** 首字未到达前的等待提示（思考型模型可能几十秒不给正文） */
    waitingFirstToken: '模型正在思考…已等待 {n} 秒',
    waitingHint: '收到第一个字后即开始逐段呈现',
    /**
     * 首字等待过长（>30s 仍无响应）时的加重提示。
     * 注意：实际兜底在 sseReader（首字节超时 60s 自动 abort），
     * 这条文案只是让用户早一点意识到"可能有问题"，不会让用户傻等 511s。
     */
    waitingSlow: '响应比预期慢，如长时间无响应请检查网络或模型设置',
    invalidTitle: '查询无效',
    invalidHint: '请输入更具体的知识查询内容',
    steps: {
      validating: '验证查询...',
      analyzing: '分析知识结构...',
      mindMap: '正在生成知识导图...',
      summary: '正在生成知识点概览...',
      overview: '正在生成核心概念总述...',
      concepts: '正在生成核心概念...',
      knowledgeContext: '正在生成知识脉络...',
      examQuestions: '正在生成试题精选...',
      interestingFacts: '正在生成趣味知识...',
      generic: '正在生成...',
    },
    errors: {
      analyzeFailed: '分析失败',
      generateFailed: '生成失败',
      /** 生成失败且没有任何可展示内容时的空状态占位（区别于上面仅作为错误条文案的 generateFailed） */
      generateFailedEmpty: '未能生成内容，请重试，或检查网络 / 模型设置',
      incomplete: '生成未完整，已展示已收到部分',
      empty: '生成内容为空，已展示已收到部分',
      generateErrorPartial: '生成出错，已展示已收到部分',
      generateError: '生成出错',
      followUpFailed: '追问失败',
      unknownError: '未知错误',
      /** 流式首字节超时（默认 60s 内没收到任何字节）；可能是网络/网关问题，建议稍后重试或换模型 */
      firstByteTimeout: '等待模型响应超时，请检查网络或尝试其他模型',
      /** 传输层失败（断网 / 连接被重置 / 网关拒绝） */
      networkError: '网络异常，已展示已收到内容，请检查网络后重试',
      /** 流式协议异常（流内 error、数据格式不可解析） */
      streamProtocol: '流式响应中断或格式异常，已展示已收到内容',
      /** 用户主动取消 */
      cancelled: '生成已取消',
      /** 被模型安全策略拦截 */
      contentFiltered: '内容被模型安全策略拦截，已展示已收到内容，可调整主题后重试',
      invalidApiKey: '密钥可能失效，请在设置中重新配置',
      quotaExceeded: '密钥余额不足，请充值后重试',
      rateLimited: '请求过于频繁，请稍后重试',
      serverError: '模型服务异常，请稍后重试',
    },
    history: {
      search: '搜索历史',
      qa: '问答历史',
      lastViewedAt: '最后浏览时间',
      expandSearch: '展开搜索历史',
      lastViewedAtPrefix: '最后浏览时间',
    },
    actions: {
      exportMarkdown: '导出 Markdown',
      showAnswer: '查看答案',
      answer: '答案：',
      explanation: '解析：',
      correctAnswer: '正确答案',
    },
    question: {
      imageAlt: '题目配图',
      typeChoice: '选择题',
      typeFill: '填空题',
      typeCalculation: '计算题',
      typeEssay: '问答题',
      difficultyEasy: '简单',
      difficultyMedium: '中等',
      difficultyHard: '困难',
    },
    concept: {
      figureSuffix: '示意图',
      imageSource: '图源：{source}{license}',
      typeDefinition: '定义',
      typeFormula: '公式',
      typeTheorem: '定理',
      typePrinciple: '原理',
      elementary: '初等解释',
      advanced: '高等解释',
      keyPoints: '关键要点',
      pitfalls: '易错提醒',
      example: '示例',
    },
    context: {
      prerequisites: '前置知识',
      relatedTopics: '关联主题',
      learningPath: '学习路径',
      distinctions: '易混辨析',
      conclusions: '常用结论',
    },
    fact: {
      typeStory: '故事',
      typeApplication: '应用',
      typeHistory: '历史',
      typeInteresting: '趣味',
    },
    sections: {
      mindMap: '思维导图',
      coreConcepts: '核心概念',
      overview: '总述',
      knowledgeContext: '知识脉络',
      examQuestions: '经典试题',
      interestingFacts: '趣味知识',
    },
    notices: {
      truncatedTitle: '内容因模型输出上限被截断',
      truncatedBody: '末尾区块（通常是「趣味知识」）可能不完整。建议在设置里换用输出上限更高的旗舰模型，或重新生成一次。',
      continued: '内容较长，已自动续写并补全，可放心使用。',
      /** 中断归因提示（分档）：不能说"输出上限"，因为原因可能是网络/超时 */
      retriedSuffix: '已自动续写 {n} 次仍未补全。',
      incompleteTitle: '生成提前结束',
      incompleteBody: '模型或网关未给出正常结束标记，末尾区块可能不完整。可重新生成，或换用其他模型。',
      contentFilterTitle: '内容被模型安全策略中断',
      contentFilterBody: '已展示中断前收到的内容，可调整主题后重新生成。',
      networkTitle: '生成被网络中断',
      networkBody: '已展示中断前收到的内容，请检查网络后重试。',
      timeoutTitle: '模型响应超时',
      timeoutBody: '等待模型响应超时，已展示超时前收到的内容。请检查网络，或换用其他模型。',
      protocolTitle: '流式响应中断',
      protocolBody: '流式数据格式异常，已展示中断前收到的内容。可换用其他模型重试。',
    },
    graph: {
      nodeConcept: '概念',
      nodeProcess: '过程',
      nodeFormula: '公式',
      nodeTimeline: '时间线',
      nodeCompare: '对比',
      nodeHierarchy: '层级',
      directory: '知识目录',
      childCount: '{n} 项',
      expandHint: '展开可查看完整知识体系层级',
      noData: '暂无数据',
    },
    qa: {
      title: '知识问答',
      followUpTitle: '追问对话',
      defaultPlaceholder: '输入你的问题，直接获取答案...',
      followUpPlaceholder: '基于当前知识点继续追问...',
      cannotAnswer: '抱歉，我无法回答这个问题。',
      networkError: '网络错误，请稍后重试。',
    },
    hotTags: ['牛顿第二定律', '勾股定理', '光合作用', '三角函数', '化学元素', '人工智能'],
    qaExamples: [
      '解释量子力学的基本概念',
      '什么是人工智能？',
      '如何学习编程？',
      '太阳系有多少颗行星？',
    ],
    followUpExamples: [
      '什么是人工智能？',
      '牛顿第二定律是什么？',
      '光合作用如何发生？',
      '勾股定理怎么用？',
    ],
    mockReplies: {
      greeting: ['你好！我是你的智能助手，很高兴为你服务。', '嗨！有什么我可以帮你的吗？', '你好！随时可以问我问题。'],
      thanks: ['不客气！有任何问题随时问我。', '很高兴能帮到你！', '不用谢，祝你学习愉快！'],
      goodbye: ['再见！期待下次为你服务。', '拜拜！祝你有美好的一天。', '再见！有问题随时回来。'],
      fallback: [
        '我可以帮助你解答各种问题，包括知识查询、翻译和文档生成。',
        '这个问题很有意思！我来帮你分析一下。',
        '让我为你详细解答这个问题。',
      ],
      followUpTemplate: '{reply} 这是关于"{question}"的回答。',
    },
  },
};
