import { WordResult, SentenceResult } from '../../types';

export const mockWordResult: Record<string, WordResult> = {
  sample: {
    word: 'sample',
    phonetic: '/ˈsæmpl/',
    definitions: [
      {
        pos: 'n.',
        meaning: '样本；例子',
        example: {
          en: 'A small part or quantity intended to show what the whole is like.',
          zh: '一小部分或数量，用于展示整体是什么样的。',
        },
      },
      {
        pos: 'v.',
        meaning: '抽样；取样',
        example: {
          en: 'To take a sample of.',
          zh: '取...的样本。',
        },
      },
    ],
    synonyms: ['example', 'specimen', 'instance'],
    antonyms: ['whole', 'entirety'],
  },
  algorithm: {
    word: 'algorithm',
    phonetic: '/ˈælɡərɪðəm/',
    definitions: [
      {
        pos: 'n.',
        meaning: '算法；计算程序',
        example: {
          en: 'A set of rules for solving a problem in a finite number of steps.',
          zh: '在有限步骤内解决问题的一套规则。',
        },
      },
    ],
    synonyms: ['procedure', 'method', 'formula'],
    antonyms: [],
    relatedTerms: ['data structure', 'complexity', 'recursion', 'iteration', 'big O notation'],
    imageQuery: 'algorithm flowchart',
  },
  architecture: {
    word: 'architecture',
    phonetic: '/ˈɑːrkɪtektʃər/',
    definitions: [
      {
        pos: 'n.',
        meaning: '架构；体系结构',
        example: {
          en: 'The complex or carefully designed structure of something.',
          zh: '某物的复杂或精心设计的结构。',
        },
      },
      {
        pos: 'n.',
        meaning: '建筑学；建筑风格',
        example: {
          en: 'The art or practice of designing and constructing buildings.',
          zh: '设计和建造建筑物的艺术或实践。',
        },
      },
    ],
    synonyms: ['structure', 'design', 'framework'],
    antonyms: [],
    relatedTerms: ['design pattern', 'microservices', 'monolithic', 'scalability', 'system design'],
  },
  abstract: {
    word: 'abstract',
    phonetic: '/ˈæbstrækt/',
    definitions: [
      {
        pos: 'adj.',
        meaning: '抽象的；理论上的',
        example: {
          en: 'Existing in thought or as an idea but not having a physical existence.',
          zh: '存在于思想或概念中，但没有物理存在。',
        },
      },
      {
        pos: 'n.',
        meaning: '摘要；抽象概念',
        example: {
          en: 'A summary of the contents of a book, article, or speech.',
          zh: '书籍、文章或演讲内容的摘要。',
        },
      },
    ],
    synonyms: ['theoretical', 'conceptual', 'summary'],
    antonyms: ['concrete', 'practical'],
  },
  implement: {
    word: 'implement',
    phonetic: '/ˈɪmplɪment/',
    definitions: [
      {
        pos: 'v.',
        meaning: '实施；执行；实现',
        example: {
          en: 'To put a decision, plan, or agreement into effect.',
          zh: '将决定、计划或协议付诸实施。',
        },
      },
      {
        pos: 'n.',
        meaning: '工具；器具',
        example: {
          en: 'A tool, utensil, or other piece of equipment used for a particular purpose.',
          zh: '用于特定目的的工具、器具或其他设备。',
        },
      },
    ],
    synonyms: ['execute', 'apply', 'enforce'],
    antonyms: ['abandon', 'disregard'],
  },
  optimize: {
    word: 'optimize',
    phonetic: '/ˈɑːptɪmaɪz/',
    definitions: [
      {
        pos: 'v.',
        meaning: '优化；使最优化',
        example: {
          en: 'Make the best or most effective use of a situation or resource.',
          zh: '对情况或资源进行最佳或最有效的利用。',
        },
      },
    ],
    synonyms: ['improve', 'enhance', 'refine'],
    antonyms: ['worsen', 'degrade'],
  },
  deploy: {
    word: 'deploy',
    phonetic: '/dɪˈplɔɪ/',
    definitions: [
      {
        pos: 'v.',
        meaning: '部署；调度',
        example: {
          en: 'Bring into effective action; to move into position for use.',
          zh: '投入有效行动；移动到位以供使用。',
        },
      },
    ],
    synonyms: ['position', 'station', 'install'],
    antonyms: ['withdraw', 'retract'],
  },
  integration: {
    word: 'integration',
    phonetic: '/ˌɪntɪˈɡreɪʃn/',
    definitions: [
      {
        pos: 'n.',
        meaning: '集成；整合；一体化',
        example: {
          en: 'The process of combining two or more things into an effective whole.',
          zh: '将两个或多个事物组合成一个有效整体的过程。',
        },
      },
    ],
    synonyms: ['combination', 'merger', 'unification'],
    antonyms: ['separation', 'division'],
  },
  framework: {
    word: 'framework',
    phonetic: '/ˈfreɪmwɜːrk/',
    definitions: [
      {
        pos: 'n.',
        meaning: '框架；结构；体系',
        example: {
          en: 'A basic structure underlying a system, concept, or text.',
          zh: '系统、概念或文本背后的基本结构。',
        },
      },
    ],
    synonyms: ['structure', 'scaffold', 'skeleton'],
    antonyms: [],
    relatedTerms: ['library', 'API', 'SDK', 'middleware', 'plugin'],
  },
  interface: {
    word: 'interface',
    phonetic: '/ˈɪntərfeɪs/',
    definitions: [
      {
        pos: 'n.',
        meaning: '接口；界面；交互界面',
        example: {
          en: 'A point where two systems, subjects, or organizations meet and interact.',
          zh: '两个系统、主题或组织相遇和交互的点。',
        },
      },
      {
        pos: 'v.',
        meaning: '连接；交互',
        example: {
          en: 'To interact with another system, person, or organization.',
          zh: '与另一个系统、人或组织进行交互。',
        },
      },
    ],
    synonyms: ['connection', 'link', 'interaction'],
    antonyms: [],
  },
  artificial: {
    word: 'artificial',
    phonetic: '/ˌɑːrtɪˈfɪʃl/',
    definitions: [
      {
        pos: 'adj.',
        meaning: '人工的；人造的；假的',
        example: {
          en: 'Made or produced by human beings rather than occurring naturally.',
          zh: '由人类制造或生产，而非自然发生的。',
        },
      },
    ],
    synonyms: ['man-made', 'synthetic', 'fake'],
    antonyms: ['natural', 'genuine'],
    relatedTerms: ['AI', 'machine learning', 'neural network', 'robotics'],
  },
  intelligence: {
    word: 'intelligence',
    phonetic: '/ɪnˈtelɪdʒəns/',
    definitions: [
      {
        pos: 'n.',
        meaning: '智力；智慧；情报',
        example: {
          en: 'The ability to acquire and apply knowledge and skills.',
          zh: '获取和应用知识与技能的能力。',
        },
      },
    ],
    synonyms: ['wisdom', 'intellect', 'understanding'],
    antonyms: ['stupidity', 'ignorance'],
  },
  machine: {
    word: 'machine',
    phonetic: '/məˈʃiːn/',
    definitions: [
      {
        pos: 'n.',
        meaning: '机器；机械装置',
        example: {
          en: 'An apparatus using mechanical power and having several parts, each with a definite function.',
          zh: '使用机械动力、具有多个部件且每个部件有明确功能的装置。',
        },
      },
      {
        pos: 'v.',
        meaning: '用机器制造；加工',
        example: {
          en: 'To make or process with a machine.',
          zh: '用机器制造或加工。',
        },
      },
    ],
    synonyms: ['device', 'apparatus', 'mechanism'],
    antonyms: [],
  },
  learning: {
    word: 'learning',
    phonetic: '/ˈlɜːrnɪŋ/',
    definitions: [
      {
        pos: 'n.',
        meaning: '学习；学问；知识',
        example: {
          en: 'The acquisition of knowledge or skills through study, experience, or being taught.',
          zh: '通过学习、经验或被教导获得知识或技能。',
        },
      },
    ],
    synonyms: ['education', 'training', 'study'],
    antonyms: ['ignorance', 'forgetting'],
    relatedTerms: ['machine learning', 'deep learning', 'reinforcement learning', 'supervised learning'],
  },
  deep: {
    word: 'deep',
    phonetic: '/diːp/',
    definitions: [
      {
        pos: 'adj.',
        meaning: '深的；深刻的；深入的',
        example: {
          en: 'Extending far down from the top or surface.',
          zh: '从顶部或表面向下延伸很远。',
        },
      },
      {
        pos: 'adv.',
        meaning: '深深地；深入地',
        example: {
          en: 'To a great depth; far down or in.',
          zh: '到很深的程度；向下或向内很远。',
        },
      },
    ],
    synonyms: ['profound', 'intense', 'thorough'],
    antonyms: ['shallow', 'superficial'],
  },
  neural: {
    word: 'neural',
    phonetic: '/ˈnʊrəl/',
    definitions: [
      {
        pos: 'adj.',
        meaning: '神经的；神经网络的',
        example: {
          en: 'Relating to a nerve or the nervous system.',
          zh: '与神经或神经系统相关的。',
        },
      },
    ],
    synonyms: ['nervous', 'neurological'],
    antonyms: [],
    relatedTerms: ['neural network', 'artificial neural network', 'CNN', 'RNN', 'Transformer'],
  },
  network: {
    word: 'network',
    phonetic: '/ˈnetwɜːrk/',
    definitions: [
      {
        pos: 'n.',
        meaning: '网络；网状物',
        example: {
          en: 'A group or system of interconnected people or things.',
          zh: '相互连接的人或事物组成的群体或系统。',
        },
      },
      {
        pos: 'v.',
        meaning: '建立网络；建立联系',
        example: {
          en: 'To connect or be connected with a network.',
          zh: '连接或与网络连接。',
        },
      },
    ],
    synonyms: ['web', 'system', 'connection'],
    antonyms: ['isolation', 'disconnection'],
  },
  natural: {
    word: 'natural',
    phonetic: '/ˈnætʃrəl/',
    definitions: [
      {
        pos: 'adj.',
        meaning: '自然的；天然的；天生的',
        example: {
          en: 'Existing in or derived from nature; not made or caused by humankind.',
          zh: '存在于或来源于自然；非人类制造或引起的。',
        },
      },
    ],
    synonyms: ['organic', 'innate', 'spontaneous'],
    antonyms: ['artificial', 'man-made'],
    relatedTerms: ['natural language processing', 'NLP', 'speech recognition', 'text analysis'],
  },
  language: {
    word: 'language',
    phonetic: '/ˈlæŋɡwɪdʒ/',
    definitions: [
      {
        pos: 'n.',
        meaning: '语言；语言文字',
        example: {
          en: 'A system of communication consisting of sounds, words, and grammar.',
          zh: '由声音、词汇和语法组成的交流系统。',
        },
      },
    ],
    synonyms: ['tongue', 'dialect', 'speech'],
    antonyms: [],
  },
  processing: {
    word: 'processing',
    phonetic: '/ˈproʊsesɪŋ/',
    definitions: [
      {
        pos: 'n.',
        meaning: '处理；加工；处理过程',
        example: {
          en: 'The action of processing something.',
          zh: '处理某物的动作或过程。',
        },
      },
    ],
    synonyms: ['handling', 'treatment', 'manipulation'],
    antonyms: [],
  },
  computer: {
    word: 'computer',
    phonetic: '/kəmˈpjuːtər/',
    definitions: [
      {
        pos: 'n.',
        meaning: '计算机；电脑',
        example: {
          en: 'An electronic device that stores and processes data.',
          zh: '存储和处理数据的电子设备。',
        },
      },
    ],
    synonyms: ['PC', 'machine', 'device'],
    antonyms: [],
  },
  vision: {
    word: 'vision',
    phonetic: '/ˈvɪʒn/',
    definitions: [
      {
        pos: 'n.',
        meaning: '视觉；视力；愿景',
        example: {
          en: 'The ability to see; the faculty or state of being able to see.',
          zh: '看见的能力；能够看见的官能或状态。',
        },
      },
    ],
    synonyms: ['sight', 'perception', 'foresight'],
    antonyms: ['blindness', 'short-sightedness'],
    relatedTerms: ['computer vision', 'image recognition', 'object detection', 'video analysis'],
  },
  science: {
    word: 'science',
    phonetic: '/ˈsaɪəns/',
    definitions: [
      {
        pos: 'n.',
        meaning: '科学；科学知识',
        example: {
          en: 'The intellectual and practical activity encompassing the systematic study of the structure and behavior of the physical and natural world.',
          zh: '包括对物理和自然世界的结构与行为进行系统研究的智力和实践活动。',
        },
      },
    ],
    synonyms: ['knowledge', 'research', 'discovery'],
    antonyms: ['ignorance', 'superstition'],
  },
  technology: {
    word: 'technology',
    phonetic: '/tekˈnɑːlədʒi/',
    definitions: [
      {
        pos: 'n.',
        meaning: '技术；科技',
        example: {
          en: 'The application of scientific knowledge for practical purposes.',
          zh: '为实用目的应用科学知识。',
        },
      },
    ],
    synonyms: ['tech', 'innovation', 'engineering'],
    antonyms: [],
  },
  physics: {
    word: 'physics',
    phonetic: '/ˈfɪzɪks/',
    definitions: [
      {
        pos: 'n.',
        meaning: '物理学；物理',
        example: {
          en: 'The branch of science concerned with the nature and properties of matter and energy.',
          zh: '研究物质和能量的性质与特性的科学分支。',
        },
      },
    ],
    synonyms: [],
    antonyms: [],
    relatedTerms: ['classical mechanics', 'quantum mechanics', 'relativity', 'thermodynamics', 'electromagnetism'],
  },
  mathematics: {
    word: 'mathematics',
    phonetic: '/ˌmæθəˈmætɪks/',
    definitions: [
      {
        pos: 'n.',
        meaning: '数学；数学学科',
        example: {
          en: 'The abstract science of number, quantity, and space.',
          zh: '关于数字、数量和空间的抽象科学。',
        },
      },
    ],
    synonyms: ['math', 'arithmetic', 'calculus'],
    antonyms: [],
  },
  chemistry: {
    word: 'chemistry',
    phonetic: '/ˈkemɪstri/',
    definitions: [
      {
        pos: 'n.',
        meaning: '化学；化学学科',
        example: {
          en: 'The branch of science concerned with the substances of which matter is composed.',
          zh: '研究物质组成的科学分支。',
        },
      },
    ],
    synonyms: [],
    antonyms: [],
    relatedTerms: ['organic chemistry', 'inorganic chemistry', 'biochemistry', 'physical chemistry'],
  },
  biology: {
    word: 'biology',
    phonetic: '/baɪˈɒlədʒi/',
    definitions: [
      {
        pos: 'n.',
        meaning: '生物学；生物',
        example: {
          en: 'The study of living organisms and their interactions with the environment.',
          zh: '研究生物体及其与环境相互作用的学科。',
        },
      },
    ],
    synonyms: [],
    antonyms: [],
    relatedTerms: ['cell biology', 'genetics', 'ecology', 'physiology', 'evolution'],
  },
  history: {
    word: 'history',
    phonetic: '/ˈhɪstri/',
    definitions: [
      {
        pos: 'n.',
        meaning: '历史；历史学',
        example: {
          en: 'The study of past events, particularly in human affairs.',
          zh: '对过去事件的研究，尤其是人类事务。',
        },
      },
    ],
    synonyms: ['past', 'record', 'chronicle'],
    antonyms: ['future', 'present'],
  },
  economy: {
    word: 'economy',
    phonetic: '/ɪˈkɒnəmi/',
    definitions: [
      {
        pos: 'n.',
        meaning: '经济；经济制度',
        example: {
          en: 'The state of a country or region in terms of the production and consumption of goods and services.',
          zh: '一个国家或地区在商品和服务生产与消费方面的状况。',
        },
      },
    ],
    synonyms: ['financial system', 'market', 'trade'],
    antonyms: [],
    relatedTerms: ['macroeconomics', 'microeconomics', 'GDP', 'inflation', 'unemployment'],
  },
  function: {
    word: 'function',
    phonetic: '/ˈfʌŋkʃn/',
    definitions: [
      {
        pos: 'n.',
        meaning: '功能；函数；职责',
        example: {
          en: 'An activity or purpose natural to or intended for a person or thing.',
          zh: '人或事物天生或预期的活动或目的。',
        },
      },
      {
        pos: 'v.',
        meaning: '运行；起作用',
        example: {
          en: 'To work or operate in a proper or particular way.',
          zh: '以适当或特定方式工作或运行。',
        },
      },
    ],
    synonyms: ['purpose', 'role', 'operation'],
    antonyms: ['malfunction', 'failure'],
  },
  equation: {
    word: 'equation',
    phonetic: '/ɪˈkweɪʒn/',
    definitions: [
      {
        pos: 'n.',
        meaning: '方程；等式',
        example: {
          en: 'A statement that the values of two mathematical expressions are equal.',
          zh: '声明两个数学表达式的值相等的语句。',
        },
      },
    ],
    synonyms: ['formula', 'expression', 'relation'],
    antonyms: [],
    relatedTerms: ['quadratic equation', 'linear equation', 'differential equation', 'equation solving'],
  },
  theorem: {
    word: 'theorem',
    phonetic: '/ˈθɪərəm/',
    definitions: [
      {
        pos: 'n.',
        meaning: '定理；法则',
        example: {
          en: 'A general proposition not self-evident but proved by a chain of reasoning.',
          zh: '不是自明的而是通过一系列推理证明的一般性命题。',
        },
      },
    ],
    synonyms: ['law', 'principle', 'rule'],
    antonyms: [],
  },
  formula: {
    word: 'formula',
    phonetic: '/ˈfɔːrmjələ/',
    definitions: [
      {
        pos: 'n.',
        meaning: '公式；配方',
        example: {
          en: 'A mathematical relationship or rule expressed in symbols.',
          zh: '用符号表示的数学关系或规则。',
        },
      },
    ],
    synonyms: ['equation', 'rule', 'recipe'],
    antonyms: [],
  },
  system: {
    word: 'system',
    phonetic: '/ˈsɪstəm/',
    definitions: [
      {
        pos: 'n.',
        meaning: '系统；体系；制度',
        example: {
          en: 'A set of things working together as parts of a mechanism or an interconnecting network.',
          zh: '作为机制或相互连接网络的一部分协同工作的一组事物。',
        },
      },
    ],
    synonyms: ['structure', 'organization', 'framework'],
    antonyms: ['chaos', 'disorder'],
  },
  theory: {
    word: 'theory',
    phonetic: '/ˈθɪəri/',
    definitions: [
      {
        pos: 'n.',
        meaning: '理论；学说',
        example: {
          en: 'A supposition or a system of ideas intended to explain something.',
          zh: '旨在解释某事的假设或一套思想体系。',
        },
      },
    ],
    synonyms: ['hypothesis', 'principle', 'doctrine'],
    antonyms: ['practice', 'fact'],
  },
  data: {
    word: 'data',
    phonetic: '/ˈdeɪtə/',
    definitions: [
      {
        pos: 'n.',
        meaning: '数据；资料',
        example: {
          en: 'Facts and statistics collected together for reference or analysis.',
          zh: '收集在一起供参考或分析的事实和统计数据。',
        },
      },
    ],
    synonyms: ['information', 'facts', 'statistics'],
    antonyms: [],
    relatedTerms: ['big data', 'data analysis', 'data mining', 'database', 'data visualization'],
  },
  model: {
    word: 'model',
    phonetic: '/ˈmɒdl/',
    definitions: [
      {
        pos: 'n.',
        meaning: '模型；模范',
        example: {
          en: 'A representation of something, often on a smaller scale.',
          zh: '某物的表示，通常按较小比例。',
        },
      },
      {
        pos: 'v.',
        meaning: '做模型；示范',
        example: {
          en: 'To create a model of something.',
          zh: '创建某物的模型。',
        },
      },
    ],
    synonyms: ['representation', 'prototype', 'pattern'],
    antonyms: [],
    relatedTerms: ['machine learning model', 'neural network model', 'language model', 'GPT', 'BERT'],
  },
  analysis: {
    word: 'analysis',
    phonetic: '/əˈnæləsɪs/',
    definitions: [
      {
        pos: 'n.',
        meaning: '分析；解析',
        example: {
          en: 'The process of breaking down a complex topic or substance into smaller parts to gain a better understanding.',
          zh: '将复杂主题或物质分解为较小部分以获得更好理解的过程。',
        },
      },
    ],
    synonyms: ['examination', 'evaluation', 'investigation'],
    antonyms: ['synthesis', 'combination'],
  },
  method: {
    word: 'method',
    phonetic: '/ˈmeθəd/',
    definitions: [
      {
        pos: 'n.',
        meaning: '方法；办法',
        example: {
          en: 'A particular procedure for accomplishing or approaching something.',
          zh: '完成或处理某事的特定程序。',
        },
      },
    ],
    synonyms: ['technique', 'approach', 'procedure'],
    antonyms: ['randomness', 'chaos'],
  },
  approach: {
    word: 'approach',
    phonetic: '/əˈproʊtʃ/',
    definitions: [
      {
        pos: 'n.',
        meaning: '方法；途径；接近',
        example: {
          en: 'A way of dealing with or thinking about something.',
          zh: '处理或思考某事的方式。',
        },
      },
      {
        pos: 'v.',
        meaning: '接近；靠近',
        example: {
          en: 'To come near or nearer to something or someone.',
          zh: '靠近或接近某物或某人。',
        },
      },
    ],
    synonyms: ['method', 'technique', 'way'],
    antonyms: ['depart', 'leave'],
  },
  solution: {
    word: 'solution',
    phonetic: '/səˈluːʃn/',
    definitions: [
      {
        pos: 'n.',
        meaning: '解决方案；解答；溶液',
        example: {
          en: 'A means of solving a problem or dealing with a difficult situation.',
          zh: '解决问题或处理困难情况的手段。',
        },
      },
    ],
    synonyms: ['answer', 'resolution', 'fix'],
    antonyms: ['problem', 'issue'],
  },
  problem: {
    word: 'problem',
    phonetic: '/ˈprɒbləm/',
    definitions: [
      {
        pos: 'n.',
        meaning: '问题；难题',
        example: {
          en: 'A matter or situation regarded as unwelcome or harmful and needing to be dealt with.',
          zh: '被视为不受欢迎或有害且需要处理的事情或情况。',
        },
      },
    ],
    synonyms: ['issue', 'difficulty', 'challenge'],
    antonyms: ['solution', 'answer'],
  },
  challenge: {
    word: 'challenge',
    phonetic: '/ˈtʃælɪndʒ/',
    definitions: [
      {
        pos: 'n.',
        meaning: '挑战；难题',
        example: {
          en: 'A call to take part in a contest or competition.',
          zh: '要求参加比赛或竞赛的邀请。',
        },
      },
      {
        pos: 'v.',
        meaning: '挑战；质疑',
        example: {
          en: 'To invite someone to compete in a contest.',
          zh: '邀请某人参加比赛。',
        },
      },
    ],
    synonyms: ['difficulty', 'task', 'test'],
    antonyms: ['opportunity', 'advantage'],
  },
  opportunity: {
    word: 'opportunity',
    phonetic: '/ˌɒpəˈtjuːnəti/',
    definitions: [
      {
        pos: 'n.',
        meaning: '机会；时机',
        example: {
          en: 'A time or set of circumstances that makes it possible to do something.',
          zh: '使做某事成为可能的时间或环境。',
        },
      },
    ],
    synonyms: ['chance', 'occasion', 'possibility'],
    antonyms: ['obstacle', 'difficulty'],
  },
  result: {
    word: 'result',
    phonetic: '/rɪˈzʌlt/',
    definitions: [
      {
        pos: 'n.',
        meaning: '结果；成果',
        example: {
          en: 'Something that happens or exists because of something else.',
          zh: '由于其他事物而发生或存在的事物。',
        },
      },
      {
        pos: 'v.',
        meaning: '产生结果；导致',
        example: {
          en: 'To happen or occur as a consequence of something.',
          zh: '作为某事的结果而发生。',
        },
      },
    ],
    synonyms: ['outcome', 'consequence', 'effect'],
    antonyms: ['cause', 'source'],
  },
  process: {
    word: 'process',
    phonetic: '/ˈproʊses/',
    definitions: [
      {
        pos: 'n.',
        meaning: '过程；进程',
        example: {
          en: 'A series of actions or steps taken in order to achieve a particular end.',
          zh: '为了达到特定目的而采取的一系列行动或步骤。',
        },
      },
      {
        pos: 'v.',
        meaning: '处理；加工',
        example: {
          en: 'To carry out a series of steps on something.',
          zh: '对某物执行一系列步骤。',
        },
      },
    ],
    synonyms: ['procedure', 'operation', 'method'],
    antonyms: [],
  },
  development: {
    word: 'development',
    phonetic: '/dɪˈveləpmənt/',
    definitions: [
      {
        pos: 'n.',
        meaning: '发展；开发；进展',
        example: {
          en: 'The process of developing or being developed.',
          zh: '发展或被发展的过程。',
        },
      },
    ],
    synonyms: ['growth', 'progress', 'evolution'],
    antonyms: ['decline', 'stagnation'],
  },
  improvement: {
    word: 'improvement',
    phonetic: '/ɪmˈpruːvmənt/',
    definitions: [
      {
        pos: 'n.',
        meaning: '改进；改善',
        example: {
          en: 'An instance of improving or being improved.',
          zh: '改进或被改进的实例。',
        },
      },
    ],
    synonyms: ['enhancement', 'betterment', 'upgrade'],
    antonyms: ['deterioration', 'decline'],
  },
  research: {
    word: 'research',
    phonetic: '/rɪˈsɜːrtʃ/',
    definitions: [
      {
        pos: 'n.',
        meaning: '研究；调查',
        example: {
          en: 'The systematic investigation into and study of materials and sources.',
          zh: '对材料和来源进行系统调查和研究。',
        },
      },
      {
        pos: 'v.',
        meaning: '研究；调查',
        example: {
          en: 'To carry out research.',
          zh: '进行研究。',
        },
      },
    ],
    synonyms: ['study', 'investigation', 'analysis'],
    antonyms: [],
  },
  innovation: {
    word: 'innovation',
    phonetic: '/ˌɪnəˈveɪʃn/',
    definitions: [
      {
        pos: 'n.',
        meaning: '创新；革新',
        example: {
          en: 'The introduction of new ideas, methods, or technologies.',
          zh: '引入新思想、新方法或新技术。',
        },
      },
    ],
    synonyms: ['invention', 'creativity', 'breakthrough'],
    antonyms: ['conservatism', 'tradition'],
  },
  creativity: {
    word: 'creativity',
    phonetic: '/ˌkriːeɪˈtɪvəti/',
    definitions: [
      {
        pos: 'n.',
        meaning: '创造力；创造性',
        example: {
          en: 'The ability to produce original and unusual ideas.',
          zh: '产生原创和独特想法的能力。',
        },
      },
    ],
    synonyms: ['imagination', 'ingenuity', 'originality'],
    antonyms: ['conformity', 'routine'],
  },
  thinking: {
    word: 'thinking',
    phonetic: '/ˈθɪŋkɪŋ/',
    definitions: [
      {
        pos: 'n.',
        meaning: '思考；思维',
        example: {
          en: 'The process of considering or reasoning about something.',
          zh: '考虑或推理某事的过程。',
        },
      },
      {
        pos: 'adj.',
        meaning: '有思考能力的；思想的',
        example: {
          en: 'Having or showing good mental capacity.',
          zh: '有或表现出良好心智能力的。',
        },
      },
    ],
    synonyms: ['reasoning', 'thought', 'cognition'],
    antonyms: ['unthinking', 'mindless'],
  },
  idea: {
    word: 'idea',
    phonetic: '/aɪˈdɪə/',
    definitions: [
      {
        pos: 'n.',
        meaning: '想法；主意；概念',
        example: {
          en: 'A thought or suggestion as to a possible course of action.',
          zh: '关于可能行动方案的想法或建议。',
        },
      },
    ],
    synonyms: ['concept', 'notion', 'thought'],
    antonyms: [],
  },
  concept: {
    word: 'concept',
    phonetic: '/ˈkɒnsept/',
    definitions: [
      {
        pos: 'n.',
        meaning: '概念；观念',
        example: {
          en: 'An abstract idea; a general notion.',
          zh: '抽象概念；一般性概念。',
        },
      },
    ],
    synonyms: ['idea', 'notion', 'thought'],
    antonyms: [],
  },
  understanding: {
    word: 'understanding',
    phonetic: '/ˌʌndərˈstændɪŋ/',
    definitions: [
      {
        pos: 'n.',
        meaning: '理解；理解力',
        example: {
          en: 'The ability to grasp or comprehend the meaning of something.',
          zh: '理解或领会某物含义的能力。',
        },
      },
    ],
    synonyms: ['comprehension', 'knowledge', 'insight'],
    antonyms: ['misunderstanding', 'ignorance'],
  },
  knowledge: {
    word: 'knowledge',
    phonetic: '/ˈnɒlɪdʒ/',
    definitions: [
      {
        pos: 'n.',
        meaning: '知识；学问',
        example: {
          en: 'Facts, information, and skills acquired through experience or education.',
          zh: '通过经验或教育获得的事实、信息和技能。',
        },
      },
    ],
    synonyms: ['understanding', 'wisdom', 'learning'],
    antonyms: ['ignorance', 'unawareness'],
  },
  wisdom: {
    word: 'wisdom',
    phonetic: '/ˈwɪzdəm/',
    definitions: [
      {
        pos: 'n.',
        meaning: '智慧；明智',
        example: {
          en: 'The quality of having experience, knowledge, and good judgment.',
          zh: '具有经验、知识和良好判断力的品质。',
        },
      },
    ],
    synonyms: ['intelligence', 'insight', 'prudence'],
    antonyms: ['foolishness', 'stupidity'],
  },
};

export const mockSentenceResult: (text: string, style: string) => SentenceResult = (text, style) => {
  const stylePrefix = style === 'academic' ? '学术风格：' : style === 'business' ? '商务风格：' : '日常风格：';
  
  const translations: Record<string, string> = {
    'Hello': stylePrefix + '你好',
    'Thank you': stylePrefix + '谢谢你',
    'Good morning': stylePrefix + '早上好',
    'How are you': stylePrefix + '你好吗',
    'What is your name': stylePrefix + '你叫什么名字',
    'I love you': stylePrefix + '我爱你',
    'Goodbye': stylePrefix + '再见',
    'Welcome': stylePrefix + '欢迎',
    'Please': stylePrefix + '请',
    'Sorry': stylePrefix + '对不起',
    'The quick brown fox jumps over the lazy dog': stylePrefix + '敏捷的棕色狐狸跳过懒狗',
    'Artificial Intelligence is transforming the world': stylePrefix + '人工智能正在改变世界',
    'Machine learning algorithms can learn from data': stylePrefix + '机器学习算法可以从数据中学习',
    'Natural language processing enables computers to understand human language': stylePrefix + '自然语言处理使计算机能够理解人类语言',
    'Deep learning has achieved remarkable results in image recognition': stylePrefix + '深度学习在图像识别方面取得了显著成果',
    'The internet has revolutionized communication': stylePrefix + '互联网彻底改变了通信方式',
    'Data science combines statistics, programming, and domain knowledge': stylePrefix + '数据科学结合了统计学、编程和领域知识',
    'Quantum computing represents the next generation of computational technology': stylePrefix + '量子计算代表了下一代计算技术',
    'Renewable energy sources include solar, wind, and hydro power': stylePrefix + '可再生能源包括太阳能、风能和水力发电',
    'Global warming is a pressing environmental issue': stylePrefix + '全球变暖是一个紧迫的环境问题',
    '经济': stylePrefix + 'Economy',
    '科技': stylePrefix + 'Technology',
    '人工智能': stylePrefix + 'Artificial Intelligence',
    '机器学习': stylePrefix + 'Machine Learning',
    '深度学习': stylePrefix + 'Deep Learning',
    '自然语言处理': stylePrefix + 'Natural Language Processing',
    '计算机视觉': stylePrefix + 'Computer Vision',
    '大数据': stylePrefix + 'Big Data',
    '云计算': stylePrefix + 'Cloud Computing',
    '物联网': stylePrefix + 'Internet of Things',
    '区块链': stylePrefix + 'Blockchain',
    '量子计算': stylePrefix + 'Quantum Computing',
    '软件工程': stylePrefix + 'Software Engineering',
    '编程语言': stylePrefix + 'Programming Language',
    '数据库': stylePrefix + 'Database',
    '网络安全': stylePrefix + 'Cybersecurity',
    '软件开发': stylePrefix + 'Software Development',
    '算法': stylePrefix + 'Algorithm',
    '数据结构': stylePrefix + 'Data Structure',
    '物理': stylePrefix + 'Physics',
    '数学': stylePrefix + 'Mathematics',
    '化学': stylePrefix + 'Chemistry',
    '生物学': stylePrefix + 'Biology',
    '历史': stylePrefix + 'History',
    '哲学': stylePrefix + 'Philosophy',
    '艺术': stylePrefix + 'Art',
    '音乐': stylePrefix + 'Music',
    '教育': stylePrefix + 'Education',
    '健康': stylePrefix + 'Health',
    '医学': stylePrefix + 'Medicine',
    '心理学': stylePrefix + 'Psychology',
    '社会学': stylePrefix + 'Sociology',
    '经济学': stylePrefix + 'Economics',
    '政治学': stylePrefix + 'Political Science',
    '法学': stylePrefix + 'Law',
    '商业': stylePrefix + 'Business',
    '管理': stylePrefix + 'Management',
    '市场营销': stylePrefix + 'Marketing',
    '金融': stylePrefix + 'Finance',
    '投资': stylePrefix + 'Investment',
    '创新': stylePrefix + 'Innovation',
    '创业': stylePrefix + 'Entrepreneurship',
    '领导力': stylePrefix + 'Leadership',
    '团队合作': stylePrefix + 'Teamwork',
    '沟通': stylePrefix + 'Communication',
    '时间管理': stylePrefix + 'Time Management',
    '问题解决': stylePrefix + 'Problem Solving',
    '批判性思维': stylePrefix + 'Critical Thinking',
    '创造力': stylePrefix + 'Creativity',
    '适应能力': stylePrefix + 'Adaptability',
    '情商': stylePrefix + 'Emotional Intelligence',
    '你好': stylePrefix + 'Hello',
    '谢谢': stylePrefix + 'Thank you',
    '对不起': stylePrefix + 'Sorry',
    '请': stylePrefix + 'Please',
    '再见': stylePrefix + 'Goodbye',
    '是的': stylePrefix + 'Yes',
    '不是': stylePrefix + 'No',
    '好的': stylePrefix + 'OK',
    '可以': stylePrefix + 'Can / May',
    '需要': stylePrefix + 'Need',
    '想要': stylePrefix + 'Want',
    '喜欢': stylePrefix + 'Like',
    '爱': stylePrefix + 'Love',
    '工作': stylePrefix + 'Work',
    '学习': stylePrefix + 'Study',
    '生活': stylePrefix + 'Life',
    '幸福': stylePrefix + 'Happiness',
    '成功': stylePrefix + 'Success',
    '梦想': stylePrefix + 'Dream',
    '目标': stylePrefix + 'Goal',
    '计划': stylePrefix + 'Plan',
    '行动': stylePrefix + 'Action',
    '坚持': stylePrefix + 'Perseverance',
    '努力': stylePrefix + 'Effort',
    '智慧': stylePrefix + 'Wisdom',
    '知识': stylePrefix + 'Knowledge',
    '理解': stylePrefix + 'Understanding',
    '思考': stylePrefix + 'Thinking',
    '创造': stylePrefix + 'Creation',
    '发展': stylePrefix + 'Development',
    '进步': stylePrefix + 'Progress',
    '改变': stylePrefix + 'Change',
    '挑战': stylePrefix + 'Challenge',
    '机会': stylePrefix + 'Opportunity',
    '问题': stylePrefix + 'Problem',
    '解决方案': stylePrefix + 'Solution',
    '方法': stylePrefix + 'Method',
    '技术': stylePrefix + 'Technology',
    '工具': stylePrefix + 'Tool',
    '系统': stylePrefix + 'System',
    '架构': stylePrefix + 'Architecture',
    '设计': stylePrefix + 'Design',
    '实现': stylePrefix + 'Implementation',
    '优化': stylePrefix + 'Optimization',
    '部署': stylePrefix + 'Deployment',
    '测试': stylePrefix + 'Testing',
    '调试': stylePrefix + 'Debugging',
    '维护': stylePrefix + 'Maintenance',
    '文档': stylePrefix + 'Documentation',
    '代码': stylePrefix + 'Code',
    '编程': stylePrefix + 'Programming',
    '开发': stylePrefix + 'Development',
    '编码': stylePrefix + 'Coding',
    '版本控制': stylePrefix + 'Version Control',
    'Git': stylePrefix + 'Git',
    'GitHub': stylePrefix + 'GitHub',
    '开源': stylePrefix + 'Open Source',
    '框架': stylePrefix + 'Framework',
    '库': stylePrefix + 'Library',
    'API': stylePrefix + 'API',
    '接口': stylePrefix + 'Interface',
    '协议': stylePrefix + 'Protocol',
    '网络': stylePrefix + 'Network',
    '服务器': stylePrefix + 'Server',
    '客户端': stylePrefix + 'Client',
    '前端': stylePrefix + 'Frontend',
    '后端': stylePrefix + 'Backend',
    'SQL': stylePrefix + 'SQL',
    'NoSQL': stylePrefix + 'NoSQL',
    '数据': stylePrefix + 'Data',
    '信息': stylePrefix + 'Information',
    '分析': stylePrefix + 'Analysis',
    '统计': stylePrefix + 'Statistics',
    '模型': stylePrefix + 'Model',
    '训练': stylePrefix + 'Training',
    '验证': stylePrefix + 'Validation',
    '预测': stylePrefix + 'Prediction',
    '推理': stylePrefix + 'Inference',
  };
  
  const trimmedText = text.trim();
  const translation = translations[trimmedText] || stylePrefix + `这是"${text}"的示例翻译。AI翻译引擎可以准确地将多种语言互相转换，保持原文的语义和语气。`;

  // 对照表（演示用）：按空白切块，逐块配一个 key（从 1 起）。
  // 配不上对（译文块不够）的原文块**不放进数组** —— 界面上就是"无键"，不高亮。
  const srcParts = text.split(/(\s+)/).filter((s) => s.length > 0);
  const tgtParts = translation.split(/(\s+)/).filter((s) => s.length > 0);
  const segments = srcParts
    .slice(0, tgtParts.length)
    .map((source, i) => ({ key: i + 1, source, target: tgtParts[i] }))
    .filter((seg) => seg.target.length > 0);

  return {
    original: text,
    translation,
    style: style as 'academic' | 'business' | 'casual',
    sourceLang: /[\u4e00-\u9fff]/.test(text) ? 'zh' : 'en',
    targetLang: /[\u4e00-\u9fff]/.test(text) ? 'en' : 'zh',
    segments,
    relatedTerms: ['相关术语A', '相关术语B', '相关术语C'],
    keywords: ['AI翻译', '语义转换', '自然语言处理', '多语言支持'],
    grammarNotes: [
      '现在完成时态：表示过去发生的动作对现在的影响',
      '被动语态转换：英文被动句转换为中文主动句',
      '定语从句处理：长定语从句拆分为独立短句',
    ],
  };
};
