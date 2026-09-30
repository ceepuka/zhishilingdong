# 知识灵动助手 - 技术架构文档

**版本:** v1.6
**日期:** 2026-09-15
**状态:** 进行中

> **变更说明（v1.1）**：与代码实现对齐——5种卡片修正为6种（补 FormulaCard）、"知识结构图谱"修正为"知识目录"（div 层级树，非 SVG 知识图谱）、文档类型修正为11种、数据模型与 `src/types/index.ts` 完全对齐。
>
> **变更说明（v1.3）**：补充 v1.5.0/v1.6.0 落地内容——真流式生成（生产者-消费者）与超限自动续写（第 10 节）、多语言 i18n 字符串层与用户语言绑定（第 9 节）、查词/翻译改造（源/目标双下拉 + 逐段对齐 + 短语多词）、配图策略定稿、深度预算提高一档、6 种卡片状态更正为"死代码待处理"。
>
> **变更说明（v1.3 补充）**：v1.6.1 —— 第 10.5 节「首字延迟治理」（清洗节流 / 思维链识别 / 等待计时 / 关闭思考模式）、第 10.6 节「行内公式与 SVG 图示」（`LatexText`、SVG 等比缩放与线宽钳制）。
> **变更说明（v1.4）**：v1.6.2 —— 第 10.2 节「流式调用」改为链路状态诚实处理（移除运行时黑名单、首字节超时、`withFallback` 链路错误透传）、第 10.3 节续写判定同源化（`isCompleteJSON`）与续写轮边界加固、第 10.4 节空结果判定扩展至全部实质字段、第 10.5 节关闭思考改为按厂商分派（智谱 `thinking:{type:'disabled'}`）、第 5.3.1 节 SVG 由"学科制图惯例（负面约束）"升级为"正向画法教学" + 图源"积极引用" + 含"如图"试题约束。
>
> **变更说明（v1.5）**：v1.7.0 —— 第 10.2 节补 `fetchOrThrow` 传输层归类与 `finishReason` 透出、第 10.3 节「超限自动续写」升级为「自动续写（全链路中断）」（无内容时按原 prompt 重发 1 次、硬上限 3、不续写清单）、新增第 10.7 节「生成中断分类与错误处理分层」（四类归因 + `withFallback` strict 模式 + `GenerationNotice` 分档提示）。
>
> **变更说明（v1.6）**：v1.7.0 之后（m031）—— 新增第 10.8 节「内容渲染一致性：同一份数据只有一套渲染实现」：抽出共享 `KnowledgeContentView`（搜索与收藏共用）、`MarkdownContent` 让 Markdown 与公式共存、渲染前防御（`sanitizeMindMap` / `normalizeGenerated` / `isGeneratedKnowledge` / `$$` 切分顺序 / `toPlainPreview`）、收藏存储超配额降级契约。
>
> **变更说明（v1.6 补充）**：v1.7.0 之后（m032）—— 第 10.8 节补「归属判定规则」：**标题头（标题 + 概览 `summary`）与中断提示整体收进共享实现**，页面级操作用 `headerActions` 插槽注入；概览曾因留在外壳里导致收藏详情整段丢失，又曾因单独挪出标题卡导致搜索页观感回退 —— 最终以"字段连同视觉容器一起搬"收口。同时补齐导出（txt/md/html）的概览，与「复制」口径对齐。

---

## 目录

1. [技术架构](#1-技术架构)
2. [项目结构](#2-项目结构)
3. [模块设计](#3-模块设计)
4. [数据模型](#4-数据模型)
5. [AI 服务抽象层](#5-ai-服务抽象层)
6. [配置管理](#6-配置管理)
7. [设计决策记录](#7-设计决策记录)
8. [技术栈](#8-技术栈)
9. [多语言（i18n）与用户语言](#9-多语言i18n与用户语言)
10. [流式渲染与自动续写](#10-流式渲染与自动续写)

---

## 1. 技术架构

### 1.1 整体架构图

```
┌─────────────────────────────────────────────────────────────────────┐
│                        React 应用 (App.tsx)                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌──────────┐  │
│  │ 知识搜索模块 │  │ 词典翻译模块 │  │ 文档生成模块 │  │ 收藏面板  │  │
│  │  (search)   │  │ (translate) │  │   (doc)     │  │(favorites)│ │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └────┬─────┘  │
│         │                │                │              │         │
│  ┌──────┴────────────────┴────────────────┴──────────────┴──────┐  │
│  │                     通用组件层 (components)                    │  │
│  │  cards/(6种知识卡片·死代码) settings/(AI配置) layout/ ui/        │  │
│  │  history/(HistorySidebar) favorites/(FavoritesPanel·死代码)    │  │
│  └───────────────────────────────┬───────────────────────────────┘  │
│                                  │                                  │
│  ┌───────────────────────────────┴───────────────────────────────┐  │
│  │        工具/状态/i18n/服务层 (hooks/i18n/services/utils/types) │  │
│  │  HistoryContext  useTheme  useLanguageStore  useAIConfigStore   │  │
│  │  i18n/(languages, strings)                                      │  │
│  │  services/(aiServiceProvider, providers/, streaming/, mockAIService)│
│  │  types/  utils/  styles/                                        │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│    AI 服务（OpenAI 兼容协议：智谱/通义/硅基流动/自定义厂商，Mock 回退）│
├─────────────────────────────────────────────────────────────────────┤
│              第三方库 (KaTeX / react-markdown / jspdf)               │
├─────────────────────────────────────────────────────────────────────┤
│                  构建工具 (Vite + TypeScript)                        │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.2 架构分层

| 层级 | 职责 | 主要文件 |
|------|------|---------|
| **应用层** | 全局状态管理、路由控制、模块协调 | App.tsx, main.tsx |
| **模块层** | 业务功能实现 | modules/search/, translate/, doc/, favorites/ |
| **组件层** | UI组件复用 | components/cards/, settings/, layout/, ui/, history/, favorites/ |
| **状态层** | 跨模块共享状态（历史/主题/收藏/语言/AI配置） | hooks/HistoryContext, hooks/useTheme, hooks/useLanguageStore, hooks/useAIConfigStore |
| **i18n 层** | 多语言字符串与语言目录 | i18n/languages.ts, i18n/strings/ |
| **服务层** | AI 服务抽象、流式解析与具体实现 | services/aiServiceProvider, baseAIProvider, providers/genericProvider, streaming/, commonsImage, mockAIService |
| **工具层** | 通用工具和类型定义 | hooks/, types/, utils/ |

---

## 2. 项目结构

```
src/
├── components/           # 通用组件
│   ├── cards/            # 知识卡片组件（6种）⚠️ 当前为死代码，未被主流程引用
│   │   ├── ConceptCard.tsx       # 概念定义
│   │   ├── ProcessCard.tsx       # 流程过程（SVG流程图）
│   │   ├── CompareCard.tsx       # 对比关系（对比表格）
│   │   ├── HierarchyCard.tsx     # 层级结构（树状图）
│   │   ├── TimelineCard.tsx      # 时间序列（水平时间轴）
│   │   ├── FormulaCard.tsx       # 公式定理（公式卡片）
│   │   └── index.tsx             # KnowledgeCard 分发器
│   ├── history/          # 通用历史侧边栏
│   │   └── HistorySidebar.tsx
│   ├── favorites/        # 收藏面板 ⚠️ FavoritesPanel.tsx 为死代码
│   │   └── FavoritesPanel.tsx
│   ├── knowledge/        # 知识内容渲染（搜索 / 收藏共用的唯一实现，见 10.8）
│   │   └── KnowledgeContentView.tsx  # KnowledgeContentView + MindMap + ExamQuestionCard
│   │                                 # + ConceptIllustration + normalizeGenerated + isGeneratedKnowledge
│   ├── layout/           # 布局组件
│   │   ├── Header.tsx
│   │   └── TabNav.tsx
│   ├── settings/         # AI 配置面板
│   │   ├── ModelSelector.tsx     # 厂商/型号选择
│   │   ├── ProviderKeyInput.tsx  # 密钥输入
│   │   ├── AddProviderForm.tsx   # 添加自定义厂商
│   │   └── providerTemplates.ts  # 厂商快捷模板（8 套）
│   └── ui/               # UI基础组件
│       ├── Button.tsx, Input.tsx, Card.tsx, Tag.tsx
│       ├── ConfirmDialog.tsx    # 通用确认对话框
│       ├── LatexText.tsx        # 所有 AI 文本的唯一渲染入口（含裸 LaTeX 识别）
│       ├── MarkdownContent.tsx  # Markdown + 公式共存渲染（结构交给 Markdown、文本交给 LatexText）
│       ├── GenerationNotice.tsx # 生成中断分档提示横幅（搜索 / 文档 / 收藏共用）
│       ├── ImageFigure.tsx      # 外链配图渲染
│       └── SvgFigure.tsx        # 内联 SVG 配图渲染（严格清洗）
├── hooks/                # 自定义 Hooks
│   ├── HistoryContext.tsx    # 全局历史记录上下文
│   ├── useAIConfig.ts        # 多厂商配置 Hook（useSyncExternalStore）
│   ├── useAIConfigStore.ts   # 配置存储读写层（LocalStorage v2）
│   ├── useCommonsImage.ts    # 配图加载（导出 useKnowledgeImage，Commons/维基双源）
│   ├── useFavorites.ts       # 收藏（含 localStorage 超配额降级，见 10.8）
│   ├── useHistory.ts         # 历史记录读取
│   ├── useLanguage.ts        # 语言（useSyncExternalStore）
│   ├── useLanguageStore.ts   # 语言存储读写层（LanguageCode）
│   ├── useSpeechSynthesis.ts # TTS 朗读
│   ├── useStrings.ts         # i18n 字符串读取（React 侧）
│   ├── useTheme.ts           # 主题
│   ├── useTimeRefresh.ts     # 时间自动刷新
│   └── __tests__/
├── i18n/                 # 多语言字符串层（v1.6.0）
│   ├── languages.ts          # 语言目录 + normalizeLanguage
│   ├── __tests__/
│   └── strings/              # common / settings / search / translate / misc
│                             # + aiProviderTexts / docTemplates / index
├── modules/              # 功能模块
│   ├── search/           # 知识搜索模块
│   │   ├── index.tsx
│   │   ├── components/           # SearchInput / SearchContainer / HotTags / SearchModeSelector / QAContainer
│   │   ├── hooks/useSearchMode.ts
│   │   ├── services/QAService.ts
│   │   ├── SearchResults.tsx
│   │   ├── KnowledgeGraph.tsx    # 知识目录（div 层级树，非 SVG 知识图谱）
│   │   ├── QASection.tsx
│   │   ├── useSearchStateMachine.ts
│   │   ├── __tests__/
│   │   └── mockData.ts
│   ├── translate/        # 词典翻译模块
│   │   ├── index.tsx
│   │   ├── TranslateInput.tsx     # 源/目标双下拉
│   │   ├── WordResult.tsx
│   │   ├── SentenceResult.tsx     # 逐段对齐
│   │   ├── constants.ts
│   │   ├── __tests__/
│   │   └── mockData.ts
│   ├── doc/              # 文档生成模块
│   │   ├── index.tsx
│   │   ├── DocTypeSelector.tsx
│   │   ├── DocEditor.tsx
│   │   ├── DocResult.tsx
│   │   └── templates.ts          # 结构 + generate*(topic, language)
│   └── favorites/        # 收藏模块
│       ├── index.tsx
│       ├── FavoriteContent.tsx
│       └── __tests__/
├── services/             # AI 服务抽象层
│   ├── aiServiceProvider.ts   # 运行时动态路由（Mock/真实AI）
│   ├── baseAIProvider.ts      # Provider 抽象基类（prompt + 请求骨架 + 流式 + 续写）
│   ├── providers/genericProvider.ts  # GenericAIProvider + 预设厂商 overlay
│   ├── streaming/             # 流式增量解析
│   │   ├── partialJSON.ts     # StreamingJSONParser
│   │   ├── interruption.ts    # 中断分类模型（归因 / 续写策略 / code 映射，见 10.7）
│   │   └── sseReader.ts       # SSE 流读取 + truncated / finishReason 透出
│   ├── commonsImage.ts        # 配图查询（Commons/维基双源）
│   ├── __tests__/
│   └── mockAIService.ts       # Mock 实现（API Key 未配置时启用）
├── types/                # TypeScript类型定义
│   ├── index.ts
│   ├── ai.ts
│   └── aiProviders.ts     # 厂商元数据 + v2 配置类型 + 解析函数
├── utils/                # 工具函数
│   ├── export.ts              # 导出（多语言表头）
│   ├── inlineSvg.ts           # 内联 SVG 严格清洗
│   ├── jsonRepair.ts          # JSON 脏数据 4 层修复
│   ├── latex.ts               # LaTeX 归一化 + 安全渲染
│   ├── preview.ts             # 列表摘要纯文本化（去公式围符 / Markdown 标记后再截断）
│   └── __tests__/
├── styles/               # 全局样式
├── App.tsx               # 根组件
└── main.tsx              # 入口文件
```

> **注**：函数图像、算法动画等动态可视化功能已从 PRD 弃用，对应 `src/modules/visual/` 代码已删除（仅遗留一个空目录，待清理）。

---

## 3. 模块设计

### 3.1 模块一：整体框架与导航

**技术要点：**
- 顶部导航栏，四个Tab切换（知识搜索 | 词典翻译 | 文档生成 | 收藏）
- URL hash 同步路由状态（#search, #translate, #doc, #favorites）
- 响应式布局，最大宽度1200px居中
- 默认亮色主题；主色 teal (#0d9488)，辅色 amber (#f59e0b)，深色模式使用 zinc 中性灰色系

**组件：** Header.tsx, TabNav.tsx

### 3.2 模块二：知识搜索（核心模块）

**技术要点：**
- 大搜索框居中，智能标签根据输入内容实时更新
- AI 返回结构化结果，**流式渲染**：单次调用 `generateStream`，AI 边写、UI 边读共享缓冲区渲染
  （按 JSON 字段顺序依次显现：**概览 → 思维导图 → 核心概念 → 知识脉络 → 试题 → 趣味知识**）
- **超限自动续写**：输出被模型上限截断时（严格闭合判定 `hasCompleteJSONObject`），自动回填已生成内容要求"只输出续写"，最多 3 次尝试；完成后 UI 追加"已自动续写并补全"提示（详见第 10 节）
- 思维导图：两阶段递归布局算法（measureNode + layoutMeasuredNode）、画布拖动、直角折线连接、叶子描述外置
- 知识目录（**原"知识结构图谱"**）：div 层级树形结构占位组件，**非 SVG 知识图谱**；当前仅作为占位实现，知识图谱导航暂不考虑开发
- 6 种知识卡片类型：概念、流程、对比、层级、时间轴、公式
- 追问对话区（搜索模式基于 topic+历史；QA 模式基于历史对话，共用 `followup` 接口通过 `mode` 参数区分）
- 知识内容导出（Markdown）+ 复制功能
- 搜索状态机：IDLE → VALIDATING → ANALYZING → KNOWLEDGE_GRAPH/GENERATING → DISPLAYING → FOLLOWUP

> **状态说明（v1.2 更正）**：6 种知识卡片组件存在于 `src/components/cards/`，但**完全未被任何模块引用**（`relatedResults` 死区块已于 2026-09-05 删除），属死代码。按开发期策略需接入主流程或直接删除，待决策。详见 [issues.md](issues.md)。

**组件：**
- SearchInput: 搜索框组件（含搜索范围标签）
- SearchContainer: 搜索结果容器（含无效查询提示）
- HotTags: 热门标签
- SearchModeSelector: 搜索/QA 双模式切换
- QAContainer / QASection: 问答区与追问对话
- KnowledgeGraph: **知识目录**占位组件（div 层级树，非 SVG 知识图谱）
- SearchResults: 搜索结果展示（含概览、思维导图、概念、示例、试题、脉络、趣味、配图）
- useSearchStateMachine: 搜索状态机
- useSearchMode: 搜索/QA 双模式切换 hook

> **注**：旧的 `SmartTags`（智能标签）组件已删除，标签推荐并入搜索输入区实现。

**卡片组件（6种）：**
- ConceptCard: 概念定义卡片（含初等/高等两层解释）
- ProcessCard: 流程过程卡片（SVG流程图）
- CompareCard: 对比关系卡片（对比表格）
- HierarchyCard: 层级结构卡片（树状图）
- TimelineCard: 时间序列卡片（水平时间轴）
- FormulaCard: 公式定理卡片（KaTeX 公式渲染）

### 3.3 模块三：词典翻译

**技术要点：**
- 源/目标语言**双下拉**（源含"自动检测"，目标默认跟随用户语言，未手改则随设置联动）+ 交换按钮
- **手动切换**查词模式 / 翻译模式（不自动检测输入内容，避免反直觉）
- `detect` 只检测**源语言**并判定是否短语（`{ sourceLang, isPhrase, confidence }`），不再推断语言方向
- 查词模式：音标、词性、释义、例句、同义词/反义词、关联术语、常用搭配、语域、词源；支持**短语/多词**（返回最多 10 个 `keywords`，每项是 `{term, definition}`）
- 翻译模式：原文/译文**逐段对齐**（`segments[{key,source,target}]`）、关键词、关联术语、语法说明
- **风格在翻译前选**（`TranslateInput` 顶部的风格选择器，仅翻译模式显示）；结果卡只展示"这次用的是哪种风格"，不提供切换
- 选词实时映射：**AI 填 `key`，前端按 key 配对高亮**（`modules/translate/alignment.ts`）。配对只用 key，不用数组下标或字符位置 —— 语序可以完全相反（`Good morning → 早上好`，key1 = Good/好、key2 = morning/早上）
- 两侧渲染**只从 `original` / `translation` 两个权威字符串切区间**，绝不拼接 `segments`（拼接在语序相反时会得到「好早上」，且显示/复制/导出三个出口互相不等）；不变量 `runs.map(r => r.text).join('') === text`，降级只能是「不高亮」，不能是「不显示」
- **关键词 / 关联术语 / 常用搭配的点击出口**（`components/ui/TermList.tsx` 统一渲染「词 + 一句话释义」）：
  查词模式三个入口都回到查词（`onLookup`）；翻译模式关键词跳查词、关联术语跳知识搜索（`onSearchTopic`，见 3.3.1）
- **生成链路与搜索一致**（`generateJSONWithContinuation`，见 10.3）：文本被截断时自动回填续写，不再"少一个字符就整段丢弃"；
  中断/续写状态透出到 `WordResult` / `SentenceResult`，由 `GenerationNotice` 挂在**结果卡末尾**（词条结果没有边出边渲染，这是用户唯一能知道"这次可能不全"的渠道）
- **失败文案按 code 分档**：`modules/translate/errorText.ts::friendlyTranslateError(code, raw)`。技术描述（`Failed to parse JSON response (length=…, preview: …)`）
  只进 `interruption.detail` 与控制台，**绝不上屏**；`catch` 不再静默塞 mock 结果（用户会把 mock 当真实结果读）
- **Mock 演示数据的硬要求**（`modules/translate/mockData.ts` + `services/mockAIService.ts`）：区块的渲染条件是"数组非空"，
  所以**数据缺失 = 区块消失**，不是显示成空。因此：① 68 条词条全部带 `collocations` / `relatedTerms`；② 短语词条必须带 `keywords`；
  ③ 翻译语料没有策展数据就**不给**，不用 `['相关词汇']` / `['语法说明']` 这类占位垃圾顶替（点了会搜出无关内容）；
  ④ 未收录的词由 `deriveMockFallbackDefinitions()` 按词素给一条**标注了"Demo 降级"**的拆解释义，不编造词义 ——
  可点击目标天然远多于词表（实测 354 vs 68），靠枚举补不完。全量守卫见 `modules/translate/__tests__/mockLinks.test.ts`
- 输入上限与计数（查词 120 / 翻译 3000，超长截断提示）
- TTS 朗读功能（单词发音、句子原文/译文朗读，朗读状态反馈）
- 生词收藏功能

**组件：** TranslateInput, WordResult, SentenceResult

**数据模型：** 见 [4.2 词典翻译数据模型](#42-词典翻译数据模型)

#### 3.3.1 跨模块跳转（翻译 → 知识搜索）

翻译模式的关联术语要能带着词切到知识搜索并发起搜索。**不能用 ref 直接调**：切标签页的那一刻
`SearchModule` 才是刚挂载，`searchRef.current` 还是 `null`，谁也调不到它。所以：

- `App.tsx` 持有 `pendingSearchTerm`，`handleSearchTopic(term)` = 设值 + 切 tab；
- 词通过 props 传给 `SearchModule`，由它在挂载后自己消费一次，消费完回调清空；
- **同一个词只消费一次**（`consumedInitialQueryRef` 守门）—— 否则切走再切回搜索会莫名其妙又搜一遍。

### 3.4 模块四：文档生成

**技术要点：**
- **11 种文档类型**：通用、商务邮件、报告大纲、会议纪要、PPT结构、学习笔记、合同、简历、新闻稿、项目方案、周报
- 文档类型选择器（折叠/展开效果，移到输入框下方）
- 商务邮件支持3种语气风格（正式/友好/简洁）
- 文档生成结果 Markdown 渲染（react-markdown + remark-gfm）
- 复制功能、多格式导出（TXT/Markdown/PDF，PDF 支持中文和分页）
- 文档收藏功能
- 浏览中状态：使用 `currentTopic`（原始输入 topic）作为标识，而非 `result.title`

**组件：** DocTypeSelector, DocEditor, DocResult

**模板：** templates.ts（文档生成模板）

### 3.5 模块五：收藏与历史

**技术要点：**
- 收藏功能：LocalStorage 持久化，`useSyncExternalStore` 模块级共享状态
- 收藏空间管理（默认/工作/学习空间）
- 历史记录：HistoryContext + Context 模式，5 种类型（search/qa/dictionary/translate/doc）
- 通用历史侧边栏组件（HistorySidebar，3种主题色：teal/amber/blue）
- 时间自动更新 + "浏览中"标记替换时间显示
- 收藏与历史记录架构分离（`label` 字段 + `HistoryData` 联合类型）
- 通用确认对话框（ConfirmDialog）：清空历史/收藏前二次确认
- **详情渲染不自建实现**：知识类收藏复用搜索页的 `KnowledgeContentView`（见 10.8），文档类复用 `MarkdownContent`，词典/翻译文本走 `LatexText`
- **存储降级**：完整写入失败 → 剥离 base64 图片重试 → 仍失败则在页面给出可见提示（不静默失败）
- **去重指纹**：类型 + 收藏夹 + 标题（与星标判定同口径），不做大对象深度比对

**组件：** FavoritesModule（index.tsx）/ FavoriteContent / KnowledgeContentView（共享）/ MarkdownContent（共享）, HistorySidebar, ConfirmDialog

---

## 4. 数据模型

> 本节与 `src/types/index.ts` 完全对齐。如代码与本文档冲突，以代码为准。

### 4.1 知识节点与搜索结果

```typescript
export type KnowledgeType = 'concept' | 'process' | 'formula' | 'timeline' | 'compare' | 'hierarchy' | 'theorem';
export type KnowledgeStage = 'basic' | 'advanced';

export interface KnowledgeNode {
  id: string;
  title: string;
  type: KnowledgeType;
  stage: KnowledgeStage;
  category: string;
  definition: string;
  points: string[];
  examples: string[];
  relatedIds: string[];
  explanation: {
    basic: string;
    advanced: string;
    difference: string;
  };
}
```

### 4.2 词典翻译数据模型

> v1.6.0 变更：删除 `LangDirection` 枚举，改为显式 `sourceLang` / `targetLang` 语言码；查词支持短语/多词；翻译结果改为逐段对齐。

```typescript
export type TranslateStyle = 'academic' | 'business' | 'casual';
export type TranslateMode = 'dictionary' | 'translate';

export interface WordDefinition {
  pos: string;
  meaning: string;
  example?: { en: string; zh: string };
}

export interface WordResult {
  word: string;
  /** 是否为短语/多词查询 */
  isPhrase?: boolean;
  phonetic: string;
  definitions: WordDefinition[];
  /** 短语/多词查询时 AI 分析出的关键词（最多 10 个），带释义、点击跳查词 */
  keywords?: KeywordEntry[];
  synonyms?: string[];
  antonyms?: string[];
  relatedTerms?: string[];
  collocations?: string[];
  register?: string;
  etymology?: string;
}

export interface SentenceResult {
  original: string;
  translation: string;
  style: TranslateStyle;
  sourceLang?: string;
  targetLang?: string;
  /** 原文/译文逐段对齐（选词实时映射用）。key 是 AI 按原文顺序填的对照编号，见 4.2.1 */
  segments?: { key?: number; source: string; target: string }[];
  relatedTerms?: string[];
  keywords?: KeywordEntry[];
  grammarNotes?: string[];
}

/**
 * 关键词条目：词 / 词组 / 短语 + 一句话释义。
 * 释义可选 —— 缺了只是少一行字，条目本身绝不消失。
 * 归一化统一走 `toKeywordEntries()`（components/ui/TermList.tsx）：
 * AI 可能返回裸字符串，收藏夹读到的旧数据也是裸字符串。
 */
export interface KeywordEntry {
  term: string;
  definition?: string;
}

// 语言检测只返回源语言 + 是否短语
export interface TranslateDetectResponse {
  sourceLang: string;
  isPhrase: boolean;
  confidence?: number;
}
```

### 4.3 文档生成数据模型

```typescript
export type DocType = 'general' | 'email' | 'report' | 'meeting' | 'ppt' | 'notes'
                    | 'contract' | 'resume' | 'press' | 'proposal' | 'weekly';
export type EmailTone = 'formal' | 'friendly' | 'concise';

export interface DocResult {
  type: DocType;
  title: string;
  content: string;
  tone?: EmailTone;
}
```

### 4.4 6 种知识卡片数据模型

```typescript
export interface ConceptCardData {
  type: 'concept';
  title: string;
  category?: string;
  tags?: string[];
  definition: string;
  points: string[];
  example: string;
}

export interface ProcessCardData {
  type: 'process';
  title: string;
  category?: string;
  tags?: string[];
  steps: ProcessStep[];   // { name: string; desc: string }
}

export interface FormulaCardData {
  type: 'formula';
  title: string;
  category?: string;
  tags?: string[];
  formula: string;
  description: string;
}

export interface TimelineCardData {
  type: 'timeline';
  title: string;
  category?: string;
  tags?: string[];
  events: TimelineEvent[]; // { time: string; event: string }
}

export interface CompareCardData {
  type: 'compare';
  title: string;
  category?: string;
  tags?: string[];
  items: CompareItem[];
  columns: string[];
}

export interface HierarchyCardData {
  type: 'hierarchy';
  title: string;
  category?: string;
  tags?: string[];
  tree: TreeNode[];       // { name: string; children: TreeNode[] }
}

export type KnowledgeCardData =
  | ConceptCardData
  | ProcessCardData
  | FormulaCardData
  | TimelineCardData
  | CompareCardData
  | HierarchyCardData;
```

### 4.5 收藏与历史记录

```typescript
export interface FavoriteItem {
  id: string;
  type: 'knowledge' | 'dictionary' | 'translation' | 'document';
  data: unknown;
  label: string;
  timestamp: number;
  spaceId?: string;
}

export interface FavoriteSpace {
  id: string;
  name: string;
  color: string;
  icon: string;
  createdAt: number;
}

// 历史记录数据联合类型（按 type 区分）
export interface SearchHistoryData {
  result?: KnowledgeCardData;
  generatedData?: GeneratedKnowledge;
  messages?: ChatMessage[];
}
export interface DictHistoryData { result: WordResult; }
export interface TranslateHistoryData { result: SentenceResult; }
export interface DocHistoryData { result: DocResult; }

export type HistoryData =
  | QASession
  | SearchHistoryData
  | DictHistoryData
  | TranslateHistoryData
  | DocHistoryData;

export interface HistoryItem {
  id: string;
  type: 'search' | 'qa' | 'dictionary' | 'translate' | 'doc';
  query: string;
  timestamp: number;
  data?: HistoryData;
}
```

### 4.6 思维导图与生成知识

```typescript
export type NodeLevel = 'root' | 'branch' | 'subBranch' | 'leaf';

export interface MindMapNode {
  id: string;
  title: string;
  level: NodeLevel;
  description?: string;
  children?: MindMapNode[];
}

export interface Concept {
  type: 'definition' | 'formula' | 'theorem' | 'principle';
  title: string;
  content: { elementary: string; advanced: string };
  notation?: string;
  /** 权威图库图片直链（首选：Wikimedia Commons 等标准示意图，渲染失败自动隐藏） */
  image?: string;
  /** AI 手绘 SVG 兜底：仅在无权威图时使用（需模型具备画图能力） */
  svg?: string;
  /** 关键要点：3~4 条 */
  keyPoints?: string[];
  /** 易错提醒：1~2 条常见误区 */
  pitfalls?: string[];
  example?: string;
}

export interface ExamQuestion {
  id: string;
  type: 'choice' | 'fill' | 'calculation' | 'essay';
  question: string;
  /** 可信图源直链（白名单校验），渲染失败自动隐藏并回退 */
  image?: string;
  /** 试题配图的图片数据直填（base64 data URL）：富文本内嵌图"直接提取源数据" */
  imageData?: string;
  svg?: string;
  options?: string[];
  answer: string;
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard';
  source: { year: string; exam: string; section?: string };
}

export interface KnowledgeContextConfusable {
  topic: string;       // 易混概念名
  difference: string;  // 与本主题的核心区别（一句话）
}

export interface KnowledgeContext {
  prerequisites: string[];
  relatedTopics: string[];
  learningPath: string[];
  commonConclusions?: string[];
  confusables?: KnowledgeContextConfusable[];  // 易混辨析：1~2 条
}

export interface GeneratedKnowledge {
  topic: string;
  summary?: string;
  /** 核心概念区块的总述：渲染在「核心概念」标题下、各概念卡片之前 */
  conceptsOverview?: string;
  mindMap: MindMapNode[];
  concepts: Concept[];
  examples: Example[];
  relatedResults: KnowledgeCardData[];
  knowledgeContext: KnowledgeContext;
  examQuestions: ExamQuestion[];
  interestingFacts: InterestingFact[];
  /** 输出是否因 max_tokens 上限被截断（finish_reason === 'length'），UI 需明确提示 */
  truncated?: boolean;
  /** 是否经超限自动续写补全 */
  continued?: boolean;
}
```

> **勘误（v1.3）**：
> 1. `Concept` / `ExamQuestion` 新增 `svg` 字段 —— 配图改为"AI 手绘 SVG 示意图 + 外链图片"双通道，
>    解决模型猜图片直链命中率极低的问题（详见 4.6.1）。
> 2. `GeneratedKnowledge` 有 `summary` 与 `conceptsOverview` 两个字段：
>    - `conceptsOverview`（总述）**属于「核心概念」区块**，渲染在「核心概念」标题下、
>      各概念卡片之前，是核心概念的引导段（不是独立章节，也不放在思维导图前面）
>    - 流式 `STEP_ORDER` 为 `summary → mindMap → conceptsOverview → concepts → …`，
>      与页面渲染顺序一致（总述在思维导图之后、概念列表之前）

### 4.7 问答会话与聊天消息

```typescript
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface QASession {
  id: string;
  messages: ChatMessage[];
  timestamp: number;
}
```

---

## 5. AI 服务抽象层

### 5.1 接口契约

`services/aiServiceProvider.ts` 通过 `shouldUseRealAI()` 运行时动态检测：
- 返回 true：当前 activeProvider 的 Key 状态为 `valid` → 路由到对应 Provider.buildService()
- 返回 false：回退到 MockAIService（3 大模块全部走本地生成）
- 调用签名：`aiService.search.{validate,analyze,generate,generateStream,followup,followupStream}` / `aiService.translate.{detect,queryWord,queryTranslate}` / `aiService.document.{generate,generateStream,export}`

### 5.2 多厂商 Provider 体系（v2 — 无限扩展版）

**整体结构**：`BaseAIProvider`（抽象基类） + `GenericAIProvider`（唯一具体实现，overlay 注入差异） + `aiServiceProvider`（路由层 + Map 缓存工厂）

```
业务模块 → aiService.* → getAIService() 动态路由
                    ├─→ activeProvider.valid = true → getProviderInstance(id, customProviders)
                    │     └─ new GenericAIProvider(id, PRESET_OVERLAYS[id])
                    │           ├─ 预设 3 厂商：zhipu（无 overlay）/ dashscope（错误映射）/ siliconflow（中文前缀）
                    │           └─ 用户自定义厂商：无 overlay，元数据来自 root.customProviders
                    └─→ 其他情况 → mockAIService
```

**扩展机制**：`ProviderId = string`（不再是联合字面量）。新增厂商有两种方式：
- **预设厂商**：在 `PROVIDER_META` 注册元数据（名称/Base URL/型号列表），按需在 `PRESET_OVERLAYS` 加差异 overlay
- **用户自定义厂商**：UI"添加厂商"表单写入 `customProviders`，运行时直接 `new GenericAIProvider(id)`，无需改代码

**一期支持 3 厂商 9 型号**：

| 厂商 | ProviderId | 默认 Base URL | 型号（id / 描述） |
|------|-----------|--------------|-----------------|
| 智谱 AI | `zhipu` | `https://open.bigmodel.cn/api/paas/v4/chat/completions` | `glm-4-flash`（推荐/128K）、`glm-4-plus`（128K）、`glm-4.5-flash`（1M） |
| 阿里通义千问 | `dashscope` | `https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions` | `qwen-plus`（推荐/128K）、`qwen-turbo`（128K）、`qwen-long`（1M） |
| 硅基流动 | `siliconflow` | `https://api.siliconflow.cn/v1/chat/completions` | `Qwen2.5-7B`（推荐/32K）、`deepseek-llm-67b-chat`（32K）、`Llama-3.1-8B`（128K） |

**核心扩展点**（v2 通过 `ProviderOverlay` 配置注入，无需写子类）：
- `mapErrorResponse(raw, statusCode, superFn)`：将厂商特有的错误格式（如 DashScope 旧格式根 code/message）归一为 `{ code, message, recoverable }`
- `systemPromptPrefix`：模型特有的 system 前缀（如硅基流动给中文助手前置）
- 基类内置 `getDepthConfig(depth, ctxLen?, caps?)`：`max_tokens` 取 `min(基线, 模型输出上限, contextLength×40%)` 防止上下文溢出或厂商 400（见 5.3）

**通用基类能力**：
- `callModel`：统一 OpenAI 兼容请求体、Authorization/Bearer、非流式（一次性返回全文）
- `callModelStream`：同上但 `stream: true`，按 SSE 逐段解析 `choices[0].delta.content`；服务端不支持流式或协议解析失败时**自动降级**为 `callModel`，对调用方透明
- `callModelWithJSON<T>`：末尾自动追加 "请严格按 JSON 返回" + 调用 4 层 JSON 修复解析器
- `StreamingJSONParser`：增量 JSON 解析器（AI 写入 / 渲染读取共享缓冲区），对任意截断位置都能补出可渲染的部分对象
- `withFallback`：NO_API_KEY 关键字 → AIError code=NO_API_KEY，其他异常走 fallback 值 / fallback 函数
- `sanitizeMindMap` / `sanitizeMindMapNode`：脑图节点防御性兜底
- `buildService()`：一次性生成完整 11 个业务方法（全部 prompt 集中在基类，各厂商共享）

### 5.3 深度配置（AIDepth → max_tokens）+ 模型能力感知（v1.3，预算 v1.5 提高一档）

| 深度 | 基线 max_tokens | temperature | 适用场景 |
|------|----------------|-------------|---------|
| max | 16384 | 0.3 | 预留（当前业务未使用） |
| high | 12288 | 0.3 | 知识搜索生成 `generateStream`、文档生成 |
| medium | 4096 | 0.7 | 其他（校验、意图识别、追问、查词、翻译） |

最终 `max_tokens = min(基线（推理型抬到 ≥8192）, 模型输出上限, model.contextLength × 40%)`。

> **v1.5 调整原因**：旧值（8192/6144/2048）实测让大多数旗舰模型在末尾区块（趣味知识）撞墙，表现为"半句话截断"。现同时**检测并提示截断**，并把预算整体提高一档。

**v1.3 新增：模型能力画像（ModelCapabilities）**。生成质量不只取决于提示词，也取决于模型能力边界。
`ModelInfo.capabilities` 声明每个型号的能力，请求层按能力裁剪参数：

| 能力字段 | 作用 |
|---------|------|
| `streaming` | 不支持则**直接不发** `stream:true`，省掉一次注定失败的往返 |
| `jsonMode` | 支持时才加 `response_format:{type:'json_object'}`，把格式风险交给 API 层兜底 |
| `reasoning` | 推理型模型**不传 temperature**（部分厂商会报错），并把输出预算抬到 ≥8192 |
| `maxOutputTokens` | 单次输出上限，`max_tokens` 会被夹在这个值内（超限多数厂商直接 400，整块内容丢失） |
| `maxTokensParam` | OpenAI o 系列等只认 `max_completion_tokens` |
| `vision` | 展示用 |

- 未知型号（自定义模型 ID、自定义厂商）走 `DEFAULT_MODEL_CAPABILITIES` 保守值：流式可试、不开 JSON 强约束、输出预算 **16384**（由 4096 提升，防止未知模型被压太狠而截断）。
- **流式能力黑名单**（进程内缓存，**带冷却期**）：某型号实测不走流式后记入，**冷却期（`STREAM_RETRY_COOLDOWN_MS`，60s）内**后续请求直接走非流式以省掉注定失败的往返；冷却期结束会自动再试一次，流式成功即立即移出（自愈）。
  > ⚠️ **必须是"冷却"而不是"一次失败永久禁用"**：一旦永久禁用，后续请求就再也不会发 `stream: true`，于是永远没有机会调用 `markStreamSupported` —— "自愈"根本不可达，黑名单会退化成整个会话关掉该型号的流式，用户观感是"内容不再逐段生长，而是整段生成完一次性出现"（"分析早就有历史记录了，summary 却迟迟不显示"），且进程内缓存、刷新即恢复，极难复现。
  > **降级必须可观测**：非流式降级是静默的行为变化，`callModelStream` 在走非流式分支、以及记录/保留黑名单时都会打 `console.warn`，便于定位"为什么没有流式"。
  > **只有协议层证据才记黑名单**：收到过思维链（`receivedReasoning`）说明服务端确实在流式，此时即使本轮正文为空也不能记黑名单。
- Key 验证（Ping）改为验证**当前真正会被用到的模型**（手填了自定义 ID 就用它），并识别 `model not found` / 无权限，提示换型号而非笼统报网络错误。
- `ModelSelector` 展示档位徽章（旗舰/均衡/轻量）与能力标签（流式 / JSON强约束 / 推理型 / 视觉 / 输出上限），并给出选型建议。

### 5.3.1 配图策略（v1.6 定稿）

> **演进**：v1.3 首选"模型现画 SVG"（等于要求模型具备画图能力，多数做不到）；v1.4 增加 Wikimedia Commons 免 Key 自动兜底；v1.5 发现 Commons 几乎全是英文条目、中文概念名查不到，遂让模型填英文检索词；**v1.6 撤销"只认 Commons"与"中英词表"两个做法**（后者被用户判定为坏做法，`utils/imageQuery.ts` 已删除）。

**三通道（v1.6.1 起：原图优先，手绘兜底）**：

1. **`image`（可信图源直链，严格白名单）** —— 只有 `TRUSTED_IMAGE_HOSTS` 内的域名被接受（`upload.wikimedia.org` / `commons.wikimedia.org` / `cdn.kastatic.org`（可汗学院）/ `images.unsplash.com` / `raw.githubusercontent.com` / `lh*.googleusercontent.com` / `cdn.jsdelivr.net` / `ocw.mit.edu` / `math.mit.edu` …）；非白名单仅放行"无 query 且路径为图片扩展名"的裸直链；带 `?source=` / `?token=` / `?from=` 等防盗链参数一律丢弃。**提示词端把该域名清单显式写出**（此前只说"权威来源"，模型给的链大量被静默落空）。**v1.6.2 起改为"积极引用"引导**：说明公开图库直链是"图文并茂"最可靠的方式、优先于手绘 SVG，引导模型对理科概念按 Wikimedia Commons 规范文件名拼 `upload.wikimedia.org` 直链——但仍只填**能确定对应正确示意图**的链，拿不准就空字符串（走图库检索/SVG 兜底，不给 404 链接）。
2. **`imageData`（图片数据直填）** —— 多模态模型把图片以 base64 data URL 直接写入；`isDataImageURL` 只放行 `png/jpeg/gif/webp` 且限制体积（< 4MB），伪造 base64 一律丢弃。`Concept` 与 `ExamQuestion` 均提供此通道。**纯文本模型（无视觉能力）严禁填入**——提示词明确要求"绝对不要编造 base64"，也不得凭"印象里见过这道题"瞎填。
3. **`svg`（模型手绘内联）** —— 内联渲染必定可见，属性用单引号、带 `viewBox`、只用基础元素、禁止脚本/外链/事件属性；**按学科画法步骤绘制**（见下）。

**试题配图（原图优先 + 含"如图"约束）**：`ExamQuestion` 渲染优先级 = `image` / `imageData`（原图，加载失败自动隐藏并回退）> `svg`。提示词明确告诉模型："试题原文中**一大片无法作为字符识别、且承载图形语义的区域就是一张图**"，应作为图片数据（`imageData`）直接填入，而不是用文字描述或硬画 —— **原图远比分模型手绘可靠**。**v1.6.2 新增【含"如图"的试题约束】**：题干出现"如图"/"如图所示"但既无原图（`imageData`）、无可信直链（`image`）、又不能精确手绘 SVG 时——**不要出这道题**（凭文字描述想象图形作答无法保证正确性），或改写为"纯文字即可作答"的等价题型。

**SVG 画法教学（prompt，v1.6.2 起由负面约束改为正向教学）**：旧规则只写"必须严格遵循该学科制图惯例 / 画不准就空字符串"这类**负面限制**，模型无从下手；现改为按学科给出**可执行的绘图步骤**（先画什么、坐标怎么定、符号怎么摆）：

- **通用骨架**：先想清要表达的核心关系 → `viewBox='0 0 320 200'`、图形居中、四周留 10~20 边距 → 先画主线条（骨架）再补标记 → 只画题干/解析里明确存在的元素，不脑补
- **数学·几何**：先定三个顶点坐标，再按"对边"原则命名（角 A 对边 a=BC、角 B 对边 b=CA、角 C 对边 c=AB）；直角画小正方形（非弧）、等长边打横线、角内画弧标角名、直径过圆心、平行线画同向箭头
- **数学·函数图象**：先坐标轴（带箭头、标 x/y、原点 O）→ 标刻度 → 后画曲线（一次直线 / 二次抛物线 / 反比例双曲线 / 三角波）→ 关键点用小圆点标坐标
- **物理·电路**：电池（长竖线+短竖线）、电阻（锯齿折线）、电容（两平行竖线）、开关（斜线搭断点）、灯泡（圆圈画 X）、电流表/电压表（圆圈标 A/V）；导线横平竖直、先定串并联拓扑
- **物理·受力分析**：力从**作用点**出发、箭旁标符号；重力竖直向下、支持力垂直接触面、摩擦沿接触面；斜面上重力分解用虚线
- **物理·光学**：先画镜面/透镜 → 再画法线（过入射点、垂直镜面、虚线）→ 光线带箭头，**角度相对法线**标注
- **化学 / 统计图**：结构式符合价键与键角、装置图体现连接顺序；统计图轴名/刻度/单位齐备

硬性要求：只用基础元素（line / polyline / polygon / path / circle / rect / ellipse / text / g）、属性一律单引号、线宽 1~2、画布紧凑（内容占 80% 以上）。

**自动兜底**：概念既无 `image` / `imageData` 也无 `svg` 时，前端按 `Concept.imageQuery` 检索一张标准示意图。

- `services/commonsImage.ts` → `findKnowledgeImage(rawQuery)`：查询串**主要是中文**走 `zh.wikipedia.org` API，**主要是英文**走 Wikimedia Commons，任一源无结果**自动 fallback 另一源**；返回 `source` 用于署名（中文维基百科 / Wikimedia Commons）。免 API Key（`origin=*` 匿名跨域）。
- `hooks/useCommonsImage.ts`（导出 `useKnowledgeImage`）：仅需要时才发请求，组件卸载自动 abort；进程内缓存、8s 超时、失败静默返回 null，绝不阻塞渲染。
- `Concept.imageQuery` 语义 = "用哪种语言、什么词，由模型自己判断"（1~3 个最能命中标准示意图的检索关键词）。

**安全**：`utils/inlineSvg.ts` 的 `sanitizeInlineSvg` 做严格白名单过滤（script / foreignObject / image / use / 事件属性 / `javascript:` / `@import` / `url(http...)` 全部丢弃，且限制体积），未通过清洗的 SVG 一律不渲染。所有 `<img>` 均有 `onError` 静默隐藏，不出现裂图。

### 5.3.2 试题题型归一化（v1.3）

真实模型返回的题型、选项形态极不稳定，`sanitizeExamQuestions` 做以下兜底：

- **题型别名映射**：中文（选择题/单选/多选/填空题/计算题/证明题/解答题…）与英文变体
  （single_choice / blank / short-answer…）都能映射到 `choice|fill|calculation|essay`，
  不再一律降级成 `essay`（旧行为会让选择题丢选项、填空题没空位）。
- **题型反推**：缺失或不可信时按内容判断 —— 有 ≥2 选项 → choice；有空位（`____`）→ fill；
  有"求/计算"且带数字 → calculation；否则 essay。标了 choice 却拿不出选项会按内容重判。
- **选项归一化**：支持数组 / 对象 `{A:..}` / 嵌套 `{options:[..]}` / 整串 `"A.甲 B.乙"`；
  写在题干里的选项会被切出并还原干净题干；自动剥掉 `A.` 前缀（UI 单独渲染字母徽章）。
- **答案归一化**：选择题答案尽量收敛成字母（"选B"/"答案：A"/长文本匹配选项 → `B`），
  便于 UI 高亮正确项；数组答案（填空多空/多选）拼接为 `；` 分隔字符串。
- UI：选择题可点选即时判对错、查看答案后高亮正确项；填空题空位渲染成卷面填空线。

### 5.3.3 核心概念增强与知识脉络重构（v1.4）

**核心概念**（`Concept`）在原有双层解释 + notation + 配图 + 示例之外，新增两个字段：

- `keyPoints?: string[]` —— 关键要点 3~4 条，写"用的时候要注意什么"，
  不与初等/高等解释重复，让读者扫一眼就能抓住重点
- `pitfalls?: string[]` —— 易错提醒 1~2 条，写最常见的误区（适用条件、方向性、单位换算等）

`sanitizeConcepts` 兼容别名：`points` / `key_points` → `keyPoints`，
`misconceptions` / `commonMistakes` → `pitfalls`；空数组不落字段。

**知识脉络**（`KnowledgeContext`）新增 `confusables?: {topic, difference}[]`（易混辨析），
并把渲染结构重排为更符合认知顺序的四段：

1. **学习路径**（置顶，带序号 + 连接线的纵向流程）—— 路径有先后顺序，
   不再和前置知识、关联主题并列成三个散落的标签云
2. **前置知识 / 关联主题**（并列两栏标签）—— 平级关系，适合标签展示
3. **易混辨析**（新增）—— 划清与相近概念的边界
4. **常用结论**（编号列表）

`sanitizeKnowledgeContext` 的 confusables 同时接受对象数组与 `"概念：区别"` 形式的字符串，
缺字段或解析不出的条目直接丢弃。

### 5.4 JSON 解析多层修复

独立模块 `utils/jsonRepair.ts`，`parseJSONResponse` 4 层修复策略：
1. `cleanJSONText`：字符级清洗（中文引号→英文、全角空格→半角、零宽字符/BOM 移除、`\u2028`/`\u2029` 处理、字符串内非法转义修复）
2. 移除尾随逗号（`,}` `,]` → `}` `]`）
3. `repairTruncatedJSON`：迭代式智能补全（最多10次，每次先补括号尝试解析，失败则从后往前找逗号截断）
4. 详细诊断日志（包含具体错误消息、首尾 600/300 字符）

> ⚠️ **它只该用在"内容已完整到手、只是格式脏"的场景**。生成类入口一律先经续写链路（10.3）保证内容完整，
> 再用它兜底；而"写没写完"的判定**必须**用不做修复的 `hasCompleteJSONObject` —— 否则被截断的 JSON 会被
> `repairTruncatedJSON` 补成合法 JSON，续写链路被静默跳过，用户拿到一份"看起来正常但缺尾巴"的结果。

### 5.5 AI Prompt 三层优先级

所有生成 prompt 按 **来源（source）→ 内容（content）→ 格式（format）** 三层组织，搜索/问答/查词/翻译/文档各模式 prompt 完全分离，避免相互干扰。
> 全厂商（预设 + 自定义）共用同一套 prompt（个别厂商可经 overlay 注入 system 前缀）；每种请求在组装时追加 `buildLanguageDirective()` 注入"输出语言为 X，但 JSON 字段名/枚举值保持英文"。
> **不同厂商独立 Prompt 按后续业务需求再分。**

### 5.6 多模型存储结构（v2 — 无限扩展版）

**存储 Key**：`ai-office-assistant-ai-config`（version 2，`safeParse` 只认 v2）
```ts
interface AIConfigRoot {
  version: 2;
  activeProviderId: string;              // 预设 ∪ customProviders 的 key
  activeModelId: string;
  providers: Record<string, ProviderConfig>;
  customProviders: Record<string, ProviderInfo>;  // 用户添加的自定义厂商元数据
}
interface ProviderConfig {
  apiKey: string;
  status: 'unconfigured' | 'configuring' | 'valid' | 'invalid';
  error: string;
  customBaseUrl?: string;      // 覆盖 PROVIDER_META/defaultBaseUrl
  customModel?: string;        // 覆盖 activeModelId（自由指定模型 ID）
  lastValidatedAt?: number;
}
```

**读取时自动修复**（`safeParse`）：缺失的预设厂商补默认 config；`customProviders` 缺失补 `{}`；`activeProviderId` 不在合法集合则回退 `zhipu`；`activeModelId` 不在型号列表且无 customModel 则回退推荐型号。开发期不做版本迁移，v1 数据不识别时直接回退默认结构。

### 5.7 配置 React Hook

`hooks/useAIConfig.ts`（新入口）返回：
- **状态共享**：通过 `useSyncExternalStore(subscribeAIConfig, getAIConfigSnapshot)` 订阅全局 store，所有调用 `useAIConfig()` 的组件（Header / ModelSelector / ProviderKeyInput）共享同一份状态，任一组件更新自动同步全部
- **读取**：`root` / `providers` / `activeProviderId` / `activeModelId` / `anyConfigured` / `activeProviderValid` / `validatingMap`
- **动作**：`setActiveProvider(id)` / `setActiveModel(id)` / `patchProviderConfig(id, patch)` / `validateAndSaveProviderKey(id, key, baseUrl?, model?)` / `resetProvider(id)`
- **副作用**：模块加载时执行一次"无则初始化"；监听 `storage` 事件跨 Tab 同步
- **Ping 验证**：5 秒超时 + `AbortController`，归一化区分 `401 密钥无效 / quota 余额不足 / 429 限流（判 valid） / 网络错误（保留原状态不降级）`

v2 架构下旧的 `hooks/useApiKey.ts`、`services/glmAIService.ts` 及 3 个厂商子类已全部删除，统一为 `GenericAIProvider` + `useAIConfig`。

---

## 6. 配置管理

### 6.1 AI 密钥 / 多厂商配置

- **配置方式**：通过 Header 顶栏中的"厂商·型号"按钮打开配置面板，固定 3 个 Tab（模型选择 `ModelSelector` / 密钥管理（每厂商独立 `ProviderKeyInput`）/ 添加厂商 `AddProviderForm`）
- **存储**：LocalStorage `ai-office-assistant-ai-config`（v2 版本结构），UI 每次 Key 验证成功后立即写入
- **触发条件**：当前 activeProvider 状态非 valid → 对应模块自动走 Mock 数据；某厂商 Key 失效不影响其他已配厂商
- **高级项**：每个厂商支持自定义 Base URL（本地代理/中转）与自定义模型 ID；各厂商 Key 彼此独立保存
- **自定义厂商**："添加厂商"表单填写名称/Base URL/型号后写入 `customProviders`，运行时即时可用，无需改代码
- **文档**：`docs/demo_release_content.md` 详细说明 Mock 触发机制和支持的关键词
- **跨 Tab 同步**：监听 `storage` 事件，任意 Tab 切换厂商/模型/密钥，其他 Tab 1 秒内状态刷新

### 6.2 组件配置

配置文件位置：`config/components.json`

管理技能：`component-config-manager`（用户级 Skill，位于 `~/.workbuddy/skills/component-config-manager/`）

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| theme.primaryColor | string | #0d9488 | 主色调 |
| theme.secondaryColor | string | #f59e0b | 辅色 |
| search.defaultTags | string[] | [...] | 默认智能标签 |
| search.maxResults | number | 10 | 最大搜索结果数 |
| translate.defaultDirection | string | auto | 默认翻译方向 |
| document.defaultType | string | email | 默认文档类型 |

---

## 7. 设计决策记录

| 决策 | 原因 | 替代方案 |
|------|------|---------|
| Vite + React + TypeScript | 模块化、类型安全、开发体验好 | 单文件HTML+JS |
| Tailwind CSS | 快速原型开发，组件级样式 | 自定义CSS / CSS-in-JS |
| KaTeX | 轻量级数学公式渲染，速度快 | MathJax |
| react-markdown + remark-gfm | 文档生成结果富文本渲染 | 纯文本展示 |
| jspdf | PDF 导出（支持中文和分页） | - |
| 组件化架构 | 复用性强，便于维护 | 单文件实现 |
| 模块化目录结构 | 职责清晰，便于扩展 | 扁平目录 |
| HistoryContext + Context 模式 | 跨实例状态同步 | useState + key prop 强制重挂载 |
| useSyncExternalStore | 外部存储（LocalStorage）订阅 | useEffect 手动同步 |
| URL hash 路由 | 简单轻量，无需额外依赖 | React Router |
| AI 密钥通过 UI 配置 | 避免硬编码，部署友好 | 环境变量 |
| 知识目录使用 div 层级树 | 占位实现，避免 SVG 复杂度 | SVG 知识图谱（暂不考虑） |
| 词典模式手动切换 | 自动检测反直觉 | 输入内容自动检测切换 |
| 11 种文档类型（含 general） | 覆盖通用场景 | 5 种核心类型 |
| 内容生成改真流式（生产者-消费者） | `setTimeout` 分块弹出只是伪装，真流式体验需增量 JSON 解析 | 保持一次性 `generate` |
| 超限自动续写（≤3 次） | 长内容必然撞输出上限，截断比多花一次调用更糟 | 仅提示截断、不续写 |
| 清洗按 80ms 时间片产出 | 每个 SSE 分片全量清洗会打满主线程，渲染掉帧后用户感知为"没流式" | 每分片都清洗 |
| 识别思维链 + 首字等待计时 | 思考型模型先吐思维链，只取 content 会导致思考期零反馈 | 忽略 reasoning，界面静止 |
| 仅白名单厂商发 enable_thinking | 关闭思考可显著降低首字延迟；无条件发送会被严格网关 400 | 无条件发送厂商专有字段 |
| i18n 英文作类型基准 | 中文漏 key 立即 tsc 报错，杜绝静默漏翻译 | 中文为基准 / `Partial` 放宽 |
| 数据层文本不迁 i18n | 厂商名/模板正文属数据，迁移成本高、收益低 | 全量迁 i18n |
| 配图撤销"中英词表" | 词表是坏做法，交由模型判断语言与检索词（`imageQuery`） | 维护中英对照词表 |

---

## 8. 技术栈

| 类别 | 技术 | 版本 |
|------|------|------|
| 构建工具 | Vite | 5.x |
| UI框架 | React | 18.x |
| 类型系统 | TypeScript | 5.x |
| 样式方案 | Tailwind CSS | 3.x |
| 数学公式 | KaTeX | 0.16.x |
| Markdown 渲染 | react-markdown + remark-gfm | - |
| PDF 导出 | jspdf | - |
| AI 服务 | OpenAI 兼容协议（多厂商预设 + 用户自定义厂商） | - |
| 流式协议 | SSE（`stream:true`）+ 增量 JSON 解析 | - |

---

## 9. 多语言（i18n）与用户语言

### 9.1 字符串层结构

```
src/i18n/
├── languages.ts            # 语言目录（code/native/zhName/english/speech）+ normalizeLanguage
└── strings/
    ├── common.ts           # app.* / tabs.* / aiPanel.* / 通用词
    ├── settings.ts         # 模型/密钥/添加厂商/厂商模板
    ├── search.ts           # 搜索模块
    ├── translate.ts        # 词典翻译模块
    ├── misc.ts             # doc.* / favorites.* / history.* / speech.* / exportNote.*
    ├── aiProviderTexts.ts  # localizedProviderName / localizedModelDescription
    ├── docTemplates.ts     # getDocBodies(language)
    └── index.ts            # STRINGS_EN / STRINGS_ZH + getCurrentStrings + fmt
```

### 9.2 核心原则

| 原则 | 说明 |
|------|------|
| **英文作类型基准** | 每区先写 `xxxEn`，`export type XxxStrings = typeof xxxEn`；中文写 `xxxZh: XxxStrings`。中文漏 key → `tsc` 立即报错（有意设计） |
| **运行时兜底** | `STRINGS_ZH = deepMerge(STRINGS_EN, {...Zh})`，缺 key 回退英文，不出现 `undefined` 文案、不崩 |
| **双入口取值** | React 用 `useStrings()`；service/状态机/utils 用 `getCurrentStrings()`；占位符 `{n}` 由 `fmt()` 填充 |
| **语言 ≠ UI 语言** | store 存标准 `LanguageCode`（`zh`/`en`/`fr`…）；仅 `zh` 用中文表，其余一律英文表 |
| **数据层不迁 i18n** | 厂商名/模型描述/文档模板正文保留在数据层，英文覆盖走 `aiProviderTexts.ts` / `docTemplates.ts` |

### 9.3 语言基础设施

| 组件 | 职责 |
|------|------|
| `i18n/languages.ts` | 全应用唯一语言目录；`normalizeLanguage` 兼容旧 `zh-CN`、中文名、BCP-47 带地区 |
| `hooks/useLanguageStore.ts` | 纯存储层（subscribe/emit），存标准 `LanguageCode`，默认取 `navigator.language` |
| `hooks/useLanguage.ts` | `useSyncExternalStore`，返回 `{ language, uiLanguage, setLanguage, setLanguageZh/En }` |
| `hooks/useStrings.ts` | React 侧取字符串表，随语言切换重新渲染 |

### 9.4 AI 输出绑定用户语言

`baseAIProvider.buildLanguageDirective()` 每次组装 prompt 时实时读取 `getAIContentLanguage()`，注入"输出语言为 X，但 JSON 字段名/枚举值保持英文"；已接入 search 生成/追问、document 三处 system prompt。追问 QA 中原先写死的语言规则已删除。

---

## 10. 流式渲染与自动续写

### 10.1 生产者-消费者模型

```
AI 侧（生产者）                       渲染侧（消费者）
SSE chunk ─► sseReader ─► StreamingJSONParser.push(chunk)
                                  │  维护：容器栈 / 字符串状态 / 安全切割点 / 已完成顶层键
                                  ▼
                            共享缓冲区（raw + 部分对象）
                                  │
                        渲染侧随时 read() 取快照 ─► mergeSnapshot ─► setState（60ms 节流）
```

| 组件 | 文件 | 职责 |
|------|------|------|
| **SSE 读取** | `services/streaming/sseReader.ts` | 处理跨 chunk 半行、`[DONE]`、流内 error；逐层透出 `truncated`（`finish_reason=length`） |
| **增量 JSON 解析** | `services/streaming/partialJSON.ts` | 单趟扫描，任意截断位置都能补出可渲染的部分对象（正在写的字符串按已达字符呈现 → 打字机效果） |
| **快照合并** | `mergeSnapshot` | 仅在新值非空时覆盖旧值，防增量解析回退导致已渲染内容闪回 |

### 10.2 流式调用与链路状态处理

`BaseAIProvider.prepareRequest`（流式/非流式共用）抽公共请求骨架。流式策略**不猜测、不打补丁、拿到什么链路状态就诚实处理什么**：

| 链路状态 | 处理 |
|---------|------|
| 型号静态能力声明不支持流式（`caps.streaming=false`） | 直接走 `callModel` 一次性返回（配置层结论，非运行时猜测） |
| 传输层失败 / SSE 协议解析失败 / 首字节超时 | **抛错透传**（由续写循环按中断分类决定是否再发一轮，见 10.3 / 10.7） |
| 收到增量 | 立即 `onDelta` 实时渲染（"有多少内容显示多少内容"） |

> **v1.6.2 变更**：原"流式失败记黑名单→冷却期自愈"这套隐式全局状态已移除。`withFallback` 对链路错误以 `success:false + code` 透传给 UI，只有业务错误才兜底为 fallback。提示词抽为 `buildGeneratePrompt` / `buildFollowupPrompt` / `buildDocPrompt` 共用，`sanitizeGenerateResult` 作为统一清洗出口。状态机 `runGenerate` 使用 `AbortController` 可中断 + 60ms 节流；最终态以服务端完整结果再合并一次，避免节流跳过的尾部丢失。
>
> **v1.7.0 变更**：`fetchOrThrow()` 把裸 `TypeError: Failed to fetch` 归类为 `StreamNetworkError`（不再伪装成业务错误被兜底吞掉）；`finishReason` 逐层透出（`sseReader` → `callModelStream` → 续写循环），据此区分「模型输出上限」「安全策略拦截」「网关静默截断」。详见 10.7。

### 10.3 自动续写（v1.7.0 起：全链路中断，而非仅超限）

| 机制 | 说明 |
|------|------|
| `hasCompleteJSONObject(raw)` | **严格**判定首个顶层 JSON 对象是否闭合，**不做修复**（若用带 repair 的 `parseJSONResponse`，截断会被补成合法而静默跳过续写）。实现上复用 `partialJSON.isCompleteJSON`（权威判定，正确追踪 `{}`/`[]` 嵌套 + 字符串转义 + markdown 围栏），不再另写括号配对逻辑 |
| `buildGenerateCompleteChecker()` | search 续写判定的升级版：**括号闭合 + 核心字段齐全**（`mindMap`/`concepts`/`knowledgeContext`/`examQuestions`/`interestingFacts`）。防止模型输出"括号闭合但缺末尾区块"的 JSON 就收尾、跳过续写导致内容悄悄不完整；可选项（summary/conceptsOverview/examples/relatedResults）不计入，避免空转 |
| `buildJSONKeysCompleteChecker(keys)` | 同口径的通用版：必填字段由调用方给 —— 查词 `['word','definitions']`、翻译 `['original','translation']`。同样复用解析层 `analyzeJSON`，不另写括号配对 |
| `generateJSONWithContinuation<T>(…)` | **不需要增量回调的生成入口**（查词 / 翻译）。复用同一个续写循环，返回 `{ data, truncated, continued, attempts, interruption }`；`data === null` 才是"一个字都没解析出来"，由调用方抛 `GenerationInterruptedError` |
| `callModelStreamWithContinuation(...)` | **中断分类驱动**：每轮结束后用 `isComplete` 判完整；未完整且 `canContinueAfter(kind, …)` 为真则再发一轮。**有内容 → 回填续写**（尾部最多 12k）；**一个字都没有 → 按原 prompt 重发 1 次**（瞬时抖动自愈）。总请求数硬上限 `MAX_GENERATION_ATTEMPTS=3`（首轮 + 至多 2 次续写/重发），绝不无限重试 |
| 不续写的情形 | `content_filter`（同样的内容会被同样拦下）、`aborted`（用户取消）、`parse`（内容根本不是 JSON，回填无意义）、`http`（鉴权/额度类必然失败；仅"已有内容 + 厂商标记可重试"才重试） |
| 返回值 | `{ content, truncated, attempts, continued, interruption }`——`interruption` 仅在发生过中断时存在，`resolved=true` 表示最终被续写补全 |
| 接入点 | `search.generateStream`（字段齐全判定）/ `followupStream` / `document.generateStream`（括号闭合判定）/ **`translate.queryWord` · `translate.queryTranslate`（`generateJSONWithContinuation`，按各自必填字段判定）** |
| 用户反馈 | `interruption` 落库到 `SearchGenerateResponse` / `DocResult` / `DictionaryQueryResponse` / `TranslateQueryResponse` → UI 用 `GenerationNotice` 按原因分档展示（见 10.7） |

> **注意**：续写提示词的措辞是**中性**的（"你上一条回复在输出中途被中断"），不再写死"因为达到输出长度上限"——中断原因可能是链路断开，给模型错误的上下文会诱导它改变续写策略。

### 10.4 空结果判定

流式快照是"空对象也 truthy"的形态，不能直接 `if (latest)` 判断有无内容。状态机使用 `hasUsableContent(d)` 判定，**覆盖全部实质字段**（summary / conceptsOverview / mindMap / concepts / examples / relatedResults / knowledgeContext 各子字段 / examQuestions / interestingFacts），任一非空即视为有内容，全空才回到 `IDLE`。此前只认 summary/mindMap/concepts 三者，模型若只产出 knowledgeContext/examQuestions 等（前三者恰好为空）会被误判"无内容"→ 页面空白。

失败且无内容时：`runGenerate` 显式写 `error=generateFailed` 并回 `IDLE`；`SearchContainer` 在 `state===IDLE && error && !generatedData` 时渲染带图标的失败空状态卡片（`errors.generateFailedEmpty`），而不是只留一条红字 + 大块空白。

### 10.5 首字延迟治理（v1.6.1）

实测发现"界面很久才出内容、像是生成完才显示"与厂商/型号无关，根因是**首字到达前的零反馈**，而非解析器或传输层。三层治理：

| 层 | 问题 | 处理 |
|----|------|------|
| **清洗节流** | 原实现对每个 SSE 分片都全量跑 `sanitizeGenerateResult`（含 SVG 清洗等重活），内容越大主线程越卡 → 渲染掉帧 | `generateStream` 内按 80ms 时间片产出快照；尾部由 `parser.finish()` 以 complete 快照强制补发，不丢内容。状态机 60ms setState 节流保留（两层职责不同） |
| **思维链识别** | 思考型模型先输出大段 `reasoning_content`，原读取器只取 `delta.content` → 思考期界面完全静止 | `sseReader` 识别 `reasoning_content`/`reasoning`，经 `onReasoning` 透传；新增 `receivedReasoning`，避免思考期被误判为"服务端不流式"而降级 |
| **等待可见** | 用户无法区分"在思考"和"卡死" | 状态机新增 `thinking` / `generateStartedAt`；首字未到时 UI 显示"模型正在思考…已等待 N 秒" |

**关闭思考模式**：思考型模型（qwen3.x、GLM-5.x 等）默认开启思维链，首屏要等几十秒，且思维链会**吃掉 max_tokens 预算导致正文 JSON 被截断**（"生成失败"的隐蔽来源）。`prepareRequest` 按厂商分派关闭参数（`DISABLE_THINKING_PARAMS`）：dashscope/siliconflow 发 `enable_thinking: false`，**zhipu 发 `thinking: { type: 'disabled' }`**（⚠️ 智谱传 `thinking: false` 会 400，正确值是对象 `{type:'disabled'}`）。用厂商白名单而非无条件发送——避免严格网关因未知字段直接 400。

### 10.6 公式统一渲染与图示（v1.6.1）

**公式统一处理（双保险）**：用户实测发现"公式报红"反复出现，根因有两层，故双向加固。

| 层 | 做法 |
|----|------|
| **提示词（源头）** | `buildGeneratePrompt` 置顶【公式书写规则】：凡数学符号（变量 / 公式 / 运算 / 几何符号 / 角度 / 根号 / 向量 / 上下标 / 单位）**一律用 `$...$`** 包裹，正文、列表、题干、选项、答案、解析全部适用；并给出正反例（`$\triangle ABC$` vs `\triangle ABC`）。只用行内公式，不用 `$$` / `\[ \]` |
| **渲染（兜底）** | `utils/latex.ts` 新增 `splitBareLatex()`：识别**无围符的裸 LaTeX**（强信号 = 反斜杠命令 `\\[a-zA-Z]{2,}` 或带花括号的上下标 `[\^_]\s*\{`），再向左/右扩展到数学字符边界（遇 CJK 汉字、中文标点、`$`、换行即止）。`LatexText` 先切 `$...$` / `\(...\)`，普通文本段再用它切裸公式 |

**为什么只认强信号 + 必须解析成功**：`x^2` / `learning_rate` 这类无花括号写法**不**当信号，避免把 `snake_case` 变量名误渲染成下标；且片段**必须 KaTeX 解析成功才渲染**，否则原样输出 —— 既绝不吞内容，也让 `C:\Users` 这类误命中自动落回普通文本。

**覆盖（统一入口）**：所有 AI 文本字段都走 `LatexText`，不得"有的字段渲染、有的裸露"：summary、conceptsOverview、概念两档解释、notation、example、**keyPoints**、**pitfalls**、**mindMap 节点标题 / 描述**、prerequisites / relatedTopics、learningPath、confusables、commonConclusions、**试题题干 / 选项 / 答案 / 解析**、interestingFacts（含标题）。思维导图的隐藏测量盒与实际渲染盒使用同一组件，保证高度测量与渲染一致。

| 其他能力 | 说明 |
|------|------|
| `renderLatexSafe` | KaTeX `throwOnError:true` 试解析，失败返回 `ok:false` 由调用方兜底（独立公式 `notation` 失败降级为等宽代码块） |
| SVG 等比缩放 | 容器 `maxHeight` 经 CSS 变量 `--svg-figure-max-h` 传给内部 svg，配 `max-height` + `width/height:auto` → 整体缩放进容器，不再被 `overflow:hidden` 裁掉顶部元件 |
| 线宽钳制 | `inlineSvg.ts` 的 `clampStrokeWidth`：stroke-width（属性 / 内联 style）超 2 压到 2，未超限原样保留（不无谓改写引号）。prompt 端同步要求"画布紧凑、内容占 80%、线宽 1~2" |

### 10.7 生成中断分类与错误处理分层（v1.7.0）

**动机**：v1.6.2 之前，"内容没写完"只有 `truncated: boolean` 一个位。它回答不了"**为什么**没写完"，于是 UI 把网络中断也说成"模型输出上限被截断"；更糟的是未分类异常会被兜底吞成 `success:true + 空结构体`，让**已流出的内容与真实原因一起被丢掉**（用户看到的就是"内容未完全生成就自动截止，且无任何提示"）。

**分类模型**：`src/services/streaming/interruption.ts`（类型定义在 `types/ai.ts`，服务层 / 状态机 / UI 共用同一套语义）

| side（归因方） | kind | 来源 | 标准 code | 可自动再试 |
|---|---|---|---|---|
| model | `length` | `finish_reason='length'` | `OUTPUT_TRUNCATED` | ✅ |
| model | `content_filter` | `finish_reason='content_filter'/'safety'` | `CONTENT_FILTERED` | ❌（同样内容会被同样拦下） |
| link | `timeout` | 首字节 60s 无任何字节 | `STREAM_TIMEOUT` | ✅ |
| link | `network` | fetch 抛错 / body 读取中断 | `STREAM_NETWORK` | ✅ |
| link | `protocol` | SSE 协议失败 / 流内 error | `STREAM_PROTOCOL` | ✅ |
| link | `http` | HTTP 非 2xx（鉴权/额度/限流/5xx） | 厂商 code | 仅"已有内容 + 可重试" |
| content | `incomplete` | 流正常结束但 JSON 未闭合（无结束标记） | `STREAM_INCOMPLETE` | ✅ |
| content | `parse` | 内容到了但解析不出 JSON | `GENERATE_FAILED` | ❌ |
| user | `aborted` | 用户取消 / 重置 | `STREAM_ABORTED` | ❌ |

- `classifyThrown(error)`：异常 → 归因，**绝不返回 null**（认不出的按 `parse` 兜底）——保证 UI 永远有原因可展示。
- `canContinueAfter(kind, ctx)`：续写策略的**唯一**出口，避免判断散落各处。
- `interruptionFromCode(code)`：只有 code 的一侧（如状态机读 `AIResponse.error.code`）也能还原归因。
- `GenerationInterruptedError`：携带归因 + 已生成内容，供 `withFallback` / 状态机直接读取，不必字符串匹配猜原因。

**错误处理分层**：`withFallback(op, fallback, prefix, { strict })`

| 模式 | 用于 | 行为 |
|---|---|---|
| 宽松（默认） | 输入校验 / 意图识别 / 翻译查询等业务调用 | 认不出的异常 → 返回 fallback（善意降级，如 Mock 数据） |
| strict | **内容生成类**（`search.generate` / `generateStream` / `followupStream`、`document.generate` / `generateStream`） | 异常一律 `success:false + code`，**绝不**返回"成功但空" |

无论哪种模式：`NO_API_KEY` 与"生成中断"（见上表 code）**始终透传**，不被兜底吞掉。

**UI 分档提示**：`components/ui/GenerationNotice.tsx`（搜索 + 文档共用，兼容旧历史数据只有布尔的场景）

| 条件 | 展示 |
|---|---|
| `interruption.resolved === true` | teal「内容较长，已自动续写并补全，可放心使用」 |
| `side='link'`（network / timeout / protocol） | rose + 对应标题正文 |
| `side='model' / 'content'`（length / content_filter / incomplete） | amber + 对应标题正文 |
| `attempts > 1` 且未补全 | 追加「已自动续写 {n} 次仍未补全」 |
| 只有 `truncated` 布尔（旧数据） | 兼容旧文案 |

**状态机侧**：`toFriendlyError(code, raw)` 覆盖全部中断 code（含 401 / 额度 / 限流 / 5xx 的本地化文案）；失败但已有内容时**保留内容并挂上归因**（横幅说明原因，而非只弹一行错误）；`catch` 分支统一走 `classifyThrown`。

**词典翻译侧**：`modules/translate/errorText.ts::friendlyTranslateError(code, raw)` 是**同一套 code → 语义**映射的另一份文案。
为什么不复用 `toFriendlyError`：那套假设"已收到内容已在屏幕上"（搜索是流式边出边渲染），
查词/翻译没有部分渲染，措辞必须不同（"结果可能不完整" vs "生成已中断"），硬套会给出与屏幕不符的提示。
技术描述（`Failed to parse JSON response (length=…, preview: …)`）**只在 `interruption.detail` 与控制台**，不参与 UI 文案。

### 10.8 内容渲染一致性：同一份数据只有一套渲染实现

**动机（真实缺陷）**：同一份 `GeneratedKnowledge`，在搜索页和收藏页渲染成两种东西 ——
搜索页有公式、有思维导图、有配图；收藏页只有裸文本（`$...$` 源码）、思维导图退化成"前 8 个标题的标签云"、配图与 knowledgeContext 直接消失。

根因不是"漏了一处渲染"，而是**搜索侧把渲染私有在 `SearchResults.tsx` 内部**，收藏侧只能手写第二套 → 每新增一个字段，收藏侧必然落后（双实现漂移）。逐字段打补丁治不了，必须收敛成唯一实现。

**结构**：`components/knowledge/KnowledgeContentView.tsx`（唯一实现）

| 导出 | 职责 |
|---|---|
| `KnowledgeContentView` | 知识内容视图（唯一实现）：**标题头（标题 + 概览 `summary`）** → 中断提示 → 思维导图 → 核心概念（总述 + 概念卡 + 示例卡）→ 知识脉络 → 试题 → 趣味知识。外壳只留复制/导出/收藏操作栏与 loading；页面级操作（收藏详情的"返回列表"）通过 `headerActions` 插槽传入 |
| `MindMap` | 思维导图（布局测量 + 拖拽 + 描述盒防溢出），`data-testid="knowledge-mindmap"` 供回归测试锚定 |
| `ExamQuestionCard` | 试题卡（选择题可点选判对错、填空题渲染卷面填空线、配图原图优先回退 SVG） |
| `ConceptIllustration` | 概念配图四通道：image → imageData → 关键词检索 → svg |
| `normalizeGenerated` | 渲染前统一归一化（对**每个字段**做保底，缺数组给 `[]`，绝不 `undefined`） |
| `isGeneratedKnowledge` | 新格式 / 旧格式 `KnowledgeCardData` 的判定入口 |
| `conceptTypeLabel` / `examTypeLabel` | 标签文案（卡片徽章与 markdown 导出共用，避免两套文案） |

**入口与渲染契约**

| 入口 | 渲染方式 |
|---|---|
| 搜索页 `modules/search/SearchResults.tsx` | 外壳（收藏·复制·导出操作栏 / loading）+ `<KnowledgeContentView data={generatedData} />` |
| 收藏详情 `modules/favorites/index.tsx`（知识） | `<KnowledgeContentView data={item.data} fallbackTitle={label} headerActions={<BackButton/>} />` |
| 收藏详情（文档） | `<MarkdownContent content={...} />`（与文档模块同一个渲染器） |
| 收藏详情（词典 / 翻译） | 文本字段统一走 `LatexText` |
| 文档正文 `modules/doc/DocResult.tsx` | 外壳 + `GenerationNotice` + `<MarkdownContent />` |

**归属判定规则（避免同类缺陷复发）**

> 凡是**模型生成的内容字段**，必须和它的**视觉容器一起**落在共享实现内。
> 只把字段本身搬进共享区、把它的容器留在外壳里，等于没搬。

这条规则来自两次真实缺陷：
1. 第一轮只把「内容主体」收敛成 `KnowledgeContentView`，标题头留在 `SearchResults` 外壳里 ——
   而概览（`summary`）写在标题卡内部，于是收藏详情渲染了标题头却**整段丢失概览**
   （用户反馈"收藏内容不全"）。
2. 第二轮的修法是"把 summary 单独挪进内容区"，但那样搜索页的概览就从标题卡里搬了出去 ——
   **观感回退**，用户当即指出"搜索页的概览效果不能变"。

最终形态：**标题头（标题 + 概览）整体属于共享实现**，因为概览的视觉容器就是标题卡
（它是紧跟标题的引导段）。页面级操作（返回按钮）用 `headerActions` 插槽注入，
既保证两个入口内容完全一致，又不把收藏页的操作栏绑进共享组件。
中断提示（`GenerationNotice`）同样收在共享实现内、紧跟标题头 —— 否则新增入口会忘记接入。

`copy` 与 `export` 是同一份内容的两个出口，**口径也必须一致**：`handleCopy()` 一直带 summary，
而 `generateKnowledgeNote()`（txt / md / html）曾整段没有它 —— 同类问题，同类修法。

**Markdown 与公式共存**：`components/ui/MarkdownContent.tsx` —— 结构（标题/列表/表格/引用）交给 ReactMarkdown，承载文本的元素（`p` / `li` / `td` / `th` / `h1~h6` / `blockquote`）的**字符串子节点**交给 `LatexText`；白名单内联标签（strong/em/del/a/span/sup/sub）递归下钻；`code` / `pre` 内部**不解析**公式（代码里的 `$` 是字面量）。

**渲染前的防御（宁缺勿崩）**

| 防御 | 解决的问题 |
|---|---|
| `sanitizeMindMap()` 递归清洗节点 | `calculateNodeSize()` 读 `title.length`，任一节点缺 `title` 就抛异常 → 整页白屏（收藏数据来自 localStorage，脏数据概率高） |
| `normalizeGenerated` 全字段保底 | 缺 `concepts` / `mindMap` 等数组时下游 `.map` 直接崩 |
| `isGeneratedKnowledge()` 语义判定 | 旧判据（看 `concepts` 是否是数组）会把"有 topic 但无 concepts"误判为旧格式 → 渲染不存在的字段 → 页面近乎空白 |
| `LatexText` 切分顺序：`$$` 先于 `$` | 否则 `$$E=mc^2$$` 会从第二个 `$` 起匹配，公式边上残留美元符号 |
| `toPlainPreview()`（`utils/preview.ts`） | 列表摘要先剥离公式围符 / Markdown 标记、折叠空白**再**截断，避免预览里出现源码与半截公式 |

**收藏存储的降级契约**（`hooks/useFavorites.ts`）

`localStorage` 只有 ~5MB，而收藏的知识卡带 base64 `imageData`（单个可达数 MB）。写入策略：

1. 完整写入 → 成功即结束；
2. 失败（超配额）→ 剥离 `imageData` / `svg` 后重试（**文字内容必须保住**）→ 置 `storageWarning='slimmed'`；
3. 仍失败 → 置 `'failed'`；
4. 任一降级结果通过 `storageWarning` 交给收藏页显示分档横幅（**绝不静默失败** —— 旧实现只 `console.error`，用户看到的是"界面显示已收藏、刷新后消失"）。

另：收藏去重与星标判定统一为「类型 + 收藏夹 + 标题」指纹（此前 `addFavorite` 用 `JSON.stringify` 深度比对、`isFavorite` 只比标题，口径不一致会"显示已收藏却又能新增一条"，且对含 base64 的对象逐条深度序列化是性能陷阱）。

---

## 关联文档

- [产品需求文档](prd.md) —— 需求唯一真实来源（v2.1）
- [项目文档管理配置](project-document-manager.md) —— 文档同步规范
- [文档约定](convention.md) —— 查阅优先级和更新规则
- [技术架构文档](architecture.md) —— 系统架构与目录结构
- [项目目标](goal.md)
- [项目进度](progress.md)
- [版本里程碑](versions.md)
- [待办事项](todo.md)
- [问题记录](issues.md)

---

**备注：** 动态可视化模块（函数图像、算法动画）已从 PRD 弃用，`src/modules/visual/` 代码已于 2026-09-04 清理删除（echarts/echarts-for-react 依赖一并移除；仅遗留一个空目录待清理）。
