# 工作日志

> 本文件遵循 workflow-manager Skill 要求，记录每次 AI 交互的执行步骤。
> 项目级执行规范见 [workflow-manager.md](workflow-manager.md)。
> 任务类型分级：需求分析 / 设计任务 / 开发任务 / 测试任务 / 文档维护 / Bug修复 / 重构优化 / 发布任务 / 查询任务 / 简单问答

---

## 2026-10-06 ~ 10-07（复制与导出重构 + 公式/PDF 修复 + 导图改截图 + Word/PDF 口径对齐与示意图导出 → v1.7.3）

**任务类型**：需求分析 / 开发任务 / 重构优化 / Bug修复 / 文档维护

> 本轮工作原本被拆成 `v1.8.0`（复制/导出重构）与 `v1.9.0`（公式/PDF）两个号，但**两批改动从未分别发布**
> → 按「未发布的改动不占号 + MINOR 留给路线图」统一收进补丁版 **v1.7.3**，`1.8.0` 号段归还给「移动端适配」。
> 两个误发的号已撤回（含 remote tag + GitHub Release）。

**第1步 复制与导出重构（修"导出文件丢一半内容"）**
- 查出导出链上叠着六个问题，最严重的是**导出后知识脉络 / 试题 / 趣味知识三段整段消失**，而"复制"出口一直有。
- 真因不是"漏写三个 `if`"，是**同一份 Markdown 被两份代码各写一遍**（`SearchResults.handleCopy` 的手写拼接器 + `generateKnowledgeNote`）→ 删除手写实现，复制直接复用 `generateKnowledgeNote(data).md`。
- 新增 `utils/clipboard.ts`（`copyText` 三级降级、**永不抛异常** —— `file://` 下 `navigator.clipboard` 可能是 `undefined`）、`utils/serialize.ts`、`utils/knowledgeLabels.ts`；新增 Word(.docx) 导出（JSZip + 手写 OOXML，不引 `docx` 包）。
- **移除 jspdf**：内置 14 种标准字体全是 latin-1，中文写进去是乱码，仓库内也无可嵌入的中文字体。

**第2步 公式与 PDF 修复（用户实测："公式没渲染，pdf 看不见"）**
- 公式漏网三条通道：```` ```latex ```` 围栏块被 `parseMarkdown` join 成一行、**无围符裸 LaTeX**（提示词本来就要求 `notation` 纯 LaTeX）、嵌套 `\frac` 单次 replace 不回溯。收敛成唯一实现 `utils/latexToText.ts`。
- **推翻上一版"改走浏览器打印"的结论**：打印对话框会把页面栅格化 → 位图 PDF（实测参考件 6 页 / 文本长度 0）→ 只要经过打印文字就永不可复制。
- 试过不嵌字体的矢量 CJK（`/STSong-Light` + `/UniGB-UCS2-H`）：结构完全合规、pdf.js 也能提取文字，但 **Windows 上（Chrome / Edge / PDFium / pdf.js）都没有这套字形**，实测每页 inkRatio ≈ 0.001 = 白纸。
- 最终方案：**每页 Canvas 位图 + `3 Tr` 隐形文字层**（`canvasRenderer` → `exportPdf` → `pdfCore`，零第三方依赖）。
- 顺带挖出 6 个隐藏缺陷：跨页共用同一张位图、导图页画在纵向画布上、行盒外溢切字、**排版按 pt 绘制按 px 导致显式 `size` 的片段全缩到 0.375×**、孤行标题、位图流多一个换行吃掉 JPEG 末字节。

**第3步 导图导出改"从画布截图"（用户方案）**
- 用户原话："我的方案是从生成的画布截图，更简单"。采纳，**PDF 导图页与 Word 附录页两个出口都改**。
- 关键认知：屏幕上的导图是 **SVG + 绝对定位 DOM，不是 canvas** → "截图"是**离屏 canvas 按同一份布局重绘**，不是截页面像素（也就不需要 html2canvas）。
- 绘制收敛成 `paintMindMap()` 一份（PDF 横向页 + Word 附录页共用）；Word 附录页由"缩进层级文字"改为内嵌位图。

**第4步 Word 与 PDF 口径对齐 + 正文示意图导出（用户第二轮实测）**
- 用户拿两份产物逐项对照报三条："首标题格式不一致"、"被添加了不需要的冗余内容"、"所有文档会丢失示意图内容"。
- 前两条是"同一份内容两个出口不一致"的复发（PDF 走结构化数据、Word 走 Markdown）：修 ① 首标题不再被降级成正文小字（同文丢弃 / 异文保留 Heading1，`Title` 样式对齐 PDF）；② `stripMindMapSection` 在有附录页时剥掉正文里重复的「思维导图结构」大纲。
- 第三条是导出链**整块能力缺失**（`image` / `imageData` / `svg` 三字段零引用）：新增 `utils/exportFigures.ts` 采集层，PDF / Word / HTML 三出口共用一份；Word 走 `![alt](figure:key)` 标记 + **统一 rId / media 分配器**（旧实现把 `rId3` 硬编码给导图，正文再插图必然撞号）。
- 顺带修掉 `svgWithIntrinsicSize` 的真缺陷：原先在整段 SVG 源码里搜 `width`/`height`，子元素（`<rect width="300">`）会把"已有尺寸"分支误判命中 → 跳过 viewBox 注入 → 320×200 的图被读成 240×150。

**第5步 验证**
- `tsc --noEmit` 干净；vitest **529 例 / 40 文件全绿**；新增锁逐条反向验证过会红（首标题不丢 → "复数"出现 2 次；不剥大纲 → 节点标题漏进正文；图不接进渲染 → `drawImage` 调用数 0；SVG 尺寸改回全局搜索 → 返回 300 而非 320）。
- 端到端（`F:\WorkBuddyData\.workbuddy\tmp\exportprobe\`：真 Chromium 打 `file://` 单文件产物 → mock AI → 走 UI 导出菜单，包一层 `URL.createObjectURL` 抓 Blob 字节）：Word 侧 `figure1..4.png`、4 个 `r:embed` 与 media 一一对应无悬空；PDF 侧 4 页（3 纵向 + 1 横向）、`3 Tr` 70 处、文字可提取。
- 记一笔假绿：`verify.cjs` 曾用 pdf.js 的 `OPS.setRenderingMode` 数隐形文字得 **0**，而原始字节里 `3 Tr` 明明有 70 处 → 改为直接 grep 原始字节。

**第6步 版本号纪律（用户反馈："版本号制定太随意了"）**
- 新增 `docs/convention.md` §7「版本号规范（强制）」：SemVer 语义表 / 未发布不占号 / 六处版本号一致 / 路线图预锁号（`v1.8.0 = 移动端适配`）。
- 新增 `scripts/check-version.js` 作为 `npm run release` 的前置门禁（六处不一致直接 fail）。
- 撤回误发的 `v1.9.0`（tag + Release 均 204 删除，复核 404）。
- **2026-10-07 用户拍板**：第 4 步的"正文示意图导出"单看形态是能力新增（MINOR），因属"导出内容对不齐"这条缺陷链的收尾，**一并收进 v1.7.3**；记为唯一一次越界、不作先例。

**第7步 文档同步**
- `docs/versions.md`（v1.7.3 八节 + 版本号说明）、`docs/history.md`（真因五 + 第四轮修复要点 + 验证数字）、`docs/issues.md`（新增四条已解决 + 两条经验教训）、`docs/todo.md`、`README.md`、`docs/convention.md`（§7.5 + §8）、`docs/design.md`（新增 §10.9 导出层 + 修正 jspdf 残留）、`docs/architecture.md`（新增 §16 导出层 + 文件树 + 修正 jspdf 残留）、`docs/worklog.md`（本条）、`docs/progress.md`。

---

## 2026-09-30（补充 Mock 演示数据 + 全量守卫 + 发布 v1.7.2）

**任务类型**：开发任务 / 发布任务

**第1步 先量化缺口（不靠感觉补）**
- 统计 `mockWordResult`：58 条词条、`collocations` **0**、`relatedTerms` 15、短语词条 **0**；翻译 mock 里是 `['相关词汇']` / `['语法说明']` 占位垃圾；`mockSentenceResult` 无任何引用（死代码）。
- 结论：三个可点击区块里，**常用搭配在 Mock 下永不出现**，短语查询只会看到"暂无该单词的释义"。

**第2步 补数据（按"演示时看得见"排序）**
- 新增 9 条短语词条（含复刻用户报错原文的 `respond well to`）：`isPhrase` + `keywords` + `relatedTerms` + `collocations`。
- 新增 `mockExtra` 表 + 合并循环，为 68 条词条补齐 `collocations` / `relatedTerms`，**已有值优先**。
- `mockMiniGlossary` 扩到 130+ 条；新增 `deriveMockKeywords()`（按词表拆词 + 释义，查不到释义的词不返回）。
- 新增 `mockSentenceExtras`（10 条策展语料）；`queryTranslate` 改为语料表驱动，`tokens` 按**原文词序**配 key，没数据就不给相关术语/语法说明。
- 删除死代码 `mockSentenceResult` 及随之未用的 `SentenceResult` import（`tsc` 报 TS6133 后修正）。

**第3步 补可点击目标（本次最关键）**
- 审计发现目标词远多于词表：354 个唯一目标词 vs 68 条词条，其中关联术语 104/243、常用搭配 240/247 落到空词条。
- 新增 `deriveMockFallbackDefinitions()`：未收录时按词素拆解给一条**标注了降级**的释义（不编造词义），一个词素都查不到则如实"暂无"。
- 补完词素后复审计：**354 个目标词，落空 0**。

**第4步 全量守卫测试**
- 新建 `src/modules/translate/__tests__/mockLinks.test.ts`：遍历全部目标词走真实 `queryWord()`，用 `vi.useFakeTimers()` + `advanceTimersByTimeAsync(400)` 跳过 mock 的 `delay(300)`。
- 该测试立刻抓到漏网词 `agent`（关键词里有定义，但点下去查不到）→ 补进词表。3 例全绿。

**第5步 验证**
- `tsc --noEmit` 零错误；vitest **383 例 / 34 文件全绿**（首次全量跑出现 2 个文件因沙箱 fs-shim EPERM 漏收集，单独重跑确认 61 例全过）。
- 真实浏览器探针 `~/.workbuddy/tmp/probe-mock-v172.cjs`（21 项断言全过，0 console error / 0 pageerror）：查词 `algorithm` 的常用搭配/关联术语出现且点击有真实释义；短语 `good morning` 的徽标/关键词/搭配齐备；翻译 `good morning` 的译文片段 DOM 顺序为 `[2,1]`（语序相反按 key 配对）、关联术语点击切 `#search` 并产生搜索记录。

**第6步 发布 v1.7.2**
- `package.json` `1.7.1` → `1.7.2`；`docs/versions.md` 新增 v1.7.2 条目；README 版本表；`docs/progress.md`（m041/m042 + 版本进度）；`docs/todo.md` 当前状态与已完成版本表；`docs/design.md` 3.3 补 Mock 数据硬要求。
- `npm run release` → `release/知识灵动助手.html`（3.21 MB）+ `使用说明.txt`（产物不入库）。
- **`git push` 挂住两次**（原因**未定论**，最可能是凭据授权未确认 / 超时；详见 `docs/history.md` 同条目）。
  当时用 token + `http.extraheader` 与 Git Data API 两条绕路把版本推了上去（commit `5aecfdc` / `189ceaa`），**不代表以后必须这么走**。
  事后用默认凭据通道 `git ls-remote` 秒回，且 `git fetch && git reset --hard origin/main` 已对齐本地与远端。
- 打 tag `v1.7.2`（annotation 文件 `~/.workbuddy/tmp/tag-v1.7.2.txt`）并推送。
- `GH_TOKEN=<token> node scripts/publish-release.mjs` → Release `https://github.com/ceepuka/zhishilingdong/releases/tag/v1.7.2`，附件 `zhishilingdong-v1.7.2.html` + `usage-v1.7.2.txt`（中文名放 `label`，脚本未告警）。
- **匿名**（不带 token）走 `api.github.com` 的 asset 端点复验：两附件均 200，HTML 3,365,679 字节、首字节 `<!DOCTYPE html>`。

---

## 2026-09-30（跳转查词报 "Failed to parse JSON response"：查词/翻译接入统一续写链路）

**任务类型**：Bug修复

**第1步 定位真因**
- 用户贴出报错：`Failed to parse JSON response (length=1339, preview: {"word":"respond well to",…`（JSON 被截断）。
- 全仓排查发现：查词 / 翻译是全项目**唯一还走非流式 `callModelWithJSON`** 的生成入口 ——
  没有续写、没有中断归因、没有部分内容；模型少写一个字符，`parseJSONResponse` 补不回来就返回 `null`，
  于是**解析层的技术描述被当成用户文案**上屏。

**第2步 接入统一续写链路（不另写第二套实现）**
- 新增 `buildJSONKeysCompleteChecker(requiredKeys)`（复用解析层 `analyzeJSON`，与 `buildGenerateCompleteChecker` 同口径）。
- 新增 `generateJSONWithContinuation<T>()`：复用**同一个** `callModelStreamWithContinuation`（同一重试预算 / 同一 `canContinueAfter` / 同一套归因），只是不需要增量回调。
- `queryWord` / `queryTranslate` 切换过去，必填字段分别为 `['word','definitions']` 与 `['original','translation']`。

**第3步 状态透出与文案分档**
- 4 处接口（`DictionaryQueryResponse` / `TranslateQueryResponse` / `WordResult` / `SentenceResult`）新增 `truncated` / `continued` / `interruption`；
  `WordResult` / `SentenceResult` 在**结果卡末尾**挂 `GenerationNotice`。
- 新建 `modules/translate/errorText.ts`；`translate.errors` 补 8 条中英文案；删除 `catch` 里的 mock 兜底（会误导用户）。

**第4步 测试**
- `src/services/__tests__/continuation.test.ts` 新增 12 例：`buildJSONKeysCompleteChecker` 7 例 + `generateJSONWithContinuation` 5 例
  （含"首轮停在半个字符串 → 续写补齐"的本次 bug 形态回归、以及"全程无 JSON → data=null + interruption"）。
- 单跑该文件 40 例全绿；全量 **380 例 / 33 文件全绿**；`tsc --noEmit` 零错误。

**第5步 真实浏览器取证**
- 新探针 `~/.workbuddy/tmp/probe-translate-truncation.cjs`：**拦截 AI 端点**模拟"模型只写了一半"，8 项断言全过。
  - 场景 A：第 1 轮 SSE 只吐半截 JSON → 自动第 2 次请求补齐 → **只在第 2 轮才有的**第 2 条释义/例句译文出现在屏幕上；提示为 teal「已自动续写并补全」，无报错卡，无技术细节。
  - 场景 B：3 轮都吐不出 JSON → 3 次请求后放弃，界面显示「模型输出被提前中断，结果可能不完整，请重试」；全文不含 `Failed to parse JSON` / `preview:`。

**踩坑记录**
- **探针分流条件写错会让结论完全反过来**：续写轮的 prompt 是 `buildJSONContinuationPrompt(已生成内容)`，**不含原始 prompt**；
  按 `body.includes('definitions')` 分流会把续写轮当成语言检测的旁路调用，喂回一份无关的完整 JSON ——
  场景 B 因此一度"没有报错"。分流条件必须同时认**原始 prompt 特征**与**续写提示词特征**（`已生成内容开始`）。
- 沙箱里 vitest 输出过管道会被 shim 吃掉，本次改为重定向到文件再用 `node -e` 过滤。

---

## 2026-09-30（翻译对照改 key 配对 + 关键词带释义与跨模块跳转）

**任务类型**：需求变更 + 功能开发 + 测试验证

**第1步 触发与澄清**
- 用户先报"翻译高亮对照语序不对"。第一版按字符位置单调游标扫描改完后，用户用 `Good morning → 早上好` 反例否掉，
  并给出正确模型：**双射键值对，AI 填键，前端按相同标记高亮，不便对照的"无键"**。
- 第二轮需求：查词模式的关键词/关联术语/常用搭配点击跳查词；翻译模式风格选择前移、关联术语跳知识搜索、关键词带释义。
- 澄清两次（`批量查词` 在代码与文档中都不存在 → 用户确认指"查词和翻译的关键词都要释义、都跳转查词"；关键词样式 → "需要释义，但不要照搬截图"）。
- 约束：**先不发新版本**，翻译/查词不做旧数据兼容。

**第2步 对照模型改 key 配对**
- 新增 `alignment.ts`：`normalizeKey` / `findFragment` / `collectRanges`（**结果按字符位置排序**）/ `sharedKeys` / `buildRuns`。
- 渲染铁律：屏幕文字只从 `original` / `translation` 切区间，不变量 `runs.map(r => r.text).join('') === text`；无键只"不高亮"，不"不显示"。
- 划选定位改读锚点 `data-key`（文本搜索在同名文字出现多次时永远命中第一处）。

**第3步 关键词模型 + UI**
- `KeywordEntry { term, definition? }` 贯通类型 → prompt → sanitize → UI；`toKeywordList()` 同时吃对象与裸字符串。
- 新组件 `TermList`（"词 + 一句话释义"）+ `toKeywordEntries()`；`Tag` 改为"传了 onClick 才是按钮"。

**第4步 风格前移与跨模块跳转**
- 风格选择器移入 `TranslateInput`（仅翻译模式）；结果卡只展示本次用的风格，改风格不再自动重翻。
- `App.tsx` 加 `pendingSearchTerm` + `handleSearchTopic`；`SearchModule` 新增 `initialQuery` / `onInitialQueryConsumed`，挂载后消费一次。

**第5步 验证**
- `tsc --noEmit` 零错误；测试 **368 例 / 33 文件全绿**（全量 32 文件 347 例 + 沙箱 EPERM 漏收集的文件单跑 21 例）。
- 真实浏览器探针 `~/.workbuddy/tmp/probe-translate-keyword-ux.cjs`（Mock 模式）12 项断言全过、0 console error。

**踩坑记录**
- **`setState` 之后立刻调读同一 state 的函数读到旧值**：点关键词跳查词时先 `setMode('dictionary')` 再 `handleTranslate()`，
  闭包里还是 `'translate'` → 会变成"再翻一次这句"。修法是 `handleTranslate(text, modeOverride?)` **显式传模式**。
- **切标签页那一刻目标模块才挂载，ref 必为 null** → 跨模块带参跳转只能"交给目标模块自己消费"，且必须**只消费一次**。
- 全量 vitest 少收集一个文件（`Tests` 通过但 `Test Files` 少一）仍是沙箱 fs-shim EPERM 的老问题，**单跑该文件确认**，别当成真失败。

---



## 2026-09-29（转公开：密钥体检 → 新建公开仓库 → 重建 Release）

**任务类型**：发布任务（公开分发 + 仓库历史处理）

**第1步 触发**
- 用户要"转成 public 让外部的人能方便下载体验"，随后选定"统一到 main"、"新建干净的公开仓库"。
- 前置判断：转 public 等于把**全部 git 历史**摊开，必须先做密钥体检，不能直接点开关。

**第2步 密钥体检（全历史，不是只看 HEAD）**
- `git rev-list --objects --all` + `git cat-file --batch` dump 全部 1318 个对象（76.5MB）后正则扫描。
- 命中两处真实泄露：
  1. 智谱 GLM API Key（`7bbd2908****Lli`），来自提交 `dd3c4d0` 的 `.env`（含 `VITE_GLM_API_KEY` + `VITE_USE_REAL_AI=true`）
  2. Trae/字节 session ID，来自 `docs/external/Session ID.txt` —— **当时仍在 HEAD 里被追踪**（`git ls-files` 确认）
- `.env` / `.env.example` 已不在工作树；`Session ID.txt` 必须处理。

**第3步 处置选择**
- 备选是 `git filter-repo` 重写 48 个提交的历史，但代价高、易漏（reflog / 悬空对象 / 远端缓存）。
- 选定更彻底的一条：把**当前已干净的工作树**作为一次全新初始提交推到新公开仓库，旧仓库保持 private 当存档。
- 代价明确：提交历史从 48 个变成 1 个（用户已确认接受）。

**第4步 执行**
- `git rm --cached` + 磁盘删除 `docs/external/Session ID.txt`，`docs/external/README.md` 记录处置。
- 工作树终检：261 个追踪文件 × 7 类密钥正则 → 0 命中。
- `git checkout --orphan main` → `git rm --cached -r .trae .workbuddy/memory` → 单提交（209 文件）。
- `.gitignore` 增加 `.trae/` 与 `.workbuddy/memory/`（这两处是开发过程产物，含本机路径与内部推理，不进公开仓库）。
- 先改 URL 再定型：`scripts/publish-release.mjs` 的 `REPO`、`scripts/build-standalone.js` 使用说明模板、`README.md` 加 Release 下载入口 → `--amend` 进初始提交，保证公开的第一个提交不留旧链接。
- 远端调整：`origin` 改名 `archive`（指向旧私有仓库），新增 `origin` → 新公开仓库，推送 `main`。

**第5步 重建 tag 与 Release**
- 重建产物（旧 `使用说明.txt` 里还写着旧 URL，路径变更不靠推断）：`tsc --noEmit` → `vite build --config vite.standalone.config.ts` → `build-standalone.js`。
- 本地 tag `v1.7.1` 原本指向旧 master 历史的提交，删除后重指 `main` HEAD 再推。
- `publish-release.mjs` 重建 Release，附件 `zhishilingdong-v1.7.1.html`（3.18MB）+ `usage-v1.7.1.txt`。

**第6步 验证**
- 远端：`visibility=public`、`default_branch=main`、`commits=1`（`5bb1dd2`）、blob 209 个、`.trae/` 与 `.workbuddy/memory/` 存在数 0。
- **匿名**（不带 token）下载 Release 附件：HTTP 200，3.18MB，完整 `<!doctype html>`，内联 KaTeX woff2 字体在，无外部 `./assets/` 引用。

**踩坑记录**
- `VAR=$(...) && cmd` **不会**把变量导出给子进程 → `publish-release.mjs` 第一次直接报"缺少 GH_TOKEN"。要写成 `export VAR=$(...)` 或 `VAR=... cmd`。
- 本机 `curl` 走 HTTPS 代理访问 `github.com` 会 `schannel: failed to receive handshake`；但 `api.github.com` 正常。
  node 的 `fetch` 直连 `github.com:443` 又被墙。**验证附件可下载要走 `api.github.com` 的 asset 端点**（会 302 到 `release-assets.githubusercontent.com`，那条链路通）。
- `curl -d '<含中文的 JSON>'` 在 git-bash 里会 SIGTERM，改为先用 node 写 `.json` 文件再 `--data-binary @file`。
- 建仓库、推送、发布三步都容易在客户端侧被 SIGTERM 打断（服务端往往已成功）→ 每步结束后必须用 API 复核实际状态，不能凭退出码判断。

---

## 2026-09-29（发布形态定为单文件 HTML + 移除云部署与本地服务 + 首次推送发布包）

**任务类型**：发布任务（发布形态变更 + 打包 + 推送）

**第1步 理解需求**
- 用户原话："netlify并不是免费部署平台，我要打包本地化web应用或静态网页"，随后明确"我需要别人能方便体验"，并要求删掉 `netlify.toml` + `vercel.json`。
- 判据是**接收方能零门槛体验**：不要装 Node、不要起服务器、最好一个文件发过去就能开。
- 第2轮追加："以后就以HTML文件形式正式发布，全部以这个形式维护"，`dist-standalone` 作为 GitHub 发布包，文件名直接叫「知识灵动助手.html」，并要求推到 GitHub。

**第2步 现状确认**
- 项目是纯前端 SPA，无后端；API Key 由用户自持并在浏览器直连各厂商，`server.js` 只是静态文件服务器。
- Mock 模式（未配置密钥）完全不需要网络 —— 意味着"离线可用"是可达成的，不需要把 AI 能力一起打包。
- 唯一已有分发路径是 `node server.js` / `start.bat`，要求接收方装了 Node。
- Git 状态：最后一次提交停在 m033，**m034–m040 七个里程碑的改动全在工作区未提交**（32 文件、约 1873 行增），而 docs 里已有对应记录。

**第3步 方案与实现**
- 新增 `vite.standalone.config.ts`：构建到 `.tmp-standalone/`，三处差异全部针对 `file://` 的限制 —— `inlineDynamicImports`（动态 import 被 CORS 拦）、`assetsInlineLimit: Infinity`（外部字体被拒）、去掉 `manualChunks`（与前者互斥）。
- 新增 `scripts/build-standalone.js`：内联入口 JS / CSS / favicon 到 `release/知识灵动助手.html`，并生成 `使用说明.txt`；带自检（发现残留 `./assets/` 引用即失败退出）。
- 中间产物与发布包分离：原料进 `.tmp-standalone/`（gitignore），只有成品进 `release/`（入库）—— 否则一堆 hash 命名的 chunk 和字体原料会被提交进仓库。
- 删除 `netlify.toml`、`vercel.json`、`server.js`、`start.bat`、`scripts/postbuild.js`、旧 `dist/`；`package.json` 去掉 `build` / `preview`，`release` 成为唯一发布命令（含 `tsc --noEmit`）；`vite.config.ts` 收敛为纯开发配置；version 由 `0.1.0` 更正为 `1.7.0`。
- 使用说明重写为接收方视角的完整文档（打开方式 / Mock 可试关键词 / 真实 AI 配置步骤 / 功能一览 / 数据与隐私 / 常见问题 / 已知限制 / 版本信息）。

**第4步 验证（真实浏览器，不是推理）**
- 探针 `~/.workbuddy/tmp/probe-standalone-file.cjs`，同时对比 `file://` 与 `http://localhost` 两种来源：

| 检查项 | 结果 |
|--------|------|
| `file://` 下 localStorage | ✅ 可写可回读（应用的历史/收藏/配置全依赖它） |
| 内联 module 脚本执行 / 应用挂载 | ✅ `#root` 正常挂载，首屏正常 |
| Mock 搜索端到端 | ✅ 输入"勾股定理"→ 内容上屏；失败请求 0、console error 0、pageerror 0 |
| CORS（Origin: null） | 智谱 / 通义 / DeepSeek / Moonshot / 硅基流动 全部 HTTP 401（= 预检放行，仅密钥无效）；OpenAI 两种来源都超时（网络问题，非 CORS） |
| 产物完整性 | `./assets/` 引用 0、`<script src=>` 0、favicon 已转 data URI |

- 改名到 `release/知识灵动助手.html` 后**重跑了一次探针**（路径变更不靠推断），结论同上。
- 产物：`release/知识灵动助手.html`（3.18 MB，其中内联字体约 1.5 MB）+ `release/使用说明.txt`。
- `tsc --noEmit` 零错误（`npm run release` 已把类型检查并入发布链路）。

**第5步 推送 + 产物改挂 Release 附件**
- 按用户要求拆 3 个提交推送：`427e1fd`（m034 中断提示归位）/ `e5af4d9`（m035~m040 历史登记重构）/ `c572b6e`（发布形态 + 文档）。
- 用户追加："只留源码、把 HTML 挂到 Release 附件上" → `release/` 改为 gitignore、`git rm --cached`，成品作为 GitHub Release 附件分发。
- 打 tag `v1.7.1`（仓库此前无任何 tag），`package.json` 同步升到 `1.7.1`，并在 versions.md / README / todo.md 补版本记录。
- 选 `v1.7.1` 而非 `v1.7.0` 的理由：代码已包含 m034~m040 的修复，若沿用 v1.7.0，tag 指向的内容会与 versions.md 里 v1.7.0 的描述不符。

**验证命令**
```
npm run release
NODE_PATH=<isolated ws>/node_modules node ~/.workbuddy/tmp/probe-standalone-file.cjs
node ~/.workbuddy/tmp/check-release.cjs     # 产物结构自检
```

### 经验教训

1. **`file://` 有两条硬门槛，都会以"功能静默失效"的形式出现**：动态 `import()` 被 CORS 拦（导出 PDF 直接不工作）、外部字体被拒（公式排版崩）。两者都不报错、只在控制台留一条，很容易被当成"打包后就是这样"。做单文件必须 `inlineDynamicImports` + 全量 base64 内联。
2. **内联 JS 时要转义 `</script`**：JS 里任何一处该字符串都会提前截断 script 标签导致白屏，且报错完全不指向这里。转义成 `<\/script` 是安全的（同一字符）。
3. **"能不能离线"要先看有没有必须在服务端做的事**：本项目 AI 调用在浏览器直连 + 有 Mock 模式，所以离线可行；这决定了打包形态可以直接选"一个文件"而不是"便携服务器"。
4. **判断 CORS 问题必须带对照组**：单看 `file://` 失败无法区分"null origin 被拦"和"网络不通"。同时从 `http://localhost` 发同一个请求，两者都失败=网络问题，只有 `file://` 失败才是来源问题。本次 OpenAI 就是被这招区分出来的。
5. **Vite 的 `assetsInlineLimit` 管不到 HTML 里的 `<link rel="icon">`**，需要自己转 data URI，否则自检会把它当成"未内联资源"拦下来。
6. **构建原料与发布成品要分目录**：直接把 vite 的输出目录当发布包，会把几十个 hash 命名的字体/chunk 文件一起提交进仓库。原料进 gitignore 的中间目录，成品单独写进 `release/`。
7. **产物结构自检要用"HTML 结构"口径，别用全局字符串计数**：打包后的 JS 里本来就会包含 `crossorigin` / `modulepreload` 这些字符串（Vite 的预加载 polyfill、React 属性处理）。判定"是否还有外部引用"要查 `<script src=`、`<link href=` 和 `./assets/` 这类结构特征。

---

## 2026-09-20（m040 "关闭整个浏览器后 lastViewedAt 不刷新"真因 = 离开那一刻的落盘本身就不可靠）

**任务类型**：Bug修复（诊断 → 修复 → A/B 验证）

**第1步 理解需求**
- 用户对 m039 的结论不认可（原话："还是不对，是不是理解错了，关闭是指应用的整个网页，多标签打开是没问题。问题必定是 `lastViewedAt` 的修改上，关闭页面的触发被漏掉了"）。
- 关键信息两条：① "关闭"= **关掉整个应用页面（整个浏览器）**，不是关单个标签页；② 用户明确排除"多标签"这个方向。
- m039 的结论（旧 dist）虽然成立，但用户重测仍不对 → **一定还有一个独立缺陷**，不能拿旧结论收场。

**第2步 先排除，再定位**
| 排查项 | 手段 | 结果 |
|--------|------|------|
| dev `:5173` 真实生成流程（生成→上屏→关标签页） | 端到端探针（mock AI 流式接口） | 关页时 `beforeunload`/`pagehide`/`vis:hidden` 各写一次，值刷新 ✅ |
| dist `:3000` 重建后同一流程 | 同上 | 同样 ✅ |
| 三个模块 `viewingQuery` 与记录 `query` 是否失配 | 静态核对 | search（`canonicalTopic`）/ dict·translate（显式 state）/ doc（`currentTopic`）全部一致，无失配 |
| **关掉整个浏览器 + 多标签并存** | 持久化上下文 + 两个标签页 + `ctx.close()` | **❌ 值仍停在创建时刻** ← 唯一没测过的路径 |

**第3步 定位（两步 beacon 取证，把"事件没来"和"处理函数没写"分开）**
- 端点法：页面里给四类生命周期事件各挂一个 `navigator.sendBeacon`，打到本地 HTTP 端点（beacon 能活过渲染进程被杀），对比两种关闭方式：
  | 场景 | 触发的事件 |
  |------|-----------|
  | 关单个标签页 `page.close({runBeforeUnload:true})` | `beforeunload` + `pagehide` + `vis:hidden` + `unload` 全到 |
  | **关整个浏览器（两标签页）** | **`beforeunload` 被跳过**；`pagehide` + `vis:hidden` + `unload` 每个标签页各一次 |
- 写入法：把 `Storage.prototype.setItem` 包一层，写历史键时额外打一个 beacon 带回 `key` 与 `lastViewedAt`。关整个浏览器时收到的 beacon：
  ```
  /event    pagehide
  /histwrite key=search-…-6rnd&lva=1789883494949   ← 应用确实写了新时刻
  /event    vis:hidden
  /histwrite key=search-…-6rnd&lva=1789883494949
  /event    pagehide
  ```
  但重开浏览器后磁盘上读到的仍是旧值 `…493768`。
- **结论**：不是"触发被漏掉"，也不是"处理函数没执行" —— 事件来了、函数跑了、`setItem` 也调了，**是这次写入没落盘**：`pagehide` 之后渲染进程紧接着被杀，localStorage 的异步提交来不及刷进磁盘。

**第4步 修复：换掉不变式**
- 旧不变式「在浏览消失的一刻登记」把正确性压在最脆弱的时机上（进程即将退出）。新不变式：
  > **磁盘上的 `lastViewedAt` 落后于真实浏览时刻，不超过一个心跳周期。**
- `HistoryContext.tsx`：
  - 新增 `VIEWING_HEARTBEAT_MS = 30_000`（与侧栏相对时间粒度对齐，"刚刚" = 1 分钟内）；
  - `viewingId` 那个 effect 里**进入即写一条兜底基线**（`if (viewingId) touchHistory(viewingId)`）；
  - 新增心跳 effect：浏览期间每 30s 写一次；`document.visibilityState === 'hidden'` 时不写（切后台那一刻已登记，且"正在浏览"已结束）；
  - 离开时（React 侧 `flushViewing` / 页面级 `flushOnPageLeave`）仍写精确时刻。四处都走 `Math.max(Date.now(), 磁盘值)`，单调不回退。
- 可见性：浏览中侧栏显示的是"浏览中"徽标而不是时间，所以新增的两次写入对用户不可见，只在"离开写入丢失"时才体现价值。

**第5步 测试**
- `historyViewing.test.tsx`：
  - 改写 1 例：原「浏览中：不登记」→「进入即登记兜底基线；内容消失再登记一次更晚的时刻」（用 `Date.now` 假时钟精确断言两次写入的时刻）；
  - 改写 1 例：同步落盘用例原先靠"进入不写"才能断言，改用假时钟推进 1 分钟后断言值跟着前进；
  - 新增 2 例：心跳（`vi.useFakeTimers` 推进一个周期，断言值前进且落后 ≤ 一个周期）、`hidden` 时不心跳。
- `tsc --noEmit` 零错误；`vitest run` **341/341 通过**（30 个文件）。

**第6步 A/B 验证（生成 → 停留 35s → 关掉整个浏览器 → 重开读盘）**
| 构建 | 关浏览器前磁盘值 | 重开后磁盘值 | 结论 |
|------|------------------|--------------|------|
| 旧 `dist`（改动前） | 创建时刻 +0ms | 创建时刻 +0ms | ❌ |
| 新 `src`（改动后） | 创建时刻 **+30015ms** | 创建时刻 **+30015ms** | ✅（心跳正好落了一拍，值活过了浏览器关闭） |
- 重建 `dist`（751 模块 + postbuild，新入口 `assets/index-DU89KXEN.js`），并复测 `:3000` 入口。

**第7步 文档同步**
- `history.md` / `issues.md` / `progress.md` / `worklog.md` 同步；`.manifest.json` 重建。

---

## 2026-09-20（m039 "关闭标签页不刷新"真因 = 跑的是 09-10 的旧 dist 构建 + 构建新鲜度自检）

**任务类型**：Bug修复 + 查询任务（诊断）

**第1步 理解需求**
- 用户第三次反馈同一症状："关键问题，关闭标签页时，'浏览中'的记录依旧不刷新 `lastViewedAt`，必须额外处理了。"
- 前两轮（m036/m038）都把"登记时机"改过一遍；这次**不再改代码猜**，先取证。

**第2步 诊断（真实浏览器 + 页内探针）**
- 手段：Playwright（`playwright-core` 装在隔离工作区，复用本机缓存的 chromium）打开真实页面，用 `addInitScript` 注入探针：**劫持 `Storage.prototype.setItem` 记录每一次写入**，并监听 `beforeunload` / `pagehide` / `visibilitychange` / `freeze`。关标签页（`page.close({runBeforeUnload:true})`）后新开一页读回探针。
- 结果（两个入口分别打）：
  | 入口 | 关标签页时事件 | 关标签页时写入 | `lastViewedAt` |
  |------|----------------|----------------|----------------|
  | dev `localhost:5173` | beforeunload / pagehide / vis:hidden **全部触发** | `…history:<id>` **写了一次** | **刷新 ✅** |
  | dist demo `localhost:3000` | 同样全部触发 | **一次都没有** | **停在"打开它"的那一刻 ❌** |
  - dev 路径下 search / dictionary / doc 三个模块**逐一实测全部 ✅**。
  - dist 路径的表现与用户描述**逐字吻合**：事件都来了，但没有任何写入。
- **根因**：`start.bat` → `node server.js` 服务的是 **`dist/`**，而 `dist/` 最后一次构建是 **2026-09-10**（`dist/assets` mtime + `index.html` 更早），**早于 m033**。grep 构建产物证实：里面只有旧的整表键 `ai-office-assistant-history` + `saveToStorage = localStorage.setItem(key, JSON.stringify(全表))`，**连 `lastViewedAt` 这个字段都不存在**。m033→m038 的所有改动都只落在 `src/`，而只有 Vite dev server（5173）会服务 `src/`。→ 用户在 3000 上无论怎么改都不可能看到效果。

**第3步 执行**
- **重建 dist**：`vite build`（751 模块）+ `scripts/postbuild.js`（去 `crossorigin`）。新入口 `dist/assets/index-CzWycQJa.js`；grep 确认含 `lastViewedAt` / `ai-office-assistant-history.schema` / `beforeunload` / `freeze`。
- **复测**：用同一套探针打 3000 → search / dictionary / doc 全部 ✅。
- **`server.js` 加构建新鲜度自检**：启动后比较 `src/` 与 `dist/` 的最新 mtime，`dist` 旧于 `src` 就打印醒目告警（两侧时间 + `npm run build` 提示 + 建议用 dev 5173）；`dist` 不存在也告警。
- **`server.js` 全部响应加 `Cache-Control: no-store`**：原先不发任何缓存头，浏览器可启发式缓存 `index.html`（引用的还是旧 hash 资源）→ 又是一次"构建了但页面没变"的静默误判。

**第4步 验证**
- 新鲜度自检**双向验证**：把某 src 文件 mtime 提到当前 → 启动打印旧构建告警；恢复原 mtime → 打印"dist/ 已是最新"。
- `no-store` 验证：`index.html` 与入口 js 响应头均为 `no-store, must-revalidate`。
- `tsc --noEmit` 零错误；`vitest run` **30 文件 / 339 用例全绿**（本轮未改 `src/`）。

**遗留（不变）**
- 收藏 / AI 配置 / 语言三个 store 仍是整表键；同一记录被两标签页**同时写**仍是后写者赢。

---

## 2026-09-20（m038 关闭标签页兜底登记 + 翻译模块"浏览中"身份修正 + 重构性能实测）

**任务类型**：Bug修复 + 查询任务（性能评估）

**第1步 理解需求**
- 用户两问：① 上一轮"磁盘真相"重构对性能的代价大不大？② "页面正在浏览内容时，关闭标签页，那个最后浏览时间仍是旧值 —— 这是关闭页面时 `lastViewedAt` 没有机会被更改，应该放在关闭过程中特别处理。"

**第2步 诊断**
- **性能（实测，非估算）**：100 条真实体量记录（含 `generatedData`，合计 906 KB / 单条约 9.1 KB）下，jsdom 实测：
  - 单条键（现状）：读单条 `readItem` **0.026 ms**、一次浏览登记（读+写）**0.080 ms**、扫全表 `readAll` **2.849 ms**（只在超 100 条裁剪时走一次）。
  - 整表键（改造前）：一次浏览登记（读全表 + 写全表）**7.260 ms**。
  - 结论：**新布局单次登记比旧布局快约 90 倍**，且成本与记录数脱钩（旧布局随记录数线性增长）。重构不是性能代价，是净收益。
- **关闭标签页仍不刷新**：根因不在"没挂监听"，而在**声明与记录的身份对不上 + 关闭路径过度依赖 React 状态**，两处叠加：
  1. **翻译模块的"浏览中"身份取错**：`viewingQuery` 从结果里派生（`wordResult?.word` / `sentenceResult?.original`），而记录是拿**用户输入**当 `query` 建的。模型返回归一化词形（大小写、词形还原）时两者不一致 → Provider 按 `(type, query)` 永远解析不到条目 → `viewingId` 恒为 null → **这条记录永远不会被登记**。搜索/文档模块取的是"归一的主题 / 当前主题"，本来就是记录身份，只有翻译模块是例外。
  2. **关闭路径只认 `viewingIdRef`**：`viewingId` 是 `useMemo` 从 state 派生的，页面卸载那一刻可能还没解析好（条目刚建、本页内存副本尚未收敛 —— 例如记录是另一个标签页写的、`storage` 事件被节流没投递到本页），此时 ref 还是 null → 什么都不写。

**第3步 执行**
- `src/hooks/HistoryContext.tsx`：
  - 新增 `viewingDeclRef`（声明的**同步**副本，`declareViewing` 里写入，不等 React 提交）；
  - 登记路径**拆成两条**，刻意不共用：
    - `flushViewing`（React 侧：内容消失 / 声明方卸载）只认 `viewingIdRef` —— 语义是"上一个已解析出的条目停止被浏览"，且 cleanup 恰在"新 id 写入 ref"之前跑，读到的一直是刚离开的那条；
    - `flushOnPageLeave`（页面级：`visibilitychange→hidden` / `pagehide` / `beforeunload` / `freeze`）先用 ref，ref 为空则按声明的 `(type, query)` 走 `findByQuery` **回磁盘兜底**。
  - **为什么必须拆**：两条路径共用兜底会让"进入一条内容"的那次 cleanup 也命中磁盘兜底 → 一进页面就把时间刷成现在，违背"只在浏览消失的一刻登记"（本次先做成一版共用兜底，`historyViewing` 立刻红 2 例，正是这个）。
- `src/modules/translate/index.tsx`：`viewingQuery` 从"结果派生"改为**显式 state**，值一律取**用户输入的那串文本**（= 记录身份）：`pushDictHistory` / `pushTransHistory` / `showFavorite` / `handleHistorySelect` 里 `setViewingQuery(query)`，`handleRemove` / `reset` / `handleModeChange` 里置 null。
- 核实搜索/文档模块无需改动：搜索 `viewingQuery = canonicalTopic || query`（记录 query 就是 `canonicalTopic`）、问答 `qaMessages[0].content`（记录 query 是 `trimmedQuestion`，`createUserMessage` 不改内容）、文档 `currentTopic` —— 三处本来就是记录身份。

**第4步 验证**
- 新增回归测试 `historyViewing.test.tsx`：**"记录只在磁盘上、内存未收敛时，页面级离开回磁盘兜底登记"**（另一个标签页写盘、storage 事件未投递 → `viewingId` 解析不出 → `pagehide` 仍须登记）。
- **反向验证**：把 `flushOnPageLeave` 的兜底摘掉 → 该例立刻红（`expected 1789877091646 to be greater than 1789878886648`，即仍是 30 分钟前的旧值）；已恢复。
- `tsc --noEmit` 零错误；`vitest run` **30 文件 / 339 用例全绿**。

**遗留（不变）**
- 收藏 / AI 配置 / 语言三个 store 仍是整表键；同一记录被两标签页**同时写**仍是后写者赢（单条原子，不丢整条）。

---

## 2026-09-20（历史数据层改为"磁盘真相"：写前重读 + 磁盘口径裁剪 + 一次性迁移）

**任务类型**：重构优化 + Bug修复（用户复测 m036 后提出，并决定重构多标签页数据处理）

**第1步 理解需求**
- 用户反馈："搜索切问答不会清'浏览中'的内容，切回搜索仍是'浏览中'，纯负面改动。多标签页数据处理逻辑存在重大问题，我决定重构。"
- 追问后确认两件事：① 多标签页现象 = "两边历史各看各的"，并追加一个必须回答的问题：**一个标签页正在生成内容时，其他标签页怎么处理？** ② 唯一明确的修复要求：**关闭标签页时"浏览中"记录的最后浏览时间必须刷新**。

**第2步 诊断**
- **"切模式不清内容"不是 m036 引入的**（有证据）：`switchMode` 自 initial commit（`04f2998`）起一直是"切到搜索时清问答消息"，反向从不清搜索内容，m036 的 diff 里这行未动；`git log -S"handleModeChange" -- src/modules/search/` 为空 —— 搜索模块从来没有过该函数。但**词典/翻译模块的 `handleModeChange` 一直是"切模式即清两个结果"**，搜索模块是唯一不一致的例外。
- **"没解决问题"的解释**：m036 换了存储布局，而迁移只在新代码挂载时执行；改造前就已打开的旧标签页仍在写整表键、跑旧逻辑，两边互相看不见 → 那个标签页里必然还是旧行为。属于改布局的代价，提示不到位。
- **多标签页真正的缺陷（4 处）**：
  - A `commit()` 按**本页内存排序**裁剪上限并**连键一起删** —— 本页不知道别的标签页刚建/刚刷新的记录，会把它算成"尾部"直接删掉（真实数据丢失，>100 条才触发）。
  - B 所有更新基于**内存副本**（`historyRef`）读改写 —— 落后的标签页会把同一条记录覆盖回旧值；对 `lastViewedAt` 就是"关标签页登记的新时间被写旧"。
  - C `absorbLegacyTable()` 可重复触发且无标记 —— 旧代码标签页写回的旧整表键会在下次挂载被重新吸收，**已删除的条目复活**。
  - D 同一主题在两个标签页各自生成 → id 是随机时间戳，谁都看不见对方的 id → **两条同主题记录**（正是"两边历史各看各的"的一部分）。
- 顺带：`freeze` 是 **document 上的事件**，此前挂在 window 上，永远不会触发。

**第3步 执行**
- `src/hooks/HistoryContext.tsx` 重写数据层，确立"**磁盘是真相**"：
  - `readItem(id)` 落地为写前重读的唯一入口；`mutate(id, produce)` 以磁盘最新副本为基准读改写（拿不到才回退内存）。
  - `lastViewedAt` 一律取 `Math.max(Date.now(), 磁盘值)` —— **单调不回退**，别的标签页刚刷新的时间不会被本页写旧。
  - `commit()` 不再删内存排序的尾巴；新增 `trimDisk()`：**按磁盘真相排序后**才删键，且只在内存视图确实超限时触发。
  - 新增 `dedupe()`：加载时按 `(type, query)` 归并重复记录（保留 lastViewedAt 较新者，删掉重复键），幂等。
  - 新增 `findByQuery()`：`(type, query) → 记录` 解析，内存未命中时扫磁盘 —— **两个标签页为同一主题生成时复用同一条记录**，不再造重复条目。
  - 迁移改**一次性**：`SCHEMA_KEY`（`ai-office-assistant-history.schema`）写下版本标记后再也不读旧整表键 → 旧键再出现也不会让已删条目复活。
  - `addHistory` 的新建 id 加随机后缀，避免两个标签页在同一毫秒各建一条时撞成同一个键（后写覆盖 = 静默丢数据）。
  - `freeze` 监听到 `document`。
- `src/modules/search/index.tsx`：切到问答模式即 `reset()`（离开搜索视图 → 内容消失 → 走卸载路径登记 `lastViewedAt`），对齐翻译模块口径。
- `src/services/streaming/__tests__/sseReaderTimeout.test.ts`：`elapsedMs >= 30` 在 30ms 超时下偶发（实测 29），改为量级区间断言（这是本次唯一一个既有偶发红）。

**第4步 验证**
- 新增 `src/modules/search/__tests__/searchModeSwitch.test.tsx`（2 例，真实渲染 SearchModule + Provider + mock aiService）。
- 新增 `src/hooks/__tests__/historyMultiTab.test.tsx`（5 例）：关标签页登记不会被写旧（反向验证：去掉 `Math.max` → 立刻红，写回 1000 而不是磁盘的 1789877428054）、跨标签页同主题复用记录、超限裁剪按磁盘口径（r0 在内存里最旧但磁盘上最新 → 必须存活）、迁移只做一次（旧键不复活）、首次迁移摊平。
- **反向验证**：注掉切模式清内容的 effect → `searchModeSwitch` 恰好卡在"切回搜索仍是浏览中"；去掉 `Math.max` → 多标签页第 1 例红。均已恢复。
- `tsc --noEmit` 零错误；`vitest run` **30 文件 / 338 用例全绿**。

**遗留（下一步，等用户定）**
- 收藏（`useFavorites`）、AI 配置（`useAIConfigStore`）、语言（`useLanguageStore`）仍是**整表一个键**，多标签页下同样是"后写者赢"；本次只重构了历史。
- 同一记录被两个标签页**同时写**时仍是后写者赢（单条原子，不会丢整条记录）；如需更强保证要引入版本号/`navigator.locks`，开发期未做。

---

## 2026-09-20（"浏览中"状态收归 Provider + 历史存储改单条键）

**任务类型**：重构优化 + Bug修复（按用户二次反馈与给出的方向）

**第1步 理解需求**
- 用户反馈："很可能缺少内存清理，关闭网页标签，'浏览中'历史时间仍然没刷新，应该单独处理此状态，'浏览中'内容消失时必须走卸载路径。还有，多标签页同时打开'整表覆盖写、后写者赢'效果不相符。"

**第2步 诊断（两个问题同源：状态归属错了）**
- **归属错误**：全应用唯一登记点是 `HistorySidebar` 的 effect cleanup，但侧栏**不是"浏览中"状态的所有者** —— 收起时仍在挂载（`w-0`），关标签页/刷新时更不会被卸载。挂在它上面，`viewingId` 又由侧栏自己从 `items` 里反查，链路一长，任何一环不成立就整类离开漏掉。
- **存储错误**：`ai-office-assistant-history` 是**整表一个键**，每次写入 `JSON.stringify` 全表。多标签页同时打开时，后写的标签页用它内存里的旧快照覆盖整张表 → 另一个标签页刚建的记录消失、刚登记的时间被退回；且删除无法传播（谁写谁覆盖）。
- 顺带发现：4 处模块级散写 `touchHistory(id)` 传的 id 与条目 id 根本对不上（`dict-<ts>` vs `dictionary-<ts>`），纯空转。

**第3步 执行**
- `HistoryContext`：
  - **"浏览中"状态收归 Provider**：新增 `setViewing({types, query})` 声明；Provider 把声明解析成条目 id（`useMemo`），并在声明变化/组件卸载时登记；页面级四个信号 `visibilitychange→hidden`、`pagehide`、`beforeunload`、`freeze` 全部登记 —— **监听挂在常驻 Provider 上**，不再依赖侧栏是否挂载；
  - 新增 `useViewingHistory(type, query)` 声明式 hook（依赖用字符串化 type 签名，避免数组字面量每次渲染都重新登记）；
  - **存储改一条记录一个键**（`…history:<id>`）：写入单条原子；删除即 `removeItem`；`storage` 事件让其他标签页的改动收敛进来（key 为 null = 对方 `clear()`）；旧整表键首次加载摊成单条键后删除；
  - 所有变更收敛到 `commit / upsert / updateById / updateByQuery` 四个内部函数（单一写入出口，`historyRef` 为内存权威副本，写入即同步落盘）。
- `HistorySidebar`：移除全部登记逻辑（含 `touchHistory`、`flushViewing`、页面级监听、`viewingId` 反查），退回纯展示；`currentViewing` 只用来渲染"浏览中"徽标。
- `modules/{search,translate,doc}`：各加一行 `useViewingHistory(...)` 声明；删掉 4 处散写 `touchHistory`（`addHistory` 本就把 `lastViewedAt` 初始化为创建时刻）。

**第4步 验证**
- 新增 `src/hooks/__tests__/historyViewing.test.tsx`（13 例）：登记时机（内容消失 / 声明方卸载 / pagehide / visibilitychange / beforeunload / 无声明不写 / 条目已删不误写 / 事件回调内已同步落盘）+ 多标签页（单条写入原子、外部新建采纳、外部删除采纳、外部改时间采纳、删除即删键）。
- 改写 `historySidebar.test.tsx`：只保留显示/排序/旧数据吸收（登记契约已移走），存储读写改为单条键布局。
- **反向验证**：注掉 `pagehide`/`beforeunload` 监听 → 对应 3 例变红（visibilitychange 那几例保持绿，证明不是"整体都红"）；均已恢复。
- `tsc --noEmit` 零错误；`vitest run` **28 文件 / 331 用例全绿**；dev server 能正常编译改动模块。
- 注意：存储布局变更后**已打开的旧标签页请全部刷新**（旧页面仍在写整表键，两套布局并存会互相看不见对方）。

**已知限制**：跨标签页收敛依赖 `storage` 事件（异步、毫秒级），极端竞态下仍可能丢一次写入；未引入墓碑/版本号机制（开发期不值得，且会显著放大复杂度）。

---

## 2026-09-20（退出应用页面时登记最后浏览时刻）

> **已被同日后续条目取代**：本条把登记挂在 `HistorySidebar` 上并补了页面级监听，但用户复测仍不生效 ——
> 根因是侧栏不是"浏览中"状态的所有者（见上方"浏览中"状态收归 Provider 一条）。本条保留作为过程记录。

**任务类型**：Bug修复

**第1步 理解需求**
- 用户反馈："历史记录时间刷新逻辑有问题，退出应用页面 lastViewedAt 表现为没有刷新。"
- 即：正在浏览某条记录时直接关闭标签页 / 刷新 / 切到其他 Tab，下次打开该记录仍显示上次的旧时间。

**第2步 诊断（两个独立缺口叠加）**
- **缺口一：登记入口只有 React 侧。** 全应用唯一 touch 点是 `HistorySidebar` 的 effect cleanup（切换条目 / 清空内容 / 卸载切功能页）。但"退出应用页面"（关标签页、刷新、切后台）时 React **不会卸载组件** → cleanup 永不执行 → 这次离开没被登记。
- **缺口二：持久化走 effect。** `touchHistory` 只 `setState`，落盘靠 `useEffect([history])`；页面卸载时该 effect 同样不会执行 —— 就算补了页面监听，只 setState 依然会丢，必须**同步落盘**。

**第3步 执行**
- `HistoryContext`：
  - 抽出 `applyTouch(items, id, now)` 作为 touch 的唯一实现（改 lastViewedAt + 按 lastViewedAt 排序，与 `getHistoryByType` 基准一致）；
  - 新增 `historyRef`（每次提交后同步），`touchHistory` 用它算出新列表后**直接 `saveToStorage(next)`**，再 `setHistory`（函数式更新，避免覆盖同一批次的其他更新）。
- `HistorySidebar`：
  - 把 cleanup 里的登记逻辑抽成 `flushViewing()`（幂等：登记后置空 ref）；
  - 新增页面级监听：`visibilitychange → hidden`（切到其他 Tab / 最小化 / 移动端切后台）+ `pagehide`（刷新 / 关闭 / 跳走，含 bfcache 进出），两者都调用 `flushViewing()`。监听随侧栏卸载而移除，模块切换后不会残留。

**第4步 验证**
- 新增 4 条契约测试：切 Tab 登记、pagehide 登记、"事件回调内已同步落盘"（**刻意不用 `act` 包裹**：dispatch 返回后立刻读 localStorage，只有同步写才读得到）、不在浏览中时不写入。
- **反向验证**（确认测试真能锁住回归）：注掉 `saveToStorage` → 仅"同步落盘"那条变红；注掉两个 `addEventListener` → 三条登记用例变红、无浏览中的那条保持绿。均已恢复。
- `tsc --noEmit` 零错误；`vitest run` 27 文件 / 324 用例全绿。

**已知限制**（沿用既有设计，本次未变）：多标签页同时打开时是"整表覆盖写"，后写者赢 —— 后写的那个标签页不会带上另一标签页刚改的条目。

---

## 2026-09-20（生成中断提示衔接内容末尾 + 尾部快照兜底）

**任务类型**：Bug修复（用户带截图反馈）

**第1步 理解需求**
- 用户截图：搜索模块**内容已渲染**，页面**顶部**却压着红色横幅"流式生成结束但未解析出有效 JSON（已收到 9634 字符）"。
- 用户原话："知识内容生成逻辑不够健全，很明显错误提示部分应衔接在内容最后。"
- 拆成两件事：① 生成逻辑凭什么把"已渲染的内容"判成失败；② 提示该落在哪。

**第2步 诊断（先复现，再改）**
- 写临时探针测试喂 `StreamingJSONParser` 三种尾部形态，确认根因：**续写轮把第二份 JSON 追加在第一轮文本之后**，整段文本不再合法，`finish()` 返回 `null`；
  - 但 `push()` 期间早已产出 `mindMap`/`concepts` 等可渲染快照 → 内容看得见，"解析失败"是**错误归因**（用解析器的返回值代表用户的结果）。
- 位置问题：`GenerationNotice` 挂在标题头下方、错误横幅挂在页面顶部 —— 提示说的是"末尾没写完"，位置却在开头。

**第3步 执行**
- `baseAIProvider.generateStream`：新增 `lastRenderable`（`onDelta` 里记录最后一份非空快照）；判定改 `finalSnap.data ?? lastRenderable`；只有"全程零可渲染快照"才抛 `GenerationInterruptedError`（parse）；走兜底时打 `truncated` + `incomplete`（内容侧归因）。
- `useSearchStateMachine`：失败/异常但已有内容 → `error: undefined`，理由写进 `interruption`；`toFriendlyError` 补 `GENERATE_FAILED` → 通用失败文案（技术细节只进 `interruption.detail`）。
- 位置统一（三个出口同一口径）：`KnowledgeContentView`（搜索 + 收藏知识详情）、`DocResult`（文档）、`favorites` 文档详情 → `GenerationNotice` 全部落到内容末尾；`SearchContainer` 删顶部横幅，无内容时原因写在空状态卡内，有内容时写在内容末尾。
- 测试：新增 `generateStreamPartial.test.ts`（3 例）；改写 `useSearchStateMachine.test.tsx` 半截超时 / 未分类异常 2 例的契约。

**第4步 验证**
- `tsc --noEmit` 零错误。
- `vitest run`：**27 文件 / 320 用例全绿**（首轮跑出 2 例红 —— 正是被本次改动改写的旧契约，确认无其他回归后逐条更新断言）。

---

## 2026-09-20（历史时间戳模型收敛：lastViewedAt 单一基准）

**任务类型**：重构优化（按用户指正收敛数据模型）

**第1步 理解需求**
- `lastViewedAt` 初始值应为**历史记录创建时刻**（创建即初始化），而非"浏览中消失前一直缺省"；
- 历史排序应以 **lastViewedAt** 为唯一基准；
- 旧数据处理：加载时一次性挑"最后浏览时间"（旧模型下即 `timestamp`）转换为 `lastViewedAt = timestamp`，转为新数据格式，显示层不再有 `?? timestamp` 回退。

**第2步 执行**
- `HistoryItem.lastViewedAt` 从可选改为**必填**；
- `HistoryContext` 加载 localStorage 时 `migrateLegacy`：无 `lastViewedAt` 的记录补 `lastViewedAt = timestamp`（随持久化落库，一次性转换）；
- `addHistory`：新建条目 `timestamp = lastViewedAt = now`；复现已有条目只刷 `lastViewedAt`（`timestamp` 保留创建时刻语义）；
- `updateSession` / `updateSearchSessionWithData` 去掉条目级 `timestamp` 刷新（会话数据内部的 `data.timestamp` 保留）；
- `touchHistory`（浏览中消失时唯一调用点）只写 `lastViewedAt`；`touchHistory` 与 `getHistoryByType` 排序基准全部从 `timestamp` 换为 `lastViewedAt`；
- `HistorySidebar` 显示 `formatRelativeTime(s, item.lastViewedAt)`，无回退。

**第3步 验证**
- `tsc --noEmit` 零错误。
- `historySidebar.test.tsx` 增至 7 用例（新增：旧数据加载迁移并落库、排序以 lastViewedAt 为唯一基准）；全量 `vitest run` 26 文件 / 317 用例全绿。

---

## 2026-09-19（历史时间戳统一：最后浏览时刻模型）

**任务类型**：Bug修复（遗留问题）+ 重构优化

**第1步 理解需求**
- 遗留问题：此前只修了搜索模块"切换记录"路径的"刚刚"标记；**切换模式**（搜索↔问答、词典↔翻译）离开的记录回来仍显示"x分钟前"。
- 用户指定统一模型：历史记录需两个时刻 —— `lastViewedAt`（条目从"浏览中"变为不浏览时的最后浏览时刻）+ 实际时间；显示 = 实际时间 − 最后浏览时刻。

**第2步 执行**
- 根因复盘：旧实现是**散点式 touch**——各模块在自己知道的三两条"离开路径"上刷新 `timestamp`，路径清单永远枚举不全（这次漏的就是切模式）。
- 统一方案（按用户指正收敛）：`HistoryItem` 新增 `lastViewedAt`，**只在"浏览中"消失的那一刻登记**——共享 `HistorySidebar` 的 effect cleanup 统一捕获所有离开路径（切换条目 / 清空内容 / 卸载切功能页），单点无轮询。显示侧 = `now - lastViewedAt`（两个时刻相减），时钟每秒走表（`useTimeRefresh(1000)`），"刚刚 → x分钟前"自然递进。
- 显示侧：`item.lastViewedAt ?? item.timestamp`（旧数据迁移安全）；格式化抽成唯一实现 `src/utils/time.ts` 的 `formatRelativeTime`（HistorySidebar 与 FavoriteContent 的重复实现收拢）。
- 删除散点 touch：search/index.tsx 的 `touchCurrentViewing` 及两处调用、handleHistoryClick 的 touch、useSearchMode `clearQAMessages` 的 touch、translate/doc `handleHistorySelect` 的 touch。
- 删除死代码：`src/hooks/useHistory.ts`（与 HistoryContext 重复的旧实现，零引用）。

**第3步 验证**
- `tsc --noEmit` 零错误。
- 回归测试 `historySidebar.test.tsx`（6 用例：刚离开浏览→刚刚、5分钟→5分钟前、旧数据回退、浏览中消失登记、侧栏卸载登记、无浏览不 touch），连同全量 `vitest run` 26 文件 / 316 用例全绿。

---

## 2026-09-15（修订：概览留在标题卡内 —— 搜索页观感优先）

**任务类型**：Bug修复（回归修复）+ 文档维护

**第0步 读取文档**：`design.md`（§10.8 内容渲染一致性）、`convention.md`、`workflow-manager.md`

**第1步 理解需求**
- 用户指出：**"搜索页的概览效果不能变！"**
- 即上一条修复（把 `summary` 单独挪进内容区）虽然让收藏页拿到了概览，却把搜索页的概览从标题卡里搬了出去 —— 观感回退，要求不可接受。

**第2步 确认需求**
- Bug修复（自身上一版引入的回归），按规范跳过确认直接执行。
- 约束明确：**收藏页要有概览** 且 **搜索页概览观感不变** —— 两个条件必须同时成立。

**第3步 执行任务**

1) 复盘：错在"只搬字段、没搬容器"
   - 概览的视觉容器是**标题卡**（它是紧跟标题的引导段），容器留在外壳里，字段搬走就等于把观感拆散。
   - 判定规则更正为：**模型生成的内容字段，必须连同它的视觉容器一起落在共享实现内。**

2) 落地：把标题头与中断提示整体收进 `KnowledgeContentView`
   - 新增 props：`headerActions?`（页面级操作插槽）、`fallbackTitle?`（`topic` 为空时的标题兜底）。
   - 渲染顺序：**标题头（标题 + 概览）→ 中断提示 → 思维导图 → …**，与搜索页原有顺序逐帧一致
     （标题卡类名、`text-2xl` 标题、`text-base` 概览、渐变与边框全部沿用原样）。
   - 卡片内部改用 `flex flex-col gap-3`：有标题时的 12px 间距与原来的 `mb-3` 等值；无标题时不会留空档。
   - 中断提示一并收进来（此前搜索页自己渲染）—— 新增入口不会再忘记接入。

3) 两个外壳回到"只留页面级部件"
   - `SearchResults`：只剩操作栏（收藏/复制/导出）+ loading；删掉标题卡与 `GenerationNotice`。
   - 收藏详情（知识）：`<KnowledgeContentView … headerActions={<BackButton/>} fallbackTitle={label} />`；
     标题从 `text-xl` 统一为 `text-2xl`（与搜索页一致），返回按钮移到标题卡右上角。

4) 补测试：把"搜索页观感"钉死
   - `searchResultsLatex.test.tsx`：断言概览与标题**同处一张卡**（`h2.parentElement.parentElement` 带 `from-teal-50`）、标题在前概览在后、公式不裸露。
   - `favoritesDetail.test.tsx`：同一条结构性断言，锁住两个入口一致。

**第4步 验证**
- `tsc --noEmit` 零错误。
- `vitest run` **25 文件 / 310 用例全绿**。

**第5步 汇总反馈**
- 搜索页标题卡、概览字号与位置与修改前完全一致；收藏详情获得同样的标题卡与概览。
- 变更已提交并推送。

**产出**
- 改：`components/knowledge/KnowledgeContentView.tsx`、`modules/search/SearchResults.tsx`、`modules/favorites/index.tsx`
- 改测试：`modules/search/__tests__/searchResultsLatex.test.tsx`、`modules/favorites/__tests__/favoritesDetail.test.tsx`
- 同步文档：worklog / progress / issues / design（§10.8 归属规则更正）

---

## 2026-09-15（收藏内容补全：概览 summary 归位 + 导出口径统一）

**任务类型**：Bug修复 + 文档维护（组合）

**第0步 读取文档**：`convention.md`、`workflow-manager.md`、`project-document-manager.md`、`todo.md`、`issues.md`、`design.md`

**第1步 理解需求**
- 用户报告：收藏详情**内容不全，没有 summary（概览）部分**；要求补全，最后提交 Git 推送。

**第2步 确认需求**：Bug修复，按规范可跳过确认直接执行。

**第3步 执行任务**

1) 定位：概览被写在了**外壳**里，不在共享内容区
   - `summary` 只出现在 `SearchResults.tsx` 的标题卡内部（页面外壳），`KnowledgeContentView`（共享内容区）里**没有它**。
   - 上一轮把内容主体收敛成唯一实现时漏掉了 summary —— 它和外框的标题放在一起，于是被当成了"标题头的一部分"。
   - 收藏详情渲染的正是「标题头 + 共享内容区」，所以 summary 整段消失。

2) 归位：把 summary 放回共享内容区 → `components/knowledge/KnowledgeContentView.tsx`
   - 新增「概览」块，排在思维导图之前（与字段产出顺序一致），**独立门控**，不挂在任何后续区块之下。
   - 判定标准写进组件注释：**模型生成的内容字段一律放这里；外壳只放标题 / 中断提示 / 操作栏**。

3) 外壳去掉重复渲染 → `modules/search/SearchResults.tsx`
   - 标题卡只保留 topic，删除随之失效的 `LatexText` 引用。
   - 视觉变化：概览从"标题卡里的大字"变为"标题下方独立的概览卡片"，文案与字号不变。
   - ⚠️ **这一步是错的，当天已修订**（用户："搜索页的概览效果不能变！"）：只搬字段没搬容器，观感回退。
     最终形态见上一条「修订：概览留在标题卡内」—— 标题头与概览整体留在同一张卡里。

4) 顺手修掉同类的第二处"内容不全" → `utils/export.ts`
   - `generateKnowledgeNote()` 导出 txt / md / html **从未输出 summary**，而「复制」生成的 Markdown 一直有它 → 同一份内容两个出口口径不一致。
   - 已在标题之后补上概览段（与「复制」对齐）。

5) 补测试（防回归）
   - `favoritesDetail.test.tsx`：+1 例 —— 收藏详情必须出现概览文本。
   - `searchResultsLatex.test.tsx`：+1 例 —— 概览移入共享区后搜索页照常渲染。
   - `utils/__tests__/export.test.ts`（新增）：3 例 —— 概览在 txt / md / html 三种格式都在、位置在标题之后、缺省时不产出 `undefined`。

**第4步 验证**
- `tsc --noEmit` 零错误。
- `vitest run` **25 文件 / 310 用例全绿**（原 24 / 305，净增 5）。

**第5步 汇总反馈**
- 概览在搜索页与收藏详情页**同源**渲染；导出与复制口径统一。
- 变更已提交并推送（本仓库开发期约定：改动即提交）。

**产出**
- 改：`components/knowledge/KnowledgeContentView.tsx`、`modules/search/SearchResults.tsx`、`utils/export.ts`
- 新增：`utils/__tests__/export.test.ts`
- 改测试：`modules/favorites/__tests__/favoritesDetail.test.tsx`、`modules/search/__tests__/searchResultsLatex.test.tsx`
- 同步文档：worklog / progress / issues / todo / design / README

---

## 2026-09-15（收藏内容渲染一致性：公式 / 思维导图 / 配图全链路打通）

**任务类型**：Bug修复 + 重构优化 + 测试任务 + 文档维护（组合，取完整流程）

**第0步 读取文档**：`convention.md`、`workflow-manager.md`、`project-document-manager.md`、`lessons/logic.md`、`todo.md`、`issues.md`、`design.md`

**第1步 理解需求**
- 用户报告：收藏的内容**不支持公式格式**、**也不能展示思维导图**；要求排查内容处理上的隐藏问题，尤其边界情况。

**第2步 确认需求**：Bug修复 + 重构优化，按 worklog 规范可跳过确认（不涉及需求边界选择），直接执行。

**第3步 执行任务**（先定位真因，再动手）

1) 诊断：收藏详情是**手写的第二套渲染实现**
   - `modules/favorites/index.tsx` 详情视图用裸 `<p>{data.summary}</p>` 输出 → `$...$` 公式原样裸露（未走 `LatexText`，违反"所有 AI 文本唯一渲染入口"的项目铁律）。
   - `mindMap` 只 `slice(0, 8)` 取标题平铺成标签 → 没有真正的思维导图（`MindMap` 组件私有在 `SearchResults.tsx` 内部，收藏侧拿不到）。
   - 概念配图的四条通道（image / imageData / imageQuery 检索 / svg）、notation、keyPoints、pitfalls、knowledgeContext、试题选项与试题配图 —— 在收藏里**全部丢失**。
   - 文档收藏用 `whitespace-pre-wrap` 直接输出原文 → Markdown 标记与公式源码一起裸露。
   - **根因是"双实现漂移"**：搜索侧每新增一个字段，只有搜索页会显示，收藏侧永远落后。逐字段打补丁治不了。

2) 抽取唯一实现 → 新增 `components/knowledge/KnowledgeContentView.tsx`
   - 把 `MindMap` / `ExamQuestionCard` / `ConceptIllustration` / `normalizeGenerated` / `conceptTypeLabel` / `examTypeLabel` 从 `SearchResults.tsx` 整体迁出并导出，新增 `KnowledgeContentView`（思维导图 → 核心概念 → 知识脉络 → 试题 → 趣味知识）。
   - `SearchResults.tsx` 改为引用共享实现：删掉约 600 行重复 JSX，页面外壳（标题 / 中断提示 / 操作栏 / loading）行为不变。

3) 收藏详情接入共享实现 → `modules/favorites/index.tsx`
   - 知识：标题 + `GenerationNotice` + `KnowledgeContentView`。
   - 文档：改用与文档模块同一个 Markdown+公式渲染器，并补上中断提示（之前从未接过）。
   - 词典 / 翻译：文本字段统一走 `LatexText`；四个分支重复的返回按钮抽成 `BackButton`。
   - 旧 `KnowledgeCardData` 兜底分支保留，并接入 `LatexText`。

4) 边界修复（本次重点）
   - **格式判据真 bug**：旧判据 `typeof topic === 'string' && Array.isArray(concepts)` 会把"有 topic 但 concepts 缺失/为空数组"的收藏误判成旧格式 → 去渲染不存在的 `title/definition/points` → 详情页近乎空白。改为 `isGeneratedKnowledge()`（按 `topic` / 顶层 `type` 语义判定）。
   - **思维导图脏数据会白屏**：`calculateNodeSize()` 要读 `title.length`，任一节点缺 `title`（localStorage 旧数据）就抛异常。新增递归 `sanitizeMindMap()`，非法节点整支丢弃（宁缺勿崩）。
   - **`$$...$$` 公式漏美元符号**：`LatexText` 切分正则原先只有 `$[^$\n]+$`，对 `$$E=mc^2$$` 会从**第二个** `$` 开始匹配，首尾各漏一个 `$`（模型写块级公式很常用）。把 `$$...$$` / `\[...\]` 排到前面，并按块级模式渲染。
   - **列表预览裸露源码**：摘要直接 `slice(0, 60)` → 预览里出现 `$x>0$` / `## 标题`，且截断点可能把公式从中间剪断。新增 `utils/preview.ts` 的 `toPlainPreview()`：先去围符与 Markdown 标记、折叠空白，再截断（并避免留下半截反斜杠命令）。
   - **收藏保存静默失败**：localStorage 超配额时旧实现只 `console.error`，而此时内存里的数组已改 → "界面显示已收藏、刷新后消失"。改为：完整写入失败 → 剥离 base64 `imageData` / `svg` 重试（保住全部文字）→ 仍失败才置 `failed`，并通过 `storageWarning` 在收藏页显示分档横幅。
   - **去重口径不一致**：`addFavorite` 用 `JSON.stringify` 深度比对（对含几 MB base64 的对象逐条序列化，是性能陷阱），且与星标判定（只比标题）口径不同 → 会"显示已收藏、点一下却又新增一条"。统一为「类型 + 收藏夹 + 标题」指纹。

5) 新增 LaTeX 感知的 Markdown 渲染器 → `components/ui/MarkdownContent.tsx`
   - ReactMarkdown 负责结构，`p/li/td/th/h1~h6/blockquote` 的字符串子节点交给 `LatexText`；`code` / `pre` 内部不解析（代码里的 `$` 是字面量）。`DocResult` 与收藏的文档视图共用。

**第4步 验证**
- `tsc --noEmit` 零错误；`vitest run` **24 文件 / 305 用例全绿**（原 277，净增 28）。
- 新增/扩写测试：`favoritesDetail`（8 例）、`markdownContent`（6 例）、`preview`（8 例）、`useFavorites` 存储降级（3 例）、`latexText` 块级围符（+3 例）。
- `vite build` 成功（750 modules；临时输出目录已清理）。

**第5步 汇总反馈**：向用户说明真实根因（双实现漂移 + 6 处边界缺陷）、改动文件、验证结果、遗留项；变更未提交 git（按项目规范由用户手动提交）。

---

## 2026-09-15（v1.7.0：生成中断分类 + 全场景续写 + 错误处理 + 版权正式发布）

**任务类型**：Bug修复 + 重构优化 + 发布任务 + 文档维护（组合，取完整流程）

**第0步 读取文档**：`convention.md`、`lessons/`、`issues.md`、`versions.md`、`history.md`、`todo.md`、`design.md`（流式章节）、`project-document-manager.md`

**第1步 理解需求**
- 需求 A：把"添加了版权声明"的版本标记为**正式发布版本里程碑**。
- 需求 B：内容生成"模型超限 / 网络超时异常"没有明确区分界限，出现**内容未完全生成就自动截止且无提示**；续写仅覆盖模型超限（实际几乎不会超限），要求扩展到其他异常中断；并优化错误处理。

**第2步 确认需求**（用户选择）
- 版本号 → **v1.7.0**（正式发布）
- 续写边界 → **全链路可续写 + 无内容时限 1 次重发 + 总请求数硬上限 3**
- 提示方式 → **按原因分档横幅**（并用 `AskUserQuestion` 三问一次确认）

**第3步 执行任务**

1) 诊断（定位真因，不猜）
   - `truncated` 只是布尔，"为什么没写完"信息在链路中丢失 → UI 把网络中断报成"模型输出上限"。
   - `withFallback` 对未分类异常走兜底 → 返回 `success:true + 空结构体` → 状态机丢弃已流出内容、回 IDLE、只剩笼统"生成失败"（"无任何提示"的真因）。
   - 续写循环在**首轮**遇到链路异常就上抛 → "仅模型超限会续写"正是这么来的。
   - 文档模块 / 追问流根本没接 `truncated`/`continued` → 完全无提示。

2) 建立中断分类模型 → 新增 `services/streaming/interruption.ts`
   - 四类归因：**模型侧**（length / content_filter）、**链路侧**（timeout / network / protocol / http）、**内容侧**（incomplete / parse）、**用户侧**（aborted），每类带标准 code 与是否可重试。
   - `sseReader` 新增 `StreamNetworkError` / `StreamAbortedError`；`callModelStream` 用 `fetchOrThrow()` 把裸 `TypeError: Failed to fetch` 归类为链路中断。

3) 续写扩展到全链路 → 重写 `callModelStreamWithContinuation`
   - 每一次 HTTP 轮次结束后按 `isComplete` + 中断归因决定是否再发：有内容 → 回填续写；一个字都没有 → **按原 prompt 重发 1 次**。
   - 硬上限 `MAX_GENERATION_ATTEMPTS=3`；content_filter / aborted / 非 JSON 内容不重试。
   - 返回结构化 `interruption`（kind / side / attempts / continued / resolved）。
   - **修掉一个真边界 bug**：catch 里原本用"本轮开始前"的 `hasContent` 快照判断有无内容 → 重发轮"吐了内容才断"会被当成空内容直接上抛，丢掉整段内容；改为用本轮结束后的累积量，并新增回归测试。

4) 错误处理分层 → `withFallback` 增加 `strict`
   - 生成类调用（search generate/generateStream/followupStream、doc generate/generateStream）异常一律 `success:false + code`，不再吞成"成功但空"；HTTP 错误带 `aiError` 透传厂商 code。
   - 状态机 `toFriendlyError` 覆盖全部 code；失败但已有内容时保留内容并挂归因；catch 统一走 `classifyThrown`。

5) 提示分档 → 新增 `components/ui/GenerationNotice.tsx`
   - 按 `side` 配色（链路侧 rose / 模型·内容侧 amber / 已补全 teal）、按 `kind` 取文案，附"已自动续写 N 次仍未补全"；兼容旧历史数据。
   - 搜索与文档模块共用；i18n 新增分档提示 + 8 条错误文案（中英同步，英文作类型基准）。

6) 立 v1.7.0 正式发布里程碑 → `versions.md`（含版权声明 + LICENSE + 仓库清理 + 本次链路治理 + 关键行为契约表）。

**第4步 记录日志**：本条目；同步 `.workbuddy/memory/2026-09-15.md`

**第5步 汇总反馈**：见本轮最终回复

### 验证
- `tsc --noEmit`：零错误
- `vitest run`：**20 文件 / 277 用例全绿**（净增 47：中断分类 19 + 全链路续写与归因 11 + strict fallback 6 + 分档提示组件 11）
- `vite build --outDir dist_verify_v17`：成功（747 modules），验证后已删除临时目录

---

## 2026-09-14（剔除垃圾文件 + 修复仓库污染）

**任务类型**：重构优化（仓库卫生）
**触发**：用户"请剔除垃圾文件"→ 确认范围时明确"请解决仓库污染的情况"。

**做法**：先**只读扫描**并出具清单（不动手），确认后再执行；全程区分「可删 / 待定夺 / 必留」三档。

**核心问题：`dist/` 被 git 追踪 64 个文件**
- 根因：`.gitignore` 写了 `dist`，但这些文件在加 ignore **之前**就提交了——ignore 只影响未追踪文件，**不会自动取消已追踪文件**。
- 可安全去追踪的依据：`vercel.json`(`buildCommand: npm run build` + `outputDirectory: dist`) 与 `netlify.toml`(`command: npm run build` + `publish: dist`) 均由**平台从源码构建**，仓库内 dist 非部署所需 → 纯污染。
- 处理：`git rm -r --cached dist`（出索引、**保留本地文件**），`git check-ignore` 确认忽略规则生效。

**清理的可再生临时产物（≈5.9 MB）**
| 项 | 规模 |
|---|---|
| `dist_verify/` | 69 文件 |
| `.workbuddy/eval_shots/` | 55 项 |
| 根目录 `*.timestamp-*.mjs` | 20 个（vite 6 + vitest 14）|
| `vitest_out.txt` | 1 |
| `remotion-videos/render_log.txt` | 1 |

**环境坑**：`Add-Type` 被安全策略拦截，PowerShell「送回收站」方案不可用；改用直接删除（均为 gitignore 的构建/调试产物，可再生）。

**保留（判定非垃圾）**：`node_modules`(依赖)、`src`、`docs`、`.workbuddy/{memory,skills}`、`config`、`.vercel`、`remotion-videos/output/*.mp4`(成品)、`remotion-videos/public/assets/`(11MB 素材，有复用价值)、`评测报告-知识灵动助手.md`。

**遗留待定**：`.trae/`(41 文件 IDE 工作区)、`remotion-videos/node_modules`。

---

## 2026-09-14（README 全量纠错）

**任务类型**：文档维护
**触发**：用户要求——"项目的 README 有很多错误说明，请更正"。
**方法**：逐条到代码取证（package.json / 类型枚举 / 目录树 / i18n 字符串 / vite.config / server.js），只改与代码不符者。

**修正清单（10 处）**：
- 技术栈表删除 `图标 = Lucide React 0.x`（无此依赖、0 引用），改「内联 SVG」。
- `npm test` 用例数 142 → **230（18 文件）**。
- 超限续写"最多 3 次" → 「首轮 1 次 + 最多 2 次续写」。
- 删除不存在的功能「搜索范围标签」。
- AI 厂商列表去重（硅基流动 ≠ SiliconFlow），明确 **8 家预设**。
- 版本历史补 **v1.6.1 / v1.6.2**（标注当前版本）。
- 项目结构补齐 `services/wanxImage.ts`、`components/ui/LatexText·ImageFigure·ConfirmDialog`、`modules/search/services/QAService`。
- 收藏空间补充"支持自定义新建/改名/换色/删除"。
- 新增 `docs/worklog.md`、`docs/lessons/` 到文档索引。

**新增文件**：`LICENSE`（MIT，Copyright (c) 2026 ceepuka）——原 README 声明 MIT 却无 LICENSE 文件，补齐后声明属实。
**保留核对无误项**：11 种文档类型、导出格式、翻译风格（学术/商务/日常）、邮件语气、输入上限（120/3000）、端口（5173/3000）、死代码标注。

**待定**：`package.json` 的 `version` 仍为 `0.1.0`，与 v1.6.2 不一致，未擅改。

---

## 2026-09-14（页脚新增版权声明）

**任务类型**：开发任务 + 测试任务
**触发**：用户要求——应用页脚"知识灵动助手 - AI驱动的知识办公应用"下加入版权声明，署名 GitHub 账号 ceepuka。
**改动**：
- `src/i18n/strings/common.ts`：`app` 段新增 `copyright` 键（En 基准 + Zh），含 `{year}` / `{author}` 占位符。
- `src/App.tsx`：footer 拆两行，`fmt` 填年份，作者名切出渲染为 `https://github.com/ceepuka` 链接。
- 新增契约测试 `src/i18n/__tests__/strings.test.ts`（3 条）锁定占位符契约。
**验证**：tsc 零错误；全量 18 文件 / 230 用例全绿。

---

## 2026-09-13（修复试题解析"乱编"：解析禁止离题 + 续写防推翻前文）

**任务类型**：Bug修复 + 测试任务 + 文档维护
**触发**：用户报障（截图）——复数题解析出现离题乱编（"几道经典题""信雅达千字文""采用 2022 年全国乙卷真题"）及多套解法交织。
**改动**：
- `baseAIProvider.ts` 严谨性铁律新增第 5 条「解析只写本题推导，禁止一切离题内容」；examQuestions 第 6 点补 explanation 字段级写法约束；续写提示词（`buildJSONContinuationPrompt`）补"不得推翻前文""不得插入无关话题"。
- `baseAIProvider.test.ts` 新增契约 1 条（解析禁止离题/自我标榜/罗列多题/多套解法）。
**验证**：tsc 零错误；227 用例全绿。

---

## 2026-09-13（优化对话效果：防"反斜杠被吞" + 公式渲染失败时给视觉信号）

**任务类型**：Bug修复 + 测试任务 + 文档维护
**触发**：用户报障（截图）——对话里大量公式渲染失败，模型吞 `\`（`\frac` → `rac`、`\triangle` → `riangle`）；`LatexText` 失败时裸输出无视觉信号；气泡行间紧。

### 修复
- **Prompt 层**：`buildFollowupSystemPrompt` 升格"反斜杠绝不能省"专条，给出 `'\frac' 不能写 'rac'` 等具体反例。
- **渲染层**：`LatexText` KaTeX 失败时包 `<code class="latex-fallback">`（等宽字体+浅琥珀背景+左侧细色条+`title="公式源码（未能渲染）"`），textContent 仍为原文。
- **对话气泡样式**：`QASection.tsx` 加 `leading-relaxed + break-words + whitespace-pre-wrap + py-2.5`。
- **坑**：TS 模板字符串里 `'\frac'` 被 JS 解析成 form-feed（`\f`）+ `rac`，反斜杠消失——必须用 `'\\frac'`（双反斜杠源）。

### 验证
- tsc 零错误；全量测试 226 用例全绿（新增 latex-fallback 契约 2 条 + followup"反斜杠不能省"契约 1 条）。

---

## 2026-09-13（所有对话支持公式格式）

**任务类型**：Bug修复 + 测试任务 + 文档维护
**触发**：用户要求"所有对话也要支持公式格式"。

### 修复
- 对话（QA 独立问答 + 搜索追问）都经 `QASection.tsx`，消息内容原来是 `{msg.content}` 纯文本裸输出、公式露源码。
- 渲染层：`QASection.tsx` 换 `<LatexText text={msg.content} />`（用户/助手气泡都换）；Prompt 层：`buildFollowupSystemPrompt` QA/search 两分支补【公式书写规则】`$...$` 约定。

### 验证
- tsc 零错误；全量测试 223 用例全绿（新增 `buildFollowupSystemPrompt` 契约 1 条）。

---

## 2026-09-13（修复知识图谱不显示 + 图谱节点带学科分类）

**任务类型**：Bug修复 + 测试任务 + 文档维护
**触发**：用户报障"知识图谱不显示任何内容"，并要求图谱节点带学科分类（category）。

### 修复
- **根因**：`analyze` prompt 从没要求模型产出 `graphData`，而状态机在 `isSpecific=false` 时依赖它渲染图谱 → 永远 undefined → 空白。
- `KnowledgeGraphNode` 新增 `category`；analyze prompt 新增"第五步·生成知识图谱"（每个节点带 category）；新增 `sanitizeGraphData` 清洗；`selectGraphNode` 透传 category；mock 补宽泛学科图谱。

### 验证
- tsc 零错误；全量测试 222 用例全绿（新增 sanitizeGraphData 契约 4 条 + mock 宽泛学科 2 条）。

---

## 2026-09-13（分类驱动生成 + 历史命中时机修正 + 收藏/导出适配 + 语言适配排查）

**任务类型**：开发任务 + 测试任务 + 文档维护
**触发**：用户提出五点：① 非知识点判定能否简化；② category 分类驱动生成提示词；③ 搜索模式应"AI 分析出知识点后再查历史"（而非原始输入查历史）；④ 复制/导出/收藏适配新内容；⑤ 排查用户语言适配。

### 修复
- **非知识点判定简化**：从"四类枚举"收敛为一条闭合标准——"确信能讲出知识体系才判 true，拿不准判 false 走问答"，覆盖一切有意义非知识点。
- **category 驱动生成**：新增 `buildCategoryDirective(category, knowledgeType)`，按学科注入专属规范（数学/物理/化学/生物/文史社科/计算机），交叉学科与"其他"不套单一学科规则；`generate`/`generateStream` 新增 `context` 参数，状态机透传 `analysisResult`。
- **历史命中时机**：状态机新增 `findExistingSession` 选项，analyze 出 `canonicalTopic` 后、生成前查历史；`handleSearch` 移除原始输入预查。
- **收藏/导出适配**：`handleToggleFavorite` 直接收藏 `GeneratedKnowledge`；favorites 渲染新格式（旧格式兜底）；`showFavorite` 恢复新格式；`export.ts` 文件名兼容 `topic`。
- **语言适配**：`analyze`/`validate` 绑定 `buildLanguageDirective`；`SILICONFLOW_PREFIX` 去硬编码中文。

### 验证
- tsc 零错误；全量测试 216 用例全绿（新增 `buildCategoryDirective` 契约测试 4 条）。

---

## 2026-09-13（意图识别增强：输入分门别类 + 非知识点走问答 + 校验放宽）

**任务类型**：开发任务 + 测试任务 + 文档维护
**触发**：用户要求把"分门别类"拓展到整体——增强 AI 处理用户输入能力：① 学科分类覆盖交叉学科（分子物理/生物化学等），不便归类的知识归"其他"；② 一般输入都是有效信息（网络热梗/作品角色名/游戏设定应切问答），只有乱敲字符才拦截。

### 修复（`baseAIProvider.ts`）
- **`analyze` prompt 增强**：① `isKnowledgePoint=false` 纳入四类"有意义的非知识点"（热梗/角色名/游戏设定/口语闲聊），写"拿不准就判 false 走问答"；② 新增"第四步·分门别类"——推荐学科清单 + 交叉学科取交叉归属 + "其他"兜底；③ 非知识点时 `category` 填"问答"。
- **`validate` prompt 放宽**：改为"只拦截乱敲的无意义输入"（随机字符/键盘乱按/纯表情），拿不准一律 valid=true。
- **mock `analyze` 同步**：非知识点正则补"是什么梗/什么梗/出自哪/的原型"。

### 验证
| 项 | 命令 | 结果 |
|----|------|------|
| 类型检查 | `node ./node_modules/typescript/bin/tsc --noEmit` | ✅ 零错误 |
| 单元测试 | `node ./node_modules/vitest/vitest.mjs run` | ✅ 17 文件 / 212 用例全绿（新增 2 条非知识点用例） |

---

## 2026-09-13（提示词治理进阶：限制处补"应该怎么做" + 画图自检 + 沉淀技能）

**任务类型**：重构优化 + 文档维护
**触发**：用户以专业设计师视角提出：① 提示词强调限制处尽可能补"应该怎么做"，除非简单禁令；② 给出语法分档（必须/否则/应该/而不是/仅当），可提炼为技能；③ 强调 AI 画图后应当检查关键点（当前 AI 不主动检查）。

### 修复（`baseAIProvider.ts`）
- **简单禁令保持原样**：`禁止 <script>`、`只返回 JSON 本身`、"直角不要画成弧"、`sourceLang` 只用代码。
- **"限制处缺怎么做"补正向动作**（"应该 X，而不是 Y"）：`不要编造 URL`→`应该留空字符串（交给检索兜底），而不是编造 URL`；`不编造`→`应该明确说明存疑，而不是编造`；`不得硬填无关图`→`应该改用 imageData/SVG`；`必须只用行内公式`→`只许用 $...$，而不是 $$ 或 \[ \]`。
- **SVG 硬性要求改写 + 新增【画完自检】**：6 条清单——关键点闭合 / 标记对号 / 数值一致 / 符号规范 / 没有多余元素 / 发现对不上必须重画而不是带错输出。

### 技能沉淀
- 新增 `.workbuddy/skills/llm-prompt-writing/SKILL.md`（项目级）：语法分档 + 自检清单 + 反例通常化 + 模板字符串安全。

### 验证
| 项 | 命令 | 结果 |
|----|------|------|
| 类型检查 | `node ./node_modules/typescript/bin/tsc --noEmit` | ✅ 零错误 |
| 单元测试 | `node ./node_modules/vitest/vitest.mjs run` | ✅ 17 文件 / 210 用例全绿 |

---

## 2026-09-12（提示词句式治理·复核收窄适用边界）

**任务类型**：重构优化 + 文档维护
**触发**：用户反馈第一轮句式改写属"过度改写、生搬硬套句式"——点名例子：`禁止 <script>、事件属性、外部图片引用…` 被改成"必须不使用 <script>…；否则图形会被渲染器拦截而完全不显示"，"这里不改才是最好的，过多解释反而不好"。用户明确边界：这类改写**只适用于"在什么……的条件下"或"……不要做……"这类过于复杂的描述**。

### 修正
- **还原为原样**（短小明确、加解释即噪声）：SVG 安全限制、文字标签规则、"画不准就空字符串"、直角符号、【输出格式】注意事项 3 条、【输出顺序】的追加解释、`callModelWithJSON` JSON 约束句、续写要求 1·2、追问 prompt 五条、【image 字段】"Commons 里没有"段、翻译检测 system prompt、`sourceLang` 语言代码、查词 `image` 直链规则。
- **保留改写**（条件句 / 多重禁止，原本难读）：续写要求 3（"如果前面是 JSON……不要重新开始一个新的 JSON"）、电路导线（"交叉处若非连接点……"）、严谨性铁律 4 条、含"如图"试题约束、`imageData` 纯文本模型说明。
- 同步撤销上一轮为此添加的"否则…"长解释。

### 验证
| 项 | 命令 | 结果 |
|----|------|------|
| 类型检查 | `node ./node_modules/typescript/bin/tsc --noEmit` | ✅ 零错误 |
| 单元测试 | `node ./node_modules/vitest/vitest.mjs run` | ✅ 17 文件 / 210 用例全绿 |

---

## 2026-09-12（提示词句式治理：负面约束改为"必须……否则……"）

**任务类型**：重构优化 + 测试任务 + 文档维护
**触发**：用户审阅 `buildGeneratePrompt` 提出三点：①反例"答案写 9W、解析算出 8W"改用"答案是 1、解析是 2"这类更通常的解释；②"绝不编造"改为"确保真实"；③把所有"不要……"改为"必须……否则……"句式（AI 更懂怎么做），并要求含"如图"试题必须配原图/可信链接/精确 SVG，否则舍弃或改写（改写注明"xx年xx考试改编"）。

### 根因
- prompt 约束大量为**否定式**（"不要画成弧""不要实心点""禁止 <script>""不要前后解释"），只声明"不许做什么"，模型缺少可执行动作。
- 反例用具体数值（9W/8W）覆盖面窄，无法迁移到相似题型。

### 修复（`baseAIProvider.ts`）
- 四类 prompt 全篇改写为"**必须 X，否则 Y**"：`buildGeneratePrompt`（严谨性铁律 / 含"如图"约束 / 公式规则 / 输出顺序 / 配图规则 / image / imageData / imageQuery / SVG 各段 / 输出格式）、`buildContinuationSystemPrompt`、`buildFollowupSystemPrompt`、翻译·查词 prompt。
- 反例具体化："答案是 $1$，解析就必须推导出 $1$；若解析算出 $2$……否则必须放弃这道题"。
- "绝不编造"→"**来源必须真实**"（能确定才填，查不到填空字符串）。
- 【含"如图"】重写为"**必须**配图（imageData > image > svg，至少满足其一），**否则**舍弃或改写为等价题型，**必须**注明'（xxxx年xx考试改编）'"。

### 验证
| 项 | 命令 | 结果 |
|----|------|------|
| 类型检查 | `node ./node_modules/typescript/bin/tsc --noEmit` | ✅ 零错误 |
| 单元测试 | `node ./node_modules/vitest/vitest.mjs run` | ✅ 17 文件 / 210 用例全绿（更新 4 条提示词契约断言） |

---

## 2026-09-12（修复模型编造答案 + 题型缺图）

**任务类型**：Bug修复 + 测试任务 + 文档维护
**触发**：用户反馈"模型存在编造内容的情况，目前千问和智谱都没直接给出过原图片数据，出现试题缺图情况"。

### 截图证据
- **截图1（电路题）**：答案"最大功率为 9W"，解析明确算出"8W"——答案与解析自相矛盾。
- **截图2（圆周角题）**：题干含"如图，AB是⊙O的直径"但完全没有图，解析里模型自我怀疑"此题若... / 改原题更可能问的是另一角..."但仍强行给了"55°"答案。

### 根因
1. prompt 只说"内容准确性 > 完整性"，**没有可执行的判断标准**。
2. prompt 让模型"能直接给出图片数据时填 base64"，但**纯文本模型（千问/智谱标准模式）看不到原图**——强行按文字描述想象图形作答 → 答案很可能错 + 没图。
3. 千问 DashScope 的 `reasoning:false` 与实际不符（已发 enable_thinking:false 但能力声明未同步）。

### 修复
- `baseAIProvider.ts` `buildGeneratePrompt` 开头新增两道【最高优先级】约束：
  - **【严谨性铁律】**：答案必须可验证（不确定→examQuestions:[]）、解析必须自洽、不准出现自我怀疑措辞、绝不编造年份/考试名/图片数据。
  - **【含"如图"的试题约束】**：无原图/SVG/可信直链时不要出这道题，或改写为纯文字即可作答。
- `imageData` 字段说明强化：纯文本模型严禁填此项，绝对不要编造 base64。
- `aiProviders.ts`：千问 DashScope 全系列 Qwen3 的 `reasoning:false` → true。

### 验证
| 项 | 命令 | 结果 |
|----|------|------|
| 类型检查 | `node ./node_modules/typescript/bin/tsc --noEmit` | ✅ 零错误 |
| 单元测试 | `node ./node_modules/vitest/vitest.mjs run` | ✅ 17 文件 / 210 用例全绿 |

---

## 2026-09-12（SVG 规则正向画法教学 + 公开图源积极引用）

**任务类型**：重构优化 + 测试任务 + 文档维护
**触发**：用户指出「本项目根本没用多模态能力」是误判——图文并茂是项目核心价值，图是关键；
要求加强 SVG 生图提示词（教会模型怎么画对，而非只写"别画错"）并强化公开图片引用。

### 根因
- 之前的 SVG 规则全是**负面限制**（"只能画什么""画不准就空字符串"），没有正向的绘图步骤，
  LLM 需要的是可执行的画法教学（先画什么、坐标怎么定、符号怎么摆）。
- 公开图库直链（Wikimedia Commons）是图文并茂最可靠的方式，但 prompt 太保守（"拿不准就空字符串"），
  导致模型倾向不给直链。

### 修复（`baseAIProvider.ts` 的 `buildGeneratePrompt`）
1. 重写【SVG 字段规则】为按学科的**具体绘图步骤**（正向教学）：通用骨架 → 数学几何（三角形对边命名/直角符号/等长标记/角弧/直径/平行线）→ 函数图象（坐标轴→刻度→曲线）→ 电路（元件符号+串并联拓扑）→ 受力分析 → 光学（法线+角度）。
2. 强化【image 字段的填写】：标题改为"可信图源直链，优先于手绘 SVG"，引导模型对理科概念按 Commons 规范文件名拼 upload.wikimedia.org 直链。

### 验证
| 项 | 命令 | 结果 |
|----|------|------|
| 类型检查 | `node ./node_modules/typescript/bin/tsc --noEmit` | ✅ 零错误 |
| 单元测试 | `node ./node_modules/vitest/vitest.mjs run` | ✅ 210 用例全绿（更新 1 条 SVG 契约断言） |

---

## 2026-09-12（修复智谱 GLM 生成失败：思维链吃掉 max_tokens 预算）

**任务类型**：Bug修复 + 测试任务 + 文档维护
**触发**：用户反馈"智谱模型很多时候没有内容渲染、总是生成失败，千问正常"。

### 根因（核对智谱官方文档）
1. 智谱 GLM-5.2/5.1 **默认开启深度思考**（thinking 默认 enabled、reasoning_effort 默认 max），先输出大段 reasoning_content。
2. 智谱 `max_tokens` 是总预算（思维链+正文），思维链吃掉预算后正文 JSON 被截断（finish_reason=length）→ 续写也失败 → 生成失败。
3. 千问正常因为 `THINKING_PARAM_PROVIDERS` 只含 dashscope/siliconflow 且发 `enable_thinking:false`；**智谱不在名单，且参数名不对**——智谱关闭思考是 `thinking:{type:'disabled'}`，传 `thinking:false` 会 400。
4. 智谱 capabilities.reasoning 标 false 是错的。

### 修复
- `baseAIProvider.ts`：`THINKING_PARAM_PROVIDERS`(Set) → `DISABLE_THINKING_PARAMS`(Record)，按厂商分派关闭参数：dashscope/siliconflow → `enable_thinking:false`；zhipu → `thinking:{type:'disabled'}`。
- `aiProviders.ts`：智谱 4 型号 capabilities.reasoning 改 true。

### 验证
| 项 | 命令 | 结果 |
|----|------|------|
| 类型检查 | `node ./node_modules/typescript/bin/tsc --noEmit` | ✅ 零错误 |
| 单元测试 | `node ./node_modules/vitest/vitest.mjs run` | ✅ 17 文件 / 208 用例全绿 |

---

## 2026-09-12（排查"模型没生成内容 → 页面空白"）

**任务类型**：Bug修复 + 测试任务 + 文档维护
**触发**：用户反馈"模型没生成内容，但页面是空的，什么也不显示"。

### 根因（多遗漏叠加）
1. **`hasUsableContent` 判定范围过窄**（核心）：只认 `summary/mindMap/concepts` 三者，漏了 `examples/relatedResults/knowledgeContext/examQuestions/interestingFacts`。模型只产出后者（前三者恰好为空）会被误判"无内容"→ 页面空白。
2. **`SearchContainer` 缺"失败空状态占位"**：`state===IDLE && error`（搜索后失败）时只有一条红字 error，下方大块空白。
3. **`runGenerate` 全空分支 `return false` 但没显式设 error**，依赖上层 `search()` 的 `prev.error || generateFailed` 兜底，脆弱且可能残留旧错误。

### 修复
- `useSearchStateMachine.ts`：`hasUsableContent` 扩展覆盖全部实质字段，新增 `knowledgeContextHasContent` helper；全空分支显式 `setContextWithUpdate({ state:'IDLE', error: generateFailed, ... })`。
- `SearchContainer.tsx`：新增 `state==='IDLE' && error && !generatedData` 时渲染带图标的失败空状态卡片。
- i18n 中英文各加 `errors.generateFailedEmpty`。

### 验证
| 项 | 命令 | 结果 |
|----|------|------|
| 类型检查 | `node ./node_modules/typescript/bin/tsc --noEmit` | ✅ 零错误 |
| 单元测试 | `node ./node_modules/vitest/vitest.mjs run` | ✅ 16 文件 / 203 用例全绿 |

---

## 2026-09-12（流式链路诚实化 + 超限续写边界加固）

**任务类型**：重构优化 + Bug修复 + 测试任务 + 文档维护
**触发**：用户要求①移除"黑名单-自愈"脆弱机制，改为拿到什么链路状态就诚实处理什么、有多少内容显示多少内容（流式是增强项非硬性要求）；②检查超限自动续写的边界情况是否兼顾。

### 1. 移除流式"黑名单-自愈"，链路状态诚实处理
- 删除 `streamUnsupported` Map、`markStreamUnsupported/markStreamSupported/isStreamPossiblySupported/resetStreamSupportCache`、`STREAM_RETRY_COOLDOWN_MS` 一整套隐式全局状态。
- `prepareRequest` 的 `wantStream = stream && caps.streaming`（只信静态能力声明）；删 `RequestMeta.caps` 死字段。
- `callModelStream` 重写：传输层失败 / SSE 协议失败 / 首字节超时一律**抛错不重发**；收到增量正常流式；`meta.streaming=false` 走非流式；空内容/只有思维链返回空（不猜）。
- **关键修复**：`withFallback` 原为"吞错器"，会把超时/协议错误吞成 fallback 空结构体 + `success:true`，导致状态机里的超时识别是死代码。现识别 `StreamTimeoutError/StreamProtocolError`，以 `success:false + code(STREAM_TIMEOUT/STREAM_PROTOCOL)` 透传给 UI。

### 2. 超限续写边界加固
- **`hasCompleteJSONObject` 补 `[]` 追踪**：原只跟踪 `{}`，`{"a":[1,2}` 这种数组未闭合会被 `}` 让花括号深度归零而误判"完整"，进而跳过续写 → 半截收尾。现同时跟踪 `{}` 与 `[]`，任一类未闭合都判不完整。
- **`callModelStreamWithContinuation` 续写循环**：①续写轮返回空 content → 提前 break，不空转浪费次数；②续写轮抛链路错误 → catch 保留已累积内容并结束（truncated=true），不再让异常中断导致 `parser.finish()` 收尾丢失尾巴；③首轮异常仍上抛。

### 3. 验证
| 项 | 命令 | 结果 |
|----|------|------|
| 类型检查 | `node ./node_modules/typescript/bin/tsc --noEmit` | ✅ 零错误 |
| 单元测试 | `node ./node_modules/vitest/vitest.mjs run` | ✅ 16 文件 / 189 用例全绿 |

### 4. 修改文件清单
| 文件 | 操作 | 关键变更 |
|------|------|---------|
| `src/services/baseAIProvider.ts` | 编辑 | 删黑名单全套；`hasCompleteJSONObject` 补 `[]`；`callModelStream` 诚实化；`withFallback` 链路错误透传；`callModelStreamWithContinuation` 续写边界 |
| `src/modules/search/useSearchStateMachine.ts` | 编辑 | `toFriendlyError` 统一错误码映射；`!res.success` 分支仅在有链路 code 时写具体错误 |
| `src/services/__tests__/streamFallback.test.ts` | 重写 | 黑名单契约 → 链路错误透传契约（5 条） |
| `src/services/__tests__/continuation.test.ts` | 编辑 | +数组括号边界 + 续写循环边界（4 条） |
| `docs/design.md` | 编辑 | §10.2 改"链路状态处理"；§10.3 补边界加固说明 |
| `docs/progress.md` | 编辑 | m016/m018/m023 状态更正 + m025 新增 |

### 5. 经验教训
1. **"吞错器"会把上层的错误处理变死代码**：`withFallback` 兜底所有异常，会让状态机里针对具体异常类型的处理永远走不到——链路错误必须显式透传，业务错误才兜底。
2. **括号配对判定要覆盖全部括号类型**：只判 `{}` 会让数组未闭合漏判；完整性判定的错误代价是"半截内容悄悄收尾"，比多一次续写更糟。
3. **续写轮异常不能中断首轮成果**：多轮生成里，后续轮的失败不应吞掉已成功生成的内容——catch 保留 accumulated 比让异常冒泡更符合"有多少显示多少"。

---

## 2026-09-11（AI 内容质量治理：公式统一渲染 + 试题原图优先 + 学科制图规范）

**任务类型**：Bug修复 + 开发任务 + 测试任务 + 文档维护
**触发**：用户实测截图 4 张，核心诉求：① 公式统一处理（关键要点 / 试题符号也要）；② 图片 URL 严格指定可信图源、试题图片直填数据（程序提供组件支持）；③ AI 画图严格遵循学科制图惯例（如三角形对边 a/b/c）。

### 1. 诊断（双维度）
- **覆盖缺口**：`LatexText` 只接入 11 处，遗漏 `keyPoints` / `pitfalls` / `learningPath` / `confusables` / mindMap 节点标题·描述 / `interestingFacts.title` / 标签 chip。
- **裸 LaTeX**：`MATH_SPLIT` 只认 `$...$` / `\(...\)`，模型大量输出 `\triangle ABC` / `60^\circ` / `\sqrt{13}` 等裸 LaTeX（试题尤甚），走过渲染器也照样露出。
- **图源**：此前 prompt 只说"权威来源"，AI 凭印象给链，被 `TRUSTED_IMAGE_HOSTS` 静默落空（白给）。
- **配图策略**：prompt 写"试题配图固定填空统一用 svg"，与"原图最可靠"反向。
- **SVG 制图**：缺学科惯例约束（三角形对边 / 受力箭头 / 电路符号）。

### 2. 修复
- **公式渲染层**：`utils/latex.ts` 新增 `splitBareLatex()` —— 强信号 = 反斜杠命令（≥2 字母）或带花括号上下标；左右扩展到数学字符边界（遇 CJK / 中文标点 / `$` / 换行即止）；**必须 KaTeX 解析成功才渲染**（防 `snake_case` 与 `C:\Users` 这类误命中），失败回退原文不吞内容。`LatexText` 重组为先切围符再对普通段跑 splitBareLatex，成为**统一渲染入口**。
- **覆盖**：SearchResults 把遗漏字段统一接入 LatexText（关键要点 / 易错 / 学习路径 / 易混辨析 / mindMap 节点标题·描述 / 概念标题 / 趣事标题 / 标签 chip）。
- **试题配图三通道**：`ExamQuestion` 新增 `imageData`（base64 直填，限 png/jpeg/gif/webp 且 <4MB），渲染优先级 image / imageData > svg，加载失败自动回退 SVG。
- **prompt 源头加固**：置顶【公式书写规则】要求所有数学符号一律 `$...$` 包裹（含正反例）；新增【试题配图规则】（"原图优先"+"无法作为字符识别区域即图"判据）；图源域名白名单显式写入；SVG 规则新增"必须严格遵循该学科制图惯例"+ 高风险学科细则。

### 3. 验证
| 项 | 命令 | 结果 |
|----|------|------|
| 类型检查 | `node ./node_modules/typescript/bin/tsc --noEmit` | ✅ 零错误 |
| 单元测试 | `node ./node_modules/vitest/vitest.mjs run` | ✅ 15 文件 / 185 用例全绿（本次新增 29 条） |
| 生产构建 | `vite build --outDir <tmp>` | ✅ 通过 |

### 修改文件清单
| 文件 | 操作 | 关键变更 |
|------|------|---------|
| `src/utils/latex.ts` | 编辑 | 新增 `splitBareLatex()` + `BarePiece` |
| `src/components/ui/LatexText.tsx` | 重写 | 统一入口（先切围符再切裸公式），防御性回退 |
| `src/components/ui/__tests__/latexText.test.tsx` | 新建 | 7 条组件测试 |
| `src/utils/__tests__/latex.test.ts` | 编辑 | +9 条 splitBareLatex 用例（含真实截图文本） |
| `src/modules/search/SearchResults.tsx` | 编辑 | 遗漏字段统一接入；新增 `figureFailed` 状态，原图加载失败回退 SVG |
| `src/modules/search/__tests__/searchResultsLatex.test.tsx` | 新建 | 4 条组件渲染回归 |
| `src/types/index.ts` | 编辑 | `ExamQuestion` 新增 `imageData?` |
| `src/services/baseAIProvider.ts` | 编辑 | sanitizeExamQuestions 识别 imageData 别名 + isDataImageURL；prompt 增【公式规则】/【试题配图】/【SVG 学科规范】/显式图源白名单 |
| `src/services/__tests__/baseAIProvider.test.ts` | 编辑 | +4 imageData 用例 + +5 提示词契约用例 |
| `docs/design.md` | 编辑 | §5.3.1 三通道 + 严格图源；§10.6 公式统一渲染（双保险）+ 统一入口；§4.6 ExamQuestion 增 imageData |

### 经验教训
1. **"统一入口"是 AI 内容渲染的关键约束**：零散接入是漏洞温床。
2. **"信源可校验"比"信源多"更重要**：写死白名单比让 AI 凭印象给链更可靠。
3. **防御性渲染（解析失败回退）比"识别够准"更安全**：KaTeX 解析失败这条硬关卡兜底能挡掉几乎所有伪命中。
4. **"原图优先"是 AI 画图的根本原则**：模型手绘对"特定数据"的几何图几乎一定会错，把"无法作为字符识别的区域"判为图片直接填 data 才是现实路径。

---

## 2026-09-11（流式能力黑名单：永久禁用 → 60s 冷却）

**任务类型**：Bug修复 + 测试任务 + 文档维护
**触发**：用户纠正——上一轮只修了渲染侧，"总述延迟"的真正关键是 `baseAIProvider.ts` 的**运行时流式能力黑名单**（进程内缓存、不落盘）：意图识别已完成、历史已入库，summary 却迟迟不显示。要求留意这条链路。

### 1. 定位（沿 prepareRequest → callModelStream 走查）
- `analyze`（意图识别 prompt）→ `callModelStream` → `prepareRequest` 算 `wantStream = stream && caps.streaming && isStreamPossiblySupported(providerId, model)` → `if (!meta.streaming)` 时直接 `callModel`（非流式）。
- 原实现 `const streamUnsupported = new Set<string>()`：**一次失败永久记入** → 之后永远 `wantStream=false` → 永远走非流式。

### 2. 根因：黑名单是"永久禁用"，导致"自愈"不可达
- 注释承诺"流式成功即 `markStreamSupported` 移出"，但该路径要求后续请求真的发 `stream: true`；永久禁用后**永远不再发流式请求** → 自愈逻辑成为死代码。
- 实际语义退化为「**整个会话关掉该型号流式**」，表现与用户描述完全一致：内容不逐段生长，憋很久整段出现；进程内缓存、刷新恢复，极难复现。
- 附带问题：降级到非流式**无任何日志**（排查黑洞）；且"收到思维链但正文未到"被误记黑名单（服务端其实在流式）。

### 3. 修复
- `Set` → `Map<string, number>`（key → failedAt），新增 `STREAM_RETRY_COOLDOWN_MS = 60_000`。
- `isStreamPossiblySupported(providerId, model, now = Date.now())`：无记录→true；冷却期内→false（临时走非流式）；**过期→true（自动重试，自愈入口可达）**。
- `markStreamUnsupported(providerId, model, reason?, now?)`：刷新时间戳 + `console.warn`（冷却秒数 + 原因）；`markStreamSupported`：立即删除。
- `callModelStream`：走非流式分支补 `console.warn`；只有"响应非 SSE 增量 / SSE 解析失败 / 传输层失败"等协议层证据才记账；`receivedReasoning` 为真时不记账。

### 4. 验证
| 项 | 命令 | 结果 |
|----|------|------|
| 类型检查 | `node ./node_modules/typescript/bin/tsc --noEmit` | ✅ 零错误 |
| 单元测试 | `node ./node_modules/vitest/vitest.mjs run` | ✅ 13 文件 / 156 用例全绿（新增 7 条） |
| 生产构建 | `npm run build`（沙箱拦截 vite 清空 dist/assets，改用 `vite build --outDir <tmp>`） | ✅ 打包本体通过 |

### 修改文件清单
| 文件 | 操作 | 关键变更 |
|------|------|---------|
| `src/services/baseAIProvider.ts` | 编辑 | 黑名单 Set→Map + 60s 冷却；导出 `STREAM_RETRY_COOLDOWN_MS`；`isStreamPossiblySupported` 可注入 `now`；降级/记账补日志；收敛记账条件 |
| `src/services/__tests__/streamFallback.test.ts` | 新建 | 7 用例钉死冷却契约（含"冷却结束可重试"） |
| `docs/design.md` | 编辑 | 黑名单说明改为"带冷却期 + 可观测 + 只有协议层证据才记账" |

### 经验教训
1. **带"自愈"承诺的熔断，必须保证自愈入口可达**：把"冷却"实现成"永久禁用"，自愈逻辑就成了死代码；症状与实现距离远，极难定位。
2. **运行时降级必须可观测**：行为随进程内状态变化的分支都要留 `console.warn`，静默降级=把 bug 藏起来。
3. **记账条件收敛到证据层**：收到思维链说明服务端在流式，不能算失败。
4. **降级策略要有契约测试**：用可注入 `now` 钉死冷却边界，"永久禁用"与"冷却"在无测试时无法区分。

---

## 2026-09-11（流式渲染时序修复：总述延迟显示 + 步骤指示卡死在"思维导图"）

**任务类型**：Bug修复 + 测试任务 + 文档维护
**触发**：用户实测——输入"什么是勾股定理"，AI 分析已完成、历史记录已入库，但「总述」没有立刻开始显示，直到界面显示"正在生成知识导图"时才出现，要求复盘流式渲染。

### 1. 定位（先用测试复现，不靠肉眼推断）
- 把真实字段产出顺序（`topic → summary → mindMap → conceptsOverview → concepts → knowledgeContext → examQuestions → interestingFacts`）逐字符喂给 `StreamingJSONParser`，断言中间态 `completedKeys`。**3 条新用例全部失败**，暴露两个独立根因。

### 2. 根因一：`completedKeys` 漏掉「容器型」顶层字段（步骤指示卡死）
- `scan()` 只在**字符串/字面量**型值收尾时登记完成。值为数组/对象（`mindMap`/`concepts`/`knowledgeContext`/`examQuestions`/`interestingFacts`）的顶层字段，收尾发生在子帧弹栈**之后**，父帧拿不到"值已结束"信号 → 中间态 `completedKeys` 里整类字段缺失。
- `deriveStep()` 按 `STEP_ORDER` 取"第一个未完成字段"（顺序 `summary → mindMap → conceptsOverview → …`）→ **从第二个字段起永远返回 `mindMap`**，生成全程都显示"正在生成知识导图"。
- 最终态因回退到 `Object.keys(data)` 而看不出问题 —— 这也是它长期未被发现的原因。
- 修复：`}`/`]` 分支弹栈后，若父帧就是根对象且 `pendingKey` 非空，立即登记该顶层字段完成。

### 3. 根因二：「总述」被概念列表门控（总述延迟显示）
- `SearchResults` 把「总述」渲染在 `{concepts.length > 0 && …}` 内部；而产出顺序是 `conceptsOverview` **先于** `concepts`。总述文本已到达、已解析，却因门控不渲染，只能等概念列表出现后"一起蹦出来"。
- 修复：门控改为 `conceptsOverview || concepts.length > 0`，两者任一到达即渲染「核心概念」区块。

### 4. 附带修复：首字前占位文案写死"正在生成知识导图"
- `modules/search/index.tsx` 的 `GENERATING` 占位文案写死 `steps.mindMap`；改为中性 `steps.generic`。
- 首字等待计时器 `WaitTimer` 原所在分支（`SearchResults` 的 `loading && !generatedData`）因外层 `generatedData` 门控而**不可达**（死代码）；导出后接到 `index.tsx` 的占位里，思考期重新可见"模型正在思考…已等待 N 秒"。

### 5. 验证
| 项 | 命令 | 结果 |
|----|------|------|
| 类型检查 | `node ./node_modules/typescript/bin/tsc --noEmit` | ✅ 零错误 |
| 单元测试 | `node ./node_modules/vitest/vitest.mjs run` | ✅ 12 文件 / 149 用例全绿（新增 6 条） |
| 生产构建 | `npm run build` | ✅ 通过 |

### 修改文件清单
| 文件 | 操作 | 关键变更 |
|------|------|---------|
| `src/services/streaming/partialJSON.ts` | 编辑 | `scan()` 弹栈后补记顶层容器型字段完成 |
| `src/modules/search/SearchResults.tsx` | 编辑 | 核心概念区块门控放开；导出 `WaitTimer` |
| `src/modules/search/index.tsx` | 编辑 | 占位文案改中性 + 接入首字等待计时 |
| `src/services/streaming/__tests__/partialJSON.test.ts` | 编辑 | +3 用例（容器字段中间态登记 / 顺序不倒退） |
| `src/modules/search/__tests__/searchResultsStreaming.test.tsx` | 新建 | 3 用例（总述先到即渲染等） |

### 经验教训
1. **只有真实 provider 才暴露**：`mockAIService.generateStream` 是手工构造 `completedKeys`（每块都 push），所以该 bug 在无 Key 演示环境永远复现不了 —— mock 测试全绿 ≠ 流式链路正确。
2. **中间态是最容易漏测的区间**：最终态有 `Object.keys(data)` 兜底，把"中间态字段清单缺失"完全掩盖了；增量解析的契约必须在**未闭合**状态下断言。
3. **UI 分区块不要用"数据依赖"表达"版面顺序"**：把 B 字段渲染挂在 A 字段非空判断下，等于给 B 加隐形延迟。

---

## 2026-09-11（预置模型修正 + 生图配置 + 公式/SVG/流式修复）

**任务类型**：开发任务 + Bug修复 + 文档维护
**触发**：用户实测反馈（预置模型失效 / 生图无配置入口 / 公式原样露出 / 电路图过大被裁 / 不是流式）

### 1. 预置模型全量修正（WebSearch 核对官方目录，2026-09-11）
- **根因**：PROVIDER_META 里的型号多数来自训练记忆，多家已下架/改名。智谱最严重（`glm-4-plus`/`glm-z1-air`/`glm-4-long` 已失效，而 zhipu 是默认厂商）。
- **改动**：
  - 智谱 → `glm-5.2`/`glm-5.1`/`glm-4.7`/`glm-4.7-flash`
  - Gemini → `gemini-3.5-flash`/`3.5-flash-lite`/`3.7-flash`（2.5 系列 2026-10-20 退役）
  - OpenAI → 移除 `gpt-4.1-mini`/`o3-mini`，补 `gpt-5-nano`
  - 千问 → 补 `qwen3.7-max`/`qwen3.8-flash`，移除 `qwen-plus` 别名
  - Anthropic → `claude-opus-5` 提为 recommended
  - DeepSeek / Kimi / 硅基流动核实无误
- **同步三处**：`types/aiProviders.ts`、`i18n/strings/aiProviderTexts.ts`(MODEL_DESC_EN)、`components/settings/providerTemplates.ts`

### 2. 生图服务密钥配置入口
- 新增 `components/settings/WanxKeyInput.tsx`，接入 Header 的"密钥管理" Tab
- i18n `common.ts` 增加 `wanx` 段；密钥存 `ai-office-assistant-wanx`

### 3. 行内公式渲染（`$...$` 原样露出）
- **根因**：示例/题干/答案/解析等正文是纯文本直出，行内公式没走 KaTeX
- **改动**：新增 `components/ui/LatexText.tsx`，按 `$...$`（不跨行）/ `\(...\)` 分段渲染，失败回退原文
- **应用点**：summary、conceptsOverview、概念两档解释、example、题干（含填空分段）、选项、answer、explanation、commonConclusions、fact.content

### 4. SVG 电路图过大/被裁/线粗
- **根因**：容器有 maxHeight+overflow-hidden，但内部 svg 只有 max-width 约束 → 高图被裁掉顶部元件
- **改动**：`.svg-figure > svg` 加 `max-height: var(--svg-figure-max-h)` + `width/height:auto`（SvgFigure 注入变量）；`inlineSvg.ts` 新增 `clampStrokeWidth`（>2 压到 2，未超限原样保留）；prompt 端补"画布紧凑、线宽 1~2"

### 5. 流式渲染（两轮）
- **第一轮**：`generateStream` 每个 SSE 分片全量 `sanitizeGenerateResult` → 主线程掉帧 → 加 80ms 时间片节流，尾部由 `parser.finish()` 强制补发。顺带修 `prepareRequest` 里 caps 用了未解析的旧 model id。
- **第二轮（用户反馈与厂商型号无关）**：定位**首字延迟**——思考型模型先吐思维链，读取器只取 `delta.content`，思考期零反馈
  - `sseReader` 新增 reasoning 识别（`reasoning_content`/`reasoning`）+ `onReasoning` 回调 + `receivedReasoning`（避免误判为不支持流式而降级）
  - 透传链路：`callModelStream` → `callModelStreamWithContinuation` → `generateStream` → 状态机
  - 状态机新增 `thinking`/`generateStartedAt`；UI 首字未到时显示"模型正在思考…已等待 N 秒"
  - 对支持厂商（dashscope/siliconflow）发 `enable_thinking: false` 关闭思考降延迟（白名单，避免严格网关 400）

### 验证
tsc 零错误；vitest 143/143 全绿（新增 1 个 SVG 线宽用例）；dev server 热更新验证

---

## 2026-09-10（v1.6.0 多语言 i18n 落地 + 用户语言绑定 + 超限续写 + 查词翻译改造）

- **任务类型**：功能开发 + 重构优化 + Bug修复
- **触发原因**：① 界面文案写死中文，需支持英文界面；② AI 输出语言应跟随用户语言；③ 长内容常被模型输出上限截断；④ 词典翻译交互需重做（源/目标语言选择、逐段对齐、短语多词）

### 执行步骤（按先后顺序）

**第 1 段：语言基础设施 + AI 输出绑定语言**
1. `src/i18n/languages.ts`：建立唯一语言目录（code/native/zhName/english/speech），`normalizeLanguage` 兼容旧 `zh-CN`、中文名、BCP-47。
2. `src/hooks/useLanguageStore.ts`：纯存储层（单例 + subscribe/emit），存标准 `LanguageCode`，默认 `navigator.language`。
3. `useLanguage.ts` 重写为 `useSyncExternalStore`，返回 `{ language, uiLanguage, setLanguage, setLanguageZh/En }`；Header 语言区改全语言下拉。
4. `baseAIProvider.buildLanguageDirective()`：组装 prompt 时注入"输出语言为 X、JSON 字段名保持英文"；接入 search 生成/追问/文档。

**第 2 段：超限自动续写**
5. 新增 `hasCompleteJSONObject()`（严格闭合判定，不修复）与 `callModelStreamWithContinuation()`（首轮 + ≤2 次续写，`MAX_GENERATION_ATTEMPTS=3`）。
6. 接入 `search.generateStream` / `followupStream` / `document.generateStream`；类型加 `continued`；SearchResults 加"已自动续写并补全"提示。

**第 3 段：i18n 字符串层（Task 11）**
7. 建立 `src/i18n/strings/`（common/settings/search/translate/misc/aiProviderTexts/docTemplates/index），英文作类型基准 + `deepMerge` 中文兜底 + `fmt()` 占位替换。
8. `hooks/useStrings.ts`（组件）/ `getCurrentStrings()`（非组件）双入口。
9. 数据层保留中文（provider/模型描述/文档模板正文），英文走覆盖表 `aiProviderTexts.ts` / `docTemplates.ts`；`doc/templates.ts` 收敛为 `generate*(topic, language)`。
10. 按模块逐个迁移：layout / settings / search / translate / doc / favorites / history / utils.export / hooks(useFavorites,useSpeechSynthesis)；迁移前先 grep 中文区分注释与 UI 串。
11. 修复 `mockAIService.ts` 文档模板签名错误（`docTemplates` Record 改惰性函数 + `getStoredLanguage()`/`getCurrentStrings()`）。

**第 4 段：查词翻译改造**
12. 服务契约：`detect` 只检测源语言；`queryWord` 返回 `keywords`(≤10) + `isPhrase`；`queryTranslate` 返回逐段对齐 `segments`。
13. UI：`TranslateInput` 双下拉 + 交换按钮 + 输入上限（查词 120/翻译 3000）+ 超长截断提示；`translate/index` 目标语言默认随用户语言、源=目标自动改判；`WordResult` 关键词 chips；`SentenceResult` 选词实时映射。

**第 5 段：验证与顺手修复（Task 12）**
14. `tsc --noEmit` → 发现并修复 `mockAIService.ts` 签名错误、若干遗漏 key。
15. `vitest run` → 6 例失败，定位为：测试断言写死中文（改断言为 `getCurrentStrings()`）+ 两个真实 bug（错误被通用串覆盖、全空结果误判 IDLE）。
16. 修复后 `tsc` 零错误、`vitest` 142/142、`vite build` 成功。

### 验证结果
- `node ./node_modules/typescript/bin/tsc --noEmit`：零错误
- `node ./node_modules/vitest/vitest.mjs run`：142/142 通过
- `node ./node_modules/vite/bin/vite.js build`：成功（740 modules；`dist/` 清理被宿主安全守卫拦截时改用 `--outDir /tmp/...` 验证）

### 注意事项
- 批量编辑时多次出现"报告成功但未落盘"（含 EBUSY）→ 必须 grep/tsc 复核，未生效立即重做。
- 测试中不要把本地化文案写死为中文；一律引用 `getCurrentStrings()`。
- 遗留：`components/cards/*`、`components/favorites/FavoritesPanel.tsx` 为死代码（无 import），建议直接删除；`translate/mockData.ts` 演示数据仍为中文（数据层，未迁 i18n）。

---

## 2026-09-09（v1.5.0 收尾：真流式改造 + 真实 AI 链路四个真问题修复 + 配图/题型/脉络/思维导图 + 厂商模板）

- **任务类型**：开发任务 + Bug修复 + 重构优化
- **触发原因**：① 用户明确"一次生成效果最好"且抱怨假流式等待；② 真实 GLM-4-Plus 跑通后暴露 4 个 mock 无法复现的问题（截断半句话 / 公式报红 / 他厂模型全失败 / 图片从未生成）；③ 截图反馈思维导图公式溢出、图片来源受限、中英词表是坏做法、自定义厂商门槛高

### 执行步骤

**第 1 段：真流式（生产者-消费者）**
1. `src/services/streaming/partialJSON.ts`：`StreamingJSONParser`（单趟扫描 + 容器栈 + 字符串状态 + 安全切割点 + 已完成顶层键），`push`/`read` 分离。
2. `src/services/streaming/sseReader.ts`：SSE 读取（跨 chunk 半行、`[DONE]`、流内 error）。
3. `BaseAIProvider`：抽 `prepareRequest`，新增 `callModelStream` + 自动降级；提示词抽 `buildGeneratePrompt`/`buildFollowupPrompt`/`buildDocPrompt` 共用；`sanitizeGenerateResult` 统一清洗。
4. 新增 `search.generateStream`/`followupStream`、`document.generateStream` + mock 实现；`useSearchStateMachine.runGenerate`（AbortController + 60ms 节流）、`useSearchMode`、`doc/index.tsx` 改流式填充。
5. 快照合并 `mergeSnapshot`：仅非空覆盖，最终态用服务端结果再合并一次。

**第 2 段：真实 AI 四个真问题**
6. 截断：`sseReader.extractDelta` 透出 `finishReason` → `SSEStreamResult.truncated` → callModel/callModelStream/callModelWithJSON/generate(+Stream) → `data.truncated`；UI 显示警告横幅；`getDepthConfig` 预算提高一档（16384/12288/4096）。
7. 公式：新增 `src/utils/latex.ts`（`normalizeLatex` + `renderLatexSafe`），成功渲染 KaTeX、失败降级代码块；提示词要求纯 LaTeX。
8. 模型 ID：按官方现状重排 DeepSeek/Moonshot/DashScope/OpenAI/Anthropic/Gemini/SiliconFlow/智谱；`getDepthConfig` 收敛为 `min(基线, cap, ctxLen*40%)`。
9. 图片：v1.3 内联 SVG → v1.4 Commons 免 Key 兜底 → v1.5 加 `Concept.imageQuery` → v1.6 定稿双源（中文→zh.wikipedia、英文→Commons，互为 fallback）。

**第 3 段：内容与交互增强**
10. `sanitizeExamQuestions` 重写：题型中英别名映射 + 反推 + 选项归一化（数组/对象/嵌套/整串）+ 答案收敛字母 + 难度别名；UI 新增 `ExamQuestionCard`。
11. `Concept` 加 `keyPoints`/`pitfalls`，`KnowledgeContext` 加 `confusables`；知识脉络改四段式（学习路径→前置/关联→易混辨析→常用结论）。
12. 思维导图溢出：`calculateDescSize` → `estimateTextWidthEm`（按字符类分档 0.55/1.0/0.95/0.8/0.4），测量盒与渲染盒样式对齐、渲染盒固定 height + overflow hidden。
13. 新增 `components/settings/providerTemplates.ts`（8 套模板）+ `AddProviderForm` 模板快选。
14. 专项清理：移除 v1.3 的"老数据兼容"防御性别名（`diagram`/`figure` 等）、厂商描述去营销化、删除 `src/modules/visual/` 之前的历史残留说明统一为"已删除"。

### 验证结果
- `tsc --noEmit`：零错误
- `vitest run`：101/101 → 103/103 → 121/121 迭代通过（新增题型 9、SVG 清洗 6、图片 URL 2、latex 11、mindmapDescSize 7、partialJSON 8 等）
- `npm run build`：成功（dev server 占用 `dist` 时可能首次失败，重试或先停服务）

### 注意事项
- **不要用 `git stash`**：本仓库 `.git` 曾被移入回收站且存在损坏对象，stash 报 `<sha> is not a valid object`；需要基线改用只读 `git diff`/`git show`。
- 判断"JSON 是否写完"必须用 `hasCompleteJSONObject`（严格），不要用带 repair 的 `parseJSONResponse`。
- 同一文件严禁并行 Edit（会产生内容错位/重复），本次已因此重建过 4 处损坏文件。

---

## 2026-09-06（内容丢失根因修复：max_tokens 钓制 + 图片格式放宽 + 提示词精简提速）

- **任务类型**：Bug修复 + 重构优化
- **触发原因**：① 显示时仍有内容丢失；② 图片要支持更多格式；③ 生成用时较长，要求精简提示词、减少 AI 思考负担、更灵活发挥

### 根因分析
1. **max_tokens 65536 超限**：多数厂商模型真实输出上限 8k~16k，超限请求会被 API 直接拒绝（400）→ 该步骤整块返回空 → 内容丢失。这是"内容丢失"的主要根因（jsonRepair 解析器本身已很健壮：剥代码块/中文引号/尾逗号/截断补全均有）。
2. **图片 URL 校验过严**：清洗器只接受 .jpg/.jpeg/.png/webp/gif 后缀，而真实图床（维基共享、unsplash）URL 常无后缀 → 合法图被丢弃。
3. **提示词过长过模板化**：每步 25+ 行、大量重复约束（每步重复【来源要求】、"首先…然后…"等模板措辞），思考负担大、输出慢。

### 执行步骤
1. `baseAIProvider.ts` getDepthConfig：max_tokens 钓制 8192/6144/2048（保留 ctxLen 40% 兜底），避免 400 拒绝导致整步内容丢失。
2. isImageURL 放宽：任何 `https?://` 直链均接受（保留域名格式校验、拒绝非 http 协议），渲染端 onError 兜底隐藏失效图。
3. 7 个 generatePartial 步骤提示词全部重写：25+ 行 → 平均 8 行。JSON 输出模板保留（防丢字段的关键），删除各步重复的【来源要求】（并入 systemPrompt 一句）、删除"首先…然后…""像教材开篇导语"等模板化措辞，允许 AI 自由组织表述；图片规则改为"真实存在的图片直链（优先维基共享资源）"。
4. generate 全量提示词同步精简（三段式 90+ 行 → 约 45 行，输出 JSON 模板不变）。
5. 测试：image 无后缀直链（unsplash 带 query）用例补充。

### 验证结果
- `npm test`：78/78 通过
- `npm run build`：通过

### 注意事项
- max_tokens 具体最优值依所用模型而定；若后续接入的模型上限更低（如 4k），子类可覆盖 getDepthConfig
- 提示词"保底约束"（真实性、JSON 模板）未删，删的是重复与模板化措辞——灵活性与可靠性平衡

---

## 2026-09-06（AI 生成数据格式防御：核心概念等区块不显示修复）

- **任务类型**：Bug修复
- **触发原因**：真实 AI 生成时核心概念等区块不显示。根因：仅 mindMap 有清洗（sanitizeMindMap），其余字段裸用——真实 AI 返回格式偏差（content 是字符串、条目缺字段、options 是字符串等）轻则内容空白，重则 `concept.content.elementary` 抛 TypeError 使整个渲染树崩溃（白屏/区块全无）；且 localStorage 旧会话脏数据会在恢复历史时再次引发崩溃

### 执行步骤

1. **边界归一化**（`baseAIProvider.ts` 新增 6 个清洗器，导出供测试）：`sanitizeConcepts`（兼容 content 字符串/缺省/平铺字段/条目纯字符串，type 非法回退，image 非法 URL 丢弃）、`sanitizeKnowledgeContext`（字符串字段拆为数组）、`sanitizeExamQuestions`（options 字符串拆分、id 补齐、type/difficulty 枚举回退、source 兜底）、`sanitizeInterestingFacts`、`sanitizeConceptExamples`、`toStringList`。
2. **generate / generatePartial 出口全量应用清洗**：summary/conceptsOverview 强制转字符串，各区块数组字段全部过清洗器。
3. **会话恢复清洗**（`useSearchStateMachine.ts` restoreFromSession）：从 localStorage 恢复的历史数据入口统一归一化，防止旧脏数据崩溃并阻止其回流持久化。
4. **渲染前兜底**（`SearchResults.tsx`）：组件内 `normalizeGenerated` + useMemo 对 generatedData 统一清洗（对已清洗数据幂等）；`concept.content?.elementary/advanced` 可选链；`Array.isArray(question.options)` 判断。

### 验证结果
- `npm run build`：通过
- `npm test`：78/78 通过（新增 baseAIProvider 清洗器测试 19 个，覆盖标准格式/字符串 content/纯字符串条目/非法枚举/非法 URL/字符串 options 等偏差场景）

### 注意事项
- 原则确立：真实 AI 返回的数据一律不可信，所有区块字段在 provider 边界归一化后才交给 UI；后续新增生成字段需同步补清洗器

---

## 2026-09-06（意图识别修复 + 提示词松绑 + 历史时间戳修复）

- **任务类型**：Bug修复 + 重构优化
- **触发原因**：① 输入"复数的应用有哪些"AI 未提取出知识点"复数"；用户建议简单交代 AI 判断"简单问答 vs 知识点学习"以切换问答模式；② 提示词死板有缺陷，AI 发挥受限，多处内容欠缺；③ 历史记录"浏览中"状态切走后时间未保持"刚刚"

### 执行步骤

1. **analyze 意图判断提示词重构**（`baseAIProvider.ts`）：改为三步极简结构——第一步判断意图（想系统学一个知识点→true，即使问的是应用/例子/历史等侧面；一次性简单问答/闲聊/计算/事务性请求→false），第二步提取核心知识点（剥离所有疑问修饰，示例覆盖"复数的应用有哪些→复数""光合作用需要光吗→光合作用""三角函数怎么学→三角函数"），第三步判断具体/宽泛。
2. **mock 归一化同步**（`mockAIService.ts`）：`stripQuestionWords` 补充"的应用/用途/作用/例子+有哪些/是什么"、"怎么学/如何理解"、"需要…吗/是…吗"等剥离规则，与真实 AI 逻辑一致；新增 3 个测试用例。
3. **提示词松绑**（`baseAIProvider.ts`，generate 全量与 generatePartial 分步同步）：
   - summary：一句话60字 → 2~3句100字，允许点明研究内容/学科位置/典型应用，要求有信息量无空话
   - 概念示例：不再强制"生活场景+数字演算"——定量概念给可验算数字演算，定性概念（生物/历史/语文/经济）给真实典型场景实例
   - learningPath：从空洞的"4字短语"改为"阶段名：本阶段具体学什么、达到什么效果"，结合主题
   - commonConclusions：定量学科给结论/推导式，定性学科给核心规律/分析方法/判断要点
   - 试题：近3年真题放宽为"优先近3年，确无则近5年"（解决试题频繁空数组）；题型明确 choice/fill/calculation/essay 按学科特点选择，1~3道难度有梯度
   - QA 追问：原提示词仅一句"基于历史对话回答"，充实为完整教师风格要求（先结论后解释、准确不编造、复杂分点简单直说、善用类比、公式 LaTeX、长度按问题调整）
4. **历史时间戳修复**：根因——浏览中的项目时间戳停留在点击时刻，切换到其他项后旧项显示"N分钟前"而非"刚刚"。修复：`index.tsx` 新增 `touchCurrentViewing()`，在发起新搜索（`handleSearch`）和切换历史项（`handleHistoryClick`）时把离开项的"最后浏览时间"刷新为现在；`useSearchMode.ts` 的 `clearQAMessages`（开新问答/重置）同样先 touch 旧 QA 会话。

### 验证结果
- mock 归一化实测：'复数的应用有哪些'→知识点'复数'、'光合作用需要光吗'→'光合作用'、'三角函数怎么学'→'三角函数'、'是谁'→非知识点
- `npm run build`：通过
- `npm test`：59/59 通过（新增 3 个归一化用例）

---

## 2026-09-06（知识脉络抢先渲染 Bug 修复 + 热门标签精简 + 图片支持）

- **任务类型**：Bug修复 + 开发任务
- **触发原因**：真实 AI 生成时，知识概览显示后知识脉络随即渲染，但思维导图仍在生成中（区块乱序）；同时未见图片内容，要求热门标签精简、mock 补带图示例、提示词优化（jpg/png + 联系 AI 逻辑）

### 执行步骤

1. **渲染顺序根因分析**：`knowledgeContext` 初始化为 `{ prerequisites: [], relatedTopics: [], learningPath: [] }`（空对象为 truthy），显示条件 `generatedData.knowledgeContext && (...)` 使区块在 summary 步骤后立即渲染，此时思维导图尚未生成。
2. **状态机加 `generatingStep`**（`useSearchStateMachine.ts`）：在 7 步（summary/mindMap/concepts/conceptExamples/knowledgeContext/examQuestions/interestingFacts）前显式设置 `generatingStep`，最终状态清空；搜索和图谱节点点击两条路径均覆盖。
3. **收紧显示条件**（`SearchResults.tsx`）：knowledgeContext 改为检查 `prerequisites.length > 0 || relatedTopics.length > 0 || learningPath.length > 0 || commonConclusions?.length > 0`；loading 文案由 `generatingStep` 映射，不再从字段反推（避免空返回导致文案卡住）。
4. **热门标签精简**（`HotTags.tsx`）：从 15 个减为 6 个跨学科经典——牛顿第二定律、勾股定理、光合作用、三角函数、化学元素、人工智能；移除展开/收起逻辑。
5. **mock 数据补图片**：`mockData.ts` 牛顿第二定律公式概念加 `image` 字段；`MockGeneratedConcept` 接口加 `image?: string`；`mockAIService.ts` 通用试题模板加 `image` 字段（picsum.photos seed 版本，稳定加载）。
6. **提示词优化**（`baseAIProvider.ts`）：concepts 和 examQuestions 提示词明确 `image` 仅在需视觉辅助时填写（几何图、实验装置、物理过程、公式推导图、电路图等），URL 为 .jpg/.png，文字能讲清则留空、不编造；generate 全量与 generatePartial 分步提示词同步更新，JSON 模板加 image 字段。

### 验证结果
- `npm run build`：通过（仅 chunk 体积警告）
- `npm test`：56/56 通过
- 图片字段验证：牛顿第二定律公式概念图 URL 正确返回
- 渲染逻辑代码审查：knowledgeContext 显示条件已收紧，generatingStep 驱动 loading 文案

### 注意事项
- 图片提示词遵循"AI 基于分析判断"原则：给判断标准（什么情况需要图），不给硬编码指令；不要求 AI 参考 mock
- Playwright 浏览器未安装，渲染顺序通过代码审查 + 测试验证，未做浏览器实测

---

## 2026-09-06（AI 提示词质量优化：提炼优秀 mock 特征 + 去除硬编码）

- **任务类型**：开发任务
- **触发原因**：用户要求参考"数学定理、勾股定理、加速度、物理定律、牛顿第二定律"5 个优秀 mock 数据优化 AI 提示词；并明确两条原则：① 不让 AI 参考 mock 数据（加重分析负担、干扰 AI 逻辑）；② "最近3年"直接告诉 AI，不硬编码 2023-2026（AI 基于分析展开工作，程序基于映射，二者不同）

### 执行步骤

| 时间 | 步骤 | 内容 | 状态 |
|------|------|------|------|
| - | 排查 | grep 全 services 目录：提示词中无"参考 mock"措辞（不引入即可）；硬编码年份 3 处（examQuestions 提示词 2023-2026、year 示例 "2024"）；generate 全量提示词为旧格式（无 conceptsOverview、无双层质量标准、examples 旧字段） | ✅ |
| - | 提炼 | 从 5 个优秀 mock 归纳质量特征：总述按"首先…然后…最后"预告概念标题与递进关系；elementary 用生活比喻讲直觉、advanced 教材式严谨表述；示例为"生活场景+可验算数字"；脉络具体不空洞、learningPath 阶段式 4 字短语；趣味重发现故事 | ✅ |
| - | concepts | 提示词重写：总述 3~5 句带学习路径预告；概念 3~4 个按学习顺序、类型递进；elementary 明确要求生活化类比（发电厂/惰性/搭积木/水压水流）、advanced 要求教材严谨；notation LaTeX | ✅ |
| - | conceptExamples | 重写：公式/定理类优先配示例；"生活场景+具体数字演算"，数字代入公式可验算（给 F=ma 的 5m/s² 范例）；title 与概念精确匹配 | ✅ |
| - | knowledgeContext | 重写：prerequisites/relatedTopics 要求具体知识点名称、禁空话；learningPath 按"概念理解→原理掌握→应用实践"3 步 4 字短语；commonConclusions 给可直接引用结论的范例 | ✅ |
| - | examQuestions | **去硬编码**："近3年（2023-2026）"→"最近3年内…年份以当前年份向前推3年为准"；JSON 示例 year 改为"真题实际年份"占位；无真题返回空数组、严禁编造年份 | ✅ |
| - | interestingFacts | 增强：type 区分 story/application；要求真实人物/情境/细节的发现故事，2~4 句，避免百科式陈述 | ✅ |
| - | generate 全量 | 对齐新格式：补 conceptsOverview 段、concepts 双层质量标准、example 内嵌概念（全量类型无独立 conceptExamples 字段，示例挂 Concept.example）、试题最近3年表述；fallback 补 conceptsOverview | ✅ |
| - | 验证 | `npm run build` 通过；`npm test` 56/56 全绿；grep 确认提示词无 2023-2026 硬编码、无 mock 参考措辞 | ✅ |

### 汇总反馈

**修改文件**：`src/services/baseAIProvider.ts`（generate 全量提示词 + generatePartial 7 步中 concepts/conceptExamples/knowledgeContext/examQuestions/interestingFacts 5 步提示词 + generate fallback 默认值）

**关键设计原则**（用户确立）：
1. **AI 不参考 mock**：mock 是程序映射用的固定数据；AI 基于分析展开工作，提示词只给质量标准与写作要求，不塞示例数据，避免加重分析负担、干扰逻辑
2. **时间要求语义化**："最近3年"直接表述，由 AI 基于当前时间分析；硬编码年份（2023-2026）只属于程序映射（mock 静态数据及其测试），不属于提示词

**说明**：mockAIService.ts 中 mock 数据的年份（2023/2024）是静态程序数据，保留不动；对应的 mock 年份测试同样保留。

---

## 2026-09-06（项目文档整理同步 + 开发服务器启动）

- **任务类型**：文档维护 + 开发任务（轻量）
- **触发原因**：用户要求"整理好项目文档的工作，帮我启动开发服务器运行项目"

### 执行步骤

| 时间 | 步骤 | 内容 | 状态 |
|------|------|------|------|
| - | 读文档 | 按 workflow-manager 第0步读取 workflow-manager.md / convention.md / todo.md / history.md / progress.md / lessons/index.md；确认 package.json 脚本（纯前端 Vite 项目，仅 `dev` 入口，无后端） | ✅ |
| - | todo.md | v1.5.0 勾选已完成项：AI 提示词更新（baseAIProvider 已含 conceptsOverview/双层内容/conceptExamples/commonConclusions，grep 实证）、Mock 数据全量升级（22 主题）、核心概念区块重构；"最后更新"改为 2026-09-06 | ✅ |
| - | history.md | 顶部追加 2026-09-06 条目（五段式）：合并记录 09-05 核心概念区块重构 + 09-06 Mock 全量升级，含文件变更、构建验证（build 通过/56 测试/浏览器 4/4）、经验教训 | ✅ |
| - | progress.md | 版本状态 v1.4.0 部分完成 → v1.5.0 进行中；版本进度条更新；新增 2026-09-06 近期工作记录表（7 项）；最后更新日期同步 | ✅ |
| - | lessons/ | other.md 新增"同一文件严禁并行发起多个 Edit"教训（竞态导致乱码的场景与 4 条正确做法）；index.md 补 3 个关键词、统计 12→13 条、近期教训区追加 | ✅ |
| - | 启动服务 | netstat 确认 5173 未监听（旧服务已停）→ 后台执行 `npm run dev`（job-416d4ec7）→ Vite v5.4.21 ready → HTTP 200 验证通过 | ✅ |
| - | worklog | 本条记录 | ✅ |

### 汇总反馈

**修改文件清单**（5 个文档）：

| 文件 | 关键变更 |
|------|---------|
| `docs/todo.md` | v1.5.0 三项勾选完成 + 日期更新 |
| `docs/history.md` | 追加 2026-09-06 v1.5.0 知识搜索增强条目 |
| `docs/progress.md` | v1.5.0 进度状态 + 近期工作记录 |
| `docs/lessons/other.md`、`docs/lessons/index.md` | 并行 Edit 竞态教训沉淀 |
| `docs/worklog.md` | 本条日志 |

**开发服务器**：http://localhost:5173/ （Vite v5.4.21，后台运行，HTTP 200）

**说明**：本项目为纯前端 Vite 应用（package.json 仅 dev/build/preview/test 脚本，无 server.js 后端），启动开发服务器只需 `npm run dev` 单一入口。

---

## 2026-09-06（知识搜索 mock 数据全量升级新格式 + 并行编辑事故修复）

- **任务类型**：开发任务 + Bug修复
- **触发原因**：用户要求"完善所有的 mock 数据，全部更新到新格式"——产品未正式落地，mock 数据须永远适配最新格式（概念 content 双层结构 + 核心概念总述 + 概念内嵌示例）

### 执行步骤

| 时间 | 步骤 | 内容 | 状态 |
|------|------|------|------|
| - | 类型 | [mockData.ts](file:///e:/Program/Workspace/ai-office-assistant/src/modules/search/mockData.ts) 新增并导出 `MockGeneratedConcept` 接口（`content: { elementary; advanced }`、可选 `notation/example`）；`generatedKnowledgeData` 增 `conceptsOverview?`；`mindMapTestCommon` 测试概念同步升级 | ✅ |
| - | 数据 | 22 个真实主题（物理定律/数学公式/历史事件/生物结构/速度/引擎/牛顿三大定律/万有引力/人工智能/数学定理/光合作用/化学元素/三角函数/勾股定理/化学反应/氧化还原/重大历史事件/工业革命/编程算法/排序算法等）concepts 全部改为双层内容，每主题补 `conceptsOverview` 总述（点明下文关联概念），公式/原理类概念补生活化 `example`（如 F=ma 的 5m/s²、相对速度两车同速、锌铜电池电子守恒） | ✅ |
| - | 服务 | [mockAIService.ts](file:///e:/Program/Workspace/ai-office-assistant/src/services/mockAIService.ts) generatedData 分支：concepts 直接透传新格式（不再 map）；concepts 步返回数据自带 conceptsOverview（generic 兜底保留）；conceptExamples 从概念的 `example` 字段提取；summary 用首概念 advanced 层；知识脉络 relatedTopics 取自思维导图分支标题 | ✅ |
| - | 修复 | 修复并行 Edit 竞态导致的多处文件损坏：速度/引擎交界乱码重建（速度 4 概念+2 示例、引擎 mindMap 开头）、牛顿第二定律 concepts 区乱码重建、牛顿第一定律区乱码重建、文件尾部 defaultQAReply/generateReply 重复 5 份清理为单份 | ✅ |
| - | 测试 | [mockAIService.test.ts](file:///e:/Program/Workspace/ai-office-assistant/src/services/__tests__/mockAIService.test.ts) 新增 describe 5 用例；批量双层校验用例改为直接遍历 generatedKnowledgeData（同步断言，避免 22 主题串行调用服务 5s 超时） | ✅ |
| - | 验证 | `npm run build` 通过（仅 chunk 体积警告）；`npm test` **56/56 全部通过**；浏览器抽查"牛顿第二定律"4/4 PASS：核心概念总述显示、初等/高等双层解释、独立示例卡片含 5m/s²、知识脉络为真实分支（经典力学/工程应用） | ✅ |

### 汇总反馈

**修改文件清单**（3 个文件）：

| 文件 | 关键变更 |
|------|---------|
| `src/modules/search/mockData.ts` | 新增 MockGeneratedConcept 接口；22 主题 concepts 全量双层化 + conceptsOverview + example；修复 4 处乱码/重复损坏区 |
| `src/services/mockAIService.ts` | generatedData 分支适配新格式（concepts 透传、总述优先数据、示例从概念提取、脉络取导图分支） |
| `src/services/__tests__/mockAIService.test.ts` | +5 新格式用例；批量校验改为直接验证数据 |

**经验教训**：
1. **严禁对同一文件并行发起多个 Edit**——并行编辑产生竞态：工具报告成功但实际内容错位/丢失/乱码（字段交叉、碎片拼接、尾部代码块重复）。同文件编辑必须严格串行，每次等返回后再发下一个。
2. 乱码修复时 old_string 必须先 Read 确认真实内容（乱码碎片无法凭记忆还原），替换后用 `grep "content: '"`（旧格式单引号）验证无残留。
3. 批量主题的测试不要串行走带 setTimeout 的 mock 服务（22×7 步易超时），直接断言数据源本身更快更稳定。

---

## 2026-09-05（核心概念区块重构：总述/单列布局/示例解耦/渲染顺序修正）

- **任务类型**：开发任务 + Bug修复
- **触发原因**：用户反馈核心概念缺少知识点详细说明（未提及关联概念定义）；概念卡片两栏布局需改完全上下；示例需从定义组件中解耦为独立区块；mock 须适配最新格式；渲染顺序存在问题（有些内容不显示）

### 执行步骤

| 时间 | 步骤 | 内容 | 状态 |
|------|------|------|------|
| - | 排查 | 定位"内容不显示"根因：旧 `examples`（Example[]）与 `relatedResults` 区块在 7 步流程中无任何数据源，永远为空；handleCopy 导出仍按旧格式拼接（concept.content 已变为对象，会输出 [object Object]）；loading 首步提示不准确；mock concepts 仅 1 个简陋概念、commonConclusions 为空 | ✅ |
| - | 类型 | SearchGenerateResponse / SearchGeneratePartialResponse / GeneratedKnowledge 增 `conceptsOverview?: string`（知识点详细说明总述） | ✅ |
| - | AI 层 | baseAIProvider concepts prompt 改为"核心概念详解"：先输出 conceptsOverview（3~5 句，点明下文关联概念及关系）再输出 concepts；fallback 默认值补字段。mock generatePartial：concepts 分支返回总述；概念丰富为 3 个（定义/原理/公式，初等高等分层、公式带 notation）；conceptExamples 改为前 N-1 个概念有示例（公式概念无示例，演示可选）；commonConclusions 补 2 条；generate 接口同步 | ✅ |
| - | 状态机 | concepts 步合并 conceptsOverview（search 与 selectGraphNode 两处） | ✅ |
| - | UI | SearchResults：核心概念标题下渲染灰色总述段落；概念区 `md:grid-cols-2` → `flex flex-col`（完全上下）；示例从定义卡片内移除，改为定义卡片后的独立琥珀色卡片（Fragment 交替渲染，无示例不渲染）；删除无数据源的旧 examples 与 relatedResults 区块及 KnowledgeCard 导入；loading 首步改为"正在生成知识点概览..."，末步"趣味知识"；handleCopy 重写为新格式（概览/总述/双层解释/notation/示例/知识脉络/试题/趣味）；export.ts 核心概念导出补总述与示例 | ✅ |
| - | 验证 | `npm test` 51/51 通过（新增 4 个 mock 格式用例：总述非空、示例可选性、commonConclusions、7 步 success；状态机断言 conceptsOverview 合并）；`npm run build` 通过；浏览器实测 7/7 PASS（顺序正确、总述显示、单列、示例独立卡片、常用结论/趣味显示、旧区块已删、控制台无错误） | ✅ |

### 汇总反馈

**修改文件清单**（8 个文件）：

| 文件 | 关键变更 |
|------|---------|
| `src/types/ai.ts` | SearchGenerateResponse/Partial 增 conceptsOverview |
| `src/types/index.ts` | GeneratedKnowledge 增 conceptsOverview |
| `src/services/baseAIProvider.ts` | concepts prompt 增总述要求；fallback 补字段 |
| `src/services/mockAIService.ts` | 3 概念分层数据、总述、示例可选（N-1）、commonConclusions |
| `src/modules/search/useSearchStateMachine.ts` | concepts 步合并 conceptsOverview（两处） |
| `src/modules/search/SearchResults.tsx` | 总述段落、单列布局、示例独立卡片、删 2 个死区块、loading 文案、复制 Markdown 重写 |
| `src/utils/export.ts` | 导出补总述与概念示例 |
| 2 个测试文件 | +4 mock 格式用例、状态机总述断言 |

**经验**：分步生成改造后，旧数据区块（examples/relatedResults）若无步骤填充即为死区块，应连同 UI 一并删除而非保留；数据结构变更（content 字符串→对象）时必须同步检查导出/复制等序列化路径。

---

## 2026-09-05（归一化循环剥离逻辑）

- **任务类型**：重构优化 + 测试任务
- **触发原因**：上一轮边界测试发现"介绍什么是加速度"类多重修饰输入只剥离一层，用户确认补充循环剥离逻辑

### 执行步骤

| 时间 | 步骤 | 内容 | 状态 |
|------|------|------|------|
| - | 实现循环剥离 | mockAIService analyze：疑问词剥离链提取为 `stripQuestionWords` 函数，do-while 循环执行直至字符串稳定（每轮所有模式各应用一次，必然收敛），空结果仍兜底保留原文 | ✅ |
| - | 补充测试 | 新增"多重修饰循环剥离"5 用例：介绍什么是加速度/说明什么是微积分/解释加速度的定义/介绍说明加速度的概念/说明说明加速度 → 均归一化为知识点本身；单前缀旧用例回归无影响 | ✅ |
| - | 验证 | `npm test` 47/47 通过（17.6s）；`npm run build` 通过（9.92s） | ✅ |

### 汇总反馈

**修改文件清单**：

| 文件 | 变更 |
|------|------|
| `src/services/mockAIService.ts` | analyze 归一化由单遍链式 replace 改为循环剥离至稳定 |
| `src/services/__tests__/mockAIService.test.ts` | 新增 5 个多重修饰用例（24 → 29） |

**经验**：链式 replace 单遍执行只能处理"前缀+后缀各一层"；多重修饰需循环至不动点。循环安全性由"每个模式严格缩短或不变"保证，无死循环风险。

---

## 2026-09-05（补充单元测试边界用例）

- **任务类型**：测试任务
- **触发原因**：用户要求为知识搜索模块的 mock 正则测试与状态机测试补充边界用例

### 执行步骤

| 时间 | 步骤 | 内容 | 状态 |
|------|------|------|------|
| - | mockAIService 边界 | 新增 11 用例：validate 输入边界 3 例（空串/单字符/正常）；analyze 边界 4 例（"是谁"单独句尾匹配、空串兜底 canonical 为空、"是谁提出的"剥离后兜底保留原文、"介绍加速度"前缀剥离）；算式变体 4 例（x/*/空格分隔/^计算 前缀） | ✅ |
| - | 状态机边界 | 新增 11 用例：前置阶段 5 例（validate 接口失败/INVALID 状态不调 analyze/analyze 失败/analyze 抛异常/generatePartial 抛异常）；字段缺省与分支 2 例（isKnowledgePoint undefined 按 `=== false` 严格判断继续生成、isSpecific=false 走 KNOWLEDGE_GRAPH 不生成）；生成阶段 4 例（summary 空串判失败、summary success 无 data 判失败、conceptExamples title 不匹配不填充示例、selectGraphNode node.topic 优先于 title） | ✅ |
| - | 验证 | `npm test` 42/42 通过（15.6s）；`npm run build` 通过（10.82s） | ✅ |

### 汇总反馈

**修改文件清单**（2 个测试文件，均为追加用例，无生产代码改动）：

| 文件 | 用例数 |
|------|--------|
| `src/services/__tests__/mockAIService.test.ts` | 13 → 24 |
| `src/modules/search/__tests__/useSearchStateMachine.test.tsx` | 7 → 18 |

**发现**：边界用例验证了既有兜底逻辑（空串、剥离后为空、字段缺省）均按预期工作，未暴露新缺陷；"介绍什么是加速度"类双重前缀输入目前只剥离一层（链式 replace 单遍），属已知限制，如需支持可改为循环剥离到稳定。

---

## 2026-09-05（补充知识搜索模块单元测试）

- **任务类型**：测试任务
- **触发原因**：用户要求为知识搜索模块 Advisory 处理中的 mock 正则修复与状态机失败判断逻辑补充单元测试

### 执行步骤

| 时间 | 步骤 | 内容 | 状态 |
|------|------|------|------|
| - | 摸底 | 确认项目无测试框架（package.json 无 test 脚本、无测试文件），类型定义与 mock 延迟已确认 | ✅ |
| - | 引入框架 | 安装 vite5 兼容的 `vitest@^2.1.9`（vitest 5 需 vite 6+，首次安装 ERESOLVE 后降级）+ `jsdom` + `@testing-library/react@^14.3.1`；package.json 增 `test`/`test:watch` 脚本；新建 `vitest.config.ts`（jsdom 环境，匹配 `src/**/*.{test,spec}.*`） | ✅ |
| - | mock 正则测试 | 新建 `src/services/__tests__/mockAIService.test.ts`（13 用例）：非知识点 4 例（牛顿是谁/作者是谁/算式/写邮件）；知识点历史不误判 3 例（"加速度的定义是谁提出的"→"加速度"等）；归一化 5 例；试题年份 2023-2026 范围 1 例（Advisory 1 回归） | ✅ |
| - | 状态机测试 | 新建 `src/modules/search/__tests__/useSearchStateMachine.test.tsx`（7 用例，vi.mock aiServiceProvider）：7 步全成功→DISPLAYING+示例按 title 合并；仅 summary 成功→仍 DISPLAYING（Advisory 3 核心）；全失败→IDLE+"生成失败"；selectGraphNode 两分支同理；生成主题=canonicalTopic；非知识点→onRedirectToQA(原始输入)且不生成 | ✅ |
| - | 验证 | `npm test` 20/20 通过（15.4s）；`npm run build` 通过（11.49s，tsc 类型检查覆盖测试文件） | ✅ |

### 汇总反馈

**新增/修改文件清单**：

| 文件 | 说明 |
|------|------|
| `vitest.config.ts` | 新建：vitest 配置（jsdom + react 插件） |
| `package.json` | 增 test/test:watch 脚本与 3 个 devDependencies |
| `src/services/__tests__/mockAIService.test.ts` | 新建：mock 正则与归一化 13 用例 |
| `src/modules/search/__tests__/useSearchStateMachine.test.tsx` | 新建：状态机失败判断/归一化/QA 切换 7 用例 |

**经验**：vitest 版本须与 vite 大版本匹配（vitest 2 ↔ vite 5）；@testing-library/react 14 配 React 18 无需额外 peer；vi.mock 路径相对测试文件而非被测模块。

---

## 2026-09-05（处理 review.md 非阻塞建议）

- **任务类型**：重构优化 + Bug修复
- **触发原因**：用户要求处理知识搜索模块优化独立审查（Review R1）中遗留的 3 条非阻塞建议（第 1 条 mock 试题年份已在 R1 时修正）

### 执行步骤

| 时间 | 步骤 | 内容 | 状态 |
|------|------|------|------|
| - | 确认范围 | 读 review.md Review History，明确待处理 3 条：useRef 优化 effect、失败判断放宽、mock /是谁/ 正则过宽 | ✅ |
| - | Advisory 2 | index.tsx 增加 `processedTopicRef`（useRef）：canonicalTopic 已处理过则跳过 effect，避免 history 每次变化重复遍历；在 handleSearch/handleNodeClick/handleHistoryClick 发起新搜索时重置标记，保证删除历史后重新搜索同一主题仍能创建记录 | ✅ |
| - | Advisory 3 | useSearchStateMachine 两处（search/selectGraphNode）失败判断由"mindMap 与 concepts 均空"放宽为"summary/mindMap/concepts 任一有内容即成功"，AI 仅返回 summary 时不再误判"生成失败"并丢弃概览 | ✅ |
| - | Advisory 4 | mockAIService 非知识点正则 `/是谁/` 收窄为 `/是谁$/`（"牛顿是谁"仍判问答）；归一化链首步新增剥离 `/是谁(提出\|发现\|发明\|创立\|推导\|证明)的?$/`（"加速度的定义是谁提出的"→知识点"加速度"）；baseAIProvider analyze prompt 同步补充该口径（保持 NFR-3 mock/真实路径一致） | ✅ |
| - | 验证 | `npm run build` 通过（9.64s）；浏览器回归 4/4 PASS：①"加速度的定义是谁提出的"→搜索流程且历史标题"加速度"；②"牛顿是谁"→自动切问答；③"加速度是什么"与①合并为同一条历史；④控制台无 React 深度警告 | ✅ |
| - | 记录 | review.md 追加 Review R2（advisory 全部闭环）；本日志 | ✅ |

### 汇总反馈

**修改文件清单**（共 4 个文件）：

| 文件 | 关键变更 |
|------|---------|
| `src/modules/search/index.tsx` | processedTopicRef 优化 effect 重复执行，3 个搜索入口重置标记 |
| `src/modules/search/useSearchStateMachine.ts` | 两处失败判断放宽（保留 summary） |
| `src/services/mockAIService.ts` | /是谁/ 收窄句尾匹配、归一化剥离"是谁提出的"类后缀 |
| `src/services/baseAIProvider.ts` | analyze prompt 补充知识点历史问题口径说明 |

**经验**：mock 正则收窄时需同步真实 AI prompt，保证两条路径判断口径一致；useRef 防重入方案必须考虑"用户删除历史后重搜"的边界，在搜索入口重置标记。

---

## 2026-09-05（知识搜索模块优化：概览/归一化/自动问答/分步生成）

- **任务类型**：开发任务 + 重构优化
- **触发原因**：用户要求优化知识搜索模块——新增知识点概览、输入归一化与历史标题同步、非知识点自动切换问答模式、拆分步生成优化速度

### 执行步骤

| 时间 | 步骤 | 内容 | 状态 |
|------|------|------|------|
| - | 理解需求 | 阅读 spec-mode 模板，探索代码结构（useSearchStateMachine、baseAIProvider、SearchResults、HistoryContext、useSearchMode） | ✅ |
| - | 编写规格 | 创建 `.trae/specs/search-optimization/spec.md` 和 `tasks.md`，经 3 轮用户反馈迭代（概览标题用知识点名、拆 7 步、概念定义与示例分步）后获批 | ✅ |
| - | Task 1 类型扩展 | `SearchAnalyzeResponse` 增 `isKnowledgePoint`/`canonicalTopic`；`Concept` 增 `example`；`GeneratedKnowledge`/`SearchGenerateResponse`/`SearchGeneratePartialResponse` 增 `summary`；`GeneratePart` 扩为 7 值；增 `conceptExamples` 字段 | ✅ |
| - | Task 2 AI 服务层 | `baseAIProvider` analyze prompt 增知识点判断+归一化；`generatePartial` 拆 7 分支（summary 用 medium 深度，mindMap 不含 concepts，concepts 不含 example，conceptExamples 按 title 返回，examQuestions 限 2023-2026）；同步 mockAIService | ✅ |
| - | Task 3 状态机 | `useSearchStateMachine` 接收 `onRedirectToQA` 回调；非知识点触发回调终止；用 `canonicalTopic` 生成；7 步渐进生成；conceptExamples 按 title 合并到 concept.example | ✅ |
| - | Task 4 历史归一化 | `index.tsx` 用 `canonicalTopic` 创建历史（移除原始输入条目）；QA 重定向走 qa 历史；`viewingQuery` 优先用 canonicalTopic | ✅ |
| - | Task 5 UI | `SearchResults` 思维导图前增概览卡片（标题=topic，内容=summary）；概念卡片渲染 `concept.example`（有则显示无则隐藏）；加载提示适配 7 步 | ✅ |
| - | 修复循环依赖 | 发现 `getSearchSession` 因数据缺 `result` 字段返回 undefined 导致 effect 死循环；改为直接检查 history 数组并补 `result` 字段 | ✅ |
| - | Task 6 验证 | `npm run build` 成功；浏览器测试：概览在思维导图前、历史标题归一化、非知识点自动切问答、概念示例可选渲染、无 React 深度警告 | ✅ |

### 汇总反馈

**修改文件清单**（共 6 个文件）：

| 文件 | 关键变更 |
|------|---------|
| `src/types/ai.ts` | SearchAnalyzeResponse 增字段、GeneratePart 扩 7 值、SearchGeneratePartialResponse 增 summary/conceptExamples |
| `src/types/index.ts` | Concept 增 example、GeneratedKnowledge 增 summary |
| `src/services/baseAIProvider.ts` | analyze prompt 重写、generatePartial 拆 7 分支 |
| `src/services/mockAIService.ts` | analyze 增归一化与非知识点判断、generatePartial 7 分支 |
| `src/modules/search/useSearchStateMachine.ts` | 7 步生成、onRedirectToQA、canonicalTopic |
| `src/modules/search/index.tsx` | canonicalTopic 历史、QA 重定向、修复循环 |
| `src/modules/search/SearchResults.tsx` | 概览卡片、概念示例、加载提示 |

---

## 2026-08-04（创建 workflow-manager.md 替代旧 workflow.md）

- **任务类型**：文档维护 + 配置变更
- **触发原因**：用户要求按最新 workflow-manager Skill 方式补充 `workflow-manager.md`，替代旧有的 `workflow.md` 文档

### 执行步骤

| 时间 | 步骤 | 内容 | 状态 |
|------|------|------|------|
| - | 理解需求 | 按 workflow-manager Skill 最新模板创建项目级配置文件 `docs/workflow-manager.md`，删除旧 `docs/workflow.md`，同步更新所有引用 | ✅ |
| - | 确认需求 | 跳过（文档维护类任务 + 用户明确指示"替代"） | ✅ |
| - | 读取核心文档 | 读取 workflow-manager Skill 定义、旧 workflow.md、convention.md、project-document-manager.md、goal.md、progress.md | ✅ |
| - | 执行①：创建 workflow-manager.md | 基于最新 Skill 模板填充项目特定配置：基础文档用 convention.md 替代未启用的 config.md；追加读取清单对齐本项目实际启用文档；Git 集成（手动提交）；项目特定规范 8 条；继承旧 workflow.md 的决策机制与构建验证规范 | ✅ |
| - | 执行②：删除旧 workflow.md | 使用 DeleteFile 删除 `docs/workflow.md` | ✅ |
| - | 执行③：更新引用 | convention.md 文档清单 `workflow.md` → `workflow-manager.md`；goal.md 关联文档同步；project-document-manager.md 文档清单同步；convention.md 变更记录追加一条 | ✅ |
| - | 执行④：记录日志 | 本文件 | ✅ |

### 汇总反馈

**修改文件清单**（共 5 个文件：1 新建、1 删除、3 修改）：

| 文件 | 操作 | 关键变更 |
|------|------|---------|
| `docs/workflow-manager.md` | 新建 | workflow-manager Skill 项目级执行规范：任务类型/5步执行/回滚/Git集成/日志格式/协同规则/项目特定规范 8 条 |
| `docs/workflow.md` | 删除 | 旧项目工作流文档，已被 workflow-manager.md 替代 |
| `docs/convention.md` | 编辑 | 文档清单 `workflow.md` → `workflow-manager.md`（名称改为"工作流管理配置"）；变更记录追加一条 |
| `docs/goal.md` | 编辑 | 关联文档"项目工作流" → "工作流管理配置"，链接指向 workflow-manager.md |
| `docs/project-document-manager.md` | 编辑 | 文档清单 `workflow.md` → `workflow-manager.md`（用途更新） |

**核心变更**：
1. 按 workflow-manager Skill 最新模板创建 `docs/workflow-manager.md`
2. 项目特定配置：
   - 基础文档用 `convention.md`（替代未启用的 `config.md`）
   - Git 集成：手动提交（对齐项目实际）
   - 项目特定规范 8 条：PRD 唯一真实来源、代码>文档、外部文件处理、死代码处理、知识目录 vs 知识图谱、6 种卡片、AI 密钥、构建验证
   - 继承旧 workflow.md 的决策机制（必须确认的 6 种情况）和构建验证要求（npm run build）
3. 旧 `docs/workflow.md` 已删除，所有引用已同步更新

**未触及代码**：本次为纯文档修正，无构建验证需求。

---

## 2026-08-04（文档同步重大修正）

- **任务类型**：文档维护（多类型组合：文档维护 + 重构优化 + 配置变更）
- **触发原因**：用户反馈项目记忆被错误写进全局、文档存在重大同步失误、知识图谱导航/6 种知识卡片展示实际未完成

### 执行步骤

| 时间 | 步骤 | 内容 | 状态 |
|------|------|------|------|
| - | 理解需求 | 用户要求修正所有文档错误：① 全局记忆误写项目内容 ② 文档同步失误 ③ 知识结构图谱/算法动画不考虑 ④ 知识图谱导航/6 种卡片展示未完成 | ✅ |
| - | 确认需求 | 跳过（文档维护类任务，且用户明确要求"马上修正所有文档的错误"） | ✅ |
| - | 读取核心文档 | 读取 prd.md/goal.md/todo.md/progress.md/versions.md/issues.md/design.md/convention.md/workflow.md/project-document-manager.md + 7 个 milestones README + types/index.ts | ✅ |
| - | 发现关键问题 | progress.md 把 design.md/milestones/convention.md/issues.md 标为"已完成"，但实际文件未修改 | ✅ |
| - | 执行①：修正 issues.md | 待解决区新增"6 种知识卡片完整展示未完成""知识图谱导航未完成"两条 | ✅ |
| - | 执行②：重写 design.md | v1.1：5→6 种卡片（补 FormulaCard）、知识结构图谱→知识目录、11 种文档类型、数据模型对齐 types/index.ts、新增 AI 服务抽象层章节 | ✅ |
| - | 执行③：修正 milestones | m005/m006 标弃用、m007 改已完成、m001~m004 补齐实际完成内容 | ✅ |
| - | 执行④：修正 convention.md | 文档清单补全 project-document-manager.md 等 7 项；补充同步触发规则与冲突处理优先级 | ✅ |
| - | 执行⑤：追加 history.md | 顶部插入 2026-08-04 条目，五段式（事件/文件变更/构建验证/关联文档/经验教训） | ✅ |
| - | 执行⑥：修正 progress.md | 近期工作记录改写为如实反映，增加本轮修正说明 | ✅ |
| - | 执行⑦：创建 worklog.md | 本文件 | ✅ |

### 汇总反馈

**修改文件清单**（共 16 个文件）：

| 文件 | 操作 | 关键变更 |
|------|------|---------|
| `docs/issues.md` | 编辑 | 新增 2 条待解决项 |
| `docs/design.md` | 重写 | v1.0 → v1.1，6 种卡片 + 知识目录 + 11 种文档类型 + 数据模型对齐 |
| `docs/milestones/m001-framework/README.md` | 重写 | 补齐 Vite+React+TS、4 Tab、主题/语言切换、全局菜单 |
| `docs/milestones/m002-search/README.md` | 重写 | 标注 6 种卡片未完成 + 补齐思维导图/状态机/渐进式生成 |
| `docs/milestones/m003-translate/README.md` | 重写 | 修正为手动切换 + 补齐 TTS/关联术语/搭配/语域/词源 |
| `docs/milestones/m004-doc/README.md` | 重写 | 5→11 种文档类型 + Markdown 渲染 + PDF 导出 |
| `docs/milestones/m005-visualization/README.md` | 重写 | 已完成 → ⛔ 已弃用 |
| `docs/milestones/m006-algorithm/README.md` | 重写 | 已完成 → ⛔ 已弃用（m010 随之弃用） |
| `docs/milestones/m007-chat/README.md` | 重写 | 待开发 → ✅ 已完成 |
| `docs/convention.md` | 重写 | 文档清单补全 7 项 + 同步触发规则 + 冲突处理优先级 |
| `docs/history.md` | 编辑 | 顶部插入 2026-08-04 五段式条目 |
| `docs/progress.md` | 编辑 | 近期工作记录改为如实反映 + 增加本轮修正说明 |
| `docs/worklog.md` | 新建 | 本文件 |

**核心修正**：
1. **6 种知识卡片**：所有文档如实标注"组件已存在但未在搜索结果主流程接入"为未完成
2. **知识图谱导航**：所有文档统一为"暂不考虑开发，仅保留 div 层级知识目录占位"
3. **算法动画/动态可视化**：所有文档标记为已弃用，代码保留待评估
4. **数据模型**：design.md 与 `src/types/index.ts` 完全对齐
5. **词典模式切换**：所有文档统一为手动切换（非自动检测）
6. **文档类型**：所有文档统一为 11 种（含 general）
7. **里程碑状态**：m005/m006 弃用、m007 已完成

**未触及代码**：本次为纯文档修正，未修改 `src/` 下任何代码文件，无构建验证需求。

### 经验教训（已记录到 history.md）
- progress.md 误报已完成：文档同步状态必须以实际文件内容为准
- 项目记忆与全局记忆混淆：user_profile.md 只放跨项目通用偏好
- 里程碑状态漂移：里程碑 README 状态需随版本演进同步更新

---

## 2026-01-02（AI 模块多厂商多模型扩展 — v1.5.0）

- **任务类型**：开发任务 + 设计任务 + 文档维护 + 测试任务
- **触发原因**：用户以 `/plan` 发起，需求为"已实现单个 GLM 模型功能，小心扩展到更多模型以完善 AI 模块"；先出审批计划文档 `ai_multi_model_extension_plan.md`，用户批准后立即实施。
- **核心目标**：一期接入 3 厂商（智谱AI / 阿里通义千问 / 硅基流动）× 3 型号共 9 款；业务模块调用签名 1:1 兼容；老 GLM Key 无感迁移；UI 端可见可切换；tsc --noEmit 零错误。

### 执行步骤

| 步骤 | 内容 | 交付物 | 状态 |
|------|------|--------|------|
| 步骤1 类型层 | 新建 `types/aiProviders.ts`（ProviderId / AIConfigRoot / PROVIDER_META 3×3 / 工厂 / 辅助函数）；`types/ai.ts` 为 AIMetadata 追加可选 `providerId` | 新建 1，修改 1 | ✅ |
| 步骤2 BaseAIProvider 基类 | `utils/jsonRepair.ts` 独立 4 层 JSON 修复；`hooks/useAIConfigStore.ts` 纯存储层（LS 读写 + 三段式迁移）；`services/baseAIProvider.ts` 抽象基类（callModel / callModelWithJSON / withFallback / buildService） | 新建 3 | ✅ |
| 步骤3 三个 Provider | `services/providers/{zhipuProvider,dashscopeProvider,siliconflowProvider}.ts`；DashScope 额外做旧格式错误归一；SiliconFlow 覆盖中文系统前缀 | 新建 3 | ✅ |
| 步骤4 useAIConfig Hook | `hooks/useAIConfig.ts`：格式校验 + 5s Ping 验证（401/quota/429/网络归一）、跨 Tab storage 事件同步、zhipu 兼容 getters、模块加载级自动初始化/迁移 | 新建 1 | ✅ |
| 步骤5 路由 + 兼容层 | `services/aiServiceProvider.ts` 重写（PROVIDER_INSTANCES 注册表 + shouldUseRealAI 按 activeProvider.status 路由）；`services/glmAIService.ts` 改为 deprecated 单例委托 zhipu；`hooks/useApiKey.ts` 改为 deprecated 委托 useAIConfig.zhipu（双写旧 key）；修复 4 处 require→ESM import | 修改 3 | ✅ |
| 步骤6 UI 升级 | `components/settings/ModelSelector.tsx`（3 厂商级联型号，显示状态徽标/上下文长度/推荐）；`components/settings/ProviderKeyInput.tsx`（单厂商 Key + 显示隐藏密码 + 自定义BaseURL/型号 + 验证 + 清除）；`components/layout/Header.tsx` 改为 Tab 面板（模型选择 Tab + 3 厂商 Key Tab），顶栏按钮摘要显示当前厂商·型号 | 新建 2，修改 1 | ✅ |
| 步骤7 验证 + 文档 | `tsc --noEmit` 打包验证（修复 3 项编译错误：unused import / 错导出函数）；`docs/design.md` 第5章重写 + 第6章升级；`docs/architecture.md` 第11/13章升级；本日志写入 | 修改 3 | ✅ |

### 修改文件清单（共 15 个文件：12 新建 + 3 修改 → 实际 12 新建/6 修改）

| 文件 | 操作 | 关键变更 |
|------|------|---------|
| `src/types/aiProviders.ts` | 新建 | ProviderId / AIDepth / ModelInfo / PROVIDER_META 3×3 / createDefault* / resolve* |
| `src/types/ai.ts` | 修改 | AIMetadata 增加 `providerId?: ProviderId` |
| `src/utils/jsonRepair.ts` | 新建 | VALID_JSON_ESCAPE / cleanJSONText / repairTruncatedJSON / parseJSONResponse 4 层修复 |
| `src/hooks/useAIConfigStore.ts` | 新建 | LS key v1 root / setStored / updateStored / tryMigrateLegacy 三段式 / getProviderRuntime |
| `src/hooks/useAIConfig.ts` | 新建 | React Hook：providers、activeProviderId/ModelId、validateAndSaveProviderKey、storage 跨 Tab 同步 |
| `src/services/baseAIProvider.ts` | 新建 | 抽象基类：callModel OpenAI 兼容模式、callModelWithJSON、withFallback、buildService() 生成完整 AIService |
| `src/services/providers/zhipuProvider.ts` | 新建 | ZhipuAIProvider（default 行为） |
| `src/services/providers/dashscopeProvider.ts` | 新建 | DashScopeAIProvider + mapErrorResponse 旧格式归一 |
| `src/services/providers/siliconflowProvider.ts` | 新建 | SiliconFlowAIProvider + 中文系统前缀 |
| `src/services/aiServiceProvider.ts` | 修改 | 3 Provider 路由 + getAvailableProviders / getModelsForProvider / shouldUseRealAI 重构 |
| `src/services/glmAIService.ts` | 修改 | @deprecated 委托 zhipuAIProvider.buildService() |
| `src/hooks/useApiKey.ts` | 修改 | @deprecated 委托 useAIConfig.zhipu（旧签名不变），保留旧 storage 双写 |
| `src/components/settings/ModelSelector.tsx` | 新建 | 厂商卡片 + 型号列表两级级联 |
| `src/components/settings/ProviderKeyInput.tsx` | 新建 | Key 输入 + 显示隐藏密码 + 高级选项折叠 + 验证/清除 |
| `src/components/layout/Header.tsx` | 修改 | AI 按钮状态化 + Tab 面板（模型选择/3 厂商 Key），不再用 useApiKey |
| `docs/design.md` | 修改 | 第 5 章重写为 7 小节（契约/Provider 体系/深度配置/JSON 修复/Prompt/存储结构/Hook）；第 6 章升级为多厂商配置 |
| `docs/architecture.md` | 修改 | 第 11 章 AI 服务集成升级到 v1.5.0 架构图 + 路由流程 + Fallback 矩阵；第 13 章升级多厂商面板说明 |
| `docs/worklog.md` | 修改 | 本条日志 |

### 构建与验证

- **TypeScript**：`npm run build`（vite+tsc）通过，0 errors；仅 1 条 bundle size warning（>500KB chunk）与本次改动无关。
- **修复的编译错误**：① ModelSelector.tsx 未使用 `ProviderId` import → 删除；② useApiKey.ts `getStoredApiKey` 声明未调用 → 删除；③ aiServiceProvider.ts 错引 `isActiveProviderValid` → 改为从 `getStoredAIConfig()` 直接读状态。
- **手动冒烟清单（建议在下一轮浏览器测试中覆盖）**：
  1. 旧 GLM Key 注入 → 首次加载自动迁移 → Header 摘要显示「智谱·glm-4-flash」
  2. 新用户进入面板 → 3 家厂商 Tab 可见，任一家保存密钥显示状态点
  3. 切换厂商 → activeProviderId 变化，getActiveProviderId 返回对应值（Network 请求命中正确 URL/Header）
  4. 某厂商故意输错 → 该厂商 status=invalid（红色点+错误文案），切到另一家已配厂商请求正常
  5. 自定义 Base URL（http://localhost:9999/proxy）保存后，请求发往该地址
  6. 跨 Tab：A Tab 改 activeProvider，B Tab 摘要同步刷新

### 经验教训 / 关键决定

1. **ESM require 是雷区**：初稿多处用 `require('../types/aiProviders')`，TS + Vite ESM 会在运行时报 "require is not defined"；最终统一为 top-level ESM import。
2. **纯存储层与 React Hook 分层**：BaseAIProvider 不能依赖 React（callModel 运行时读配置），所以把 LS 读写单独抽到 useAIConfigStore.ts，Hook 层在此之上再做 useState + 事件订阅，避免循环依赖。
3. **兼容层比破坏性升级更安全**：保留 glmAIService.ts / useApiKey.ts 两个 deprecated 门面，旧 Header、App 等已有调用处零改动；等后续搜索/翻译/文档模块自然切换后再统一移除。
4. **UI 状态独立于验证状态**：useApiKey 原本用"编辑中本地 inputValue → 保存后写 store"双轨，ProviderKeyInput 沿用同样思路，仅 validate 成功才写，避免未保存时跨 Tab 污染已验证的 provider。

---

## 2026-01-02（AI 多模型配置面板密钥状态 Bug 修复）

- **任务类型**：Bug 修复 + 测试验证
- **触发原因**：用户反馈"密钥状态存在调用逻辑错误"，要求通过开发服务器调试实测定位并修复。
- **核心问题**：切换 activeProvider 后顶栏按钮文字不更新（仍显示"未配置密钥"而非"配置失效"）。

### 问题根因

`Header`、`ModelSelector`、`ProviderKeyInput` 三个组件各自调用 `useAIConfig()` → 每个组件有独立的 `useState(root)`。`ModelSelector` 中切换厂商只更新了自己的 state，`Header` 的 state 不会同步。`storage` 事件仅在**跨 Tab** 时触发，同一 Tab 内不触发，导致状态断裂。

### 修复内容

| 修复项 | 根因 | 方案 | 文件 |
|--------|------|------|------|
| **跨组件状态不同步** | `useState` 各组件独立 | `useAIConfigStore` 新增全局 store（cachedRoot + listeners + subscribe/emit），`useAIConfig` 改用 `useSyncExternalStore` 共享同一份状态；`updateStoredAIConfig` 改为深拷贝后修改避免引用不变 | `useAIConfigStore.ts`、`useAIConfig.ts` |
| **429/网络错误误标 invalid** | `validateAndSaveProviderKey` 中任何失败都设 `status='invalid'` | `validateProviderKeyWithPing` 返回 `kind: 'invalid_key' \| 'network_error'`；429 直判 valid（Key 被接受）；网络错误回退到之前状态而非 invalid | `useAIConfig.ts` |
| **handleSave 闭包陈旧** | `setLocalError(cfg.error)` 中 `cfg` 是闭包旧值 | 移除 `setLocalError(cfg.error)`，依赖 `useSyncExternalStore` 重渲染后 `cfg.error` 自动更新 | `ProviderKeyInput.tsx` |

### 浏览器验证结果（9 步 8 PASS）

| 步骤 | 验证点 | 结果 |
|------|--------|------|
| 1 | 初始页面加载 | PASS |
| 2 | 打开面板 + 切换 Tab | PASS |
| 3 | 智谱假密钥验证 → "配置失效" | PASS |
| 4 | 通义假密钥验证 → 错误提示 + "配置失效" | PASS |
| 5 | 模型选择 Tab 3 厂商徽标正确 | PASS |
| **6** | **切到通义 → 顶栏显示"配置失效"（原 Bug）** | **PASS** |
| 7 | 切到硅基 → 顶栏显示"未配置密钥" | PASS |
| 8 | 切回智谱 → 顶栏显示"配置失效" | PASS |
| 9 | localStorage 数据结构完整 | PASS |

### 经验教训

1. **`useState` 不适合跨组件共享状态**：多个组件各自 `useAIConfig()` 时，`useState` 创建独立副本，一个组件更新不会通知其他组件。必须用 `useSyncExternalStore`（或 Context）共享。
2. **`storage` 事件仅跨 Tab 触发**：同 Tab 内修改 `localStorage` 不会触发 `storage` 事件，不能作为同组件间状态同步机制。
3. **深拷贝是必要防御**：`updateStoredAIConfig` 如果直接 mutate 缓存对象，`useSyncExternalStore` 的 snapshot 引用不变，React 不触发重渲染。必须深拷贝后替换。
4. **429 ≠ Key 无效**：限流只说明 Key 被接受但超出频率，不应标记为 invalid；网络超时同理，应保留原状态而非降级。

---

## 2026-09-03（AI 多模型下拉化 + 无限扩展 v2）

- **任务类型**：重构优化 + 功能开发
- **触发原因**：用户要求模型选择改为下拉选项，支持尽可能多的模型（无限制）。

### 执行要点

| 步骤 | 内容 | 状态 |
|------|------|------|
| 类型层 | `ProviderId` 改 `string`；`AIConfigRoot` 升 v2 + `customProviders`；辅助函数加 customProviders 查询参数 | ✅ |
| 存储层 | safeParse 只认 v2；删除 tryMigrateLegacy/LEGACY 常量 | ✅ |
| Provider 层 | 新建 `GenericAIProvider`（overlay 注入差异）；3 个子类合并；工厂 + Map 缓存；删除 glmAIService.ts/useApiKey.ts | ✅ |
| Hook 层 | 新增 addCustomProvider/removeCustomProvider；validatingMap 改 Record\<string, boolean\> | ✅ |
| UI 层 | ModelSelector 下拉化（厂商 select + 型号 select + 自定义模型输入）；新建 AddProviderForm；Header 固定 3 Tab（模型选择/密钥管理/添加厂商） | ✅ |
| 验证 | tsc --noEmit 零错误；浏览器实测 14/14 PASS（下拉切换/自定义模型/添加+删除自定义厂商/localStorage v2） | ✅ |

### 经验教训

- 用户明确"产品未正式落地，不需考虑老用户兼容"，据此直接删除全部迁移逻辑和兼容层（6 个文件/代码段），代码显著简化。该经验直接催生了"产品生命周期阶段"Skill 规则（见下条日志）。

---

## 2026-09-03（声明产品阶段为开发期 + Skill 新增生命周期阶段原则）

- **任务类型**：文档维护
- **触发原因**：用户指出项目缺乏"产品未正式落地"的注明，导致开发中曾为不存在的老用户写迁移/兼容代码（无用冗余）；要求文档说明，并把该原则补充到项目管理 Skill 中作为通用规则。

### 执行步骤

| 步骤 | 内容 | 状态 |
|------|------|------|
| 项目文档 | `docs/project-document-manager.md` 顶部新增「产品生命周期阶段：开发期」章节（5 条约束 + 切换条件）；关键约束新增第 1 条 | ✅ |
| goal.md | 目标状态新增阶段声明；AI 清单更新为多模型架构 | ✅ |
| Skill 通用化 | 全局 `project-document-manager/SKILL.md` 新增「产品生命周期阶段（最高优先级约束）」章节：开发期/运营期两阶段约束表 + 4 条执行规则 + 判断信号；基本模板新增阶段字段；触发后第一步要求先读阶段声明 | ✅ |
| 记录 | history.md 五段式记录 + 本日志 | ✅ |

### 关键规则（沉淀进 Skill，适用于所有项目）

- **开发期**：不考虑向后兼容、不写迁移、不保留 @deprecated 层、直接删除/重写
- **运营期**：破坏性变更必须迁移、废弃接口保留一个版本周期、删除前确认无引用、存储双版本兼容
- 原则：兼容性成本只应为真实用户和真实数据支付

---

## 2026-09-04（项目冗余清理 + 文档同步 + 开发服务器启动）

- **任务类型**：重构优化（清理）+ 文档维护
- **触发原因**：用户要求清理项目冗余、做好文档管理、并从开发服务器启动项目。

### 执行步骤

| 步骤 | 内容 | 状态 |
|------|------|------|
| 排查 | 全 src 引用收敛（导入点→调用点），确认死代码与过期文件；全 docs 扫描过时引用 | ✅ |
| 删代码 | 删 `src/modules/visual/` 4 文件、`src/hooks/useDebounce.ts`、`src/hooks/useLocalStorage.ts`、`.env`、`.env.example`（开发期直接删，不备份） | ✅ |
| 删依赖 | `npm uninstall echarts echarts-for-react`（visual 删除后零引用） | ✅ |
| 改代码 | `types/ai.ts` 删未使用的 `AIMetadata.providerId` 及 ProviderId import；`utils/jsonRepair.ts`、`services/baseAIProvider.ts` 过时注释更新；`components/settings/ModelSelector.tsx` 删重复 import | ✅ |
| 重写测试 | `scripts/smoke-test.ts` 从 v1 迁移版重写为 v2：去 tryMigrateLegacy、version 断言 2、新增 customProviders 测试组；存储类测试用动态导入绕过模块缓存 | ✅ |
| 文档同步 | design/architecture 更新为 v2 架构（GenericAIProvider/overlay/customProviders/无环境变量）；goal/todo/progress/versions/milestones 中 visual"保留待评估"改为"已删除"；project-document-manager/workflow-manager 死代码条款更新 | ✅ |
| 验证 | `npx tsc --noEmit` 零错误；`npx tsx --test scripts/smoke-test.ts` 45/45 全绿；dev server 启动（Vite，http://localhost:5173/） | ✅ |

### 修改文件清单

| 文件 | 操作 | 关键变更 |
|------|------|---------|
| `src/modules/visual/`（4 文件） | 删除 | 零引用死代码（AlgorithmVisual/FunctionChart/algorithms/index） |
| `src/hooks/useDebounce.ts`、`useLocalStorage.ts` | 删除 | 零引用死 hook |
| `.env`、`.env.example` | 删除 | 含硬编码真实密钥且源码零引用（环境变量方案已废弃） |
| `package.json` / lock | 修改 | 移除 echarts、echarts-for-react |
| `src/types/ai.ts` | 编辑 | 删 AIMetadata.providerId 死字段 |
| `src/utils/jsonRepair.ts`、`src/services/baseAIProvider.ts`、`src/components/settings/ModelSelector.tsx` | 编辑 | 过时注释/重复 import |
| `scripts/smoke-test.ts` | 重写 | v2 冒烟（7 组 45 例） |
| docs 11 个文件 | 编辑 | 过时引用同步（见 history.md） |

### 经验教训

1. **含密钥的配置文件删除前要确认源码零引用**：`.env` 中 GLM Key 早已随环境变量方案废弃但文件残留，属于安全隐患；删除即可（.gitignore 已忽略），但应提醒用户该密钥曾明文存在，必要时轮换。
2. **npm 依赖也会变死代码**：删 visual 模块后 echarts/echarts-for-react 成为零引用依赖，需要单独卸载（grep package.json + 源码双向确认）。
3. **测试脚本随架构升级必须同步重写**：旧 smoke-test 引用已删除的 tryMigrateLegacy，运行即报错；重写时发现模块级缓存（cachedRoot）会让"直接写 localStorage"的测试互相污染，用带 query 的动态导入获取新模块实例解决。

---

## 历史记录索引

更早的工作记录请见 [history.md](history.md)。
