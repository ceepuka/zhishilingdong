# 文档约定

## 1. 文档总览

| 文件 | 路径 | 用途 | 优先级 |
|------|------|------|-------|
| **PRD** | `docs/prd.md` | 产品需求文档，定义核心功能和验收标准 | 最高 |
| **项目文档管理配置** | `docs/project-document-manager.md` | 文档同步规范、操作类型判断矩阵 | 最高 |
| **目标** | `docs/goal.md` | 项目总目标，一句话定位和核心价值 | 高 |
| **设计** | `docs/design.md` | 技术设计方案和架构说明 | 高 |
| **待办** | `docs/todo.md` | 当前开发任务和优先级 | 高 |
| **版本** | `docs/versions.md` | 版本里程碑和变更记录 | 中 |
| **历史** | `docs/history.md` | 项目演变历史 | 中 |
| **问题** | `docs/issues.md` | 问题追踪和风险记录 | 中 |
| **进度** | `docs/progress.md` | 项目进度追踪 | 中 |
| **工作日志** | `docs/worklog.md` | workflow-manager 执行步骤记录 | 中 |
| **工作流管理配置** | `docs/workflow-manager.md` | workflow-manager Skill 项目级执行规范 | 中 |
| **经验** | `docs/lessons/` | 错误教训和最佳实践 | 低 |
| **里程碑** | `docs/milestones/` | 里程碑与小目标 | 低 |
| **参考资料** | `docs/references/` | 设计参考与外部文档 | 低 |
| **外部文件** | `docs/external/` | 截图、需求文档等外部来源归档 | 低 |

## 2. 查阅优先级

### 提需求时 → 看 PRD
- **PRD (`docs/prd.md`)** 是**唯一的需求权威来源**
- 所有功能需求、优先级、验收标准以 PRD 为准
- 其他文档作为补充参考

### 开发时 → 看 Todo + Design
- **Todo (`docs/todo.md`)**：当前要做的任务
- **Design (`docs/design.md`)**：技术实现方案

### 文档同步时 → 看 project-document-manager.md
- **`docs/project-document-manager.md`**：定义操作类型判断矩阵、同步规则、文档清单
- 任何代码/文档变更后，按此文件规则触发同步

### 了解项目 → 看 Goal + History
- **Goal (`docs/goal.md`)**：一句话定位和核心价值
- **History (`docs/history.md`)**：项目演变过程

## 3. 文档更新规则

### 3.1 PRD 更新规则
- PRD 是**需求的唯一真实来源**（Single Source of Truth）
- 需求变更必须先更新 PRD
- PRD 更新后，必须同步更新：
  - `docs/goal.md`（目标和核心能力）
  - `docs/todo.md`（任务列表和优先级）
  - `docs/history.md`（变更记录）

### 3.2 其他文档更新规则
- **Goal**：仅记录项目级目标，不记录详细需求
- **Design**：记录技术实现方案，与 PRD 需求对应
- **Todo**：根据 PRD 优先级同步更新任务状态
- **Versions**：版本发布时更新里程碑
- **History**：每次重大变更后更新（按 `project-document-manager.md` 五段式格式）
- **Issues**：发现问题时记录，解决后关闭
- **Progress**：里程碑完成情况、版本进度、风险与技术债务追踪
- **Worklog**：workflow-manager 执行步骤记录（按任务类型分级）

### 3.3 文档同步触发规则
依据 `docs/project-document-manager.md`：
- 文件时间戳变化（`.manifest.json` 检测）→ 触发同步
- 用户手动修改项目文档 → 触发同步
- 用户发起新对话时检测自上次同步以来的所有文件变更
- 批量任务完成后统一检测并同步
- 琐碎改动（注释、格式化、变量重命名）不触发同步

## 4. 文档冲突处理

当多个文档内容不一致时，按以下优先级处理：

1. **代码实现** > 所有文档（代码是最终事实）
2. **PRD** > 其他所有文档（需求层面）
3. **Goal** > Design/Todo/Versions
4. **Design** > Todo（技术实现方案决定具体任务）
5. **project-document-manager.md** 定义同步规则，不参与内容冲突裁决

## 5. 命名规范

### 5.1 文档命名
- 使用小写英文，单词之间用连字符 `-`
- 示例：`prd.md`, `goal.md`, `todo.md`, `project-document-manager.md`

### 5.2 目录命名
- 使用小写英文，单词之间用连字符 `-`
- 示例：`docs/external/`, `docs/references/`, `docs/lessons/`, `docs/milestones/`

## 6. 外部文档

### 6.1 存放位置
- 外部来源的文档放在 `docs/external/`
- 设计方案参考文档放在 `docs/references/`

### 6.2 处理规则
- 外部文档仅作为参考，不纳入项目需求
- 如需将外部文档内容纳入需求，必须更新 PRD
- 外部文档变更不影响项目需求
- **不确定用途的外部文件不要擅自删除，应先归档并询问用户**

## 7. 版本号规范（强制）

> 制定于 2026-10-06。起因：一次发布里版本号被随意抬升（`1.7.2` → `1.8.0` → `1.9.0`），
> 把用户路线图里预留给「移动端适配」的 `1.8.0` 号段顶掉了。以下为硬约束。

### 7.1 语义（SemVer 严格）

| 段位 | 何时 +1 | 例 |
|------|---------|----|
| **MAJOR**（`X.0.0`） | 破坏性变更：数据格式不兼容、发布形态改变、用户需重新配置 | — |
| **MINOR**（`x.Y.0`） | **新增用户可感知的能力 / 模块 / 导出格式** | 移动端适配、新模块 |
| **PATCH**（`x.y.Z`） | **只修缺陷**：bug、样式、文案、性能；不新增能力入口 | 本次 `v1.7.3` |

- **纯修复绝不跳 MINOR**。一次发布若"几乎全是修复 + 顺带小改"，就是 PATCH。
- 判断不定时，**取更小的号**（宁可回头再加能力，也不要虚抬号段）。

### 7.2 一个版本 = 一个已发布的里程碑

- **未发布的改动不占号**。不要因为"打算发 1.8.0"就先把 `package.json` 改成 `1.8.0` ——
  一旦这个号最终没发或内容变了，号段就被污染。
- 版本号**只在真正发布时**改；改完当天就 tag + Release，不留"已占号未发布"的中间态。
- 同一天的多次改动**合并成一个版本**，不要一天发两个号。

### 7.3 六处版本号必须一致

发布时这六处必须完全相同，由 `node scripts/check-version.js` 在 `npm run release`
之前强制校验（不一致直接 fail）：

1. `package.json` 的 `version`
2. `package-lock.json` 顶层 `version`
3. `package-lock.json` 的 `packages[""].version`
4. `docs/versions.md` 里的 `## vX.Y.Z` 里程碑标题
5. `README.md` 版本表里的 `| vX.Y.Z | ... |` 行
6. `docs/todo.md` 版本表里的 `| vX.Y.Z | ... |` 行

外加 git tag 与 GitHub Release 名（`vX.Y.Z`）—— 由 `scripts/publish-release.mjs`
从 `package.json` 取值，天然对齐。

### 7.4 路线图预锁号

- 已经规划好的未来版本**先锁号**，写进 `docs/todo.md` 的 P0/P1，
  格式：`- [ ] 功能名 → 锁定版本号 \`vX.Y.0\``。
- 未开工不得占用该号段；已锁号的功能若取消，需在本节变更记录里显式注销。

**当前锁号**：`v1.8.0` = 响应式适配 / 移动端适配。

### 7.5 变更记录

| 日期 | 变更内容 | 作者 |
|------|---------|------|
| 2026-10-06 | 建立版本号规范；撤回误发的 `v1.9.0`（含 remote tag + Release），本日两批改动合并为 `v1.7.3`；锁定 `v1.8.0 = 移动端适配`；新增 `scripts/check-version.js` 接入 `npm run release` | AI助手 |

## 8. 变更记录

| 日期 | 变更内容 | 作者 |
|------|---------|------|
| 2026-09-15 | v1.7.0 正式发布里程碑：① 生成中断分类模型（`services/streaming/interruption.ts`，四类归因 + 标准 code + 续写策略）；② 续写从"仅模型超限"扩展到全链路中断（无内容时原 prompt 重发 1 次、硬上限 3）；③ `withFallback` strict 模式（生成类调用不再吞成"成功但空"）+ 传输层错误归类；④ `GenerationNotice` 按原因分档提示（搜索/文档共用）；⑤ 版权声明 + MIT LICENSE + 仓库清理。`design.md`(v1.5，新增 10.7/改写 10.2·10.3)/`history.md`/`worklog.md`/`progress.md`/`versions.md`/`todo.md`/`issues.md`/`README.md` 同步（277/277 全绿） | AI助手 |
| 2026-09-15 | m031 内容渲染一致性：① 抽出共享 `components/knowledge/KnowledgeContentView.tsx`（`MindMap`/`ExamQuestionCard`/`ConceptIllustration`/`normalizeGenerated`/`isGeneratedKnowledge`），搜索与收藏共用**唯一实现**，修掉"收藏不支持公式、不能展示思维导图"（根因是双实现漂移）；② 新增 `components/ui/MarkdownContent.tsx`（Markdown 结构 + `LatexText` 文本，`code`/`pre` 不解析公式），文档正文与收藏文档视图共用；③ 边界修复 6 处（格式判据误判致空白、思维导图脏数据白屏、`$$` 公式残留美元符号、列表预览裸露源码、收藏保存静默失败、去重口径不一致）；④ `useFavorites` 超配额降级保存 + 可见提示。`design.md`(v1.6，新增 10.8 + 更新目录结构/3.5 收藏模块)/`worklog.md`/`progress.md`/`todo.md`/`issues.md`/`README.md` 同步（305/305 全绿） | AI助手 |
| 2026-07-04 | 初始版本，建立文档约定 | AI助手 |
| 2026-09-11 | v1.6.1：预置型号全量修正（同步 PROVIDER_META / MODEL_DESC_EN / providerTemplates 三处）、生图服务配置入口、行内公式 `LatexText`、SVG 等比缩放与线宽钳制、流式首字延迟治理（清洗节流/思维链识别/等待计时/关闭思考）；`history.md`/`worklog.md`/`progress.md`/`design.md`(v1.3, 新增 10.5/10.6)/`versions.md` 同步 | AI助手 |
| 2026-08-04 | 文档清单补全：新增 `project-document-manager.md`、`worklog.md`、`workflow.md`、`progress.md`、`milestones/`、`references/`、`external/`；补充文档同步触发规则与冲突处理优先级 | AI助手 |
| 2026-08-04 | `workflow.md` → `workflow-manager.md`：按 workflow-manager Skill 最新模板创建项目级执行规范，替代旧 workflow.md；文档清单与查阅优先级同步更新 | AI助手 |
| 2026-09-10 | 全量文档同步至 v1.6.0：progress/goal/todo/issues/versions 状态与版本补齐；design/architecture 新增「多语言 i18n」「流式渲染与超限自动续写」章节并修正目录结构、深度预算、配图策略、翻译数据模型；README 重写；project-document-manager 关键约束更新（6 种卡片=死代码、新增 i18n/真流式两条） | AI助手 |
| 2026-09-11 | v1.6.1 流式两项修复同步：① 时序修复（`completedKeys` 补记容器型字段 + 总述门控解耦）；② 能力黑名单由 `Set` 永久禁用改为 `Map`+60s 冷却（自愈可达）+ 降级可观测 + 记账收敛协议层证据。`design.md`/`history.md`/`worklog.md`/`progress.md`/`versions.md`/`issues.md`/`lessons/` 同步 | AI助手 |
| 2026-09-11 | v1.6.1 AI 内容质量治理：① 公式统一渲染（双保险：prompt 置顶【公式书写规则】+ `splitBareLatex` 裸 LaTeX 识别 + `LatexText` 重组为统一入口）；② 试题配图三通道（`ExamQuestion.imageData` 直填 + 渲染 image/imageData > svg + 加载失败回退）；③ 严格图源白名单显式写入 prompt；④ SVG 规则新增"严格遵循学科制图惯例"+ 高风险学科细则。`design.md` §5.3.1 三通道改写、`§10.6` 公式统一渲染、`§4.6` `ExamQuestion` 增 `imageData?`，`history.md`/`worklog.md`/`progress.md`/`versions.md`/`issues.md`/`lessons/` 同步（29 条新用例，185/185 全绿） | AI助手 |
| 2026-09-12 | v1.6.2 流式链路健壮性 + 多厂商思考适配 + AI 内容质量：① 移除"黑名单-自愈"改为链路状态诚实处理 + 首字节超时 60s 兜底 + `withFallback` 链路错误透传；② 续写判定同源化（复用 `isCompleteJSON`）+ 核心字段齐全判定 + 续写轮边界加固；③ 空结果兜底（`hasUsableContent` 覆盖全字段 + 失败空状态卡片）；④ 关闭思考按厂商分派（智谱 `thinking:{type:'disabled'}`，修"智谱总是生成失败"）；⑤【严谨性铁律】+ 含"如图"试题约束防编造/瞎猜；⑥ SVG 规则由负面约束升级为正向画法教学 + 图源积极引用。`design.md`(新增 v1.4 变更说明)/`history.md`/`worklog.md`/`progress.md`/`versions.md`/`todo.md`/`issues.md`/`lessons/` 同步（210/210 全绿） | AI助手 |
