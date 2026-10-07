# 工作日志

## 项目概览

**项目名称**：知识灵动助手
**版本**：v1.7.3（单文件 HTML 公开发布版；`1.8.0` 号段按路线图锁定给「移动端适配」）
**状态**：开发期（产品未落地，无向后兼容负担）。v1.6.2 流式链路健壮性已落地；v1.7.0 完成「中断分类 → 全场景续写 → 分档提示」整体治理；m031 完成"收藏与搜索共用同一渲染实现"的内容一致性治理；m032 补齐概览（summary）与导出口径；m033~m040 完成历史"最后浏览时刻"单一基准与"浏览中"状态归属治理（含多标签页存储改造、关闭标签页兜底登记、旧构建误判根治，以及"离开那一刻的落盘不可靠"→ 进入基线 + 30s 心跳兜底）；m041 完成翻译对照 key 配对与词典/翻译关键词跳转；m042 完成查词/翻译接入统一续写链路（修 "Failed to parse JSON response"）与演示数据补齐；**m043~m047 完成导出层整体重做**（复制与导出同源、PDF 自研位图页+隐形文字层、导图改画布截图、Word/PDF 口径对齐、正文示意图可导出）与版本号规范（`docs/convention.md` §7 + `scripts/check-version.js` 发布门禁）；发布形态统一为单文件 HTML（tag `v1.7.3`）；6 种知识卡片为死代码待清理、响应式适配待做
**最后更新**：2026-10-07

## 工作总览

### 里程碑完成情况

| 里程碑 | 状态 | 完成日期 | 备注 |
|--------|------|---------|------|
| m001 - 整体框架与导航 | ✅ 完成 | 2026-07-05 | TabType: search/translate/doc/favorites |
| m002 - 知识搜索模块 | ✅ 完成 | 2026-07-05 | 含思维导图+概念+示例+试题+脉络+趣味 |
| m003 - 词典翻译模块 | ✅ 完成 | 2026-07-05 | 手动切换查词/翻译模式 |
| m004 - 文档生成模块 | ✅ 完成 | 2026-07-05 | 11种类型，Markdown渲染，PDF导出 |
| m005 - 可视化模块（函数图像） | ⛔ 已弃用 | - | 已从PRD移除，代码已于 2026-09-04 删除 |
| m006 - 算法动画模块 | ⛔ 已弃用 | - | 已从PRD移除，代码已于 2026-09-04 删除 |
| m007 - 对话功能模块 | ✅ 完成 | 2026-07-08 | 搜索追问 + 问答模式 |
| m008 - 收藏与历史模块 | ✅ 完成 | 2026-07-09 | 收藏空间+5种历史类型 |
| m009 - 主题与全局菜单 | ✅ 完成 | 2026-07-09 | 亮/深主题+语言切换+清空确认 |
| m010 - AI服务抽象层 | ✅ 完成 | 2026-07-09 | Mock+真实AI Provider |
| m011 - 搜索状态机 | ✅ 完成 | 2026-07-09 | 7状态状态机 |
| m012 - 知识目录占位 | ✅ 完成 | 2026-07-11 | div层级树，非SVG图谱 |
| m013 - 真实AI集成 | ✅ 完成 | 2026-07-11~14 | 智谱GLM；后续扩为多厂商路由 |
| m014 - 历史记录Context架构 | ✅ 完成 | 2026-07-11 | HistoryContext 替代 useState+key |
| m015 - 渐进式生成 | 🔁 已取代 | 2026-07-14 | 初期为 3 步 `generatePartial`；2026-09-09 改为真流式 `generateStream`（见 m016） |
| m016 - 真流式生成（生产者-消费者） | ✅ 完成 | 2026-09-09 | `StreamingJSONParser` + `callModelStream`；流式按链路状态诚实处理（不支持则走非流式，链路失败抛错透传） |
| m017 - 多语言 i18n 字符串层 | ✅ 完成 | 2026-09-10 | 英文作类型基准，UI 全量迁移，AI 输出跟随用户语言 |
| m018 - 生成超限自动续写 | ✅ 完成 | 2026-09-10 | 严格闭合判定（`{}`+`[]` 双括号），最多 3 次尝试，续写轮失败保留已生成内容 |
| m019 - 查词/翻译服务与 UI 改造 | ✅ 完成 | 2026-09-10 | 源/目标双下拉、逐段对齐、短语多词支持 |
| m020 - 预置型号全量修正 | ✅ 完成 | 2026-09-11 | 逐家核对官方目录；智谱切 GLM-5.x/4.7，Gemini 切 3.5，OpenAI 去 deprecated |
| m021 - 行内公式 + SVG 图示体验 | ✅ 完成 | 2026-09-11 | `LatexText` 接管行内公式；SVG 等比缩放不裁剪 + 线宽钳制 |
| m022 - 流式首字延迟治理 | ✅ 完成 | 2026-09-11 | 清洗节流 + 思维链识别 + 首字等待计时 + 关闭思考模式 |
| m023 - 流式能力黑名单治理 | 🔁 已取代 | 2026-09-11 | 曾为"永久禁用 → 60s 冷却自愈"；2026-09-12 彻底移除黑名单，改为链路状态诚实处理（见 m025） |
| m024 - AI 内容质量治理 | ✅ 完成 | 2026-09-11 | 公式统一渲染（双保险：prompt + 裸 LaTeX 识别 + 统一入口）+ 试题原图优先 + 学科制图规范 |
| m025 - 流式链路诚实化 + 续写边界加固 | ✅ 完成 | 2026-09-12 | 移除黑名单/降级重发，`withFallback` 链路错误透传；`hasCompleteJSONObject` 补 `[]` 追踪；续写轮空内容/异常保留已生成内容 |
| m026 - 流式健壮性 + 空结果兜底 | ✅ 完成 | 2026-09-12 | 首字节超时（60s）自动 abort + 友好提示；续写判定与解析层同源（`isCompleteJSON`）+ 核心字段齐全判定；`hasUsableContent` 覆盖全部实质字段 + 失败空状态卡片 |
| m027 - 多厂商思考适配 + AI 内容质量 | ✅ 完成 | 2026-09-12 | 关闭思考按厂商分派（智谱 `thinking:{type:'disabled'}`）；【严谨性铁律】+ 含"如图"约束防编造/瞎猜；SVG 规则升级为正向画法教学 + 图源积极引用 |
| m028 - 生成中断分类与全场景续写 | ✅ 完成 | 2026-09-15 | 明确区分模型侧/链路侧/内容侧/用户侧中断；续写从"仅模型超限"扩展到网络/超时/协议/静默截断；无内容时按原 prompt 重发 1 次；总请求数硬上限 3 |
| m029 - 错误处理分层与分档提示 | ✅ 完成 | 2026-09-15 | `withFallback` 增加 strict 模式（生成类调用不再吞成"成功但空"）；`GenerationNotice` 按原因分档横幅（搜索/文档共用）；`interruption` 字段全链路透出并入库 |
| m030 - 版权声明与仓库卫生 | ✅ 完成 | 2026-09-15 | 页脚版权声明（署名 GitHub: ceepuka）+ MIT `LICENSE` + README 全量纠错；`dist/` 停止被 git 追踪、清理可再生临时产物 |
| m031 - 收藏内容渲染一致性 | ✅ 完成 | 2026-09-15 | 抽出共享 `KnowledgeContentView`（搜索/收藏共用唯一实现）→ 收藏的公式/思维导图/配图/脉络/试题全部打通；修 6 处边界缺陷；文档正文接入 LaTeX 感知的 Markdown 渲染；收藏存储超配额降级保存并可见提示 |
| m032 - 收藏内容补全（概览归位） | ✅ 完成 | 2026-09-15 | 概览（summary）从搜索页外壳移入 `KnowledgeContentView` → 收藏详情不再缺 summary；导出（txt/md/html）补上概览，与「复制」口径一致 |
| m033 - 历史时间戳统一（最后浏览时刻） | ✅ 完成 | 2026-09-19 | `HistoryItem.lastViewedAt` 必填、创建时初始化为创建时刻，只在"浏览中"消失的一刻由共享 `HistorySidebar` 登记（cleanup 收敛全部离开路径，无轮询）；显示与排序均以 lastViewedAt 为唯一基准（显示 = now − lastViewedAt + 每秒走表时钟），旧数据加载时一次性迁移转换；散点 touch 与重复格式化实现全部收拢 |
| m034 - 中断提示衔接内容末尾（尾部快照兜底） | ✅ 完成 | 2026-09-20 | 修"内容已渲染却弹顶部红色解析失败横幅"：`generateStream` 尾部不可恢复时回退到最后一份可渲染快照（`finalSnap.data ?? lastRenderable`），不再报废整段内容；`GenerationNotice` 与错误提示在搜索/文档/收藏三个出口统一落到**内容末尾**；技术细节只进 `interruption.detail` |
| m035 - 退出应用页面登记最后浏览时刻 | ✅ 完成 | 2026-09-20 | 修"关闭标签页后 lastViewedAt 没刷新"的**第一版**（把登记挂在 `HistorySidebar` 上 + 补页面级监听）；用户复测仍不生效 → 被 m036 取代 |
| m036 - "浏览中"状态收归 Provider + 存储改单条键 | ✅ 完成 | 2026-09-20 | 根因是**归属错误**：登记寄生在侧栏（非"浏览中"状态所有者，收起仍挂载、关标签页不卸载）→ "退出应用页面"整类漏；存储整表一键 → 多标签页后写者赢。现改为：模块用 `useViewingHistory` 声明、**常驻 Provider 统一登记**（内容消失 + visibilitychange/pagehide/beforeunload/freeze，同步落盘）；存储**一条记录一个键**（写单条原子、删除即删除、`storage` 事件收敛） |
| m037 - 历史数据层改"磁盘真相" + 切模式即清内容 | ✅ 完成 | 2026-09-20 | 用户复测 m036 判定为负面并要求重构多标签页数据处理。重写数据层：**写前重读磁盘**（`readItem`/`mutate`）、`lastViewedAt` 取 max **单调不回退**、上限裁剪改**按磁盘排序**才删键、`(type,query)` 归并 + 跨标签页复用同一条记录、迁移加标记**一次性**（旧键不再复活已删条目）；顺带修 `freeze` 事件对象与"搜索切问答不清内容"（对齐翻译模块口径） |
| m038 - 关闭标签页兜底登记 + 翻译模块"浏览中"身份修正 | ✅ 完成 | 2026-09-20 | 用户追问"关标签页时 lastViewedAt 仍停在旧值，应在关闭过程中特别处理" + 要求评估重构性能。① **翻译模块 `viewingQuery` 取错**（从模型返回的 `word`/`original` 派生，与记录 query=用户输入 失配 → 该记录永远不被登记）→ 改显式 state 存**用户输入**；② Provider 留声明的**同步副本** `viewingDeclRef`，页面级离开在 id 解析不出时按 `(type,query)` **回磁盘兜底**（React 侧不兜底，避免"进入即登记"）；③ 性能实测：新布局单次登记 0.080ms vs 旧整表 7.260ms（快约 90 倍，且与记录数脱钩） |
| m039 - 旧 dist 构建导致的"关闭标签页不刷新" + 构建新鲜度自检 | ✅ 完成 | 2026-09-20 | 用户第三次报同一症状 → 改用**真实浏览器 + 页内探针**取证（劫持 `setItem` 逐笔记录写入 + 监听四类页面事件）。dev `:5173` 关标签页**确实写入**、三个模块 ✅；demo `:3000`（`start.bat`→`server.js` 服务 `dist/`）事件照来但**零写入** ❌。根因：`dist/` 最后构建于 **2026-09-10**，早于 m033，产物里**没有 `lastViewedAt`** —— m033~m038 的改动只在 `src/`，3000 上永远看不到。修复：重建 dist + `server.js` 加**构建新鲜度自检**（src 比 dist 新就告警）+ 全响应 `no-store` 防启发式缓存 |
| m040 - "关闭整个浏览器后 lastViewedAt 不刷新"真因 = 离开那一刻的落盘本身不可靠 | ✅ 完成 | 2026-09-20 | 用户不接受 m039 结论并指正"关闭 = 关掉整个应用页面/整个浏览器"、"问题必定在 lastViewedAt 的修改上"。两步 beacon 把"事件没来"和"处理函数没写"分开：关整个浏览器时 `beforeunload` 被跳过、其它事件都到，且应用**确实调了 `setItem`**，但重开后磁盘仍是旧值 —— 是这次写入**没落盘**（渲染进程紧接着被杀）。修复：不变式改为「磁盘值落后真实浏览时刻 ≤ 一个心跳周期」（`VIEWING_HEARTBEAT_MS=30s` + 进入即写基线 + 浏览期间心跳 + 离开写精确时刻，四处统一 `Math.max`） |
| m041 - 翻译对照改 key 配对 + 词典/翻译关键词带释义与跳转 | ✅ 完成 | 2026-09-30 | 对照模型由"按位置单调扫描"改为 **AI 填 `key`、前端按 key 配对**（语序相反时旧模型直接丢对照）；渲染只从 `original`/`translation` 切区间、绝不拼接 `segments`；关键词改 `{term, definition}` + 共享 `TermList` 渲染，查词模式三入口跳查词、翻译模式关键词跳查词/关联术语跳知识搜索；风格选择器前移到输入区 |
| m042 - 查词/翻译接入统一续写链路 + 演示数据补齐 | ✅ 完成 | 2026-09-30 | 用户实测报"跳转查词报 `Failed to parse JSON response`"：查词/翻译是**唯一还走非流式 `callModelWithJSON`** 的生成入口 → 新增 `generateJSONWithContinuation()` + `buildJSONKeysCompleteChecker()`，复用同一个续写循环（不另写第二套）；解析层技术描述不再上屏（`friendlyTranslateError`，删掉 catch 里的静默 mock 兜底）；`GenerationNotice` 挂到词条/翻译结果卡末尾。同步把 Mock 演示数据补齐：9 条短语词条、68 条词条全量 `collocations`/`relatedTerms`、10 条策展翻译语料（去占位垃圾）、未收录词的降级拆解释义；新增全量守卫测试 `mockLinks.test.ts`（354 个可点击目标 0 落空） |
| m043 - 复制与导出文件能力重构（修"导出一半内容"） | ✅ 完成 | 2026-10-06 | 导出链叠着六个问题，最严重的是知识脉络/试题/趣味知识**整段消失**。真因是**同一份 Markdown 被两份代码各写一遍**（`handleCopy` 手写拼接器 + `generateKnowledgeNote`）→ 删除手写实现、复制直接复用 `generateKnowledgeNote(data).md`；新增 `utils/clipboard.ts`（三级降级、永不抛）/`serialize.ts`/`knowledgeLabels.ts` 与 Word(.docx) 导出；**移除 jspdf**（内置字体全 latin-1，中文乱码） |
| m044 - 公式可读 + PDF 自研生成器（位图页 + 隐形文字层） | ✅ 完成 | 2026-10-06 | 修"公式没渲染、PDF 看不见"。公式三条漏网通道收进 `utils/latexToText.ts`；**推翻"改走浏览器打印"**（打印会栅格化 → 文字永不可复制），也否掉不嵌字体的矢量 CJK（Windows 无字形，inkRatio≈0.001 = 白纸）→ 自研 `canvasRenderer`+`exportPdf`+`pdfCore`（JPEG 作 `DCTDecode` XObject + `3 Tr` 隐形文字层，零第三方依赖）；顺带修 6 个隐藏缺陷（跨页共用位图、横向画布被换回纵向、行盒外溢切字、**字号单位不一致致标题缩到 0.375×**、孤行标题、位图流多一个换行吃掉 JPEG 末字节） |
| m045 - 思维导图导出改"从画布截图" | ✅ 完成 | 2026-10-06 | 按用户方案改，**PDF 导图页与 Word 附录页两个出口都改**。绘制收敛成 `paintMindMap()` 一份共用；Word 附录页由缩进文字改为内嵌 PNG（`w:drawing/wp:inline`）。关键认知：屏幕上的导图是 SVG + 绝对定位 DOM，所以"截图"= **离屏 canvas 按同一布局重绘**，不是截页面像素（免掉 html2canvas） |
| m046 - Word 与 PDF 口径对齐 + 正文示意图导出 | ✅ 完成 | 2026-10-07 | 用户逐项对照报三条。① 首标题不再被降级成正文小字（同文丢弃 / 异文保留 Heading1，`Title` 样式对齐 PDF）；② `stripMindMapSection` 在有附录页时剥掉正文里重复的导图文字大纲；③ 新增 `utils/exportFigures.ts` 采集层（`image`/`imageData`/`svg` 三字段原先在导出层**零引用**），PDF/Word/HTML 共用一份；Word 改统一 rId/media 分配器（旧实现硬编码 `rId3` 必然撞号）；顺带修 `svgWithIntrinsicSize` 子元素尺寸误判（320×200 被读成 240×150） |
| m047 - 版本号规范与发布门禁 | ✅ 完成 | 2026-10-07 | 用户反馈"版本号制定太随意"。新增 `docs/convention.md` §7（SemVer 语义 / 未发布不占号 / 六处一致 / 路线图预锁号 `v1.8.0 = 移动端适配`）+ `scripts/check-version.js` 接入 `npm run release` 前置门禁；撤回误发的 `v1.9.0`（tag + Release 均 204，复核 404）；本日四轮改动统一收进 `v1.7.3` —— 其中"正文示意图导出"单看是 MINOR，经用户拍板因属缺陷链收尾**一并收进补丁版**，记为唯一一次越界、不作先例 |
| - 6种知识卡片完整展示 | ⏸️ 未完成 | - | `src/components/cards/` 死代码，未接入主流程 |
| - 知识图谱导航（SVG） | ⏸️ 暂不考虑 | - | 当前不考虑开发 |

### 版本进度

```
v1.0.0 MVP ──────────────────────────────────────► ✅ 100%
v1.0.1 搜索模块优化 ─────────────────────────────► ✅ 100%
v1.0.2 体验优化与修复 ──────────────────────────► ✅ 100%
v1.1.0 响应式适配 ───────────────────────────────► ⚠️ 部分
v1.2.0 AI服务抽象层+搜索状态机 ─────────────────► ✅ 100%
v1.3.0 翻译风格切换+PDF导出 ────────────────────► ✅ 100%
v1.4.0 真实AI集成+HistoryContext ───────────────► ✅ 100%
v1.5.0 内容增强+真流式+配图/题型/脉络 ──────────► ✅ 100%
v1.6.0 多语言i18n+用户语言绑定+超限续写+查词改造 ► ✅ 100%
v1.6.1 预置模型修正+生图配置+公式/SVG/流式修复 ► ✅ 100%
v1.6.2 流式健壮性+多厂商思考适配+内容质量 ► ✅ 100%
v1.7.0 中断分类+全场景续写+错误分层+版权 ► ✅ 100%（正式发布）
m031 收藏渲染一致性+6处边界修复 ───────────────► ✅ 100%（v1.7.0 后）
m032 收藏内容补全（概览归位+导出对齐）─────────► ✅ 100%（v1.7.0 后，已提交）
m033 历史时间戳统一（lastViewedAt 单一基准）────► ✅ 100%（v1.7.0 后）
m034 中断提示衔接内容末尾 + 尾部快照兜底 ──────► ✅ 100%（v1.7.0 后）
m035 退出应用页面登记最后浏览时刻 ─────────────► 🔁 已被 m036 取代
m036 "浏览中"状态收归 Provider + 存储单条键 ───► ✅ 100%（v1.7.0 后）
m037 历史数据层改"磁盘真相" + 切模式即清内容 ─► ✅ 100%（v1.7.0 后）
m038 关标签页兜底登记 + 翻译"浏览中"身份修正 ► ✅ 100%（v1.7.0 后）
m039 旧 dist 构建误判 + 构建新鲜度自检 ────────► ✅ 100%（v1.7.0 后）
m040 离开时落盘不可靠 → 进入基线 + 心跳兜底 ───► ✅ 100%（v1.7.0 后）
m041 翻译对照 key 配对 + 关键词释义与跳转 ─────► ✅ 100%（已发 v1.7.2）
m042 查词/翻译接入统一续写 + 演示数据补齐 ─────► ✅ 100%（已发 v1.7.2）
v1.7.1 发布形态定单文件 HTML + 历史登记重构 ──► ✅ 100%（已发）
v1.7.2 Mock 数据补齐 + 查词/翻译接入续写 ─────► ✅ 100%（已发）
v1.7.3 复制与导出重构 + 公式/PDF 自研 + 口径对齐 + 示意图导出 ► ✅ 100%（已发；含 1 处已确认越界）
```

## 当前版本工作（v1.7.3）

**主线**：导出层整体重做 + 版本号规范（m043~m047 四轮）。

| 轮次 | 目标 | 结果 |
|---|---|---|
| 第 1 轮 | "复制和导出增强" | 查出导出链六个问题，最严重的是**导出丢三段内容**（知识脉络/试题/趣味知识）。真因是**序列化双写** → 复制与导出同源；新增 Word(.docx) 导出、`clipboard.ts` 三级降级；移除 jspdf |
| 第 2 轮 | "公式没渲染，pdf 看不见" | 公式三条漏网通道收进 `latexToText.ts`；**推翻"改走浏览器打印"**（打印必栅格化）→ 自研 PDF（位图页 + `3 Tr` 隐形文字层，零第三方依赖）；顺带修 6 个隐藏缺陷 |
| 第 3 轮 | 导图导出改"从画布截图"（用户方案） | `paintMindMap()` 一处绘制源，PDF 横向页与 Word 附录页共用；Word 附录页改内嵌 PNG |
| 第 4 轮 | Word 与 PDF 逐项对照 | 首标题不再降级成正文、剥掉重复的导图文字大纲、正文示意图可导出（新增 `exportFigures.ts`）；修 `svgWithIntrinsicSize` 尺寸误判 |

**验收**：`tsc --noEmit` 干净；vitest **529 例 / 40 文件全绿**；端到端在 `file://` 单文件产物里走真实导出路径、抓导出 Blob 字节核对（Word 4 图 4 关系、无悬空；PDF 4 页、`3 Tr` 70 处、文字可提取）；新增回归锁逐条反向验证过会红。

**详细技术说明**：`docs/versions.md` v1.7.3（含「附：复制与导出文件能力重构」）、`docs/design.md` §10.9、`docs/architecture.md` §16。

## v1.7.0 版本工作明细（已完成，保留备查）

### 已完成任务

**生成中断分类模型（新）**
- ✅ `services/streaming/interruption.ts`：`InterruptionKind`（length / content_filter / incomplete / timeout / network / protocol / http / aborted / parse）× `InterruptionSide`（model / link / content / user）
- ✅ `classifyThrown()` 异常归一（绝不返回"无原因"）、`kindFromFinishReason()`、`canContinueAfter()` 续写策略、`interruptionFromCode()` 反向还原、`GenerationInterruptedError`（带分类与已生成内容的异常）
- ✅ `sseReader` 新增 `StreamNetworkError`（fetch/body 传输层失败）与 `StreamAbortedError`（用户取消），与 timeout/protocol 四类分开；`callModel` 新增 `fetchOrThrow()`，裸 `TypeError: Failed to fetch` 不再伪装成业务错误
- ✅ `finishReason` 逐层透出（sseReader → callModelStream → 续写循环），据此区分「模型上限」「安全策略拦截」「网关静默截断」

**续写策略扩展到全链路（新）**
- ✅ `callModelStreamWithContinuation` 重写为中断分类驱动：链路类中断（network / timeout / protocol）与模型超限**同样续写**，不再首轮直接终止
- ✅ 无任何内容时按**原 prompt 重发** 1 次（瞬时抖动自愈）；有内容则回填续写
- ✅ 总请求数硬上限 `MAX_GENERATION_ATTEMPTS=3` 不变（绝不无限重试）；content_filter / aborted / 非 JSON 内容不重试
- ✅ 返回结构化 `interruption`（kind / side / attempts / continued / resolved）
- ✅ 修复真实边界 bug：catch 分支曾用"本轮开始前"的过期快照判断有无内容 → 重发轮已收到的内容会被整段丢掉（新增回归测试锁定）

**错误处理分层（新）**
- ✅ `withFallback` 新增 `strict` 模式：生成类调用（search generate/generateStream/followupStream、doc generate/generateStream）异常一律 `success:false + code`，不再返回 `success:true + 空数据`（这正是"内容被丢弃、页面空白、零提示"的根因）
- ✅ HTTP 错误（401 / 额度 / 限流 / 5xx）带 `aiError` 透传，不再被静默降级成兜底数据
- ✅ 状态机 `toFriendlyError` 覆盖全部中断 code；失败但已有内容时保留内容并挂上归因

**提示按原因分档（新）**
- ✅ `components/ui/GenerationNotice.tsx`：按 `side` 配色、按 `kind` 取文案，标注自动续写次数；兼容旧历史数据（只有 `truncated`/`continued` 布尔）
- ✅ 搜索与文档模块共用；文档模块此前**完全没接**截断标记（用户只能看到半截正文且零提示）
- ✅ i18n 新增分档提示 + 8 条错误文案（中英同步）

**版权与仓库卫生**
- ✅ 页脚版权声明（`© 2026 ceepuka · All rights reserved`，署名链 GitHub）+ MIT `LICENSE`
- ✅ README 全量纠错 10 处；`git rm -r --cached dist`（64 个构建产物出索引）+ 清理 ≈5.9 MB 可再生临时产物

### 未完成任务

**多语言（i18n）字符串层**
- ✅ 新建 `src/i18n/strings/`，按功能区拆 `common/settings/search/translate/misc/aiProviderTexts/docTemplates`
- ✅ 英文作类型基准（`xxxEn` → `typeof` 派生类型 → `xxxZh: XxxStrings`），中文漏 key 立即 tsc 报错
- ✅ 运行时 `deepMerge(STRINGS_EN, {...Zh})` 缺 key 回退英文，不崩
- ✅ 取值入口统一：React 用 `useStrings()`，非 React 用 `getCurrentStrings()`，占位符用 `fmt()`
- ✅ 数据层不迁 i18n：厂商名/模型描述/文档模板正文由 `aiProviderTexts.ts` / `docTemplates.ts` 做英文覆盖
- ✅ UI 全量迁移：Header/TabNav/ConfirmDialog、设置面板、搜索模块、词典翻译、文档模块、收藏、HistorySidebar、`utils/export.ts`

**用户语言基础设施**
- ✅ `src/i18n/languages.ts`：全应用唯一语言目录（code/native/zhName/english/speech），`normalizeLanguage` 兼容旧格式
- ✅ `src/hooks/useLanguageStore.ts`：纯存储层（subscribe/emit），存标准 `LanguageCode`，默认跟随 `navigator.language`
- ✅ `useLanguage.ts` 重写为 `useSyncExternalStore`，Header 语言区改下拉
- ✅ AI 输出绑定用户语言：`buildLanguageDirective()` 每次组装 prompt 实时读语言，JSON 字段名/枚举值保持英文

**超限自动续写（最多 3 次）**
- ✅ `hasCompleteJSONObject(raw)`：严格判定顶层 JSON 是否闭合，不做修复（避免截断被补成合法而漏续写）
- ✅ `callModelStreamWithContinuation(...)`：首轮 1 次 + 续写 ≤2 次，回填尾部长内容要求"只输出续写"
- ✅ 已接入 `search.generateStream` / `followupStream` / `document.generateStream`
- ✅ `continued` 标记 + SearchResults 青绿色"已自动续写并补全"提示
- ✅ **2026-09-12 边界加固**：`hasCompleteJSONObject` 补 `[]` 追踪（修复 `{"a":[1,2}` 数组未闭合被误判完整、跳过续写的漏洞）；续写轮返回空内容或抛链路错误时保留已生成内容并提前结束（不空转、不丢尾巴）

**查词翻译服务与 UI 改造**
- ✅ `detect` 改为只检测源语言（`{sourceLang, isPhrase, confidence}`）
- ✅ `queryWord` 支持短语/多词，返回最多 10 个 `keywords`
- ✅ `queryTranslate` 返回逐段对齐 `segments[]` + `sourceLang/targetLang`
- ✅ `TranslateInput` 源/目标双下拉、交换按钮、输入上限（查词 120 / 翻译 3000）
- ✅ `SentenceResult` 选词实时映射（hover 优先于 pinned），对齐不完整时追加剩余文本防丢字

**流式渲染时序修复（09-11）**
- ✅ `StreamingJSONParser.scan()` 修复：容器型（数组/对象）顶层字段在流式中间态从未进入 `completedKeys`（只在字符串/字面量收尾时登记）→ 步骤指示从第二个字段起永久卡在 `mindMap`
- ✅ `SearchResults`：「总述」移出 `concepts.length > 0` 门控（产出顺序是总述先于概念列表）→ 总述不再"等概念列表出现才一起蹦出来"
- ✅ `modules/search/index.tsx`：首字前占位文案不再写死"正在生成知识导图"，改中性文案；接管首字等待计时器（原所在分支不可达）
- ✅ 新增回归测试 6 条：解析器中间态 3 条 + 组件渲染时序 3 条（修复前为红，可复现）

**v1.5.0 内容增强（09-06 落地 + 09-09 收尾）**
- ✅ 核心概念双层结构（初等/高等）+ conceptsOverview 总述 + 概念示例解耦独立卡片
- ✅ `Concept.keyPoints`（关键要点）/ `pitfalls`（易错提醒）；`KnowledgeContext.confusables`（易混辨析）
- ✅ 知识脉络改四段式（学习路径→前置/关联→易混辨析→常用结论）
- ✅ `sanitizeExamQuestions` 重写：题型中英别名映射、题型反推、选项归一化、答案收敛字母
- ✅ 配图策略定稿：`svg`（内联）+ `image`（模型自判来源），Commons/维基双源兜底
- ✅ 思维导图公式溢出修复（`estimateTextWidthEm` 按字符类分档估宽）
- ✅ 自定义厂商模板（8 套）+ 真实 AI 链路四问题修复（截断透出/LaTeX 渲染/厂商模型 ID/图片兜底）

**流式时序与降级策略（2026-09-11 两轮 + 2026-09-12 链路诚实化）**
- ✅ 流式中间态契约：`scan()` 在容器闭合弹栈后补记顶层字段完成（`completedKeys` 不再漏数组/对象型字段），步骤指示按真实产出顺序推进
- ✅ 「总述」门控解耦：`conceptsOverview` 与 `concepts` 各自独立门控，不再被概念列表隐形延迟
- ✅ 首字前占位改中性文案 + 接管不可达的 `WaitTimer` 首字等待计时
- ✅ **流式链路诚实化（2026-09-12）**：彻底移除"黑名单-自愈"隐式全局状态（`streamUnsupported` Map + 冷却计时），改为**不猜测、不打补丁、拿到什么链路状态就诚实处理什么**；传输层/协议/首字节超时一律抛错透传（不再降级重发），`withFallback` 识别链路错误以 `success:false + code` 透传给 UI（此前超时会被静默吞成"生成失败"）
- ✅ 降级可观测：走非流式分支、链路错误均 `console.warn`
- ✅ 回归测试：解析器中间态 3 条 + 组件渲染时序 3 条 + 链路错误透传契约 5 条 + 续写边界 4 条

**AI 内容质量治理（2026-09-11）**
- ✅ **公式统一渲染（双保险）**：`utils/latex.ts` 新增 `splitBareLatex()`（强信号 = 反斜杠命令或带花括号上下标，必须 KaTeX 解析成功才渲染，失败回退原文）；`LatexText` 重组为**统一渲染入口**，覆盖全部 AI 文本字段（keyPoints / pitfalls / learningPath / confusables / mindMap 节点标题·描述 / 概念标题 / 趣事标题 / 标签 chip / 试题题干·选项·答案·解析）
- ✅ **prompt 源头加固**：`buildGeneratePrompt` 置顶【公式书写规则】，要求所有数学符号一律 `$...$` 包裹（含正反例）
- ✅ **试题配图三通道**：`ExamQuestion` 新增 `imageData`（base64 直填，限 png/jpeg/gif/webp 且 <4MB）；渲染优先级 image / imageData > svg，加载失败自动回退 SVG
- ✅ **严格图源白名单**：prompt 把可信图源域名（upload.wikimedia.org / commons.wikimedia.org / cdn.kastatic.org 等）**显式写出**，AI 不再凭印象给链
- ✅ **学科制图惯例**：规则新增"必须严格遵循该学科制图惯例"+ 高风险学科细则（数学几何对边 a/b/c、物理受力箭头·法线·标准元件、化学键角）
- ✅ 回归测试：splitBareLatex 9 条 + LatexText 组件 7 条 + searchResultsLatex 4 条 + examQuestions imageData 4 条 + 提示词契约 5 条（共 185 用例全绿）

**流式健壮性与空结果兜底（2026-09-12）**
- ✅ **首字节超时**：`sseReader.readSSEStream` 新增 `firstByteTimeoutMs`（默认 60s）+ `StreamTimeoutError`，到点 `reader.cancel()` 抛错；**收到任意字节（含思维链）即 `clearTimeout`** 避免误杀慢速流；UI 提示"等待模型响应超时，请检查网络或尝试其他模型"（修「已等待 511 秒」卡死）
- ✅ **`withFallback` 链路错误透传**：识别 `StreamTimeoutError`/`StreamProtocolError` → `success:false + code(STREAM_TIMEOUT/STREAM_PROTOCOL)`，修复"超时被静默吞成笼统生成失败"（此前状态机的超时识别是走不到的死代码）；状态机 `toFriendlyError` 统一映射
- ✅ **续写判定同源化**：`hasCompleteJSONObject` 复用解析层权威判定 `isCompleteJSON`（消除双写、天然正确处理 `{}`/`[]` + 转义 + 围栏）；新增 `buildGenerateCompleteChecker()`——续写升级为「括号闭合 **且** 核心字段齐全」
- ✅ **续写轮边界**：空内容即 break（不空转）；抛链路错误时 catch 保留已累积内容（不丢尾巴，首轮异常仍上抛）
- ✅ **空结果兜底**：`hasUsableContent` 扩展覆盖全部实质字段；`runGenerate` 全空显式写 `error`；`SearchContainer` 新增失败空状态卡片（`generateFailedEmpty`）
- ✅ 回归测试：首字节超时 4 + 链路错误透传 5 + 续写边界 10 + 解析判定 3 + 状态机空结果 3

**多厂商思考适配与 AI 内容质量（2026-09-12）**
- ✅ **关闭思考按厂商分派**：`THINKING_PARAM_PROVIDERS` → `DISABLE_THINKING_PARAMS`（`Record<厂商,参数>`）——dashscope/siliconflow 发 `enable_thinking:false`，**zhipu 发 `thinking:{type:'disabled'}`**（传 `thinking:false` 会 400）；修「智谱总是生成失败」（思维链吃掉 `max_tokens` 预算致正文截断）
- ✅ 智谱 `glm-5.2/5.1/4.7/4.7-flash` 与千问 DashScope Qwen3 全系列 `capabilities.reasoning` → `true`
- ✅ **【严谨性铁律】**（prompt 最高优先级）：答案必须可验证（不确定→`examQuestions:[]`）、解析必须自洽、不准出现自我怀疑措辞、绝不编造年份/考试名/图片数据
- ✅ **【含"如图"的试题约束】** + `imageData` 说明强化（纯文本模型严禁填入、绝不编造 base64）
- ✅ **SVG 规则升级为正向画法教学**：通用骨架 + 数学几何 / 函数图象 / 电路 / 受力分析 / 光学，按学科给可执行绘图步骤（不再只有"别画错"的负面限制）
- ✅ **`image` 字段积极引用**：改为"可信图源直链，优先于手绘 SVG"，引导按 Wikimedia Commons 规范文件名拼 `upload.wikimedia.org` 直链
- ✅ 回归测试：关闭思考分派 5 + 提示词契约 2 + SVG 契约断言更新

### 未完成任务
- ⏸️ 6种知识卡片完整展示（流程/对比/层级/时间轴/公式）- `src/components/cards/` 为死代码，待接入主流程或按开发期策略删除
- ⏸️ 响应式适配优化（移动端）
- ⏸️ 内容质量进一步优化设计（内容深度、准确性、来源可靠性）

### 暂不考虑
- ⏸️ 知识图谱导航（SVG）- 当前不考虑开发
- ✅ 算法动画 - 已弃用，代码已于 2026-09-04 删除
- ✅ 动态可视化（函数图像）- 已弃用，代码已于 2026-09-04 删除（echarts 依赖一并移除）

## 待办工作优先级

| 优先级 | 任务 | 预估工时 | 依赖 |
|--------|------|---------|------|
| P0 | 6种知识卡片死代码处理（接入主流程 或 直接删除） | 决策 | 用户决策 |
| P0 | 响应式适配优化（移动端） | 6h | 无 |
| P1 | 内容质量进一步优化设计（深度/准确性/来源） | 8h | AI prompt |
| P1 | 知识图谱导航重新评估 | - | 用户决策 |
| P2 | 收藏标签管理 | 4h | 无 |
| P2 | 收藏内搜索 | 4h | 无 |
| P2 | 关联知识推荐（翻译模块） | 4h | 无 |

## 近期工作记录

### 2026-10-06 ~ 10-07（v1.7.3：导出层整体重做 + 版本号规范）

| 时间 | 任务 | 状态 | 备注 |
|------|------|------|------|
| 10-06 | 诊断：导出文件丢一半内容 | ✅ 完成 | 页面上有、导出没有的三段（知识脉络/试题/趣味知识）；根因是 `handleCopy` 与 `generateKnowledgeNote` **两份代码各写一遍**同一份 Markdown |
| 10-06 | m043 复制与导出同源 | ✅ 完成 | 删除手写拼接器，`handleCopy` 直接取 `generateKnowledgeNote(data).md`；新增 `serialize.ts`/`knowledgeLabels.ts`/`clipboard.ts`；新增 Word(.docx) 导出（JSZip + 手写 OOXML）；**移除 jspdf**（内置字体全 latin-1，中文乱码） |
| 10-06 | 诊断：公式没渲染 + PDF 看不见 | ✅ 完成 | 两条症状两个根因；PDF 那条要**推翻上一版"改走浏览器打印"**——打印对话框把页面栅格化，位图 PDF 的文字永不可复制（实测 6 页/文本长度 0） |
| 10-06 | PDF 方案三次取舍 | ✅ 完成 | 打印 ❌ → 不嵌字体矢量 CJK ❌（Windows 无该字形，inkRatio≈0.001 = 白纸）→ ✅ **位图页 + `3 Tr` 隐形文字层**（`canvasRenderer`+`exportPdf`+`pdfCore`，零第三方依赖） |
| 10-06 | m044 公式降级三通道补漏 | ✅ 完成 | ` ```latex ` 围栏块 / **无围符裸 LaTeX** / 嵌套 `\frac`；唯一实现 `utils/latexToText.ts`；保守原则：不确定是公式的散文里不动花括号 |
| 10-06 | m044 顺带修 6 个隐藏缺陷 | ✅ 完成 | 跨页共用同一张位图、导图页画在纵向画布、行盒外溢切字、**字号单位不一致（排版 pt / 绘制 px → 标题缩到 0.375×）**、孤行标题、位图流多一个换行吃掉 JPEG 末字节 |
| 10-06 | m045 导图导出改"从画布截图" | ✅ 完成 | 采纳用户方案，**PDF 导图页 + Word 附录页都改**；`paintMindMap()` 唯一绘制源；关键认知：页面导图是 SVG + 绝对定位 DOM，"截图"= 离屏 canvas 按同一布局重绘（免掉 html2canvas） |
| 10-06 | 版本号治理（用户反馈"太随意"） | ✅ 完成 | 新增 `docs/convention.md` §7 + `scripts/check-version.js` 发布门禁；撤回误发的 `v1.9.0`（tag + Release 均 204）；四轮改动统一收进 `v1.7.3`，`1.8.0` 归还移动端 |
| 10-07 | 用户第二轮实测：Word vs PDF 三条不足 | ✅ 完成 | 首标题格式不一致 / 多了冗余内容 / 所有文档丢示意图 |
| 10-07 | m046 口径对齐 + 示意图导出 | ✅ 完成 | 首标题同文丢弃·异文保留 Heading1 + `Title` 样式对齐 PDF；`stripMindMapSection` 剥掉重复的导图大纲；新增 `utils/exportFigures.ts` 采集层（三字段原先零引用）、Word 统一 rId/media 分配器；修 `svgWithIntrinsicSize` 子元素尺寸误判 |
| 10-07 | 验证 + 文档同步 | ✅ 完成 | tsc 干净、vitest 529 例/40 文件全绿、端到端抓 Blob 字节核对；versions/history/issues/todo/README/convention/design/architecture/worklog/progress 全部同步 |

### 2026-09-20（m034 中断提示衔接内容末尾 + m035~m040 最后浏览时刻登记、存储改造、旧构建误判与落盘可靠性）

| 时间 | 任务 | 状态 | 备注 |
|------|------|------|------|
| 09-20 | 诊断：内容已渲染却弹"未解析出有效 JSON"顶部横幅 | ✅ 完成 | 根因：续写轮把第二份 JSON 追加在第一轮文本后 → 整段不再合法 → `finish()` 返回 `null`；旧代码只看 `finish()`，把**已渲染的**内容一并判成失败 |
| 09-20 | 尾部快照兜底 | ✅ 完成 | `generateStream` 记录 `lastRenderable`，判定改 `finalSnap.data ?? lastRenderable`；仅"零可渲染快照"才抛 parse 中断；兜底时打 `truncated` + `incomplete`（内容侧归因） |
| 09-20 | 提示位置统一到内容末尾 | ✅ 完成 | `KnowledgeContentView` / `DocResult` / 收藏文档详情三处 `GenerationNotice` 移到内容末尾；`SearchContainer` 删顶部横幅（无内容时原因进空状态卡） |
| 09-20 | 用户可见文案与诊断信息分离 | ✅ 完成 | 失败但已有内容 → `error: undefined`，理由由内容末尾中断提示承载；`GENERATE_FAILED` 走通用文案，技术细节只进 `interruption.detail` |
| 09-20 | 历史时间戳模型收敛 | ✅ 完成 | `lastViewedAt` 必填 + 创建时初始化；排序与显示均以它为唯一基准；旧数据加载时一次性迁移 |
| 09-20 | 诊断：退出应用页面后 lastViewedAt 未刷新 | ✅ 完成 | 两个缺口叠加：① 唯一 touch 点是 effect cleanup，而关标签页/刷新/切后台时 React **不卸载组件** → 永不触发；② 落盘靠 effect，卸载时同样不跑 → 只 setState 必丢 |
| 09-20 | m035 页面级离开接入同一登记入口（已废弃） | 🔁 已取代 | `HistorySidebar` 加 `visibilitychange(hidden)` + `pagehide` → 复用 cleanup 的 `flushViewing()`；`touchHistory` 改**同步落盘** + 抽出 `applyTouch`。挂错位置，被 m036 取代 |
| 09-20 | 补测试（m034+m035） | ✅ 完成 | 新增 `generateStreamPartial.test.ts`（3 例）、历史侧栏 4 例；改写状态机半截超时 / 未分类异常 2 例契约 |
| 09-20 | 反向验证（m034+m035） | ✅ 完成 | 注掉同步落盘 → 仅"同步落盘"一例红；注掉页面监听 → 3 条登记用例红、"无浏览中"保持绿（证明测试真锁得住回归） |
| 09-20 | 验证（m034+m035） | ✅ 完成 | tsc 零错误；vitest **27 文件 / 324 用例全绿** |
| 09-20 | 用户复测 m035 → 仍不生效 | ✅ 完成 | 关标签页后 lastViewedAt 依旧不刷新；用户指正："浏览中"应单独处理、内容消失必须走卸载路径，且多标签页是整表覆盖写 |
| 09-20 | 根因：归属错误 + 存储整表键 | ✅ 完成 | ① 登记寄生在 `HistorySidebar`——它不是"浏览中"状态所有者（收起仍挂载、关标签页不卸载）→ "退出应用页面"整类漏；② 历史存整表一个键 → 每次写入重写全部记录，后写标签页用旧快照盖掉别家 → 多标签页后写者赢 |
| 09-20 | m036 重构："浏览中"收归 Provider | ✅ 完成 | 新增 `useViewingHistory(type, query)` 声明式 hook：模块只声明"在看哪一条"，登记时机全由常驻 `HistoryProvider` 负责（内容消失 / 声明变化 / 卸载 + `visibilitychange→hidden` / `pagehide` / `beforeunload` / `freeze`，**同步落盘**，不等 React 提交）；侧栏退回纯展示 |
| 09-20 | m036 存储改单条键 | ✅ 完成 | `…history:<id>` 一条记录一个键：写单条原子、删除即 `removeItem`、外部改动经 `storage` 事件收敛；旧整表键首次加载摊平后删除（否则删掉的条目会被旧副本复活） |
| 09-20 | 清理散写 touch | ✅ 完成 | 删掉 4 处指向不存在 id 的 `touchHistory`（`dict-<ts>` vs 条目 id `dictionary-<ts>`）；`useSearchMode` 首条消息路径同样删除 |
| 09-20 | 补测试（m036） | ✅ 完成 | 新增 `historyViewing.test.tsx`（13 例：登记时机 + 多标签页单条原子/外部增删改采纳）；`historySidebar.test.tsx` 重写为纯展示 + 排序 + 旧数据迁移 |
| 09-20 | 反向验证（m036） | ✅ 完成 | 注掉页面级监听 → 恰好 pagehide / beforeunload / 事件回调内落盘 3 例红、visibilitychange 保持绿（信号精确锁定，非整片红） |
| 09-20 | 验证（m036） | ✅ 完成 | tsc 零错误；vitest **28 文件 / 331 用例全绿**；dev server 编译 5 个改动模块通过 |
| 09-20 | 用户复测 m036 → 判定负面 + 决定重构多标签页数据层 | ✅ 完成 | 症状：搜索切问答不清"浏览中"内容、切回仍是"浏览中"；多标签页"两边历史各看各的"；关标签页时间仍不刷新 |
| 09-20 | 查证：模式切换问题**非 m036 引入** | ✅ 完成 | `switchMode` 自 initial commit 起就只清问答消息、反向不清搜索内容，m036 diff 未动该行；`git log -S"handleModeChange"` 为空。但翻译模块一直是"切模式即清结果"，搜索模块是唯一例外 |
| 09-20 | 定位"没解决问题"的真因 | ✅ 完成 | 存储布局变更后，改造前已打开的旧标签页仍在写整表键、跑旧逻辑 → 两边互相看不见，旧标签页里必是旧行为。改布局的代价，提示不到位 |
| 09-20 | m037 数据层确立"磁盘是真相" | ✅ 完成 | `readItem()` 写前重读 + `mutate()` 以磁盘最新副本读改写；`lastViewedAt` 取 `max` **单调不回退**（关标签页登记的时间不会被写旧） |
| 09-20 | m037 上限裁剪按磁盘口径 | ✅ 完成 | `commit()` 不再删内存排序的尾巴 → `trimDisk()` **按磁盘排序**才删键，且仅内存超限时触发（这是真实数据丢失缺陷） |
| 09-20 | m037 跨标签页身份统一 | ✅ 完成 | `dedupe()` 加载时按 `(type, query)` 归并重复记录；`findByQuery()` 内存未命中时扫磁盘 → 两标签页为同一主题生成时**复用同一条记录**，不再造重复条目 |
| 09-20 | m037 迁移改一次性 | ✅ 完成 | 加 `SCHEMA_KEY` 版本标记，写好后永不再读旧整表键 → 旧代码标签页写回的快照不会让已删除条目复活 |
| 09-20 | m037 修"切模式不清内容" | ✅ 完成 | `SearchModule` 加 `if (mode === 'qa') reset()`，对齐翻译模块口径；内容已落历史、点条目可恢复 |
| 09-20 | 顺手修 | ✅ 完成 | `freeze` 是 **document 事件**（此前挂 window 永不触发）；`addHistory` 新建 id 加随机后缀防同毫秒撞键；`sseReaderTimeout` 的 `elapsedMs >= 30` 偶发红改为量级区间断言 |
| 09-20 | 补测试（m037） | ✅ 完成 | 新增 `searchModeSwitch.test.tsx`（2 例，真实渲染模块）、`historyMultiTab.test.tsx`（5 例：磁盘真相写入/跨页复用/磁盘口径裁剪/迁移一次性/首次迁移） |
| 09-20 | 反向验证（m037） | ✅ 完成 | 注掉切模式清内容 → 恰好卡在"切回搜索仍是浏览中"；去掉 `Math.max` → 关标签页登记写回本页旧时间（1000 vs 磁盘 1789877428054）→ 立刻红。均已恢复 |
| 09-20 | 验证（m037） | ✅ 完成 | tsc 零错误；vitest **30 文件 / 338 用例全绿** |
| 09-20 | 用户追问：重构的性能代价 + 关标签页仍停在旧值 | ✅ 完成 | "页面正在浏览内容时，关闭标签页，那个最后浏览时间仍是旧值……应该放在关闭过程中特别处理" |
| 09-20 | m038 性能实测（非估算） | ✅ 完成 | 100 条真实体量记录（906 KB）：新布局单次登记 **0.080 ms**、读单条 0.026 ms、扫全表 2.849 ms（仅裁剪时）；旧整表布局单次登记 **7.260 ms** → **新布局快约 90 倍且与记录数脱钩**。重构是净收益 |
| 09-20 | m038 根因一：翻译模块"浏览中"身份取错 | ✅ 完成 | `viewingQuery` 从模型返回字段（`word`/`original`）派生，而记录 query 是**用户输入**；模型归一化词形即失配 → 该记录**永远不被登记**（搜索/文档取的本就是记录身份） |
| 09-20 | m038 根因二：关闭路径过度依赖 React 状态 | ✅ 完成 | `viewingId` 是 `useMemo` 从 state 派生，页面卸载瞬间可能没解析好（本页内存副本未收敛，如记录由另一标签页写入）→ ref 为 null → 不写 |
| 09-20 | m038 修复 | ✅ 完成 | ① 翻译模块 `viewingQuery` 改显式 state，值取用户输入；② Provider 留声明**同步副本** `viewingDeclRef`；③ 登记拆两条：React 侧只认 `viewingIdRef`，页面级离开 ref 为空时按 `(type,query)` **回磁盘兜底**（刻意不共用，否则"进入"会命中兜底 = 一进页面就登记） |
| 09-20 | 补测试 + 反向验证（m038） | ✅ 完成 | `historyViewing` +1 例（内存未收敛时页面级离开须兜底）；摘掉兜底 → 该例立刻红（值仍是 30 分钟前）。已恢复 |
| 09-20 | 验证（m038） | ✅ 完成 | tsc 零错误；vitest **30 文件 / 339 用例全绿** |
| 09-20 | 用户第三次反馈：关标签页依旧不刷新 | ✅ 完成 | "关键问题……必须额外处理了" → 不再读代码猜，改用真实浏览器取证 |
| 09-20 | m039 取证：真实浏览器 + 页内探针 | ✅ 完成 | Playwright 注入脚本劫持 `Storage.prototype.setItem` 逐笔记录写入 + 监听 `beforeunload`/`pagehide`/`visibilitychange`/`freeze`；关标签页后新开一页读回 |
| 09-20 | m039 关键对比 | ✅ 完成 | dev `:5173`（服务 `src/`）：四类事件全触发、**写入了**、search/dictionary/doc 三模块 ✅；demo `:3000`（服务 `dist/`）：事件照来、**零写入**、时间停在打开那一刻 ❌ —— 与用户描述逐字吻合 |
| 09-20 | m039 根因 | ✅ 完成 | `dist/` 最后构建于 **2026-09-10**（早于 m033），产物里连 `lastViewedAt` 字段都没有；m033~m038 的改动全在 `src/`，只有 dev server 服务它 → 3000 上永远看不到效果 |
| 09-20 | m039 修复 | ✅ 完成 | ① 重建 dist（751 模块 + postbuild），3000 复测三模块 ✅；② `server.js` 加 `checkBuildFreshness()`（src 比 dist 新即告警，双向验证）；③ 全响应 `Cache-Control: no-store` 防启发式缓存旧 index |
| 09-20 | 验证（m039） | ✅ 完成 | tsc 零错误；vitest **30 文件 / 339 用例全绿**（本轮未改 `src/`） |
| 09-20 | 用户第四次反馈：仍不对，指正"关闭 = 关整个浏览器" | ✅ 完成 | "问题必定是 lastViewedAt 的修改上，关闭页面的触发被漏掉了" → m039 结论虽成立但不是全部，还有独立缺陷 |
| 09-20 | m040 先排除：dev `:5173` 真实生成流程 | ✅ 完成 | 端到端探针（mock AI 流式）：关页时 `beforeunload`/`pagehide`/`vis:hidden` 各写一次 → ✅ |
| 09-20 | m040 再排除：重建后的 dist `:3000` | ✅ 完成 | 同一流程同样 ✅；三模块 `viewingQuery` 与记录 `query` 静态核对亦无失配 |
| 09-20 | m040 定位：关整个浏览器 + 多标签（唯一没测过的路径） | ✅ 完成 | 持久化上下文 + 两标签页 + `ctx.close()` → ❌ 值停在创建时刻 |
| 09-20 | m040 事件侧 beacon | ✅ 完成 | 关单标签页：四类事件全到；**关整个浏览器：`beforeunload` 被跳过**，`pagehide`/`vis:hidden`/`unload` 每页各一次 |
| 09-20 | m040 写入侧 beacon（决定性） | ✅ 完成 | 劫持 `setItem`，关浏览器时 beacon 带回应用写入的 `lva=…494949`，但重开后磁盘仍是 `…493768` → **写发生了、没落盘**（渲染进程被杀，localStorage 异步提交未刷盘） |
| 09-20 | m040 根因 | ✅ 完成 | 不是触发漏挂、也不是处理函数没跑 —— 旧不变式"在浏览消失的一刻登记"把正确性压在了最脆弱的时机（进程即将退出） |
| 09-20 | m040 修复 | ✅ 完成 | 不变式换成「磁盘值落后真实浏览时刻 ≤ 一个心跳周期」：新增 `VIEWING_HEARTBEAT_MS = 30_000`；`viewingId` effect **进入即写兜底基线**；新增心跳 effect（浏览期间每 30s，`hidden` 跳过）；离开路径保留写精确时刻；四处统一 `Math.max` 单调不回退。因浏览中侧栏显示"浏览中"徽标而非时间，新增写入对用户不可见 |
| 09-20 | 测试（m040） | ✅ 完成 | `historyViewing` 改写 2 例（"进入不登记"→"进入即登记兜底基线"；同步落盘用例改用 `Date.now` 假时钟精确断言）+ 新增 2 例（心跳；`hidden` 不心跳）。tsc 零错误；vitest **30 文件 / 341 用例全绿** |
| 09-20 | A/B 验证（m040） | ✅ 完成 | 生成 → 停留 35s → 关整个浏览器 → 重开：旧 `dist` **+0ms ❌** ／ 新 `src` **+30015ms ✅** ／ 重建后 `dist` **+30008ms ✅**（心跳正好落一拍，值活过了浏览器关闭） |
| 09-20 | 文档同步 | ✅ 完成 | history / worklog / progress / issues / 项目记忆；dist 重建（新入口 `assets/index-DU89KXEN.js`） |

> **注意**：m036 改了历史存储布局（整表键 → 单条键）。若浏览器里还开着改造前的旧标签页，请刷新；旧标签页仍写整表键，两套布局互不可见。

> 详细记录见 [工作日志](worklog.md) 2026-09-20 条目。

### 2026-09-15（m032 收藏内容补全：概览归位 + 导出口径统一）

| 时间 | 任务 | 状态 | 备注 |
|------|------|------|------|
| 09-15 | 诊断：收藏详情没有 summary（概览） | ✅ 完成 | 根因：`summary` 只写在 `SearchResults.tsx` 的**标题卡（外壳）**里，共享内容区 `KnowledgeContentView` 中缺失；收藏渲染的是「标题头 + 共享内容区」→ 整段消失 |
| 09-15 | 概览归位到共享实现 | ✅ 完成 | **标题头（标题 + 概览）与中断提示整体收进** `KnowledgeContentView`，页面级操作用 `headerActions` 插槽注入 —— 搜索页观感零变化，收藏详情同时拿到概览 |
| 09-15 | 修同类的第二处内容缺失：导出无概览 | ✅ 完成 | `generateKnowledgeNote()` 输出 txt/md/html 从未写 summary，而「复制」Markdown 一直有 → 口径不一致，已对齐 |
| 09-15 | 补测试 | ✅ 完成 | favoritesDetail +1、searchResultsLatex +1、新增 `utils/__tests__/export.test.ts`（3 例） |
| 09-15 | 验证 | ✅ 完成 | tsc 零错误；vitest **25 文件 / 310 用例全绿**（净增 5） |
| 09-15 | 文档同步 | ✅ 完成 | worklog / progress / issues / todo / design / README |

> 详细记录见 [工作日志](worklog.md) 2026-09-15（收藏内容补全）条目。

### 2026-09-15（m031 收藏内容渲染一致性 + 6 处边界修复）

| 时间 | 任务 | 状态 | 备注 |
|------|------|------|------|
| 09-15 | 诊断：收藏不支持公式 / 不能展示思维导图 | ✅ 完成 | 根因：收藏详情是**手写的第二套渲染实现**（裸 `<p>` 输出 + mindMap 平铺标签），与搜索侧双实现漂移 |
| 09-15 | 抽取共享渲染实现 | ✅ 完成 | 新增 `components/knowledge/KnowledgeContentView.tsx`（`MindMap`/`ExamQuestionCard`/`ConceptIllustration`/`normalizeGenerated`）；`SearchResults` 删约 600 行重复 JSX |
| 09-15 | 收藏详情接入共享实现 | ✅ 完成 | 知识 → `KnowledgeContentView` + `GenerationNotice`；文档 → Markdown+公式渲染器；词典/翻译 → `LatexText` |
| 09-15 | 边界修复：有 topic 无 concepts 的收藏整页近乎空白 | ✅ 完成 | 旧判据误判为旧格式；改为 `isGeneratedKnowledge()` 语义判定 |
| 09-15 | 边界修复：思维导图脏数据白屏 | ✅ 完成 | 新增递归 `sanitizeMindMap()`，缺 title 的节点整支丢弃 |
| 09-15 | 边界修复：`$$...$$` 公式残留美元符号 | ✅ 完成 | 切分正则顺序修正 + 块级渲染 |
| 09-15 | 边界修复：列表预览裸露公式源码 / Markdown 标记 | ✅ 完成 | 新增 `utils/preview.ts` 的 `toPlainPreview()` |
| 09-15 | 边界修复：收藏保存静默失败（刷新后消失） | ✅ 完成 | 超配额 → 剥离 base64 图片重试 → 仍失败才报错；新增可见横幅 |
| 09-15 | 边界修复：去重与星标判定口径不一致 | ✅ 完成 | 统一为「类型 + 收藏夹 + 标题」指纹（顺带去掉几 MB 对象的深度序列化） |
| 09-15 | 文档正文公式渲染 | ✅ 完成 | 新增 `components/ui/MarkdownContent.tsx`（结构交给 Markdown、文本交给 `LatexText`） |
| 09-15 | 验证 | ✅ 完成 | tsc 零错误；vitest **24 文件 / 305 用例全绿**（净增 28）；`vite build` 成功（750 modules） |
| 09-15 | 文档同步 | ✅ 完成 | worklog / progress / todo / issues（design、convention 无结构性变更，未改） |

> 详细记录见 [工作日志](worklog.md) 2026-09-15（收藏内容渲染一致性）条目。

### 2026-09-15（v1.7.0：生成中断分类 + 全场景续写 + 错误处理 + 版权正式发布）

| 时间 | 任务 | 状态 | 备注 |
|------|------|------|------|
| 09-15 | 诊断：模型超限 vs 网络超时/异常有无明确区分 | ✅ 完成 | 结论：**没有**。仅有 `truncated` 布尔，且链路中断在首轮直接抛错终止 |
| 09-15 | 定位"内容未完全生成就自动截止且无提示" | ✅ 完成 | 根因：`withFallback` 把传输层异常吞成 `success:true + 空结构体` → 已流出内容被丢弃、回 IDLE、只剩笼统"生成失败" |
| 09-15 | 建立中断分类模型 | ✅ 完成 | 模型侧 / 链路侧 / 内容侧 / 用户侧四类归因 + 标准 code + 策略函数 |
| 09-15 | 续写扩展到全链路中断 | ✅ 完成 | network/timeout/protocol/静默截断都会续写；无内容时原 prompt 重发 1 次；硬上限 3 次 |
| 09-15 | 错误处理分层（strict 模式） | ✅ 完成 | 生成类调用不再返回"成功但空"；HTTP 错误透传厂商 code |
| 09-15 | 分档提示横幅（搜索 + 文档共用） | ✅ 完成 | 按原因给文案与配色 + 续写次数；兼容旧历史数据 |
| 09-15 | 修边界 bug：过期快照丢内容 | ✅ 完成 | catch 里改用本轮结束后的累积量判断 |
| 09-15 | 立 v1.7.0 正式发布里程碑 | ✅ 完成 | 含版权声明 + LICENSE + 仓库清理 + 本次生成链路治理 |
| 09-15 | 验证 | ✅ 完成 | tsc 零错误；vitest **20 文件 / 277 用例全绿**（净增 47）；`vite build` 成功（747 modules） |
| 09-15 | 文档同步 | ✅ 完成 | versions / history / worklog / progress / todo / issues / design / convention |

> 详细记录见 [演变历史](history.md) 2026-09-15 条目与 [工作日志](worklog.md)。

### 2026-09-12（流式链路健壮性治理 + 多厂商思考适配 + AI 内容质量）

| 时间 | 任务 | 状态 | 备注 |
|------|------|------|------|
| 09-12 | 首字节超时兜底（修「已等待 511 秒」卡死） | ✅ 完成 | `firstByteTimeoutMs` 60s + `StreamTimeoutError`；收到任意字节即 `clearTimeout` |
| 09-12 | 移除"黑名单-自愈"，链路状态诚实处理 | ✅ 完成 | `wantStream` 只信 `caps.streaming`；链路失败抛错透传、不再降级重发 |
| 09-12 | `withFallback` 链路错误透传 | ✅ 完成 | 修复"超时被静默吞成笼统生成失败"（原状态机识别为死代码）+ `toFriendlyError` |
| 09-12 | 续写边界加固 + 判定同源化 | ✅ 完成 | 复用 `isCompleteJSON`（补 `[]`）；核心字段齐全判定；续写轮空/异常保留已生成内容 |
| 09-12 | 空结果 → 页面空白修复 | ✅ 完成 | `hasUsableContent` 覆盖全字段；失败空状态卡片 `generateFailedEmpty` |
| 09-12 | 智谱 GLM「总是生成失败」 | ✅ 完成 | 思维链吃 `max_tokens`；`DISABLE_THINKING_PARAMS` 按厂商分派关闭参数 |
| 09-12 | 模型编造答案 / 自我怀疑式瞎猜 | ✅ 完成 | 【严谨性铁律】：答案可验证 / 解析自洽 / 禁自我怀疑措辞 / 绝不编造 |
| 09-12 | 试题缺图约束 + SVG 正向画法教学 + 图源积极引用 | ✅ 完成 | 【含"如图"约束】；按学科给可执行绘图步骤；引导 Commons 直链 |
| 09-12 | 验证 | ✅ 完成 | tsc 零错误；vitest 17 文件 / 210 用例全绿 |
| 09-12 | 文档同步 | ✅ 完成 | history / issues / progress / todo / versions / design / lessons / convention |

> 详细记录见 [演变历史](history.md) 2026-09-12 两条条目与 [工作日志](worklog.md)。

### 2026-09-11（AI 内容质量治理：公式统一渲染 + 试题原图优先 + 学科制图规范）

| 时间 | 任务 | 状态 | 备注 |
|------|------|------|------|
| 09-11 | 诊断（覆盖缺口 + 裸 LaTeX） | ✅ 完成 | 用户实测截图 4 张，复现关键要点 / 试题题干·选项裸 LaTeX 原样露出 |
| 09-11 | 公式渲染层：`splitBareLatex` + `LatexText` 统一入口 | ✅ 完成 | 强信号 + KaTeX 解析失败回退；`snake_case` / `C:\Users` 不误识别 |
| 09-11 | 全部 AI 文本字段接入 `LatexText` | ✅ 完成 | 8+ 字段（keyPoints / pitfalls / learningPath / confusables / mindMap 节点·描述 / 概念标题 / 趣事标题 / 标签 chip） |
| 09-11 | 试题配图三通道 | ✅ 完成 | `ExamQuestion.imageData`（base64 直填）；渲染 image / imageData > svg，加载失败回退 |
| 09-11 | 严格图源白名单 + 学科制图规范 | ✅ 完成 | prompt 显式写入域名清单；SVG 规则新增"严格遵循学科制图惯例"+ 高风险学科细则 |
| 09-11 | prompt 源头加固【公式书写规则】 | ✅ 完成 | 置顶"凡数学符号一律 `$...$`"+ 正反例（`$\triangle ABC$` vs `\triangle ABC`） |
| 09-11 | 验证 | ✅ 完成 | tsc 零错误、vitest 15 文件 / 185 用例全绿（新增 29 条） |
| 09-11 | 文档同步 | ✅ 完成 | design / history / worklog / progress / issues / versions / lessons / convention |

> 详细记录见 [演变历史](history.md) 2026-09-11 AI 内容质量治理条目与 [工作日志](worklog.md)。

### 2026-09-11（流式能力黑名单：永久禁用 → 60s 冷却）

| 时间 | 任务 | 状态 | 备注 |
|------|------|------|------|
| 09-11 | 定位（用户纠正：漏了 `baseAIProvider.ts` 黑名单链路） | ✅ 完成 | 走查 `analyze → callModelStream → prepareRequest → callModel` |
| 09-11 | 根因确认 | ✅ 完成 | `Set` 永久禁用 → 后续永不再发 `stream:true` → "流式成功即自愈"不可达（死代码） |
| 09-11 | 修复黑名单语义 | ✅ 完成 | `Map<key, failedAt>` + `STREAM_RETRY_COOLDOWN_MS=60s`，到期自动重试 |
| 09-11 | 降级可观测 + 记账收敛 | ✅ 完成 | 非流式分支/记账均 `console.warn`；只有协议层证据才记账（`receivedReasoning` 不记账） |
| 09-11 | 契约测试 | ✅ 完成 | 新增 `streamFallback.test.ts` 7 条（含"冷却结束可重试"） |
| 09-11 | 验证 | ✅ 完成 | tsc 零错误、vitest 13 文件 156/156 全绿 |
| 09-11 | 文档同步 | ✅ 完成 | design/history/worklog/progress/issues/lessons |

> 详细记录见 [演变历史](history.md) 2026-09-11 黑名单条目与 [工作日志](worklog.md)。

### 2026-09-11（流式渲染时序修复：总述延迟显示 + 步骤指示卡死）

| 时间 | 任务 | 状态 | 备注 |
|------|------|------|------|
| 09-11 | 复现定位（测试先行） | ✅ 完成 | 真实字段顺序喂 `StreamingJSONParser`，3 条断言全红 → 暴露两个独立根因 |
| 09-11 | 修复 `completedKeys` 漏容器字段 | ✅ 完成 | 容器闭合弹栈后，父帧为根对象且 `pendingKey` 非空即登记完成 |
| 09-11 | 修复「总述」被概念列表门控 | ✅ 完成 | 门控改为 `conceptsOverview \|\| concepts.length > 0` |
| 09-11 | 修复首字前占位文案写死"知识导图" | ✅ 完成 | 改中性文案 + 接管首字等待计时（原分支不可达） |
| 09-11 | 新增回归测试 | ✅ 完成 | 解析器 3 条 + 组件渲染时序 3 条 |
| 09-11 | 验证 | ✅ 完成 | tsc 零错误、vitest 149/149、vite bundle 成功（`dist` 清空被环境删除保护拦截，改用临时 outDir 验证） |
| 09-11 | 文档同步 | ✅ 完成 | history/worklog/progress/issues/lessons |

> 详细记录见 [演变历史](history.md) 2026-09-11 条目与 [工作日志](worklog.md)。

### 2026-09-10（v1.6.0 多语言 i18n + 用户语言绑定 + 超限自动续写 + 查词翻译改造）

| 时间 | 任务 | 状态 | 备注 |
|------|------|------|------|
| 09-10 | i18n 字符串层搭建 | ✅ 完成 | 英文作类型基准；`src/i18n/strings/` 按 area 拆文件 |
| 09-10 | 语言基础设施 | ✅ 完成 | `languages.ts` + `useLanguageStore` + `useStrings`/`getCurrentStrings` |
| 09-10 | UI 全量迁移 | ✅ 完成 | Header/设置/搜索/翻译/文档/收藏/历史/导出 全量去硬编码中文 |
| 09-10 | AI 输出绑定用户语言 | ✅ 完成 | `buildLanguageDirective` 实时读语言注入 prompt |
| 09-10 | 超限自动续写 | ✅ 完成 | 严格闭合判定 + 最多 3 次尝试 + `continued` 提示 |
| 09-10 | 查词翻译服务与 UI 改造 | ✅ 完成 | 源/目标双下拉、逐段对齐、短语多词支持 |
| 09-10 | 顺手修复两个真实 bug | ✅ 完成 | ① 具体错误被通用"生成失败"覆盖 ② 全空结果被误判为有内容 |
| 09-10 | 验证 | ✅ 完成 | tsc 零错误、vitest 142/142、vite build 成功 |
| 09-10 | 文档同步 | ✅ 完成 | history/worklog/progress/todo/versions/goal/issues/design/architecture/README |

> 详细记录见 [演变历史](history.md) 2026-09-10 条目与 [工作日志](worklog.md)。

### 2026-09-09（v1.5.0 收尾：真流式生成 + 真实 AI 链路修复 + 配图/题型/脉络增强）

| 时间 | 任务 | 状态 | 备注 |
|------|------|------|------|
| 09-09 | 内容生成改真流式 | ✅ 完成 | 生产者-消费者：`StreamingJSONParser` + `callModelStream` |
| 09-09 | 真实 AI 链路四问题修复 | ✅ 完成 | 截断透出、LaTeX 渲染报红、厂商模型 ID/cap、图片兜底 |
| 09-09 | 配图策略定稿 | ✅ 完成 | `svg`+`image` 双通道；Commons/维基双源；删除中英词表 |
| 09-09 | 试题题型适配 | ✅ 完成 | `sanitizeExamQuestions` 重写 + `ExamQuestionCard` |
| 09-09 | 核心概念/知识脉络增强 | ✅ 完成 | keyPoints/pitfalls/confusables，脉络四段式 |
| 09-09 | 思维导图公式溢出修复 | ✅ 完成 | 按字符类分档估宽 + 测量盒/渲染盒样式对齐 |
| 09-09 | 自定义厂商模板 | ✅ 完成 | 8 套模板一键预填 |
| 09-09 | 验证 | ✅ 完成 | tsc 零错误、vitest 121→142、build 成功 |

> 详细记录见 [演变历史](history.md) 2026-09-09 条目与 [工作日志](worklog.md)。

### 2026-09-06（v1.5.0 知识搜索内容增强落地 + 文档同步）

| 时间 | 任务 | 状态 | 备注 |
|------|------|------|------|
| 09-05 | 核心概念区块重构 | ✅ 完成 | conceptsOverview 总述、概念单列布局、示例解耦独立卡片、删死区块、复制/导出适配 |
| 09-05 | AI 提示词更新 | ✅ 完成 | concepts 提示词要求总述+双层内容；7 步结构化 JSON 输出 |
| 09-06 | Mock 数据全量升级 | ✅ 完成 | 22 主题 concepts 双层化 + 总述 + 概念示例；mindMapTestCommon 同步 |
| 09-06 | mockAIService 适配 | ✅ 完成 | 新格式透传、示例从概念提取、脉络取导图分支 |
| 09-06 | 并行 Edit 竞态事故修复 | ✅ 完成 | 4 处乱码/重复重建；教训沉淀至 lessons/ |
| 09-06 | 验证 | ✅ 完成 | build 通过、vitest 56/56、浏览器抽查 4/4 PASS |
| 09-06 | 文档同步 | ✅ 完成 | todo.md/history.md/progress.md/lessons/worklog |

> 详细记录见 [演变历史](history.md) 2026-09-06 条目与 [工作日志](worklog.md)。

### 2026-08-04（文档同步重大修正）

| 时间 | 任务 | 状态 | 备注 |
|------|------|------|------|
| - | user_profile.md 项目特定内容移除 | ✅ 完成 | 迁移到 project_memory.md |
| - | 创建 docs/project-document-manager.md | ✅ 完成 | 项目级执行规范 |
| - | prd.md v2.1 同步修正 | ✅ 完成 | 知识图谱/6种卡片/词典切换/文档类型 |
| - | goal.md 功能清单修正 | ✅ 完成 | 区分已完成/暂不考虑/未完成 |
| - | todo.md 状态修正 | ✅ 完成 | v1.4.0 部分完成 |
| - | versions.md 版本修正 | ✅ 完成 | 移除未实现项 |
| - | issues.md 新增未完成项 | ✅ 完成 | 知识图谱/6种卡片两条待解决项 |
| - | design.md 重写为 v1.1 | ✅ 完成 | 5种→6种卡片（补 FormulaCard）、知识结构图谱→知识目录、11种文档类型、数据模型对齐 types/index.ts、新增 AI 服务抽象层章节 |
| - | milestones 全量修正（m001~m007） | ✅ 完成 | m005/m006 标弃用、m007 改已完成、m001~m004 补齐实际完成内容 |
| - | convention.md 文档清单补全 | ✅ 完成 | 增加 project-document-manager.md、worklog.md、workflow.md、progress.md、milestones/、references/、external/；补充同步触发规则与冲突处理优先级 |
| - | history.md 追加 2026-08-04 条目 | ✅ 完成 | 五段式记录（事件/文件变更/构建验证/关联文档/经验教训） |
| - | progress.md 修正误报条目 | ✅ 完成 | 原 progress.md 把 design.md/milestones/convention.md/issues.md 误标为"已完成"，本轮实际修正 |

> **本轮修正说明**：原 `progress.md` 在记录中把多项未实际完成的修正标记为"✅ 完成"（design.md 仍是 5 种卡片、milestones m005/m006 仍标"已完成"且 m007 仍标"待开发"、convention.md 文档清单不全、issues.md 未新增未完成项）。本次全面校对实际文件状态后修正，所有条目现以实际文件内容为准。

### 2026-07-14（渐进式生成与JSON解析增强）

详细记录见 [演变历史](history.md)。

## 风险与阻塞

| 风险 | 影响 | 状态 | 解决方案 |
|------|------|------|---------|
| 6种知识卡片组件为死代码 | 死代码堆积 | ⚠️ 待处理 | 开发期策略：接入主流程或直接删除（待用户决策） |
| 知识图谱导航暂不考虑 | PRD 创新性降低 | ⚠️ 已降级 | 文档已修正，标记暂不考虑 |
| 算法动画/动态可视化死代码 | 死代码 | ✅ 已解决 | 2026-09-04 清理删除 src/modules/visual/ 及 echarts 依赖 |
| 构建警告（chunk > 500kB） | 加载性能 | ⚠️ 待处理 | 代码分割优化（echarts 移除后体积已下降） |
| 沙箱批量删除保护拦截 `npm run build` | 无法一键产出 dist | ⚠️ 环境限制 | vite 清空 `dist/assets`（>50 文件）被安全删除保护拦截；验证打包可改用 `vite build --outDir <临时目录>`，清空 dist 需在沙箱外执行或手动清理 |

## 技术债务

| 债务 | 描述 | 优先级 | 计划处理时间 |
|------|------|--------|-------------|
| 6种卡片/FavoritesPanel 死代码 | `src/components/cards/*`、`src/components/favorites/FavoritesPanel.tsx` 未被主流程引用 | P0 | 待决策（接入或删除） |
| 代码分割 | 主 chunk 需动态导入优化 | P2 | 后续版本 |
| 测试用例 | 已有 vitest 339 例（含状态机/流式解析/中断分类/全链路续写契约/严格模式 fallback/分档提示组件/公式统一渲染/试题 imageData/语言/历史时间戳与"浏览中"登记/多标签页磁盘真相与切模式清内容），业务组件渲染测试仍偏少 | P3 | 持续补充 |
| 多标签页写入（历史已收敛） | 历史已改"磁盘真相"（写前重读 + 磁盘口径裁剪 + 跨页复用同一记录）；剩余：同一记录被两个标签页**同时写**仍是后写者赢（单条原子，不会丢整条），如需更强保证要引入版本号/`navigator.locks`，开发期不做 | P3 | 后续版本按需 |
| 其它 store 仍是整表键 | `useFavorites` / `useAIConfigStore` / `useLanguageStore` 仍是整表一个键，多标签页下同样是"后写者赢"（本次只重构了历史） | P2 | 待评估 |

## 团队沟通

### 2026-08-04 文档同步决策

**议题**：项目文档与代码实际情况同步

**决议**：
1. 知识图谱导航当前不考虑开发，PRD 标记为暂不考虑
2. 6种知识卡片组件存在但未接入主流程，标记为未完成/待优化设计
3. 算法动画/动态可视化模块标记为已弃用
4. 词典翻译模式自动切换改为手动切换（对齐实际实现）
5. 文档类型 10→11（含通用 general）
6. 所有文档必须如实反映代码实际完成情况

## 关联文档

- [产品需求文档](prd.md) - 需求定义与验收标准（v2.1）
- [项目文档管理配置](project-document-manager.md) - 文档同步规范
- [技术架构文档](design.md) - 系统架构与技术设计
- [待办事项](todo.md) - 详细任务列表
- [问题记录](issues.md) - 问题追踪
- [演变历史](history.md) - 变更记录
- [版本里程碑](versions.md) - 版本规划
