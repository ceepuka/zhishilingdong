# 知识灵动助手

AI驱动的知识可视化办公Web应用，以"知识可视化"为核心交互语言，整合知识搜索、词典翻译、文档生成三大核心功能。

## 功能特性

### 知识搜索
- 搜索输入 + 热门标签（预置示例）；搜索 / 问答双模式
- **真流式生成**：单次调用 `generateStream`，AI 边写、UI 边读共享缓冲区实时渲染（打字机效果）
- **自动续写（全链路中断）**：模型输出上限、网络中断、超时、协议错、网关静默截断都会自动接着写；一个字都没拿到时按原请求重发 1 次。`MAX_GENERATION_ATTEMPTS = 3` 为总请求次数硬上限（首轮 + 最多 2 次续写/重发）
- **中断归因提示**：内容未生成完时按**原因**分档提示（模型输出上限 / 网络中断 / 响应超时 / 安全策略拦截 / 提前结束），并显示是否已被自动续写补全——不再把网络中断误报成"输出上限"
- 核心概念（初等/高等双层解释 + 关键要点 + 易错提醒 + 配图）、概念总述
- 知识脉络（学习路径 → 前置/关联 → 易混辨析 → 常用结论）
- 经典试题（选择/填空/计算/问答，可点选判对错）、趣味知识
- 思维导图（两阶段递归布局、画布拖动）、知识目录（div 层级占位）
- 追问对话功能（与AI服务集成）
- 知识内容导出（Word / Markdown / TXT / HTML / PDF）+ 一键复制（**复制与导出同一来源**）

### 词典翻译
- 源/目标语言**双下拉** + 交换按钮（源含"自动检测"，目标默认跟随用户语言）
- 查词模式：音标、词性、释义、例句、同反义词、关联术语、常用搭配、语域、词源；支持短语/多词（≤10 关键词）
- 翻译模式：原文/译文**逐段对齐**、选词实时映射、风格切换（学术/商务/日常）、关键词、语法说明
- 输入上限与计数（查词 120 / 翻译 3000）
- TTS 朗读功能

### 文档生成
- 11 种文档类型：通用、商务邮件、报告大纲、会议纪要、PPT结构、学习笔记、合同、简历、新闻稿、项目方案、周报
- 语气选择：正式/友好/简洁
- Markdown 内容渲染 + 流式生成
- 多格式导出：TXT / Markdown / HTML / PDF

### 通用功能
- 收藏管理（多空间：默认/工作/学习，支持自定义新建、改名、换色、删除；详情与搜索页共用同一渲染实现 —— 公式、思维导图、配图、知识脉络、试题全部完整呈现）
- 历史记录（search / qa / dictionary / translate / doc 五种）
- 主题切换（亮色/深色）
- **复制与导出**：全部模块（搜索 / 查词 / 查句 / 问答 / 文档 / 收藏详情）统一入口，
  支持 Word（.docx）/ PDF / Markdown / TXT / HTML，**每个动作都有成功/失败反馈**
  （`file://` 下复制会静默失败，没有反馈等于按钮坏了）
- **多语言 UI（i18n）**：语言下拉，默认跟随系统；**AI 输出跟随用户语言**
- 多厂商 AI 配置（8 家预设 + 自定义厂商，密钥各自独立，存储于 LocalStorage）

## 技术栈

| 分类 | 技术 | 版本 |
|------|------|------|
| UI框架 | React | 18.2 |
| 类型系统 | TypeScript | 5.x |
| 样式方案 | Tailwind CSS | 3.x |
| 构建工具 | Vite | 5.x |
| 测试 | Vitest + Testing Library | 2.x / 14.x |
| AI服务 | OpenAI 兼容协议（8 家预设 + 用户自定义厂商） | - |
| 流式 | SSE（`stream:true`）+ 增量 JSON 解析 | - |
| 图标 | 内联 SVG（无第三方图标库） | - |
| 数学公式 | KaTeX | 0.16.x |
| Markdown渲染 | react-markdown + remark-gfm | 10.x / 4.x |
| Word导出 | JSZip + 手写 OOXML | 3.x |
| PDF导出 | 自研生成器（Canvas 位图页 + 隐形文字层，零第三方库） | - |

## 快速开始

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

访问 http://localhost:5173

### 测试

```bash
npm test          # vitest run（341 例 / 30 个测试文件）
npm run test:watch
```

### 发布构建

**本项目的正式发布形态只有一种：单文件 HTML。** 没有后端，不需要服务器，不需要云平台。

```bash
npm run release
# 类型检查 → 构建 → 内联 → 产出 release/ 下的发布包
```

产物写在 `release/`（**已 gitignore，不入库**）：

| 文件 | 说明 |
|------|------|
| `知识灵动助手.html` | 全部 JS / CSS / 字体以 base64 内联，双击打开即用，不需要 Node / 服务器 / 网络 |
| `使用说明.txt` | 随包说明，由构建脚本生成（体积、版本、构建日期与产物绑定） |

构建链路：`vite.standalone.config.ts` 构建到 `.tmp-standalone/`（中间产物）
→ `scripts/build-standalone.js` 压成一个 HTML 写入 `release/`（成品）。

**仓库只留源码**，成品作为 GitHub Release 附件分发 —— 这样每次发布不会在 git 历史里堆积同体积的二进制 blob。

> **只想用、不想构建？** 直接下 [最新 Release](https://github.com/ceepuka/zhishilingdong/releases/latest) 里的 `zhishilingdong-v<版本>.html`，双击即用。

发布到 Release：

```bash
GH_TOKEN=<你的 token> npm run release:publish
```

`scripts/publish-release.mjs` 会用 `package.json` 的 version 拼出 tag，创建或更新同名 Release 并挂上 `release/` 里的文件，可重复运行（同名附件先删后传）。token 需要 repo 权限；本机没装 `gh`，用 git 推送那份凭据即可（取法见脚本顶部注释）。

> **坑：GitHub 的 Release 附件名只接受 ASCII。** 传中文名不会报错，会被静默替换成 `default.html`（HTTP 200，只有去看附件列表才发现）。所以脚本做了映射：下载名用 `zhishilingdong-v<version>.html`，中文名放 `label` 供界面显示。

`file://` 下有两条普通构建过不去的限制，独立配置就是为绕开它们：

| 限制 | 不处理的后果 | 处理 |
|------|-------------|------|
| 动态 `import()` 走网络式加载 | 懒加载的库在 `file://` 下被 CORS 拦 → **功能点了没反应，且不报错**（历史上 jspdf 的 PDF 导出就是这样坏的） | `output.inlineDynamicImports: true` |
| 外部字体算跨源请求 | KaTeX 的 60 个字体文件全部加载失败 → **公式排版崩** | `assetsInlineLimit: Infinity` 内联为 base64 |

> **两条与 `file://` 直接相关的设计约束**（都是实测踩出来的，别当成风格偏好）：
>
> - **剪贴板必须降级**：`file://` 是非安全上下文，`navigator.clipboard` 整个是
>   `undefined`，裸调会抛 `TypeError`。统一走 `utils/clipboard.ts::copyText`
>   （Async Clipboard → `execCommand` → 返回 `failed`）
> - **Blob 下载的 URL 不能同步 revoke**：`a.click()` 后下载是异步启动的，
>   同步 `revokeObjectURL` 在 `file://` 下会取消下载。统一延后到下一帧

实测（真实浏览器）：`file://` 下 localStorage 可写可回读、Mock 模式零网络请求跑通全流程、
智谱 / 通义 / DeepSeek / Moonshot / 硅基流动的接口预检均放行，真实 AI 也能正常调用。

> 历史的 CDN 部署配置（`netlify.toml` / `vercel.json`）与本地静态服务（`server.js` / `start.bat`）
> 已于 2026-09-29 移除，发布形态统一为单文件 HTML。

## 项目结构

```
src/
├── components/        # UI组件
│   ├── cards/         # 知识卡片组件（6种，当前为死代码）
│   ├── favorites/     # 收藏面板（FavoritesPanel 为死代码）
│   ├── history/       # 历史侧边栏
│   ├── knowledge/     # 知识内容渲染（搜索/收藏共用的唯一实现 KnowledgeContentView）
│   ├── layout/        # 布局组件（Header/TabNav）
│   ├── settings/      # AI 配置面板（模型/密钥/添加厂商/模板/万相密钥）
│   └── ui/            # 通用UI组件（Button/Card/Input/Tag/ConfirmDialog/LatexText/MarkdownContent/GenerationNotice/SvgFigure/ImageFigure）
├── hooks/             # 自定义Hooks（HistoryContext/useAIConfig/useLanguage/useFavorites/useStrings/useTheme…）
├── i18n/              # 多语言字符串层（languages.ts + strings/）
├── modules/           # 业务模块
│   ├── search/        # 知识搜索模块（状态机、流式渲染、QAService）
│   ├── translate/     # 词典翻译模块
│   ├── doc/           # 文档生成模块
│   └── favorites/     # 收藏模块
├── services/          # AI服务
│   ├── aiServiceProvider.ts  # 动态路由（Mock/真实AI）
│   ├── baseAIProvider.ts     # Provider 抽象基类（prompt + 流式 + 续写 + 错误分层）
│   ├── providers/            # GenericAIProvider + 预设 overlay
│   ├── streaming/            # SSE 读取 + 增量 JSON 解析 + 中断分类（interruption.ts）
│   ├── commonsImage.ts       # 配图查询（Commons/维基双源）
│   ├── wanxImage.ts          # 通义万相文生图
│   └── mockAIService.ts      # Mock AI服务
├── types/             # TypeScript类型定义
├── utils/             # 工具函数（export/inlineSvg/jsonRepair/latex/preview）
├── App.tsx            # 应用入口
├── main.tsx           # 应用启动
└── styles/index.css   # 全局样式
```

## AI服务配置

1. 点击顶部导航栏的密钥图标打开配置面板
2. **模型选择**：选择厂商（8 家预设：智谱 AI / 阿里通义千问 / 硅基流动 / DeepSeek / Moonshot Kimi / OpenAI / Anthropic / Google Gemini）与型号
3. **密钥管理**：为当前厂商填入 API Key，保存时自动 Ping 验证（各厂商密钥独立保存）
4. **添加厂商**：可一键套用厂商模板或自定义名称/Base URL/型号
5. 配置自动保存到 LocalStorage；未配置密钥时自动启用 Mock 数据

## 项目文档

| 文件 | 描述 |
|------|------|
| [docs/prd.md](docs/prd.md) | 产品需求文档 |
| [docs/goal.md](docs/goal.md) | 项目总目标 |
| [docs/design.md](docs/design.md) | 技术设计文档 |
| [docs/architecture.md](docs/architecture.md) | 技术架构文档 |
| [docs/versions.md](docs/versions.md) | 版本里程碑 |
| [docs/progress.md](docs/progress.md) | 项目进度追踪 |
| [docs/todo.md](docs/todo.md) | 待办事项 |
| [docs/issues.md](docs/issues.md) | 问题追踪 |
| [docs/history.md](docs/history.md) | 演变历史 |
| [docs/worklog.md](docs/worklog.md) | 工作日志 |
| [docs/lessons/](docs/lessons/) | 经验教训库（按主题分文件） |
| [docs/convention.md](docs/convention.md) | 文档约定 |

## 版本历史

| 版本 | 日期 | 主要内容 |
|------|------|---------|
| v1.0.0 | 2026-07-05 | MVP核心能力 |
| v1.0.1 | 2026-07-05 | 搜索模块优化 |
| v1.0.2 | 2026-07-07~09 | 模块体验对齐 |
| v1.1.0 | - | 响应式适配（部分完成） |
| v1.2.0 | 2026-07-09 | AI服务抽象层+搜索状态机 |
| v1.3.0 | 2026-07-12 | 翻译风格切换+PDF导出 |
| v1.4.0 | 2026-07-11~14 | 真实AI集成+HistoryContext |
| v1.5.0 | 2026-09-06~09 | 内容增强+真流式+配图/题型/脉络增强 |
| v1.6.0 | 2026-09-10 | 多语言i18n+用户语言绑定+超限续写+查词翻译改造 |
| v1.6.1 | 2026-09-11 | 预置型号全量修正+行内公式渲染+万相密钥入口+流式首字延迟治理 |
| v1.6.2 | 2026-09-12 | 流式链路诚实化+首字节超时兜底+续写边界加固+思考模式适配 |
| v1.7.0 | 2026-09-15 | 版权声明 + MIT LICENSE + 生成中断分类 + 全链路续写 + 错误处理分层 + 分档提示 |
| v1.7.1 | 2026-09-29 | 发布形态定为单文件 HTML（产物挂 Release 附件）+ 中断提示归位内容末尾 + 尾部快照兜底 + 历史模块浏览登记重构 |
| v1.7.2 | 2026-09-30 | 查词/翻译接入统一续写链路（修 "Failed to parse JSON response"）+ 错误文案分档不上屏 + 词典/翻译关键词带释义与全入口跳转 + 翻译对照改 key 配对 + 演示数据补齐 |
| v1.7.3 | 2026-10-06~07 | **复制与导出全面修复**（补丁版，合并原 v1.8.0/v1.9.0 两批改动）：① 修"导出一半内容"（知识脉络/试题/趣味知识整段消失，根因是序列化双写）；② 新增 Word(.docx) 导出；③ **PDF 改自研生成器**（Canvas 位图页 + 隐形文字层，不嵌字体、不走打印，文字可复制/检索）；④ 公式降级补齐三条漏网通道（` ```latex ` 围栏块 / 无围符裸 LaTeX / 嵌套 `\frac`）；⑤ 剪贴板三级降级（`file://` 下裸调会抛错）+ 补齐查词与收藏详情入口 + 文件名清洗；⑥ 修 6 个隐藏缺陷（跨页共用同一张位图、横向画布被换回纵向、行盒外溢切字、字号单位不一致致标题缩到 0.375×、孤行标题、位图流多一个换行吃掉 JPEG 末字节）；⑦ **思维导图导出改为"从画布截图"**（PDF 导图页与 Word 附录页共用 `paintMindMap` 一份绘制源，Word 内嵌 PNG，截图失败退回缩进文字）；⑧ **Word 与 PDF 口径对齐**（首标题不再被降级成正文小字，`Title` 样式对齐 PDF；剥掉正文里重复的「思维导图结构」文字大纲）；⑨ **正文示意图可导出**（概念配图 / 试题配图：base64 直取字节、SVG 栅格化，PDF / Word / HTML 三出口共用一份采集；远程直链跨域拿不到时退化成图题，绝不静默丢）；产物 2.61 MB（**当前版本**） |

## 许可证

MIT License（详见 [LICENSE](LICENSE)）
