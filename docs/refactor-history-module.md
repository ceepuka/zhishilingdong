# 历史记录与收藏模块重构设计

## 1. 背景

当前项目中，历史记录和收藏功能存在严重的代码重复和架构问题，导致每次修改都需要同步修改 3-4 个文件，容易遗漏且维护成本高。

### 1.1 问题概览

| 问题类型  | 具体表现                                                             | 影响范围        |
| ----- | ---------------------------------------------------------------- | ----------- |
| 代码重复  | 三个历史侧边栏组件（TranslateHistory/DocHistory/SearchHistory内联）有90%相同逻辑   | 新增功能需修改3处   |
| 逻辑重复  | useHistory的session方法（updateQASession/updateSearchSession等）逻辑几乎相同 | 新增模块需新增类似方法 |
| 传递链过长 | timeRefresh通过App→Header→Module→Sidebar层层传递                       | 难以追踪数据流     |
| 反模式   | currentViewing通过ref+useImperativeHandle获取                        | 违反单向数据流原则   |

### 1.2 当前架构图

```
App.tsx
├── Header.tsx ────────────────────→ FavoritesPanel.tsx (timeRefresh, currentViewing)
│
├── SearchModule ──→ 内联SearchHistory (timeRefresh, currentViewing via ref)
│
├── TranslateModule ──→ TranslateHistory.tsx (timeRefresh, currentViewing via ref)
│
└── DocModule ──→ DocHistory.tsx (timeRefresh, currentViewing via ref)
```

## 2. 重构目标

1. **消除重复代码**：提取通用组件，一处修改全局生效
2. **简化状态管理**：移除冗余的 props 传递链
3. **统一 API**：合并 useHistory 中重复的 session 方法
4. **提升可维护性**：新模块接入历史记录只需配置，无需编写组件

## 3. 方案设计

### 3.1 通用 HistorySidebar 组件

#### 3.1.1 接口设计

```typescript
// src/components/history/HistorySidebar.tsx

interface HistorySidebarConfig {
  title: string;
  icon: JSX.Element;
  color: 'teal' | 'amber' | 'blue';
}

interface HistorySidebarProps {
  items: HistoryItem[];
  config: HistorySidebarConfig;
  currentViewing?: string | null;
  onSelect: (item: HistoryItem) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
  onClose: () => void;
}
```

#### 3.1.2 配置映射表

| 模块 | title           | color | icon    |
| -- | --------------- | ----- | ------- |
| 搜索 | "搜索历史" / "问答历史" | teal  | 🔍      |
| 翻译 | "查词历史" / "翻译历史" | amber | 📖 / 🌐 |
| 文档 | "文档历史"          | blue  | 📄      |

#### 3.1.3 内部实现要点

- 内部调用 `useTimeRefresh()`，无需外部传递
- 内置 `formatTime` 函数（统一格式化逻辑）
- "浏览中"标记替换时间显示（三目运算符）
- 空状态、清空按钮、收起按钮统一实现

### 3.2 useHistory 统一 session 方法

#### 3.2.1 方法合并

| 原有方法                                   | 统一后方法                                  |
| -------------------------------------- | -------------------------------------- |
| `updateQASession(query, messages)`     | `updateSession(type, query, messages)` |
| `updateSearchSession(query, messages)` | `updateSession(type, query, messages)` |
| `getQASession(query)`                  | `getSession(type, query)`              |
| `getSearchSession(query)`              | `getSession(type, query)`              |

#### 3.2.2 新方法签名

```typescript
updateSession(
  type: HistoryItem['type'],
  query: string,
  messages: ChatMessage[]
): void

getSession(
  type: HistoryItem['type'],
  query: string
): QASession | undefined
```

#### 3.2.3 保留方法

- `addHistory(query, type, session?)` - 新增历史记录
- `touchHistory(id)` - 更新时间戳并重新排序
- `removeHistory(id)` - 删除单条记录
- `getHistoryByType(type)` - 按类型查询
- `clearHistory(type?)` - 清空历史

### 3.3 简化 currentViewing 机制

#### 3.3.1 改造方案

**改造前：**

```
各模块 → useImperativeHandle(getCurrentViewing) → App.tsx → Header.tsx → Sidebar
```

**改造后：**

```
各模块内部计算 viewingQuery → 直接传给 HistorySidebar
```

#### 3.3.2 各模块 viewingQuery 计算逻辑

| 模块 | viewingQuery 来源                                            |
| -- | ---------------------------------------------------------- |
| 搜索 | `currentQuery`（搜索模式）/ `firstQuestion`（问答模式）                |
| 翻译 | `wordResult?.word`（查词模式）/ `sentenceResult?.original`（翻译模式） |
| 文档 | `result?.title`                                            |

### 3.4 简化 timeRefresh 传递链

#### 3.4.1 改造方案

**改造前：**

```
App.tsx → Header.tsx → FavoritesPanel.tsx
App.tsx → Module → HistorySidebar
```

**改造后：**

```
FavoritesPanel.tsx 内部调用 useTimeRefresh()
HistorySidebar.tsx 内部调用 useTimeRefresh()
```

## 4. 实施计划

### 4.1 阶段一：创建通用组件

**任务：** 创建 `HistorySidebar.tsx` 通用组件

**文件：**

- 新建 `src/components/history/HistorySidebar.tsx`

**内容：**

- 实现完整的侧边栏 UI（头部、列表、空状态、清空按钮）
- 内部调用 `useTimeRefresh()`
- 内置 `formatTime()` 函数
- "浏览中"标记替换时间显示逻辑

### 4.2 阶段二：统一 useHistory API

**任务：** 合并 session 方法

**文件：**

- 修改 `src/hooks/useHistory.ts`

**内容：**

- 添加 `updateSession(type, query, messages)`
- 添加 `getSession(type, query)`
- 保留原有方法作为兼容层（可选）

### 4.3 阶段三：迁移各模块

**任务：** 三个模块迁移到通用组件

**文件：**

- 修改 `src/modules/search/index.tsx` - 使用 HistorySidebar
- 修改 `src/modules/translate/index.tsx` - 使用 HistorySidebar，删除 TranslateHistory.tsx
- 修改 `src/modules/doc/index.tsx` - 使用 HistorySidebar，删除 DocHistory.tsx

**内容：**

- 移除内联的搜索历史渲染逻辑
- 替换 TranslateHistory/DocHistory 引用
- 直接传递 `viewingQuery` 给组件

### 4.4 阶段四：简化 App.tsx 和 Header.tsx

**任务：** 移除 timeRefresh 和 currentViewing 传递链

**文件：**

- 修改 `src/App.tsx`
- 修改 `src/components/layout/Header.tsx`
- 修改 `src/components/favorites/FavoritesPanel.tsx`

**内容：**

- 移除 `useTimeRefresh()` 调用
- 移除 `currentViewing` state 和 useEffect
- 移除各模块 ref 的 getCurrentViewing 方法
- FavoritesPanel 内部调用 `useTimeRefresh()`

## 5. 风险评估

| 风险                 | 等级 | 应对措施                          |
| ------------------ | -- | ----------------------------- |
| 组件替换后样式差异          | 低  | 严格对齐现有样式，使用相同的 Tailwind class |
| 功能回归               | 中  | 逐条验证：清空、删除、点击跳转、浏览中标记         |
| 类型错误               | 低  | 每步执行 `tsc --noEmit`           |
| localStorage 数据兼容性 | 低  | session 方法签名兼容，数据结构不变         |

## 6. 验收标准

### 6.1 功能验证

| 验证项    | 预期结果                   |
| ------ | ---------------------- |
| 搜索历史显示 | 使用通用 HistorySidebar 组件 |
| 翻译历史显示 | 使用通用 HistorySidebar 组件 |
| 文档历史显示 | 使用通用 HistorySidebar 组件 |
| 浏览中标记  | 当前打开的记录显示"浏览中"，替换时间    |
| 时间自动更新 | 每分钟刷新一次显示              |
| 点击跳转   | 记录跳转到对应内容，时间戳更新，排到最前   |
| 清空历史   | 按类型清空，不影响其他模块          |
| 单条删除   | 悬停显示删除按钮，点击删除          |

### 6.2 代码验证

| 验证项            | 预期结果                                       |
| -------------- | ------------------------------------------ |
| 无重复文件          | TranslateHistory.tsx 和 DocHistory.tsx 已删除  |
| useHistory API | 只有 updateSession/getSession，无 QA/Search 区分 |
| timeRefresh    | 不在 props 中传递                               |
| currentViewing | 不在 ref 中传递                                 |
| TypeScript     | tsc --noEmit 通过                            |
| 构建             | vite build 通过                              |

## 7. 重构后架构图

```
App.tsx
├── Header.tsx ──→ FavoritesPanel.tsx (内部 useTimeRefresh)
│
├── SearchModule ──→ HistorySidebar.tsx (内部 useTimeRefresh, viewingQuery 直接传递)
│
├── TranslateModule ──→ HistorySidebar.tsx (内部 useTimeRefresh, viewingQuery 直接传递)
│
└── DocModule ──→ HistorySidebar.tsx (内部 useTimeRefresh, viewingQuery 直接传递)

useHistory.ts (统一 API)
├── addHistory()
├── updateSession(type, query, messages)
├── getSession(type, query)
├── touchHistory(id)
├── removeHistory(id)
├── getHistoryByType(type)
└── clearHistory(type?)
```

## 8. 预期收益

| 指标          | 重构前          | 重构后         | 改善幅度 |
| ----------- | ------------ | ----------- | ---- |
| 修改历史记录 UI   | 需要修改 3-4 个文件 | 需要修改 1 个文件  | 75%+ |
| 新增模块接入      | 需要编写新组件      | 只需配置 config | 80%+ |
| props 传递链长度 | 3-4 层        | 0 层         | 100% |
| 代码行数（历史组件）  | \~300 行      | \~100 行     | 67%  |
| 维护难度        | 高            | 低           | 显著   |

