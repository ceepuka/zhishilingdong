# 知识灵动助手 - 技术架构文档

**版本:** v2.2  
**日期:** 2026-09-10  
**状态:** 正式版本  
**作者:** AI助手  

---

## 目录

1. [架构概述](#1-架构概述)
2. [系统架构设计](#2-系统架构设计)
3. [模块划分与职责](#3-模块划分与职责)
4. [数据流设计](#4-数据流设计)
5. [关键技术选型](#5-关键技术选型)
6. [目录结构](#6-目录结构)
7. [核心类与接口设计](#7-核心类与接口设计)
8. [状态管理方案](#8-状态管理方案)
9. [存储方案](#9-存储方案)
10. [构建与部署](#10-构建与部署)
11. [AI服务集成（v2 — 无限扩展多厂商）](#11-ai服务集成v2--无限扩展多厂商)
12. [历史记录架构（v1.4.0）](#12-历史记录架构v140)
13. [密钥管理（v2 多厂商面板）](#13-密钥管理v2-多厂商面板)
14. [多语言（i18n）与用户语言（v1.6.0）](#14-多语言i18n与用户语言v160)
15. [流式渲染与超限自动续写（v1.5.0 / v1.6.0）](#15-流式渲染与超限自动续写v150--v160)

---

## 1. 架构概述

### 1.1 架构原则

| 原则 | 说明 | 创新点关联 |
|------|------|---------|
| **分层架构** | 前端应用层 → AI接口层 → 数据持久化层，职责清晰 | 技术创新 |
| **模块化设计** | 搜索、翻译、文档三大模块独立，通过共享hooks通信 | 技术创新 |
| **AI服务抽象** | 统一AI接口契约，支持mock与真实AI无缝切换 | 技术创新 |
| **状态机驱动** | 搜索流程采用7状态状态机，实现智能搜索体验 | 技术创新 |
| **响应式设计** | 适配多端设备，移动端优先 | 美观度 |

### 1.2 架构亮点

| 亮点 | 说明 | 评分关联 |
|------|------|---------|
| **AI服务抽象层** | 设计统一的AI接口契约，支持mock与真实AI无缝切换，保障Demo可演示性 | 技术创新(创新性) |
| **知识搜索状态机** | 7状态状态机驱动搜索流程，实现智能输入验证、知识图谱导航、可视化生成 | 技术创新(创新性) |
| **知识可视化引擎** | 统一的卡片渲染引擎，支持6种知识类型的自适应展示 | 技术创新(创新性) |
| **模块共享状态** | 使用`useSyncExternalStore`实现跨组件共享状态，避免Prop Drilling | 技术创新(创新性) |

---

## 2. 系统架构设计

### 2.1 整体架构图

```
┌─────────────────────────────────────────────────────────────────────┐
│                        前端应用层 (React)                            │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                      UI组件层                                  │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐  │  │
│  │  │ Search   │ │ Translate│ │ Document │ │   Favorites      │  │  │
│  │  │ Module   │ │ Module   │ │ Module   │ │   Panel          │  │  │
│  │  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────────┬─────────┘  │  │
│  │       │            │            │                 │            │  │
│  │  ┌────┴─────┬──────┴─────┬──────┴─────┬──────────┴─────────┐  │  │
│  │  │   Cards  │   Layout   │    UI      │    History         │  │  │
│  │  │ (6 types)│ (Header/Tab)│ (Button/   │   Sidebar         │  │  │
│  │  │          │            │  Input/Card)│                   │  │  │
│  │  └──────────┴────────────┴────────────┴─────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                              │                                       │
│  ┌───────────────────────────┴───────────────────────────────────┐  │
│  │                      业务逻辑层 (Custom Hooks)                │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐         │  │
│  │  │useHistory│ │useFavorites│ │ useTheme │ │useAIConfig│       │  │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘         │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        AI接口层 (AI Service)                        │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │              AI Service Provider (抽象接口)                     │  │
│  │  ┌─────────────────────────────────────────────────────────┐  │  │
│  │  │  interface AIService {                                 │  │  │
│  │  │    search: { validate, analyze, generate, followup }   │  │  │
│  │  │    translate: { detect, queryWord, queryTranslate }    │  │  │
│  │  │    document: { generate, export }                      │  │  │
│  │  │  }                                                     │  │  │
│  │  └─────────────────────────────────────────────────────────┘  │  │
│  │                              │                                 │  │
│  │              ┌───────────────┴───────────────┐                 │  │
│  │              ▼                               ▼                 │  │
│  │     ┌───────────────┐             ┌───────────────┐            │  │
│  │     │  MockAIService│             │  RealAIService │            │  │
│  │     │  (Demo用)     │             │  (生产用)     │            │  │
│  │     └───────────────┘             └───────────────┘            │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      数据持久化层 (LocalStorage)                    │
│  ┌────────────────┐ ┌────────────────┐ ┌────────────────┐         │
│  │   历史记录     │ │    收藏空间     │ │   AI缓存结果   │         │
│  │ (HistoryStore) │ │ (FavoriteStore)│ │ (AICacheStore) │         │
│  │  - search      │ │  - spaces      │ │  - results     │         │
│  │  - qa          │ │  - items       │ │  - timestamp   │         │
│  │  - dictionary  │ │  - tags        │ │                │         │
│  │  - translate   │ │                │ │                │         │
│  │  - doc         │ │                │ │                │         │
│  └────────────────┘ └────────────────┘ └────────────────┘         │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 核心架构组件

| 组件 | 职责 | 技术实现 |
|------|------|---------|
| **App.tsx** | 应用入口，模块路由，全局状态协调 | React函数组件 |
| **Header.tsx** | 顶部导航，收藏面板触发，主题切换 | React组件 |
| **TabNav.tsx** | 模块切换Tab | React组件 |
| **SearchModule** | 知识搜索模块，状态机驱动 | React组件 + useState |
| **TranslateModule** | 词典翻译模块 | React组件 + useState |
| **DocModule** | 文档生成模块 | React组件 + useState |
| **HistorySidebar** | 历史记录侧边栏 | React组件 |
| **FavoritesPanel** | 收藏面板（**死代码**，未被主流程引用） | React组件 |
| **KnowledgeCard** | 6种知识卡片分发器（**死代码**，未被主流程引用） | React组件 |
| **useHistory** | 历史记录管理Hook | useSyncExternalStore |
| **useFavorites** | 收藏管理Hook | useSyncExternalStore |
| **useTheme** | 主题管理Hook | useSyncExternalStore |
| **useLanguage / useLanguageStore** | 语言（`LanguageCode`）状态与存储层 | useSyncExternalStore |
| **useStrings** | i18n 字符串读取（随语言切换重渲染） | useSyncExternalStore |
| **useAIConfig** | 多模型AI配置Hook（v2，含自定义厂商） | useSyncExternalStore |
| **useAIConfigStore** | AI配置存储读写层（LocalStorage v2） | 纯函数 + 全局store |

---

## 3. 模块划分与职责

### 3.1 模块划分

| 模块 | 职责 | 文件位置 | 核心功能 |
|------|------|---------|---------|
| **SearchModule** | 知识搜索 | `src/modules/search/` | 智能搜索、知识图谱、思维导图、卡片展示、追问对话 |
| **TranslateModule** | 词典翻译 | `src/modules/translate/` | 查词模式、翻译模式、语言检测、风格切换 |
| **DocModule** | 文档生成 | `src/modules/doc/` | 文档类型选择、内容生成、格式导出 |
| **Favorites** | 收藏管理 | `src/modules/favorites/`、`src/components/favorites/` | 收藏空间、内容分类、收藏内容展示（`FavoritesPanel.tsx` 为死代码） |
| **History** | 历史记录 | `src/components/history/` | 历史管理、搜索、清空 |
| **Cards** | 知识卡片 | `src/components/cards/` | 6种卡片类型渲染（**死代码**，未被主流程引用） |
| **Settings** | AI 配置面板 | `src/components/settings/` | 模型选择、密钥输入、添加厂商、厂商模板 |
| **i18n** | 多语言字符串层 | `src/i18n/` | 语言目录、字符串表、英文覆盖 |
| **UI** | 通用组件 | `src/components/ui/` | Button、Input、Card、ConfirmDialog、SvgFigure |
| **Hooks** | 共享逻辑 | `src/hooks/` | useHistory、useFavorites、useTheme、useAIConfig、useLanguage、useStrings |
| **Types** | 类型定义 | `src/types/` | 全局TypeScript类型 |

### 3.2 模块交互关系

```
┌─────────────────────────────────────────────────────────────┐
│                        App.tsx                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  ModuleRef管理 ──→ searchRef, translateRef, docRef   │  │
│  │  refreshKey管理 ──→ 全局刷新(清空历史时)              │  │
│  │  handleSelectFavorite ──→ 跨模块联动                 │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
         │                  │                  │
         ▼                  ▼                  ▼
┌───────────────┐ ┌───────────────┐ ┌───────────────┐
│ SearchModule  │ │TranslateModule│ │  DocModule    │
│               │ │               │ │               │
│ - 状态机驱动  │ │ - 模式切换    │ │ - 模板生成    │
│ - 知识图谱    │ │ - 语言检测    │ │ - 文件导出    │
│ - 思维导图    │ │ - 翻译风格    │ │               │
│ - 卡片展示    │ │               │ │               │
│ - 追问对话    │ │               │ │               │
└───────────────┘ └───────────────┘ └───────────────┘
         │                  │                  │
         └──────────────────┼──────────────────┘
                            ▼
              ┌───────────────────────────┐
              │     useHistory Hook       │
              │  (共享历史记录状态)        │
              └───────────────────────────┘
              ┌───────────────────────────┐
              │    useFavorites Hook      │
              │  (共享收藏状态)            │
              └───────────────────────────┘
```

---

## 4. 数据流设计

### 4.1 知识搜索数据流

```
用户输入 → SearchInput → handleSearch
                              │
                              ▼
                    状态机: IDLE → VALIDATING
                              │
                              ▼
                    AI Service.validate()
                              │
                    ┌─────────┴─────────┐
                    ▼                   ▼
                有效(valid)          无效(invalid)
                    │                   │
                    ▼                   ▼
              ANALYZING          提示重新输入
                    │
                    ▼
            AI Service.analyze()
                    │
            ┌───────┴───────┐
            ▼               ▼
        具体内容        非具体内容
            │               │
            ▼               ▼
      GENERATING      KNOWLEDGE_GRAPH
            │               │
            │               ▼
            │         用户选择知识点
            │               │
            └───────┬───────┘
                    ▼
            AI Service.generate()
                    │
                    ▼
              DISPLAYING
                    │
                    ▼
        展示: 概览 + 思维导图 + 概念 + 示例 + 卡片
                    │
             用户发起追问
                    │
                    ▼
              FOLLOWUP
                    │
                    ▼
            AI Service.followup()
```

### 4.2 词典翻译数据流

```
用户输入 → TranslateInput → handleTranslate
                              │
                              ▼
                    AI Service.detect()
              检测源语言 + 是否短语(isPhrase)
                              │
                    ┌─────────┴─────────┐
                    ▼                   ▼
              单词/短语(isPhrase)    句子(!isPhrase)
                    │                   │
                    ▼                   ▼
        AI Service.queryWord()   AI Service.queryTranslate()
                    │                   │
                    ▼                   ▼
             WordResult          SentenceResult
              (含 keywords)      (segments 逐段对齐)
                    │                   │
                    ▼                   ▼
           WordResultComponent   SentenceResultComponent
```

### 4.3 文档生成数据流

```
用户操作 → DocEditor → handleGenerate
                              │
                              ▼
                    构建 DocumentGenerateRequest
                    { type, topic, tone }
                              │
                              ▼
                    AI Service.generate()
                              │
                              ▼
                    DocumentGenerateResponse
                              │
                              ▼
                    DocResultComponent
                              │
                    ┌────────┴────────┐
                    ▼                 ▼
              重新生成            文件导出
                    │                 │
                    │                 ▼
                    │         AI Service.export()
                    │                 │
                    │                 ▼
                    │         下载文件 (txt/md/pdf)
                    │
                    ▼
              handleRegenerate()
```

---

## 5. 关键技术选型

### 5.1 技术栈总览

| 分类 | 技术 | 版本 | 选型理由 | 评分关联 |
|------|------|------|---------|---------|
| **UI框架** | React | 18.x | 函数式组件、Hooks、Concurrent Features | 完成度 |
| **类型系统** | TypeScript | 5.x | 强类型、接口定义、代码提示 | 完成度 |
| **样式方案** | Tailwind CSS | 3.x | 原子化CSS、深色主题、响应式 | 美观度 |
| **构建工具** | Vite | 5.x | 极速热更新、Tree Shaking、ES Module | 完成度 |
| **图标** | Lucide React | 0.x | 轻量级、SVG图标、按需加载 | 美观度 |
| **数学公式** | KaTeX | 0.x | 快速渲染、轻量级 | 美观度 |

### 5.2 核心技术决策

| 决策点 | 方案 | 理由 | 创新点关联 |
|--------|------|------|---------|
| **状态管理** | useSyncExternalStore | 模块级共享状态，避免Prop Drilling，支持跨标签页同步 | 技术创新 |
| **AI服务** | 抽象接口 + Mock实现 | 支持Demo演示，接口契约完整，便于接入真实AI | 技术创新 |
| **搜索流程** | 状态机驱动 | 7状态状态机实现智能搜索流程，逻辑清晰 | 技术创新 |
| **知识展示** | 统一卡片引擎 | 6种卡片类型共享渲染引擎，可扩展性强 | 技术创新 |
| **数据持久化** | LocalStorage | 无后端依赖，Demo可独立运行 | 实用性 |

### 5.3 AI服务层设计

```typescript
// AI服务接口定义
interface AIService {
  search: {
    validate(input: string): Promise<SearchValidateResponse>;
    analyze(input: string): Promise<SearchAnalyzeResponse>;
    generate(topic: string, context?: SearchAnalyzeResponse): Promise<SearchGenerateResponse>;
    generateStream(topic: string, context?, onPartial?): Promise<SearchGenerateResponse>;  // 真流式
    followup(topic: string, question: string, history: FollowupMessage[]): Promise<SearchFollowupResponse>;
    followupStream(topic: string, question: string, history, onPartial?): Promise<SearchFollowupResponse>;
  };
  translate: {
    detect(text: string): Promise<TranslateDetectResponse>;      // 仅检测源语言 + 是否短语
    queryWord(text: string, sourceLang: string, targetLang: string): Promise<DictionaryQueryResponse>;
    queryTranslate(text: string, sourceLang: string, targetLang: string, style?: TranslateStyle): Promise<TranslateQueryResponse>;
  };
  document: {
    generate(type: string, topic: string, requirements?: string, tone?: EmailTone): Promise<DocumentGenerateResponse>;
    generateStream(type: string, topic: string, requirements?, tone?, onPartial?): Promise<DocumentGenerateResponse>;
    export(content: string, format: ExportFormat, metadata?: DocumentMetadata): Promise<DocumentExportResponse>;
  };
}

// 统一响应格式
interface AIResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: AIError;
  metadata?: AIMetadata;
}

interface AIError {
  code: string;
  message: string;
  retryable: boolean;
}

interface AIMetadata {
  latency: number;
  model: string;
  tokenUsage: {
    prompt: number;
    completion: number;
    total: number;
  };
}
```

---

## 6. 目录结构

```
src/
├── components/           # UI组件
│   ├── cards/           # 知识卡片组件（当前未被主流程引用，见进度文档技术债务）
│   │   ├── ConceptCard.tsx      # 概念卡片
│   │   ├── ProcessCard.tsx      # 流程卡片
│   │   ├── CompareCard.tsx      # 对比卡片
│   │   ├── HierarchyCard.tsx    # 层级卡片
│   │   ├── TimelineCard.tsx     # 时间线卡片
│   │   ├── FormulaCard.tsx      # 公式卡片
│   │   └── index.tsx            # 卡片导出
│   ├── favorites/       # 收藏面板
│   │   └── FavoritesPanel.tsx
│   ├── history/         # 历史侧边栏
│   │   └── HistorySidebar.tsx
│   ├── layout/          # 布局组件
│   │   ├── Header.tsx
│   │   └── TabNav.tsx
│   ├── settings/        # AI 配置面板
│   │   ├── ModelSelector.tsx     # 厂商/型号选择
│   │   ├── ProviderKeyInput.tsx  # 密钥输入
│   │   ├── AddProviderForm.tsx   # 添加自定义厂商
│   │   └── providerTemplates.ts  # 厂商快捷模板（8 套）
│   └── ui/              # 通用UI组件
│       ├── Button.tsx
│       ├── Card.tsx
│       ├── ConfirmDialog.tsx
│       ├── Input.tsx
│       ├── Tag.tsx
│       └── SvgFigure.tsx         # 内联 SVG 配图渲染（严格清洗）
├── hooks/               # 自定义Hooks
│   ├── useAIConfig.ts        # 多厂商AI配置Hook
│   ├── useAIConfigStore.ts   # AI配置存储读写（v2）
│   ├── useFavorites.ts       # 收藏管理
│   ├── useHistory.ts         # 历史记录
│   ├── useCommonsImage.ts    # 知识配图加载（导出 useKnowledgeImage，Commons/维基双源）
│   ├── useLanguage.ts        # 语言（useSyncExternalStore）
│   ├── useLanguageStore.ts   # 语言存储读写层（LanguageCode）
│   ├── useSpeechSynthesis.ts # 语音朗读
│   ├── useStrings.ts         # i18n 字符串读取（React 侧）
│   ├── useTheme.ts           # 主题管理
│   └── useTimeRefresh.ts     # 时间自动刷新
├── i18n/                # 多语言字符串层
│   ├── languages.ts     # 语言目录 + normalizeLanguage
│   └── strings/         # 按 area 拆分的字符串表
│       ├── common.ts        # 通用词 / app / tabs / aiPanel
│       ├── settings.ts      # 模型/密钥/添加厂商/厂商模板
│       ├── search.ts        # 搜索模块
│       ├── translate.ts     # 词典翻译模块
│       ├── misc.ts          # doc / favorites / history / speech / exportNote
│       ├── aiProviderTexts.ts # 厂商名/模型描述的英文覆盖
│       ├── docTemplates.ts  # 文档模板正文的多语言覆盖
│       └── index.ts         # 汇总 + deepMerge + getCurrentStrings
├── modules/             # 业务模块
│   ├── search/          # 知识搜索模块
│   │   ├── index.tsx         # 模块入口
│   │   ├── components/       # SearchInput / SearchContainer / HotTags / SearchModeSelector / QAContainer
│   │   ├── hooks/useSearchMode.ts   # 搜索/QA 双模式
│   │   ├── services/QAService.ts    # 问答会话服务
│   │   ├── SearchResults.tsx # 搜索结果
│   │   ├── KnowledgeGraph.tsx # 知识目录（div 层级占位）
│   │   ├── QASection.tsx     # 问答区
│   │   ├── useSearchStateMachine.ts # 搜索状态机
│   │   └── mockData.ts       # Mock数据
│   ├── translate/       # 词典翻译模块
│   │   ├── index.tsx         # 模块入口
│   │   ├── TranslateInput.tsx # 翻译输入（源/目标双下拉）
│   │   ├── WordResult.tsx    # 查词结果
│   │   ├── SentenceResult.tsx # 翻译结果（逐段对齐）
│   │   ├── constants.ts      # 语言/上限常量
│   │   └── mockData.ts       # Mock数据
│   ├── doc/             # 文档生成模块
│   │   ├── index.tsx         # 模块入口
│   │   ├── DocEditor.tsx     # 文档编辑器
│   │   ├── DocResult.tsx     # 文档结果
│   │   ├── DocTypeSelector.tsx # 类型选择
│   │   └── templates.ts      # 文档模板（结构 + generate*(topic, language)）
│   └── favorites/       # 收藏模块（index.tsx + FavoriteContent.tsx）
├── services/            # AI服务层
│   ├── aiServiceProvider.ts  # 动态路由（Mock/真实AI）+ Provider工厂
│   ├── baseAIProvider.ts     # Provider抽象基类（prepareRequest/buildXxxPrompt/callModelStream/sanitize）
│   ├── providers/genericProvider.ts  # GenericAIProvider + 预设overlay
│   ├── streaming/            # 流式增量解析
│   │   ├── partialJSON.ts    # StreamingJSONParser（增量 JSON 部分解析）
│   │   └── sseReader.ts      # SSE 流读取 + truncated 透出
│   ├── commonsImage.ts       # 配图查询（Commons/维基双源兜底）
│   └── mockAIService.ts      # Mock实现
├── styles/              # 全局样式
│   └── index.css        # Tailwind CSS入口
├── types/               # 类型定义
│   ├── index.ts         # 全局TypeScript类型
│   ├── ai.ts            # AI服务接口契约
│   └── aiProviders.ts   # 厂商元数据 + v2配置类型
├── utils/               # 工具函数
│   ├── export.ts        # 导出工具（多语言表头）
│   ├── inlineSvg.ts     # 内联 SVG 严格清洗
│   ├── jsonRepair.ts    # JSON脏数据4层修复
│   └── latex.ts         # LaTeX 归一化 + 安全渲染
├── App.tsx              # 应用入口
├── main.tsx             # 应用启动
└── vite-env.d.ts        # Vite环境类型
```

---

## 7. 核心类与接口设计

### 7.1 类型定义结构

| 类型 | 定义位置 | 说明 |
|------|---------|------|
| **TabType** | `src/types/index.ts` | 模块类型: 'search' \| 'translate' \| 'doc' |
| **KnowledgeType** | `src/types/index.ts` | 知识卡片类型: 'concept' \| 'process' \| 'formula' \| 'timeline' \| 'compare' \| 'hierarchy' |
| **FavoriteItem** | `src/types/index.ts` | 收藏项类型 |
| **HistoryItem** | `src/types/index.ts` | 历史项类型 |
| **KnowledgeCardData** | `src/types/index.ts` | 知识卡片数据联合类型 |
| **GeneratedKnowledge** | `src/types/index.ts` | AI生成的知识数据 |
| **MindMapNode** | `src/types/index.ts` | 思维导图节点 |
| **Concept** | `src/types/index.ts` | 概念定义 |
| **Example** | `src/types/index.ts` | 示例演示 |
| **WordResult** | `src/types/index.ts` | 查词结果 |
| **SentenceResult** | `src/types/index.ts` | 翻译结果 |
| **DocResult** | `src/types/index.ts` | 文档生成结果 |

### 7.2 搜索状态机状态定义

```typescript
type SearchState = 
  | 'IDLE'           // 初始状态，等待输入
  | 'VALIDATING'     // 验证输入有效性
  | 'INVALID'        // 输入无效
  | 'ANALYZING'      // 分析是否具体内容
  | 'KNOWLEDGE_GRAPH' // 展示知识图谱供选择
  | 'GENERATING'     // 流式生成（概览→思维导图→概念→示例→卡片，按字段顺序边生成边渲染）
  | 'DISPLAYING'     // 展示生成内容
  | 'FOLLOWUP';      // 追问对话
```

### 7.3 模块引用接口

```typescript
interface ModuleRef {
  showFavorite?: (item: FavoriteItem) => void;
  reset?: () => void;
}
```

---

## 8. 状态管理方案

### 8.1 状态管理策略

| 状态类型 | 管理方式 | 说明 |
|---------|---------|------|
| **模块内部状态** | useState | 各模块独立的UI状态（如loading、sidebarOpen） |
| **共享状态** | useSyncExternalStore | 主题、收藏、历史记录、**语言（v1.6.0）**、**AI多模型配置** 等跨组件共享状态 |
| **全局状态** | App.tsx useState | refreshKey（全局刷新）、activeTab（当前模块） |

### 8.2 useSyncExternalStore实现原理

```typescript
// 模块级共享状态（所有组件共享同一份数据）
let sharedState: T[] = [];
const listeners = new Set<() => void>();

function readStorage(): T[] { /* 从localStorage读取 */ }
function saveStorage(items: T[]) { /* 写入localStorage */ }
function notify() { listeners.forEach(l => l()); }

// 跨标签页同步
window.addEventListener('storage', (e) => {
  if (e.key === STORAGE_KEY) {
    sharedState = readStorage();
    notify();
  }
});

// useSyncExternalStore订阅
const subscribe = useCallback((callback: () => void) => {
  listeners.add(callback);
  return () => { listeners.delete(callback); };
}, []);

const getSnapshot = useCallback(() => sharedState, []);
const state = useSyncExternalStore(subscribe, getSnapshot);
```

### 8.3 全局刷新机制

当用户清空历史记录时，需要刷新所有模块状态：

```typescript
// App.tsx
const [refreshKey, setRefreshKey] = useState(0);

const handleClearAllHistory = () => {
  clearHistory();
  searchRef.current?.reset?.();
  translateRef.current?.reset?.();
  docRef.current?.reset?.();
  setRefreshKey(prev => prev + 1); // 强制组件重渲染
};

// 模块使用key={refreshKey}强制重挂载
<SearchModule key={refreshKey} ref={searchRef} />
```

---

## 9. 存储方案

### 9.1 存储结构

| 存储键 | 数据结构 | 说明 |
|--------|---------|------|
| `ai-office-assistant-history` | `HistoryItem[]` | 历史记录 |
| `ai-office-assistant-favorites` | `FavoriteItem[]` | 收藏内容（含收藏空间） |
| `ai-office-assistant-theme` | `'light' \| 'dark'` | 当前主题 |
| `ai-office-assistant-language` | `LanguageCode`（`zh`/`en`/…） | 用户语言（AI 输出语言 + UI 语言） |
| `ai-office-assistant-ai-config` | `AIConfigV2` | 多厂商 AI 配置（v2 结构） |

### 9.2 存储策略

| 策略 | 说明 |
|------|------|
| **容量限制** | 历史记录最多100条，收藏最多50条 |
| **压缩存储** | 收藏内容使用JSON压缩 |
| **开发期无迁移** | 存储结构变更直接升级，不写 v1→v2 迁移（产品未落地）；但读取端仍对旧格式做归一（如 `normalizeLanguage` 兼容 `zh-CN`/中文名） |
| **跨标签同步** | 使用storage事件监听其他标签页修改 |

---

## 10. 构建与部署

### 10.1 构建配置

| 配置项 | 说明 |
|--------|------|
| **Vite** | 构建工具，支持ES Module、Tree Shaking |
| **TypeScript** | 严格类型检查，路径别名配置 |
| **Tailwind CSS** | 原子化CSS，JIT模式 |
| **PostCSS** | CSS预处理，Autoprefixer |

### 10.2 构建命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 开发模式，热更新，http://localhost:5173 |
| `npm run release` | **正式发布构建**：类型检查 → 构建 → 内联 → 产出 `release/` 发布包 |
| `npm test` | Vitest 测试 |
| `npm run manifest` | 重建文档清单 `.manifest.json` |

### 10.3 发布形态

**本项目唯一的正式发布形态是单文件 HTML。** 没有后端，API Key 由用户自持并在浏览器直连厂商，不需要任何服务器或托管平台。

| 产物 | 说明 |
|------|------|
| `release/知识灵动助手.html` | 全部 JS / CSS / 字体以 base64 内联，双击打开即用，不需要 Node / 服务器 / 网络 |
| `release/使用说明.txt` | 随包说明，由构建脚本生成（体积 / 版本 / 构建日期与产物绑定） |

构建链路：

```
源码 ──vite.standalone.config.ts──▶ .tmp-standalone/（中间产物，gitignore）
                                        │
                                        └─scripts/build-standalone.js─▶ release/（成品，gitignore）
                                                                            │
                                                                            └─▶ GitHub Release 附件
```

**仓库只留源码**：`release/` 与 `.tmp-standalone/` 都不入库，成品作为 Release 附件分发，
避免每次发布在 git 历史里堆积同体积的 blob。

发布仓库：[github.com/ceepuka/zhishilingdong](https://github.com/ceepuka/zhishilingdong)（public）
· 下载入口：[最新 Release](https://github.com/ceepuka/zhishilingdong/releases/latest)

> **公开仓库不含开发过程产物**：`.trae/`（开发计划）与 `.workbuddy/memory/`（工作日志）已在
> 首次公开时排除并加入 `.gitignore`。旧私有仓库以 `archive` 远端保留（含完整历史与这些文件）。

> 历史的 CDN 部署（`netlify.toml` / `vercel.json`）与本地静态服务（`server.js` / `start.bat`）
> 已于 2026-09-29 移除，发布形态统一。

### 10.3.1 为什么单文件要单独一份构建配置

`file://` 页面的来源是 `null`，有两条限制普通构建过不去，`vite.standalone.config.ts` 专门处理：

| 限制 | 现象 | 处理 |
|------|------|------|
| 动态 `import()` 走网络式加载 | 懒加载 chunk（jspdf/html2canvas/purify）被 CORS 拦，**导出功能静默失效**（不报错） | `output.inlineDynamicImports: true`，全部合并进单一 chunk |
| 外部字体/资源被视为跨源请求 | KaTeX 的字体文件全部加载失败，公式排版崩 | `assetsInlineLimit: Infinity`，内联为 base64 data URI |

另外两处收尾工作写在 `scripts/build-standalone.js` 里：

- Vite 的 `assetsInlineLimit` **管不到** HTML 里 `<link rel="icon">` 引用的资源，需手动转 data URI；
- 内联 JS 时必须把 `</script` 转义成 `<\/script`，否则 JS 里出现的该字符串会提前截断脚本标签、页面白屏，
  且报错完全不指向这里。

产物约 3.2MB（其中字体约 1.5MB）。

### 10.4 环境变量

本项目不使用任何环境变量。API 密钥、厂商、型号等全部在应用内通过配置面板管理，存储于 LocalStorage（v2 结构）。

---

## 11. AI服务集成（v2 — 无限扩展多厂商）

### 11.1 服务架构

```
┌──────────────────────────────────────────────────────────────────────┐
│                   AI服务层 (v2 多厂商 + 自定义厂商)                  │
│                                                                      │
│  ┌───────────────────────────────────────────────────────────────┐   │
│  │                AI Service Provider (路由层)                    │   │
│  │  ┌─────────────────────────────────────────────────────────┐  │   │
│  │  │  interface AIService {                                  }│  │   │
│  │  │   search:{validate/analyze/generate/                      │  │   │
│  │  │           generateStream/followup/followupStream}         │  │   │
│  │  │   translate:{detect/queryWord/queryTranslate}             │  │   │
│  │  │   document:{generate/generateStream/export}               │  │   │
│  │  └─────────────────────────────────────────────────────────┘  │   │
│  │                           │ shouldUseRealAI()                  │   │
│  │               ┌───────────┴─────────────┐                      │   │
│  │               ▼ activeProvider.valid    ▼ 否则                 │   │
│  │  ┌──────────────────────────┐    ┌────────────────────┐       │   │
│  │  │ GenericAIProvider        │    │  MockAIService     │       │   │
│  │  │ （唯一具体实现）          │    │  (Demo/失败兜底)    │       │   │
│  │  │ 差异通过 PRESET_OVERLAYS │    │                    │       │   │
│  │  │ 注入（dashscope 错误映射 │    │                    │       │   │
│  │  │ /siliconflow 中文前缀）  │    │                    │       │   │
│  │  └───────┬──────────────────┘    └────────────────────┘       │   │
│  │          │ OpenAI 兼容 / 归一错误                              │   │
│  │  ┌───────┴───────────────────────────────────────────────┐    │   │
│  │  │  厂商 API（每个独立：Base URL + Key + 型号）            │    │   │
│  │  │  · 智谱：open.bigmodel.cn         · 通义：dashscope    │    │   │
│  │  │  · 硅基流动：api.siliconflow.cn                          │    │   │
│  │  │  · 用户自定义厂商（customProviders，运行时添加）         │    │   │
│  │  └────────────────────────────────────────────────────────┘    │   │
│  └───────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌─────────────────── 多厂商配置（存储层） ───────────────────────┐   │
│  │  LS: ai-office-assistant-ai-config (v2)                       │   │
│  │  · activeProviderId + activeModelId                           │   │
│  │  · providers.<id> 各自 Key/状态（预设 3 家 + 自定义厂商）      │   │
│  │  · customProviders：用户添加的厂商元数据                       │   │
│  │  · 可选 customBaseUrl / customModel                           │   │
│  └───────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────┘
```

### 11.2 模块调用方式

（业务模块统一通过 `aiService.*` 调用，与具体厂商解耦）

| 模块 | AI方法 | 调用时机 |
|------|--------|---------|
| **直接问答** | `search.followup()` | 用户发送消息时 |
| **知识搜索生成** | `search.generateStream()` | 用户输入知识点、判定为可展开的知识点后（单次调用，边生成边渲染，超限自动续写） |
| **搜索/问答追问** | `search.followup()` / `search.followupStream()` | 用户在结果页追问时 |
| **词典查词** | `translate.queryWord()` | 用户输入单词/短语查词时 |
| **文本翻译** | `translate.queryTranslate()` | 用户输入文本翻译时 |
| **文档生成** | `document.generateStream()` | 用户点击生成按钮时（流式占位后原地填充） |
| **语言检测** | `translate.detect()` | 用户切换源语言/检测模式时（仅检测源语言 + 是否短语） |

### 11.3 AI调用逻辑

```
业务调用 aiService.*
  → getAIService()：读取 activeProvider + key 状态
        ├─ valid → 对应 Provider.buildService()（真实 AI）
        │           → callModel → OpenAI 兼容 POST（一次性返回）
        │           → callModelStream → SSE 流式（首字节超时 FIRST_BYTE_TIMEOUT_MS=60s）
        │           → callModelWithJSON → 4 层 JSON 修复
        │           → 业务异常：withFallback → mock 值 / mock 函数
        │           → 链路异常（超时 / 协议失败）：withFallback 透传 success:false + code，不兜底
        └─ 其他（unconfigured/invalid/抛错）→ mockAIService
```

### 11.4 错误处理与 Fallback

| 场景 | 处理方式 |
|------|---------|
| 当前 activeProvider API Key 未配置 | 直接走 mockAIService |
| API 返回 401 / 429 / quota 超限 | 回落到对应 fallback 值或 mock 函数，标记该厂商状态为 invalid |
| 网络超时 / DNS 失败 / fetch 抛错 | **链路错误**：`withFallback` 以 `success:false + code`（`STREAM_TIMEOUT` / `STREAM_PROTOCOL`）**透传**给 UI（不再吞成笼统"生成失败"，也不降级重发），并 `console.warn` 保留日志 |
| 流式首字节超时（60s 内未收到任何字节） | 主动 `abort` 并抛 `StreamTimeoutError` → 透传为 `STREAM_TIMEOUT`，UI 提示"等待模型响应超时，请检查网络或尝试其他模型" |
| JSON 解析失败（4 层修复仍失败） | 回落到对应 fallback 值 |
| 某厂商 Key 失效，用户切到另一家厂商 | 新 activeProvider 若 valid → 正常走真实 AI（彼此独立） |
| 自定义 Base URL 请求失败 | 同上归一处理，不会因为代理不通导致整体不可用 |

---

## 12. 历史记录架构（v1.4.0）

### 12.1 架构演进

| 阶段 | 实现方式 | 问题 |
|------|---------|------|
| v1.0-v1.2 | useState hook + key prop | 多实例状态不同步，需要强制重挂载 |
| v1.3 | useSyncExternalStore | 跨组件状态共享，但历史记录跨模块访问仍有问题 |
| v1.4+ | HistoryContext + Context模式 | 全局统一状态，所有模块共享同一份历史数据 |

### 12.2 HistoryContext设计

```typescript
interface HistoryContextType {
  history: HistoryItem[];
  addHistory: (type: HistoryType, query: string, data: HistoryData) => void;
  touchHistory: (id: string) => void;
  removeHistory: (id: string) => void;
  clearHistory: (type?: HistoryType) => void;
  getHistoryByType: (type: HistoryType, viewingQuery?: string) => HistoryItem[];
}
```

### 12.3 使用方式

```tsx
// App.tsx - 全局包裹
<HistoryProvider>
  <App />
</HistoryProvider>

// 模块中使用
const { addHistory, touchHistory, getHistoryByType } = useHistory();
```

---

## 13. 密钥管理（v2 多厂商面板）

### 13.1 配置方式

API 密钥采用"**多厂商独立配置 + 级联选择当前厂商/型号 + 用户自定义厂商**"，全部保存在 LocalStorage（v2 结构）：

| 配置项 | 说明 | 存储位置 |
|--------|------|---------|
| `activeProviderId` | 当前选中的厂商（预设 3 家 ∪ 自定义厂商） | LS `ai-office-assistant-ai-config` |
| `activeModelId` | 当前选中的型号 ID | 同上 |
| `providers.<id>.apiKey` | 该厂商的 API 密钥（独立） | 同上 |
| `providers.<id>.status` | 该厂商密钥状态 unconfigured/configuring/valid/invalid | 同上 |
| `providers.<id>.customBaseUrl` | 该厂商的自定义 Base URL（可选，默认走官方） | 同上 |
| `providers.<id>.customModel` | 该厂商的自定义模型 ID（可选，下拉不够时用） | 同上 |
| `customProviders.<id>` | 用户添加的自定义厂商元数据（名称/Base URL/型号） | 同上 |

### 13.2 密钥管理组件

**入口**：Header 顶栏中央按钮（图标为 Key），文案随状态变化：
- 未配置：橙色高亮 "未配置密钥"
- activeProvider 已 valid：青色 "厂商简称·当前型号"（如 "智谱·glm-4-flash"）
- activeProvider 失效：红色 "配置失效"

**面板结构（固定 3 个 Tab）**：
1. **模型选择 Tab** `ModelSelector`
   - 上方厂商卡片（预设 3 家 + 已添加的自定义厂商，显示该厂商 Key 状态徽标）
   - 下方当前厂商下的型号列表（单选，含描述/上下文长度/推荐 tag）
2. **密钥管理 Tab**
   - 厂商下拉切换 + `ProviderKeyInput`：API Key 输入（显示/隐藏密码切换）
   - 高级选项（可折叠）：自定义 Base URL / 自定义型号
   - 保存按钮：Ping 验证 5s → 成功写入 provider.status=valid / 失败标 invalid + 错误文案
   - 已配置后出现"清除密钥配置"按钮
3. **添加厂商 Tab** `AddProviderForm`
   - 填写厂商名称/Base URL/型号 ID → 写入 `customProviders`，运行时即时可用

**跨 Tab 同步**：`useAIConfig` 监听 `storage` 事件，任一浏览器 Tab 改动立即在其他 Tab 刷新。

---

## 14. 多语言（i18n）与用户语言（v1.6.0）

### 14.1 设计原则

| 原则 | 说明 |
|------|------|
| **英文作类型基准** | 每个 area 先写 `xxxEn`，`export type XxxStrings = typeof xxxEn`；中文写 `xxxZh: XxxStrings`。中文漏 key → `tsc` 立即报错（有意设计，杜绝静默漏翻译） |
| **运行时兜底** | `STRINGS_ZH = deepMerge(STRINGS_EN, {...Zh})`，缺 key 回退英文，不出现 `undefined` 文案、不崩 |
| **双入口取值** | React 组件用 `useStrings()`（`useSyncExternalStore`）；service/状态机/utils 用 `getCurrentStrings()`。二者均读 `getStoredLanguage()` |
| **语言 ≠ UI 语言** | store 存标准 `LanguageCode`（`zh`/`en`/`fr`…）；UI 字符串仅 `zh` 用中文表，其余一律英文表 |
| **数据层不迁 i18n** | 厂商名/模型描述/文档模板正文属数据，保留在数据层；英文覆盖由 `aiProviderTexts.ts` / `docTemplates.ts` 提供 |

### 14.2 字符串层结构

```
src/i18n/
├── languages.ts            # 语言目录（code/native/zhName/english/speech）+ normalizeLanguage
└── strings/
    ├── common.ts           # app.* / tabs.* / aiPanel.* / 通用词
    ├── settings.ts         # 模型/密钥/添加厂商/厂商模板
    ├── search.ts           # 搜索模块全部文案
    ├── translate.ts        # 词典翻译模块全部文案
    ├── misc.ts             # doc.* / favorites.* / history.* / speech.* / exportNote.*
    ├── aiProviderTexts.ts  # localizedProviderName / localizedModelDescription
    ├── docTemplates.ts     # getDocBodies(language)
    └── index.ts            # STRINGS_EN / STRINGS_ZH + getCurrentStrings + fmt
```

### 14.3 语言基础设施

| 组件 | 职责 |
|------|------|
| `languages.ts` | 全应用唯一语言目录；`normalizeLanguage` 兼容旧 `zh-CN`、中文名、BCP-47 带地区 |
| `useLanguageStore.ts` | 纯存储层（subscribe/emit），存标准 `LanguageCode`，默认取 `navigator.language` |
| `useLanguage.ts` | `useSyncExternalStore`，返回 `{ language, uiLanguage, setLanguage, setLanguageZh/En }` |
| `useStrings.ts` | React 侧取字符串表，随语言切换重新渲染 |

### 14.4 AI 输出绑定用户语言

`baseAIProvider.buildLanguageDirective()` 每次组装 prompt 时实时读取 `getAIContentLanguage()`，注入"输出语言为 X，但 JSON 字段名/枚举值保持英文"。已接入 search 生成/追问、document 三处 system prompt。

---

## 15. 流式渲染与超限自动续写（v1.5.0 / v1.6.0）

### 15.1 生产者-消费者模型

```
AI 侧（生产者）                     渲染侧（消费者）
SSE chunk ──► sseReader ──► StreamingJSONParser.push(chunk)
                                    │  维护：容器栈 / 字符串状态 / 安全切割点 / 已完成顶层键
                                    ▼
                              共享缓冲区（raw + 部分对象）
                                    │
                          渲染侧随时 read() 取快照 ──► mergeSnapshot ──► setState（60ms 节流）
```

| 组件 | 文件 | 职责 |
|------|------|------|
| **SSE 读取** | `services/streaming/sseReader.ts` | 处理跨 chunk 半行、`[DONE]`、流内 error；逐层透出 `truncated`（`finish_reason=length`） |
| **增量 JSON 解析** | `services/streaming/partialJSON.ts` | 单趟扫描，任意截断位置都能补出可渲染的部分对象（正在写的字符串按已达字符呈现 → 打字机效果） |
| **快照合并** | `mergeSnapshot` | 仅在新值非空时覆盖旧值，防增量解析回退导致已渲染内容闪回 |

### 15.2 流式调用与链路状态处理（v1.6.2：诚实处理，不猜测）

`BaseAIProvider.prepareRequest`（流式/非流式共用）抽公共请求骨架。流式策略**不猜测、不打补丁 —— 拿到什么链路状态就诚实处理什么**：

| 链路状态 | 处理 |
|---------|------|
| 型号静态能力声明不支持流式（`caps.streaming=false`） | 直接走 `callModel` 一次性返回（配置层结论，非运行时猜测） |
| 传输层失败 / SSE 协议失败 / 首字节超时（`FIRST_BYTE_TIMEOUT_MS=60s`） | **抛错透传**（不降级重发 —— 重发等于让用户白等一轮） |
| 收到增量 | 立即 `onDelta` 实时渲染（"有多少内容显示多少内容"） |

`withFallback` 对**链路错误**（`StreamTimeoutError` / `StreamProtocolError`）以 `success:false + code` **透传**给 UI，只有**业务错误**才兜底为 fallback —— 兜底层必须区分错误语义，否则下游的错误识别会变成走不到的死代码。提示词抽为 `buildGeneratePrompt` / `buildFollowupPrompt` / `buildDocPrompt` 共用，`sanitizeGenerateResult` 作为统一清洗出口。

状态机 `useSearchStateMachine.runGenerate` 使用 `AbortController` 可中断 + 60ms 节流；最终态以服务端完整结果再合并一次，避免节流跳过的尾部丢失。

> **已移除（v1.6.2）**：原"流式能力黑名单（`streamUnsupported` Map + 冷却期自愈）"已彻底删除 —— 它是运行时猜测、且"自愈"入口不可达。文档与代码均不得再描述该机制。

### 15.3 超限自动续写

| 机制 | 说明 |
|------|------|
| `hasCompleteJSONObject(raw)` | 复用解析层权威判定 `partialJSON.isCompleteJSON`（正确追踪 `{}`/`[]` 嵌套 + 字符串转义 + markdown 围栏），**不做修复**（若用带 repair 的 `parseJSONResponse`，截断会被补成合法而静默跳过续写） |
| `buildGenerateCompleteChecker()` | search 续写判定升级为「括号闭合 **且** 核心字段齐全」（`mindMap` / `concepts` / `knowledgeContext` / `examQuestions` / `interestingFacts`），防"括号闭合但缺末尾区块"就收尾 |
| `callModelStreamWithContinuation(...)` | 首轮 1 次 + 续写 ≤2 次（`MAX_GENERATION_ATTEMPTS=3`）；未写完时回填已生成内容（尾部最多 12k）要求"只输出续写"；续写轮空内容即 break、续写轮异常保留已累积内容（不空转、不丢尾巴） |
| 接入点 | `search.generateStream`（字段齐全判定）/ `followupStream` / `document.generateStream`（括号闭合判定） |
| 用户反馈 | `SearchGenerateResponse.continued` → SearchResults 在琥珀色截断警告后追加青绿色"已自动续写并补全"提示 |

---

**备注：** 本技术架构文档描述当前 v2 版本（无限扩展多厂商）的实现：GenericAIProvider 统一 Provider 体系（overlay 注入差异）、BaseAIProvider 抽象基类、JSON 修复独立模块、useAIConfig/Store 分层存储与 Hook、用户自定义厂商、Header 三 Tab AI 配置面板；业务调用签名保持稳定，模块与具体厂商完全解耦。

**版本说明：** 本架构文档为项目技术实现的权威描述，所有技术决策以本文档为准。