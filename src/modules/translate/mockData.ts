import { WordResult } from '../../types';

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

  // ------------------------------------------------------------------
  // 短语 / 多词词条
  //
  // 单词词条之外必须有短语条目：**短语查询是"关键词带释义 + 可点击跳查词"的主场**
  // （`isPhrase` 为真才返回 keywords）。没有这些条目时，查短语会落到 `defaultWordData`，
  // 演示者看到的是"暂无该单词的释义"，三个新做的可点击区块一个都不出现。
  //
  // 选词依据：① 已有词条的 `relatedTerms` 里被引用到的短语（algorithm → data structure /
  // big O notation）；② 演示语料里的高频短语；③ 常用搭配型短语。
  // ------------------------------------------------------------------
  'good morning': {
    word: 'good morning',
    isPhrase: true,
    phonetic: '/ɡʊd ˈmɔːrnɪŋ/',
    definitions: [
      {
        pos: 'phrase',
        meaning: '早上好（上午见面时的问候语）',
        example: {
          en: 'Good morning! Did you sleep well?',
          zh: '早上好！你睡得好吗？',
        },
      },
    ],
    keywords: [
      { term: 'good', definition: '好的；令人愉快的' },
      { term: 'morning', definition: '早晨；上午（中午 12 点前）' },
    ],
    relatedTerms: ['greeting', 'salutation', 'good afternoon', 'good evening'],
    collocations: ['say good morning to someone', 'a good morning', 'Good morning, everyone.'],
    register: '日常口语（对任何人都通用，比 "Morning." 更完整）',
  },
  'respond well to': {
    word: 'respond well to',
    isPhrase: true,
    phonetic: '/rɪˈspɑːnd wel tuː/',
    definitions: [
      {
        pos: 'phrase',
        meaning: '对……反应良好；对……有良好疗效',
        example: {
          en: 'The patient did not respond well to the initial treatment and required an alternative therapy.',
          zh: '该患者对初步治疗反应不佳，需要替代疗法。',
        },
      },
      {
        pos: 'phrase',
        meaning: '对……适应良好；在……（环境或条件）下生长旺盛',
        example: {
          en: 'These tropical plants respond well to warm, humid environments.',
          zh: '这些热带植物在温暖潮湿的环境中生长旺盛。',
        },
      },
      {
        pos: 'phrase',
        meaning: '对……做出积极回应；对……反馈良好',
        example: {
          en: 'Children respond well to praise and clear routines.',
          zh: '孩子对表扬和清晰的作息安排反应积极。',
        },
      },
    ],
    keywords: [
      { term: 'respond', definition: '作出反应；回应' },
      { term: 'well', definition: '好地；令人满意地（此处修饰 respond）' },
      { term: 'treatment', definition: '治疗；处理方法' },
      { term: 'therapy', definition: '疗法；治疗方案' },
      { term: 'environment', definition: '环境；外界条件' },
    ],
    relatedTerms: ['react to', 'respond to', 'treatment response', 'tolerance'],
    collocations: ['respond well to treatment', 'respond well to therapy', 'respond poorly to', 'respond well to change'],
    register: '中性（医学 / 农业 / 教育语境都常用）',
  },
  'data structure': {
    word: 'data structure',
    isPhrase: true,
    phonetic: '/ˈdeɪtə ˈstrʌktʃər/',
    definitions: [
      {
        pos: 'n.',
        meaning: '数据结构（数据在计算机中组织、存储与访问的方式）',
        example: {
          en: 'Choosing the right data structure often matters more than the algorithm itself.',
          zh: '选对数据结构往往比算法本身更关键。',
        },
      },
    ],
    keywords: [
      { term: 'data', definition: '数据' },
      { term: 'structure', definition: '结构；组织方式' },
      { term: 'array', definition: '数组（连续内存、按下标随机访问）' },
      { term: 'tree', definition: '树（分层结构，如二叉树、B 树）' },
    ],
    relatedTerms: ['algorithm', 'array', 'linked list', 'stack', 'queue', 'tree', 'graph'],
    collocations: ['data structure and algorithm', 'linear data structure', 'tree data structure', 'choose a data structure'],
  },
  'machine learning': {
    word: 'machine learning',
    isPhrase: true,
    phonetic: '/məˈʃiːn ˈlɜːrnɪŋ/',
    definitions: [
      {
        pos: 'n.',
        meaning: '机器学习（让程序从数据中自动归纳规律的方法）',
        example: {
          en: 'Machine learning models improve as they are exposed to more data.',
          zh: '机器学习模型接触的数据越多，表现通常越好。',
        },
      },
    ],
    keywords: [
      { term: 'machine', definition: '机器；此处指计算机系统' },
      { term: 'learning', definition: '学习；从数据中归纳规律的过程' },
      { term: 'model', definition: '模型（输入到输出的映射）' },
      { term: 'training', definition: '训练（用数据调整模型参数）' },
    ],
    relatedTerms: ['deep learning', 'neural network', 'supervised learning', 'training data'],
    collocations: ['machine learning model', 'machine learning algorithm', 'supervised machine learning', 'train a machine learning model'],
  },
  'artificial intelligence': {
    word: 'artificial intelligence',
    isPhrase: true,
    phonetic: '/ˌɑːrtɪˈfɪʃl ɪnˈtelɪdʒəns/',
    definitions: [
      {
        pos: 'n.',
        meaning: '人工智能（让机器完成需要人类智能的任务的技术）',
        example: {
          en: 'Artificial intelligence is changing how we search for and organize knowledge.',
          zh: '人工智能正在改变我们检索与组织知识的方式。',
        },
      },
    ],
    keywords: [
      { term: 'artificial', definition: '人工的；人造的' },
      { term: 'intelligence', definition: '智能；理解与推理的能力' },
      { term: 'agent', definition: '智能体（能感知环境并采取行动的程序）' },
    ],
    relatedTerms: ['machine learning', 'deep learning', 'neural network', 'natural language processing', 'computer vision'],
    collocations: ['artificial intelligence system', 'applied artificial intelligence', 'artificial general intelligence', 'the rise of artificial intelligence'],
  },
  'deep learning': {
    word: 'deep learning',
    isPhrase: true,
    phonetic: '/diːp ˈlɜːrnɪŋ/',
    definitions: [
      {
        pos: 'n.',
        meaning: '深度学习（用多层神经网络自动提取特征的方法）',
        example: {
          en: 'Deep learning has achieved remarkable results in image recognition.',
          zh: '深度学习在图像识别方面取得了显著成果。',
        },
      },
    ],
    keywords: [
      { term: 'deep', definition: '深的；此处指网络层数多' },
      { term: 'neural', definition: '神经的（neural network 神经网络）' },
      { term: 'layer', definition: '层；网络中的一层计算单元' },
      { term: 'training', definition: '训练' },
    ],
    relatedTerms: ['machine learning', 'neural network', 'convolutional neural network', 'backpropagation'],
    collocations: ['deep learning model', 'deep learning framework', 'deep neural network', 'train a deep learning model'],
  },
  'natural language processing': {
    word: 'natural language processing',
    isPhrase: true,
    phonetic: '/ˈnætʃrəl ˈlæŋɡwɪdʒ ˈprɑːsesɪŋ/',
    definitions: [
      {
        pos: 'n.',
        meaning: '自然语言处理（让计算机理解与生成人类语言的技术）',
        example: {
          en: 'Natural language processing enables computers to understand human language.',
          zh: '自然语言处理使计算机能够理解人类语言。',
        },
      },
    ],
    keywords: [
      { term: 'natural', definition: '自然的（指人类日常使用的语言）' },
      { term: 'language', definition: '语言' },
      { term: 'processing', definition: '处理；加工' },
      { term: 'text', definition: '文本；待处理的语言数据' },
      { term: 'token', definition: '词元（切分后的最小处理单位）' },
    ],
    relatedTerms: ['machine learning', 'large language model', 'tokenization', 'sentiment analysis', 'computer vision'],
    collocations: ['natural language processing model', 'natural language processing task', 'applied natural language processing'],
  },
  'big o notation': {
    word: 'big O notation',
    isPhrase: true,
    phonetic: '/bɪɡ oʊ noʊˈteɪʃn/',
    definitions: [
      {
        pos: 'n.',
        meaning: '大 O 记号（描述算法复杂度随规模增长的量级）',
        example: {
          en: 'Binary search runs in O(log n) time using big O notation.',
          zh: '用大 O 记号表示，二分查找的时间复杂度是 O(log n)。',
        },
      },
    ],
    keywords: [
      { term: 'notation', definition: '记号；表示法' },
      { term: 'complexity', definition: '复杂度（算法代价随规模的增长方式）' },
      { term: 'algorithm', definition: '算法' },
    ],
    relatedTerms: ['time complexity', 'space complexity', 'algorithm', 'asymptotic analysis'],
    collocations: ['time complexity in big O notation', 'express in big O notation', 'big O notation for'],
  },
  'take into account': {
    word: 'take into account',
    isPhrase: true,
    phonetic: '/teɪk ˈɪntuː əˈkaʊnt/',
    definitions: [
      {
        pos: 'phrase',
        meaning: '把……考虑在内；顾及',
        example: {
          en: 'The estimate did not take the cost of maintenance into account.',
          zh: '这份估算没有把维护成本考虑在内。',
        },
      },
    ],
    keywords: [
      { term: 'account', definition: '考虑；account for 亦作"占……比例"解' },
      { term: 'consider', definition: '考虑；认为' },
      { term: 'factor', definition: '因素；把……当作因素考虑' },
    ],
    relatedTerms: ['consider', 'factor in', 'allow for', 'take account of'],
    collocations: ['take into account the fact that', 'fully take into account', 'take all factors into account'],
  },
  'in terms of': {
    word: 'in terms of',
    isPhrase: true,
    phonetic: '/ɪn tɜːrmz əv/',
    definitions: [
      {
        pos: 'phrase',
        meaning: '就……而言；在……方面',
        example: {
          en: 'In terms of performance, the new version is roughly twice as fast.',
          zh: '就性能而言，新版本大约快了一倍。',
        },
      },
    ],
    keywords: [
      { term: 'terms', definition: '术语；条件；说法（此处指"从某个角度说"）' },
      { term: 'aspect', definition: '方面；角度' },
    ],
    relatedTerms: ['as regards', 'with respect to', 'regarding', 'in the context of'],
    collocations: ['in terms of cost', 'in terms of quality', 'in terms of performance'],
  },
};
// ------------------------------------------------------------------
// 常用搭配 / 关联术语补充表
//
// 为什么要有这张表：`collocations`（常用搭配）此前**一个词条都没有** ——
// 结果就是"常用搭配"这个区块在 Mock 演示里永远不出现，试用者会以为功能没做。
// `relatedTerms` 也只覆盖了 15/58 条，同样导致区块大面积缺席。
//
// 合并规则：**已有值优先**（原词条里手写的 relatedTerms 更贴学科，不要覆盖）。
// 关联术语尽量指向本文件里真实存在的词条 —— 点它跳查词才会得到有内容的结果。
// ------------------------------------------------------------------
const mockExtra: Record<string, { collocations?: string[]; relatedTerms?: string[] }> = {
  sample: { collocations: ['a random sample', 'a representative sample', 'sample size', 'collect samples'], relatedTerms: ['data', 'analysis', 'result'] },
  algorithm: { collocations: ['sorting algorithm', 'search algorithm', 'algorithm complexity', 'design an algorithm'], relatedTerms: ['data structure', 'big O notation', 'function'] },
  architecture: { collocations: ['software architecture', 'system architecture', 'layered architecture', 'architecture design'], relatedTerms: ['framework', 'interface', 'system', 'design'] },
  abstract: { collocations: ['abstract concept', 'abstract thinking', 'in the abstract'], relatedTerms: ['concept', 'theory', 'idea'] },
  implement: { collocations: ['implement a plan', 'implement a feature', 'implement a policy', 'fully implemented'], relatedTerms: ['development', 'process', 'method'] },
  optimize: { collocations: ['optimize performance', 'optimize the process', 'optimize for speed', 'optimize resource usage'], relatedTerms: ['performance', 'method', 'process'] },
  deploy: { collocations: ['deploy an application', 'deploy to production', 'deploy a model', 'deployment pipeline'], relatedTerms: ['integration', 'system', 'process'] },
  integration: { collocations: ['system integration', 'integration test', 'seamless integration', 'data integration'], relatedTerms: ['system', 'framework', 'interface'] },
  framework: { collocations: ['development framework', 'theoretical framework', 'within the framework of'], relatedTerms: ['architecture', 'interface', 'system'] },
  interface: { collocations: ['user interface', 'programming interface', 'interface design'], relatedTerms: ['framework', 'system', 'architecture'] },
  artificial: { collocations: ['artificial intelligence', 'artificial light', 'artificial flavor'], relatedTerms: ['artificial intelligence', 'machine learning'] },
  intelligence: { collocations: ['artificial intelligence', 'emotional intelligence', 'business intelligence'], relatedTerms: ['artificial intelligence', 'knowledge', 'understanding'] },
  machine: { collocations: ['machine learning', 'machine translation', 'by machine'], relatedTerms: ['machine learning', 'computer', 'system'] },
  learning: { collocations: ['machine learning', 'deep learning', 'learning curve', 'lifelong learning'], relatedTerms: ['machine learning', 'deep learning', 'knowledge'] },
  deep: { collocations: ['deep learning', 'deep understanding', 'deep dive'], relatedTerms: ['deep learning', 'neural network'] },
  neural: { collocations: ['neural network', 'artificial neural network', 'neural network model'], relatedTerms: ['neural network', 'deep learning', 'machine learning'] },
  network: { collocations: ['neural network', 'computer network', 'social network', 'network security'], relatedTerms: ['neural network', 'computer', 'system'] },
  natural: { collocations: ['natural language', 'natural resources', 'natural process'], relatedTerms: ['natural language processing', 'language'] },
  language: { collocations: ['natural language', 'programming language', 'foreign language', 'language model'], relatedTerms: ['natural language processing', 'computer', 'understanding'] },
  processing: { collocations: ['natural language processing', 'data processing', 'image processing', 'processing power'], relatedTerms: ['natural language processing', 'data', 'computer'] },
  computer: { collocations: ['computer science', 'computer vision', 'computer program'], relatedTerms: ['computer vision', 'algorithm', 'system'] },
  vision: { collocations: ['computer vision', 'vision system', 'clear vision', 'field of vision'], relatedTerms: ['computer vision', 'deep learning', 'machine learning'] },
  science: { collocations: ['computer science', 'data science', 'basic science'], relatedTerms: ['data', 'research', 'theory'] },
  technology: { collocations: ['information technology', 'emerging technology', 'technology stack', 'adopt technology'], relatedTerms: ['innovation', 'development', 'system'] },
  physics: { collocations: ['theoretical physics', 'quantum physics', 'laws of physics', 'applied physics'], relatedTerms: ['equation', 'theory', 'mathematics'] },
  mathematics: { collocations: ['applied mathematics', 'pure mathematics', 'advanced mathematics'], relatedTerms: ['equation', 'theorem', 'formula', 'function'] },
  chemistry: { collocations: ['organic chemistry', 'inorganic chemistry', 'a chemical reaction', 'chemistry laboratory'], relatedTerms: ['formula', 'equation', 'process'] },
  biology: { collocations: ['molecular biology', 'cell biology', 'the biology of'], relatedTerms: ['science', 'research', 'process'] },
  history: { collocations: ['in history', 'a long history', 'record history', 'history of science'], relatedTerms: ['process', 'development', 'research'] },
  economy: { collocations: ['market economy', 'global economy', 'a booming economy', 'state of the economy'], relatedTerms: ['development', 'process', 'research'] },
  function: { collocations: ['a key function', 'function as', 'mathematical function', 'function call'], relatedTerms: ['equation', 'formula', 'mathematics'] },
  equation: { collocations: ['solve an equation', 'differential equation', 'balance the equation', 'equation of state'], relatedTerms: ['formula', 'theorem', 'mathematics'] },
  theorem: { collocations: ['prove a theorem', 'Pythagorean theorem', 'central limit theorem'], relatedTerms: ['equation', 'formula', 'mathematics'] },
  formula: { collocations: ['chemical formula', 'a simple formula', 'formula for success', 'apply a formula'], relatedTerms: ['equation', 'theorem', 'method'] },
  system: { collocations: ['operating system', 'system design', 'a system of', 'complex system'], relatedTerms: ['architecture', 'process', 'system'] },
  theory: { collocations: ['in theory', 'theory of relativity', 'scientific theory', 'put theory into practice'], relatedTerms: ['theorem', 'concept', 'research'] },
  data: { collocations: ['data analysis', 'data set', 'raw data', 'collect data'], relatedTerms: ['data structure', 'analysis', 'model'] },
  model: { collocations: ['machine learning model', 'data model', 'business model', 'model training'], relatedTerms: ['machine learning', 'data', 'theory'] },
  analysis: { collocations: ['data analysis', 'cost-benefit analysis', 'analysis of', 'statistical analysis'], relatedTerms: ['data', 'method', 'research'] },
  method: { collocations: ['scientific method', 'research method', 'a method for solving', 'method and approach'], relatedTerms: ['approach', 'process', 'analysis'] },
  approach: { collocations: ['a new approach', 'approach to', 'adopt an approach'], relatedTerms: ['method', 'solution', 'process'] },
  solution: { collocations: ['a practical solution', 'solution to the problem', 'find a solution', 'optimal solution'], relatedTerms: ['problem', 'method', 'approach'] },
  problem: { collocations: ['solve a problem', 'problem solving', 'a common problem', 'problem statement'], relatedTerms: ['solution', 'challenge', 'method'] },
  challenge: { collocations: ['face a challenge', 'a major challenge', 'rise to the challenge'], relatedTerms: ['problem', 'opportunity', 'solution'] },
  opportunity: { collocations: ['take the opportunity', 'a great opportunity', 'opportunity cost', 'equal opportunity'], relatedTerms: ['challenge', 'problem', 'solution'] },
  result: { collocations: ['as a result', 'result in', 'experimental results', 'the final result'], relatedTerms: ['analysis', 'process', 'method'] },
  process: { collocations: ['in the process', 'development process', 'process data', 'process of'], relatedTerms: ['method', 'system', 'development'] },
  development: { collocations: ['software development', 'research and development', 'personal development', 'development process'], relatedTerms: ['process', 'improvement', 'research'] },
  improvement: { collocations: ['continuous improvement', 'room for improvement', 'improvement in', 'performance improvement'], relatedTerms: ['development', 'process', 'result'] },
  research: { collocations: ['scientific research', 'do research on', 'research and development', 'research findings'], relatedTerms: ['method', 'analysis', 'development'] },
  innovation: { collocations: ['technological innovation', 'drive innovation', 'a culture of innovation', 'product innovation'], relatedTerms: ['creativity', 'technology', 'development'] },
  creativity: { collocations: ['creative thinking', 'foster creativity', 'creativity and innovation'], relatedTerms: ['thinking', 'innovation', 'idea'] },
  thinking: { collocations: ['critical thinking', 'design thinking', 'way of thinking', 'logical thinking'], relatedTerms: ['creativity', 'idea', 'concept'] },
  idea: { collocations: ['a good idea', 'the main idea', 'come up with an idea'], relatedTerms: ['concept', 'thinking', 'creativity'] },
  concept: { collocations: ['basic concept', 'the concept of', 'a key concept', 'abstract concept'], relatedTerms: ['idea', 'theory', 'understanding'] },
  understanding: { collocations: ['deep understanding', 'mutual understanding', 'understanding of'], relatedTerms: ['knowledge', 'concept', 'learning'] },
  knowledge: { collocations: ['knowledge base', 'a body of knowledge', 'acquire knowledge', 'general knowledge'], relatedTerms: ['understanding', 'wisdom', 'learning'] },
  wisdom: { collocations: ['conventional wisdom', 'words of wisdom', 'the wisdom of'], relatedTerms: ['knowledge', 'understanding', 'thinking'] },
};

for (const [key, extra] of Object.entries(mockExtra)) {
  const entry = mockWordResult[key];
  if (!entry) continue;
  // 已有值优先：原词条里手写的 relatedTerms 更贴学科，不能被表里的通用词顶掉
  if (!entry.collocations?.length && extra.collocations?.length) entry.collocations = extra.collocations;
  if (!entry.relatedTerms?.length && extra.relatedTerms?.length) entry.relatedTerms = extra.relatedTerms;
}
