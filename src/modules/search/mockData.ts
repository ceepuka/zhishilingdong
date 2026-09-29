import { KnowledgeCardData, KnowledgeNode, NodeLevel } from '../../types';

export const mockKnowledgeData: Record<string, KnowledgeCardData> = {
  '牛顿第一定律': {
    type: 'concept',
    title: '牛顿第一定律',
    category: '物理学',
    tags: ['力学', '经典力学', '公式定理'],
    definition: '物体在不受外力或合外力为零时，保持静止或匀速直线运动状态。',
    points: ['惯性定律', '力是改变运动状态的原因', '静止和匀速直线运动都是平衡状态'],
    example: '冰面上滑行的冰球会保持匀速直线运动直到受到摩擦力。',
  },
  '牛顿第二定律': {
    type: 'concept',
    title: '牛顿第二定律',
    category: '物理学',
    tags: ['力学', '经典力学', '公式定理'],
    definition: '物体的加速度与所受合外力成正比，与物体质量成反比。',
    points: ['公式：F = ma', '加速度方向与合外力方向相同', '单位：牛顿(N) = kg·m/s²'],
    example: '一个质量为2kg的物体受到10N的合外力，其加速度为5m/s²。',
  },
  '牛顿第三定律': {
    type: 'concept',
    title: '牛顿第三定律',
    category: '物理学',
    tags: ['力学', '经典力学', '公式定理'],
    definition: '作用力与反作用力大小相等、方向相反、作用在同一直线上。',
    points: ['作用力和反作用力同时产生', '分别作用在两个不同物体上', '不能相互抵消'],
    example: '推墙时，墙也在推你。',
  },
  '万有引力定律': {
    type: 'concept',
    title: '万有引力定律',
    category: '物理学',
    tags: ['力学', '经典力学', '公式定理'],
    definition: '任何两个质点之间都存在相互吸引的引力，引力大小与质量乘积成正比，与距离平方成反比。',
    points: ['公式：F = G·m₁·m₂/r²', 'G为万有引力常数', '适用于宏观物体'],
    example: '地球绕太阳公转，月球绕地球公转。',
  },
  '化学反应': {
    type: 'process',
    title: '光合作用',
    category: '生物学',
    tags: ['植物学', '新陈代谢', '应用实践'],
    steps: [
      { name: '光反应', desc: '光能转化为化学能，产生ATP和NADPH' },
      { name: '暗反应', desc: '利用ATP和NADPH将CO₂转化为葡萄糖' },
      { name: '产物释放', desc: '释放氧气，储存葡萄糖' },
    ],
  },
  '数学公式': {
    type: 'formula',
    title: '二次方程求根公式',
    category: '数学',
    tags: ['代数', '方程求解', '公式定理'],
    formula: 'x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}',
    description: '用于求解一元二次方程 ax² + bx + c = 0 的根。',
  },
  '历史事件': {
    type: 'timeline',
    title: '工业革命',
    category: '历史',
    tags: ['近代史', '社会变革', '应用实践'],
    events: [
      { time: '1760年', event: '珍妮纺纱机发明，标志工业革命开始' },
      { time: '1785年', event: '瓦特改良蒸汽机' },
      { time: '1804年', event: '第一台蒸汽机车诞生' },
      { time: '1840年', event: '工业革命基本完成' },
    ],
  },
  '生物结构': {
    type: 'hierarchy',
    title: '细胞结构层级',
    category: '生物学',
    tags: ['细胞学', '微观结构', '基础概念'],
    tree: [
      {
        name: '细胞',
        children: [
          { name: '细胞膜', children: [] },
          {
            name: '细胞质',
            children: [
              { name: '线粒体', children: [] },
              { name: '核糖体', children: [] },
            ],
          },
          {
            name: '细胞核',
            children: [{ name: '染色体', children: [] }],
          },
        ],
      },
    ],
  },
  '人工智能': {
    type: 'concept',
    title: '人工智能',
    category: '计算机科学',
    tags: ['机器学习', '深度学习', '进阶理论'],
    definition: '人工智能是计算机科学的一个分支，旨在研究、开发用于模拟、延伸和扩展人的智能的理论、方法、技术及应用系统。',
    points: ['机器学习', '深度学习', '自然语言处理', '计算机视觉'],
    example: 'AI助手可以理解自然语言，回答问题，生成文档。',
  },
  '速度': {
    type: 'concept',
    title: '速度',
    category: '物理学',
    tags: ['运动学', '力学', '基础概念'],
    definition: '速度是描述物体运动快慢和方向的物理量，是矢量。',
    points: ['公式：v = s/t', '速度是矢量，有大小和方向', '单位：m/s 或 km/h'],
    example: '一辆汽车以60km/h的速度向东行驶。',
  },
  '引擎': {
    type: 'concept',
    title: '引擎',
    category: '计算机科学',
    tags: ['系统架构', '应用实践'],
    definition: '引擎是驱动系统运行的核心组件，负责执行核心逻辑和处理请求。',
    points: ['搜索引擎：处理搜索请求和返回结果', '游戏引擎：渲染图形和处理物理', '数据库引擎：管理数据存储和检索'],
    example: 'Google搜索引擎每天处理数十亿次搜索请求。',
  },
};

export const defaultKnowledgeData: KnowledgeCardData = {
  type: 'concept',
  title: '人工智能',
  definition:
    '人工智能是计算机科学的一个分支，旨在研究、开发用于模拟、延伸和扩展人的智能的理论、方法、技术及应用系统。',
  points: ['机器学习', '深度学习', '自然语言处理', '计算机视觉'],
  example: 'AI助手可以理解自然语言，回答问题，生成文档。',
};

export const scopeTags = [
  { id: 'edu-higher', category: '教育阶段', label: '高等教育', description: '大学及以上水平的知识' },
  { id: 'edu-middle', category: '教育阶段', label: '中学教育', description: '初高中水平的知识' },
  { id: 'edu-primary', category: '教育阶段', label: '小学教育', description: '小学水平的知识' },
  { id: 'domain-physics', category: '学科领域', label: '物理学', description: '力学、电磁学、量子力学等' },
  { id: 'domain-computer', category: '学科领域', label: '计算机科学', description: '编程、算法、数据结构等' },
  { id: 'domain-math', category: '学科领域', label: '数学', description: '代数、几何、微积分等' },
  { id: 'domain-chemistry', category: '学科领域', label: '化学', description: '有机化学、无机化学等' },
  { id: 'domain-biology', category: '学科领域', label: '生物学', description: '细胞、遗传学、生态学等' },
  { id: 'domain-history', category: '学科领域', label: '历史', description: '古代史、近代史、现代史等' },
  { id: 'domain-economics', category: '学科领域', label: '经济学', description: '宏观经济、微观经济等' },
  { id: 'type-basic', category: '知识类型', label: '基础概念', description: '入门级别的基础概念' },
  { id: 'type-advanced', category: '知识类型', label: '进阶理论', description: '深入的理论知识' },
  { id: 'type-practice', category: '知识类型', label: '应用实践', description: '实际应用案例' },
  { id: 'type-formula', category: '知识类型', label: '公式定理', description: '数学公式和物理定理' },
];

export const defaultTags = ['物理学', '计算机科学', '数学', '化学', '生物学', '基础概念'];

export const smartTagsMap: Record<string, string[]> = {
  '速度': ['速度', '加速度', '匀速运动', '变速运动'],
  '引擎': ['搜索引擎', '游戏引擎', '渲染引擎', '内燃机'],
  '牛顿': ['牛顿第一定律', '牛顿第二定律', '牛顿第三定律', '万有引力'],
  '物理': ['物理定律', '牛顿第二定律', '万有引力', '相对论', '量子力学'],
  '力学': ['牛顿第一定律', '牛顿第二定律', '牛顿第三定律', '动量守恒'],
  '电磁': ['库仑定律', '欧姆定律', '法拉第电磁感应', '安培定律', '高斯定律'],
  '热力学': ['热力学第一定律', '热力学第二定律', '熵增原理'],
  '光学': ['折射定律', '反射定律', '费马原理', '马吕斯定理'],
  '化学': ['化学反应', '氧化还原反应', '酸碱反应', '元素周期表'],
  '氧化': ['氧化还原反应', '氧化反应', '还原反应'],
  '生物': ['光合作用', '细胞呼吸', '细胞结构', 'DNA复制'],
  '数学': ['数学定理', '勾股定理', '二次方程', '求根公式', '三角函数', '微积分'],
  '方程': ['二次方程', '求根公式', '判别式', '线性方程组'],
  '几何': ['勾股定理', '三角形内角和', '相似三角形'],
  '历史': ['重大历史事件', '工业革命', '文艺复兴', '法国大革命', '第一次世界大战'],
  '算法': ['编程算法', '排序算法', '搜索算法', '动态规划', '图论'],
  '排序': ['排序算法', '冒泡排序', '快速排序', '归并排序'],
  'AI': ['人工智能', '机器学习', '深度学习', '自然语言处理'],
  '学习': ['人工智能', '机器学习', '深度学习', '强化学习'],
};

export const knowledgeGraphData: Record<string, KnowledgeNode[]> = {
  '牛顿第二定律': [
    {
      id: 'newton-2nd',
      title: '牛顿第二定律',
      type: 'concept',
      stage: 'basic',
      category: '物理力学',
      definition: '物体的加速度与所受合外力成正比，与物体质量成反比。',
      points: ['公式：F = ma', '加速度方向与合外力方向相同', '单位：牛顿(N) = kg·m/s²'],
      examples: ['一个质量为2kg的物体受到10N的合外力，其加速度为5m/s²。'],
      relatedIds: ['newton-1st', 'newton-3rd', 'gravity'],
      explanation: {
        basic: '在基础阶段，我们只考虑恒定的合外力和直线运动。加速度保持不变，物体做匀加速运动。',
        advanced: '在进阶阶段，我们引入微积分，考虑变力作用下的运动。加速度可以是时间的函数，需要用导数和积分来描述运动。',
        difference: '基础阶段只考虑实数根，进阶阶段考虑复数/虚数根',
      },
    },
    {
      id: 'newton-1st',
      title: '牛顿第一定律',
      type: 'concept',
      stage: 'basic',
      category: '物理力学',
      definition: '物体在不受外力或合外力为零时，保持静止或匀速直线运动状态。',
      points: ['惯性定律', '力是改变运动状态的原因', '静止和匀速直线运动都是平衡状态'],
      examples: ['冰面上滑行的冰球会保持匀速直线运动直到受到摩擦力'],
      relatedIds: ['newton-2nd'],
      explanation: {
        basic: '物体有保持原有运动状态的性质，称为惯性。质量越大，惯性越大。',
        advanced: '在相对论中，惯性质量等于引力质量，这是广义相对论的基础。',
        difference: '基础阶段讨论经典力学中的惯性，进阶阶段涉及相对论修正',
      },
    },
    {
      id: 'newton-3rd',
      title: '牛顿第三定律',
      type: 'concept',
      stage: 'basic',
      category: '物理力学',
      definition: '作用力与反作用力大小相等、方向相反、作用在同一直线上。',
      points: ['作用力和反作用力同时产生', '分别作用在两个不同物体上', '不能相互抵消'],
      examples: ['推墙时，墙也在推你'],
      relatedIds: ['newton-2nd'],
      explanation: {
        basic: '两个物体之间的相互作用总是成对出现的。',
        advanced: '在电磁场中，牛顿第三定律需要考虑场的动量，作用力和反作用力可能不共线。',
        difference: '基础阶段假设瞬时作用，进阶阶段考虑场的传播延迟',
      },
    },
    {
      id: 'gravity',
      title: '万有引力定律',
      type: 'concept',
      stage: 'advanced',
      category: '物理力学',
      definition: '任何两个质点之间都存在相互吸引的引力，引力大小与质量乘积成正比，与距离平方成反比。',
      points: ['公式：F = G·m₁·m₂/r²', 'G为万有引力常数', '适用于宏观物体'],
      examples: ['地球绕太阳公转，月球绕地球公转'],
      relatedIds: ['newton-2nd'],
      explanation: {
        basic: '地球对物体的引力就是物体的重力，g = GM/R²。',
        advanced: '在广义相对论中，引力被解释为时空弯曲的结果，而非超距作用。',
        difference: '基础阶段用万有引力定律计算，进阶阶段需要用广义相对论处理强引力场',
      },
    },
  ],
  '光合作用': [
    {
      id: 'photosynthesis',
      title: '光合作用',
      type: 'process',
      stage: 'basic',
      category: '生物化学',
      definition: '植物利用光能将二氧化碳和水转化为葡萄糖和氧气的过程。',
      points: ['光反应：光能→化学能', '暗反应：CO₂→葡萄糖', '产生氧气'],
      examples: ['绿色植物在阳光下进行光合作用'],
      relatedIds: ['chloroplast', 'cellular-respiration'],
      explanation: {
        basic: '光合作用分为光反应和暗反应两个阶段，光反应产生ATP和NADPH，暗反应利用它们合成有机物。',
        advanced: '光系统I和II的协同作用，电子传递链的详细机制，以及卡尔文循环的三个阶段。',
        difference: '基础阶段只讲宏观过程，进阶阶段深入到分子机制',
      },
    },
    {
      id: 'chloroplast',
      title: '叶绿体',
      type: 'concept',
      stage: 'basic',
      category: '细胞生物学',
      definition: '植物细胞中进行光合作用的细胞器。',
      points: ['含有叶绿素', '类囊体堆叠成基粒', '基质中进行暗反应'],
      examples: ['叶绿体是植物绿色的来源'],
      relatedIds: ['photosynthesis'],
      explanation: {
        basic: '叶绿体是光合作用的场所，含有捕获光能的色素。',
        advanced: '类囊体膜上的光系统、电子传递链和ATP合酶的结构与功能。',
        difference: '基础阶段描述叶绿体的结构，进阶阶段讲解其分子机制',
      },
    },
    {
      id: 'cellular-respiration',
      title: '细胞呼吸',
      type: 'process',
      stage: 'advanced',
      category: '生物化学',
      definition: '细胞将有机物氧化分解，释放能量并生成ATP的过程。',
      points: ['糖酵解', '柠檬酸循环', '电子传递链'],
      examples: ['线粒体是细胞呼吸的主要场所'],
      relatedIds: ['photosynthesis'],
      explanation: {
        basic: '细胞呼吸分为有氧呼吸和无氧呼吸，有氧呼吸效率更高。',
        advanced: '氧化磷酸化的机制，质子梯度的建立和ATP合成的偶联。',
        difference: '基础阶段讲三个阶段的产物，进阶阶段深入能量转换机制',
      },
    },
  ],
  '二次方程': [
    {
      id: 'quadratic',
      title: '二次方程',
      type: 'concept',
      stage: 'basic',
      category: '数学代数',
      definition: '形如ax² + bx + c = 0的方程，其中a≠0。',
      points: ['最高次数为2', '标准形式', '求解方法：公式法、配方法、因式分解'],
      examples: ['x² - 5x + 6 = 0 的解为 x=2 和 x=3'],
      relatedIds: ['quadratic-formula', 'discriminant'],
      explanation: {
        basic: '二次方程的解可以用求根公式直接计算，判别式决定解的个数。',
        advanced: '在复数域中，二次方程总有两个根（可能重复），涉及复数运算和共轭根定理。',
        difference: '基础阶段只考虑实数根，进阶阶段考虑复数根',
      },
    },
    {
      id: 'quadratic-formula',
      title: '求根公式',
      type: 'formula',
      stage: 'basic',
      category: '数学代数',
      definition: 'x = (-b ± √(b²-4ac)) / 2a',
      points: ['适用于所有二次方程', '判别式D = b²-4ac', 'D>0两实根，D=0一实根，D<0两复根'],
      examples: ['方程2x² + 3x - 5 = 0 的解为 x = (-3±√49)/4'],
      relatedIds: ['quadratic', 'discriminant'],
      explanation: {
        basic: '求根公式是通过配方法推导出来的，直接代入系数即可求解。',
        advanced: '求根公式在数值计算中可能遇到数值稳定性问题，需要考虑计算顺序。',
        difference: '基础阶段直接应用公式，进阶阶段考虑数值计算精度',
      },
    },
    {
      id: 'discriminant',
      title: '判别式',
      type: 'concept',
      stage: 'advanced',
      category: '数学代数',
      definition: 'D = b² - 4ac，用于判断二次方程根的性质。',
      points: ['D>0：两个不同实根', 'D=0：一个实根（重根）', 'D<0：两个共轭复根'],
      examples: ['方程x² + 2x + 5 = 0 的判别式 D = 4 - 20 = -16 < 0，有两个复根'],
      relatedIds: ['quadratic', 'quadratic-formula'],
      explanation: {
        basic: '判别式决定了方程解的类型和个数。',
        advanced: '判别式在代数几何中用于判断二次曲线的类型（椭圆、双曲线、抛物线）。',
        difference: '基础阶段只用于判断根的个数，进阶阶段涉及几何意义',
      },
    },
  ],
};

export const defaultGraphData: KnowledgeNode[] = [
  {
    id: 'ai-intro',
    title: '人工智能',
    type: 'concept',
    stage: 'basic',
    category: '计算机科学',
    definition: '人工智能是计算机科学的一个分支，旨在研究、开发用于模拟、延伸和扩展人的智能的理论、方法、技术及应用系统。',
    points: ['机器学习', '深度学习', '自然语言处理', '计算机视觉'],
    examples: ['AI助手可以理解自然语言，回答问题，生成文档。'],
    relatedIds: ['ml', 'dl', 'nlp'],
    explanation: {
      basic: '人工智能让计算机能够完成通常需要人类智能才能完成的任务，如识别图像、理解语言、做出决策等。',
      advanced: '人工智能涉及神经网络、强化学习、迁移学习等高级技术，以及伦理、安全等社会问题。',
      difference: '基础阶段介绍AI的基本概念和应用，进阶阶段深入算法原理和技术细节',
    },
  },
  {
    id: 'ml',
    title: '机器学习',
    type: 'concept',
    stage: 'basic',
    category: '计算机科学',
    definition: '机器学习是人工智能的一个子集，通过算法让计算机从数据中学习规律并做出预测。',
    points: ['监督学习', '无监督学习', '强化学习'],
    examples: ['垃圾邮件分类、房价预测'],
    relatedIds: ['ai-intro', 'dl'],
    explanation: {
      basic: '机器学习算法可以自动从数据中学习模式，而不需要显式编程。',
      advanced: '机器学习涉及损失函数、优化算法、正则化、模型评估等核心概念。',
      difference: '基础阶段介绍机器学习的基本类型，进阶阶段深入算法原理',
    },
  },
  {
    id: 'dl',
    title: '深度学习',
    type: 'concept',
    stage: 'advanced',
    category: '计算机科学',
    definition: '深度学习是机器学习的一个子集，使用多层神经网络来模拟人脑的学习过程。',
    points: ['神经网络', '卷积神经网络(CNN)', '循环神经网络(RNN)', 'Transformer'],
    examples: ['图像识别、语音识别、机器翻译'],
    relatedIds: ['ai-intro', 'ml', 'nlp'],
    explanation: {
      basic: '深度学习使用多层神经网络处理数据，每层提取不同层次的特征。',
      advanced: '深度学习涉及反向传播、梯度下降、激活函数、网络架构设计等高级技术。',
      difference: '基础阶段介绍神经网络的基本结构，进阶阶段深入训练机制和架构设计',
    },
  },
  {
    id: 'nlp',
    title: '自然语言处理',
    type: 'concept',
    stage: 'advanced',
    category: '计算机科学',
    definition: '自然语言处理是人工智能的一个分支，研究如何让计算机理解、处理和生成人类语言。',
    points: ['文本分类', '情感分析', '机器翻译', '问答系统'],
    examples: ['ChatGPT、Google翻译、智能客服'],
    relatedIds: ['ai-intro', 'dl'],
    explanation: {
      basic: '自然语言处理让计算机能够理解和生成人类语言，实现人与计算机的自然交互。',
      advanced: '自然语言处理涉及词向量、Transformer架构、注意力机制、预训练模型等前沿技术。',
      difference: '基础阶段介绍NLP的基本任务，进阶阶段深入算法和模型架构',
    },
  },
];

const mindMapTestCommon = {
  concepts: [
    {
      type: 'definition' as const,
      title: '测试概念',
      content: {
        elementary: '用通俗的话来说，测试概念是为验证思维导图布局而构造的一个虚拟概念。',
        advanced: '用于测试思维导图布局算法的概念说明。',
      },
    },
  ],
  examples: [
    { title: '测试示例', description: '用于测试思维导图布局的示例。', result: '测试结果。' },
  ],
};

/** mock 生成数据中的核心概念（新格式：双层解释 + 可选示例） */
export interface MockGeneratedConcept {
  type: 'definition' | 'formula' | 'theorem' | 'principle';
  title: string;
  content: { elementary: string; advanced: string };
  notation?: string;
  /** 概念示例（可选，独立于定义卡片展示） */
  example?: string;
  /** 关键要点：3~4 条 */
  keyPoints?: string[];
  /** 易错提醒：1~2 条常见误区 */
  pitfalls?: string[];
  /** 概念配图URL（可选，.jpg/.png）—— 仅在确定直链真实可用时使用 */
  image?: string;
  /** AI 手绘的原理示意图（SVG 源码），几何图/受力图/电路/函数图像等首选 */
  svg?: string;
}

export const generatedKnowledgeData: Record<string, {
  mindMap: { id: string; title: string; level: NodeLevel; description?: string; children?: { id: string; title: string; level: NodeLevel; description?: string; children?: { id: string; title: string; level: NodeLevel; description?: string; children?: { id: string; title: string; level: NodeLevel; description?: string }[] }[] }[] }[];
  concepts: MockGeneratedConcept[];
  examples: { title: string; description: string; steps?: string[]; result?: string }[];
}> = {
  '物理定律': {
    mindMap: [
      { id: 'physics-root', title: '物理定律', level: 'root', children: [
        { id: 'physics-mechanics', title: '经典力学', level: 'branch', children: [
          { id: 'physics-newton', title: '牛顿运动定律', level: 'leaf', description: '包括惯性定律、运动定律和作用反作用定律。' },
          { id: 'physics-kepler', title: '开普勒定律', level: 'leaf', description: '描述行星运动的三大定律。' },
          { id: 'physics-gravity', title: '万有引力', level: 'leaf', description: '任意两物体间的相互吸引力。' },
        ]},
        { id: 'physics-electro', title: '电磁学', level: 'branch', children: [
          { id: 'physics-coulomb', title: '库仑定律', level: 'leaf', description: '电荷间的静电作用力。' },
          { id: 'physics-ohm', title: '欧姆定律', level: 'leaf', description: '电流与电压、电阻的关系。' },
          { id: 'physics-faraday', title: '电磁感应', level: 'leaf', description: '磁通量变化产生电动势。' },
        ]},
        { id: 'physics-thermo', title: '热力学', level: 'branch', children: [
          { id: 'physics-thermo-1', title: '热力学第一定律', level: 'leaf', description: '能量守恒定律。' },
          { id: 'physics-thermo-2', title: '热力学第二定律', level: 'leaf', description: '熵增原理。' },
        ]},
        { id: 'physics-modern', title: '现代物理', level: 'branch', children: [
          { id: 'physics-relativity', title: '相对论', level: 'leaf', description: '爱因斯坦提出的时空理论。' },
          { id: 'physics-quantum', title: '量子力学', level: 'leaf', description: '微观粒子的运动规律。' },
        ]},
      ]},
    ],
    concepts: [
      {
        type: 'definition',
        title: '物理定律定义',
        content: {
          elementary: '简单说，物理定律就是科学家从大量实验和观察中总结出的"自然界的规矩"，比如苹果为什么落地、磁铁为什么相吸。',
          advanced: '物理定律是描述自然界物理现象的基本规律，是物理学的核心理论基础。',
        },
      },
      {
        type: 'principle',
        title: '经典力学原理',
        content: {
          elementary: '经典力学研究肉眼能看到的物体怎么运动，比如汽车行驶、行星公转，核心工具是牛顿三大定律。',
          advanced: '经典力学研究宏观物体的运动规律，包括牛顿三大定律和万有引力定律。',
        },
      },
      {
        type: 'principle',
        title: '电磁学原理',
        content: {
          elementary: '电磁学研究电和磁的现象，比如电灯为什么亮、指南针为什么指北，而且电和磁还能相互转化。',
          advanced: '电磁学研究电荷、电流产生的电场和磁场，以及它们之间的相互作用。',
        },
      },
      {
        type: 'principle',
        title: '热力学原理',
        content: {
          elementary: '热力学研究热和能量的转化，比如烧水时热量怎么传递、发动机怎么把热能变成动力。',
          advanced: '热力学研究能量转换和热现象，包括热力学四大定律。',
        },
      },
      {
        type: 'formula',
        title: '牛顿第二定律公式',
        content: {
          elementary: '想让物体加速就要用力：用的力越大加速越快，物体越重越难加速。',
          advanced: '物体的加速度与合外力成正比，与质量成反比。',
        },
        notation: 'F = ma',
        example: '推空购物车很轻松（质量小、加速度大），装满货物后再推就费力多了。',
      },
      {
        type: 'formula',
        title: '万有引力公式',
        content: {
          elementary: '任何两个有质量的东西都相互吸引：东西越重吸得越紧，离得越远吸得越弱。',
          advanced: '引力大小与质量乘积成正比，与距离平方成反比。',
        },
        notation: 'F = G\\frac{m_1 m_2}{r^2}',
        example: '地球绕太阳公转，就是太阳的引力把地球"拉住"的结果。',
      },
      {
        type: 'formula',
        title: '欧姆定律公式',
        content: {
          elementary: '电流像水流：电压像水压，电阻像水管粗细——水压越大水流越急，水管越细水流越小。',
          advanced: '电流等于电压除以电阻。',
        },
        notation: 'I = \\frac{V}{R}',
        example: '一节1.5V的电池接一个3Ω的小灯泡，电流 I = V/R = 1.5/3 = 0.5A。',
      },
    ],
    examples: [
      { title: '自由落体运动', description: '物体在重力作用下的自由下落运动。', steps: ['根据牛顿第二定律 F = mg', '加速度 a = g ≈ 9.8m/s²', '下落距离 s = ½gt²'], result: '物体做匀加速直线运动。' },
      { title: '电路计算', description: '计算简单电路中的电流和电压。', steps: ['根据欧姆定律 I = V/R', '串联电路：总电阻 R = R₁ + R₂', '并联电路：1/R = 1/R₁ + 1/R₂'], result: '可计算电路中的电流和电压分配。' },
      { title: '地球绕太阳公转', description: '地球在太阳引力作用下做椭圆轨道运动。', steps: ['太阳质量M = 1.99×10³⁰kg，地球质量m = 5.97×10²⁴kg', '日地平均距离r = 1.5×10¹¹m', '计算引力F = G·M·m/r²', '引力提供向心力，地球做圆周运动'], result: '地球公转周期约365天。' },
    ],
  },
  '数学公式': {
    mindMap: [
      { id: 'math-root', title: '二次方程求根', level: 'root', children: [
        { id: 'math-standard', title: '标准形式', level: 'branch', children: [
          { id: 'math-ax2', title: 'ax² + bx + c = 0', level: 'leaf' },
          { id: 'math-a-not-zero', title: 'a ≠ 0', level: 'leaf' },
        ]},
        { id: 'math-methods', title: '求解方法', level: 'branch', children: [
          { id: 'math-formula-method', title: '公式法', level: 'leaf' },
          { id: 'math-complete-square', title: '配方法', level: 'leaf' },
          { id: 'math-factor', title: '因式分解法', level: 'leaf' },
        ]},
        { id: 'math-discriminant', title: '判别式分析', level: 'branch', children: [
          { id: 'math-d-pos', title: 'Δ > 0：两实根', level: 'leaf' },
          { id: 'math-d-zero', title: 'Δ = 0：重根', level: 'leaf' },
          { id: 'math-d-neg', title: 'Δ < 0：复根', level: 'leaf' },
        ]},
      ]},
    ],
    concepts: [
      {
        type: 'definition',
        title: '二次方程定义',
        content: {
          elementary: '最高次数是2的方程就是二次方程，面积问题、抛物线问题里经常遇到它。',
          advanced: '形如 ax² + bx + c = 0（a ≠ 0）的方程称为一元二次方程，其中a、b、c为常数。',
        },
      },
      {
        type: 'formula',
        title: '求根公式',
        content: {
          elementary: '只要把三个系数 a、b、c 套进公式就能算出答案，不用每次重新推导。',
          advanced: '二次方程的解由求根公式给出，是代数学中最基本的公式之一。',
        },
        notation: 'x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}',
        example: '解方程 2x² - 4x - 6 = 0，代入公式得 x = 3 或 x = -1。',
      },
      {
        type: 'theorem',
        title: '韦达定理',
        content: {
          elementary: '不用求出根，就能知道两根的关系：和是 -b/a，积是 c/a。',
          advanced: '若方程 ax² + bx + c = 0 的两根为 x₁、x₂，则 x₁ + x₂ = -b/a，x₁·x₂ = c/a。',
        },
        notation: 'x_1 + x_2 = -\\frac{b}{a},\\quad x_1 x_2 = \\frac{c}{a}',
      },
      {
        type: 'principle',
        title: '判别式原理',
        content: {
          elementary: 'Δ 像一块"预告牌"：Δ大于0有两个答案，等于0只有一个，小于0在实数范围内无解。',
          advanced: 'Δ = b² - 4ac 决定了根的性质：Δ > 0 有两个不等实根，Δ = 0 有重根，Δ < 0 有两个共轭复根。',
        },
      },
    ],
    examples: [
      { title: '求解二次方程', description: '解方程 2x² - 4x - 6 = 0。', steps: ['确定系数：a = 2，b = -4，c = -6', '计算判别式：Δ = (-4)² - 4×2×(-6) = 16 + 48 = 64', 'Δ > 0，有两个不等实根', 'x = (4 ± √64) / 4 = (4 ± 8) / 4', 'x₁ = 3，x₂ = -1'], result: '方程的解为 x = 3 或 x = -1。' },
    ],
  },
  '历史事件': {
    mindMap: [
      { id: 'history-root', title: '工业革命', level: 'root', children: [
        { id: 'history-cause', title: '背景与原因', level: 'branch', children: [
          { id: 'history-enclosure', title: '圈地运动', level: 'leaf' },
          { id: 'history-colony', title: '殖民扩张', level: 'leaf' },
          { id: 'history-tech', title: '技术积累', level: 'leaf' },
        ]},
        { id: 'history-phase', title: '发展阶段', level: 'branch', children: [
          { id: 'history-first', title: '第一次工业革命', level: 'leaf' },
          { id: 'history-second', title: '第二次工业革命', level: 'leaf' },
        ]},
        { id: 'history-impact', title: '影响', level: 'branch', children: [
          { id: 'history-economy', title: '经济变革', level: 'leaf' },
          { id: 'history-society', title: '社会结构', level: 'leaf' },
          { id: 'history-global', title: '全球格局', level: 'leaf' },
        ]},
      ]},
    ],
    concepts: [
      {
        type: 'definition',
        title: '工业革命定义',
        content: {
          elementary: '工业革命就是200多年前机器开始代替手工、工厂开始代替作坊的一场大变革。',
          advanced: '工业革命是指18世纪中期至19世纪，以机器生产取代手工劳动、以工厂制度取代手工作坊的重大技术和社会变革。',
        },
      },
      {
        type: 'principle',
        title: '技术驱动原理',
        content: {
          elementary: '蒸汽机就像当时的"万能发动机"，有了它，纺织、挖矿、火车全都能动起来。',
          advanced: '蒸汽机的改良和应用是第一次工业革命的核心驱动力，推动了纺织、采矿、交通等行业的机械化。',
        },
        example: '1764年珍妮纺纱机让一个工人同时纺8-16根纱，效率提升十几倍，纺织业率先机械化。',
      },
      {
        type: 'principle',
        title: '社会变革原理',
        content: {
          elementary: '工厂建在城市，农民进城当工人，城市越来越大，社会也分成工厂主和工人两大群体。',
          advanced: '工业革命导致了城市化进程加速、阶级结构变化（工业资产阶级和无产阶级形成）以及全球贸易格局重塑。',
        },
      },
    ],
    examples: [
      { title: '珍妮纺纱机的影响', description: '1764年哈格里夫斯发明珍妮纺纱机，大幅提高了纺纱效率。', steps: ['手工纺纱：每人每次只能纺一根纱', '珍妮纺纱机：一人可同时纺8-16根纱', '生产效率提升8-16倍', '推动了纺织工业的快速发展'], result: '纺织业成为工业革命的先导产业，带动了其他行业的机械化。' },
      { title: '蒸汽机车的诞生', description: '1804年特里维西克制造了第一台蒸汽机车，开启了铁路时代。', steps: ['蒸汽机提供动力', '铁轨降低摩擦', '运输效率大幅提升', '铁路网络迅速扩展'], result: '铁路运输革命性地改变了人员和货物的流动方式，促进了全国市场的形成。' },
    ],
  },
  '生物结构': {
    mindMap: [
      { id: 'cell-root', title: '细胞结构', level: 'root', children: [
        { id: 'cell-membrane', title: '细胞膜', level: 'branch', children: [
          { id: 'cell-lipid', title: '磷脂双分子层', level: 'leaf' },
          { id: 'cell-protein', title: '膜蛋白', level: 'leaf' },
          { id: 'cell-transport', title: '物质运输', level: 'leaf' },
        ]},
        { id: 'cell-cytoplasm', title: '细胞质', level: 'branch', children: [
          { id: 'cell-mito', title: '线粒体', level: 'leaf' },
          { id: 'cell-ribosome', title: '核糖体', level: 'leaf' },
          { id: 'cell-er', title: '内质网', level: 'leaf' },
        ]},
        { id: 'cell-nucleus', title: '细胞核', level: 'branch', children: [
          { id: 'cell-dna', title: 'DNA', level: 'leaf' },
          { id: 'cell-chromosome', title: '染色体', level: 'leaf' },
          { id: 'cell-nucleolus', title: '核仁', level: 'leaf' },
        ]},
      ]},
    ],
    concepts: [
      {
        type: 'definition',
        title: '细胞定义',
        content: {
          elementary: '细胞就像生命的"小积木"，不管是参天大树还是人体，都是由细胞搭建起来的。',
          advanced: '细胞是生物体结构和功能的基本单位，所有已知的生物体都由细胞组成。',
        },
      },
      {
        type: 'principle',
        title: '细胞膜原理',
        content: {
          elementary: '细胞膜像小区的门禁：有用的物质放进来，废物排出去，保持内部环境稳定。',
          advanced: '细胞膜由磷脂双分子层构成，具有选择透过性，控制物质进出细胞，维持细胞内环境稳定。',
        },
      },
      {
        type: 'principle',
        title: '线粒体原理',
        content: {
          elementary: '线粒体是细胞的"发电厂"，把食物中的能量转化成细胞能用的ATP。',
          advanced: '线粒体是细胞的"能量工厂"，通过有氧呼吸将有机物中的化学能转化为ATP，供细胞使用。',
        },
        example: '运动员肌肉细胞里线粒体特别多，才能持续提供运动所需的能量。',
      },
      {
        type: 'principle',
        title: '细胞核原理',
        content: {
          elementary: '细胞核是"指挥部"，里面的DNA存着设计图，指挥细胞生产什么蛋白质。',
          advanced: '细胞核是细胞的控制中心，含有遗传物质DNA，通过基因表达调控蛋白质的合成。',
        },
      },
    ],
    examples: [
      { title: '细胞各部分协作', description: '分泌蛋白的合成与分泌过程展示了细胞器的协作。', steps: ['核糖体合成蛋白质', '内质网进行加工和折叠', '高尔基体进一步修饰和包装', '囊泡运输到细胞膜并分泌出细胞'], result: '细胞的各个结构分工明确、紧密协作，共同维持生命活动。' },
    ],
  },
  '速度': {
    mindMap: [
      {
        id: 'speed-root',
        title: '速度',
        level: 'root',
        children: [
          {
            id: 'speed-physics',
            title: '物理学中的速度',
            level: 'branch',
            children: [
              { id: 'speed-vector', title: '速度矢量', level: 'leaf' },
              { id: 'speed-scalar', title: '速率（标量）', level: 'leaf' },
              { id: 'speed-acceleration', title: '加速度', level: 'leaf' },
            ],
          },
          {
            id: 'speed-computer',
            title: '计算机科学中的速度',
            level: 'branch',
            children: [
              { id: 'speed-algorithm', title: '算法速度', level: 'leaf' },
              { id: 'speed-processing', title: '处理速度', level: 'leaf' },
              { id: 'speed-network', title: '网络速度', level: 'leaf' },
            ],
          },
          {
            id: 'speed-daily',
            title: '日常生活中的速度',
            level: 'branch',
            children: [
              { id: 'speed-efficiency', title: '效率速度', level: 'leaf' },
              { id: 'speed-progress', title: '进度速度', level: 'leaf' },
            ],
          },
        ],
      },
    ],
    concepts: [
      {
        type: 'definition',
        title: '速度的定义',
        content: {
          elementary: '速度就是"跑得有多快、朝哪个方向跑"，比如汽车以60km/h向东行驶。',
          advanced: '速度是描述物体运动快慢和方向的物理量，是矢量。速度的大小称为速率。',
        },
      },
      {
        type: 'formula',
        title: '速度公式',
        content: {
          elementary: '平均速度就是路程除以时间；瞬时速度是某一瞬间的快慢，数学上用导数精确描述。',
          advanced: '平均速度 v = Δx / Δt，其中Δx是位移，Δt是时间间隔。瞬时速度是位移对时间的导数。',
        },
        notation: 'v = \\frac{\\Delta x}{\\Delta t}',
        example: '汽车2小时行驶120公里，平均速度 v = 120/2 = 60公里/小时。',
      },
      {
        type: 'theorem',
        title: '匀速直线运动定理',
        content: {
          elementary: '如果一直沿直线、快慢不变地走，走过的距离就和时间成正比。',
          advanced: '当物体做匀速直线运动时，速度保持恒定，位移与时间成正比。',
        },
      },
      {
        type: 'principle',
        title: '相对速度原理',
        content: {
          elementary: '坐在行驶的车里看并排同速的车，会觉得它没动——速度要看相对于谁。',
          advanced: '物体的速度是相对于参考系而言的，不同参考系下观察到的速度可能不同。',
        },
        example: '两车都以60km/h同向行驶，车上乘客看对方是静止的；路边的人看两车都在动。',
      },
    ],
    examples: [
      {
        title: '汽车行驶速度计算',
        description: '一辆汽车在2小时内行驶了120公里，求其平均速度。',
        steps: ['已知：位移Δx = 120公里，时间Δt = 2小时', '根据公式 v = Δx / Δt', '代入得 v = 120 / 2 = 60公里/小时'],
        result: '平均速度为60公里/小时',
      },
      {
        title: '算法时间复杂度对比',
        description: '比较冒泡排序和快速排序在处理1000个数据时的速度差异。',
        steps: ['冒泡排序时间复杂度：O(n²) = 1000² = 100万次比较', '快速排序时间复杂度：O(n log n) ≈ 1000 × 10 = 1万次比较', '快速排序约快100倍'],
        result: '快速排序比冒泡排序快约100倍',
      },
    ],
  },
  '引擎': {
    mindMap: [
      {
        id: 'engine-root',
        title: '引擎',
        level: 'root',
        children: [
          {
            id: 'engine-software',
            title: '软件引擎',
            level: 'branch',
            children: [
              { id: 'engine-search', title: '搜索引擎', level: 'leaf' },
              { id: 'engine-game', title: '游戏引擎', level: 'leaf' },
              { id: 'engine-render', title: '渲染引擎', level: 'leaf' },
            ],
          },
          {
            id: 'engine-mechanical',
            title: '机械引擎',
            level: 'branch',
            children: [
              { id: 'engine-internal', title: '内燃机', level: 'leaf' },
              { id: 'engine-steam', title: '蒸汽机', level: 'leaf' },
              { id: 'engine-electric', title: '电动机', level: 'leaf' },
            ],
          },
          {
            id: 'engine-math',
            title: '数学引擎',
            level: 'branch',
            children: [
              { id: 'engine-calculation', title: '计算引擎', level: 'leaf' },
              { id: 'engine-analysis', title: '分析引擎', level: 'leaf' },
            ],
          },
        ],
      },
    ],
    concepts: [
      {
        type: 'definition',
        title: '引擎的定义',
        content: {
          elementary: '引擎就是系统的"心脏"，提供最核心的动力或功能，没了它整个系统就转不起来。',
          advanced: '引擎是系统的核心组件，负责驱动和控制整个系统的运行，提供核心功能和服务。',
        },
      },
      {
        type: 'principle',
        title: '搜索引擎工作原理',
        content: {
          elementary: '搜索引擎像超级图书管理员：先把全网网页"抄录"下来编目，你提问时快速翻找并按相关性排好给你。',
          advanced: '搜索引擎通过爬虫抓取网页，建立索引，然后根据用户查询进行匹配排序，返回相关结果。',
        },
        example: '搜索"人工智能"时，引擎在索引库中匹配网页，再按PageRank等算法排序返回结果。',
      },
      {
        type: 'principle',
        title: '内燃机工作原理',
        content: {
          elementary: '汽油在气缸里"爆炸"产生高压气体，推动活塞来回运动，把化学能变成动力。',
          advanced: '内燃机通过燃料在气缸内燃烧产生高温高压气体，推动活塞做功，将化学能转化为机械能。',
        },
        example: '汽车发动机通过"进气—压缩—做功—排气"四个冲程循环，不断产生动力。',
      },
    ],
    examples: [
      {
        title: '搜索引擎查询过程',
        description: '用户搜索"人工智能"时，搜索引擎的工作流程。',
        steps: ['1. 用户输入查询词"人工智能"', '2. 搜索引擎在索引库中查找相关网页', '3. 根据PageRank等算法排序', '4. 返回最相关的搜索结果'],
        result: '返回与人工智能相关的网页列表',
      },
      {
        title: '汽车发动机工作循环',
        description: '四冲程内燃机的工作过程。',
        steps: ['1. 进气冲程：吸入空气和燃料混合物', '2. 压缩冲程：压缩混合物', '3. 做功冲程：火花塞点火，气体膨胀推动活塞', '4. 排气冲程：排出废气'],
        result: '完成一个工作循环，产生动力',
      },
    ],
  },
  '牛顿第二定律': {
    mindMap: [
      {
        id: 'newton2-root',
        title: '牛顿第二定律',
        level: 'root',
        children: [
          {
            id: 'newton2-concept',
            title: '核心概念',
            level: 'branch',
            children: [
              { id: 'newton2-force', title: '力', level: 'leaf', description: '物体之间的相互作用，使物体产生加速度或形变。' },
              { id: 'newton2-mass', title: '质量', level: 'leaf', description: '物体所含物质的量，是惯性大小的量度。' },
              { id: 'newton2-accel', title: '加速度', level: 'leaf', description: '速度随时间的变化率，a = Δv/Δt。' },
            ],
          },
          {
            id: 'newton2-formula',
            title: '公式与推导',
            level: 'branch',
            children: [
              { id: 'newton2-fma', title: 'F=ma', level: 'leaf', description: '合外力等于质量乘以加速度，F = m × a。' },
              { id: 'newton2-derivative', title: '动量形式', level: 'leaf', description: 'F = dp/dt，合外力等于动量的变化率。' },
            ],
          },
          {
            id: 'newton2-applications',
            title: '应用场景',
            level: 'branch',
            children: [
              { id: 'newton2-mechanics', title: '经典力学', level: 'leaf', description: '研究宏观物体的运动规律。' },
              { id: 'newton2-engineering', title: '工程应用', level: 'leaf', description: '机械设计、汽车工程等领域。' },
            ],
          },
        ],
      },
    ],
    concepts: [
      {
        type: 'definition',
        title: '牛顿第二定律定义',
        content: {
          elementary: '力是改变物体运动的原因：力越大加速越快，质量越大越难加速，加速度方向和力的方向一致。',
          advanced: '物体的加速度与所受合外力成正比，与物体质量成反比，加速度方向与合外力方向相同。',
        },
      },
      {
        type: 'formula',
        title: '牛顿第二定律公式',
        content: {
          elementary: '合外力等于质量乘以加速度，知道其中两个量就能求第三个。',
          advanced: 'F = ma，其中F是合外力，m是物体质量，a是加速度。',
        },
        notation: 'F = ma',
        keyPoints: [
          'F 指的是合外力，不是某一个力——多个力要先合成再代入',
          'a 与 F 同向：加速度方向永远跟合外力方向一致，跟速度方向无关',
          '公式是瞬时关系：力变了加速度立刻变，但速度不会突变',
        ],
        pitfalls: [
          '漏掉"合"字：把单个力直接当 F 代入，忽略摩擦力或重力的分量',
          '单位不统一：质量必须换算成 kg、力用 N，否则结果会差一个量级',
        ],
        example: '质量2kg的物体受10N的合外力，加速度 a = F/m = 10/2 = 5m/s²。',
        // 受力分析示意图：手绘 SVG 原理图（外链随机图片对知识讲解毫无价值，这里改用示意图）
        svg: "<svg viewBox='0 0 320 200' xmlns='http://www.w3.org/2000/svg'><line x1='30' y1='150' x2='290' y2='150' stroke='#64748b' stroke-width='2'/><rect x='120' y='110' width='70' height='40' fill='#e0f2fe' stroke='#0369a1' stroke-width='2'/><text x='140' y='135' fill='#334155' font-size='14'>m</text><line x1='190' y1='130' x2='270' y2='130' stroke='#dc2626' stroke-width='2'/><polygon points='270,130 258,125 258,135' fill='#dc2626'/><text x='240' y='120' fill='#dc2626' font-size='14'>F</text><line x1='120' y1='130' x2='70' y2='130' stroke='#f59e0b' stroke-width='2'/><polygon points='70,130 82,125 82,135' fill='#f59e0b'/><text x='66' y='120' fill='#f59e0b' font-size='14'>f</text><line x1='30' y1='160' x2='30' y2='178' stroke='#64748b' stroke-width='1'/><line x1='290' y1='160' x2='290' y2='178' stroke='#64748b' stroke-width='1'/><text x='22' y='192' fill='#64748b' font-size='12'>地面</text></svg>",
      },
      {
        type: 'theorem',
        title: '动量定理',
        content: {
          elementary: '力作用一段时间就会改变物体的"运动量"（动量）：力乘时间等于动量变化。',
          advanced: '合外力的冲量等于动量的变化量，即 FΔt = Δp。',
        },
        notation: 'F\\Delta t = \\Delta p',
        example: '安全气囊通过延长撞击时间来减小冲击力，从而保护车内乘员。',
      },
    ],
    examples: [
      {
        title: '物体加速度计算',
        description: '一个质量为2kg的物体受到10N的合外力，求其加速度。',
        steps: ['已知：m = 2kg，F = 10N', '根据公式 F = ma', '变形得 a = F / m', '代入得 a = 10 / 2 = 5 m/s²'],
        result: '加速度为5 m/s²',
      },
      {
        title: '汽车加速性能',
        description: '一辆质量为1000kg的汽车，发动机提供2000N的驱动力，忽略阻力时的加速度。',
        steps: ['已知：m = 1000kg，F = 2000N', '根据公式 a = F / m', '代入得 a = 2000 / 1000 = 2 m/s²'],
        result: '加速度为2 m/s²，约0-100km/h加速需约14秒',
      },
    ],
  },
  '牛顿第一定律': {
    mindMap: [
      {
        id: 'newton1-root',
        title: '牛顿第一定律',
        level: 'root',
        children: [
          {
            id: 'newton1-concept',
            title: '核心概念',
            level: 'branch',
            children: [
              { id: 'newton1-inertia', title: '惯性', level: 'leaf' },
              { id: 'newton1-force', title: '力', level: 'leaf' },
              { id: 'newton1-equilibrium', title: '平衡状态', level: 'leaf' },
            ],
          },
          {
            id: 'newton1-app',
            title: '应用场景',
            level: 'branch',
            children: [
              { id: 'newton1-transport', title: '交通工具', level: 'leaf' },
              { id: 'newton1-sports', title: '体育运动', level: 'leaf' },
            ],
          },
        ],
      },
    ],
    concepts: [
      {
        type: 'definition',
        title: '牛顿第一定律定义',
        content: {
          elementary: '物体不受外力时，动者恒动、静者恒静——这就是惯性定律。',
          advanced: '物体在不受外力或合外力为零时，保持静止或匀速直线运动状态。',
        },
      },
      {
        type: 'principle',
        title: '惯性原理',
        content: {
          elementary: '所有物体都有"惰性"，总想保持原来的运动状态，质量越大越难改变。',
          advanced: '物体具有保持原有运动状态的性质，称为惯性。质量越大，惯性越大。',
        },
        example: '汽车突然刹车时乘客身体继续向前冲，就是惯性的表现，所以要系安全带。',
      },
      {
        type: 'principle',
        title: '平衡状态原理',
        content: {
          elementary: '静止和匀速直线运动其实是"一回事"：合力都为零，加速度都为零。',
          advanced: '静止和匀速直线运动都是平衡状态，此时物体的加速度为零。',
        },
      },
    ],
    examples: [
      {
        title: '冰面上的冰球',
        description: '冰球在冰面上滑行时，摩擦力很小，可以近似认为做匀速直线运动。',
        steps: ['冰球在光滑冰面上滑行', '摩擦力很小，合外力近似为零', '根据牛顿第一定律，冰球保持匀速直线运动', '直到受到明显的摩擦力或碰撞'],
        result: '冰球会继续滑行很长距离',
      },
      {
        title: '汽车刹车时乘客前倾',
        description: '汽车突然刹车时，乘客会向前倾倒。',
        steps: ['汽车和乘客一起以速度v行驶', '汽车刹车减速，乘客身体由于惯性仍保持速度v', '乘客上半身相对于汽车向前运动', '安全带提供约束力，使乘客随汽车一起减速'],
        result: '乘客会感受到向前的惯性力',
      },
    ],
  },
  '牛顿第三定律': {
    mindMap: [
      {
        id: 'newton3-root',
        title: '牛顿第三定律',
        level: 'root',
        children: [
          {
            id: 'newton3-concept',
            title: '核心概念',
            level: 'branch',
            children: [
              { id: 'newton3-action', title: '作用力', level: 'leaf' },
              { id: 'newton3-reaction', title: '反作用力', level: 'leaf' },
              { id: 'newton3-pair', title: '力的作用是相互的', level: 'leaf' },
            ],
          },
          {
            id: 'newton3-char',
            title: '特点',
            level: 'branch',
            children: [
              { id: 'newton3-equal', title: '大小相等', level: 'leaf' },
              { id: 'newton3-opposite', title: '方向相反', level: 'leaf' },
              { id: 'newton3-different', title: '作用在不同物体', level: 'leaf' },
            ],
          },
        ],
      },
    ],
    concepts: [
      {
        type: 'definition',
        title: '牛顿第三定律定义',
        content: {
          elementary: '你用力推墙，墙也用同样大的力推你——力总是相互的。',
          advanced: '作用力与反作用力大小相等、方向相反、作用在同一直线上。',
        },
      },
      {
        type: 'principle',
        title: '力的相互性原理',
        content: {
          elementary: '力从来不会"单独出现"：有作用力就一定有反作用力，同时产生、同时消失。',
          advanced: '两个物体之间的相互作用总是成对出现的，作用力和反作用力同时产生、同时消失。',
        },
        example: '划船时桨向后推水，水就向前推桨，船因此向前行进。',
      },
      {
        type: 'principle',
        title: '作用对象原理',
        content: {
          elementary: '作用力和反作用力分别作用在两个物体上，所以不能互相抵消。',
          advanced: '作用力和反作用力分别作用在两个不同的物体上，不能相互抵消。',
        },
        example: '推墙时人后退而墙不动，正是因为两个力分别作用在人和墙上。',
      },
    ],
    examples: [
      {
        title: '推墙实验',
        description: '当你用力推墙时，墙也会对你施加一个大小相等、方向相反的力。',
        steps: ['人用力F推墙', '墙对人施加反作用力F\'，F\' = -F', '两个力大小相等、方向相反', '人向后退，墙保持静止'],
        result: '作用力和反作用力分别作用在人和墙上',
      },
      {
        title: '火箭升空',
        description: '火箭通过向后喷射燃气获得向前的推力。',
        steps: ['火箭发动机向后喷射高速燃气', '燃气对火箭产生向前的反作用力', '这个反作用力就是火箭的推力', '推力大于重力时，火箭加速升空'],
        result: '火箭利用反作用力获得前进动力',
      },
    ],
  },
  '万有引力定律': {
    mindMap: [
      {
        id: 'gravity-root',
        title: '万有引力定律',
        level: 'root',
        children: [
          {
            id: 'gravity-concept',
            title: '核心概念',
            level: 'branch',
            children: [
              { id: 'gravity-attraction', title: '引力', level: 'leaf' },
              { id: 'gravity-mass', title: '质量', level: 'leaf' },
              { id: 'gravity-distance', title: '距离', level: 'leaf' },
            ],
          },
          {
            id: 'gravity-formula',
            title: '公式与常数',
            level: 'branch',
            children: [
              { id: 'gravity-fg', title: 'F = G·m₁·m₂/r²', level: 'leaf' },
              { id: 'gravity-g', title: '万有引力常数G', level: 'leaf' },
            ],
          },
          {
            id: 'gravity-app',
            title: '应用场景',
            level: 'branch',
            children: [
              { id: 'gravity-planets', title: '行星运动', level: 'leaf' },
              { id: 'gravity-weight', title: '物体重量', level: 'leaf' },
            ],
          },
        ],
      },
    ],
    concepts: [
      {
        type: 'definition',
        title: '万有引力定律定义',
        content: {
          elementary: '任何有质量的物体都互相吸引：质量越大吸得越紧，距离越远吸得越弱。',
          advanced: '任何两个质点之间都存在相互吸引的引力，引力大小与质量乘积成正比，与距离平方成反比。',
        },
      },
      {
        type: 'formula',
        title: '万有引力公式',
        content: {
          elementary: '引力的算法是：两边质量相乘、再除以距离平方，最后乘上引力常数G。',
          advanced: 'F = G·m₁·m₂/r²，其中G为万有引力常数，m₁、m₂为两物体质量，r为两物体质心距离。',
        },
        notation: 'F = G\\frac{m_1 m_2}{r^2}',
      },
      {
        type: 'principle',
        title: '重力原理',
        content: {
          elementary: '我们感受到的"重量"，其实就是地球引力拉着我们；同样的物体在月球上会轻很多。',
          advanced: '地球对物体的引力就是物体的重力，g = GM/R²，其中M为地球质量，R为地球半径。',
        },
        example: '质量10kg的物体在地球表面重 W = mg = 10 × 9.8 = 98N。',
      },
    ],
    examples: [
      {
        title: '地球绕太阳公转',
        description: '地球在太阳引力作用下做椭圆轨道运动。',
        steps: ['太阳质量M = 1.99×10³⁰kg，地球质量m = 5.97×10²⁴kg', '日地平均距离r = 1.5×10¹¹m', '计算引力F = G·M·m/r²', '引力提供向心力，地球做圆周运动'],
        result: '地球公转周期约365天',
      },
      {
        title: '物体重量计算',
        description: '计算一个质量为10kg的物体在地球表面的重量。',
        steps: ['已知：m = 10kg，g ≈ 9.8m/s²', '重量W = m·g', 'W = 10 × 9.8 = 98N'],
        result: '物体重量约为98牛顿',
      },
    ],
  },
  '人工智能': {
    mindMap: [
      {
        id: 'ai-root',
        title: '人工智能',
        level: 'root',
        children: [
          {
            id: 'ai-subfields',
            title: '子领域',
            level: 'branch',
            children: [
              { id: 'ai-ml', title: '机器学习', level: 'leaf' },
              { id: 'ai-dl', title: '深度学习', level: 'leaf' },
              { id: 'ai-nlp', title: '自然语言处理', level: 'leaf' },
              { id: 'ai-cv', title: '计算机视觉', level: 'leaf' },
            ],
          },
          {
            id: 'ai-techniques',
            title: '技术方法',
            level: 'branch',
            children: [
              { id: 'ai-supervised', title: '监督学习', level: 'leaf' },
              { id: 'ai-unsupervised', title: '无监督学习', level: 'leaf' },
              { id: 'ai-reinforcement', title: '强化学习', level: 'leaf' },
            ],
          },
          {
            id: 'ai-applications',
            title: '应用场景',
            level: 'branch',
            children: [
              { id: 'ai-chatbot', title: '聊天机器人', level: 'leaf' },
              { id: 'ai-translation', title: '机器翻译', level: 'leaf' },
              { id: 'ai-recognition', title: '图像识别', level: 'leaf' },
            ],
          },
        ],
      },
    ],
    concepts: [
      {
        type: 'definition',
        title: '人工智能定义',
        content: {
          elementary: '人工智能就是让机器像人一样"聪明"：能看图、能听话、能说话、能做决定。',
          advanced: '人工智能是计算机科学的一个分支，旨在研究、开发用于模拟、延伸和扩展人的智能的理论、方法、技术及应用系统。',
        },
        example: '手机能识别照片里的猫、语音助手能听懂你说话，都是人工智能的应用。',
      },
      {
        type: 'principle',
        title: '机器学习原理',
        content: {
          elementary: '机器学习像教小孩：给机器看大量例子，它自己总结规律，不用人事先写死每条规则。',
          advanced: '机器学习算法通过从数据中学习规律，自动改进性能，而不需要显式编程。',
        },
        example: '给系统看一万张猫和狗的照片，它就能学会分辨新照片里的动物。',
      },
      {
        type: 'principle',
        title: '深度学习原理',
        content: {
          elementary: '深度学习用一层层"人工神经元"模仿大脑，层层提炼特征，越学越准。',
          advanced: '深度学习使用多层神经网络模拟人脑神经元连接，自动提取数据特征并进行学习。',
        },
        example: 'ChatGPT这类大模型就是基于深度学习，通过阅读海量文本学会了理解和生成语言。',
      },
    ],
    examples: [
      {
        title: '图像识别应用',
        description: '使用深度学习识别图片中的猫。',
        steps: ['1. 收集大量猫的图片作为训练数据', '2. 使用卷积神经网络(CNN)训练模型', '3. 输入新图片，模型输出识别结果', '4. 准确率达到99%以上'],
        result: '成功识别图片中的猫',
      },
      {
        title: '智能对话系统',
        description: 'ChatGPT等AI助手的工作原理。',
        steps: ['1. 使用Transformer架构预训练', '2. 学习海量文本数据中的语言规律', '3. 根据用户输入生成上下文相关的回复', '4. 不断优化模型提高对话质量'],
        result: '实现自然语言对话交互',
      },
    ],
  },
  '数学定理': {
    mindMap: [
      { id: 'math-root', title: '数学定理', level: 'root', children: [
        { id: 'math-geometry', title: '几何定理', level: 'branch', children: [
          { id: 'math-pythagorean', title: '勾股定理', level: 'leaf', description: '直角三角形三边关系：a² + b² = c²。' },
          { id: 'math-triangle', title: '三角形内角和', level: 'leaf', description: '三角形三个内角之和为180°。' },
          { id: 'math-similar', title: '相似三角形', level: 'leaf', description: '对应角相等，对应边成比例。' },
        ]},
        { id: 'math-algebra', title: '代数定理', level: 'branch', children: [
          { id: 'math-quadratic', title: '二次方程求根', level: 'leaf', description: 'x = (-b ± √(b²-4ac)) / 2a。' },
          { id: 'math-veita', title: '韦达定理', level: 'leaf', description: '方程根与系数的关系。' },
        ]},
        { id: 'math-calculus', title: '微积分定理', level: 'branch', children: [
          { id: 'math-mean', title: '微分中值定理', level: 'leaf', description: 'f\'(ξ) = (f(b)-f(a))/(b-a)。' },
          { id: 'math-fundamental', title: '微积分基本定理', level: 'leaf', description: '微分与积分互为逆运算。' },
        ]},
      ]},
    ],
    concepts: [
      {
        type: 'definition',
        title: '数学定理定义',
        content: {
          elementary: '定理就是被严格证明"一定正确"的数学结论，推导时可以放心使用。',
          advanced: '数学定理是经过证明为真的数学命题，是数学知识体系的核心组成部分。',
        },
      },
      {
        type: 'principle',
        title: '几何定理原理',
        content: {
          elementary: '几何定理描述图形的性质，比如三角形内角和、相似关系，是证明和计算的依据。',
          advanced: '几何定理描述图形的性质和关系，是几何学的基础。',
        },
        example: '直角边为3和4的直角三角形，由勾股定理得斜边为5。',
      },
      {
        type: 'principle',
        title: '代数定理原理',
        content: {
          elementary: '代数定理研究方程、函数和运算规律，比如韦达定理直接给出根与系数的关系。',
          advanced: '代数定理涉及方程、函数和运算规律，是代数学的基石。',
        },
      },
      {
        type: 'principle',
        title: '微积分定理原理',
        content: {
          elementary: '微积分定理把"瞬时变化"（微分）和"累积总量"（积分）联系起来，二者互为逆运算。',
          advanced: '微积分定理建立了微分与积分之间的联系。',
        },
      },
      {
        type: 'formula',
        title: '勾股定理公式',
        content: {
          elementary: '直角三角形两条短边的平方加起来，等于最长边（斜边）的平方。',
          advanced: '直角三角形两直角边的平方和等于斜边的平方。',
        },
        notation: 'c^2 = a^2 + b^2',
        example: '直角边分别为3、4时，斜边 c = √(9+16) = 5。',
      },
      {
        type: 'formula',
        title: '二次方程求根公式',
        content: {
          elementary: '把系数代入求根公式，任何一元二次方程都能解。',
          advanced: '用于求解一元二次方程的根。',
        },
        notation: 'x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}',
      },
      {
        type: 'theorem',
        title: '韦达定理',
        content: {
          elementary: '两根之和是 -b/a，两根之积是 c/a，不解方程也能研究根的性质。',
          advanced: '若方程 ax² + bx + c = 0 的两根为 x₁、x₂，则 x₁ + x₂ = -b/a，x₁·x₂ = c/a。',
        },
        notation: 'x_1 + x_2 = -\\frac{b}{a},\\quad x_1 x_2 = \\frac{c}{a}',
      },
    ],
    examples: [
      { title: '勾股定理应用', description: '已知直角三角形两直角边分别为3和4，求斜边长度。', steps: ['设直角边a=3, b=4', '根据勾股定理 c² = a² + b²', 'c² = 9 + 16 = 25', 'c = 5'], result: '斜边长度为5。' },
      { title: '二次方程求解', description: '解方程 x² - 5x + 6 = 0。', steps: ['确定系数：a = 1，b = -5，c = 6', '计算判别式：Δ = (-5)² - 4×1×6 = 25 - 24 = 1', 'Δ > 0，有两个不等实根', 'x = (5 ± √1) / 2', 'x₁ = 3，x₂ = 2'], result: '方程的解为 x = 3 或 x = 2。' },
      { title: '三角形内角和验证', description: '验证任意三角形内角和为180°。', steps: ['过三角形顶点作平行线', '利用平行线性质将三个内角转化为平角', '平角为180°', '因此三角形内角和为180°'], result: '证明了三角形内角和定理。' },
    ],
  },
  '光合作用': {
    mindMap: [
      { id: 'photo-root', title: '光合作用', level: 'root', children: [
        { id: 'photo-process', title: '反应过程', level: 'branch', children: [
          { id: 'photo-light', title: '光反应', level: 'leaf', description: '光能转化为化学能，产生ATP和NADPH。' },
          { id: 'photo-dark', title: '暗反应', level: 'leaf', description: '利用ATP和NADPH将CO₂转化为葡萄糖。' },
        ]},
        { id: 'photo-equation', title: '反应式', level: 'branch', children: [
          { id: 'photo-formula', title: '总反应式', level: 'leaf', description: '6CO₂ + 6H₂O → C₆H₁₂O₆ + 6O₂。' },
          { id: 'photo-chlorophyll', title: '叶绿素', level: 'leaf', description: '吸收光能的绿色色素。' },
        ]},
        { id: 'photo-significance', title: '意义', level: 'branch', children: [
          { id: 'photo-energy', title: '能量转换', level: 'leaf', description: '将光能转化为化学能储存。' },
          { id: 'photo-oxygen', title: '产生氧气', level: 'leaf', description: '维持大气中氧气含量。' },
        ]},
      ]},
    ],
    concepts: [
      {
        type: 'definition',
        title: '光合作用定义',
        content: {
          elementary: '植物是"做饭小能手"：晒晒太阳、吸点二氧化碳和水，就能造出养分、放出氧气。',
          advanced: '植物利用光能将二氧化碳和水转化为葡萄糖和氧气的过程。',
        },
      },
      {
        type: 'principle',
        title: '光反应原理',
        content: {
          elementary: '光反应是"收集阳光"的第一步：叶绿素吸收光，把水"拆"开，放出氧气并储存能量。',
          advanced: '光能被叶绿素吸收，分解水产生氧气、ATP和NADPH。',
        },
      },
      {
        type: 'principle',
        title: '暗反应原理',
        content: {
          elementary: '暗反应不需要光直接参与，它用上一步储存的能量把二氧化碳"拼"成糖。',
          advanced: '利用光反应产物将CO₂固定并还原为糖类。',
        },
      },
      {
        type: 'formula',
        title: '光合作用总反应式',
        content: {
          elementary: '六份二氧化碳加六份水，在光和叶绿体作用下，变成一份葡萄糖加六份氧气。',
          advanced: '二氧化碳和水在光能作用下生成葡萄糖和氧气。',
        },
        notation: '6CO_2 + 6H_2O \\xrightarrow{\\text{光能}} C_6H_{12}O_6 + 6O_2',
        example: '收集水生植物在光照下产生的气体，能让带火星的木条复燃，证明放出的是氧气。',
      },
    ],
    examples: [
      { title: '光合作用实验', description: '验证光合作用产生氧气。', steps: ['将水生植物放入密闭容器', '光照一段时间', '收集产生的气体', '用带火星的木条检验', '木条复燃证明产生氧气'], result: '证明光合作用产生氧气。' },
      { title: '光合作用效率', description: '计算光合作用的能量转换效率。', steps: ['入射光能约100%', '被叶绿素吸收约50%', '用于光反应约25%', '最终储存于糖类约1-2%'], result: '光合作用的能量转换效率约为1-2%。' },
    ],
  },
  '化学元素': {
    mindMap: [
      { id: 'chem-root', title: '化学元素', level: 'root', children: [
        { id: 'chem-classify', title: '元素分类', level: 'branch', children: [
          { id: 'chem-metal', title: '金属元素', level: 'leaf', description: '具有导电性、延展性、金属光泽。' },
          { id: 'chem-nonmetal', title: '非金属元素', level: 'leaf', description: '不具备金属特性的元素。' },
          { id: 'chem-metalloid', title: '类金属元素', level: 'leaf', description: '介于金属和非金属之间。' },
        ]},
        { id: 'chem-periodic', title: '元素周期表', level: 'branch', children: [
          { id: 'chem-period', title: '周期', level: 'leaf', description: '元素按电子层数排列。' },
          { id: 'chem-group', title: '族', level: 'leaf', description: '具有相似化学性质的元素。' },
        ]},
        { id: 'chem-properties', title: '基本性质', level: 'branch', children: [
          { id: 'chem-atomic', title: '原子结构', level: 'leaf', description: '质子、中子、电子组成。' },
          { id: 'chem-valence', title: '化合价', level: 'leaf', description: '元素形成化合物时的原子个数比。' },
        ]},
      ]},
    ],
    concepts: [
      {
        type: 'definition',
        title: '化学元素定义',
        content: {
          elementary: '元素是组成万物的"基本积木"：质子数相同的原子就算同一种元素，比如氢、氧、铁。',
          advanced: '化学元素是具有相同核电荷数（质子数）的一类原子的总称。',
        },
        example: '水分子由氢、氧两种元素组成，铁锈主要是铁元素与氧气结合的产物。',
      },
      {
        type: 'principle',
        title: '元素周期律',
        content: {
          elementary: '把元素按"身份证号"（原子序数）排队，它们的性格会像四季一样周而复始地变化。',
          advanced: '元素性质随原子序数递增呈现周期性变化。',
        },
        example: '门捷列夫当年就是靠周期律，在周期表"空位"上预测了好几种当时还没发现的元素。',
      },
      {
        type: 'principle',
        title: '金属元素特性',
        content: {
          elementary: '金属大多能导电、能传热、还能敲打成片或拉成丝。',
          advanced: '金属元素通常具有良好的导电性、导热性和延展性。',
        },
        example: '铜用来做电线、铝用来做飞机外壳、金用来做首饰，都利用了金属的这些特性。',
      },
      {
        type: 'principle',
        title: '非金属元素特性',
        content: {
          elementary: '非金属大多不导电、熔点较低，像碳、硫、氧气都属于这一类。',
          advanced: '非金属元素通常不导电，熔点较低。',
        },
      },
    ],
    examples: [
      { title: '常见金属元素', description: '列举常见金属元素及其用途。', steps: ['铁(Fe)：钢铁工业', '铜(Cu)：电线电缆', '铝(Al)：航空航天', '金(Au)：首饰制造'], result: '金属元素在工业和日常生活中广泛应用。' },
      { title: '元素周期表应用', description: '利用周期表预测元素性质。', steps: ['查找元素在周期表中的位置', '根据周期和族判断性质', '同周期从左到右非金属性增强', '同族从上到下金属性增强'], result: '可以预测元素的化学性质和化合物形成方式。' },
    ],
  },
  '三角函数': {
    mindMap: [
      { id: 'trig-root', title: '三角函数', level: 'root', children: [
        { id: 'trig-basic', title: '基本函数', level: 'branch', children: [
          { id: 'trig-sin', title: '正弦函数', level: 'leaf', description: 'sinθ = 对边/斜边。' },
          { id: 'trig-cos', title: '余弦函数', level: 'leaf', description: 'cosθ = 邻边/斜边。' },
          { id: 'trig-tan', title: '正切函数', level: 'leaf', description: 'tanθ = 对边/邻边。' },
        ]},
        { id: 'trig-identities', title: '三角恒等式', level: 'branch', children: [
          { id: 'trig-pythagorean', title: '勾股恒等式', level: 'leaf', description: 'sin²θ + cos²θ = 1。' },
          { id: 'trig-double', title: '二倍角公式', level: 'leaf', description: 'sin2θ = 2sinθcosθ。' },
        ]},
        { id: 'trig-applications', title: '应用', level: 'branch', children: [
          { id: 'trig-triangle', title: '三角形求解', level: 'leaf', description: '利用正弦定理和余弦定理。' },
          { id: 'trig-wave', title: '波形分析', level: 'leaf', description: '描述周期性现象。' },
        ]},
      ]},
    ],
    concepts: [
      {
        type: 'definition',
        title: '三角函数定义',
        content: {
          elementary: '三角函数研究"角和边"的关系：给定一个角，边长按固定比例变化。',
          advanced: '三角函数是描述三角形中角与边关系的函数。',
        },
      },
      {
        type: 'formula',
        title: '正弦函数',
        content: {
          elementary: '正弦就是"角对着的边"占"斜边"的比例：角越大，这个比例越大（0到1之间）。',
          advanced: '直角三角形中对边与斜边的比值。',
        },
        notation: '\\sin\\theta = \\frac{\\text{对边}}{\\text{斜边}}',
        example: '30°角的直角三角形、斜边为10，对边 a = 10 × sin30° = 10 × 0.5 = 5。',
      },
      {
        type: 'formula',
        title: '余弦函数',
        content: {
          elementary: '余弦是"角旁边的直角边"占"斜边"的比例，和正弦是"搭档"。',
          advanced: '直角三角形中邻边与斜边的比值。',
        },
        notation: '\\cos\\theta = \\frac{\\text{邻边}}{\\text{斜边}}',
      },
      {
        type: 'formula',
        title: '勾股恒等式',
        content: {
          elementary: '不管角怎么变，正弦的平方加余弦的平方永远等于1——这是勾股定理变来的。',
          advanced: '正弦平方加余弦平方等于1。',
        },
        notation: '\\sin^2\\theta + \\cos^2\\theta = 1',
      },
      {
        type: 'principle',
        title: '周期性原理',
        content: {
          elementary: '三角函数像四季轮回：角转满一圈，函数值就开始重复。',
          advanced: '三角函数是周期函数，sin和cos周期为2π，tan周期为π。',
        },
        example: '四季更替、潮汐涨落、交流电变化，都可以用正弦/余弦波来建模。',
      },
    ],
    examples: [
      { title: '直角三角形求解', description: '已知直角三角形一角和斜边，求对边。', steps: ['设角θ = 30°，斜边c = 10', '对边a = c × sinθ', 'sin30° = 0.5', 'a = 10 × 0.5 = 5'], result: '对边长度为5。' },
      { title: '三角恒等式证明', description: '证明 sin²θ + cos²θ = 1。', steps: ['由勾股定理 a² + b² = c²', '两边除以c²得 (a/c)² + (b/c)² = 1', '即 sin²θ + cos²θ = 1'], result: '证明了勾股恒等式。' },
    ],
  },
  '勾股定理': {
    mindMap: [
      { id: 'pythagorean-root', title: '勾股定理', level: 'root', children: [
        { id: 'pythagorean-concept', title: '核心概念', level: 'branch', children: [
          { id: 'pythagorean-right', title: '直角三角形', level: 'leaf' },
          { id: 'pythagorean-hypotenuse', title: '斜边', level: 'leaf' },
          { id: 'pythagorean-leg', title: '直角边', level: 'leaf' },
        ]},
        { id: 'pythagorean-formula', title: '公式表达', level: 'branch', children: [
          { id: 'pythagorean-c2', title: 'c² = a² + b²', level: 'leaf' },
          { id: 'pythagorean-trig', title: '三角函数关系', level: 'leaf' },
        ]},
        { id: 'pythagorean-app', title: '应用场景', level: 'branch', children: [
          { id: 'pythagorean-distance', title: '距离计算', level: 'leaf' },
          { id: 'pythagorean-geometry', title: '几何证明', level: 'leaf' },
        ]},
      ]},
    ],
    concepts: [
      {
        type: 'definition',
        title: '勾股定理定义',
        content: {
          elementary: '直角三角形两条短边的平方加起来，等于最长边（斜边）的平方。',
          advanced: '在直角三角形中，两条直角边的平方和等于斜边的平方。',
        },
        // 示意图：AI 可直接给出 SVG 原理图（几何/受力/电路等），无需依赖外链图片
        svg: "<svg viewBox='0 0 320 200' xmlns='http://www.w3.org/2000/svg'><polygon points='40,170 250,170 40,40' fill='#ecfdf5' stroke='#0f766e' stroke-width='2'/><rect x='40' y='158' width='12' height='12' fill='none' stroke='#0f766e' stroke-width='2'/><text x='130' y='192' fill='#334155' font-size='14'>a</text><text x='262' y='110' fill='#334155' font-size='14'>b</text><text x='96' y='92' fill='#334155' font-size='14'>c</text><text x='52' y='30' fill='#334155' font-size='14'>A</text><text x='258' y='188' fill='#334155' font-size='14'>B</text></svg>",
      },
      {
        type: 'formula',
        title: '勾股定理公式',
        content: {
          elementary: '知道直角三角形的任意两边，就能求第三边：c² = a² + b²。',
          advanced: 'c² = a² + b²，其中c为斜边，a、b为直角边。',
        },
        notation: 'c^2 = a^2 + b^2',
        example: '梯子长10米、底部离墙6米，梯顶高度 b = √(100-36) = 8米。',
      },
      {
        type: 'theorem',
        title: '勾股数',
        content: {
          elementary: '刚好满足定理的整数组叫勾股数，如(3,4,5)、(5,12,13)，做题时可以直接套用。',
          advanced: '满足勾股定理的正整数组称为勾股数，如(3,4,5)、(5,12,13)等。',
        },
      },
      {
        type: 'principle',
        title: '逆定理',
        content: {
          elementary: '如果三角形三边满足 c² = a² + b²，那它一定是直角三角形。',
          advanced: '若三角形三边满足c² = a² + b²，则该三角形为直角三角形。',
        },
      },
    ],
    examples: [
      { title: '梯子靠墙问题', description: '一个梯子长10米，底部距离墙6米，求梯子顶端距离地面高度。', steps: ['梯子长度c=10m，底部距离a=6m', '根据勾股定理 b² = c² - a²', 'b² = 100 - 36 = 64', 'b = 8m'], result: '梯子顶端距离地面8米。' },
      { title: '两点间距离', description: '求平面直角坐标系中两点(1,2)和(4,6)之间的距离。', steps: ['Δx = 4-1 = 3，Δy = 6-2 = 4', '距离d = √(Δx² + Δy²)', 'd = √(9 + 16) = √25 = 5'], result: '两点间距离为5。' },
    ],
  },
  '化学反应': {
    mindMap: [
      { id: 'chem-root', title: '化学反应', level: 'root', children: [
        { id: 'chem-redox', title: '氧化还原反应', level: 'branch', children: [
          { id: 'chem-oxidation', title: '氧化反应', level: 'leaf' },
          { id: 'chem-reduction', title: '还原反应', level: 'leaf' },
          { id: 'chem-redox-equation', title: '氧化还原方程式', level: 'leaf' },
        ]},
        { id: 'chem-acid-base', title: '酸碱反应', level: 'branch', children: [
          { id: 'chem-neutralization', title: '中和反应', level: 'leaf' },
          { id: 'chem-acid', title: '酸的性质', level: 'leaf' },
          { id: 'chem-base', title: '碱的性质', level: 'leaf' },
        ]},
        { id: 'chem-organic', title: '有机反应', level: 'branch', children: [
          { id: 'chem-addition', title: '加成反应', level: 'leaf' },
          { id: 'chem-substitution', title: '取代反应', level: 'leaf' },
          { id: 'chem-elimination', title: '消除反应', level: 'leaf' },
        ]},
      ]},
    ],
    concepts: [
      {
        type: 'definition',
        title: '化学反应定义',
        content: {
          elementary: '化学反应就是物质"变身"：原子重新组合，旧物质消失、新物质生成。',
          advanced: '化学反应是物质发生变化形成新物质的过程，涉及化学键的断裂和形成。',
        },
        example: '氢气燃烧变成水：氢气和氧气"拆开"再"拼成"水分子，性质完全改变。',
      },
      {
        type: 'principle',
        title: '质量守恒定律',
        content: {
          elementary: '反应就像搭积木重新拼：积木（原子）总数不变，所以总质量不变。',
          advanced: '化学反应前后，反应物和生成物的总质量保持不变。',
        },
      },
      {
        type: 'principle',
        title: '能量变化',
        content: {
          elementary: '有的反应放热（像燃烧），有的吸热（像冰块敷伤口降温），都伴随能量进出。',
          advanced: '化学反应伴随着能量变化，吸热反应或放热反应。',
        },
        example: '氢气燃烧 2H₂ + O₂ → 2H₂O 是放热反应，释放大量能量，可作火箭燃料。',
      },
    ],
    examples: [
      { title: '氢气燃烧', description: '氢气在氧气中燃烧生成水。', steps: ['2H₂ + O₂ → 2H₂O', '氢气和氧气反应生成水', '这是一个放热反应', '释放大量能量'], result: '生成水并释放能量。' },
    ],
  },
  '氧化还原反应': {
    mindMap: [
      { id: 'redox-root', title: '氧化还原反应', level: 'root', children: [
        { id: 'redox-concept', title: '核心概念', level: 'branch', children: [
          { id: 'redox-oxidation', title: '氧化（失电子）', level: 'leaf' },
          { id: 'redox-reduction', title: '还原（得电子）', level: 'leaf' },
          { id: 'redox-oxidizing', title: '氧化剂', level: 'leaf' },
          { id: 'redox-reducing', title: '还原剂', level: 'leaf' },
        ]},
        { id: 'redox-types', title: '反应类型', level: 'branch', children: [
          { id: 'redox-combustion', title: '燃烧反应', level: 'leaf' },
          { id: 'redox-displacement', title: '置换反应', level: 'leaf' },
          { id: 'redox-corrosion', title: '腐蚀反应', level: 'leaf' },
        ]},
        { id: 'redox-app', title: '应用场景', level: 'branch', children: [
          { id: 'redox-battery', title: '电池原理', level: 'leaf' },
          { id: 'redox-metal', title: '金属冶炼', level: 'leaf' },
        ]},
      ]},
    ],
    concepts: [
      {
        type: 'definition',
        title: '氧化还原反应定义',
        content: {
          elementary: '氧化还原反应的本质是"抢电子"：一方丢电子被氧化，另一方得电子被还原，总是成对发生。',
          advanced: '氧化还原反应是涉及电子转移的化学反应，氧化和还原同时发生。',
        },
        example: '铁生锈就是铁把电子"给"了氧气，铁被氧化、氧气被还原。',
      },
      {
        type: 'principle',
        title: '氧化数变化',
        content: {
          elementary: '看元素的"氧化数"：升高就是被氧化，降低就是被还原。',
          advanced: '氧化反应中元素氧化数升高，还原反应中元素氧化数降低。',
        },
      },
      {
        type: 'principle',
        title: '电子守恒',
        content: {
          elementary: '电子不会凭空产生或消失：一方丢多少，另一方就得多少，账永远对得平。',
          advanced: '氧化反应失去的电子数等于还原反应得到的电子数。',
        },
        example: '锌铜电池里，锌每失去2个电子，铜离子就恰好得到2个电子。',
      },
      {
        type: 'formula',
        title: '半反应',
        content: {
          elementary: '把一个反应"劈成两半"看：一半写谁丢电子，一半写谁得电子，就清楚多了。',
          advanced: '氧化还原反应可分解为氧化半反应和还原半反应。',
        },
        notation: '\\text{氧化: } Zn \\rightarrow Zn^{2+} + 2e^- \\\\ \\text{还原: } Cu^{2+} + 2e^- \\rightarrow Cu',
      },
    ],
    examples: [
      { title: '铁的生锈', description: '铁在空气中与氧气和水反应生锈。', steps: ['铁与氧气、水发生反应', '4Fe + 3O₂ + 6H₂O → 4Fe(OH)₃', '铁被氧化为Fe³+', '氧气被还原'], result: '生成铁锈（氢氧化铁）。' },
      { title: '电池反应', description: '锌铜原电池的工作原理。', steps: ['锌作为负极被氧化：Zn → Zn²+ + 2e⁻', '铜作为正极被还原：Cu²+ + 2e⁻ → Cu', '电子通过外电路从锌流向铜', '产生电流'], result: '产生电能，锌逐渐溶解，铜逐渐析出。' },
    ],
  },
  '重大历史事件': {
    mindMap: [
      { id: 'history-root', title: '重大历史事件', level: 'root', children: [
        { id: 'history-ancient', title: '古代文明', level: 'branch', children: [
          { id: 'history-egypt', title: '古埃及文明', level: 'leaf' },
          { id: 'history-greece', title: '古希腊文明', level: 'leaf' },
          { id: 'history-rome', title: '古罗马帝国', level: 'leaf' },
        ]},
        { id: 'history-medieval', title: '中世纪', level: 'branch', children: [
          { id: 'history-crusades', title: '十字军东征', level: 'leaf' },
          { id: 'history-black-death', title: '黑死病', level: 'leaf' },
        ]},
        { id: 'history-modern', title: '近现代', level: 'branch', children: [
          { id: 'history-industrial', title: '工业革命', level: 'leaf' },
          { id: 'history-ww1', title: '第一次世界大战', level: 'leaf' },
          { id: 'history-ww2', title: '第二次世界大战', level: 'leaf' },
        ]},
      ]},
    ],
    concepts: [
      {
        type: 'definition',
        title: '重大历史事件定义',
        content: {
          elementary: '重大历史事件就是历史的"转折点"：一件事发生后，整个社会、国家甚至世界都不一样了。',
          advanced: '重大历史事件是对人类历史进程产生深远影响的关键事件。',
        },
        example: '工业革命让机器取代手工，人类从此进入工业时代，城市化进程大大加快。',
      },
      {
        type: 'principle',
        title: '历史发展规律',
        content: {
          elementary: '历史不是乱发生的：一件件事互为因果，像多米诺骨牌一样推动时代前进。',
          advanced: '历史事件之间存在因果联系，共同推动历史发展。',
        },
      },
      {
        type: 'principle',
        title: '文明演进',
        content: {
          elementary: '从古代农耕到现代信息社会，人类文明像爬楼梯一样一层层向上演进。',
          advanced: '从古代文明到现代社会，人类文明不断演进和发展。',
        },
      },
    ],
    examples: [
      { title: '工业革命影响', description: '工业革命对社会经济的深远影响。', steps: ['机器生产取代手工劳动', '工厂制度取代手工作坊', '城市化进程加速', '生产力大幅提升'], result: '人类进入工业时代，社会结构发生重大变革。' },
    ],
  },
  '工业革命': {
    mindMap: [
      { id: 'industrial-root', title: '工业革命', level: 'root', children: [
        { id: 'industrial-causes', title: '背景原因', level: 'branch', children: [
          { id: 'industrial-enclosure', title: '圈地运动', level: 'leaf' },
          { id: 'industrial-colony', title: '殖民扩张', level: 'leaf' },
          { id: 'industrial-tech', title: '技术积累', level: 'leaf' },
        ]},
        { id: 'industrial-phases', title: '发展阶段', level: 'branch', children: [
          { id: 'industrial-first', title: '第一次工业革命', level: 'leaf' },
          { id: 'industrial-second', title: '第二次工业革命', level: 'leaf' },
          { id: 'industrial-third', title: '第三次工业革命', level: 'leaf' },
        ]},
        { id: 'industrial-impact', title: '深远影响', level: 'branch', children: [
          { id: 'industrial-economy', title: '经济变革', level: 'leaf' },
          { id: 'industrial-society', title: '社会结构', level: 'leaf' },
          { id: 'industrial-global', title: '全球格局', level: 'leaf' },
        ]},
      ]},
    ],
    concepts: [
      {
        type: 'definition',
        title: '工业革命定义',
        content: {
          elementary: '18世纪起，机器生产取代手工劳动、工厂取代作坊，人类从此进入工业时代。',
          advanced: '工业革命是18世纪中期至19世纪，以机器生产取代手工劳动、以工厂制度取代手工作坊的重大技术和社会变革。',
        },
      },
      {
        type: 'principle',
        title: '技术驱动原理',
        content: {
          elementary: '蒸汽机改良后提供了稳定的动力，纺织、交通等行业接连实现机械化。',
          advanced: '蒸汽机的改良和应用是第一次工业革命的核心驱动力。',
        },
        example: '珍妮纺纱机让纺纱效率提升8-16倍，纺织业成为工业革命的先导产业。',
      },
      {
        type: 'principle',
        title: '社会变革原理',
        content: {
          elementary: '工厂聚集在城市，农民变工人，城市化加速，世界贸易格局也被重塑。',
          advanced: '工业革命导致城市化加速、阶级结构变化和全球贸易格局重塑。',
        },
        example: '蒸汽机车和铁路网把各地连为一体，全国性市场得以形成。',
      },
    ],
    examples: [
      { title: '珍妮纺纱机', description: '1764年哈格里夫斯发明珍妮纺纱机。', steps: ['手工纺纱：一人一次纺1根纱', '珍妮纺纱机：一人一次纺8-16根纱', '生产效率提升8-16倍', '推动纺织工业机械化'], result: '纺织业成为工业革命的先导产业。' },
      { title: '蒸汽机车', description: '1804年特里维西克制造第一台蒸汽机车。', steps: ['蒸汽机提供动力', '铁轨降低摩擦', '运输效率大幅提升', '铁路网络迅速扩展'], result: '开启铁路时代，改变人员和货物流动方式。' },
    ],
  },
  '编程算法': {
    mindMap: [
      { id: 'algo-root', title: '编程算法', level: 'root', children: [
        { id: 'algo-sorting', title: '排序算法', level: 'branch', children: [
          { id: 'algo-bubble', title: '冒泡排序', level: 'leaf' },
          { id: 'algo-quick', title: '快速排序', level: 'leaf' },
          { id: 'algo-merge', title: '归并排序', level: 'leaf' },
        ]},
        { id: 'algo-searching', title: '搜索算法', level: 'branch', children: [
          { id: 'algo-linear', title: '线性查找', level: 'leaf' },
          { id: 'algo-binary', title: '二分查找', level: 'leaf' },
          { id: 'algo-dfs', title: '深度优先搜索', level: 'leaf' },
        ]},
        { id: 'algo-graph', title: '图算法', level: 'branch', children: [
          { id: 'algo-dijkstra', title: 'Dijkstra算法', level: 'leaf' },
          { id: 'algo-floyd', title: 'Floyd算法', level: 'leaf' },
          { id: 'algo-kruskal', title: 'Kruskal算法', level: 'leaf' },
        ]},
      ]},
    ],
    concepts: [
      {
        type: 'definition',
        title: '算法定义',
        content: {
          elementary: '算法就是解决问题的"菜谱"：按固定步骤一步步做，就一定能得到结果。',
          advanced: '算法是解决特定问题的一系列明确、有限的步骤，是计算机程序的核心。',
        },
        example: '菜谱的"先切菜、再起锅、翻炒3分钟"就是一种算法——步骤明确、可重复。',
      },
      {
        type: 'principle',
        title: '时间复杂度',
        content: {
          elementary: '时间复杂度看数据翻倍时"耗时涨多快"：有的几乎不涨，有的要多花一倍，有的翻四倍。',
          advanced: '时间复杂度描述算法运行时间随输入规模增长的趋势。',
        },
        example: '1000条数据时，O(n²)的冒泡排序约100万次比较，O(n log n)的快速排序约1万次，差约100倍。',
      },
      {
        type: 'principle',
        title: '空间复杂度',
        content: {
          elementary: '空间复杂度看算法处理数据时"额外占多少内存"：数据越大，占的地方涨得快慢不同。',
          advanced: '空间复杂度描述算法所需内存空间随输入规模增长的趋势。',
        },
      },
    ],
    examples: [
      { title: '排序算法对比', description: '比较冒泡排序和快速排序的性能。', steps: ['冒泡排序：O(n²)，简单但效率低', '快速排序：O(n log n)，高效但实现复杂', '小规模数据：冒泡排序可能更快', '大规模数据：快速排序优势明显'], result: '选择合适的算法取决于数据规模和场景。' },
    ],
  },
  '排序算法': {
    mindMap: [
      { id: 'sort-root', title: '排序算法', level: 'root', children: [
        { id: 'sort-simple', title: '简单排序', level: 'branch', children: [
          { id: 'sort-bubble', title: '冒泡排序 O(n²)', level: 'leaf' },
          { id: 'sort-selection', title: '选择排序 O(n²)', level: 'leaf' },
          { id: 'sort-insertion', title: '插入排序 O(n²)', level: 'leaf' },
        ]},
        { id: 'sort-efficient', title: '高效排序', level: 'branch', children: [
          { id: 'sort-quick', title: '快速排序 O(n log n)', level: 'leaf' },
          { id: 'sort-merge', title: '归并排序 O(n log n)', level: 'leaf' },
          { id: 'sort-heap', title: '堆排序 O(n log n)', level: 'leaf' },
        ]},
        { id: 'sort-compare', title: '算法对比', level: 'branch', children: [
          { id: 'sort-time', title: '时间复杂度', level: 'leaf' },
          { id: 'sort-space', title: '空间复杂度', level: 'leaf' },
          { id: 'sort-stable', title: '稳定性', level: 'leaf' },
        ]},
      ]},
    ],
    concepts: [
      {
        type: 'definition',
        title: '排序算法定义',
        content: {
          elementary: '排序就是把一串数据按从小到大（或从大到小）重新排好。',
          advanced: '排序算法是将一组数据按照特定顺序（通常是升序或降序）排列的算法。',
        },
        example: '数组 [5, 3, 8, 4, 2] 经冒泡排序后变为 [2, 3, 4, 5, 8]。',
      },
      {
        type: 'principle',
        title: '交换排序',
        content: {
          elementary: '相邻元素两两比较，顺序不对就交换，像气泡上浮一样把最大值"冒"到末尾。',
          advanced: '通过交换元素位置实现排序，如冒泡排序和快速排序。',
        },
        example: '冒泡排序每轮把当前最大值移到末尾，经过 n-1 轮后数组全部有序。',
      },
      {
        type: 'principle',
        title: '选择排序',
        content: {
          elementary: '每轮从剩余数据里挑出最小的元素，放到已排好部分的末尾。',
          advanced: '每次选择最小（或最大）元素放到已排序部分的末尾。',
        },
      },
      {
        type: 'principle',
        title: '插入排序',
        content: {
          elementary: '像理扑克牌：把每张新牌插入手中已排好的牌序里的正确位置。',
          advanced: '将元素插入到已排序部分的正确位置。',
        },
      },
    ],
    examples: [
      { title: '冒泡排序过程', description: '对数组[5, 3, 8, 4, 2]进行冒泡排序。', steps: ['第一轮：比较交换得[3, 5, 4, 2, 8]', '第二轮：比较交换得[3, 4, 2, 5, 8]', '第三轮：比较交换得[3, 2, 4, 5, 8]', '第四轮：比较交换得[2, 3, 4, 5, 8]'], result: '排序完成，数组变为[2, 3, 4, 5, 8]。' },
      { title: '快速排序过程', description: '对数组[5, 3, 8, 4, 2]进行快速排序。', steps: ['选择基准元素5', '分区：小于5的放左边，大于5的放右边', '得到[3, 4, 2] [5] [8]', '递归排序左右子数组'], result: '排序完成，平均时间复杂度O(n log n)。' },
    ],
  },
  // ========== 思维导图布局测试专用数据 ==========
  '思维导图测试-3层': {
    mindMap: [
      { id: 'test3-root', title: '3层结构测试', level: 'root', children: [
        { id: 'test3-b1', title: '分支A', level: 'branch', children: [
          { id: 'test3-l1', title: '叶子1', level: 'leaf', description: '叶子节点1的描述说明。' },
          { id: 'test3-l2', title: '叶子2', level: 'leaf', description: '叶子节点2的描述说明。' },
        ]},
        { id: 'test3-b2', title: '分支B', level: 'branch', children: [
          { id: 'test3-l3', title: '叶子3', level: 'leaf', description: '叶子节点3的描述说明。' },
        ]},
      ]},
    ],
    ...mindMapTestCommon,
  },
  // 测试2: 标准4层结构 (root → branch → subBranch → leaf)
  '思维导图测试-4层': {
    mindMap: [
      { id: 'test4-root', title: '4层结构测试', level: 'root', children: [
        { id: 'test4-b1', title: '一级分支A', level: 'branch', children: [
          { id: 'test4-sb1', title: '二级分支A1', level: 'subBranch', children: [
            { id: 'test4-l1', title: '叶子1', level: 'leaf', description: '四层结构叶子1的描述。' },
            { id: 'test4-l2', title: '叶子2', level: 'leaf', description: '四层结构叶子2的描述。' },
          ]},
          { id: 'test4-sb2', title: '二级分支A2', level: 'subBranch', children: [
            { id: 'test4-l3', title: '叶子3', level: 'leaf', description: '四层结构叶子3的描述。' },
          ]},
        ]},
        { id: 'test4-b2', title: '一级分支B', level: 'branch', children: [
          { id: 'test4-sb3', title: '二级分支B1', level: 'subBranch', children: [
            { id: 'test4-l4', title: '叶子4', level: 'leaf', description: '四层结构叶子4的描述。' },
            { id: 'test4-l5', title: '叶子5', level: 'leaf', description: '四层结构叶子5的描述。' },
          ]},
        ]},
      ]},
    ],
    ...mindMapTestCommon,
  },
  // 测试3: 3-4层混合结构 (部分branch有subBranch，部分直接到leaf)
  '思维导图测试-混合': {
    mindMap: [
      { id: 'testmix-root', title: '混合结构测试', level: 'root', children: [
        // 这个分支是4层
        { id: 'testmix-b1', title: '深层分支', level: 'branch', children: [
          { id: 'testmix-sb1', title: '二级分支', level: 'subBranch', children: [
            { id: 'testmix-l1', title: '深层叶子1', level: 'leaf', description: '混合结构中4层路径的叶子节点。' },
            { id: 'testmix-l2', title: '深层叶子2', level: 'leaf', description: '混合结构中4层路径的另一个叶子。' },
          ]},
        ]},
        // 这个分支是3层（直接到leaf）
        { id: 'testmix-b2', title: '浅层分支A', level: 'branch', children: [
          { id: 'testmix-l3', title: '浅层叶子1', level: 'leaf', description: '混合结构中3层路径的叶子节点。' },
          { id: 'testmix-l4', title: '浅层叶子2', level: 'leaf', description: '混合结构中3层路径的另一个叶子。' },
        ]},
        // 这个分支也是3层
        { id: 'testmix-b3', title: '浅层分支B', level: 'branch', children: [
          { id: 'testmix-l5', title: '浅层叶子3', level: 'leaf', description: '混合结构中另一个3层路径的叶子。' },
        ]},
      ]},
    ],
    ...mindMapTestCommon,
  },
  // 测试4: 多节点结构 (测试大量节点时的布局)
  '思维导图测试-多节点': {
    mindMap: [
      { id: 'testmulti-root', title: '多节点测试', level: 'root', children: [
        { id: 'testmulti-b1', title: '分支1', level: 'branch', children: [
          { id: 'testmulti-l1', title: '叶子1-1', level: 'leaf', description: '多节点测试叶子1-1。' },
          { id: 'testmulti-l2', title: '叶子1-2', level: 'leaf', description: '多节点测试叶子1-2。' },
          { id: 'testmulti-l3', title: '叶子1-3', level: 'leaf', description: '多节点测试叶子1-3。' },
          { id: 'testmulti-l4', title: '叶子1-4', level: 'leaf', description: '多节点测试叶子1-4。' },
        ]},
        { id: 'testmulti-b2', title: '分支2', level: 'branch', children: [
          { id: 'testmulti-l5', title: '叶子2-1', level: 'leaf', description: '多节点测试叶子2-1。' },
          { id: 'testmulti-l6', title: '叶子2-2', level: 'leaf', description: '多节点测试叶子2-2。' },
          { id: 'testmulti-l7', title: '叶子2-3', level: 'leaf', description: '多节点测试叶子2-3。' },
        ]},
        { id: 'testmulti-b3', title: '分支3', level: 'branch', children: [
          { id: 'testmulti-l8', title: '叶子3-1', level: 'leaf', description: '多节点测试叶子3-1。' },
          { id: 'testmulti-l9', title: '叶子3-2', level: 'leaf', description: '多节点测试叶子3-2。' },
        ]},
        { id: 'testmulti-b4', title: '分支4', level: 'branch', children: [
          { id: 'testmulti-l10', title: '叶子4-1', level: 'leaf', description: '多节点测试叶子4-1。' },
          { id: 'testmulti-l11', title: '叶子4-2', level: 'leaf', description: '多节点测试叶子4-2。' },
          { id: 'testmulti-l12', title: '叶子4-3', level: 'leaf', description: '多节点测试叶子4-3。' },
        ]},
        { id: 'testmulti-b5', title: '分支5', level: 'branch', children: [
          { id: 'testmulti-l13', title: '叶子5-1', level: 'leaf', description: '多节点测试叶子5-1。' },
          { id: 'testmulti-l14', title: '叶子5-2', level: 'leaf', description: '多节点测试叶子5-2。' },
        ]},
      ]},
    ],
    ...mindMapTestCommon,
  },
  // 测试5: 少节点结构 (测试最简布局)
  '思维导图测试-少节点': {
    mindMap: [
      { id: 'testmin-root', title: '少节点测试', level: 'root', children: [
        { id: 'testmin-b1', title: '唯一分支', level: 'branch', children: [
          { id: 'testmin-l1', title: '唯一叶子', level: 'leaf', description: '最少节点结构的叶子。' },
        ]},
      ]},
    ],
    ...mindMapTestCommon,
  },
  // ========== 极端测试用例 ==========
  // 测试6: 10个一级分支（超出5个限制）
  '极端测试-10分支': {
    mindMap: [
      { id: 'ext10-root', title: '十分支测试', level: 'root', children: [
        { id: 'ext10-b1', title: '分支1', level: 'branch', children: [
          { id: 'ext10-l1', title: '叶子1', level: 'leaf', description: '十分支测试叶子1。' },
        ]},
        { id: 'ext10-b2', title: '分支2', level: 'branch', children: [
          { id: 'ext10-l2', title: '叶子2', level: 'leaf', description: '十分支测试叶子2。' },
        ]},
        { id: 'ext10-b3', title: '分支3', level: 'branch', children: [
          { id: 'ext10-l3', title: '叶子3', level: 'leaf', description: '十分支测试叶子3。' },
        ]},
        { id: 'ext10-b4', title: '分支4', level: 'branch', children: [
          { id: 'ext10-l4', title: '叶子4', level: 'leaf', description: '十分支测试叶子4。' },
        ]},
        { id: 'ext10-b5', title: '分支5', level: 'branch', children: [
          { id: 'ext10-l5', title: '叶子5', level: 'leaf', description: '十分支测试叶子5。' },
        ]},
        { id: 'ext10-b6', title: '分支6', level: 'branch', children: [
          { id: 'ext10-l6', title: '叶子6', level: 'leaf', description: '十分支测试叶子6。' },
        ]},
        { id: 'ext10-b7', title: '分支7', level: 'branch', children: [
          { id: 'ext10-l7', title: '叶子7', level: 'leaf', description: '十分支测试叶子7。' },
        ]},
        { id: 'ext10-b8', title: '分支8', level: 'branch', children: [
          { id: 'ext10-l8', title: '叶子8', level: 'leaf', description: '十分支测试叶子8。' },
        ]},
        { id: 'ext10-b9', title: '分支9', level: 'branch', children: [
          { id: 'ext10-l9', title: '叶子9', level: 'leaf', description: '十分支测试叶子9。' },
        ]},
        { id: 'ext10-b10', title: '分支10', level: 'branch', children: [
          { id: 'ext10-l10', title: '叶子10', level: 'leaf', description: '十分支测试叶子10。' },
        ]},
      ]},
    ],
    ...mindMapTestCommon,
  },
  // 测试7: 叶子节点无描述
  '极端测试-无描述': {
    mindMap: [
      { id: 'extnodesc-root', title: '无描述测试', level: 'root', children: [
        { id: 'extnodesc-b1', title: '分支A', level: 'branch', children: [
          { id: 'extnodesc-l1', title: '叶子1', level: 'leaf' },
          { id: 'extnodesc-l2', title: '叶子2', level: 'leaf' },
        ]},
        { id: 'extnodesc-b2', title: '分支B', level: 'branch', children: [
          { id: 'extnodesc-l3', title: '叶子3', level: 'leaf' },
        ]},
      ]},
    ],
    ...mindMapTestCommon,
  },
  // 测试8: 非叶子节点有描述（违反规则的情况）
  '极端测试-非叶描述': {
    mindMap: [
      { id: 'extbrdesc-root', title: '非叶描述测试', level: 'root', description: '根节点不应该有描述', children: [
        { id: 'extbrdesc-b1', title: '分支A', level: 'branch', description: '分支节点不应该有描述', children: [
          { id: 'extbrdesc-l1', title: '叶子1', level: 'leaf', description: '叶子节点的正常描述。' },
          { id: 'extbrdesc-l2', title: '叶子2', level: 'leaf', description: '另一个叶子的描述。' },
        ]},
        { id: 'extbrdesc-b2', title: '分支B', level: 'branch', description: '这个分支也不应该有描述', children: [
          { id: 'extbrdesc-l3', title: '叶子3', level: 'leaf' },
        ]},
      ]},
    ],
    ...mindMapTestCommon,
  },
  // 测试9: 超长标题
  '极端测试-超长标题': {
    mindMap: [
      { id: 'extlong-root', title: '超长标题测试这是一个非常长的根节点标题用于测试布局算法', level: 'root', children: [
        { id: 'extlong-b1', title: '这是一个非常长的一级分支标题用来测试节点宽度计算', level: 'branch', children: [
          { id: 'extlong-l1', title: '短', level: 'leaf', description: '短标题叶子。' },
          { id: 'extlong-l2', title: '这是一个非常长的叶子节点标题用来测试叶子节点宽度计算是否会超出布局', level: 'leaf', description: '长标题叶子的描述。' },
        ]},
        { id: 'extlong-b2', title: '正常分支', level: 'branch', children: [
          { id: 'extlong-l3', title: '正常叶子', level: 'leaf', description: '正常描述。' },
        ]},
      ]},
    ],
    ...mindMapTestCommon,
  },
  // 测试10: 极度不均匀分布
  '极端测试-不均匀': {
    mindMap: [
      { id: 'extuneven-root', title: '不均匀分布测试', level: 'root', children: [
        // 这个分支有大量子节点
        { id: 'extuneven-b1', title: '大分支', level: 'branch', children: [
          { id: 'extuneven-l1', title: '叶子1', level: 'leaf', description: '不均匀测试叶子1。' },
          { id: 'extuneven-l2', title: '叶子2', level: 'leaf', description: '不均匀测试叶子2。' },
          { id: 'extuneven-l3', title: '叶子3', level: 'leaf', description: '不均匀测试叶子3。' },
          { id: 'extuneven-l4', title: '叶子4', level: 'leaf', description: '不均匀测试叶子4。' },
          { id: 'extuneven-l5', title: '叶子5', level: 'leaf', description: '不均匀测试叶子5。' },
          { id: 'extuneven-l6', title: '叶子6', level: 'leaf', description: '不均匀测试叶子6。' },
          { id: 'extuneven-l7', title: '叶子7', level: 'leaf', description: '不均匀测试叶子7。' },
        ]},
        // 这个分支只有1个子节点
        { id: 'extuneven-b2', title: '小分支', level: 'branch', children: [
          { id: 'extuneven-l8', title: '唯一叶子', level: 'leaf', description: '不均匀测试唯一叶子。' },
        ]},
      ]},
    ],
    ...mindMapTestCommon,
  },
  // 测试11: 只有根节点（无子节点）
  '极端测试-仅根节点': {
    mindMap: [
      { id: 'extroot-root', title: '只有根节点', level: 'leaf', description: '这是唯一的节点，既是根也是叶子。' },
    ],
    ...mindMapTestCommon,
  },
  // 测试12: 2层结构（root → leaf，无中间分支）
  '极端测试-2层': {
    mindMap: [
      { id: 'ext2-root', title: '二层结构', level: 'root', children: [
        { id: 'ext2-l1', title: '直接叶子1', level: 'leaf', description: '直接挂在根下的叶子1。' },
        { id: 'ext2-l2', title: '直接叶子2', level: 'leaf', description: '直接挂在根下的叶子2。' },
        { id: 'ext2-l3', title: '直接叶子3', level: 'leaf', description: '直接挂在根下的叶子3。' },
      ]},
    ],
    ...mindMapTestCommon,
  },
  // 测试13: 模拟"函数"搜索 - 深层且多分支
  '函数': {
    mindMap: [
      { id: 'func-root', title: '函数', level: 'root', children: [
        { id: 'func-def', title: '定义与概念', level: 'branch', children: [
          { id: 'func-def-sub', title: '函数定义', level: 'subBranch', children: [
            { id: 'func-def-l1', title: '映射关系', level: 'leaf', description: '函数是集合间的映射关系，每个输入对应唯一输出。' },
            { id: 'func-def-l2', title: '定义域与值域', level: 'leaf', description: '自变量的取值范围叫定义域，因变量的取值范围叫值域。' },
          ]},
        ]},
        { id: 'func-type', title: '函数类型', level: 'branch', children: [
          { id: 'func-type-sub', title: '基本初等函数', level: 'subBranch', children: [
            { id: 'func-type-l1', title: '一次函数', level: 'leaf', description: 'y = kx + b，图像为直线。' },
            { id: 'func-type-l2', title: '二次函数', level: 'leaf', description: 'y = ax² + bx + c，图像为抛物线。' },
            { id: 'func-type-l3', title: '指数函数', level: 'leaf', description: 'y = aˣ，a > 0且a ≠ 1。' },
            { id: 'func-type-l4', title: '对数函数', level: 'leaf', description: 'y = logₐx，指数函数的反函数。' },
            { id: 'func-type-l5', title: '三角函数', level: 'leaf', description: 'sin、cos、tan等周期函数。' },
          ]},
          { id: 'func-type-sub2', title: '复合与反函数', level: 'subBranch', children: [
            { id: 'func-type-l6', title: '复合函数', level: 'leaf', description: 'f(g(x))，一个函数的输出作为另一个的输入。' },
            { id: 'func-type-l7', title: '反函数', level: 'leaf', description: '将原函数的输入输出互换得到的函数。' },
          ]},
        ]},
        { id: 'func-prop', title: '函数性质', level: 'branch', children: [
          { id: 'func-prop-l1', title: '奇偶性', level: 'leaf', description: 'f(-x) = f(x)为偶函数，f(-x) = -f(x)为奇函数。' },
          { id: 'func-prop-l2', title: '单调性', level: 'leaf', description: '增函数：x增大时f(x)增大；减函数：x增大时f(x)减小。' },
          { id: 'func-prop-l3', title: '周期性', level: 'leaf', description: '存在T使f(x+T) = f(x)对所有x成立。' },
          { id: 'func-prop-l4', title: '有界性', level: 'leaf', description: '存在M使|f(x)| ≤ M对所有x成立。' },
        ]},
        { id: 'func-op', title: '函数运算', level: 'branch', children: [
          { id: 'func-op-l1', title: '四则运算', level: 'leaf', description: '函数的加减乘除运算。' },
          { id: 'func-op-l2', title: '极限', level: 'leaf', description: '函数趋近某点的极限值。' },
          { id: 'func-op-l3', title: '导数', level: 'leaf', description: '函数在某点的变化率。' },
          { id: 'func-op-l4', title: '积分', level: 'leaf', description: '函数的不定积分与定积分。' },
        ]},
        { id: 'func-app', title: '应用', level: 'branch', children: [
          { id: 'func-app-l1', title: '物理建模', level: 'leaf', description: '用函数描述物理量之间的关系。' },
          { id: 'func-app-l2', title: '经济分析', level: 'leaf', description: '用函数描述经济变量的变化。' },
        ]},
      ]},
    ],
    ...mindMapTestCommon,
  },
  // 测试14: 模拟"复数"搜索 - 不规则混合结构
  '复数': {
    mindMap: [
      { id: 'cpx-root', title: '复数', level: 'root', children: [
        { id: 'cpx-def', title: '基本概念', level: 'branch', children: [
          { id: 'cpx-def-l1', title: '定义', level: 'leaf', description: 'z = a + bi，其中a为实部，b为虚部，i² = -1。' },
          { id: 'cpx-def-l2', title: '虚数单位i', level: 'leaf', description: 'i = √(-1)，是复数理论的基础。' },
          { id: 'cpx-def-l3', title: '实部与虚部', level: 'leaf', description: 'Re(z) = a，Im(z) = b。' },
        ]},
        { id: 'cpx-form', title: '表示形式', level: 'branch', children: [
          { id: 'cpx-form-sub', title: '三种表示', level: 'subBranch', children: [
            { id: 'cpx-form-l1', title: '代数形式', level: 'leaf', description: 'z = a + bi。' },
            { id: 'cpx-form-l2', title: '三角形式', level: 'leaf', description: 'z = r(cosθ + i·sinθ)。' },
            { id: 'cpx-form-l3', title: '指数形式', level: 'leaf', description: 'z = r·e^(iθ)。' },
          ]},
        ]},
        { id: 'cpx-op', title: '运算', level: 'branch', children: [
          { id: 'cpx-op-l1', title: '加减法', level: 'leaf', description: '实部加减实部，虚部加减虚部。' },
          { id: 'cpx-op-l2', title: '乘法', level: 'leaf', description: '模相乘，幅角相加。' },
          { id: 'cpx-op-l3', title: '除法', level: 'leaf', description: '模相除，幅角相减。' },
          { id: 'cpx-op-l4', title: '共轭复数', level: 'leaf', description: 'z̄ = a - bi，实部相同虚部相反。' },
          { id: 'cpx-op-l5', title: '模', level: 'leaf', description: '|z| = √(a² + b²)。' },
        ]},
        { id: 'cpx-geo', title: '几何意义', level: 'branch', children: [
          { id: 'cpx-geo-l1', title: '复平面', level: 'leaf', description: '横轴为实轴，纵轴为虚轴的平面。' },
          { id: 'cpx-geo-l2', title: '向量表示', level: 'leaf', description: '复数对应复平面上的向量。' },
        ]},
        { id: 'cpx-app', title: '应用领域', level: 'branch', children: [
          { id: 'cpx-app-sub', title: '工程应用', level: 'subBranch', children: [
            { id: 'cpx-app-l1', title: '电路分析', level: 'leaf', description: '交流电路中用复数表示阻抗。' },
            { id: 'cpx-app-l2', title: '信号处理', level: 'leaf', description: '傅里叶变换的基础。' },
          ]},
          { id: 'cpx-app-l3', title: '量子力学', level: 'leaf', description: '波函数用复数表示。' },
        ]},
      ]},
    ],
    ...mindMapTestCommon,
  },
};

// ========== 直接问答模式 Mock 数据 ==========

export const directQAMockReplies: Record<string, string> = {
  '人工智能': '人工智能（AI）是计算机科学的一个分支，致力于创建能够模拟人类智能行为的系统。它涵盖了机器学习、深度学习、自然语言处理、计算机视觉等多个子领域，广泛应用于语音助手、自动驾驶、医疗诊断等场景。',
  '牛顿第二定律': '牛顿第二定律是经典力学的基础定律之一，表述为：物体的加速度与所受合外力成正比，与物体质量成反比，加速度方向与合外力方向相同。数学表达式为 F = ma，其中 F 是合外力（单位：牛顿 N），m 是质量（单位：kg），a 是加速度（单位：m/s²）。',
  '光合作用': '光合作用是植物、藻类和某些细菌利用光能，将二氧化碳和水转化为有机物（主要是葡萄糖）并释放氧气的过程。总反应式为：6CO₂ + 6H₂O → C₆H₁₂O₆ + 6O₂。光合作用分为光反应和暗反应两个阶段，是地球上最重要的生物化学反应之一。',
  '勾股定理': '勾股定理（毕达哥拉斯定理）指出：在直角三角形中，两条直角边的平方和等于斜边的平方。即 a² + b² = c²。这是数学中最基础也最重要的定理之一，广泛应用于几何计算、工程测量、物理分析等领域。',
};

export const defaultQAReply = '这是一个很好的问题。作为知识助手，我可以帮你解答各类学科问题，包括物理、化学、数学、生物、计算机科学等领域。请尝试提出更具体的问题，我会尽力为你提供准确的解答。';

// TODO: 替换为真实 API 调用
export function generateReply(question: string, _context?: string): string {
  const lowerQ = question.toLowerCase();
  for (const [key, reply] of Object.entries(directQAMockReplies)) {
    if (lowerQ.includes(key.toLowerCase())) {
      return reply;
    }
  }
  return defaultQAReply;
}
