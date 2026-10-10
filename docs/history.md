# 演变历史

## 2026-10-10（导图布局回退修复 + 朗读修复 + 续写上下文补齐 + 接入在线语音 → 发布 v1.7.4）

### 事件

用户一次报三条，分属三个互不相干的层：渲染（导图布局）、交互（朗读）、生成（续写提示词）。
三条都先复现、再定位、再修，不靠猜。

- 第一条 "**思维导图渲染算法逻辑在封装时（处理导出文件功能）被其他模型意外改动了，
  请仅恢复渲染逻辑（之前很完美）**" —— 定位到导出重构（`cf69235`）把布局算法从
  `KnowledgeContentView.tsx` 抽到 `utils/mindMapLayout.ts` 时**顺手改了 `measureNode`
  的非叶子分支**。
- 第二条 "**查词翻译模块原文没有发音，译文发音正常**" —— 复现后发现是**环境 + 静默失败**叠加：
  本机只有中文语音，英文原文拿不到 voice，旧实现留空就发出去，引擎不播；而 error 状态从没渲染。
- 第三条 "**内容续写逻辑应优化，续写时应给模型用户输入的主题及当前正在生成的部分
  （json写哪了，写得怎么样了）**" —— 续写轮只回填了内容尾部，模型不知道主题、也不知道还差哪些字段。
- 三条修完之后，用户回来实测说"**思维导图还是有问题，发音问题也没有解决**"。
  这一轮的关键不是再改代码，而是**先确认用户在测哪个构建** —— 他把 `release/知识灵动助手.html`
  （以及 Release 下载件）当成了验证对象，而那份是 **10-07 的产物**，构建源 `4815b1e` 里
  导图算法还是坏的、也没有朗读修复；`npm run dev`（5173）这边一直是好的。
  逐函数比对（旧组件内联布局段 vs 当前 `utils/mindMapLayout.ts`、`MindMap` 组件 147 行逐字、
  `sanitizeMindMap`、导图提示词）证明**当前代码与 15 天前逐字等价**；再用两版算法对同一批数据
  量化：修复版根中心偏 1.5px（居中），发布版偏 50px。于是结论收敛为"**发版即修好**"。
- 用户随之提出"**发音准确更好，能接在线 TTS 比较好**" —— 朗读这一条从"修静默失败"
  升级为"接入在线合成"（见下）。

### 真因

- **导图**：`topOffset` 的语义是"从子树带顶部到该节点中心的距离"，必须是 `subtreeH / 2`。
  改成 `size.h / 2` 后，子节点少而自身高的分支被顶到带上沿，与兄弟子树带错位。
  这是**重构时把"看起来多余"的 `Math.max` 删掉**造成的 —— 它其实在兜"节点比子节点总高更高"。
- **朗读**：`getVoiceForLang()` 返回 null 时，`speak()` 只是**不设** `utterance.voice`。
  Web Speech API 对此**不报错、也不保证出声**；本机（中文 Windows）Chromium 只有 3 个中文语音
  （走 OneCore，注册表里的 en-US Zira 它看不见），英文只能靠引擎兜底 —— 结果就是"点了没反应"。
  加上 `error` 状态没有任何出口，失败被彻底吞掉。
- **续写**：`buildJSONContinuationPrompt(partial)` 只拿到 `accumulated`，调用方手里有 `topic`
  却没传进去；`analyzeJSON` 也只吐 `completedKeys`，说不出"正在写哪个字段"。

### 修复要点

- `utils/mindMapLayout.ts`：`measureNode` 非叶子分支恢复成
  `subtreeH = Math.max(size.h, childrenTotalH)`、`topOffset = bottomOffset = subtreeH / 2`。
- `hooks/useSpeechSynthesis.ts`：新增模块级 `matchVoice()`；`speak()` 无匹配语音时退到
  「引擎默认 → 第一个可用」，`utterance.lang` 跟随所选 voice，并暴露 `SpeechFallback`；
  朗读前 `voices` 为空会再取一次；`stop()` 一并清降级状态。
- `modules/translate/SentenceResult.tsx` / `WordResult.tsx`：渲染降级提示与朗读错误；
  `WordResult` 新增 `sourceLang`（由 `index.tsx` 传入），朗读语言不再硬编码 `en-US`。
- `services/streaming/partialJSON.ts`：`scan()` / `analyzeJSON()` 增加 `pendingKey`。
- `services/baseAIProvider.ts`：新增 `describeJSONProgress()`；
  `buildJSONContinuationPrompt(partial, task?, requiredKeys?)` 带上【本次任务】与【当前 JSON 进度】；
  `generateJSONWithContinuation(..., taskLabel?)` 与四处调用点透传主题。
- i18n：`speech.voiceFallback`（中英）；`i18n/languages.ts` 新增 `speechLanguageLabel()`。
- **接入在线语音合成**（第二轮追加）：
  - 先用真 Chromium 从 `file://` 页面直连各家 `/audio/speech`，**带对照组**证明探针有效：
    OpenAI / Anthropic 被 CORS 拦（`TypeError: Failed to fetch`），智谱 / 硅基放行（`res.type === 'cors'`）；
  - `services/onlineTts.ts`（新）：厂商预置（智谱 `glm-tts` 7 音色 / 硅基 `CosyVoice2-0.5B` 8 音色 / OpenAI）、
    `deriveSpeechEndpoint()`（对话端点换后缀 `/chat/completions` → `/audio/speech`）、
    `splitForTts()`（按 `input` 上限分块，保证不丢字）、`synthesizeSpeech()`
    （二进制音频与 JSON base64/URL **两种回包都吃**）；
  - `hooks/useSpeechConfigStore.ts`（新）：朗读偏好独立存储，模型/音色按厂商分别记；
  - `hooks/useSpeechSynthesis.ts` 重构为**在线优先调度器**：在线走 `Audio`（可中断、逐块播放），
    失败自动退本机并把原因说清楚（`SpeechNotice`），`SpeechFallback` 合并成 `notice`；
  - `components/settings/SpeechSettings.tsx`（新）+ `Header.tsx` 第 4 个 tab「语音朗读」；
  - `SentenceResult` / `WordResult` 改为渲染 `notice.message`。

### 验证

`tsc --noEmit` 干净；`vitest run` **563 例全过（42 文件）**（较 v1.7.3 的 529/40，+34 例）。
导图：以 esbuild 载入 git 里的旧实现，与当前实现对 7 组夹具逐节点 / 逐连线比对**完全一致**，
出问题那版跑同一对比会红；两版算法对同一批数据量化差 50px。
朗读：真 Chromium 实测 —— 原文走兜底语音并出现降级提示；接入在线后（`page.route` 拦截
`/audio/speech` 返回真 WAV）点"朗读原文"命中 `open.bigmodel.cn/api/paas/v4/audio/speech`，
body `{"model":"glm-tts","input":"Good morning","voice":"tongtong","response_format":"wav"}`，
**本机语音 0 次调用**、`Audio.play` 播放 blob、设置面板语音 tab 渲染完整。
**已发版**：`v1.7.4`（PATCH），版本门禁六处一致。

## 2026-10-06 ~ 10-07（复制与导出重构 + 公式/PDF 修复 + 导图改截图 + Word/PDF 口径对齐与示意图导出 → 发布 v1.7.3）

> 版本号更正：本轮工作原被拆成 `v1.8.0`（复制/导出重构）与 `v1.9.0`（公式/PDF）两个号，
> 但**两批改动从未分别对外发布**。按「未发布的改动不占号、MINOR 留给路线图」的规则，
> 统一收进补丁版本 **v1.7.3**；`1.8.0` 号段保留给「移动端适配」。两批号已作废
> （tag 与 GitHub Release 均已撤回）。

### 事件

- 第一轮（复制与导出重构）：需求是"**复制和导出增强**"。往下查发现这条链路上叠着六个问题，
  最大的是**导出文件丢一半内容**（页面上渲染的知识脉络 / 试题 / 趣味知识三段整段消失，
  而"复制"出口一直有）。
- 第二轮（公式/PDF 修复）：用户拿产物做实测 —— "**公式没渲染，pdf 看不见**"
  （桌面 `复数.docx` / `复数.pdf`）。
- 第三轮（导图导出改截图）：用户提出方案 —— "**关于导出思维导图我的方案是从生成的画布截图，
  更简单**"，并明确 **PDF 导图页与 Word 附录页两个出口都改成截图**。
- 第四轮（Word 与 PDF 逐项对照）：用户拿两份产物对照，报三条 ——
  "**首标题格式不一致**"、"**被添加了不需要的冗余内容**"、
  "**所有文档会丢失示意图内容**"。前两条是"同一份内容两个出口不一致"的老毛病，
  第三条是导出链**整块能力缺失**（概念配图的三个字段在导出层零引用）。

### 真因

**一、丢内容不是漏写三个 `if`，是同一份 Markdown 被两份代码各写一遍**
（`SearchResults.handleCopy` 一份手写拼接器 + `generateKnowledgeNote` 一份）。
任一侧加字段另一侧没加，就出现"页面有、导出没有"。所以重点是**消灭双写**。

**二、"pdf 看不见"要区分两件事：结构合规 ≠ 看得见。**
上一版验的是"文字可提取 + 零字体嵌入 + 贝塞尔算子齐备"，
**没验"字到底画没画出来"** —— 漏的就是这一维：

| 路线 | 结果 |
|---|---|
| 浏览器打印 | 中文正常，但产物是**位图 PDF**（实测 6 页 / 文本长度 0 / 中文字符 0）→ 永不可复制 |
| 不嵌字体的矢量 CJK（`/STSong-Light` + `/UniGB-UCS2-H`） | 结构完全合规、pdf.js 提取到 975/1127/514/259 字 —— **但 Windows 上 Chrome / Edge / PDFium / pdf.js 都没有这套字形**，实测每页 inkRatio 0.0008~0.0023，屏幕上等于白纸 |
| **位图页 + `3 Tr` 隐形文字层** | 字形由位图负责、复制检索由文字层负责，inkRatio 0.031~0.039 |

**三、公式漏网三条通道**：```` ```latex ```` 围栏块被 `parseMarkdown` join 成一行后认不出；
**无围符裸 LaTeX**（提示词本来就要求 `notation` 字段"纯 LaTeX、不带围符"，这条是真因）；
嵌套参数 `\frac{z_1 \overline{z_2}}{…}`（原正则匹配不了嵌套花括号且单次 replace 不回溯）。

**四、顺手挖出 6 个隐藏缺陷**（详见 `docs/issues.md`）：跨页共用同一张位图、
导图页画在纵向画布上、行盒外溢致色块切字、**字号单位不一致（排版按 pt、绘制按 px
→ 显式 `size` 的片段全缩到 0.375×，标题/选项字母小到看不清）**、孤行标题、
位图流多一个换行把 JPEG 的最后一个字节吃掉。

**五、Word 与 PDF 是"两份各自成文的文档"，没有共同口径。**
前三条根因都在单条链路上，这一条是**跨出口**的：同一份知识内容，PDF 出口走
**结构化数据**（`buildKnowledgeBlocks(data)` 直接读字段），Word 出口走
**Markdown**（`generateKnowledgeNote(...).md` 再 `parseMarkdown`）。
凡"两种输入形态能力不等价"的地方就会显出差异，第四轮报的三条全是这个模式的产物：

| 用户看到的现象 | 为什么只有 Word 有 |
|---|---|
| 首标题变成小字 | Word 侧为了让顶部只有一个标题，把 `# xxx` **改写成普通段落**；PDF 侧本来就是 `title` 块，无需降级 |
| 多一块"思维导图结构"平铺项 | 那段大纲是**为 txt/md/html 出口造的**（PDF 已另有横向导图页，Word 也另有附录页）；而 `parseMarkdown` 的列表分支不解析嵌套缩进 → 父/子节点压成同一层 |
| 所有示意图消失 | 与输入形态无关 —— 是导出链**整块能力缺失**：概念配图的 `image` / `imageData` / `svg` 三字段在导出层**零引用** |

教训：**出口一多，"每个出口各写一遍"必然漂移**。同一份内容要么收敛到同一份源（同"真因一"），
要么把差异显式写下来对账 —— 不能用"看起来差不多"糊过去。

### 修复要点

- 复制与导出**同一来源**：删除手写拼接器，直接复用 `generateKnowledgeNote(data).md`；
  枚举文案抽到 `utils/knowledgeLabels.ts`；剪贴板/下载收进 `utils/clipboard.ts`
  （`copyText()` 三级降级且**永不抛异常** —— 发布形态是 `file://`，`navigator.clipboard` 可能是 `undefined`）。
- PDF 改自研生成器：`canvasRenderer.ts`（每页 canvas 位图，2× 超采样）+ `exportPdf.ts`
  + `pdfCore.ts`（手写 PDF 对象，零第三方依赖），**不嵌字体、不走打印**。
- 公式降级唯一实现 `utils/latexToText.ts`：`readableLatexExpression()` /
  `readableBareCommands()` / 围栏识别 / `ARG` 一层嵌套 + 迭代 3 轮展开。
  **保守原则**：不确定是公式的散文里不动花括号、不做裸 `_x` → 下标。
- 导图导出改**截图**：绘制收敛成 `canvasRenderer.paintMindMap()` 一份
  （PDF 横向导图页 + Word 附录页共用），新增 `renderMindMapImage()` 输出 PNG；
  Word 附录页由"缩进层级文字"改为内嵌位图（`w:drawing/wp:inline`），
  截图失败 / 空字节 → 退回缩进文字且**不写悬空 rels**。
  **屏幕上的导图是 SVG + 绝对定位 DOM，不是 canvas** —— 所以"截图"是**离屏 canvas
  按同一份布局重绘**，不是截页面像素；这样才不引入 html2canvas 这类重依赖。
- **Word 与 PDF 口径对齐**（第四轮，回应"两个出口不一致"）：
  - 首标题：`buildDocx` 不再把 Markdown 首行 `# 标题` 降级成普通段落 ——
    **同文 → 整块丢弃**（顶部 `titleXml` 已经渲染过同一个标题），**异文 → 保留为 Heading1**。
    `Title` 样式顺手对齐 PDF 的 `title` 块（左对齐 + `w:pBdr` 青色下划线；原为居中 22pt 青色）。
    **没有"标题变正文"这第三种身份。**
  - 冗余：新增 `stripMindMapSection(md, label)`，**有导图附录页时**剥掉正文里的
    「思维导图结构」文字大纲（该段在 docx 里必然失去层级 → 一串平铺项）。
    剥离放在 `buildDocx` 内部 —— 它是"有附录页"这条不变式的一部分，谁调用都绕不过去；
    精确匹配整行 `## {label}`，不碰同名短语与三级标题。
- **正文示意图导出**（新增 `utils/exportFigures.ts` 采集层）：三条可用图源统一转成
  "可 `drawImage` 的对象 + 位图字节 + data URL" —— `imageData` **直取原始字节不重编码**、
  `svg` 补尺寸后栅格化、远程直链尝试解码；**单张失败一律降级、永不抛**，
  拿不到的远程图退成一行图题（不静默消失，否则用户以为这题本来没图）。
  - **PDF**：`CanvasCtx` 增加 `drawImage`、`renderBlocks` 增加图片块（占满可用宽、居中、
    下方灰色小字图题），**高度上限取页高的 45%**（没有上限时竖长图永远放不下 →
    `ensure` 每次都换页直到把页数翻爆）。渲染链保持**同步**，异步边界（图片解码天生异步）
    留在 `export.ts` 一次性采集。
  - **Word**：序列化层只在**确实拿得到图**时写一行 `![alt](figure:key)` 标记
    （那份 md 同时是"复制"出口的正文，塞 base64 会把剪贴板撑到几百 KB），
    Word 解析到标记再换成真位图；媒体与导图**共用同一套 rId / media 分配器**
    —— 旧实现把 `rId3` 硬编码给导图，正文再插图必然撞号，而撞号时 Word 只会含糊地说"内容有问题"。
  - **HTML** 直接内联 data URL；**txt / md** 不出图、保留一行提示。
- 顺带修掉一个真缺陷：`svgWithIntrinsicSize` 原先在**整段 SVG 源码**里搜 `width` / `height`，
  `<rect width="300">` 这类子元素天生带这两个属性 → "已有尺寸"分支被误判命中 →
  **跳过 viewBox 注入** → `<img>` 退回浏览器给无尺寸 SVG 的默认值
  （实测 320×200 被读成 **240×150**，栅格化出来整张缩水）。改为只在**根标签**上找尺寸。

### 验证

`tsc --noEmit` 干净；`vitest run` **529 项全过（40 文件）**；
在 **`file://` 的单文件产物**里走用户真实路径导出 PDF/Word，再用 pdf.js 渲染核对
（文字可提取、无 LaTeX 源码残留、版式无重叠、末页横向导图）。
新增回归锁逐条反向验证过会红（例：把 `KEEP_WITH_NEXT_PX` 置 0 → 第 2 页末行变成 14pt 标题；
首标题不丢 → 文档里"复数"出现 2 次；不剥导图大纲 → 节点标题漏进正文；
图不接进渲染 → `drawImage` 调用数 0；SVG 尺寸改回全局搜索 → 返回 300 而非 320）。

第四轮另做了一轮端到端取证（探针在 `F:\WorkBuddyData\.workbuddy\tmp\exportprobe\`）：
真 Chromium 打开单文件产物 → mock AI → 搜索 → 点导出菜单抓 Blob 字节 → `verify.cjs` 拆包。
- **Word**：`word/media/figure1..4.png`（概念直出图 240×160 / SVG 栅格化 **320×200** /
  试题图 240×160 / 导图页 2245×658）；4 个 `r:embed` 与 media **一一对应、无重复、无悬空关系**；
  `wp:extent` = 728.5×213.7 pt（导图页，未溢出）；正文无导图节点标题、无 LaTeX 源码；
  拿不到的远程图正确退成一行图题；`figure:` 标记全部消化。
- **PDF**：4 页（3 纵向 + 1 横向导图），每页 1 张整页位图；页面位图里能统计到示意图的
  蓝色系像素（证明图真被 `drawImage` 进去了）；隐形文字层 `3 Tr` **70 处**、`Tf` 76、文字可提取。
- ⚠️ 记一笔假绿：上一版 `verify.cjs` 用 pdf.js 的 `OPS.setRenderingMode` 数隐形文字，
  结果是 **0**，而同一份 PDF 里 `3 Tr` 明明有 70 处 —— 现改为直接 grep 原始字节。

产物 2.61 MB，发布 **v1.7.3**（四轮改动合并为一次发布；`1.8.0` 号段保留给"移动端适配"）。
技术细节见 `docs/versions.md` 的 v1.7.3 一条（含「附：复制与导出文件能力重构」）。

### 发布（v1.7.3，2026-10-07）

- `npm run release` → `release/知识灵动助手.html`（2.61 MB）+ `使用说明.txt`；前置链 `scripts/check-version.js`（六处版本号一致）与 `tsc --noEmit` 均通过；**产物不入库**
- commit `245d8df` / `4815b1e` → `main`（`cf69235..4815b1e`）；建**附注 tag** `v1.7.3` 并推送 → Release
  `https://github.com/ceepuka/zhishilingdong/releases/tag/v1.7.3`
- 附件 `zhishilingdong-v1.7.3.html`（2,739,989 字节）/ `usage-v1.7.3.txt`，中文名放 `label`
- **匿名（不带 token）下载附件复验**：HTML 实际 2,739,989 字节、sha256 `3ecf23b8…` 与**本地产物逐字节一致**；
  远端 Release 列表只剩 `v1.7.3` / `v1.7.2` / `v1.7.1`，误发的 `v1.9.0` 无残留
- **产物结构自检用标签口径，不用全局字符串计数**（这是本轮踩到的口径问题）：真正 `<script>` 块 **2 个**
  （主题引导 + 主 bundle）与闭标签 2 个平衡；`<script src=` **0**、外部样式表 **0**；
  内联 JS 里的 `</script` 已转义成 `<\/script`。若按裸字符串数 `<script` 会数到 4 ——
  多出的 2 次命中是打包进 bundle 的 React DOM `"<script><\/script>"` 片段与提示词模板里的 `<script>` 字样，**不是漏转义**
- **`file://` 真浏览器实测产物**：应用挂载、localStorage 可写可回读、Mock 搜索端到端渲染，
  **0 console error / 0 pageerror / 0 失败请求**；provider CORS 预检矩阵全通（OpenAI 那条超时是本机网络，非产物问题）
- **在发布产物上复跑导出端到端**：Word 137,622 字节 / PDF 516,260 字节；`verify.cjs` 拆包 —— Word 侧
  `figure1..4.png`、4 个 `r:embed` 与 media 一一对应且无重复无悬空、`Content_Types` 声明齐全、
  正文无导图节点标题也无 LaTeX 源码残留、拿不到的远程图退成图题；PDF 侧 4 页（3 纵 + 1 横）、
  `3 Tr` 70 处、文字可提取。3 条 `ERR_NAME_NOT_RESOLVED` 是离线环境取不到远程配图后的**预期降级**，不是缺陷
- 仓库卫生（同日）：`推荐文章-知识灵动助手.md` 移出仓库到 `E:\Program\Workspace\` 作为**外部文件**保留（不入库）；
  删除未跟踪的 `.tmp-mine`（`canvasRenderer` 导图段旧草稿）与 `docs/recommend-{mindmap,concept-card}.png`

## 2026-09-30（演示数据补齐 + 可点击目标全量守卫 + 发布 v1.7.2）

### 事件
- **反馈（上一条需求上线后实测）**：「很好了，请补充 Mock 数据，并发布新版本」。
- 上一版把查词/翻译的三个区块做成了可点击入口，但 **Mock 演示数据没跟上** —— 打开就是"功能看着有、点下去什么都没有"。

### 真因
先量化再动手，缺口比预想的大：

| 区块 | 修复前 | 说明 |
|------|--------|------|
| 常用搭配 | `collocations` 数量 = **0 / 58** | 该区块在 Mock 下**永不出现**（渲染条件是数组非空） |
| 关联术语 | **15 / 58** 词条有 | 大部分词条点不出东西 |
| 短语词条 | **0 条** | 而"关键词带释义 + 可点击"的主场恰恰是短语查询 → 演示时只会看到 `defaultWordData` 的"暂无该单词的释义" |
| 翻译语料 | `relatedTerms: ['相关词汇']` / `grammarNotes: ['语法说明']` | **占位垃圾**：点"相关词汇"会去知识搜索里搜出无关内容 |
| 目标词可达性 | 关联术语 104/243、常用搭配 240/247 落到空词条 | 补了数据也没用，点了还是空的 |

另外 `mockSentenceResult` 是**无任何引用**的死代码（`mockAIService` 用的是自己的 inline 表）。

### 修复

**一、补数据：按"演示时看得见的东西"排优先级**

| 层 | 处理 |
|----|------|
| 短语词条 | 新增 9 条（`good morning` / `respond well to` / `data structure` / `machine learning` / `artificial intelligence` / `deep learning` / `natural language processing` / `big O notation` / `take into account` / `in terms of`），带 `keywords` / `relatedTerms` / `collocations`。其中 `respond well to` **复刻用户报错里那个词条的真实内容**（3 条释义 + 5 个关键词 + 4 条搭配） |
| 词条补全 | 新增 `mockExtra` 合并表 + 合并循环，为全部 **68 条**词条补齐 `collocations` / `relatedTerms`。**已有值优先**：原词条里手写的 `relatedTerms` 更贴学科，不能被表里的通用词顶掉 |
| 关键词兜底 | `mockMiniGlossary` 扩到 130+ 条；新增 `deriveMockKeywords(text, max)` 按词表拆词 + 附一句话释义，**查不到释义的词直接不返回**（避免塞碎词） |
| 翻译语料 | 新增 `mockSentenceExtras`（10 条，英→中 6 条 / 中→英 4 条），译文/关键词/关联术语/语法说明全是真内容；**没策展数据就不给**，不再编造占位垃圾 |
| 死代码 | 删除 `mockSentenceResult` 与随之未使用的 `SentenceResult` import |

**二、目标词可达性：新增降级拆解释义（本次最关键的一条）**

补完数据后发现更根本的问题：**可点击目标天然远多于词表**（354 个唯一目标词 vs 68 条词条）。
于是新增 `deriveMockFallbackDefinitions(word)`：

- 未收录时不再一律甩"暂无该单词的释义"，而是把查得到的词素逐个解释，拼成
  `逐词拆解：quantum 量子 + mechanics 力学。（Demo 数据未收录该词条的完整释义，配置模型密钥后会有准确解释）`
- **明确标注是演示降级，不编造词义**；一个词素都查不到时仍如实返回"暂无该单词的释义"
- 结果：354 个可点击目标，落空 **0** 个

**三、全量守卫**

新增 `src/modules/translate/__tests__/mockLinks.test.ts`：遍历所有词条的 `relatedTerms` / `collocations` / `keywords`，
用 `vi.useFakeTimers()` + `advanceTimersByTimeAsync(400)` 跳过 mock 内部的 `delay(300)`，
逐个走真实 `queryWord()` 断言没有一个只剩"暂无该单词的释义"。**以后往词条里加词而词表没跟上，这条立刻红**
（写这条时它立刻抓到 `agent` 一个漏网词）。

### 文件变更
- 更新 `src/modules/translate/mockData.ts`：删死代码 `mockSentenceResult`；新增 9 条短语词条；文件末尾新增 `mockExtra` 表与合并循环
- 更新 `src/services/mockAIService.ts`：`mockMiniGlossary` 扩到 130+ 条；新增 `deriveMockKeywords()`、`deriveMockFallbackDefinitions()`、`mockSentenceExtras`；`queryWord` 关键词改为"词条自带优先、否则按词表拆"并透出 `imageQuery`；`queryTranslate` 改为语料表驱动、`tokens` 按原文词序配 key
- 新建 `src/modules/translate/__tests__/mockLinks.test.ts`（3 例）
- 版本与文档：`package.json` → `1.7.2`；`docs/versions.md` 新增 v1.7.2；README 版本表；`docs/progress.md`（m042）；`docs/todo.md`

### 构建验证
- `tsc --noEmit` 零错误；vitest **383 例 / 34 文件全绿**
- 真实浏览器探测（`http://localhost:5173`，清 localStorage 使路由落到 Mock；探针 `~/.workbuddy/tmp/probe-mock-v172.cjs`，21 项断言；**0 console error / 0 pageerror**）：
  - 查词 `algorithm`：常用搭配 4 条、关联术语 5 条全部出现；点关联术语 → 换成那个词的结果且**有真实释义**（不是空词条）
  - 查词 `good morning`：短语徽标 + 2 条带释义关键词 + 3 条常用搭配；点关键词 → 跳查词并查到那个词
  - 翻译 `good morning`：译文片段 DOM 顺序 `[2 早上, 1 好]`（**语序相反**，证明按 key 而非按位置配对）；关联术语 3 条不含占位垃圾，点击切到 `#search` 且产生搜索记录
- 目标词审计（`~/.workbuddy/tmp/audit-mock-links.cjs`）：354 个唯一目标词，**落空 0**

### 发布（v1.7.2）
- `npm run release` → `release/知识灵动助手.html`（3.21 MB）+ `使用说明.txt`；产物不入库
- commit `5aecfdc` → `main`；tag `v1.7.2` → Release `https://github.com/ceepuka/zhishilingdong/releases/tag/v1.7.2`
- 附件 `zhishilingdong-v1.7.2.html`（3,365,679 字节）/ `usage-v1.7.2.txt`，中文名放 `label`
- **匿名（不带 token）走 `api.github.com` 的 asset 端点复验**：两个附件均 200，HTML 实际字节 3,365,679、首字节 `<!DOCTYPE html>`，附件名未被静默改名
- ⚠️ 发布过程中 `git push` 挂住过两次。**原因未定论，别当成"credential helper 坏了"**（此处是修正后的表述，见下）：
  - 第一次：前台尝试 120s 被超时 SIGTERM，后台重试挂 17 分钟、日志 0 字节。
    **最可能的原因是凭据授权未确认 / 超时**（用户复核后指出；事后用默认凭据通道跑 `git ls-remote` 秒回，说明凭据与网络都正常）。
  - 第二次：代理对 `github.com:443` 连续返回 502 —— 这一条是直接观测（裸 `CONNECT` 测同样 502，而 `api.github.com:443` / `github.com:22` 返回 200），
    但**只代表当时的代理状态**，不代表稳定规律。
  - 当时分别用 token + `http.extraheader`、Git Data API 两条绕路把版本推了上去（`5aecfdc` / `189ceaa`）。
    **这些绕路是"当时能通"，不是"以后必须这么走"** —— 下一次遇到先做最省事的判断：`git ls-remote` 能否秒回；能回就说明凭据与网络都正常，直接重试 `git push` 即可。
  - 事后收尾：`git fetch origin && git reset --hard origin/main` 已把本地与远端对齐（两者 tree 相同，只是 commit sha 不同）

### 关联文档
- 更新 `docs/versions.md` / `docs/progress.md` / `docs/todo.md` / `docs/worklog.md` / README

### 经验教训
- **"补数据"要先量"点了有没有反应"**：`collocations` 数量为 0 这件事，从源码里看不见（渲染条件在组件里）；
  量化的口径必须是"用户实际会点到的目标"（354 个），而不是"字段有没有被填"（68 条）。
- **可点击目标 ≫ 词表规模是常态，别指望靠枚举补完**：68 条词条天然产出 354 个可点词。正确解法是**让兜底也可看**
  （按词素拆解 + 明确标注降级），而不是手写第 355 条词条。补数据只解决"体面"，兜底才解决"不落空"。
- **全量守卫测试比人肉抽查可靠**：`mockLinks.test.ts` 一上线就抓到关键词里的 `agent` 没进词表 ——
  这类漏网词人工审十遍也未必撞上。假时钟是让"354 次带 300ms 延迟的查询"能进单元测试的关键。
- **演示数据里的占位垃圾比没有更糟**：`relatedTerms: ['相关词汇']` 让用户点一个看起来正常的按钮，
  跳过去却搜出无关内容 —— 要么给真内容，要么这个区块不显示。

---

## 2026-09-30（跳转查词报 "Failed to parse JSON response"：查词/翻译接入统一续写链路 + 错误文案分档）

### 事件
- **反馈（上一条需求上线后实测）**：点关键词跳转查词时报错 ——
  `Failed to parse JSON response (length=1339, preview: {"word":"respond well to","isPhrase":true,"phonetic":"","definitions":[{"pos":"phrase","meaning":"对……反应良好…`
- 期望是"**别再报这个错**"，而不是"换个说法显示"。

### 真因
- 查词 / 翻译是全项目**唯一还走非流式 `callModelWithJSON`** 的生成入口。那条路没有续写、没有中断归因、没有部分内容：
  模型少写一个字符（示例里停在 `"en":"Th`），`parseJSONResponse` 的四层修复也补不回来，返回 `null`，
  于是**解析层的整条技术描述被当成用户文案直接甩到界面上**。
- 所以这不是"模型不稳定"这一个问题，而是两件事叠在一起：**内容没救回来** + **错误归因上屏**。

### 修复

**一、把查词/翻译接进统一续写链路**

| 项 | 处理 |
|----|------|
| 新增入口 | `BaseAIProvider.generateJSONWithContinuation<T>(prompt, systemPrompt, depth, requiredKeys, signal?)` —— 复用**同一个** `callModelStreamWithContinuation`（同一重试预算 `MAX_GENERATION_ATTEMPTS`、同一 `canContinueAfter` 判据、同一套中断归因），只是不需要增量回调。**没有另写一套非流式续写**（两套实现必然漂移） |
| 完成判定 | 新增 `buildJSONKeysCompleteChecker(requiredKeys)`：与 `buildGenerateCompleteChecker` 同口径（复用解析层 `analyzeJSON`，不另写括号配对），必填字段由调用方给 —— 查词 `['word','definitions']`、翻译 `['original','translation']` |
| 接入 | `queryWord` / `queryTranslate` 由 `callModelWithJSON` 切到新入口；确实一个字都没解析出来时抛 `GenerationInterruptedError(interruption ?? createInterruption('parse', GENERATE_FAILED))`，由 `withFallback` 透传 code |
| 部分内容 | 全程零可渲染快照才当失败；有半截 JSON 就渲染出来（`lastRenderable` 兜底），不再"整段丢弃" |

**二、状态透出 + 文案分档（技术细节不上屏）**

| 项 | 处理 |
|----|------|
| 类型 | `DictionaryQueryResponse` / `TranslateQueryResponse`（`types/ai.ts`）与 `WordResult` / `SentenceResult`（`types/index.ts`）各新增 `truncated` / `continued` / `interruption` |
| 提示位置 | `WordResult` / `SentenceResult` 在**结果卡末尾**挂 `GenerationNotice`（按 side/kind 分档配色）。放内容之前等于"先报错再看内容" |
| 文案 | 新建 `src/modules/translate/errorText.ts::friendlyTranslateError(code, rawMessage)`；`translate.errors` 新增 timeout / network / protocol / incomplete / contentFiltered / generateFailed / invalidApiKey / serviceUnavailable 八条中英文案 |
| 为什么不复用搜索的 `toFriendlyError` | 那套假设"已收到内容已展示"（搜索是流式边出边渲染），查词/翻译没有部分渲染，措辞必须不同，硬套会给出与屏幕不符的提示 |
| 删掉 mock 兜底 | `translate/index.tsx` 的 catch 以前会**静默塞一份 mock 结果**（用户会当真实结果读），改为按 code 报错 |

### 文件变更
- 更新 `src/services/baseAIProvider.ts`：新增 `buildJSONKeysCompleteChecker()`、`generateJSONWithContinuation()`；`queryWord` / `queryTranslate` 切换链路并透出 `truncated` / `continued` / `interruption`（兜底路径三个字段置空）
- 新建 `src/modules/translate/errorText.ts`：`friendlyTranslateError()`
- 更新 `src/types/ai.ts` / `src/types/index.ts`：4 处接口新增三个可选字段
- 更新 `src/modules/translate/WordResult.tsx` / `SentenceResult.tsx`：结果卡末尾挂 `GenerationNotice`
- 更新 `src/modules/translate/index.tsx`：`!response.success || !response.data` → 按 code 出文案；删除 mock 兜底与 raw message 上屏
- 更新 `src/i18n/strings/translate.ts`：`translate.errors` 八条文案（中英）
- 更新 `src/services/__tests__/continuation.test.ts`：新增 12 例（`buildJSONKeysCompleteChecker` 7 例 + `generateJSONWithContinuation` 5 例，含"本次 bug 的原始形态"回归）

### 构建验证
- TypeScript 类型检查：通过（`tsc --noEmit` 零错误）
- 测试：**380 例 / 33 文件全绿**（新增 12 例）
- 真实浏览器（`http://localhost:5173`，**拦截 AI 端点**模拟"模型只写了一半"，探针 `~/.workbuddy/tmp/probe-translate-truncation.cjs`，8 项断言全过）：
  - **场景 A（本次 bug 的形态）**：第 1 轮 SSE 只吐半截 JSON（无 `finish_reason`）→ 自动发起第 2 次请求补齐 → **只存在于第 2 轮返回体**里的第 2 条释义与例句译文出现在屏幕上；提示为 teal「已自动续写并补全」，无报错卡，页面不含任何技术细节
  - **场景 B（两轮都补不回来）**：连续 3 轮都吐不出 JSON → 3 次请求后才放弃，界面显示「模型输出被提前中断，结果可能不完整，请重试」；全文不含 `Failed to parse JSON` / `preview:`；同一份技术描述只出现在 `console.error`
  - 前置：探针把 zhipu 配成"可用" provider 后由路由拦截，请求确实走 `stream: true`

### 关联文档
- 更新 `docs/design.md`：4.1 生成链路（查词/翻译不再走非流式入口）
- 更新 `docs/worklog.md`：2026-09-30 条目补"跳转查词报错"一节

### 经验教训
- **"解析失败"这四个字不该出现在用户界面**：`length=…` / `preview=…` 对用户零价值。正确顺序是**先把能救的救回来**（续写），救不回来再按**可行动的**原因给文案，细节只进 `interruption.detail` 与控制台。
- **一个模块漏接统一链路，症状会长得很像"模型不可靠"**：查词/翻译是唯一漏网的生成入口，于是"模型有时写不完"这件事**只**在查词上表现为硬报错。新增生成入口时先问一句"它接的是哪条链路"。
- **探针陷阱**：续写轮的 prompt 是 `buildJSONContinuationPrompt(已生成内容)`，**不含原始 prompt** ——
  按原始关键词分流请求，会把续写轮误判成旁路调用（本次踩到，一度让场景 B 变成"没有报错"）。
  分流条件要同时认原始 prompt 特征与续写提示词特征。

---

## 2026-09-30（翻译对照改 key 配对 + 词典/翻译的关键词带释义与跳转重构）

### 事件
- **反馈（第一轮）**：翻译模式的"高亮对照"语序不对 —— 原文与译文顺序相反时高亮错位。
- **反馈（第二轮，纠正方案）**：用户给出正确模型 ——
  「只需要"Good - 好，morning - 早上"这样**双射的键值对**，依据输入文本顺序给"Good & 好"标"键1"、"morning & 早上"标"键2"，
  按相同标记高亮，不便于高亮处理的就"无键"。**AI 处理文本时填好键就行了，不需要复杂的对齐处理**。」
- **反馈（第三轮）**：「完善词典翻译模块：查词模式关联术语和常用搭配等点击应跳转查词；翻译模式风格选择调整至翻译前；
  关联术语跳转知识搜索；关键词参考此样式（带释义）；查词和翻译的关键词都要释义、都跳转查词。」
- **约束**：用户明确「先不发新版本，不用兼容旧数据处理（仅知识模块需兼容）」。

### 决策与改动

**一、对照模型：从"按位置单调扫描"改为"AI 填 key、前端按 key 配对"**

| 项 | 处理 |
|----|------|
| 为什么推翻第一版 | 第一版按字符位置单调游标扫描，**语序相反时直接丢对照**：`Good morning → 早上好` 里 key2（morning/早上）配不上。语序相反是翻译的常态，不是边界情况 |
| 配对唯一依据 | `key`（AI 按**原文出现顺序**编号，两侧同键）。**不用数组下标，也不用字符位置** |
| 渲染铁律 | 屏幕文字**只从 `original` / `translation` 两个权威字符串切区间**，绝不拼接 `segments`。不变量 `runs.map(r => r.text).join('') === text`；降级只能是「不高亮」，不能是「不显示」 |
| 无键语义 | 不便于对照的虚词/标点 AI 不放进数组 = 无键 = 不高亮（正常状态，不是错误） |
| 定位 | `collectRanges()` 逐条独立 `indexOf`（无游标），**结果按字符位置排序**（按 key 序排会得到逆序区间）；重叠丢弃 |
| 划选定位 | 读锚点的 `data-key`。用 `findIndex(text.includes(sel))` 时**同一段文字出现多次永远命中第一处** |

**二、关键词：裸字符串 → `{term, definition}`，三个入口全部可点击**

| 项 | 处理 |
|----|------|
| 数据模型 | 新增 `KeywordEntry { term, definition? }`；`WordResult.keywords` / `SentenceResult.keywords` 改为该类型 |
| 归一化 | `toKeywordEntries()`（`components/ui/TermList.tsx`）同时吃 `{term,definition}` 与裸字符串 —— AI 可能偷懒返回字符串，收藏夹读到的旧数据也是字符串。**缺释义只是少一行字，条目本身绝不消失** |
| Prompt | `queryWord` 要求关键词带 `definition`（"应该给释义，而不是留空或照抄 term"）；`queryTranslate` 关键词改为 `{term, definition}` 并更新示例 |
| 渲染 | 新组件 `TermList`（共享，"词 + 一句话释义"列表）；查词/翻译结果的 keywords 全部改用；收藏夹（只读）同样接入 |
| 点击出口 | 查词模式：关键词 / 关联术语 / 常用搭配 → 查词（`onLookup`）；翻译模式：关键词 → 查词，关联术语 → **知识搜索**（`onSearchTopic`） |
| `Tag` 语义修正 | 传了 `onClick` 才渲染成 `<button>`；不可点的标签不再有"能点"的悬停样式 |

**三、翻译风格前移到输入区**

- `TranslateInput` 顶部新增风格选择器（**仅翻译模式显示**，排在输入框之前）；`SentenceResult` 移除可切换的风格按钮，只展示"这次用的是哪种风格"。
- 语义随之改变：改风格不再触发自动重翻（风格是"这次要翻成什么样"的输入项，不是结果的一部分）。

**四、跨模块跳转（翻译的关联术语 → 知识搜索）**

- `App.tsx` 持有 `pendingSearchTerm` + `handleSearchTopic`；词经 props 交给 `SearchModule`，由它**挂载后消费一次**，消费完回调清空（`consumedInitialQueryRef` 守门）。
- 为什么不用 ref 直调：切标签页那一刻 `SearchModule` 才挂载，`searchRef.current` 还是 `null`。

### 文件变更
- 重写 `src/modules/translate/alignment.ts`：`key` 归一化、`collectRanges`（位置排序）、`sharedKeys`、`buildRuns`
- 新建 `src/components/ui/TermList.tsx`：`TermList` + `toKeywordEntries()`
- 新建 `src/modules/translate/__tests__/keywordTerms.test.tsx`（12 例）、`src/modules/search/__tests__/searchInitialQuery.test.tsx`（2 例）
- 更新 `src/types/ai.ts` / `src/types/index.ts`：`KeywordEntry`、两处 `keywords` 类型、`TranslationSegment.key`
- 更新 `src/services/baseAIProvider.ts`：`asKey()`、`toKeywordList()`、两处 prompt 与 sanitize、兜底路径 `segments: undefined`
- 更新 `src/modules/translate/SentenceResult.tsx`：key 配对渲染、风格按钮移除、关键词/关联术语点击出口
- 更新 `src/modules/translate/WordResult.tsx`：关键词改 `TermList`，关联术语/常用搭配可点击
- 更新 `src/modules/translate/TranslateInput.tsx`：风格选择器前移
- 更新 `src/modules/translate/index.tsx`：`handleTranslate(text, modeOverride?)`、`handleKeywordLookup`、`handleTermSearch`
- 更新 `src/App.tsx` / `src/modules/search/index.tsx`：跨模块跳转通道
- 更新 `src/components/ui/Tag.tsx`、`src/modules/favorites/index.tsx`：关键词渲染口径统一
- 更新 `src/i18n/strings/translate.ts`：新增 `styleLabel` / `relatedTermsLookup` / `relatedTermsSearch` / `collocationsLookup` / `keywordsLookupAction`
- 更新 `src/services/mockAIService.ts` / `src/modules/translate/mockData.ts`：关键词带释义（新增 `mockMiniGlossary`）

### 构建验证
- TypeScript 类型检查：通过（`tsc --noEmit` 零错误）
- 测试：**368 例 / 33 文件全绿**（全量跑 32 文件 347 例通过 + 沙箱 EPERM 漏收集的 `useSearchStateMachine.test.tsx` 单跑 21 例通过）
- 真实浏览器（`http://localhost:5173`，Mock 模式，探针 `~/.workbuddy/tmp/probe-translate-keyword-ux.cjs`）：12 项断言全过、0 console error / 0 pageerror
  - 语序相反 `Good morning → 早上好`：译文侧 `data-key` 顺序为 `['2','早上'],['1','好']`，两对都能高亮
  - 查词模式点"data structure"→ 结果换成该词条
  - 翻译模式：风格选择器在输入框之前就可见；关键词渲染为 `good 好的；令人愉快的`；点关键词 → 切到查词模式并查到 `good`（**不是再翻一次**）
  - 关联术语 → `location.hash === '#search'`，且确实发起了搜索（产生搜索历史记录）

### 关联文档
- 更新 `docs/design.md`：3.3 模块三技术要点、3.3.1 跨模块跳转、4.2 数据模型（`KeywordEntry`、`segments.key`）
- 更新 `docs/prd.md`：3.2.2 结果展示、新增 3.2.3 结果跳转、3.2.4 附加功能、验收标准

### 经验教训
- **"按下标/位置配对"在语序相反的语言之间必然错**：`Good morning → 早上好` 是常态而非边界。
  跨语言的对齐关系只能由**语义标注**（AI 填 key）表达，任何基于位置的启发式都是在猜。
- **`setState` 之后立刻调一个读同一 state 的函数，读到的是旧值**：点"关键词跳查词"时先 `setMode('dictionary')`
  再 `handleTranslate()`，后者闭包里还是 `'translate'` → 会变成"再翻一次这句"。**模式必须显式传参**，不能靠 state 收敛。
- **切标签页那一刻目标模块才挂载，ref 一定是 null**：跨模块带参跳转只能"把参数交给目标模块，由它挂载后自己消费"，
  并且要保证**只消费一次**，否则切走再切回会重复触发。

---

## 2026-09-29（仓库转公开：敏感文件清理 + 新建单提交历史的公开仓库）

### 事件
- **反馈**：用户要求"转成 public（推荐）"，目的是让别人能方便下载体验；随后选定"统一到 main"、「新建干净的公开仓库」。
- **决定**：不直接切公开开关，也不做历史重写，而是把**已清理干净的工作树**作为一次全新初始提交推到新公开仓库。

### 依据（为什么先做密钥体检）
- 转 public 会把**全部 git 历史**摊开。全历史扫描（1318 个对象 / 76.5MB）命中两处真实泄露：
  - 智谱 GLM API Key（来自提交 `dd3c4d0` 的 `.env`）；
  - Trae/字节 session ID（`docs/external/Session ID.txt`，**当时仍在 HEAD 中被追踪**）。
- `filter-repo` 重写 48 个提交代价高且易漏（reflog / 悬空对象 / 远端缓存）；一次性 orphan 提交更彻底。

### 决策与改动

| 项 | 处理 |
|----|------|
| 敏感文件 | `docs/external/Session ID.txt` 从索引与磁盘移除，`docs/external/README.md` 记录处置 |
| 历史 | `git checkout --orphan main` → 单提交（209 文件） |
| 公开范围 | `.trae/`（开发计划）与 `.workbuddy/memory/`（工作日志）不进入公开仓库，加入 `.gitignore` |
| 旧仓库 | 远端 `origin` 改名 `archive`，保持 private 作为完整历史存档 |
| 新仓库 | `origin` → [ceepuka/zhishilingdong](https://github.com/ceepuka/zhishilingdong)（public，默认分支 `main`） |
| 链接修正 | `publish-release.mjs` / `build-standalone.js` / `README.md` 的仓库 URL 在初始提交前改完（`--amend`），避免公开第一个提交就带旧链接 |
| Release | 重建产物 → 重指 tag `v1.7.1` 到 `main` HEAD → 重建 Release（`zhishilingdong-v1.7.1.html` 3.18MB + `usage-v1.7.1.txt`） |

### 验证
- 远端：`visibility=public`、`default_branch=main`、`commits=1`、blob 209 个、排除目录存在数 0；
- **匿名**（不带 token）下载附件：HTTP 200 / 3.18MB / 完整 HTML / 内联 KaTeX 字体 / 无外部资源引用。

### 遗留
- 旧私有仓库历史中的智谱 GLM API Key 仍存在 → **该 Key 应轮换**（仓库保持 private 只是降低暴露面，不等于失效）。

---

## 2026-09-29（发布形态统一为单文件 HTML）

### 事件
- **反馈**：用户指出 Netlify 并不是免费部署平台，要求"打包本地化 web 应用或静态网页"，并明确判据是**接收方能零门槛体验**。
- **决定**：「以后就以 HTML 文件形式正式发布，全部以这个形式维护」—— 正式发布形态收敛为单文件 HTML 一种。

### 决策与改动

| 项 | 处理 |
|----|------|
| 云部署 | 删除 `netlify.toml`、`vercel.json`。本项目零后端、API Key 由用户自持，不需要托管平台 |
| 本地静态服务 | 删除 `server.js`、`start.bat`、`scripts/postbuild.js` 及 `npm run build` / `npm run preview`，多文件 `dist/` 形态退役 |
| 发布包 | 新增 `release/`：`知识灵动助手.html` + `使用说明.txt`。**不入库**（gitignore），作为 GitHub Release 附件分发 |
| 构建链 | 新增 `vite.standalone.config.ts`（构建到 `.tmp-standalone/`，中间产物 gitignore）+ `scripts/build-standalone.js`（内联并写入 `release/`） |
| 命令 | `npm run release` 成为唯一发布命令（`tsc --noEmit` → 构建 → 内联） |
| 配置 | `vite.config.ts` 收敛为纯开发配置；`package.json` version 由 `0.1.0` 更正为 `1.7.0` |

### 依据（为什么单文件可行）
- 应用是纯前端 SPA，AI 调用在浏览器直连厂商，**没有必须在服务端做的事**；
- 有 Mock 模式，默认无需 API Key，因此"离线可用"是可达成的。

### 验证（真实浏览器，`file://`）
- localStorage 可写可回读、内联 module 脚本正常执行、应用正常挂载；
- Mock 搜索端到端跑通（输入"勾股定理"→ 内容上屏），失败请求 0 / console error 0 / pageerror 0；
- CORS 对照矩阵（`file://` vs `http://localhost`）：智谱 / 通义 / DeepSeek / Moonshot / 硅基流动两边均 HTTP 401（预检放行，仅密钥无效），OpenAI 两边均超时（网络问题，非 CORS）。

### 后续（同日决定）
- 用户追加要求"只留源码、把 HTML 挂到 Release 附件上" → `release/` 改为**不入库**（gitignore），成品作为 GitHub Release 附件分发。
- 理由：3.18MB 的 HTML 若进版本控制，每次重新发布都会在 git 历史里留一个同体积 blob；源码与成品分离后，仓库只承载源码。
- 首次以 `v1.7.1` 打 tag 并发布 Release（`package.json` 同步升到 `1.7.1`）。

### 影响
- 分发成本降到"发一个文件"；代价是 `file://` 来源为 `null`，个别厂商若拒绝该来源则无法调用（已记录在使用说明的"已知限制"里）。
- 发布流程变成两步：`npm run release` 产出 → 建/更新 Release 挂附件。

### 经验教训
- **⚠️ GitHub Release 附件名只接受 ASCII**：传中文名（`知识灵动助手.html`）服务端**返回 HTTP 200 且不报错**，但名字被静默替换成 `default.html` ——
  只有去附件列表里看才会发现。`scripts/publish-release.mjs` 因此改为"ASCII 下载名 + 中文 `label`"的映射，并带上"名字被改掉就告警"的自检。
  **凡是"接口不报错但结果不对"的场景，都不要以状态码作为成功判据，要去核对最终状态。**
- **沙箱里 node 不能 spawn `git`**（`spawnSync ... EBUSY`，用绝对路径也一样）：需要在 node 脚本里用 git 凭据时，
  改由 bash 先取好写进临时文件，再让 node 读环境变量（`GH_CRED_FILE` / `GH_TOKEN`）。
  另：**`VAR=$(...) && cmd` 不会把变量导出给子进程**（会报"缺少 GH_TOKEN"）→ 写 `export VAR=$(...)` 或 `VAR=... cmd`。
- **判断 CORS 必须带对照组**：只看 `file://` 的失败无法区分"`null` origin 被厂商拒绝"和"这台机器网络不通"。
  加一组 `http://localhost` 同时跑，两边表现一致才能得出"是网络问题、不是 CORS"的结论。
- **验证 Release 附件真的能下载，要走 `api.github.com` 的 asset 端点**（会 302 到 `release-assets.githubusercontent.com`）：
  本机 curl 走 HTTPS 代理访问 `github.com` 报 `schannel: failed to receive handshake`，node `fetch` 直连 `github.com:443` 被墙，但 `api.github.com` 两条路都通。

---

## 2026-09-20（m040 "关闭整个浏览器后 lastViewedAt 不刷新"：离开那一刻的落盘本身不可靠）

### 事件
- **反馈**：用户不接受 m039 的结论，指出"关闭"指的是**关掉整个应用页面（整个浏览器）**、多标签方向无关，并断言"问题必定在 `lastViewedAt` 的修改上，关闭页面的触发被漏掉了"。
- **排查顺序**（把已验证的路径逐个排除，只留唯一没测过的）：
  1. dev `:5173` 真实生成流程（生成 → 上屏 → 关标签页）：关页时三类事件各写一次，值刷新 ✅
  2. dist `:3000` 重建后同一流程：同样 ✅
  3. 三模块 `viewingQuery` 与记录 `query` 静态核对：search / dict·translate / doc 全部一致，无失配
  4. **关掉整个浏览器 + 多标签并存**：❌（唯一没测过的路径）
- **定位（两步 beacon，把"事件没来"与"处理函数没写"彻底分开）**：
  - 事件侧：给四类生命周期事件各挂 `navigator.sendBeacon` 打到本地 HTTP 端点。**关单个标签页**时四类事件全到；**关整个浏览器**时 `beforeunload` 被跳过，`pagehide` / `vis:hidden` / `unload` 每个标签页各一次。
  - 写入侧：包一层 `Storage.prototype.setItem`，写历史键时额外打 beacon 带回 `key` + `lastViewedAt`。关整个浏览器时 beacon 收到 `lva=…494949` —— **应用确实写了新时刻**；但重开后磁盘上仍是旧值 `…493768`。
- **根因**：既不是触发漏了、也不是处理函数没跑，而是**这次写入没落盘**。`pagehide` 之后渲染进程紧接着被杀，localStorage 的异步提交来不及刷进磁盘。旧不变式「在浏览消失的一刻登记」把正确性压在了最脆弱的时机上。

### 修复
- 不变式换成：**磁盘上的 `lastViewedAt` 落后真实浏览时刻不超过一个心跳周期**。
- `src/hooks/HistoryContext.tsx`：
  - 新增 `VIEWING_HEARTBEAT_MS = 30_000`（导出，与侧栏相对时间粒度对齐）；
  - `viewingId` effect **进入即写一条兜底基线**；
  - 新增心跳 effect：浏览期间每 30s 写一次，`visibilityState === 'hidden'` 时跳过；
  - 离开路径（React 侧 `flushViewing` / 页面级 `flushOnPageLeave`）保留，写精确时刻；
  - 四处写入统一 `Math.max(Date.now(), 磁盘值)`，单调不回退。
- 因为浏览中侧栏显示的是"浏览中"徽标而非时间，新增的两次写入对用户不可见，只在"离开写入丢失"时体现价值。

### 测试与验证
- `historyViewing.test.tsx`：改写 2 例（"进入不登记" → "进入即登记兜底基线"；同步落盘用例改用 `Date.now` 假时钟精确断言），新增 2 例（心跳；`hidden` 不心跳）。`tsc` 零错误，`vitest` **341/341**。
- A/B（生成 → 停留 35s → 关整个浏览器 → 重开）：旧 `dist` = +0ms ❌ ／ 新 `src` = **+30015ms** ✅（心跳正好落一拍）。
- `dist/` 重建（751 模块，新入口 `assets/index-DU89KXEN.js`），`:3000` 复测通过。

---

## 2026-09-20（m039 "关闭标签页不刷新"真因：跑的是 09-10 的旧 dist 构建）

### 事件
- **反馈**：用户第三次报同一症状 —— "关闭标签页时，'浏览中'的记录依旧不刷新 `lastViewedAt`，必须额外处理了"。
- **诊断方式换掉了**：不再读代码猜，改用**真实浏览器 + 页内探针**取证（Playwright 注入脚本劫持 `Storage.prototype.setItem`，记录每一次写入，同时监听四个页面级事件；关标签页后新开一页读回）。
- **两个入口分别实测**：

  | 入口 | 关标签页时事件 | 关标签页时写入 | `lastViewedAt` |
  |------|----------------|----------------|----------------|
  | dev `:5173`（服务 `src/`） | 四类事件全部触发 | 写了一次 `…history:<id>` | **刷新 ✅** |
  | demo `:3000`（服务 `dist/`） | 同样全部触发 | **一次都没有** | **停在打开它的那一刻 ❌** |

  dev 下 search / dictionary / doc 三个模块逐一通过；dist 下的表现与用户描述逐字吻合。
- **根因**：`start.bat` → `node server.js` 服务的是 `dist/`，而 `dist/` 最后一次构建是 **2026-09-10**，早于 m033 —— 构建产物里**根本没有 `lastViewedAt`**（只有旧的整表键 + `JSON.stringify(全表)`）。m033→m038 的改动全在 `src/`，只有 dev server 会服务它。所以无论怎么改，3000 上都不可能生效。

### 文件变更
- `dist/`：重建（751 模块 + postbuild 去 `crossorigin`），新入口 `assets/index-CzWycQJa.js`。
- `server.js`：
  - 新增 `checkBuildFreshness()`：比较 `src/` 与 `dist/` 最新 mtime，`dist` 旧了就打醒目告警（两侧时间 + `npm run build` 提示 + 建议用 dev 5173）；`dist` 缺失同样告警。
  - 所有响应加 `Cache-Control: no-store, must-revalidate`（原先无缓存头 → 浏览器可启发式缓存旧 `index.html`）。

### 构建验证
- 新鲜度自检**双向验证**：伪造 src 变新 → 打印旧构建告警；恢复 mtime → 打印"dist/ 已是最新"。
- 重建后的 dist 用同一套探针在 `:3000` 复测 → search / dictionary / doc 全部 ✅。
- `tsc --noEmit` 零错误；vitest **30 文件 / 339 用例全绿**（本轮未改 `src/`）。

### 关联文档
- 更新 `docs/worklog.md`、`docs/issues.md`、`docs/progress.md`、`.workbuddy/memory/`。

### 经验教训
- **"改了没生效"先确认跑的是哪份代码，再改第二遍**：本仓库有两条入口 —— dev（5173，服务 `src/`）与 demo（`start.bat` → 3000，服务构建产物 `dist/`）。连续两轮都在改 `src/`，而用户看的是 `dist/`，于是每一轮"修好了"都不可能被验证。**症状与代码分析矛盾时，第一嫌疑是"他跑的不是这份代码"。**
- **取证要用页面内的探针，不要读代码推理**：劫持 `setItem` + 监听页面级事件，一次运行就能把"事件有没有来 / 写有没有发生"钉死，成本远低于来回猜。
- **构建产物必须能识别出"自己旧了"**：静态服务启动即自检 + 禁缓存。否则旧行为会伪装成新 bug，且这种误判可以连续发生好几轮。
- **静态服务不要省 `Cache-Control`**：不发缓存头 ≠ 不缓存，浏览器会启发式缓存 `index.html`，重新构建后可能仍加载旧 hash 的资源。

---

## 2026-09-20（m038 关闭标签页兜底登记 + 翻译模块"浏览中"身份修正 + 重构性能实测）

### 事件
- **追问**：用户提出两件事 —— ① "当前的重构法对性能的代价大不大？"；② "页面正在浏览内容时，关闭标签页，那个最后浏览时间仍是旧值，这是关闭页面时 `lastViewedAt` 没有机会被更改，应该放在关闭过程中特别处理。"
- **性能结论（实测）**：100 条真实体量记录（合计 906 KB）下，新布局一次浏览登记 **0.080 ms**，旧整表布局 **7.260 ms** —— 新布局快约 90 倍，且成本与记录条数脱钩（旧布局线性增长）。`readAll` 的 2.849 ms 只在超 100 条裁剪时走一次，旧布局每次写入都要付。重构是净收益，无需为性能做任何取舍。
- **关闭标签页仍不刷新的真因（两处叠加）**：
  1. **翻译模块的"浏览中"身份取错**：`viewingQuery` 从结果字段派生（`wordResult?.word` / `sentenceResult?.original`），而记录拿**用户输入**当 `query`。模型返回归一化词形时两者不一致 → `(type, query)` 永远解析不到条目 → 该记录**永远不会被登记**（搜索/文档模块取的就是记录身份，只有翻译是例外）。
  2. **关闭路径过度依赖 React 状态**：`viewingId` 由 `useMemo` 从 state 派生，页面卸载时可能还没解析好（本页内存副本未收敛，例如记录是另一标签页写的、`storage` 事件被节流），ref 仍为 null → 不写。
- **做法**：把"浏览中"声明留一份**同步副本**（`viewingDeclRef`），并把登记路径拆成两条 —— React 侧只认已解析的 id；页面级离开在 id 解析不出时按声明 `(type, query)` 回磁盘兜底。

### 文件变更
- `src/hooks/HistoryContext.tsx`：
  - 新增 `viewingDeclRef` + `declareViewing`（同步记下原样声明，`setViewing` 指向它）；
  - `flushViewing`（React 侧：内容消失 / 卸载）**只认 `viewingIdRef`**；`flushOnPageLeave`（`visibilitychange→hidden`/`pagehide`/`beforeunload`/`freeze`）ref 为空时退到 `findByQuery(decl.types, decl.query)` 回磁盘找。
  - **两条路径刻意不共用兜底**：共用会让"进入内容"的那次 cleanup 也命中磁盘兜底 → 一进页面就把时间刷成现在（第一版共用实现直接让 `historyViewing` 红 2 例）。
- `src/modules/translate/index.tsx`：`viewingQuery` 由"结果派生"改为显式 state，取值一律是**用户输入文本**（记录身份）；`pushDictHistory`/`pushTransHistory`/`showFavorite`/`handleHistorySelect` 写入，`handleRemove`/`reset`/`handleModeChange` 置 null。
- **新增测试**：`src/hooks/__tests__/historyViewing.test.tsx` 增 1 例（内存未收敛时页面级离开须回磁盘兜底）。

### 构建验证
- `tsc --noEmit` 零错误；vitest **30 文件 / 339 用例全绿**（原 338；净增 1）。
- **反向验证**：摘掉 `flushOnPageLeave` 的磁盘兜底 → 新例立刻红（值仍是 30 分钟前的旧值）；已恢复。

### 关联文档
- 更新 `docs/worklog.md`、`docs/issues.md`、`docs/progress.md`、`.workbuddy/memory/`。

### 经验教训
- **"显示在屏幕上的东西"是模块的知识，"这条记录是谁"必须由模块自己说清**：只要把身份交给模型返回的字段（`word` / `original`），归一化/改写一次就静默失配 —— 而且失配的表现是"某个功能悄悄不生效"，没有报错、没有日志，最难查。凡"声明式接口"的参数都要问一句：**它的值是不是调用方能保证稳定的那个**。
- **同步可读的东西不能在页面卸载路径上依赖**：`useMemo` / `useEffect` / state 提交都可能来不及。凡是"离开页面时必须落盘"的状态，都要有一份同步写入的 ref 副本，并在解析失败时留一条不依赖 React 的兜底路径。
- **兜底要绑死"触发场景"，不能做成通用能力**：同一个兜底函数被两条语义不同的路径复用，就会把 A 场景的容错泄漏到 B 场景（"进入"被当成"离开"）。分档不是啰嗦，是防串味。
- **性能问题先量再答**：本次的直觉（"写前重读磁盘 = 每次多一次 IO，会不会更慢"）与实测相反 —— 单条重读 0.026 ms，而旧布局每次都要序列化整表 906 KB。凭直觉给结论容易劝退正确的方案。

---

## 2026-09-20（m037 历史数据层改"磁盘真相" + 切模式即清内容）

### 事件
- **反馈**：用户复测 m036 后判定为"纯负面改动"并给出结论 —— ① "搜索切问答不会清'浏览中'的内容，切回搜索仍是'浏览中'"；② "多标签页面数据处理逻辑存在重大问题，我决定重构"。
- **澄清（有据可查）**：第 ① 条**不是 m036 引入的** —— `switchMode` 自 initial commit（`04f2998`）起一直是"切到搜索时清问答消息"，反向从不清搜索内容；`git log -S"handleModeChange" -- src/modules/search/` 为空。但**词典/翻译模块的 `handleModeChange` 一直是"切模式即清两个结果"**，搜索模块是唯一不一致的例外，所以它确实是缺陷。
- **"没解决问题"的真因**：m036 换了存储布局，而迁移只在新代码挂载时执行；改造前就已打开的旧标签页仍在写整表键、跑旧逻辑，两套布局互相看不见 —— 在那个标签页里必然是旧行为。这是改存储布局的代价，只给一句"刷新一下"的提示是不够的。
- **用户追问的关键问题**：一个标签页正在生成内容时，其他标签页怎么处理？
- **诊断（四条实锤缺陷，同一根因：写操作相信内存副本而非磁盘真相）**：
  1. `commit()` 按**本页内存排序**裁剪上限并**连键一起删** —— 本页不知道别的标签页刚建/刚刷新的记录，把它算成"尾部"删掉 = 真实数据丢失（>100 条触发）。
  2. 所有更新走 `historyRef` 读改写 —— 落后的标签页把同一条记录（含 `lastViewedAt`）覆盖回旧值，"关标签页新登记的时间被写旧"。
  3. 旧整表键的吸收逻辑可重复触发且无标记 —— 旧代码标签页写回的快照会在下次挂载被重新吸收，**已删除的条目复活**。
  4. 同一主题在两个标签页各自生成时 id 是随机时间戳，谁都看不见对方的 id → **两条同主题记录**（"两边历史各看各的"的一部分）。
- **做法**：确立**磁盘是真相** —— 所有写操作先重读磁盘（`readItem` / `mutate`），`lastViewedAt` 单调不回退，上限裁剪按磁盘排序，`(type, query)` 成为跨标签页身份，迁移一次性化。

### 文件变更
- `src/hooks/HistoryContext.tsx`（数据层重写）：
  - `readItem()` = 写前重读唯一入口；`mutate(id, produce)` 以磁盘最新副本为基准读改写（拿不到才回退内存）；
  - `lastViewedAt` 一律 `Math.max(Date.now(), 磁盘值)`；
  - `commit()` 不再删内存尾巴 → 新增 `trimDisk()`：**按磁盘排序**才删键，且仅在内存视图确实超限时触发；
  - 新增 `dedupe()`：加载时按 `(type, query)` 归并重复（保留较新者，删重复键），幂等；
  - 新增 `findByQuery()`：`(type, query) → 记录`，内存未命中时扫磁盘 → 两标签页同主题**复用同一条记录**；
  - 迁移加 `SCHEMA_KEY`（`ai-office-assistant-history.schema`）**版本标记**，写好后永不再读旧整表键；
  - 新建 id 加随机后缀（防两标签页同毫秒撞键后写覆盖）；`freeze` 监听从 `window` 改到 `document`。
- `src/modules/search/index.tsx`：加 `useEffect(() => { if (mode === 'qa') reset(); }, [mode, reset])` —— 离开搜索视图时内容消失（走卸载路径登记 `lastViewedAt`），对齐翻译模块的 `handleModeChange` 口径。
- `src/services/streaming/__tests__/sseReaderTimeout.test.ts`：`elapsedMs >= 30` 在 30ms 超时下偶发（实测 29），改量级区间断言。
- **新增测试**：`src/modules/search/__tests__/searchModeSwitch.test.tsx`（2 例，真实渲染模块 + mock aiService）、`src/hooks/__tests__/historyMultiTab.test.tsx`（5 例）。

### 构建验证
- `tsc --noEmit` 零错误；vitest **30 文件 / 338 用例全绿**（原 331；净增 7）。
- **反向验证**：注掉切模式清内容的 effect → `searchModeSwitch` 恰好卡在"切回搜索仍是浏览中"；把 `Math.max(...)` 换回 `Date.now()` → `historyMultiTab` 第 1 例立刻红（写回本页的 1000，而不是磁盘上的 1789877428054），即"关标签页登记被写旧"。均已恢复。

### 关联文档
- 更新 `docs/worklog.md`、`docs/issues.md`、`docs/progress.md`、`.workbuddy/memory/`。

### 经验教训
- **localStorage 是跨标签页的共享状态，内存副本只是缓存**：任何"读改写"都必须先重读磁盘，否则落后的标签页就是一次静默回退。把这条写死成 `mutate()` 一个出口，比在每个调用点自觉更可靠。
- **"删除"和"上限裁剪"性质不同**：删除是用户意图，可以删；裁剪是内部housekeeping，**必须按磁盘真相判断**，否则会把别的标签页刚创建的数据当垃圾扔掉。
- **迁移必须一次性且带标记**：只要还有进程能往旧键里写，无标记的迁移就是一条"数据复活"通道。
- **同一个业务对象在跨进程场景下需要确定性身份**：id 若由随机时间戳生成，两个标签页永远不知道对方是否已经建过同一条记录。改成"内存未命中就扫盘"后，`(type, query)` 成为事实身份，重复条目从根上消失 —— 这也顺带回答了"一个标签页在生成、另一个标签页怎么办"。

---

## 2026-09-20（m036 "浏览中"状态收归 Provider + 历史存储改单条键）

### 事件
- **反馈**：用户复测 m035 后指出两件事 —— ① "很可能缺少内存清理，关闭网页标签，'浏览中'历史时间仍然没刷新，应该单独处理此状态，'浏览中'内容消失时必须走卸载路径"；② "多标签页同时打开'整表覆盖写、后写者赢'效果不相符"。
- **诊断**：两个问题同源 —— **状态归属错了**。
  1. 登记寄生在 `HistorySidebar` 上，可侧栏**不是"浏览中"状态的所有者**：收起时仍挂载（宽度归零），关标签页/刷新时更不会被卸载。挂在它上面，"退出应用页面"这一整类离开必然漏；且 `viewingId` 还要由侧栏从 `items` 反查一次，链路一长任何一环不成立就整类失效。
  2. 历史存储是**整表一个键**：每次写入重写全部记录，多标签页同时打开时后写者用自己内存里的旧快照盖掉另一个标签页刚写的内容（记录凭空消失、刚登记的时间被退回），删除也无法传播。
- **做法**：把"浏览中"状态**单独收归常驻的 `HistoryProvider`**（模块只声明在看哪一条，登记时机全由 Provider 负责）；存储改为**一条记录一个键**，让写入单条原子、删除即删除、外部改动经 `storage` 事件收敛。

### 文件变更
- `src/hooks/HistoryContext.tsx`：
  - 新增 `setViewing()` 声明 + `useViewingHistory(type, query)` hook（依赖用字符串化 type 签名，避免数组字面量每次渲染都重新登记）；`viewingId` 由 Provider 解析；
  - 登记时机：声明变化 / 声明方卸载（= 内容消失走卸载路径）+ 页面级 `visibilitychange→hidden`、`pagehide`、`beforeunload`、`freeze`（监听挂在常驻 Provider 上）；
  - 存储：`…history:<id>` 单条键；`readAll` 容错扫描；`commit / upsert / updateById / updateByQuery` 四个内部函数收敛所有写入（`historyRef` 为内存权威副本，**写入即同步落盘**）；`storage` 事件收敛外部改动（`key === null` = 对方 `clear()`）；旧整表键首次加载摊成单条键后删除。
- `src/components/history/HistorySidebar.tsx`：移除全部登记逻辑（`touchHistory`/`flushViewing`/页面级监听/`viewingId` 反查），退回纯展示；`currentViewing` 只用于徽标。
- `src/modules/{search,translate,doc}/index.tsx`：各加一行 `useViewingHistory(...)` 声明；`useSearchMode.ts` 同步清理。
- 删掉 4 处散写 `touchHistory`（`search`/`dict-*`/`trans-*`/`qa-*`）：传的 id 与条目真实 id 根本对不上（`dict-<ts>` vs `dictionary-<ts>`），纯空转；`addHistory` 本就把 `lastViewedAt` 初始化为创建时刻。
- **新增测试** `src/hooks/__tests__/historyViewing.test.tsx`（13 例）；改写 `src/components/history/__tests__/historySidebar.test.tsx`（只保留显示/排序/旧数据吸收，读写改单条键布局）。

### 构建验证
- `tsc --noEmit` 零错误。
- vitest **28 文件 / 331 用例全绿**（原 324；净增 7）。
- **反向验证**：注掉 `pagehide`/`beforeunload` 监听 → 对应 3 例变红，`visibilitychange` 各例保持绿（证明测试锁的是具体信号，不是"整体都红"）。已恢复。
- dev server 采样 `/src/hooks/HistoryContext.tsx` 等 5 个改动模块，均 200 编译通过。

### 关联文档
- 更新 `docs/worklog.md`（并给被取代的 m035 条目加了取代说明）、`docs/issues.md`、`docs/progress.md`、`.workbuddy/memory/`。

### 经验教训
- **状态要归它的所有者**：登记"最后浏览时刻"的唯一正确依据是"内容还在不在"，而不是"侧栏在不在"。把登记寄存在一个生命周期与业务状态无关的展示组件上，补多少监听都是在错的层上加补丁。
- **"某类离开一定漏"是最坏的一类 bug**：React 看得到的离开（卸载）与页面生命周期里的离开（关标签页/刷新/切后台）是两套机制，任何"离开时保存"的需求都必须同时覆盖，且保存必须同步落盘。
- **整表键不适合多标签页**：共享一份快照 + 整表重写 = 后写者赢。改单条键后，写入/删除天然原子，配合 `storage` 事件即可收敛，不需要墓碑或版本号。

---

## 2026-09-20（m035 退出应用页面时登记最后浏览时刻）

### 事件
- **反馈**：用户指出 —— "历史记录时间刷新逻辑有问题，退出应用页面 `lastViewedAt` 表现为没有刷新"，即正在浏览某条记录时直接关闭标签页 / 刷新 / 切到其他 Tab，下次打开该记录仍显示上次离开的旧时间。
- **诊断**：两个独立缺口叠加，缺一个都不成立。
  1. **登记入口只有 React 侧**：全应用唯一 touch 点是 `HistorySidebar` 的 effect cleanup（覆盖切换条目 / 清空内容 / 卸载切功能页）。但"退出应用页面"时 React **不会卸载组件**，cleanup 永不执行 —— 这次离开根本没被登记。
  2. **持久化走 effect**：`touchHistory` 只 `setState`，落盘靠 `useEffect([history])`；页面卸载时该 effect 同样不会执行。**只补页面监听而不改落盘方式，仍然会丢**。
- **做法**：页面级事件接进同一个登记入口（不新增第二套逻辑），并把 touch 改成同步落盘。

### 文件变更
- `src/hooks/HistoryContext.tsx`：抽出 `applyTouch(items, id, now)`（改 `lastViewedAt` + 按它排序，与 `getHistoryByType` 同一基准）；新增 `historyRef` 保存最近已提交列表；`touchHistory` 改为「ref 取最新列表 → `saveToStorage(next)` **同步落盘** → `setHistory` 函数式更新」。
- `src/components/history/HistorySidebar.tsx`：cleanup 里的登记抽成幂等的 `flushViewing()`；新增页面级监听 `visibilitychange → hidden`（切到其他 Tab / 最小化 / 移动端切后台）与 `pagehide`（刷新 / 关闭 / 跳走，含 bfcache 进出），均调用 `flushViewing()`；监听随侧栏卸载移除。
- `src/components/history/__tests__/historySidebar.test.tsx`：新增 4 例（切 Tab 登记、pagehide 登记、事件回调内同步落盘、无浏览中时不写入）；jsdom 只读的 `document.visibilityState` 用 `defineProperty` 影子覆盖并在 `afterEach` 复原。
- 三个模块（search / translate / doc）共用同一 `HistorySidebar`，因此一次修复全模块生效，无需改动各模块。

### 构建验证
- `tsc --noEmit` 零错误。
- vitest **27 文件 / 324 用例全绿**（原 320，净增 4）。
- **反向验证**（确认新测试真能锁住回归）：注掉 `saveToStorage(next)` → 仅"同步落盘"一例变红；注掉两个 `addEventListener` → 三条登记用例变红、"无浏览中"一例保持绿。均已恢复。

### 关联文档
- 更新 `docs/worklog.md`、`docs/issues.md`、`docs/progress.md`、`.workbuddy/memory/`。

### 经验教训
- **"离开"有两种，React 只认得一种**：组件卸载是 React 世界里的"离开"，但用户关标签页/切后台属于**页面生命周期**，React 一无所知。凡是"离开时登记/保存"的需求，必须同时挂 `visibilitychange`（hidden）与 `pagehide`。
- **卸载时不能只 setState**：浏览器卸载页面时不会给 React 跑 effect 的机会，任何"退出时要保住的数据"都必须在事件回调里**同步写**（localStorage 是同步 API，正好可用）。这条与"React 的持久化 effect"是两回事，很容易只改一半。

---

## 2026-09-20（m034 生成中断提示衔接内容末尾 + 尾部快照兜底）

### 事件
- **反馈**：用户带截图指出 —— 搜索模块内容**已经渲染出来**，页面**顶部**却弹出一条红色技术性横幅"流式生成结束但未解析出有效 JSON（已收到 9634 字符）"，要求"错误提示部分应衔接在内容最后"。
- **诊断**：两个独立缺陷叠加。
  1. **归因错误**：续写轮会把第二份 JSON **追加**在第一轮的文本之后，整段文本因此不再是合法 JSON，`StreamingJSONParser.finish()` 返回 `null`。旧代码只认 `finish()` 的结果 —— 哪怕 `push()` 期间早已产出并渲染了成千上万字符（含完整可用的 summary/mindMap/concepts），也一律判成"解析失败"抛致命异常。
  2. **位置错误**：所有生成中断提示（`GenerationNotice`）与错误横幅都挂在内容**上方**，提示说的是"末尾没写完"，位置却在开头；流式过程中还会把正在长出来的内容持续往下挤。
- **做法**：先修归因（尾部不可恢复时回退到最后一份可渲染快照），再修位置（提示统一落到内容末尾），最后补回归测试锁定两条边界。

### 文件变更
- `src/services/baseAIProvider.ts`（`generateStream`）：
  - 新增 `lastRenderable`，在 `onDelta` 中记录最后一份 `snap.data` 非空的快照；
  - 判定改为 `renderableData = finalSnap.data ?? lastRenderable` —— 尾部恰好停在半个转义序列上时不再报废整段内容；
  - 仅在"全程连一个可渲染快照都没有"时才抛 `GenerationInterruptedError`（parse）；
  - 走兜底路径时打 `truncated` + `incomplete` 中断归因（内容侧：末尾区块可能不完整）。
- `src/modules/search/useSearchStateMachine.ts`：失败/异常但**已有内容**时不再写 `error`（理由改由内容末尾中断提示承载），技术细节只进 `interruption.detail`；`toFriendlyError` 补 `GENERATE_FAILED` 分档（不把解析器内部状态甩给用户）。
- `src/components/knowledge/KnowledgeContentView.tsx`：`GenerationNotice` 从标题头下方移到**全部内容区块之后**。
- `src/modules/doc/DocResult.tsx`、`src/modules/favorites/index.tsx`：文档正文与收藏文档详情的提示同样移到正文末尾（三个出口同一口径）。
- `src/modules/search/components/SearchContainer.tsx`：删除顶部错误横幅；无任何内容的失败改为空状态卡内展示具体原因；有内容时错误落在内容末尾。
- **新增测试** `src/services/__tests__/generateStreamPartial.test.ts`（3 例）：续写轮追加 JSON 导致 `finish()` 失败时保留已渲染内容并标记 `truncated` + `interruption.side='content'`；全程无 JSON 才 `success:false + GENERATE_FAILED`；正常完整 JSON 不受影响。
- 更新 `src/modules/search/__tests__/useSearchStateMachine.test.tsx`：半截超时用例改为断言"内容保留 + 中断归因挂到数据上（link/timeout）、不再压顶部错误"；未分类异常用例改为断言通用失败文案且不泄露技术细节。

### 构建验证
- `tsc --noEmit` 零错误。
- vitest **27 文件 / 320 用例全绿**（原 26 文件 / 317 用例；净增 3 + 改写 2）。

### 关联文档
- 更新 `docs/worklog.md`、`docs/progress.md`、`docs/issues.md`、`docs/history.md`、`.workbuddy/memory/`。

### 经验教训
- **"解析器状态"不等于"用户结果"**：解析失败的瞬间不代表内容没生成。判定"生成成功与否"必须看**已产出内容**（累计可渲染快照），而不是看最后一次解析调用的返回值。
- **错误提示的位置即语义**：说"末尾没写完"的提示就该在末尾。放在顶部等于"先报错、再看内容"，还会在流式过程中持续推挤正文。

---

## 2026-09-20（历史时间戳模型收敛：lastViewedAt 单一基准）

### 事件
- **反馈**：用户指正 —— `lastViewedAt` 初始值理应是历史记录创建时刻；排序应以 `lastViewedAt` 为唯一基准；旧数据只需挑"最后浏览时间"转换为新数据格式。
- **背景**：上一轮（09-19）已把"最后浏览时刻"登记收敛到 `HistorySidebar` 的 effect cleanup 单点，但 `lastViewedAt` 仍为可选字段、显示层还留着 `?? timestamp` 回退、排序仍按 `timestamp`。

### 文件变更
- `src/types/index.ts`：`HistoryItem.lastViewedAt` 由可选改为**必填**；`timestamp` 语义收窄为"创建时刻"。
- `src/hooks/HistoryContext.tsx`：加载 localStorage 时 `migrateLegacy` 一次性补 `lastViewedAt = timestamp` 并落库；`addHistory` 新建条目 `timestamp = lastViewedAt = now`，复现已有条目只刷 `lastViewedAt`；`updateSession` / `updateSearchSessionWithData` 去掉条目级 `timestamp` 刷新；`touchHistory` 只写 `lastViewedAt`；`getHistoryByType` 排序基准改为 `lastViewedAt`。
- `src/components/history/HistorySidebar.tsx`：显示改 `formatRelativeTime(s, item.lastViewedAt, language)`，去掉回退。
- `src/services/streaming/…`：无变更。
- 更新 `src/components/history/__tests__/historySidebar.test.tsx`（新增旧数据迁移、排序基准 2 例）。

### 构建验证
- `tsc --noEmit` 零错误；vitest 各用例全绿（本次批次结束时为 27 文件 / 320 用例）。

### 关联文档
- 更新 `docs/worklog.md`、`docs/progress.md`、`.workbuddy/memory/MEMORY.md`、`.workbuddy/memory/2026-09-20.md`。

---

## 2026-09-15（v1.7.0 正式发布：生成中断分类 + 全场景续写 + 错误处理 + 版权声明）

### 事件
- **需求**（两段一体）：① 把"添加了版权声明的版本"标记为**正式发布版本里程碑**；② 修复知识内容生成逻辑——"模型超限、网络超时/异常之间没有明确区分界限"，表现为**内容未完全生成就自动截止且无任何提示**，要求把续写逻辑从"仅模型超限"扩展到其他异常中断情况，并优化错误处理。
- **确认**：经用户选择确定 —— 版本号 **v1.7.0**；续写边界 **全链路可续写 + 无内容时限 1 次重发 + 总请求数硬上限 3**；提示方式 **按原因分档横幅**。
- **做法**：先分类（把"没写完"这件事拆成互不相同的归因），再谈续写与提示；每一类归因都有测试锁定。

### 核心问题：只有一种中断被识别，"为什么没写完"完全丢失
| 中断类型 | 旧行为 | 结果 |
|---|---|---|
| 模型超限 `finish_reason=length` | 会续写 + `truncated` 横幅 | 唯一被正确处理的 |
| 流被静默掐断（无结束标记、JSON 未闭合） | 只有 `truncated` 布尔，无原因 | 横幅**谎报**"模型输出上限" |
| 中途网络断开（`fetch`/`body.read` 抛 TypeError） | `withFallback` 吞成 `success:true` + 空结构体 | **已流出内容被丢弃、页面空白、零提示** |
| 链路超时 / 协议错 | 透传 code，但**首轮异常直接上抛** | 一次续写都不做，直接截断 |
| 文档模块 / 追问流 | `truncated`/`continued` 根本没接 | 完全无提示 |

### 文件变更
- **新增** `src/services/streaming/interruption.ts`：中断分类模型（`InterruptionKind` / `InterruptionSide` / `GenerationInterruption` / `classifyThrown` / `kindFromFinishReason` / `canContinueAfter` / `interruptionFromCode` / `GenerationInterruptedError`）。
- **新增** `src/components/ui/GenerationNotice.tsx`：按原因分档的提示横幅（搜索/文档共用，兼容旧历史数据）。
- `src/services/streaming/sseReader.ts`：新增 `StreamNetworkError` / `StreamAbortedError`；`readSSEStream` 把 body 读取失败归类为传输层中断（原为裸 TypeError 冒泡）。
- `src/services/baseAIProvider.ts`：`withFallback` 增加 `strict` 模式；`callModelStreamWithContinuation` 重写为分类驱动续写；新增 `fetchOrThrow()`；`finishReason` 逐层透出；生成类方法接 strict 并透出 `interruption`。
- `src/modules/search/useSearchStateMachine.ts`：`toFriendlyError` 覆盖全部中断 code；失败但已有内容时保留内容并挂上归因；catch 统一走 `classifyThrown`。
- `src/modules/search/SearchResults.tsx`、`src/modules/doc/{index,DocResult}.tsx`：接入分档横幅，文档模块补齐中断标记透传与入库。
- `src/i18n/strings/search.ts`、`src/types/{ai,index}.ts`：新增分档提示与错误文案（中英同步）、`interruption` 字段。
- **新增测试**：`interruption.test.ts`（19）、`generationNotice.test.tsx`（11）；扩写 `continuation.test.ts`（+11）、`streamFallback.test.ts`（+6）。

### 构建验证
- `tsc --noEmit` 零错误。
- vitest **20 文件 / 277 用例全绿**（原 18 文件 / 230 用例；净增 47）。
- `vite build` 成功（747 modules）。

### 关联文档
- 更新 `docs/versions.md`（立 v1.7.0 正式发布里程碑）、`docs/worklog.md`、`docs/progress.md`、`docs/todo.md`、`docs/issues.md`、`docs/design.md`、`docs/convention.md`、`README.md`、`.workbuddy/memory/2026-09-15.md`

### 经验教训
- **"不完整"和"为什么不完整"是两件事**：一个 `truncated` 布尔承载不了归因，UI 就必然把网络中断报成"模型输出上限"——**错误归因比不提示更糟**（用户会去换模型，而真正该做的是检查网络）。凡"状态判定"都要配一个"原因字段"。
- **兜底（fallback）必须分级**：无差别的 `catch → 返回兜底值` 对"输入校验/翻译"这类业务调用是善意降级，对"内容生成"却是灾难——它会把 `success:true` 和一个空结构体交给上层，使**已流出的内容与真实原因一起被丢掉**。生成类调用一律 strict 透传。
- **续写不该只为"模型超限"服务**：只要已收到内容且中断值得再试，回填续写就是正解；真正的边界不是"什么原因"，而是"次数上限"（硬上限 3 次）+ "什么不值得再试"（用户取消 / 安全策略拦截 / 内容根本不是 JSON）。
- **异常里"本轮才开始"的快照不要拿来判断"现在有没有内容"**：`catch` 里复用循环开头算好的 `hasContent`，会让"本轮吐了几千字符才断"被当成"什么都没有"，直接上抛丢掉整段内容——真 bug，已由回归测试锁定。
- **提示要按原因分档，不能只按有无**：用户能据此采取正确动作（换网络 / 换模型 / 改主题 / 重试）。

## 2026-09-14（剔除垃圾文件 + 修复仓库污染）

### 事件
- **需求**：用户"请剔除垃圾文件"，并在范围确认时明确"请解决仓库污染的情况"。
- **做法**：先只读扫描出清单（含规模与 git 追踪状态），报告后再执行。

### 核心问题：`dist/` 被 git 追踪
- `.gitignore` 早已写入 `dist`，但 **64 个 dist 文件是在加 ignore 之前就提交的**——`.gitignore` 只约束未追踪文件，不会自动取消已追踪文件。
- **判断为非部署必需**：`vercel.json` / `netlify.toml` 都是「平台执行 `npm run build` 再取 `dist`」，仓库内 dist 纯属污染。

### 文件/仓库变更
- `git rm -r --cached dist`：64 个构建产物移出索引，**本地文件保留**（改由 `.gitignore` 忽略）。
- 删除可再生临时产物（≈5.9 MB）：`dist_verify/`、`.workbuddy/eval_shots/`、根目录 20 个 `*.timestamp-*.mjs`、`vitest_out.txt`、`remotion-videos/render_log.txt`。

### 构建验证
- `git check-ignore -v dist` → `.gitignore:3:dist` 生效；`git status` 中不再出现 dist 未追踪项。
- 无源码改动，`tsc` / vitest 不受影响。

### 关联文档
- 更新 `docs/worklog.md`、`.workbuddy/memory/2026-09-14.md`

### 经验教训
- **`.gitignore` 不会取消已追踪文件**：想彻底排除构建产物，必须 `git rm -r --cached <dir>` 再提交；只加 ignore 规则是无效的（这是"仓库里混进 dist/node_modules"的常见成因）。
- **删之前先确认"这个目录是不是构建/部署依赖"**：本例若盲目删 dist 本可安全（平台自行构建），但若不查 `vercel.json` 就动手，遇到"依赖预构建产物发布"的仓库会删出事故。
- **先扫描报告、再执行删除**：区分「可删 / 待定夺 / 必留」三档，避免把 IDE 配置、素材、成品一并当垃圾清掉。

## 2026-09-14（README 全量纠错）

### 事件
- **需求**：用户指出"项目的 README 有很多错误说明，请更正"。
- **做法**：逐条到代码取证（`package.json` 依赖 / 类型枚举 / 目录树 / i18n 字符串 / `vite.config` / `server.js`），只修正与代码不符者，核对无误的保留。

### 文件变更
- 重写 `README.md`：修正 10 处与代码不符的说明（详见下表）。
- 新建 `LICENSE`：MIT，`Copyright (c) 2026 ceepuka`（原 README 声明 MIT 却无 LICENSE 文件）。

### 修正明细
| # | 原说明 | 实际 | 处理 |
|---|--------|------|------|
| 1 | 技术栈含「图标 = Lucide React 0.x」 | 无此依赖、0 处引用；88 处图标为内联 SVG | 改为「内联 SVG（无第三方图标库）」 |
| 2 | `npm test`（142 例） | 230 例 / 18 文件 | 更新 |
| 3 | 超限续写"最多 3 次" | `MAX_GENERATION_ATTEMPTS=3` 为总尝试数（首轮 1 + 续写 ≤2） | 改写为"首轮 1 次 + 最多 2 次续写" |
| 4 | 搜索含"搜索范围标签" | i18n 无任何 scope/范围概念 | 删除 |
| 5 | 厂商列表并列"硅基流动"与"SiliconFlow" | 同一厂商，共 8 家预设 | 去重并明确 8 家 |
| 6 | 版本历史止于 v1.6.0 | 当前 v1.6.2 | 补 v1.6.1 / v1.6.2 |
| 7 | 声明 MIT License | 仓库无 LICENSE 文件 | 新建 LICENSE |
| 8 | 项目结构无 `wanxImage.ts` | 存在（通义万相文生图） | 补 |
| 9 | `components/ui` 仅列 `SvgFigure` | 另有 `LatexText` / `ImageFigure` / `ConfirmDialog`；`search` 另有 `services/QAService` | 补 |
| 10 | 收藏"多空间：默认/工作/学习" | 支持 `addSpace/removeSpace/updateSpace` | 补充"可自定义" |

### 构建验证
- 无代码改动（仅 README / LICENSE），未影响 `tsc` 与 vitest（现存 230 用例保持全绿）。

### 关联文档
- 更新 `docs/worklog.md`、`.workbuddy/memory/2026-09-14.md`

### 经验教训
- **文档里的"技术栈/数字/功能名"必须逐条回代码取证**：README 的错往往不是笔误，而是"功能删了文档没删"（搜索范围标签）、"依赖从未装过却写进表里"（Lucide）、"数字随迭代漂移"（142→230）。
- **声称有许可证就要有 LICENSE 文件**：只写一行 "MIT License" 而仓库无文件，既误导使用者，也影响 GitHub 的许可识别。

## 2026-09-14（页脚新增版权声明）

### 事件
- **需求**：应用页脚在"知识灵动助手 - AI驱动的知识办公应用"下方补版权声明，署名 GitHub 账号 `ceepuka`。

### 文件变更
- 更新 `src/i18n/strings/common.ts`：`app` 段新增 `copyright` 键（En 基准 + Zh），文案含 `{year}` / `{author}` 占位符。
- 更新 `src/App.tsx`：页脚拆两行（品牌行 + 版权行）；导入 `fmt` 填充年份；作者名经 `split('{author}')` 切出，渲染为 `https://github.com/ceepuka` 链接。
- 新建 `src/i18n/__tests__/strings.test.ts`：3 条契约测试锁定占位符契约。

### 构建验证
- TypeScript 类型检查：通过
- 测试：18 文件 / 230 用例全绿

### 关联文档
- 更新 `docs/worklog.md`、`docs/lessons/framework.md`、`docs/lessons/index.md`

### 经验教训
- **i18n 文案里"被组件切分"的占位符要用契约测试钉住**：类型系统管不住字符串内容，占位符被删会让链接**静默消失**（详见 lessons/framework.md）

## 2026-09-13（修复试题解析"乱编"：解析禁止离题 + 续写防推翻前文）

### 事件
- **背景**：用户报障（截图）——一道复数题的解析出现明显"乱编"：多个解题过程交织、互相矛盾，出现"几道经典题""信雅达千字文""采用 2022 年全国乙卷真题"等离题话术。
- **根因**：`examQuestions[].explanation`（解析）是自由书写字段，现有约束只有"解析必须与答案一致""解析给出确信推导"——这些管的是**结论正确**，管不住**过程里夹带的废话**（自我标榜"这是真题"、罗列多题、引言点评、多套解法交织）。
- **修复**：
  - **严谨性铁律新增第 5 条**「解析只写本题推导，禁止一切离题内容」：explanation 只许写"解这一道题"的分步推导，一步到底、一套解法；严禁"这是真题/经典题/易错题""本题考的是……""下面讲几道题""信雅达"等离题话术，严禁罗列多题、多套矛盾解法、反复自我推翻。
  - **examQuestions 字段级约束补强**：明确 explanation 从"解/设/由题可得"直接开始，只写一套解法，不得写开场/点评/另一道题，推导最后一行结论必须等于 answer。
  - **续写提示词补强**：第 1 条加"不得推翻、改写或重新解释前面已写结论"，第 2 条加"不得插入与当前内容无关的新话题"——防续写轮重述/改写前文造成"多套解法交织"。

## 2026-09-13（优化对话效果：防"反斜杠被吞" + 公式渲染失败时给视觉信号）

### 事件
- **背景**：用户报障（截图）——对话里大量公式渲染失败，模型把 `\` 吞了：`\frac` 变 `rac`、`\triangle` 变 `riangle`、`\sqrt` 变 `sqrt`（无反斜杠）；公式密集成一团、行间紧；用户分不清"普通文字夹怪东西"和"公式源码渲染失败"。
- **根因**：
  - **Prompt 层**：`buildFollowupSystemPrompt` 公式规则只写"用 LaTeX"，没强调"反斜杠是 LaTeX 命令的开关、绝不能省"；模型吞反斜杠后整段坏掉；`splitBareLatex` 也无法识别"已丢反斜杠"的残片（按设计不误识别 snake_case）。
  - **渲染层**：`LatexText` 在 KaTeX 解析失败时**原样裸输出**（设计是"绝不吞内容"），但用户看不到视觉信号。
  - **对话气泡样式**：行高紧、无换行、上下内距小，密集公式挤在一起。
- **修复**：
  - **Prompt 层**：`buildFollowupSystemPrompt` 把"公式书写规则"升格为"最高优先级、逐字符保留"，并写**反斜杠绝不能省**专条，给出 `'\frac' 不能写 'rac'`、`'\triangle' 不能写 'riangle'`、`'\sqrt' 不能写 'sqrt'` 的反例，以及"不得简写 `\frac{a}{b}` → `a/b`"的禁令。
  - **渲染层**：`LatexText` KaTeX 失败时把那段包在 `<code class="latex-fallback">` 里——等宽字体 + 浅琥珀背景 + 左侧细色条 + `title="公式源码（未能渲染）"`，给用户明确视觉信号。`textContent` 仍为原文，屏幕阅读器/复制/测试不受影响。
  - **对话气泡样式**：`QASection.tsx` 加 `leading-relaxed`（行高松）、`break-words`（长公式换行）、`whitespace-pre-wrap`（保留换行）、`py-2.5`（上下内距大一点）。
- **坑**：TS 模板字符串里写 `'\frac'`（单引号 + 反斜杠 + frac）时，**JS 把 `\f` 当成 form-feed（ASCII 12）解析**，运行时反斜杠消失——必须用 `'\\frac'`（双反斜杠源）才得到运行时单反斜杠。已写入 MEMORY.md。
- **结果**：模型未来若再吞反斜杠，Prompt 防御 + 视觉信号双保险；用户至少能看出"这是未渲染的公式源码"而不是以为"页面 bug"。
- **影响**：`LatexText` 新增 `latex-fallback` 视觉信号；`QASection` 消息气泡加 `leading-relaxed/break-words/whitespace-pre-wrap/py-2.5`；`buildFollowupSystemPrompt` 升格"反斜杠绝不能省"专条。

### 文件变更
- 修改 `src/components/ui/LatexText.tsx`：KaTeX 失败时包 `<code class="latex-fallback">` 视觉信号
- 修改 `src/modules/search/QASection.tsx`：消息气泡加 `leading-relaxed + break-words + whitespace-pre-wrap + py-2.5`
- 修改 `src/services/baseAIProvider.ts`：`buildFollowupSystemPrompt` 升格"反斜杠绝不能省"专条
- 修改 `src/components/ui/__tests__/latexText.test.tsx`：新增 latex-fallback 契约 2 条
- 修改 `src/services/__tests__/baseAIProvider.test.ts`：新增 followup "反斜杠不能省"契约 1 条

### 构建验证
- TypeScript 类型检查：通过
- 单元测试：通过（**17 文件 / 226 用例全绿**）

### 经验教训
- **"原样输出、绝不吞内容"是兜底安全，但用户要的是"明确信号"**：视觉包裹（`textContent` 仍为原文）不破坏屏幕阅读器/复制/测试，但给用户清晰反馈"这是未渲染的公式源码"，比裸露友好得多。
- **Prompt 防御必须点出"具体怎么错"**：光说"保留反斜杠"模型仍可能犯，给出 `'\frac' → 'rac'` 的具体反例后，模型能看到"这是错的"的具体形态。
- **对话的视觉密度需要单独调**：生成卡片是宽屏区块，行高/间距都好处理；对话气泡是窄列、密集多行，需要 `leading-relaxed + break-words + whitespace-pre-wrap` 组合。
- **模板字符串里写 LaTeX 反例要防"反斜杠被解析"**：源里 `'\frac'` 被 JS 解析成 form-feed（`\f`）+ `rac`，反斜杠消失；必须源里写 `'\\frac'`（双反斜杠）。这与"反引号"陷阱同类——模板字符串里的转义字符会被吃。

## 2026-09-13（所有对话支持公式格式）

### 事件
- **背景**：用户要求"所有对话也要支持公式格式"。
- **根因**：对话（QA 独立问答 + 搜索追问）都经 `QASection.tsx` 渲染，但消息内容用 `{msg.content}` **纯文本裸输出**，没走 `LatexText`，公式（`$...$`、裸 LaTeX）原样露出源码；且 `buildFollowupSystemPrompt` 只写"公式用 LaTeX"、没写 `$...$` 包裹约定。
- **修复（两层，与生成链路对齐）**：
  - **渲染层**：`QASection.tsx` 把 `{msg.content}` 换成 `<LatexText text={msg.content} />`（用户/助手气泡都换）。`QASection` 是所有对话的**唯一渲染入口**（`QAContainer`、`SearchContainer` 都复用它），一处改全覆盖。
  - **Prompt 层**：`buildFollowupSystemPrompt` 的 QA 与 search 两分支都补【公式书写规则】——凡数学符号一律 `$...$` 包裹、中文放 `$...` 外。
- **结果**：对话中的公式（`$F=ma$`、`$60^\circ$`、`$\sqrt{2}$` 及裸 LaTeX）正确渲染，不再露出源码。
- **影响**：`QASection` 引入 `LatexText`；`buildFollowupSystemPrompt` 补公式书写规则；新增契约测试 1 条。

### 文件变更
- 修改 `src/modules/search/QASection.tsx`：消息内容走 `LatexText`
- 修改 `src/services/baseAIProvider.ts`：`buildFollowupSystemPrompt` QA/search 两分支补【公式书写规则】
- 修改 `src/services/__tests__/baseAIProvider.test.ts`：新增 `buildFollowupSystemPrompt` 契约 1 条

### 构建验证
- TypeScript 类型检查：通过（`node ./node_modules/typescript/bin/tsc --noEmit`）
- 单元测试：通过（`node ./node_modules/vitest/vitest.mjs run`，**17 文件 / 223 用例全绿**）

### 经验教训
- **对话是独立的渲染路径，不能只靠生成链路兜底**：`LatexText` 已在 SearchResults 全覆盖，但 `QASection` 是另一条渲染路径、之前漏了。公式支持要"渲染层（LatexText）+ Prompt 层（$...$ 约定）"双保险，且所有含 AI 文本的组件都过同一个 `LatexText` 入口。

## 2026-09-13（修复知识图谱不显示 + 图谱节点带学科分类）

### 事件
- **背景**：用户报障"知识图谱不显示任何内容"，并要求图谱节点带学科分类（category）。
- **根因**：`analyze` 的 prompt 返回 JSON **从未包含 `graphData` 字段**——状态机在 `isSpecific=false`（宽泛学科）时依赖 `analysisResult.graphData` 渲染知识图谱，但模型根本没被要求产出它，`graphData` 永远 undefined → 图谱空白。字段在类型、状态机、UI 三层都备好了，唯独 prompt 这一环漏了，等于"管道通了却没水"。
- **修复**：
  - `KnowledgeGraphNode` 新增 `category?: string`（图谱节点带学科）。
  - `analyze` prompt 新增"第五步·生成知识图谱"：`isSpecific=false && isKnowledgePoint=true` 时产出 2~3 层树，**每个节点带 category**（根节点学科名、分支/叶子继承或填自身子学科）。
  - 新增 `sanitizeGraphData(raw)`：缺 category 从父节点继承、根节点缺 category 用 title 兜底、type 非法回退 concept、缺 title/非对象过滤、非数组返回空。
  - `selectGraphNode` 的 ctx 补 `category: node.category`，图谱节点点击生成时拿到学科走分类驱动。
  - mock `analyze` 新增"宽泛学科"（数学/物理/化学）→ `isSpecific=false` + `graphData`（带 category）。
- **结果**：宽泛学科输入（"数学""物理"）正确展示知识图谱，节点带学科分类，点击叶子节点生成时走对应学科的分类驱动提示词。
- **影响**：`KnowledgeGraphNode` 类型新增 `category`；analyze 返回 `graphData` 经 `sanitizeGraphData` 清洗；mock 补宽泛学科图谱数据。

### 文件变更
- 修改 `src/types/ai.ts`：`KnowledgeGraphNode` 新增 `category`
- 修改 `src/services/baseAIProvider.ts`：analyze prompt 新增"第五步·生成知识图谱" + 新增 `sanitizeGraphData` + analyze 返回清洗 graphData
- 修改 `src/modules/search/useSearchStateMachine.ts`：`selectGraphNode` ctx 补 category
- 修改 `src/services/mockAIService.ts`：mock analyze 新增宽泛学科图谱（带 category）
- 修改 `src/services/__tests__/baseAIProvider.test.ts`：新增 `sanitizeGraphData` 契约 4 条
- 修改 `src/services/__tests__/mockAIService.test.ts`：新增"宽泛学科→图谱"2 条

### 构建验证
- TypeScript 类型检查：通过（`node ./node_modules/typescript/bin/tsc --noEmit`）
- 单元测试：通过（`node ./node_modules/vitest/vitest.mjs run`，**17 文件 / 222 用例全绿**）

### 经验教训
- **prompt 要求产出的字段，后端必须真的消费它**：`graphData` 在类型/状态机/UI 三层都备好了，唯独 prompt 没让模型产出，就是静默空白。字段从 prompt → 类型 → 清洗 → 状态机 → UI 必须全链路闭环，缺一环就表现为"不显示任何内容"。

## 2026-09-13（分类驱动生成 + 历史命中时机修正 + 收藏/导出适配 + 语言适配排查）

### 事件
- **背景**：用户提出五点：①"有意义的非知识点"判定能否更简化；② category 分类要进一步**驱动生成提示词**；③ 搜索模式当前以**原始输入查历史**（不适配应用设计），应改为**AI 分析出知识点后再查历史**；④ 复制/导出/收藏需适配新内容格式；⑤ 排查用户语言适配。
- **根因**：
  - ① 非知识点判定用"逐类枚举"（热梗/角色名/游戏设定/口语），开放枚举永远列不完；
  - ② `category`/`knowledgeType` 只产出不消费，`buildGeneratePrompt` 不看分类，所有学科共用同一套 SVG/内容规范；
  - ③ `handleSearch` 用原始 `searchQuery` 调 `getSearchSession`，但历史是按 `canonicalTopic`（归一化主题）存的，二者常不一致导致查不到已生成的会话、重复生成；
  - ④ `handleToggleFavorite` 把 `GeneratedKnowledge` 压成旧的 `KnowledgeCardData`，丢失 summary/mindMap/examQuestions 等字段；导出文件名用 `title` 而非 `topic` 导致新格式导出文件名回退成默认；
  - ⑤ `analyze`/`validate` 未绑定输出语言；`genericProvider.ts` 的 `SILICONFLOW_PREFIX` 硬编码"用中文回答"，与 `buildLanguageDirective` 冲突。
- **修复（五处）**：
  - **① 非知识点判定简化**：把"四类枚举"收敛为**一条闭合标准**——"只有确信输入指向能讲出知识体系的学科主题才判 true，拿不准一律判 false 走问答"，覆盖一切"有意义但非知识点"的输入，无需逐个识别类型；false 例子保留但作为"举例"而非"分类清单"。
  - **② category 驱动生成**：新增 `buildCategoryDirective(category, knowledgeType)`，按学科注入「学科专属规范」（数学符号、物理方向性/受力·电路·光学、化学键角/装置、生物过程/层级、文史社科时间线/比较、计算机算法/层级），**只注入与当前主题相关的那一块**；交叉学科（生物化学/物理化学等）与"其他"不注入单一学科规则、只给通用归类提醒。`generate`/`generateStream` 签名新增 `context?: SearchAnalyzeResponse`，状态机把 `analysisResult` 透传进 `runGenerate`。
  - **③ 历史命中时机修正**：状态机新增 `findExistingSession` 选项，在 analyze 得出 `canonicalTopic` 后、生成前查历史；命中则直接恢复、跳过重新生成。`index.tsx` 的 `handleSearch` 移除原始输入预查历史。
  - **④ 收藏/导出适配**：`handleToggleFavorite` 直接收藏 `GeneratedKnowledge`（不再压缩成旧 card）；`FavoriteContent`/`favorites/index.tsx` 渲染新格式（topic/summary/concepts/mindMap/examQuestions/interestingFacts），旧格式兜底；`showFavorite` 恢复新格式 `generatedData`；`export.ts` 导出文件名改用 `topic`。
  - **⑤ 语言适配**：`analyze`/`validate` 的 systemPrompt 补 `buildLanguageDirective()`；analyze 补"category/canonicalTopic 用用户语言"；`SILICONFLOW_PREFIX` 去掉硬编码"用中文回答"，改为语言中立。
- **结果**：非知识点判定更稳健（闭合标准而非枚举）；生成提示词按学科定制（交叉学科不串味）；历史命中用归一化主题、不重复生成；收藏/导出保留完整新内容；语言绑定统一。
- **影响**：`AIService` 接口 `generate`/`generateStream` 新增可选 `context` 参数（mock 同步）；`useSearchStateMachine` 新增 `findExistingSession` 选项；收藏 knowledge 数据从旧 card 迁到 `GeneratedKnowledge`（旧数据兜底读取）。

### 文件变更
- 修改 `src/types/ai.ts`：`generateStream` 签名新增 `context?: SearchAnalyzeResponse`
- 修改 `src/services/baseAIProvider.ts`：新增 `buildCategoryDirective`；`buildGeneratePrompt(topic, context)`；analyze/validate 绑定语言 + 非知识点判定简化 + category 语言说明
- 修改 `src/services/providers/genericProvider.ts`：`SILICONFLOW_PREFIX` 去硬编码中文
- 修改 `src/services/mockAIService.ts`：`generate`/`generateStream` 签名同步 context
- 修改 `src/modules/search/useSearchStateMachine.ts`：`runGenerate(topic, context)` + `findExistingSession` 选项 + search 流程历史命中
- 修改 `src/modules/search/index.tsx`：`handleSearch` 移除原始输入预查 + 传入 `findExistingSession` + `showFavorite` 恢复新格式
- 修改 `src/modules/search/components/SearchContainer.tsx`：`handleToggleFavorite` 收藏 GeneratedKnowledge
- 修改 `src/modules/favorites/FavoriteContent.tsx`、`index.tsx`：渲染新格式 GeneratedKnowledge（旧格式兜底）
- 修改 `src/i18n/strings/misc.ts`：favorites 新增 coreConcepts/mindMap/examQuestions/answer/interestingFacts
- 修改 `src/utils/export.ts`：导出文件名兼容 `topic`
- 修改 `src/services/__tests__/baseAIProvider.test.ts`：新增 `buildCategoryDirective` 契约测试 4 条

### 构建验证
- TypeScript 类型检查：通过（`node ./node_modules/typescript/bin/tsc --noEmit`）
- 单元测试：通过（`node ./node_modules/vitest/vitest.mjs run`，**17 文件 / 216 用例全绿**）

### 经验教训
- **分类结果要"驱动下游"，否则只是摆设**：`category`/`knowledgeType` 之前只产出、不消费，等于白分类。真正价值在于让它**定制生成提示词**（按学科注入专属制图/内容规范），且"只注入相关的一块"，呼应"避免无关内容干扰 AI"。
- **关键词匹配分类要防"包含误判"**：`includes` 匹配会让"生物化学"命中"化学"、"物理化学"命中"物理"。交叉学科合成词必须先于单一学科关键词判定，否则交叉学科会被错误套上单一学科规则。
- **历史命中要用"归一化后的键"**：原始输入与归一化主题常不一致，用原始输入查历史必然漏命中。正确时机是"analyze 出 canonicalTopic 后再查"。
- **数据迁移要"新格式优先、旧格式兜底"**：收藏从旧 card 迁到 GeneratedKnowledge 时，读取端要同时兼容两种结构（`topic` 与 `title`、`summary` 与 `definition`），否则历史收藏会渲染空白。

## 2026-09-13（意图识别增强：输入"分门别类" + 非知识点统一走问答 + 校验放宽）

### 事件
- **背景**：用户要求把"分门别类"拓展到整体——增强 AI 处理用户输入的能力：① `category` 分类要覆盖**交叉学科**（分子物理、生物化学等），也不局限"学科"，常见但不便归类的知识归"**其他**"类；② 一般的用户输入都是有效信息（网络热梗、作品角色名、游戏设定等应切到**问答模式**），**只有乱敲的字符才拦截**。
- **根因**：① `analyze` 的 `category` 只有"物理/数学/生物"几个例子、无枚举清单、无"其他"兜底、无交叉学科规则；② `isKnowledgePoint` 判定偏粗，未把"热梗/角色名/游戏设定"纳入 false 的判定范围，可能被误判成知识点去生成；③ `validate` 的判定过严，可能把角色名/口语表达误拦。
- **修复（三处）**：
  - **`analyze` prompt 增强**：① `isKnowledgePoint=false` 明确纳入四类"有意义的非知识点"（网络热梗/流行语、作品角色名/人名、游戏设定/虚构世界观、口语闲聊情绪表达），并写"拿不准就判 false 走问答，损失最小"；② 新增"第四步·分门别类"——给出**推荐学科清单**（数学/物理/化学/生物/地理/历史/语文/英语/政治/经济/计算机/艺术/体育/心理/社会/医学/天文/环境），**交叉学科取交叉归属**（生物化学、物理化学等，拿不准主次时主导学科在前），**常见但不便归类的知识归"其他"**；③ `category` 在非知识点时填"问答"。
  - **`validate` prompt 放宽**：从"判断是否为有效知识查询"改为"**只拦截乱敲的无意义输入**"——纯随机字符/键盘乱按/纯表情才判无效；口语、单字、单关键词、角色名、热梗等一切有意义输入都放行；"拿不准一律 valid=true"。
  - **mock `analyze` 同步**：非知识点正则补"是什么梗/什么梗/出自哪/的原型"等，让角色名、热梗在 mock 下也正确走问答（游戏设定等无法用正则可靠判定的，交由真实 AI 理解，mock 不强求）。
- **结果**：有意义的非知识点输入（角色名/热梗/游戏设定）正确切到问答模式而非误生成知识卡片；学科分类更完整、覆盖交叉学科与"其他"兜底；乱敲之外几乎不再误拦。
- **影响**：仅改 prompt 文案与 mock 正则，无接口/数据结构变更（`category` 本就是自由字符串字段，沿既有收藏/详情展示链路流转）；`mockAIService.test.ts` 新增 2 条非知识点用例。

### 文件变更
- 修改 `src/services/baseAIProvider.ts`：`analyze` prompt 增强（意图判定补四类非知识点 + 新增"分门别类"步骤 + 推荐学科清单 + 交叉学科 + "其他"兜底）、`validate` prompt 放宽（只拦乱敲）
- 修改 `src/services/mockAIService.ts`：非知识点正则补"是什么梗/什么梗/出自哪/的原型"
- 修改 `src/services/__tests__/mockAIService.test.ts`：新增 2 条非知识点用例（"林黛玉是谁""抽象是什么梗"）

### 构建验证
- TypeScript 类型检查：通过（`node ./node_modules/typescript/bin/tsc --noEmit`）
- 单元测试：通过（`node ./node_modules/vitest/vitest.mjs run`，**17 文件 / 212 用例全绿**）

### 关联文档
- 更新 `docs/lessons/logic.md`：新增"输入分门别类与意图判定"教训
- 更新 `docs/lessons/index.md`：新增标签 + 近期教训
- 更新 `docs/worklog.md`：记录本次意图识别增强

### 经验教训
- **意图判定要"拿不准就降级到损失最小的分支"**：把输入判成知识点、结果生成出一堆不相干的知识卡片，比判成问答、让用户多问一句的代价大得多。所以非知识点判定要放宽（纳入角色名/热梗/游戏设定），且"拿不准就判 false 走问答"。
- **分类体系要"开放 + 兜底"，不要"封闭枚举"**：学科分类天然开放，硬定义枚举会漏掉交叉学科和杂项。正确做法是给"推荐清单"引导 + "交叉学科取交叉归属"规则 + "其他"兜底，而不是穷举。
- **校验要"从宽"，拦截要"从窄"**：绝大多数输入都是有意义的，校验层只应拦截真正的乱敲（随机字符/键盘乱按/纯表情），拿不准就放行交给下游意图识别。误拦比误放的体验伤害更大。
- **mock 正则只能近似，无法复现"语义理解"**：mock 用正则模拟真实 LLM 的意图判定，只能覆盖"能用正则可靠判定的"（角色名"X是谁"、热梗"X是什么梗"）；"游戏设定"这类依赖语义理解的，正则做不到，应交由真实 AI，mock 不强求、测试也不要硬写会失败的正则用例。

## 2026-09-13（提示词治理进阶：限制处补"应该怎么做" + 画图自检清单 + 沉淀技能）

### 事件
- **背景**：用户以"专业设计师"视角对 `baseAIProvider.ts` 优化计划提出三点：① 提示词里强调限制的地方，**尽可能补充"应该怎么做"**，除非是简单明确的禁令；② 给出推荐的语法分档（"……必须……""否则……""……应该……""而不是/不要/严禁……""……仅当/只有/只许……"），并指出**这套可提炼成一个提示词技能**；③ 强调 AI 自己画图后**应当检查关键点**，因为当前 AI 不主动检查。
- **根因**：① 大量限制句只写禁令、不写正向替代（"不要编造 URL""不编造""不得硬填一个无关的图"），模型缺少可执行动作；② LLM 生成即输出、**不会主动回溯核对**，SVG 常出现"顶点没闭合 / 标记标错位 / 数值与题干不符"的错图。
- **修复（三档语法 + 自检）**：
  - **简单禁令保持原样**（`禁止 <script>`、`只返回 JSON 本身`、"直角不要画成弧"、`sourceLang` 只用代码等）—— 不补长解释。
  - **"限制处缺怎么做"补正向动作**，用"**应该 X，而不是 Y**"对照：`不要编造 URL`→`拿不准时应该留空字符串（交给 imageQuery 兜底检索），而不是编造 URL`；`不编造`→`不确定处应该明确说明存疑，而不是编造`；`不得硬填一个无关的图`→`应该改用 imageData 或 SVG 表达，而不是硬填一个无关的图`；`必须只用行内公式`→`只许用行内公式 $...$，而不是 $$ 或 \[ \]`；`来源必须真实`补"应该只填能确定的，否则（查不到）必须填空字符串"。
  - **SVG 硬性要求改写 + 新增【画完自检】**：硬性要求里"必须输出完整 <svg>""只许使用基础元素，严禁混入 <script>/事件属性""线条必须细""配色应该深线浅填充""文字标签应该用字母数字而不是中文"；末尾新增 6 条自检清单（关键点闭合 / 标记对号 / 数值一致 / 符号规范 / 没有多余元素 / 发现对不上必须重画而不是带错输出）。
- **同日补充（自检项补"检查方法"）**：用户指出自检清单"缺乏'怎么做'的说明"——只写"检查什么"（"点是否画对""元件是否连上"），没写"怎么检查"。→ 自检清单从 6 条扩为 8 条，**每条都带"检查方法"**：①点是否画在线上 → 把点坐标代入它应在的线/圆方程看是否成立；②函数图象是否过对点、是否在对象限 → 把题干坐标代入函数式 + 对照斜率/二次项符号判断开口与象限；③元件是否真正连进电路 → 沿电流路径从正极走一遍回路，看能否流经每个元件再回负极；④标记对号、⑤数值一致、⑥符号规范、⑦没有多余元素、⑧发现对不上必须重画。
- **同日再修正（数值表述 + 字母代号位置）**：用户再指出两点——①"题干说 60°、图上就不能画成 30°"表述不准，应为"**题干说 60°，图上就必须看起来是 60°、不能画成 30° 的样子**"；②**边、角、物理量、元件的字母代号也必须检查是否在合适位置**（角的字母代号不能写到边中间，这是高频错位点）。→ 自检清单新增"字母代号的位置是否正确"一条（角的字母写顶点旁/边的字母写边中点旁/力的符号标箭头旁/元件代号标元件旁/x·y·O 各归其位），并把几何画法段、受力分析段、电路段、函数图象段的代号位置规范在**源头**就写清，避免画的时候就错位。
- **同日再拆分（自检按学科拆分 + 避免无关内容干扰）**：用户明确要求"必须拆分，让 AI 去看高度相关的内容"，并提出项目应明确"**避免无关内容干扰 AI 的判断**"。→ 自检清单从 9 条平铺改为「**通用自检（任何图必查：字母代号位置 / 数值一致 / 没有多余元素 / 发现对不上重画）+ 分学科自检（几何 / 函数 / 电路 / 受力 / 光学，各只查当前那类）**」，开头显式写"**先判断这张图属于哪一类，只套用对应类别的自检项；无关类别的条目不要套用、不要去想**"。同时把"标记对号""符号规范"等归属到对应学科段（几何的直角/等长边/平行标记归几何、力的方向归受力、法线角度归光学），消除了原来"函数图却要查几何标记"的错位。
- **结果**：每处限制要么保持简洁禁令、要么补正向动作，模型有了明确执行路径；SVG 输出从"画完就交"变为"画完先自查再交"，错图率预期下降。
- **影响**：仅改 prompt 文案，无逻辑/接口变更；`baseAIProvider.test.ts` 契约断言未受影响（本轮未新增 `toContain` 断言的子串破坏）。

### 文件变更
- 修改 `src/services/baseAIProvider.ts`：`buildGeneratePrompt`（严谨性铁律④ / 公式规则 / image / imageData / SVG 硬性要求 / 新增【画完自检】）、`buildFollowupSystemPrompt`（问答五条）、查词 prompt（image 规则）补正向动作与自检
- 新增 `.workbuddy/skills/llm-prompt-writing/SKILL.md`（项目级）：沉淀"LLM 提示词写作与治理"技能（语法分档 / 自检清单 / 反例通常化 / 模板字符串安全）

### 构建验证
- TypeScript 类型检查：通过（`node ./node_modules/typescript/bin/tsc --noEmit`）
- 单元测试：通过（`node ./node_modules/vitest/vitest.mjs run`，**17 文件 / 210 用例全绿**）

### 关联文档
- 更新 `docs/lessons/logic.md`：新增"约束补全：限制处要补'应该怎么做'，并显式要求 AI 自检"
- 更新 `docs/lessons/index.md`：新增标签 + 统计（逻辑 15 / 总计 22）+ 2026-09-13 近期教训
- 更新 `docs/issues.md`：新增已解决条目
- 更新 `docs/worklog.md`：记录本次 prompt 治理

### 经验教训
- **禁令与动作要配对**：一句"不要 X"如果不跟"应该 Y"，模型只能靠猜；把"应该 Y，而不是 X"写全，模型才有可执行路径。这比上一条"按复杂度分档"更进一步——前者管"要不要改写句式"，这条管"补不补正向动作"。
- **自检不是 LLM 的默认行为**：模型生成即输出、不会回溯核对，必须显式下达"输出前必须逐条核对"的清单，且检查项要**可判定、可对号**（"数值一致""标记对号"），而不是"请确保正确"这类空话。结尾还要写"发现对不上必须重做，而不是带错输出"。
- **自检项本身要带"检查方法"**：只写"检查什么"（"点是否画对""元件是否连上"）不够——AI 仍只会凭印象扫一眼、继续漏错；每条必须写"**怎么检查**"（"把点坐标代入它应在的线/圆方程看是否成立""沿电流路径从正极走一遍回路"）。这跟"禁令要配正向动作"是同一条原则：**自检项也是一种'约束'，同样要给可执行动作**。
- **字母代号的位置是高频错位点，要单独检查 + 源头就讲清**：角的字母写边中间、边长代号写顶点、力的符号落到别的力上、元件代号标到别的元件旁，都是 AI 画图的常见错误。自检清单要**单独列"字母代号位置"一条**（逐个字母问"它代表哪个对象、是否紧邻该对象"），且几何/受力/电路/函数各段的绘图步骤里要**在源头写清代号该放哪**，不能只靠事后检查兜底。
- **数值一致要写"看起来像"而非"精确度数"**："60° 不能画成 30°"是绝对化、难执行的表述；"60° 就必须看起来是 60°、不能画成 30° 的样子"才是 AI 能对照执行的——图是示意、不是精确量角，要求的是"视觉上对得上"，而不是"角度精确等于"。
- **同一 prompt 里互不相关的大段规则要按"相关性"拆分**：一长串混合自检清单（几何+函数+电路+受力+光学）会让 AI 串味，函数图去套几何标记的检查。必须拆成"通用（必查）+ 分场景（只查当前那类）"，并显式写"无关条目不要套用、不要去想"——这就是项目要求"**避免无关内容干扰 AI 判断**"的落点。
- **可复用的提示词方法论应沉淀为技能**：语法分档 + 自检清单 + 反例通常化 + 模板字符串安全，是一套跨项目通用的 prompt 工程方法，固化为 `llm-prompt-writing` 技能便于复用。

## 2026-09-12（提示词句式治理：负面约束全面改为"必须……否则……" + 反例措辞具体化）

### 事件
- **背景**：承接当日「多厂商思考适配 + AI 内容质量」条目。用户审阅 `buildGeneratePrompt` 后提出三点要求：①第 1234 行"不能'答案写 9W、解析算出 8W'这种自相矛盾"的反例，改用"不能'答案是 1、解析是 2'"这类更**通常**的解释；②第 1236 行"绝不编造"改为"确保真实"；③**把所有"不要……"式约束改成"必须……否则……"句式**——AI 更懂"该怎么做"，并明确【含"如图"】试题必须用原图/可信链接/精确 SVG，否则舍弃或改写，**改写必须注明"xx年xx考试改编"**。
- **根因**：prompt 中大量约束是**否定式**（"不要画成弧""交叉处不要画实心点""禁止 <script>""不要任何前后解释""不要省略字段"）——只声明"不许做什么"，模型缺少可执行动作，遇到未列举情形即自由发挥；且反例用具体数值（9W/8W）覆盖面窄，无法迁移到相似题型。
- **修复（prompt 句式系统性改写）**：
  - **统一句式为"必须 X（正向动作），否则 Y（违规后果）"**，逐条覆盖四个 prompt：
    1. `buildGeneratePrompt`：开头严谨性说明、【严谨性铁律】4 条、【含"如图"的试题约束】、【公式书写规则】、【输出顺序】、conceptsOverview、【试题配图规则】、【image 字段】、【imageData 字段】、【imageQuery】、SVG 通用画法 / 几何直角 / 电路导线 / 绘制硬性要求（含安全限制与"画不准"条款）、【输出格式】注意事项。
    2. `buildContinuationSystemPrompt`（超限续写）：不重复、不加围栏、延续原格式三条。
    3. `buildFollowupSystemPrompt`（搜索追问 / 问答）：先结论后解释、内容准确、条理清晰、类比举例、长度适配五条。
    4. 翻译/查词 prompt：语言检测（不翻译改写）、`sourceLang` 只用语言代码、`image` 直链填写规则。
  - **反例措辞具体化且更具迁移性**：严谨性铁律第 2 条反例改为"例如答案是 $1$，解析就必须推导出 $1$；若解析算出 $2$……必须重新推导到两者一致，否则必须放弃这道题"。
  - **"绝不编造"→"来源必须真实"**：第 4 条改为"年份/考试名/卷别、图片链接、base64 图片数据**必须真实可查**——能确定就填，查不到就填空字符串，否则不得填写任何推测内容"。
  - **【含"如图"】强制兜底**：重写为"**必须**为该题配图，按 imageData > image > svg 顺序取用，**必须至少满足其一**；否则**必须**舍弃该题，或改写为纯文字可作答的等价题型，并**必须**在题干末尾注明'（xxxx年xx考试改编）'"。
  - **输出格式**：明确"不得用 markdown 代码块包裹，否则解析会失败""不得出现真实换行符，否则 JSON 会解析失败""必须保留全部字段，否则页面会缺块"。
- **结果**：prompt 从"列禁止项"转为"给动作 + 讲代价"，模型在每个约束点都有明确的正向执行路径；反例可迁移到同类题型；含图试题不再出现"无图硬答"。
- **影响**：仅改 prompt 文案，无逻辑/接口变更；`baseAIProvider.test.ts` 中 4 条断言随新措辞更新（保持原校验意图：图源白名单、禁止伪造 base64、严谨性铁律、含图试题约束）。

### 文件变更
- 修改 `src/services/baseAIProvider.ts`：`buildGeneratePrompt` 全篇否定式约束 → "必须……否则……"；`buildContinuationSystemPrompt` / `buildFollowupSystemPrompt` / `callModelWithJSON` 约束句 / 翻译·查词 prompt 同步改写；反例措辞具体化、④条改"来源必须真实"、【含"如图"】重写
- 修改 `src/services/__tests__/baseAIProvider.test.ts`：4 条提示词契约断言对齐新措辞（`必须**只填下列**可信图源域名`、`会在后台校验中被丢弃`、`解析必须与答案一致` + `必须放弃这道题`、`必须**至少满足其一` + `考试改编`）

### 构建验证
- TypeScript 类型检查：通过（`node ./node_modules/typescript/bin/tsc --noEmit`）
- 单元测试：通过（`node ./node_modules/vitest/vitest.mjs run`，**17 文件 / 210 用例全绿**）

### 关联文档
- 更新 `docs/issues.md`：新增 3 条已解决（否定式约束句式治理、反例措辞与来源表述、含"如图"强制兜底）
- 更新 `docs/lessons/logic.md`：新增"提示词句式：用'必须……否则……'代替'不要……'"
- 更新 `docs/lessons/index.md`：新增标签与近期教训
- 更新 `docs/worklog.md`：记录本次 prompt 治理

### 经验教训
- **AI 需要"指令"而非"禁令"**：否定式约束（"不要 X"）没有给出可执行动作，模型遇到边界情形只能自由发挥；"**必须 X，否则 Y**"同时给出目标动作与违规代价，遵循率显著更高。这条与"负面限制不如正向教学"同源，但作用在**句式**层：前者教"画什么"，后者教"怎么说"。
- **反例要"典型"不要"具体"**：用"9W/8W"这类具体数值，模型只记住这一个特例；改用"答案是 1、解析却是 2"这类跨题型都成立的**通常**表述，才能覆盖同类错误。
- **约束要写"正向目标"而非"禁止行为"**："绝不编造"→"来源必须真实（能确定才填，否则空字符串）"，模型才知道"合规输出长什么样"。

### 修正（同日复核：收窄适用边界）
- **用户反馈**：第一轮把**每一条**否定式约束都改写成"必须……否则……"属于**过度改写、生搬硬套句式**（点名的例子是"禁止 `<script>`"→"必须不使用 `<script>`…；否则图形会被渲染器拦截而完全不显示"）。用户明确边界：**这类句式改写只适用于"在什么……的条件下"或"……不要做……"这类过于复杂的描述**；简短明确的规则"不改才是最好的，过多解释反而不好"。
- **修正动作（还原 + 收窄）**：
  - **还原为原样**（短小明确、加解释即噪声）：SVG 安全限制（`禁止 <script>、事件属性、外部图片引用、<use>、url(http...)`）、文字标签规则、"画不准就空字符串"、直角符号、"输出格式"注意事项 3 条、【输出顺序】的追加解释、`callModelWithJSON` 的 JSON 约束句、续写要求 1·2、追问 prompt 五条、【image 字段】"Commons 里没有"段、翻译检测 system prompt、`sourceLang` 语言代码、查词 `image` 直链规则。
  - **保留改写**（条件句 / 多重禁止，原本难读）：续写要求 3（"如果前面是 JSON……不要重新开始一个新的 JSON"）、电路导线（"交叉处若非连接点……"）、严谨性铁律 4 条、含"如图"试题约束、`imageData` 纯文本模型说明。
  - **同步撤销**上一轮为此添加到提示词里的"否则…"长解释（如"否则页面区块会错位""否则读者会看到与题目不符的配图""否则源语言判断会被干扰"等）。
- **结论**：句式改写的价值在**消歧**，不在"统一口径"。规则本身是否复杂才是判断依据。
- **经验教训（补充）**：**不要把"用户偏好的句式"当成"必须全量套用的模板"** —— 偏好是**适用条件**，不是**覆盖率指标**；遇到"这条很简短、改了只是换皮"的情形应当保留原样并说明，而不是为凑统一而改写。

## 2026-09-12（流式链路健壮性治理：首字节超时 + 移除黑名单 + 续写边界 + 空结果兜底）

### 事件
- **背景**：用户实测截图显示搜索页卡在「模型正在思考…已等待 511 秒」——光圈仍转、却永远没有下文。由此逐层排查，先后暴露并修复了 4 类相互独立的链路漏洞。
- **根因与修复**：
  1. **首字节无超时兜底**：`sseReader.readSSEStream` 与 `callModelStream` 全链路没有任何 `setTimeout` 主动 abort；`AbortController` 只可能由用户手动取消触发，`WaitTimer` 只是个 UI 秒表、不触发任何兜底。→ `readSSEStream` 新增 `firstByteTimeoutMs`（默认 60s）与 `StreamTimeoutError`：到点主动 `reader.cancel()` 抛错；**已收到任意字节（含思维链）立即 `clearTimeout`**，避免误杀慢速流；`=0` 表示禁用。`baseAIProvider` 导出 `FIRST_BYTE_TIMEOUT_MS=60_000` 并透传。
  2. **"黑名单-自愈"隐式全局状态脆弱**：`streamUnsupported` Map + 冷却计时是运行时猜测，分支语义微妙、无法推理。用户明确诉求"流式是增强项不是硬性要求，别猜、别打补丁，拿到什么链路状态就诚实处理什么"。→ **整套删除**，`wantStream = stream && caps.streaming`（只信静态能力声明）。链路状态诚实处理：传输层失败 / SSE 协议失败 / 首字节超时一律**抛错透传、不再降级重发**（重发=让用户白等一轮）；收到增量立即 `onDelta` 实时渲染。
  3. **`withFallback` 是"吞错器"（深层坑）**：任何异常都被转成空结构体 + `success:true`，导致上一版在状态机里写的 `StreamTimeoutError` 识别**根本走不到**（死代码），用户只看到笼统"生成失败"。→ `withFallback` 识别 `StreamTimeoutError`/`StreamProtocolError`，以 `success:false + code(STREAM_TIMEOUT/STREAM_PROTOCOL) + retryable:true` **透传**给 UI；状态机新增 `toFriendlyError(code, msg)` 统一映射为友好文案（"等待模型响应超时，请检查网络或尝试其他模型"）。
  4. **续写判定两处边界 + 一处重复实现**：① `hasCompleteJSONObject` 只跟踪 `{}` 不跟踪 `[]`，`{"a":[1,2}` 这类数组未闭合被 `}` 让花括号归零而误判"完整" → 跳过续写、半截收尾；② 续写轮返回空内容会空转浪费次数、续写轮抛链路错误会让异常冒泡丢弃已生成尾巴；③ 该函数与 `StreamingJSONParser.scan()` 是两套重复括号配对逻辑，必然漂移。→ 导出 `scan` 并新增 `isCompleteJSON(raw)` / `analyzeJSON(raw)`（返回 `{complete, completedKeys}`）作为权威判定，`hasCompleteJSONObject` 改为一行 `return isCompleteJSON(raw)`；新增 `buildGenerateCompleteChecker()`，search 续写判定升级为「括号闭合 **且** 核心字段齐全」（`mindMap`/`concepts`/`knowledgeContext`/`examQuestions`/`interestingFacts`），防止模型输出"括号闭合但缺末尾区块"就收尾；续写轮空内容即 break、续写轮异常 catch 保留已累积内容（首轮异常仍上抛）。
  5. **空结果 → 页面空白**：`hasUsableContent` 只认 `summary`/`mindMap`/`concepts` 三者，模型若只产出 `knowledgeContext`/`examQuestions`/`interestingFacts`（前三者恰好为空）被误判"无内容" → `IDLE` → 渲染层只剩一条红字 + 大块空白。→ `hasUsableContent` 扩展覆盖全部实质字段（含 `knowledgeContext` 各子字段）；`runGenerate` 全空分支显式写 `error=generateFailed`（不再依赖上游兜底）；`SearchContainer` 新增带图标的失败空状态卡片（`errors.generateFailedEmpty`）。
- **结果**：① 卡死有上限——最多 60s 自动 abort 并给出可操作提示，用户可立即重试或换模型；② 链路错误不再是笼统"生成失败"，而是具体原因透传；③ 超限续写不再半截收尾、不空转、不丢尾巴，且与解析层同源；④ 无内容时给明确失败空状态，不再是一片空白。
- **影响**：移除黑名单后无需运行时状态，行为更可预测；`RequestMeta.caps` 死字段一并删除；状态机 `IDLE` 分支补 `thinking:false`（此前不清会让等待秒表继续转）。
- **反思**：**"吞错器"比"不处理错误"更危险** —— 它让下游的错误识别变成永远走不到的死代码，且症状（笼统失败）与原因（链路超时）距离极远。**同一语义不要有两套实现** —— 续写判定与解析层的括号配对双写，先出现"漏判 `[]`"的边界 bug，最终只能靠"同源复用"根治。**静默降级是排查黑洞**：凡行为随运行时状态变化的分支都要留可观测信号。

### 文件变更
- 修改 `src/services/streaming/sseReader.ts`：新增 `firstByteTimeoutMs` 参数（默认 60s）+ `StreamTimeoutError`；收到任意字节后 `clearTimeout`
- 修改 `src/services/streaming/partialJSON.ts`：导出 `scan`；新增 `isCompleteJSON(raw)` 与 `analyzeJSON(raw)`（`{complete, completedKeys}`）
- 修改 `src/services/baseAIProvider.ts`：导出 `FIRST_BYTE_TIMEOUT_MS`；**删除** `streamUnsupported` Map / `markStreamUnsupported` / `markStreamSupported` / `isStreamPossiblySupported` / `resetStreamSupportCache` / `STREAM_RETRY_COOLDOWN_MS`；`wantStream` 只信 `caps.streaming`；`callModelStream` 链路失败抛错不重发；`withFallback` 透传链路错误（`STREAM_TIMEOUT`/`STREAM_PROTOCOL`）；`hasCompleteJSONObject` 复用 `isCompleteJSON`；新增 `buildGenerateCompleteChecker()`；`callModelStreamWithContinuation` 补续写轮边界；删除 `RequestMeta.caps` 死字段
- 修改 `src/modules/search/useSearchStateMachine.ts`：新增 `toFriendlyError`；`hasUsableContent` 覆盖全部实质字段；全空分支显式写 error 并清 `thinking`
- 修改 `src/modules/search/SearchResults.tsx`：`WaitTimer` ≥30s 切加重提示（`waitingSlow`）
- 修改 `src/modules/search/components/SearchContainer.tsx`：`state===IDLE && error && !generatedData` 渲染失败空状态卡片
- 修改 `src/modules/doc/index.tsx`：catch 识别链路错误并 `setError`
- 修改 `src/i18n/strings/search.ts`：新增 `waitingSlow` / `errors.firstByteTimeout` / `errors.generateFailedEmpty`（中英同步）
- 新增 `src/services/streaming/__tests__/sseReaderTimeout.test.ts`（4 条）；重写 `src/services/__tests__/streamFallback.test.ts`（链路错误透传 5 条）；`src/services/__tests__/continuation.test.ts`（+10）；`src/services/streaming/__tests__/partialJSON.test.ts`（+3）；`src/modules/search/__tests__/useSearchStateMachine.test.tsx`（+3）

### 构建验证
- TypeScript 类型检查：通过（`node ./node_modules/typescript/bin/tsc --noEmit`）
- 单元测试：通过（`node ./node_modules/vitest/vitest.mjs run`，**17 文件 / 203 用例全绿**）

### 关联文档
- 更新 `docs/design.md`：§10.2 流式调用改为"链路状态诚实处理"、§10.3 补续写边界与同源判定、§10.4 空结果判定扩展
- 更新 `docs/progress.md`：里程碑 m025 + 流式时序与降级策略区块
- 更新 `docs/issues.md`：新增已解决条目
- 更新 `docs/worklog.md`：记录本次 Bug 修复 + 重构 + 测试
- 更新 `docs/architecture.md`：§11.3 调用链（删"5s 超时"、区分业务/链路异常）、§11.4 错误处理表、§15.2 改写为"链路状态处理"（标注黑名单已移除）、§15.3 续写判定同源化

### 经验教训
- **"吞错器"会让下游的错误处理成为死代码**：`withFallback` 把链路异常吞成 `success:true` 的空结构体，导致状态机里的超时识别永远不触发；修复必须先解开这一层，否则改了也白改。
- **同一语义必须单一实现**：`hasCompleteJSONObject` 与 `scan()` 双写括号配对，先漏判 `[]`，后靠复用根治。凡"解析/完整性判定"都应指向同一权威实现。
- **降级要收敛到"证据"层**：只有协议层明确失败才算失败；"收到思维链但正文未到"证明服务端在流式，不能据此降级。
- **超时兜底必须有、且只算"未收到任何字节"**：一旦收到过任意字节就应 `clearTimeout`，否则慢速长内容会被误杀。

---

## 2026-09-12（多厂商思考适配 + AI 内容质量：智谱生成失败 / 编造答案 / 配图教学）

### 事件
- **背景**：用户连续反馈三个问题：①"智谱模型很多时候没有内容渲染、总是生成失败，千问正常"；②截图显示模型**编造答案**（电路题答案写 9W、解析算出 8W，自相矛盾）；③几何题**缺图**（题干"如图"却无图，解析里模型自我怀疑"改原题更可能问的是另一角"）。随后用户进一步指出"本项目根本没用多模态能力"是误判，明确要求加强 SVG 生图提示词（教模型怎么画对）并强化公开图源引用。
- **根因（逐项核对官方文档定位）**：
  1. **智谱 GLM-5.2 默认开启深度思考**（`thinking` 默认 enabled、`reasoning_effort` 默认 max），先吐大段 `reasoning_content`；智谱 `max_tokens` 是**思维链+正文总预算**，思维链吃掉预算后正文 JSON 被 `finish_reason=length` 截断 → 续写也失败 → "生成失败"。千问正常是因为 `THINKING_PARAM_PROVIDERS` 只含 dashscope/siliconflow 且发 `enable_thinking:false`，而**智谱不在名单、且关闭思考的参数名不同**（智谱是 `thinking:{type:'disabled'}`，**传 `thinking:false` 会 400**）。
  2. **prompt 只说"准确性>完整性"，没有可执行判断标准**，模型不会自动推导出"答案与解析须自洽""不确定就不出题"。且 prompt 让模型"能直接给图片数据时填 base64"，而纯文本模型**看不到任何原图**，只能凭文字描述想象图形作作答 → 答案易错且无图。
  3. **SVG 规则全是负面限制**（"只能画什么""画不准就空字符串"），没有任何**正向的可执行绘图步骤**；`image` 字段说明过保守（"拿不准就空字符串"），模型倾向不给公开图源直链。
- **修复**：
  - **多厂商思考开关分派**：`THINKING_PARAM_PROVIDERS`（Set，只能发单一 `enable_thinking`）改为 `DISABLE_THINKING_PARAMS`（`Record<厂商, 参数对象>`）：dashscope/siliconflow → `enable_thinking:false`；**zhipu → `thinking:{type:'disabled'}`**。修正智谱 4 个型号与千问 DashScope 全系列 Qwen3 的 `capabilities.reasoning`（`false` → `true`）。
  - **严谨性铁律（prompt 最高优先级）**：①答案必须可验证（不确定 → `examQuestions:[]`）②解析必须与答案自洽③解析不准出现"此题若/改原题/可能题目问的是另一角"类自我怀疑措辞④绝不编造年份/考试名/图片数据。
  - **含"如图"的试题约束**：题干含"如图"但无原图（`imageData`）/可信直链（`image`）/能精确手绘的 SVG 时——**不要出这道题**，或改写为纯文字即可作答的等价题型。
  - **`imageData` 说明强化**：纯文本模型严禁填此项，绝对不要编造 base64。
  - **SVG 规则重写为"正向画法教学"**：不再只写"别画错"，而是按学科给**可执行绘图步骤** —— 通用骨架（先立关系 → `viewBox='0 0 320 200'` 居中留边 → 先主线条后标记）；数学几何（三角形先定三顶点坐标再按"对边"命名 a=BC；直角画小正方形、等长边打横线、角内画弧、直径过圆心、平行线画同向箭头）；函数图象（坐标轴 → 刻度 → 曲线，一次/二次/反比例/三角各给画法 → 关键点标坐标）；电路（电池/电阻/电容/开关/灯泡/电表的具体符号 + 串并联拓扑）；受力分析（力从作用点出发、斜面分解用虚线）；光学（先镜面 → 法线虚线 → 光线箭头、角度相对法线）。
  - **公开图源积极引用**：`image` 字段标题改为"可信图源直链，优先于手绘 SVG"，明确引导模型对理科概念按 Wikimedia Commons 规范文件名拼 `upload.wikimedia.org` 直链（只填能确定对应正确示意图的，否则空字符串走图库检索/SVG 兜底）。
- **结果**：智谱与千问同样显式关闭思考，正文预算不再被思维链侵蚀；模型在有明确判断标准后倾向"不出不确定的题"；SVG 输出从"限制"转为"按步骤画"；公开图源直链的期望值与真实命中率对齐。
- **影响**：`types/aiProviders.ts` 能力声明修正（智谱/千问 `reasoning:true`）；prompt 显著扩展（构建期单测钉死关键词防漂移）；`imageData` 字段语义更明确。
- **反思**：**约束 LLM 出图与约束它"老实作答"同理 —— 负面限制不如正向可执行教学**。只写"别画错"模型无从下手；给出"先画什么、坐标怎么定、符号怎么摆"的具体步骤才可复现正确结果。**思考型模型的默认思考必须显式关闭，且参数字段名逐厂商核对**，官方文档与训练记忆常不一致。

### 文件变更
- 修改 `src/services/baseAIProvider.ts`：`DISABLE_THINKING_PARAMS` 按厂商分派关闭思考参数；`buildGeneratePrompt` 新增【严谨性铁律】【含"如图"的试题约束】，强化【imageData 说明】，重写【SVG 字段规则】为正向画法教学，改写【image 字段】为积极引用
- 修改 `src/types/aiProviders.ts`：智谱 `glm-5.2/5.1/4.7/4.7-flash` 与千问 DashScope Qwen3 全系列 `capabilities.reasoning` 改为 `true`
- 新增 `src/services/__tests__/disableThinking.test.ts`（5 条：zhipu 注入 `thinking:{type:'disabled'}` 且不注入 `enable_thinking`/`temperature`；dashscope/siliconflow 注入 `enable_thinking:false`；未列入厂商不注入；`reasoning:true` 时不传 `temperature` 且 `max_tokens≥8192`）
- 修改 `src/services/__tests__/baseAIProvider.test.ts`（+2 提示词契约：严谨性铁律、含"如图"约束；并更新 SVG 契约断言为正向教学内容）

### 构建验证
- TypeScript 类型检查：通过（`node ./node_modules/typescript/bin/tsc --noEmit`）
- 单元测试：通过（`node ./node_modules/vitest/vitest.mjs run`，**17 文件 / 210 用例全绿**）

### 关联文档
- 更新 `docs/design.md`：§5.3.1 配图策略（SVG 正向画法教学 + 图源积极引用）、§10.5 关闭思考改为按厂商分派
- 更新 `docs/issues.md`：新增已解决条目
- 更新 `docs/lessons/`：新增"负面约束不如正向教学""思考型模型预算""链路错误不可吞"教训
- 更新 `docs/worklog.md`：记录本次 Bug 修复 + 重构
- 更新 `docs/architecture.md`：§11.4 错误处理表补"链路错误透传"与"首字节超时"；§15.2 同步"链路状态处理"，删除已废弃的"自动降级"描述

### 经验教训
- **思考型模型的默认思考会吃掉输出预算**：关闭思考必须按厂商用**正确的字段名**（千问 `enable_thinking` / 智谱 `thinking:{type:'disabled'}` / DeepSeek `reasoning_effort`），传错会 400，绝不能统一发一个字段。
- **负面限制 ≠ 可执行约束**：写"别画错"模型无法执行；给出正向的、分步骤的画法（先立骨架、再定坐标、最后补标记）才能得到正确结果。这条同时适用于"教模型画图"和"约束模型不要编造"。
- **"准确"要靠可判定的准则落地**：仅声明"准确性>完整性"不够，必须给出反例句与判定准则（"答案与解析不一致""不准出现'改原题'类措辞"），模型才有明确边界可参照。
- **纯文本模型不可能给出原图数据**：不能要求它填 `imageData`；缺图时应走"可信直链 / 手绘 SVG / 干脆不出这道题"三条可执行路径。

---

## 2026-09-11（AI 生成内容质量治理：公式统一渲染 + 试题原图优先 + 学科制图规范）

### 事件
- **背景**：用户实测发现四类问题：① **关键要点 / 易错提醒等列表里的公式报红**（如 `$\vec{F}$` 原样露出）；② **试题题干与选项的裸 LaTeX**（`\triangle ABC`、`60^\circ`、`\sqrt{13}` 没有 `$` 围符）原样露出；③ **AI 画图不符合学科惯例**（截图里三角形对边与顶点不匹配 a/b/c 约定）；④ **试题配图**此前 prompt 写"固定填空统一用 svg"——与"原图最可靠"的原则相反。
- **根因（两个独立维度）**：
  - **渲染覆盖缺口**：`LatexText` 只接入了 11 个文本字段，遗漏了 `keyPoints` / `pitfalls` / `learningPath` / `confusables` / `mindMap` 节点标题·描述 / `interestingFacts.title` / 前置知识与关联主题 chip —— 同一个组件"有的字段渲染、有的裸露"，是必然漏洞。
  - **裸 LaTeX 识别不了**：`MATH_SPLIT` 只认 `$...$` / `\(...\)`，模型在试题里大量输出裸 LaTeX（`\triangle ABC`、`\sqrt{13}`、`60^\circ`），走过了渲染器也照样原样露出。
- **修复（双保险 + 三通道）**：
  - **公式渲染层**：① `utils/latex.ts` 新增 `splitBareLatex()`，仅认强信号（反斜杠命令 `\\[a-zA-Z]{2,}` 或带花括号的上下标 `[\^_]\s*\{`），向左右扩展到数学字符边界（遇 CJK / 中文标点 / `$` / 换行即止）；**且必须 KaTeX 解析成功才渲染**（既防 `snake_case` 误伤，也防 `C:\Users` 这类伪命中），失败一律原样输出绝不吞内容。② `LatexText` 重组为先切围符再对普通段跑 `splitBareLatex`，成为**所有 AI 文本字段的统一渲染入口**。③ `SearchResults` 把遗漏字段全部接入（keyPoints / pitfalls / learningPath / confusables / mindMap 节点标题·描述 / 概念标题 / 趣事标题 / 标签 chip）。
  - **提示词源头**：`buildGeneratePrompt` 置顶【公式书写规则】，要求"凡数学符号一律用 `$...$` 包裹，含正反例（`$\triangle ABC$` vs `\triangle ABC`），覆盖正文 / 列表 / 题干 / 选项 / 答案 / 解析。
  - **试题配图三通道**：`ExamQuestion` 新增 `imageData`（base64 直填），渲染优先级 = `image` / `imageData`（**原图优先**，加载失败自动隐藏并回退 SVG）。`isDataImageURL` 只放行 `png/jpeg/gif/webp` 且限体积（< 4MB），伪造 base64 一律丢弃。提示词明确告诉模型："试题原文中一大片无法作为字符识别、且承载图形语义的区域就是一张图"，直接填入 `imageData` 比用文字描述或手绘 SVG 可靠得多。
  - **严格图源白名单**：提示词端把 `TRUSTED_IMAGE_HOSTS` 的域名清单**显式写出**（upload.wikimedia.org / commons.wikimedia.org / cdn.kastatic.org / images.unsplash.com / raw.githubusercontent.com / lh*.googleusercontent.com / cdn.jsdelivr.net / ocw.mit.edu / math.mit.edu），并附"必须是 https 直链、不带 ?source= / ?token= 等防盗链参数"的硬规则。让模型只往可校验的来源填，避免此前 AI 凭印象给链、大量静默落空。
  - **学科制图惯例**：SVG 规则新增"必须严格遵循该学科制图惯例"通用条款 + 高风险学科细则（数学几何顶点对边 a/b/c、物理受力箭头源自作用点 / 标准元件符号 / 法线、化学键角与装置顺序、统计图坐标轴），避开"画得出但画错了"的隐性错误。
- **结果**：用户截图里的四类问题全部根治 —— 关键要点里的 `$\vec{F}$` 渲染成矢量符号、试题题干里的 `\triangle ABC` 与 `\sqrt{13}` 渲染成三角形与根号、配图按"原图 > SVG"渲染、SVG 按学科制图规范输出。
- **影响**：① `types/index.ts` `ExamQuestion` 字段扩展（新增 `imageData?`，向后兼容）；② 提示词扩展（构建期单测钉死关键词，避免后续漂移）；③ 渲染层加了一层轻量正则扫描（按字符，O(n)），流式渲染的 60ms 节流照旧生效，性能无感知。
- **反思**：**"统一入口"是 AI 内容渲染的关键约束** —— 同一类数据要么全部走同一个渲染器，要么全部别用；零散接入是漏洞温床。**"信源可校验"比"信源多"更重要** —— 与其让模型凭印象给图链，不如把可接受域名写死、不可接受的静默落空，让模型只往白名单内填。**防御性渲染（KaTeX 解析失败回退）比"识别够准"更安全** —— 误识别只是丑，误渲染可能错得离谱；让 KaTeX 解析失败这条硬关卡兜底，能挡掉几乎所有伪命中。

### 文件变更
- 新增：`src/components/ui/__tests__/latexText.test.tsx`（7 条组件测试：裸 LaTeX / 围符 LaTeX / Windows 路径不误识别等）
- 修改：`src/utils/latex.ts` 新增 `splitBareLatex()` + `BarePiece` 接口；`src/components/ui/LatexText.tsx` 重构为统一入口（先切围符再对普通段跑 splitBareLatex）；`src/modules/search/SearchResults.tsx` 把遗漏字段（keyPoints / pitfalls / learningPath / confusables / mindMap 节点·描述 / 概念标题 / 趣事标题 / 前置知识·关联主题 chip / 试题配图）统一接入 LatexText，新增 `figureFailed` 状态实现"原图优先，加载失败回退 SVG"；`src/types/index.ts` `ExamQuestion` 新增 `imageData?: string`；`src/services/baseAIProvider.ts` `sanitizeExamQuestions` 识别 `imageData` / `image_data` / `imageBase64` 别名 + `isDataImageURL` 校验；`buildGeneratePrompt` 置顶【公式书写规则】、把可信图源域名清单显式写入、增加【试题配图规则】与【SVG 学科制图惯例】段
- 测试：`src/utils/__tests__/latex.test.ts`（+9 条 splitBareLatex 用例，含真实截图文本 `\triangle ABC` / `60^\circ` / `\sqrt{13}` / `learning_rate` 不误识别）；`src/services/__tests__/baseAIProvider.test.ts`（+4 条 examQuestions imageData 用例 + +5 条提示词契约用例锁死 LaTeX 规则 / 图源白名单 / 原图优先 / 学科规范）；`src/modules/search/__tests__/searchResultsLatex.test.tsx`（+4 条组件渲染回归：keyPoints / pitfalls / 试题题干·选项 / imageData 配图）

### 构建验证
- TypeScript 类型检查：通过（`node ./node_modules/typescript/bin/tsc --noEmit`）
- 单元测试：通过（`node ./node_modules/vitest/vitest.mjs run`，**15 文件 / 185 用例全绿**，本次新增 29 条）
- 生产构建：通过（`vite build --outDir <临时目录>` 验证；`npm run build` 的 vite 阶段清空 `dist/assets` 触发沙箱批量删除保护）

### 关联文档
- 更新 `docs/design.md` §5.3.1 配图策略改写为"三通道 + 严格图源白名单 + 试题原图优先 + 学科制图惯例"；§10.6 改写为"公式统一渲染（双保险）+ 统一入口覆盖"；§4.6 `ExamQuestion` 补充 `imageData?` 字段
- 更新 `docs/issues.md`：新增两条已解决
- 更新 `docs/lessons/logic.md` + `lessons/index.md`：新增"渲染入口不统一"教训
- 更新 `docs/worklog.md`：记录本次 Bug 修复 + 开发任务
- 更新 `docs/progress.md`：同步 v1.6.1 增量
- 更新 `docs/versions.md`：v1.6.1 增量小节
- 更新 `docs/convention.md` 变更记录
- 重建 `.manifest.json`

### 经验教训
- **"统一入口"是 AI 内容渲染的关键约束**：同一类数据要么全部走同一个渲染器，要么全部别用；零散接入是漏洞温床。这次修复前 LatexText 仅覆盖 11 处，遗漏 8+ 字段，是个结构性风险而非偶发 bug。
- **"信源可校验"比"信源多"更重要**：与其让 AI 凭印象给图链（大量 404 / 防盗链 / 张冠李戴），不如把可接受域名写死、不可接受的静默落空，让模型只往白名单内填。
- **防御性渲染（KaTeX 解析失败回退）比"识别够准"更安全**：裸 LaTeX 自动识别最大的风险是误命中（如 `C:\Users`），而 KaTeX 解析失败回退这条硬关卡可以兜掉几乎所有伪命中 —— 既绝不吞内容（最坏情况是原样输出），也避免了"识别够聪明但识别错了"的隐性错位。
- **提示词源头加固 + 渲染层兜底是双保险**：模型不听话时渲染层能兜底（裸 LaTeX 识别），模型听话时 prompt 让源头更干净（统一 `$...$`）；两层相互兜底，缺一就脆。
- **"原图优先"是 AI 画图的根本原则**：模型手绘 SVG 只能画示意图，对几何题"特定数据"的图（已知 a=3, b=4, 60° 的特定三角形）几乎一定会画错。提示词教模型把"无法作为字符识别、且承载图形语义的区域"识别为图片，并直接填 `imageData`——这比要求模型画得更准更现实。


### 事件

- **背景**：上一轮修完「总述延迟显示 + 步骤指示卡死」后，用户指出真正的关键点被漏掉了 —— `baseAIProvider.ts` 里透过的逻辑（尤其是**运行时"流式能力黑名单"，进程内缓存、不落盘**）。现象仍是：意图识别（"你是一个意图识别助手…"）已完成、历史记录已入库，但 summary 却迟迟不显示。用户明确要求留意黑名单这条链路。
- **排查**：沿 `analyze`（意图识别）→ `callModelStream` → `prepareRequest`（`wantStream = stream && caps.streaming && isStreamPossiblySupported(...)`）→ `if (!meta.streaming)` → `callModel` 走查，定位到黑名单的致命设计缺陷：
  1. **黑名单是"永久禁用"而非"冷却"**：原实现 `const streamUnsupported = new Set<string>()`，一旦某型号流式失败一次就永久记入。此后 `prepareRequest` 永远算得 `wantStream=false`，`callModelStream` 直接命中 `if (!meta.streaming)` 分支走非流式。
  2. **"自愈"根本不可达**：注释里承诺的"流式成功即移出黑名单（`markStreamSupported`）"依赖后续请求真的发出 `stream: true`；但永久禁用后永远不再发流式请求，于是永远没有机会自愈。黑名单实际退化为"**整个会话关掉该型号的流式**"，用户观感就是"内容不再逐段生长，而是憋很久整段一次性出现"——正好解释了"分析早就有历史记录了，summary 却迟迟不显示"。进程内缓存、刷新即恢复，极难复现。
  3. **降级静默、不可观测**：走非流式分支没有任何日志，无法判断"为什么没有流式"。
  4. **误判黑名单的触发条件**：收到过思维链（`receivedReasoning`）说明服务端**确实在流式**，此时即使本轮正文为空也不该记黑名单。
- **修复**：
  - `Set` → `Map<string, number>` 记录失败时间戳；新增 `STREAM_RETRY_COOLDOWN_MS = 60_000`。
  - `isStreamPossiblySupported(providerId, model, now)`：无记录→允许；冷却期内→暂时改走非流式；**冷却期结束→自动再试一次**（自愈的前提条件成立）。`markStreamUnsupported(providerId, model, reason?, now?)` 每次失败刷新时间戳；`markStreamSupported` 立即删除（流式成功即自愈）。
  - 可观测性：`markStreamUnsupported` 打印 `console.warn`（含冷却秒数 + 原因）；`callModelStream` 走非流式分支时打印 `console.warn`（带 `caps.streaming`）。
  - 收敛记账条件：仅在"响应确定不是 SSE 增量 / SSE 解析失败 / 传输层失败"等**协议层证据**下记账；`receivedReasoning` 为真时不记（防止把"服务端在流式只是正文未到"误杀）。
- **结果**：黑名单恢复其设计语义 —— "临时省掉注定失败的往返 + 到期自动重试自愈"，不再是"一次失败整个会话禁用流式"；降级行为全程可观测。
- **影响**：无破坏性变更，仅影响流式降级策略；对用户可见效果是流式能力可在会话内自动恢复（此前需刷新页面）。
- **反思**：带"自愈"承诺的缓存/熔断机制，**必须存在一条能到达自愈入口的路径**，否则自愈是死代码。这里用"永久禁用"实现了"冷却"，两者语义完全不同却在无测试时几乎无法区分 —— 关键路径的降级策略必须有契约级测试（`now` 注入）钉死。此外，**静默降级是排查黑洞**：凡是行为随运行时状态变化的分支，都要留下可观测信号。

### 文件变更

- 更新 `src/services/baseAIProvider.ts`：黑名单由 `Set` 改 `Map<key, failedAt>` + 60s 冷却；新增导出 `STREAM_RETRY_COOLDOWN_MS`；`isStreamPossiblySupported` 支持注入 `now`；`markStreamUnsupported` 增加 `reason`/`now` 并打 `console.warn`；非流式降级分支补 `console.warn`；只在协议层证据下记账（`receivedReasoning` 不记账）
- 新建 `src/services/__tests__/streamFallback.test.ts`：7 条用例钉死冷却契约 —— 无记录→放行；冷却期内→拦截；**冷却结束→重试（自愈前提）**；再次失败→刷新时间戳；流式成功→立即移出；按 provider/model 隔离；冷却期有限

### 构建验证

- TypeScript 类型检查：通过（`node ./node_modules/typescript/bin/tsc --noEmit`）
- 单元测试：通过（`node ./node_modules/vitest/vitest.mjs run`，13 文件 156 用例全绿，新增 7 条）
- 生产构建：vite 打包本体正常（`npm run build` 的 vite 阶段清空 `dist/assets` 触发沙箱批量删除保护，改用 `vite build --outDir <临时目录>` 验证）

### 关联文档

- 更新 `docs/design.md`：流式能力黑名单说明改写为"带冷却期（非永久禁用）+ 降级必须可观测 + 只有协议层证据才记账"
- 更新 `docs/issues.md`：新增一条已解决问题
- 更新 `docs/lessons/logic.md` + `lessons/index.md`：新增"熔断/自愈路径可达性"教训
- 更新 `docs/worklog.md`：记录本次 Bug 修复 + 测试任务
- 更新 `docs/progress.md`：同步修复状态

### 经验教训

- **带"自愈"承诺的熔断/缓存，必须保证自愈入口可达**：把"冷却"写成"永久禁用"，会使自愈逻辑成为永远走不到的死代码，且症状（不再流式）与实现（降级非流式）距离很远，极难定位。
- **运行时降级是排查黑洞，必须可观测**：凡行为随进程内状态变化的分支，都要留 `console.warn`；静默降级等于把 bug 藏起来。
- **记账条件要收敛到"证据"层**：只有协议层明确失败才记黑名单；"收到思维链但正文未到"证明服务端在流式，不能算失败。
- **降级策略必须有契约测试**：状态类逻辑用可注入的 `now` 把"冷却期边界"钉死，否则"永久禁用"与"冷却"在测试缺位时无法区分。

## 2026-09-11（流式渲染时序修复：总述延迟显示 + 步骤指示卡死）


### 事件

- **背景**：用户实测「什么是勾股定理」，AI 分析已完成、历史记录已入库，但「总述」没有立即出现，直到界面显示"正在生成知识导图"一段时间后才出现，要求复盘流式渲染。
- **排查**：不依赖肉眼观察，直接把真实字段产出顺序（`summary → mindMap → conceptsOverview → concepts → …`）喂给 `StreamingJSONParser` 做断言，暴露出两个独立根因：
  1. **`completedKeys` 漏掉容器型字段**：`scan()` 只在**字符串/字面量**型值收尾时登记完成；值为数组/对象（`mindMap`/`concepts`/`knowledgeContext`/`examQuestions`/`interestingFacts`）的顶层字段，其收尾发生在子帧弹栈之后，父帧从未得到"值已结束"信号 → 流式中间态 `completedKeys` 里根本没有这些字段。而 `deriveStep()` 按 `STEP_ORDER` 取"第一个未完成字段"，顺序为 `summary → mindMap → conceptsOverview → …`，于是**从第二个字段起永远返回 `mindMap`** —— 整个生成阶段都显示"正在生成知识导图"，也正好解释了用户看到的"总览没立刻显示，直到生成思维导图时才出现"。
  2. **总述被概念列表门控**：`SearchResults` 把「总述」渲染在 `{concepts.length > 0 && …}` 内部，而总述比概念列表**早一个字段**产出，导致总述文本已到达也无法渲染，只能等概念列表出现后一起蹦出来。
- **修复**：`scan()` 在容器闭合弹栈后，若父帧就是根对象且其 `pendingKey` 非空，立即登记该顶层字段完成；`SearchResults` 把总述移出概念列表门控（只要总述或概念列表任一到达即渲染「核心概念」区块）；`index.tsx` 首字前占位不再写死"正在生成知识导图"，改为中性文案 + 首字等待计时（原来该计时器所在的 `SearchResults` 分支因外层 `generatedData` 门控而不可达）。
- **结果**：流式步骤指示按真实产出顺序推进（概览 → 知识导图 → 总述 → 核心概念 → 知识脉络 → 试题 → 趣味知识）；总述在自身文本到达时即开始逐字呈现。
- **影响**：无破坏性变更，仅影响搜索模块流式渲染时序与加载文案。
- **反思**：mock provider 的 `generateStream` 手工构造 `completedKeys`（每块都 push），所以**这个 bug 只在真实 provider + 流式中间态下出现**，无 Key 演示环境永远复现不了 —— 用 mock 的测试通过并不代表流式链路正确，关键路径必须有真实解析器参与的测试。

### 文件变更

- 更新 `src/services/streaming/partialJSON.ts`：`scan()` 的 `}`/`]` 分支在弹栈后补记顶层容器型字段完成（含注释说明为何原逻辑漏掉）
- 更新 `src/modules/search/SearchResults.tsx`：「核心概念」区块门控由 `concepts.length > 0` 改为 `conceptsOverview || concepts.length > 0`；导出 `WaitTimer`
- 更新 `src/modules/search/index.tsx`：`GENERATING` 占位文案由写死 `steps.mindMap` 改为 `steps.generic`，并接入 `WaitTimer` 首字等待计时
- 更新 `src/services/streaming/__tests__/partialJSON.test.ts`：新增 3 条用例（容器型字段中间态登记、对象型字段登记、按真实字段顺序推进不倒退）
- 新建 `src/modules/search/__tests__/searchResultsStreaming.test.tsx`：3 条用例（总述先到时即渲染、概念到达后共存、两者皆空不渲染区块）

### 构建验证

- TypeScript 类型检查：通过（`node ./node_modules/typescript/bin/tsc --noEmit`）
- 生产构建：通过（`npm run build`）
- 单元测试：通过（`vitest run`，12 文件 149 用例全绿；修复前 3 条新用例为红，可复现）

### 关联文档

- 更新 `docs/issues.md`：新增一条已解决问题
- 更新 `docs/lessons/logic.md` + `lessons/index.md`：新增"流式中间态字段完成判定"教训
- 更新 `docs/worklog.md`：记录本次 Bug 修复 + 测试任务
- 更新 `docs/progress.md`：同步修复状态

### 经验教训

- **流式解析的"完成"判定必须覆盖所有值类型**：JSON 值的收尾方式因类型而异（字符串/字面量在所属帧内收尾，容器在自己的子帧收尾），只处理其中一种会让下游"已完成字段"清单长期缺失整类字段；这类 bug 只影响中间态，最终态因回退到 `Object.keys(data)` 而看不见，极易漏测。
- **UI 分区块的顺序不要与"数据依赖"混淆**：把 B 字段的渲染挂在 A 字段的非空判断下，等于给 B 加了一个隐形延迟；流式场景下"区块内容"应各自独立门控，只在语义上真正依赖时才联动。

## 2026-09-11（v1.6.1 预置模型全量修正 + 生图服务配置 + 配图/公式/SVG/流式四项体验修复）

### 事件

- **背景**：用户实测反馈四类问题：① 预置模型名与文档不符，很多型号已失效（智谱实际只有 GLM-4.x/5.x 系列）；② 设置面板缺生图服务密钥入口；③ 知识内容里的行内公式（如 `$U_S = 10\\text{V}$`）原样露出 LaTeX 源码；④ 试题电路 SVG 画幅过大、顶部元件被裁、线条过粗；⑤ 内容"没有流式渲染"——分析已完成、历史已入库，但很久才显示内容。
- **过程**：先用 WebSearch 逐家核对 8 家厂商的官方模型目录，修正失效型号；再为通义万相生图补设置面板入口；随后定位公式/SVG/流式三个渲染问题并逐一修复。流式问题经两轮排查：第一轮修掉"清洗风暴"（每个分片全量 sanitize 导致主线程掉帧）；第二轮用户反馈"与厂商型号无关"后，定位到**首字延迟**（思考型模型先吐思维链，原读取器只取 `delta.content`，思考期界面零反馈）。
- **结果**：预置模型全部换成当前有效型号；生图服务可在面板配置；行内公式全面接管；SVG 等比缩放不裁剪、线宽统一压细；流式首字前显示等待秒数，并对支持厂商显式关闭思考模式降低延迟。
- **影响**：默认厂商智谱从已失效的 `glm-4-plus` 换为 `glm-5.2`，此前配置过的用户需重新选择一次模型；流式体验从"憋很久一次性出"变为"等待可见 + 逐段生长"。
- **反思**：模型名属于"快变事实"，必须定期与官方目录核对而非依赖训练记忆；修改预置型号要同步三处（PROVIDER_META / MODEL_DESC_EN / providerTemplates）。流式链路的瓶颈不只在传输层，**渲染侧的全量清洗**与**首字前的零反馈**同样会让用户感知为"没流式"。

---

## 2026-09-10（v1.6.0 多语言 i18n 架构 + 用户语言绑定 + 超限自动续写 + 查词翻译改造）


### 事件

- **背景**：v1.5.0 内容增强落地后，用户提出三项能力诉求：① 界面文案不要写死中文（要能出英文界面）；② AI 输出语言应跟随用户语言而不是写死中文；③ 生成长内容常被模型输出上限截断。同时反馈词典翻译模块的查词/翻译交互需要重做（源/目标语言选择、逐段对齐、短语多词支持）。分三段完成。
- **2026-09-10 多语言（i18n）字符串层**：
  - 新建 `src/i18n/strings/`，按功能区拆文件：`common`（通用词/`app.*`/`tabs.*`/`aiPanel.*`）、`settings`（模型/密钥/添加厂商/厂商模板）、`search`、`translate`、`misc`（`doc.*`/`favorites.*`/`history.*`/`speech.*`/`exportNote.*`），`index.ts` 汇总。
  - **英文作类型基准**：每个 area 先写 `xxxEn`，`export type XxxStrings = typeof xxxEn`；中文为 `xxxZh: XxxStrings`。中文漏 key 立即 tsc 报错（有意设计）；运行时 `STRINGS_ZH = deepMerge(STRINGS_EN, {...Zh})`，缺 key 回退英文不崩。
  - 取值入口：React 组件用 `hooks/useStrings.ts`（`useSyncExternalStore(subscribeLanguage)`）；service/状态机/utils 用 `getCurrentStrings()`；占位符 `{name}` 由 `fmt()` 填充。`zh` → 中文表，其余语言一律英文表。
  - **数据层不迁 i18n**：厂商名/模型描述/文档模板正文保留在数据层，英文覆盖走 `i18n/strings/aiProviderTexts.ts`（`localizedProviderName`/`localizedModelDescription`）与 `docTemplates.ts`（`getDocBodies(language)`）；`modules/doc/templates.ts` 只留结构，`generate*(topic, language)`。
  - UI 全量迁移：Header/TabNav/ConfirmDialog、设置面板三件套（ModelSelector/ProviderKeyInput/AddProviderForm）、搜索模块（含 SearchResults/KnowledgeGraph/SearchContainer/QASection/HotTags/SearchInput）、词典翻译（TranslateInput/WordResult/SentenceResult）、文档模块（DocEditor/DocTypeSelector/DocResult）、收藏模块、HistorySidebar、`utils/export.ts` 导出模板。
- **用户语言基础设施**：
  - `src/i18n/languages.ts`：全应用唯一语言目录（`code/native/zhName/english/speech`），`normalizeLanguage` 兼容旧 `zh-CN`、中文名、BCP-47 带地区。
  - `src/hooks/useLanguageStore.ts`：与 `useAIConfigStore` 同构的纯存储层（subscribe/emit），**存标准 `LanguageCode`（zh/en/fr…）而非 UI 语言**，默认取 `navigator.language`。
  - `useLanguage.ts` 重写为 `useSyncExternalStore`，返回 `{ language, uiLanguage, setLanguage, setLanguageZh/En }`；Header 语言区改下拉并提示"默认跟随系统语言，AI 以此语言输出"。
- **AI 输出绑定用户语言**：`baseAIProvider.buildLanguageDirective()` 每次组装 prompt 实时读 `getAIContentLanguage()`，注入"输出语言为 X，但 JSON 字段名/枚举值保持英文"；已接入 search 生成/追问/文档 system prompt。删除了追问 QA 里写死的语言规则。
- **超限自动续写（最多 3 次）**：
  - `hasCompleteJSONObject(raw)`：严格判定首个顶层 JSON 对象是否闭合、不做修复（不能用带 repair 的 `parseJSONResponse`，否则截断会被补成合法而跳过续写）。
  - `callModelStreamWithContinuation(...)`：首轮 1 次 + 续写 ≤2 次（`MAX_GENERATION_ATTEMPTS=3`），未写完时回填已生成内容（尾部最多 12k）要求"只输出续写"。已接入 `search.generateStream`/`followupStream`/`document.generateStream`。
  - `SearchGenerateResponse`/`GeneratedKnowledge` 新增 `continued`；SearchResults 在琥珀色截断警告后追加青绿色"已自动续写并补全"提示。
- **查词翻译服务与 UI 改造**：
  - 服务契约：`detect` 改为只检测源语言（`{ sourceLang(code), isPhrase, confidence }`）；`queryWord` 支持短语/多词并返回最多 10 个 `keywords`；`queryTranslate` 返回 `segments[{source,target}]` 逐段对齐 + `sourceLang/targetLang`。
  - UI：`TranslateInput` 源/目标双下拉（源含"自动检测"）、交换按钮、输入上限（查词 120 / 翻译 3000）超长截断提示、字数计数；`translate/index` 源默认 `auto`、目标默认用户语言（未手改则随设置联动）、源=目标时自动改判；`WordResult` 短语徽章 + 可点击关键词；`SentenceResult` 实现选词实时映射（hover 优先于 pinned），对齐不完整时追加剩余文本防丢字。
- **Task 11/12 收尾**：修复 `mockAIService.ts` 文档模板签名（改惰性函数 + `getStoredLanguage()`/`getCurrentStrings()`）；补齐收藏/历史/朗读/导出/知识目录/查询无效等残留硬编码中文。
- **顺手修复两个真实 bug**（被测试暴露）：① `useSearchStateMachine` 在 `runGenerate` 返回 false 时会用通用"生成失败"覆盖异常路径写入的具体错误 → 改为保留 `prev.error`；② 全空结果因 `if (latest)`（空对象为 truthy）被误判为"有可展示内容"而渲染空卡片 → 新增 `hasUsableContent()` 判定，全空正确回到 IDLE。


### 文件变更

- 新增：`src/i18n/strings/{common,settings,search,translate,misc,aiProviderTexts,docTemplates,index}.ts`、`src/i18n/languages.ts`、`src/hooks/useStrings.ts`、`src/hooks/useLanguageStore.ts`、`src/services/streaming/{partialJSON,sseReader}.ts`
- 新增（组件/工具）：`src/components/ui/SvgFigure.tsx`、`src/utils/inlineSvg.ts`、`src/utils/latex.ts`、`src/components/settings/providerTemplates.ts`、`src/services/commonsImage.ts`、`src/hooks/useKnowledgeImage.ts`
- 删除：`src/utils/imageQuery.ts`（及测试，用户判定中英词表是坏做法）、`src/services/streaming/generatePartial` 相关旧路径
- 修改（i18n 迁移）：`src/App.tsx`、`src/components/**`（layout/history/settings/ui/cards）、`src/modules/**`（search/translate/doc/favorites 全部）、`src/utils/export.ts`、`src/hooks/{useFavorites,useSpeechSynthesis}.ts`
- 修改（服务/类型）：`src/services/baseAIProvider.ts`、`src/services/mockAIService.ts`、`src/types/ai.ts`、`src/types/aiProviders.ts`、`src/modules/doc/templates.ts`、`src/modules/search/useSearchStateMachine.ts`
- 测试：`src/modules/search/__tests__/useSearchStateMachine.test.tsx`（错误断言改为 `getCurrentStrings().search.errors.*`，语言无关）、新增/扩充 latex 11 例、imageQuery（后随词表删除移除）、language 归一化 8 例、JSON 完整性/续写 7 例、查词翻译契约 4 例、输入截断 3 例
- 文档：`docs/history.md`、`docs/worklog.md`、`docs/progress.md`、`docs/todo.md`、`docs/versions.md`、`docs/goal.md`、`docs/issues.md`、`docs/design.md`、`docs/architecture.md`、`docs/project-document-manager.md`、`docs/convention.md`、`README.md`、`.manifest.json`

### 构建验证

- `node ./node_modules/typescript/bin/tsc --noEmit`：零错误
- `node ./node_modules/vitest/vitest.mjs run`：**142/142 全部通过**
- `node ./node_modules/vite/bin/vite.js build`：成功（740 modules transformed；仅 chunk >500kB 体积警告）

### 关联文档

- `docs/worklog.md`：2026-09-09、2026-09-10 详细执行日志
- `docs/design.md`：新增"多语言（i18n）与用户语言"、"流式渲染与超限自动续写"章节
- `docs/todo.md` / `docs/issues.md`：任务与问题状态同步

### 经验教训

- **英文作类型基准 + 中文深合并兜底**：改文案时先改 `*En`（类型来源）再补 `*Zh`，漏补会 tsc 报错；运行时缺 key 回退英文，不会出现 `undefined` 文案。切忌用 `Partial` 放宽中文表——那会让漏翻译静默溜过。
- **并行编辑同一批文件存在写入丢失风险**：本轮多次出现"工具报告成功但内容未落盘"（含 EBUSY）。批量编辑后**必须用 grep / tsc 复核**，发现未生效立即重做。
- **测试不要断言写死的中文错误串**：文案本地化后应断言 `getCurrentStrings().<area>.*`，否则随语言或文案变动而失败。

---

## 2026-09-09（v1.5.0 收尾：内容生成改真流式 + 真实 AI 链路修复 + 配图/题型/脉络增强 + 思维导图溢出修复 + 厂商模板）


### 事件

- **背景**：接手后先解决"假流式"—— 原 `callModel` 一次性等全文返回，搜索生成再用 `setTimeout(0)` 分块弹出，用户干等几十秒；早期 `generatePartial` 分多次 fetch 的旧方案因中途易失败已从代码删除。随后用户以真实 GLM-4-Plus 跑通链路，暴露 4 个 mock 无法复现的真问题（截断、公式报红、他厂模型全失败、图片从未成功）；再经两轮截图反馈（思维导图公式溢出、图片来源受限、中英词表、自定义厂商门槛）迭代到 v1.5.0/v1.6 雏形。
- **内容生成改真流式（生产者-消费者）**：
  - 新增 `src/services/streaming/partialJSON.ts`（`StreamingJSONParser`）：AI 侧 `push(chunk)` 写共享缓冲，渲染侧随时 `read()` 取快照；单趟扫描维护容器栈/字符串状态/安全切割点/已完成顶层键，任意截断位置都能补出可渲染的部分对象（正在写的字符串按已达字符呈现 → 打字机效果）。
  - 新增 `src/services/streaming/sseReader.ts`：SSE 流读取，处理跨 chunk 半行、`[DONE]`、流内 error。
  - `BaseAIProvider` 抽出 `prepareRequest`（流式/非流式共用），新增 `callModelStream` 并**自动降级**（不支持 SSE 或协议解析失败 → 退回 `callModel`）；提示词抽成 `buildGeneratePrompt`/`buildFollowupPrompt`/`buildDocPrompt` 共用，`sanitizeGenerateResult` 作为统一清洗出口。
  - 新增业务方法 `search.generateStream`/`followupStream`、`document.generateStream`，mock 同步实现；`useSearchStateMachine.runGenerate`（AbortController 可中断 + 60ms 节流）、`useSearchMode`、`doc/index.tsx` 改为流式占位后原地填充。
  - **快照合并 `mergeSnapshot`**：仅在新值非空时覆盖旧值，防增量解析回退时已渲染内容闪回；最终态以服务端完整结果再合并一次，避免节流跳过的尾部丢失。
- **真实 AI 链路四个真问题修复**：
  - **截断静默**：`sseReader.extractDelta` 原本丢弃 `finish_reason` 的值，`stop` 与 `length` 被一视同仁，半截 JSON 被当完整结果渲染。修复为逐层透出 `truncated`（sseReader → callModel/callModelStream → callModelWithJSON → generate/generateStream → `data.truncated`），SearchResults 显示 ⚠️ 警告横幅；`getDepthConfig` 预算整体提高一档（max 16384 / high 12288 / medium 4096，`DEFAULT_MODEL_CAPABILITIES.maxOutputTokens` 4096→16384 并放宽各厂商 cap）。
  - **公式渲染报红**：模型常把 LaTeX 包在 `$$…$$`/`\[…\]`/`\(…\)` 里，KaTeX 不识别，流式半截 LaTeX 还会整段抛 `katex-error`。新增 `src/utils/latex.ts`（`normalizeLatex` 剥围栏 + `renderLatexSafe` 用 `throwOnError` 试解析），成功渲染 KaTeX、失败降级为等宽代码块；提示词明确要求 `notation` 填纯 LaTeX。
  - **他厂模型几乎全失败**：按 2026-07~09 官方现状重排各厂商模型 ID 与能力 cap（DeepSeek/Moonshot/DashScope/OpenAI/Anthropic/Gemini/SiliconFlow/智谱），并把 `getDepthConfig` 的 `max_tokens` 收敛为 `min(基线, caps.maxOutputTokens, ctxLen*40%)` —— 超出模型输出上限会被多数厂商 400 拒绝，是"生成经常失败"的隐蔽来源。
  - **图片从未生成**：改为多级兜底（详见下条）。
- **配图策略（经三轮修订）**：
  - v1.3 曾用"让模型画内联 SVG"——等于要求模型具备画图能力，多数做不到。改为 `svg`（模型手绘、内联渲染必定可见）+ `image`（仅确定直链存在时填）双通道，新增 `utils/inlineSvg.ts`（严格清洗：完整标签、viewBox、禁 script/foreignObject/事件属性/外链，体积上限 24K）+ `components/ui/SvgFigure.tsx`。
  - v1.4 增加 **Wikimedia Commons 免 Key 自动兜底**（`services/commonsImage.ts` + `hooks/useKnowledgeImage.ts`，`origin=*` 匿名跨域、进程内缓存 + 8s 超时、失败静默返回 null）。
  - v1.5 发现 Commons 几乎全是英文条目、中文概念名查不到 → 新增 `Concept.imageQuery`（模型自己填英文关键词）。
  - **v1.6 定稿**：撤销"只认 Commons"与"中英词表"两个做法（后者被用户判定是坏做法，`utils/imageQuery.ts` 删除），`commonsImage.ts` 重写为 `findKnowledgeImage(rawQuery)` —— 查询串主要是中文走 `zh.wikipedia.org` API、主要是英文走 Commons，任一源无结果自动 fallback 另一源，返回 `source` 用于署名；提示词改为"任何可靠来源都可（教材/维基/可汗学院/官方题库…）"，`imageQuery` 语义变为"用哪种语言、什么词由模型自己判断"。
- **试题题型适配（`sanitizeExamQuestions` 重写）**：题型中文/英文别名映射到 4 个标准枚举（旧代码只认英文白名单，其余一律降级 `essay`，正是"选择题/填空题适配不好"的根因）；题型反推（≥2 选项→choice、`____`→fill、"求/计算"+数字→calculation）；选项归一化（数组/对象/嵌套/整串 `"A.甲 B.乙"`，题干内联选项切出并还原干净题干，自动剥 `A.` 前缀）；答案收敛为字母；难度支持中英文别名。UI 新增 `ExamQuestionCard`（选择题可点选即时判对错、填空题渲染卷面填空线）。
- **核心概念与知识脉络增强**：`Concept` 新增 `keyPoints?`（3~~4 条关键要点）与 `pitfalls?`（1~~2 条易错提醒）；`KnowledgeContext` 新增 `confusables?[{topic,difference}]`（易混辨析）。知识脉络渲染由"三栏标签云"改为符合认知顺序的四段：学习路径（纵向带序号流程）→ 前置知识/关联主题（并列标签）→ 易混辨析 → 常用结论（编号列表）。`conceptsOverview`（总述）确认属于「核心概念」区块，渲染在标题下、概念卡片之前；`STEP_ORDER` = `summary → mindMap → conceptsOverview → concepts → …`。
- **思维导图公式溢出修复（核心 bug）**：`calculateDescSize` 原用 `0.55em/字符` 统一估宽，而希腊字母（α β θ Δ Σ）与全角字符实际约 0.95~1.0em，公式串实际折行数 > 估算行数 → 描述盒高度不足 → 文字溢出边框。重写为 `estimateTextWidthEm(text)` 按字符类分档（ASCII 0.55 / CJK·全角 1.0 / 希腊 0.95 / 数学符号 0.8 / 上下标 0.4），并把测量盒与渲染盒样式对齐（同字号/行高/断词规则，渲染盒改固定 `height` + `overflow:hidden`）。顺带修掉旧版把 CJK 的 1.0 又除一次 0.55 的双重换算 bug。
- **自定义厂商模板**：新增 `components/settings/providerTemplates.ts`（openai/openrouter/siliconflow/dashscope/zhipu/deepseek/ollama/custom 八套，含 name/baseUrl/models）；`AddProviderForm` 顶部加快捷模板按钮，一键预填，官方固定端点禁用 baseUrl 编辑。
- **文档同步与勘误**：更正 `design.md` 深度表（文档 65536/32000/4000 ↔ 实际 8192/6144/2048 → 后续又统一提高一档）、`generatePartial` 相关描述（architecture/design/prd/goal/milestones 全部改为 `generateStream`）、移除 v1.3 新增的"老数据兼容"防御性别名（`item.diagram`/`item.figure` 等，产品未落地属冗余），并清理一批厂商型号的营销化描述。


### 文件变更

- 新增：`src/services/streaming/partialJSON.ts`、`src/services/streaming/sseReader.ts`、`src/services/streaming/__tests__/partialJSON.test.ts`、`src/utils/inlineSvg.ts`、`src/utils/latex.ts`、`src/components/ui/SvgFigure.tsx`、`src/services/commonsImage.ts`、`src/hooks/useKnowledgeImage.ts`（由 `useCommonsImage` 更名）、`src/components/settings/providerTemplates.ts`
- 删除：`src/utils/imageQuery.ts`、`src/utils/imageQuery.test.ts`
- 修改：`src/services/baseAIProvider.ts`（prepareRequest / callModelStream / buildXxxPrompt / sanitizeGenerateResult / buildLanguageDirective / getDepthConfig / 流式能力黑名单）、`src/services/mockAIService.ts`、`src/types/ai.ts`、`src/types/aiProviders.ts`、`src/modules/search/useSearchStateMachine.ts`、`src/modules/search/SearchResults.tsx`（含 ExamQuestionCard / ConceptIllustration）、`src/modules/search/mockData.ts`（22 主题 concepts 双层化 + 关键要点/易错回填）、`src/modules/translate/*`、`src/modules/doc/*`、`src/hooks/useAIConfig.ts`、`src/components/settings/{ModelSelector,AddProviderForm}.tsx`、`src/utils/export.ts`
- 测试：`src/services/__tests__/mockAIService.test.ts`、`src/modules/search/__tests__/mindmapDescSize`(7 例)、`src/services/streaming/__tests__/partialJSON.test.ts`(8 例)、题型归一化 9 例、SVG 清洗 6 例、图片 URL 2 例、latex 11 例
- 文档：`docs/design.md`（3.2 / 4.6 / 5.3 / 5.3.1 / 新增 5.3.2 5.3.3）、`docs/architecture.md`（状态机图与 GENERATING 注释）、`docs/history.md`、`docs/worklog.md`、`docs/progress.md`、`docs/todo.md`、`docs/lessons/`

### 构建验证

- `tsc --noEmit`：零错误
- `vitest run`：121/121（中途 103/103、101/101 迭代递增）→ 最终 142/142
- `npm run build`：成功（含"dev server 占用 dist 时需重试/先停服务"的已知现象）

### 关联文档

- `docs/worklog.md`：2026-09-09 详细执行日志（含两轮内容结构/配图/题型迭代）
- `docs/lessons/`：并行编辑竞态、dev server 锁 dist 等教训

### 经验教训

- **`git stash` 在本仓库不可用**：执行 `git stash push` 时 `.git` 目录被移入回收站且 stash 报 `<sha> is not a valid object`（仓库存在损坏对象）。需要基线比对时改用只读的 `git diff`/`git show`，或让用户先提交。
- **"流式"必须真流式**：分块 `setTimeout` 弹出只是把等待伪装成分段出现；真流式需要增量 JSON 解析 + 节流 setState，且最终态要用服务端完整结果兜底一次。
- **判断生成是否写完不要用带 repair 的解析器**：`parseJSONResponse` 会把截断 JSON 补成合法，导致续写逻辑被静默跳过；必须用严格的闭合判定。

---

## 2026-09-06（v1.5.0 知识搜索内容增强：核心概念区块重构 + Mock 数据全量升级新格式）


### 事件

- **背景**：v1.5.0 知识搜索内容增强进入落地阶段。用户反馈核心概念缺少知识点详细说明，且产品处于开发期，mock 数据必须永远适配最新格式。分两次完成：
- **2026-09-05 核心概念区块重构**：
  - 类型层：`SearchGenerateResponse/PartialResponse`、`GeneratedKnowledge` 新增 `conceptsOverview?: string`（核心概念总述）；`Concept.content` 升级为 `{ elementary, advanced }` 双层结构，概念可选 `example`
  - AI 层：baseAIProvider concepts 提示词改为"核心概念详解"——先输出 conceptsOverview（3~5 句，点明下文关联概念及关系），概念含初等/高等双层；fallback 默认值补字段
  - 状态机：concepts 步合并 conceptsOverview（search 与 selectGraphNode 两处）
  - UI：SearchResults 核心概念标题下渲染灰色总述段落；概念区两栏改完全上下单列；示例从定义卡片解耦为独立琥珀色卡片；删除无数据源的旧 examples/relatedResults 死区块；loading 步骤文案修正；handleCopy 与 export.ts 导出按新格式重写
- **2026-09-06 Mock 数据全量升级**：
  - `mockData.ts` 新增 `MockGeneratedConcept` 接口；**22 个真实主题** concepts 全部双层化，每主题补 conceptsOverview 总述，公式/原理类概念补生活化示例（如 F=ma 的 5m/s²、相对速度两车同速、锌铜电池电子守恒）；13 个思维导图测试主题经 mindMapTestCommon 同步新格式
  - `mockAIService.ts` generatedData 分支适配：concepts 直接透传新格式、总述优先取数据、conceptExamples 从概念 example 字段提取、summary 用首概念严谨层、知识脉络 relatedTopics 取自思维导图分支标题
  - 修复并行 Edit 竞态导致的 4 处文件损坏（速度/引擎交界、牛顿第一/第二定律概念区乱码、文件尾部函数重复 5 份）

### 文件变更

- 代码：`src/modules/search/mockData.ts`（类型+22主题数据+乱码修复）、`src/services/mockAIService.ts`、`src/services/baseAIProvider.ts`、`src/types/ai.ts`、`src/types/index.ts`、`src/modules/search/useSearchStateMachine.ts`、`src/modules/search/SearchResults.tsx`、`src/utils/export.ts`
- 测试：`src/services/__tests__/mockAIService.test.ts`（+5 新格式用例，批量校验改为直接断言数据源）、状态机测试补总述断言
- 文档：`docs/worklog.md`（2026-09-05、2026-09-06 两条）、`docs/todo.md`、`docs/progress.md`、`docs/history.md`、`docs/lessons/`

### 构建验证

- `npm run build`：通过（仅 chunk >500kB 体积警告）
- `npm test`（vitest）：56/56 全部通过
- 浏览器实测"牛顿第二定律"4/4 PASS：核心概念总述显示、初等/高等双层解释、独立示例卡片含 5m/s²、知识脉络为真实导图分支（经典力学/工程应用）

### 经验教训

- **同一文件严禁并行发起多个 Edit**：并行编辑产生竞态，工具报告成功但内容错位/丢失/乱码。同文件编辑必须严格串行；替换后用 grep 验证无旧格式残留
- 批量主题测试不要串行走带 setTimeout 的 mock 服务（易超时），直接断言数据源本身更快更稳定

### 关联文档

- `docs/worklog.md`：2026-09-05、2026-09-06 详细执行日志
- `docs/lessons/`：并行编辑竞态教训

---

## 2026-09-04（项目冗余清理 + 文档同步 + 开发服务器启动）


### 事件

- **背景**：多模型 v2 改造完成后项目积累了若干死代码与过期文档。用户要求清理冗余、同步文档管理并启动开发服务器。依据"开发期"5 条约束，被替代代码直接删除，不备份、不留兼容层。
- **删除死代码**（引用收敛确认零外部 import）：
  - `src/modules/visual/` 整个目录（AlgorithmVisual.tsx、FunctionChart.tsx、algorithms.ts、index.tsx）—— m005/m006 弃用功能残留
  - `src/hooks/useDebounce.ts`、`src/hooks/useLocalStorage.ts` —— 零引用
  - `.env`、`.env.example` —— 环境变量方案早已废弃，源码对 `import.meta.env` 零引用；`.env` 内含明文 GLM 密钥（安全隐患，已提醒用户考虑轮换）
  - `src/types/ai.ts` 中 `AIMetadata.providerId` 死字段
  - npm 依赖 `echarts`、`echarts-for-react`（visual 删除后零引用）
- **小修**：`utils/jsonRepair.ts`、`services/baseAIProvider.ts` 中"从 glmAIService 迁移"等过时注释；`components/settings/ModelSelector.tsx` 重复 import（`getProviderInfo as _gpi`）
- **重写 `scripts/smoke-test.ts`**：旧脚本引用已删除的 `tryMigrateLegacy` 且断言 version 1，运行即报错。重写为 v2 版 7 组 45 例：PROVIDER_META 完整性、工厂函数、辅助函数（含自定义厂商）、JSON 4 层修复、v2 存储读写（损坏回退/缺 provider 补全/v1 不识别/非法 activeProviderId 回退）、customProviders 读写解析、路由判定。存储类测试用带 query 的动态导入绕过 `cachedRoot` 模块缓存
- **文档同步**：design.md / architecture.md 全面更新为 v2 架构描述（GenericAIProvider + PRESET_OVERLAYS、customProviders、v2 存储结构、无环境变量、3 Tab 配置面板、技术栈去 ECharts）；goal.md、todo.md、progress.md、versions.md、milestones m005/m006 README 中 visual"代码保留待评估"统一更新为"2026-09-04 已删除"；project-document-manager.md / workflow-manager.md 死代码条款从"保留待评估"改为"开发期直接删除"；demo_release_content.md 技术栈同步
- **开发服务器**：Vite dev server 后台启动，<http://localhost:5173/>

### 文件变更

- 删除：`src/modules/visual/`（4 文件）、`src/hooks/useDebounce.ts`、`src/hooks/useLocalStorage.ts`、`.env`、`.env.example`
- 修改：`package.json` + package-lock.json（卸载 echarts/echarts-for-react）、`src/types/ai.ts`、`src/utils/jsonRepair.ts`、`src/services/baseAIProvider.ts`、`src/components/settings/ModelSelector.tsx`
- 重写：`scripts/smoke-test.ts`（v2，45 例）
- 文档：`docs/design.md`、`docs/architecture.md`、`docs/goal.md`、`docs/todo.md`、`docs/progress.md`、`docs/versions.md`、`docs/demo_release_content.md`、`docs/project-document-manager.md`、`docs/workflow-manager.md`、`docs/worklog.md`、`docs/milestones/m005-visualization/README.md`、`docs/milestones/m006-algorithm/README.md`

### 构建验证

- `npx tsc --noEmit`：零错误
- `npx tsx --test scripts/smoke-test.ts`：45/45 全部通过（7 组）
- Vite 开发服务器正常启动（<http://localhost:5173/）>

### 关联文档

- `docs/worklog.md`：2026-09-04 详细执行日志
- `docs/milestones/m005-visualization/README.md`、`docs/milestones/m006-algorithm/README.md`：弃用功能最终处置记录

---

## 2026-09-03（声明产品阶段为开发期 + Skill 新增生命周期阶段原则）

### 事件

- **背景**：AI 多模型下拉化改造中发现，项目此前缺少"产品阶段"的明确标注，导致开发中曾为不存在的老用户编写迁移逻辑和 deprecated 兼容层（后已删除）。用户要求：① 项目文档明确"产品未正式落地，不需考虑旧版本兼容"，避免无用冗余；② 将此原则沉淀为 project-document-manager Skill 的通用规则。
- **项目文档声明**：`docs/project-document-manager.md` 顶部新增「产品生命周期阶段：开发期（未正式落地）」章节，列明 5 条开发期约束（不考虑向后兼容/不写迁移逻辑/不保留兼容层/不做冗余防御/重构即重写）及阶段切换条件；「关键约束」新增第 1 条引用
- **goal.md 同步**：目标状态区新增产品阶段声明；AI 服务清单更新为多模型架构（GenericAIProvider 工厂 + 9 预设型号 + 自定义厂商/模型无限接入）
- **Skill 通用化**：`~/.trae-cn/skills/project-document-manager/SKILL.md` 新增「产品生命周期阶段（最高优先级约束）」章节（开发期/运营期两阶段定义表、4 条执行规则、判断信号），基本模板增加阶段声明字段；「触发后第一步」要求首先读取阶段声明

### 文件变更

- 更新 `docs/project-document-manager.md`：新增产品阶段章节 + 关键约束第 1 条
- 更新 `docs/goal.md`：目标状态补充阶段声明；AI 已实现清单更新为多模型
- 更新全局 Skill `c:\Users\asus\.trae-cn\skills\project-document-manager\SKILL.md`：新增生命周期阶段原则与模板字段（适用所有项目）

### 构建验证

- 本次为纯文档/Skill 规则更新，未触及代码，无构建验证

### 关联文档

- `docs/project-document-manager.md`：本项目阶段声明载体
- project-document-manager Skill（全局）：通用阶段原则

---

## 2026-08-04（创建 workflow-manager.md 替代旧 workflow.md）

### 事件

- **背景**：旧 `docs/workflow.md` 是项目早期的工作流文档，与 workflow-manager Skill 的最新规范脱节。用户要求按最新 Skill 方式补充 `workflow-manager.md`，替代旧文档。
- **创建 workflow-manager.md**：基于 workflow-manager Skill 最新模板创建项目级执行规范，内容包括：
  - 任务类型（10 类单任务 + 5 类常见组合）
  - 5 步执行流程（读取核心文档 → 理解需求 → 确认需求（可选）→ 执行 → 记录日志 → 汇总反馈）
  - 项目特定适配：基础文档用 `convention.md` 替代未启用的 `config.md`；追加读取清单对齐本项目实际启用文档
  - Git 集成：手动提交（对齐项目实际）
  - 项目特定规范 8 条：PRD 唯一真实来源、代码>文档、外部文件处理、死代码处理、知识目录 vs 知识图谱、6 种卡片、AI 密钥、构建验证
  - 继承旧 workflow.md 的决策机制（必须确认的 6 种情况）和构建验证要求（npm run build）
- **删除旧 workflow.md**：使用 DeleteFile 删除 `docs/workflow.md`
- **同步更新引用**：convention.md、goal.md、project-document-manager.md 中的 `workflow.md` 引用全部更新为 `workflow-manager.md`

### 文件变更

- 新建 `docs/workflow-manager.md`：workflow-manager Skill 项目级执行规范
- 删除 `docs/workflow.md`：旧项目工作流文档
- 更新 `docs/convention.md`：文档清单 `workflow.md` → `workflow-manager.md`；变更记录追加一条
- 更新 `docs/goal.md`：关联文档"项目工作流" → "工作流管理配置"
- 更新 `docs/project-document-manager.md`：文档清单同步更新
- 更新 `docs/worklog.md`：追加本次任务日志

### 构建验证

- 本次为纯文档修正，未触及代码，无构建验证

### 关联文档

- 新建 `docs/workflow-manager.md`：本次创建的项目级配置
- 更新 `docs/convention.md`：文档清单同步

---

## 2026-08-04（文档同步重大修正）


### 事件

- **背景**：用户反馈项目记忆被错误写进全局 user_profile.md；项目文档存在重大同步失误——`progress.md` 把多项未实际完成的修正标记为"已完成"。本次全面校对实际文件状态并修正。
- **全局记忆修正**：从 `c:\Users\asus\.trae-cn\memory\user_profile.md` 移除项目特定内容（硬约束、Skill 架构中关于本项目细节），保留全局通用偏好；项目特定约束改由 `c:\Users\asus\.trae-cn\memory\projects\-e-Program-Workspace-ai-office-assistant\project_memory.md` 维护
- **创建项目文档管理配置**：新建 `docs/project-document-manager.md`，定义本项目文档同步规范、操作类型判断矩阵、五段式 history.md 格式、关键约束（PRD 唯一真实来源、知识图谱 vs 知识目录、6 种卡片组件状态、11 种文档类型、AI 服务、mock fallback）
- **PRD v2.1 同步修正**：
  - "知识图谱导航"改名为"知识目录导航"，标记为"暂不考虑"
  - 6 种知识卡片标记为"未完成/待优化设计"
  - 词典翻译自动切换改为手动切换（对齐实际实现）
  - 文档类型 10→11（含 `general` 通用类型）
  - 新增 v2.1 变更说明
- **goal.md 功能清单修正**：版本状态改为"v1.4.0 部分完成"；移除未实现功能（知识结构图谱、6 种知识卡片完整展示、阶段切换、概念关联跳转）；区分"已完成/暂不考虑/未完成"三类
- **todo.md 状态修正**：当前状态改为"v1.4.0 部分完成"；新增 P0 未完成项（6 种知识卡片完整展示、知识图谱导航重新评估）；已弃用项单列（动态可视化、算法动画、知识图谱导航 SVG）
- **versions.md 版本修正**：移除 v0.1.0/v0.2.0 中算法动画引用；v1.2.0 "知识图谱导航"修正为"知识目录占位"；v1.3.0 移除快速/归并排序
- **issues.md 新增未解决项**：新增"6 种知识卡片完整展示未完成""知识图谱导航未完成"两条待解决项
- **design.md 重写为 v1.1**：5 种卡片→6 种（补 `FormulaCard`）；"知识结构图谱"→"知识目录"（明确标注 div 层级树、非 SVG 知识图谱）；架构图加入收藏面板、AI 服务层、状态层；数据模型全面对齐 `src/types/index.ts`（`KnowledgeType` 7 值、`KnowledgeCardData` 6 种、`DocType` 11 种、`HistoryItem.type` 5 种、`WordResult`/`SentenceResult`/`FavoriteItem` 等）；新增 AI 服务抽象层章节
- **milestones 全量修正**：
  - m005-visualization 状态：已完成 → ⛔ 已弃用
  - m006-algorithm 状态：已完成 → ⛔ 已弃用（m010 随之弃用）
  - m007-chat 状态：待开发 → ✅ 已完成（补齐追问对话实际完成内容）
  - m001-framework 补齐实际完成内容（Vite+React+TS、4 个 Tab、主题切换、语言切换、全局菜单）
  - m002-search 标注 6 种卡片未完成；补齐思维导图、状态机、渐进式生成等已完成内容
  - m003-translate 修正为"手动切换查词/翻译模式"（非自动检测）；补齐 TTS、关联术语、搭配、语域、词源
  - m004-doc 文档类型 5→11；补齐 Markdown 渲染、PDF 导出、浏览中状态修复
- **convention.md 文档清单补全**：新增 `project-document-manager.md`、`worklog.md`、`workflow.md`、`progress.md`、`milestones/`、`references/`、`external/`；新增"文档同步时看 project-document-manager.md"查阅规则；冲突处理优先级加入"代码实现 > 所有文档"

### 文件变更

- 更新 `c:\Users\asus\.trae-cn\memory\user_profile.md`：移除项目特定内容
- 更新 `c:\Users\asus\.trae-cn\memory\projects\-e-Program-Workspace-ai-office-assistant\project_memory.md`：补充项目硬约束
- 新建 `docs/project-document-manager.md`：项目级文档管理规范
- 更新 `docs/prd.md`：v2.1 同步修正
- 更新 `docs/goal.md`：功能清单修正
- 更新 `docs/todo.md`：状态修正
- 更新 `docs/versions.md`：版本修正
- 更新 `docs/issues.md`：新增未完成项
- 重写 `docs/design.md`：v1.1 架构与数据模型修正
- 更新 `docs/milestones/m001-framework/README.md`：补齐实际完成内容
- 更新 `docs/milestones/m002-search/README.md`：6 种卡片未完成说明
- 更新 `docs/milestones/m003-translate/README.md`：手动切换修正
- 更新 `docs/milestones/m004-doc/README.md`：11 种文档类型
- 更新 `docs/milestones/m005-visualization/README.md`：状态改弃用
- 更新 `docs/milestones/m006-algorithm/README.md`：状态改弃用
- 更新 `docs/milestones/m007-chat/README.md`：状态改已完成
- 更新 `docs/convention.md`：文档清单补全
- 更新 `docs/progress.md`：修正误报为已完成的条目

### 构建验证

- 本次为纯文档修正，未触及代码，无构建验证

### 关联文档

- 更新 `docs/project-document-manager.md`：本次同步的执行规范
- 更新 `docs/convention.md`：文档清单与查阅优先级
- 更新 `docs/prd.md`：v2.1 需求基线
- 更新 `docs/design.md`：v1.1 架构基线

### 经验教训

- **progress.md 误报已完成**：原 `progress.md` 在"近期工作记录"中把 `design.md/milestones/convention.md/issues.md` 标记为"✅ 完成"，但实际文件未修改。教训：**文档同步状态必须以实际文件内容为准，不能仅凭计划记录**；每完成一项应立即读取文件确认，或在 worklog.md 中记录真实执行结果。
- **项目记忆与全局记忆混淆**：项目特定硬约束被误写入 `user_profile.md`。教训：**`user_profile.md` 只放跨项目通用偏好，项目特定约束一律放 `project_memory.md`**。
- **里程碑状态漂移**：m007 实际早已完成但 README 一直标"待开发"；m005/m006 已弃用但 README 仍标"已完成"。教训：**里程碑 README 状态需随版本演进同步更新，不能只在 versions.md 中记录**。

---

## 2026-07-14（渐进式生成拆分与JSON解析增强）


### 事件

- **渐进式生成拆分**：将一次性 `generate` 拆分为3步 `generatePartial`（mindMap/content/assessment），每步完成后更新 `generatedData`，UI渐进显示已完成内容。搜索和图谱节点点击均使用3步调用
- **AI数据格式规范化**：新增 `sanitizeMindMap` 和 `sanitizeMindMapNode` 函数，自动修复AI返回的不规范思维导图数据：缺少根节点时创建包裹根节点、数字level转为NodeLevel字符串常量、清除非叶子节点的description、清除叶子节点的空children、用路径前缀（如`r-b1-l1`）生成全局唯一id避免React key冲突
- **QA上下文分离**：`followup` 接口增加 `mode` 参数（'search'|'qa'），search模式基于主题+历史回答追问，qa模式基于历史对话直接回答。接口复用但system prompt和prompt按模式区分
- **GLM max_tokens提升**：high深度从8000提升到16000，避免长内容被截断导致JSON解析失败
- **JSON解析容错增强**：新增 `cleanJSONText` 函数处理中文引号/全角空格/零宽字符/BOM/字符串内换行；新增 `repairTruncatedJSON` 函数补全截断JSON的括号
- **JSON解析进一步增强**：`cleanJSONText` 增加对 `\u2028`（行分隔符）和 `\u2029`（段分隔符）的处理（这些字符在JavaScript中合法但在JSON中非法）；`repairTruncatedJSON` 增强尾部不完整片段的清理（处理 `"key":` / `"key"` / `,` 等多种截断模式）并重新统计括号；错误信息包含原始响应前500字符方便诊断
- **JSON中文标点系统性修复**：建立 `FULLWIDTH_PUNCT_MAP` 完整映射表，覆盖AI可能误用的所有全角/中文标点：全角逗号 `，`（U+FF0C）→`,`、顿号 `、`（U+3001）→`,`、全角冒号 `：`（U+FF1A）→`:`、全角花括号 `｛｝`→`{}`、全角方括号 `［］`→`[]`、全角反斜杠 `＼`→`\`。所有替换仅在字符串外（JSON结构部分）进行，字符串内中文标点保持不变。中文引号类字符（U+201C/D/E/F、U+300C/D、U+300E/F、U+FF02）在字符串识别前全局替换为英文双引号，确保字符串边界识别正确
- **JSON非法转义修复**：`cleanJSONText` 在字符串内部扫描时检测非法转义序列。JSON标准仅允许 `\"` `\\` `\/` `\b` `\f` `\n` `\r` `\t` `\uXXXX`，AI生成的LaTeX公式分隔符 `\(...\)`、`\frac` 等都是非法转义。修复方式：遇到非法转义时在反斜杠前再加一个反斜杠（`\(`→`\\(`），使JSON能正确解析且字符串内容中保留LaTeX反斜杠。`\u` 需检查后4位是否为合法hex，不足则视为非法
- **JSON解析多层修复体系**：`parseJSONResponse` 建立4层修复策略：①cleanJSONText（字符级清洗+非法转义修复）→②移除尾随逗号（`,}` `, ]`→`}` `]`）→③repairTruncatedJSON（智能迭代截断补全）→④详细诊断日志（包含具体错误消息、首尾600/300字符）。每层失败后自动降级到下一层，最大化解析成功率
- **repairTruncatedJSON重写为迭代式**：不再是一次性补括号，而是最多10次迭代——每次先补全括号尝试解析，失败则从后往前找最近的逗号截断（移除不完整的最后一个元素/属性），找不到逗号则砍20字符。找到能解析的位置就立即返回，确保返回的一定是合法JSON（只是可能缺少尾部部分数据）
- **generatePartial提升到max深度**：三个part（mindMap/content/assessment）全部从'high'改为'max'，max_tokens从16000提升到65536，避免内容被token限制截断
- **思维导图节点标题优化**：节点div添加 `title` 属性，悬停时显示完整标题（解决省略号截断无法查看完整标题的问题）
- **GLM prompt三层优先级**：所有生成prompt按"来源→内容→格式"三层组织，搜索/问答/查词/翻译/文档各模式prompt完全分离，避免相互干扰
- **思维导图mock测试数据**：新增14个测试用例覆盖3层/4层/混合/极端场景（10个一级分支、叶子无描述、非叶子有描述）

### 文件变更

- 更新 `src/services/glmAIService.ts`：新增 cleanJSONText/repairTruncatedJSON/sanitizeMindMap/sanitizeMindMapNode；parseJSONResponse 增强容错；callGLMWithJSON 错误信息包含preview；max_tokens 提升到16000；generatePartial 三步拆分；followup 增加 mode 参数；所有 prompt 按三层优先级重写
- 更新 `src/types/ai.ts`：新增 GeneratePart 类型（'mindMap'|'content'|'assessment'）；新增 SearchGeneratePartialResponse 接口；followup 签名增加 mode 参数
- 更新 `src/modules/search/useSearchStateMachine.ts`：search 和 selectGraphNode 改用3步 generatePartial 调用；followup 传入 mode='search'
- 更新 `src/modules/search/hooks/useSearchMode.ts`：QA 调用 followup 传入 mode='qa'
- 更新 `src/services/mockAIService.ts`：添加 generatePartial mock 实现和 followup mode 参数适配
- 更新 `src/modules/search/SearchResults.tsx`：思维导图节点div添加 title 属性
- 更新 `src/modules/search/mockData.ts`：新增14个思维导图测试用例
- 新增 `.trae/documents/ai_service_architecture.md`：综合AI服务架构文档

### 构建验证

- TypeScript 类型检查：通过

---

## 2026-07-13（GLM深度控制与问答模式彻底修复）

### 事件

- **GLM思考深度控制**：`callGLM` 添加 `depth` 参数，搜索生成和文档生成使用 `high`（temperature 0.3, max_tokens 8000），其他使用 `medium`（temperature 0.7, max_tokens 4000）
- **搜索模式根节点修复**：提示词明确要求根节点就是知识点本身，不要用"XX应用"等衍生词
- **语言要求修改**：所有提示词中"语言必须与用户输入语言一致"改为"语言以用户选择的语言为准"
- **问答setState警告彻底修复**：用 `qaMessagesRef` 追踪最新消息，不再在 `setQAMessages` updater 中调用 `updateQASession`，彻底消除渲染期间更新其他组件的警告
- **示例问题点击无反应修复**：移除 `pendingLoadSessionRef` + useEffect 的间接模式，`loadQASession` 和 `sendMessage` 直接调用 `setQAMessages`，解决 useEffect 依赖不触发的问题
- **查词模式隐藏语言方向按钮**：词典查词模式下不显示中英文切换按钮
- **queryWord参数修复**：`queryWord` 实现现在使用 `sourceLang` 和 `targetLang` 参数

### 文件变更

- 更新 `src/services/glmAIService.ts`：添加 GLMDepth 类型和 DEPTH_CONFIG；callGLM/callGLMWithJSON 支持 depth 参数；search.generate 使用 high 深度；document.generate 使用 high 深度；search.generate 提示词添加根节点约束；queryWord 使用 sourceLang/targetLang 参数；语言要求改为以用户选择为准
- 重写 `src/modules/search/hooks/useSearchMode.ts`：用 qaMessagesRef 替代闭包和 ref+useEffect 模式；sendMessage 直接调用 setQAMessages 和 updateQASession；loadQASession 直接调用 setQAMessages；移除所有 pending*Ref 和对应 useEffect
- 更新 `src/modules/translate/TranslateInput.tsx`：查词模式隐藏语言方向按钮
- 更新 `.trae/documents/content_enhancement_plan.md`：语言要求改为以用户选择为准

### 构建验证

- TypeScript 类型检查：通过
- 生产构建：通过

---

## 2026-07-13（Bug修复与收藏适配）

### 事件

- **修复React setState在render中警告**：`loadQASession` 函数中直接调用 `setQAMessages` 导致在渲染期间更新状态，改为使用 ref 延迟更新
- **修复翻译模块关键词/语法说明没显示**：更新 `glmAIService.ts` 中 `queryTranslate` 的提示词，要求AI返回实际的关键词、关联术语和语法说明内容
- **修复问答历史没保存生成内容**：重构 `sendMessage` 函数，直接调用 `updateQASession` 保存完整消息记录，而非通过 ref 间接更新
- **适配收藏内容**：更新收藏详情展示组件，支持词典查词的新字段（搭配、语域、词源）和翻译结果的新字段（关键词、关联术语、语法说明）

### 文件变更

- 更新 `src/modules/search/hooks/useSearchMode.ts`：修复 `loadQASession` 的 setState 警告；重构 `sendMessage` 直接调用 `updateQASession`；移除闭包捕获的 `qaMessages` 依赖
- 更新 `src/services/glmAIService.ts`：优化 `queryTranslate` 提示词，要求返回 3-5 个关键词、关联术语和 2-3 条语法说明
- 更新 `src/modules/favorites/index.tsx`：适配词典查词展示（搭配、语域、词源、同义词）；适配翻译结果展示（风格标签、关键词、关联术语、语法说明）

### 构建验证

- TypeScript 类型检查：通过
- 生产构建：通过

---

## 2026-07-12（知识搜索内容增强与词典翻译优化）

### 事件

- **知识搜索模块增强**：概念解释包含"初等"和"高等"两个层次，新增知识脉络（前置知识、关联主题、学习路径）、经典试题（选择/填空/计算/问答）、趣味内容（故事/应用/历史/趣味）
- **词典翻译模块优化**：查词模式增加常用搭配、语域说明、词源字段；翻译模式优化关键词和语法说明展示
- **AI交互原则**：应用提供"空表格"（数据结构定义），AI负责"填写"数据，严格格式约束确保数据合法性
- **思维导图约束**：明确告知AI每个父节点控制3-5个子节点，树高度3-4层，叶子节点必须有简洁说明

### 文件变更

- 更新 `src/types/index.ts`：新增 KnowledgeContext、ExamQuestion、InterestingFact 接口；更新 Concept（content 包含 elementary/advanced）、GeneratedKnowledge、WordResult（添加 collocations/register/etymology）
- 更新 `src/types/ai.ts`：更新 SearchGenerateResponse（新增 knowledgeContext/examQuestions/interestingFacts）、DictionaryQueryResponse（新增 collocations/register/etymology）
- 更新 `src/services/glmAIService.ts`：优化 search.generate 和 translate.queryWord 提示词，严格JSON格式约束
- 更新 `src/services/mockAIService.ts`：支持新增字段的 mock 数据生成，概念内容格式转换
- 更新 `src/modules/search/SearchResults.tsx`：展示知识脉络、经典试题、趣味内容，概念分初等/高等层次
- 更新 `src/modules/translate/WordResult.tsx`：展示常用搭配、语域说明、词源
- 更新 `src/modules/search/components/SearchContainer.tsx`：适配概念内容新格式
- 更新 `src/utils/export.ts`：适配概念内容新格式的导出

### 构建验证

- TypeScript 类型检查：通过
- 生产构建：通过

### 关联文档

- 更新 `docs/todo.md`：标记 v1.5.0 知识搜索和词典翻译任务
- 更新 `.trae/documents/content_enhancement_plan.md`：内容增强计划文档

### 经验教训

- **数据结构驱动**：应用定义清晰的数据格式，AI只负责填充数据，确保数据质量可控
- **分层解释**：概念解释分初等/高等层次，满足不同学习者需求
- **知识脉络**：前置知识、关联主题、学习路径帮助用户建立知识体系

---

## 2026-07-12（代码质量审查与优化）

### 事件

- **删除死代码**：移除 `src/modules/search/MindMap.tsx`（未使用的独立组件，实际使用的是 SearchResults.tsx 中的内嵌 MindMap 函数）
- **提取通用错误处理包装器**：创建 `withFallback` 函数，消除 `glmAIService.ts` 中所有方法重复的 try/catch 模式，支持静态 fallback 值和动态 fallback 函数两种形式
- **统一类型定义位置**：`TranslateMode` 类型从 `TranslateInput.tsx` 迁移到 `src/types/index.ts`，更新所有引用位置
- **清理未使用的导入**：删除 `glmAIService.ts` 中未使用的 `DocumentExportResponse` 导入
- **修复问答模式重复处理问题**：`useSearchMode.ts` 中添加 `processingRef`（Set）追踪正在处理的问题，防止连续输入相同内容导致重复处理
- **修复示例问题被加到输入框**：删除 `QAContainer.tsx` 中 `handleExampleClick` 的 `setValue(question)` 调用
- **修复 React setState 在 render 中警告**：通过 `pendingLoadSessionRef` 和 useEffect 延迟状态更新

### 文件变更

- 删除 `src/modules/search/MindMap.tsx`：死代码清理
- 更新 `src/services/glmAIService.ts`：提取 `withFallback` 包装器，清理未使用导入
- 更新 `src/types/index.ts`：新增 `TranslateMode` 类型定义
- 更新 `src/modules/translate/TranslateInput.tsx`：从 types 导入 `TranslateMode`，移除本地定义
- 更新 `src/modules/translate/index.tsx`：从 types 导入 `TranslateMode`
- 更新 `src/modules/search/hooks/useSearchMode.ts`：添加 `processingRef` 防重复处理，`pendingLoadSessionRef` 延迟状态更新
- 更新 `src/modules/search/components/QAContainer.tsx`：移除 `setValue(question)` 调用

### 构建验证

- TypeScript 类型检查：通过
- 生产构建：通过

### 关联文档

- 更新 `docs/todo.md`：标记代码质量优化任务完成
- 更新 `docs/issues.md`：标记问答模式重复处理、示例问题输入框、setState 警告等问题已解决

### 经验教训

- **死代码清理**：定期检查未使用的组件和导入，保持代码库整洁
- **DRY 原则**：重复的错误处理逻辑应提取为通用包装函数，减少维护成本
- **类型定义集中管理**：共享类型应放在 types 目录，避免分散定义导致不一致
- **幂等性保障**：异步操作需要防重机制，避免重复处理相同请求

---

## 2026-07-12（搜索模块多项修复与体验优化）

### 事件

- **修复 React setState 在 render 中的警告**：问答模式触发 `Cannot update a component while rendering a different component` 警告。解决方案：将 `pendingTouchId` 从 `useState` 改为 `useRef`，在 `useEffect` 中异步执行 `touchHistory`，避免在渲染过程中触发其他组件的状态更新
- **调整问答模式布局**：示例问题和对话内容移到输入框上方，优化用户体验；示例问题组件内容左对齐
- **添加搜索模式追问等待提示**：追问时显示加载动画，提升用户感知
- **简化知识内容导出并添加复制功能**：移除格式选择下拉框，默认导出 Markdown 格式；新增复制按钮，支持一键复制知识内容到剪贴板

### 文件变更

- 更新 `src/modules/search/hooks/useSearchMode.ts`：`pendingTouchId` 改为 `useRef`，`useEffect` 异步执行 touchHistory
- 更新 `src/modules/search/components/QAContainer.tsx`：对话内容和示例问题移到输入框上方，左对齐布局
- 更新 `src/modules/search/components/SearchContainer.tsx`：为 QASection 添加 `isLoading={state === 'FOLLOWUP'}`
- 更新 `src/modules/search/SearchResults.tsx`：移除 exportFormat 状态和格式选择，添加 handleCopy 函数和复制按钮

### 构建验证

- TypeScript 类型检查：通过
- 生产构建：通过（718 modules transformed）

### 关联文档

- 更新 `docs/todo.md`：标记搜索模块修复任务完成
- 更新 `docs/issues.md`：标记 setState 警告、布局问题、追问等待提示、导出复制功能已解决

### 经验教训

- **React 状态更新时序问题**：在渲染过程中调用 setState 更新其他组件的状态会触发警告，应使用 `useRef` + `useEffect` 模式异步执行
- **用户体验优先**：对话内容和示例问题放在输入框上方，符合用户阅读习惯
- **加载状态必不可少**：任何异步操作都应显示加载提示，让用户知道系统正在处理

---

## 2026-07-12（历史记录功能复盘分析）

### 事件

- 系统复盘7月9日之前历史记录功能的成功实现路径和后续变化
- 梳理历史记录功能的四个发展阶段：基础阶段(v1.0.0)→增强阶段(时间自动更新+浏览中标记)→架构重构阶段(通用HistorySidebar+收藏历史分离)→状态同步修复阶段
- 分析"浏览中"状态不显示的根因：viewingQuery 使用 result.title（AI可能修改），与历史记录 item.query（原始topic）不一致
- 明确修复原则：viewingQuery 必须与 item.query 保持一致，使用用户原始输入作为标识
- 总结Markdown渲染问题：AI生成结构化内容需要专用渲染器，不能用pre标签
- 整理历史记录数据结构演变：从简单query+session到HistoryData联合类型

### 文件变更

- 无代码变更，仅文档复盘

### 构建验证

- 无

### 关联文档

- 本次复盘分析
- 关联 `docs/lessons/logic.md`：历史记录状态同步教训

### 经验教训

- **viewingQuery 标识一致性原则**：历史记录的"浏览中"标记依赖 currentViewing === item.query 的精确匹配，必须使用用户原始输入（query/topic）作为标识，不能使用AI修改后的内容（如result.title）
- **复盘是解决复杂问题的有效方法**：当功能出现回归问题时，通过历史文档追溯功能演变路径，能快速定位问题根因
- 数据结构迭代要保持向后兼容：HistoryItem.data 从简单对象扩展为联合类型时，要确保旧数据能正常读取

---

## 2026-07-12（文档生成模块多项修复与优化）

### 事件

- **修复"浏览中"状态不显示**：doc模块新增 currentTopic 状态变量，viewingQuery 从 result.title 改为 currentTopic（原始输入topic），确保与历史记录 item.query 一致
- **新增Markdown渲染支持**：DocResult 从 pre 标签纯文本显示改为 ReactMarkdown + remark-gfm 渲染，支持标题、列表、代码块等富文本格式
- **新增PDF导出功能**：集成 jspdf 库，实现PDF文档生成，支持标题、正文分页和中文显示，导出菜单新增PDF选项
- **文档类型选择器折叠效果**：新增 DocTypeSelector 独立组件，默认折叠显示选中项，展开显示完整类型网格，添加过渡动画
- **类型选择器移到输入框下方**：DocEditor 布局调整，类型选择器从输入框上方移到下方，优化页面空间利用率
- **添加通用文档类型**：作为默认选中类型，降低用户认知成本

### 文件变更

- 新建 `src/modules/doc/DocTypeSelector.tsx`：文档类型选择器组件，支持折叠/展开
- 更新 `src/modules/doc/DocEditor.tsx`：引入 DocTypeSelector，移到输入框下方
- 更新 `src/modules/doc/index.tsx`：新增 currentTopic 状态，修复 viewingQuery 逻辑，确保"浏览中"正常显示
- 更新 `src/modules/doc/DocResult.tsx`：添加 ReactMarkdown + remark-gfm 渲染，新增PDF导出选项
- 更新 `src/utils/export.ts`：添加 exportToPDF 函数，使用 jspdf 生成PDF文档
- 更新 `package.json`：新增 react-markdown、remark-gfm、jspdf 依赖

### 构建验证

- TypeScript类型检查：通过
- 生产构建：通过
- 浏览器测试：通过（浏览中状态正常显示、Markdown内容正确渲染、PDF导出功能可用、类型选择器折叠展开流畅）

### 关联文档

- 更新 `docs/issues.md`：标记浏览中状态、Markdown渲染问题已解决
- 更新 `docs/todo.md`：标记PDF导出、类型选择器优化任务完成

### 经验教训

- **标识一致性是状态匹配的基础**：任何需要与历史记录/收藏等外部数据匹配的场景，都要使用稳定不变的原始标识，不能使用可能被修改的派生值
- **AI生成内容需要专用渲染**：AI生成的Markdown等结构化内容，必须使用对应的渲染器，不能用纯文本标签
- 组件拆分提升可维护性：将类型选择器拆分为独立组件，既实现了折叠效果，又简化了父组件

---

## 2026-07-12（词典翻译模块优化 + AI翻译风格修复）

### 事件

- **移除输入自动检测切换**：删除 handleTextChange 中的 isSingleWord 检测和自动模式切换逻辑，用户需手动切换查词/翻译模式，避免反直觉体验
- **修复翻译风格切换不生效**：新增 performTranslateWithStyle 函数，点击学术/商务/日常风格按钮时重新调用AI翻译，确保风格参数正确传递
- **查词模式直接搜索关键词**：AI直接根据输入关键词查询，不自动判断是单词还是句子

### 文件变更

- 更新 `src/modules/translate/TranslateInput.tsx`：删除自动模式切换逻辑
- 更新 `src/modules/translate/index.tsx`：新增 performTranslateWithStyle 函数，修复风格切换

### 构建验证

- TypeScript类型检查：通过
- 生产构建：通过
- 浏览器测试：通过（手动切换模式正常、风格切换重新生成翻译结果）

### 关联文档

- 更新 `docs/issues.md`：标记输入自动切换、翻译风格切换问题已解决

### 经验教训

- **不要替用户做决定**：自动检测切换模式虽然"智能"，但违反用户直觉，应该让用户明确选择
- 状态变更要触发完整数据流：翻译风格切换不仅要改UI状态，还要重新调用AI生成对应风格的内容

---

## 2026-07-11（AI服务集成 + 历史记录Context重构 + 模式串扰修复）

### 事件

- **真实AI服务集成**：接入智谱GLM-4-Flash API，实现直接问答、词典查词、文本翻译、文档生成的真实AI调用
- **统一AI接口契约**：设计 aiServiceProvider 抽象层，支持 mock 与真实AI无缝切换，新增 glmAIService 实现
- **历史记录从useState hook改为Context模式**：新增 HistoryContext.tsx，使用 React Context + useSyncExternalStore 模式解决多实例状态不同步问题，替代原 useState + key prop 方案
- **修复搜索/问答模式串扰**：两个模式的状态管理混乱导致数据串台，重构为独立状态管理，点击历史记录先检查再恢复
- **修复AI搜索结果重复**：搜索模式生成一次内容后重复显示问题，通过状态机和历史记录检查修复
- **改进JSON解析**：新增 parseJSONResponse 函数，支持解析Markdown代码块格式的JSON，增强错误处理和fallback机制

### 文件变更

- 新建 `src/services/glmAIService.ts`：智谱GLM AI服务实现
- 新建 `src/services/aiServiceProvider.ts`：AI服务提供者，统一接口契约
- 新建 `src/hooks/HistoryContext.tsx`：全局历史记录上下文，基于Context模式
- 更新 `src/App.tsx`：使用 HistoryProvider 包裹应用
- 更新 `src/modules/search/index.tsx`：使用 HistoryContext，修复模式串扰
- 更新 `src/modules/translate/index.tsx`：使用 HistoryContext，接入真实AI
- 更新 `src/modules/doc/index.tsx`：使用 HistoryContext，接入真实AI
- 更新 `src/hooks/useHistory.ts`：保留作为兼容层
- 更新 `package.json`：新增AI服务相关依赖

### 构建验证

- TypeScript类型检查：通过
- 生产构建：通过
- 浏览器测试：通过（真实AI返回结果、各模式独立不串扰、历史记录正常同步）

### 关联文档

- 更新 `docs/todo.md`：标记AI集成任务完成
- 更新 `docs/versions.md`：v1.4.0 AI集成版本
- 更新 `docs/issues.md`：标记模式串扰、结果重复等问题已解决

### 经验教训

- **Context是解决全局状态同步的标准方案**：比起 key prop 强制重挂载的hack方式，React Context 更优雅、更可靠
- **抽象层让切换更灵活**：通过 aiServiceProvider 抽象层，可以轻松在mock和真实AI之间切换，不影响业务代码
- AI返回格式可能不规范：需要健壮的JSON解析逻辑，支持多种格式和错误降级
- 模式隔离很重要：搜索和问答、查词和翻译，不同模式的状态必须完全隔离，避免串扰

---

## 2026-07-11（思维导图布局算法重构：两阶段递归 + 叶子描述外置）

### 事件

- 重构思维导图布局算法为"先测量后布局"的两阶段递归（measureNode + layoutMeasuredNode）
- 测量阶段（后序遍历）：从叶子节点向上计算每个节点的子树占用空间（subtreeW/subtreeH/topOffset/bottomOffset）
- 布局阶段（先序遍历）：从根节点向下分配节点位置，父节点始终在子树垂直中心
- 引入 topOffset/bottomOffset 精确表示子树范围，解决叶子节点描述导致的垂直对齐偏差
- 叶子节点描述显示在节点下方外部（不占用节点内部空间），描述宽度计入子树宽度
- 连接线改为流程图式直角折线（从节点边缘出发，中点转折）
- 支持3-4级动态生成节点，每个父节点3-5个子节点
- 动态计算初始偏移量，使内容在画布中居中显示
- 更新MindMapNode接口，新增description字段支持叶子节点说明
- 更新mock数据结构，为叶子节点添加description内容

### 文件变更

- 更新 `src/types/index.ts`：MindMapNode接口新增description可选字段
- 重写 `src/modules/search/SearchResults.tsx`：两阶段递归布局算法、直角折线连接、描述外置
- 更新 `src/modules/search/mockData.ts`：生成数据新增description字段

### 构建验证

- TypeScript类型检查：通过
- 生产构建：通过（81 modules transformed）
- 浏览器测试：通过（11个节点正确布局、描述外置无重叠、父节点垂直居中、直角折线连接美观）

### 关联文档

- 更新 `docs/todo.md`：标记思维导图布局优化任务完成

### 经验教训

- 树状布局采用"先测量后布局"的两阶段递归最稳定：先算子树尺寸，再分配位置
- 子树范围用topOffset/bottomOffset表示，比单纯subtreeH更精确（尤其当节点不在子树中心时）
- 水平方向布局：子树宽度 = 节点宽 + 层级间距 + 最大子节点子树宽
- 垂直方向布局：父节点中心 = 子树垂直中心，子节点按subtreeH依次排列

---

## 2026-07-11（思维导图重构：中心发散布局 + 画布拖动）

### 事件

- 重写思维导图组件：从树形层级结构改为从中心向四周发散的布局
- 全部使用矩形节点（去掉根节点的圆形和折叠效果）
- 节点之间使用SVG直线连接（替代CSS竖线）
- 新增画布拖动功能（mousedown/mousemove/mouseup + transform translate）
- 新增"拖动画布查看"提示文字
- 布局算法：根节点居中，一级子节点按角度均匀分布（R1=200），二级子节点在父节点外侧扇形分布（R2=130）

### 文件变更

- 重写 `src/modules/search/SearchResults.tsx`：删除递归MindMapNodeItem，新增layoutMindMap布局函数和MindMap组件

### 构建验证

- TypeScript类型检查：通过
- 生产构建：通过（81 modules transformed）
- 浏览器测试：通过（根节点居中，子节点向上/左下/右下发散，SVG直线连接，画布可拖动）

### 关联文档

- 更新 `docs/todo.md`：记录思维导图重构任务

### 经验教训

- 中心发散布局用极坐标计算节点位置：x = CX + R * cos(angle), y = CY + R * sin(angle)
- 画布拖动用transform translate + ref记录拖拽起点，简洁高效

---

## 2026-07-11（叶子节点与知识点绑定验证 + 搜索框清空修复）

### 事件

- 专家测试验证叶子节点与知识点绑定：点击"牛顿第二定律（运动定律）"叶子节点和直接搜索"牛顿第二定律"产生相同历史记录（upsert去重生效）
- 修复搜索框搜索后未清空问题：handleSearch后调用setValue('')清空输入框，避免重复搜索时query拼接
- 浏览器测试验证结果：历史记录中"牛顿第二定律"仅有1条记录，两种方式显示内容一致

### 文件变更

- 更新 `src/modules/search/components/SearchInput.tsx`：handleSearch后清空value

### 构建验证

- TypeScript类型检查：通过
- 生产构建：通过（81 modules transformed）
- 浏览器测试：全部通过（6项检查点）

### 关联文档

- 更新 `docs/issues.md`：记录搜索框清空问题已修复

### 经验教训

- 搜索框搜索后应清空，避免用户再次输入时query拼接导致历史记录无法upsert去重

---

## 2026-07-11（知识搜索内容重做 + 交互修复）

### 事件

- 重做知识搜索内容，基于AI生成式设计"模板"数据，包括物理定律（8大类别40+定律）、数学定理、化学反应、重大历史事件、编程算法等知识图谱
- 更新热搜标签为：物理定律、牛顿第二定律、数学定理、勾股定理、化学反应、氧化还原反应、重大历史事件、工业革命、编程算法、排序算法
- 重写知识图谱组件（KnowledgeGraph.tsx）：纯div层级结构，去掉SVG，树形展开/收起交互
- 重写思维导图组件（SearchResults.tsx中的MindMapNodeItem）：改为几何图形示意图形式（圆形、矩形、连接线）
- 修复知识图谱节点展开/收起交互：子节点expanded状态从硬编码false改为从expandedNodes Set正确读取
- 修复历史记录内容冲突：添加generatedData.topic === query一致性检查，确保物理定律和牛顿第二定律记录正确分离
- 修复mockAIService.ts分析逻辑：优先匹配具体知识数据，再匹配图谱，删除partialGraphKey模糊匹配和genericGraph通用图谱
- 修复叶子节点与知识点映射：给KnowledgeGraphNode添加topic字段，"牛顿第二定律（运动定律）"叶子节点通过topic映射到"牛顿第二定律"知识内容，确保一一对应
- "知识图谱"标签改为"知识目录"，更准确表达意图
- 删除mockData.ts中重复的"化学反应"和"编程算法"条目
- 添加theorem知识类型到types/index.ts

### 文件变更

- 更新 `src/types/ai.ts`：KnowledgeGraphNode添加topic可选字段
- 更新 `src/types/index.ts`：KnowledgeType添加theorem类型
- 更新 `src/services/mockAIService.ts`：扩展知识图谱数据（物理定律8大类别）、所有叶子节点添加topic字段、重写analyze分析逻辑
- 更新 `src/modules/search/mockData.ts`：扩展生成数据（牛顿第二定律、勾股定理、氧化还原反应等）、删除重复条目
- 重写 `src/modules/search/KnowledgeGraph.tsx`：纯div层级结构、修复展开/收起状态管理、"知识图谱"改为"知识目录"
- 重写 `src/modules/search/SearchResults.tsx`：MindMapNodeItem改为几何图形示意图形式
- 更新 `src/modules/search/components/HotTags.tsx`：热搜标签更新为10个指定关键词
- 更新 `src/modules/search/components/SearchContainer.tsx`：标题改为"知识目录"
- 更新 `src/modules/search/useSearchStateMachine.ts`：selectGraphNode使用node.topic || node.title
- 更新 `src/modules/search/index.tsx`：handleNodeClick使用node.topic || node.title、添加generatedData.topic === query一致性检查

### 构建验证

- TypeScript类型检查：通过
- 生产构建：通过（81 modules transformed）

### 关联文档

- 更新 `docs/todo.md`：记录知识搜索内容重做任务
- 更新 `docs/issues.md`：记录并修复的问题

### 经验教训

- React中useState初始化不能放在另一个useState回调中，会导致状态不生效
- 子组件的expanded状态不能硬编码为false，需要从父组件的expandedNodes Set正确传递
- 历史记录更新时需要一致性检查（generatedData.topic === query），避免切换记录时内容串台
- 叶子节点title与知识数据key不一致时，需要通过topic字段建立映射关系

---

## 2026-07-09（v2.0 需求分析文档）

### 事件

- 生成 v2.0 需求分析文档，涵盖五大核心改进：AI架构、搜索流程重新设计、收藏独立空间、AI接口契约、文档生成优化
- 搜索模块核心流程：输入 → 验证 → 分析 → 知识图谱/直接生成 → 思维导图+概念+示例+卡片 → 追问
- 收藏功能改为独立空间体验方式，与历史记录彻底解耦
- 文档生成优化：类型选择收起/展开、支持6种文件格式导出（txt, md, docx, xlsx, pptx, pdf）
- 所有模块预留AI接口，Mock数据改为动态生成

### 关键技术问题

**架构设计**：采用三层架构（前端应用层 → AI接口层 → 数据持久化层），统一AI接口契约

**搜索状态机**：8个状态（IDLE → VALIDATING → INVALID/ANALYZING → KNOWLEDGE_GRAPH/GENERATING → DISPLAYING → FOLLOWUP）

### 文件变更

- 新建 `docs/requirements-v2.md`：完整的v2.0需求分析文档
- 更新 `docs/todo.md`：添加v2.0三个阶段的任务列表
- 更新 `docs/progress.md`：记录需求分析文档生成

### 构建验证

- 文档生成：通过

### 关联文档

- 更新 `docs/todo.md`：添加v2.0任务
- 更新 `docs/progress.md`：记录工作进展

---

## 2026-07-09（深色模式重新设计）

### 事件

- **主题切换失效修复**：`useTheme` 从 `useState` 重构为 `useSyncExternalStore` 模式，解决多实例状态不同步问题（与 `useFavorites` 架构统一）
- **防闪烁处理**：`index.html` 添加内联脚本，在 React 加载前应用主题，消除 FOUC（Flash of Unstyled Content）
- **深色模式全量适配**：18 个组件文件添加 `dark:` Tailwind 变体，修复深色模式下大片亮色区域问题
- **配色重新设计**：从 `slate`（蓝灰）色系改为 `zinc`（中性灰）色系，三层背景层次（950→900→800），增强阴影和 `color-scheme` 原生支持

### 关键技术问题

**问题根因**：`useTheme` 使用 `useState` 内部状态，App.tsx 和 Header.tsx 各自独立实例化，切换主题时两处 state 冲突——Header 改了主题，但 App 的 `useEffect` 会用旧 state 覆盖回去。

**架构统一**：三个全局 Hook 现都使用 `useSyncExternalStore` 模式：

| Hook           | 状态来源                  | 同步机制                   |
| -------------- | --------------------- | ---------------------- |
| `useFavorites` | 模块级 `sharedFavorites` | `useSyncExternalStore` |
| `useTheme`     | 模块级 `sharedTheme`     | `useSyncExternalStore` |
| `useHistory`   | `useState`（待重构）       | `key` prop 临时方案        |

### 色系对比

| 层级        | 旧（slate 蓝灰）           | 新（zinc 中性灰）          |
| --------- | --------------------- | -------------------- |
| 应用背景      | `slate-900` (#0f172a) | `zinc-950` (#09090b) |
| 卡片/面板     | `slate-800` (#1e293b) | `zinc-900` (#18181b) |
| 输入框/hover | `slate-700` (#334155) | `zinc-800` (#27272a) |
| 边框        | `slate-700`           | `zinc-800`           |

### 文件变更

- 重写 `src/hooks/useTheme.ts`：`useState` → `useSyncExternalStore` + 模块级共享状态 + 系统主题监听 + 跨标签页同步
- 更新 `index.html`：添加防闪烁内联脚本
- 更新 `src/styles/index.css`：深色模式阴影、`color-scheme`、body 背景色
- 更新 18 个组件文件：全局替换 `dark:*slate-*` → `dark:*zinc-*` + 添加缺失的 `dark:` 变体

### 构建验证

- TypeScript 类型检查：通过
- 生产构建：通过（71 modules）

### 关联文档

- 更新 `docs/versions.md`：v1.0.2 更新
- 更新 `docs/todo.md`：标记完成
- 更新 `docs/issues.md`：记录已解决问题

---

## 2026-07-09（历史记录状态同步修复 + 追问对话恢复）

### 事件

- **全局清空历史记录失效**：`useHistory` 在 App.tsx 和各模块中独立实例化，导致 App 调用 `clearHistory()` 后模块 state 不同步。解决方案：使用 `key` prop 强制组件重新挂载（`refreshKey` 状态计数器），重新读取 localStorage 最新数据
- **搜索历史追问对话无法查看**：`updateSession` 更新历史数据时覆盖了整个 `data` 对象，丢失 `result` 和 `generatedData` 字段。解决方案：改用 `...(item.data || {})` 保留原有数据；`handleHistoryClick` 参考问答模式使用 `getSearchSession(item.query)` 获取完整数据
- **收藏内容打开后未加入历史记录**：`showFavorite` 只设置显示状态，未调用 `addHistory`。解决方案：在各模块 `showFavorite` 中添加 `addHistory` 调用
- **清空操作缺少确认提示**：历史记录和收藏清空操作无二次确认。解决方案：新增 `ConfirmDialog` 通用组件，清空历史/收藏时弹出确认对话框

### 关键技术问题

**问题根因**：`useHistory` 使用 `useState` 初始化，每个组件实例独立维护状态，localStorage 变化不会自动同步到其他实例。这是 React Hooks 本地状态与外部存储同步的经典问题。

**解决方案对比**：

| 方案                     | 优点      | 缺点            |
| ---------------------- | ------- | ------------- |
| 切换 Tab 再切回             | 简单      | 可见闪烁，体验差      |
| `key` prop 强制重挂载       | 无闪烁，可靠  | 状态完全重置        |
| `useSyncExternalStore` | 自动同步，优雅 | 实现复杂，需重构 hook |

本次采用方案二（`key` prop）作为快速修复，方案三作为长期架构优化方向。

### 文件变更

- 更新 `src/App.tsx`：新增 `refreshKey` 状态；`handleClearAllHistory` 递增 `refreshKey`；所有模块传递 `key={refreshKey}`；原生 `confirm()` 替换为 `ConfirmDialog` 组件
- 更新 `src/hooks/useHistory.ts`：`updateSession` 使用 `...(item.data || {})` 保留原有数据；`getSearchSession` 返回类型改为 `SearchHistoryData | undefined`，使用 `'result' in data && ('generatedData' in data || 'messages' in data)` 类型守卫
- 更新 `src/modules/search/index.tsx`：`handleHistoryClick` 改用 `getSearchSession(item.query)` 获取数据；`showFavorite` 添加 `addHistory` 调用；`reset()` 增强清除所有状态（`searchMode`、`selectedScopes`、`expanded`）
- 更新 `src/modules/translate/index.tsx`：`showFavorite` 添加 `addHistory` 调用；`reset()` 增强清除所有状态（`mode`、`langDirection`、`translateStyle`）
- 更新 `src/modules/doc/index.tsx`：`showFavorite` 添加 `addHistory` 调用；`reset()` 增强清除所有状态（`docType`）
- 更新 `src/components/layout/Header.tsx`：移除内部 `useHistory` 调用，通过 props 接收 `onClearAllHistory`
- 新建 `src/components/ui/ConfirmDialog.tsx`：通用确认对话框组件（遮罩层、警告图标、动画效果）

### 构建验证

- TypeScript 类型检查：通过
- 生产构建：通过（71 modules）

### 关联文档

- 更新 `docs/versions.md`：v1.0.2 更新
- 更新 `docs/todo.md`：标记完成
- 更新 `docs/issues.md`：记录已解决问题

---

## 2026-07-08（收藏与历史记录架构分离）

### 事件

- 收藏（Favorite）与历史记录（History）职责分离：收藏只保存关键内容 + 用户友好标签，历史记录保存完整交互状态
- `FavoriteItem` 新增 `label` 字段：搜索存搜索词、查词存单词、翻译存原文、文档存标题，替换之前的 `searchQuery`
- `HistoryItem.data` 扩展为联合类型 `HistoryData`：保存完整结果数据，点击历史记录可直接恢复状态，无需重新请求
- 新增历史数据类型：`SearchHistoryData`（含 result + generatedData + messages）、`DictHistoryData`、`TranslateHistoryData`、`DocHistoryData`
- `showFavorite` 不再调用 `addHistory`：打开收藏项直接恢复状态，不产生新历史记录
- `FavoritesPanel` 优先显示 `label`：搜索"物理定律"收藏后显示"物理定律"而非卡片标题"牛顿第二定律"
- 删除浏览中记录时同步清空内容区
- 全局菜单新增：主题切换（亮色/深色）、语言切换（中文/English）、清空所有历史记录


### 文件变更

- 更新 `src/types/index.ts`：`FavoriteItem` 替换 `searchQuery` 为 `label`；新增 `SearchHistoryData`、`DictHistoryData`、`TranslateHistoryData`、`DocHistoryData`、`HistoryData` 联合类型；`HistoryItem.data` 类型更新
- 更新 `src/hooks/useHistory.ts`：`addHistory` 参数从 `session?: QASession` 改为 `data?: HistoryData`；`getSession` 返回类型更新；修复 `touchHistory` 类型问题
- 更新 `src/hooks/useFavorites.ts`：`addFavorite` 参数从 `searchQuery` 改为 `label`
- 更新 `src/modules/search/index.tsx`：`addHistory` 保存完整 `SearchHistoryData`；`handleHistoryClick` 从 `data` 直接恢复状态；`showFavorite` 不再调用 `addHistory`；新增 `handleRemove` 同步清空内容
- 更新 `src/modules/translate/index.tsx`：`addHistory` 保存完整 `DictHistoryData`/`TranslateHistoryData`；`handleHistorySelect` 从 `data` 直接恢复状态；`showFavorite` 不再调用 `addHistory`；新增 `handleRemove`
- 更新 `src/modules/doc/index.tsx`：`addHistory` 保存完整 `DocHistoryData`；`handleHistorySelect` 从 `data` 直接恢复状态；`showFavorite` 不再调用 `addHistory`；新增 `handleRemove`
- 更新 `src/components/favorites/FavoritesPanel.tsx`：`getTitle` 优先使用 `item.label`
- 新建 `src/hooks/useTheme.ts`：主题切换 hook（系统检测 + localStorage持久化）
- 新建 `src/hooks/useLanguage.ts`：语言切换 hook（浏览器检测 + localStorage持久化）
- 更新 `src/components/layout/Header.tsx`：添加全局菜单（主题/语言/设置）
- 更新 `src/App.tsx`：应用主题、深色模式样式
- 更新 `tailwind.config.js`：启用 `darkMode: 'class'`

### 构建验证

- TypeScript 类型检查：通过
- 生产构建：通过（70 modules）

### 架构收益

| 指标    | 重构前                   | 重构后                     |
| ----- | --------------------- | ----------------------- |
| 收藏显示  | 显示卡片标题（可能与搜索词不一致）     | 显示用户友好 label（搜索词/单词/原文） |
| 历史恢复  | 重新触发搜索/翻译             | 直接从 data 恢复完整状态         |
| 收藏→历史 | 打开收藏自动创建历史记录          | 独立状态，互不干扰               |
| 数据完整性 | 仅保存 query + QASession | 保存完整结果数据                |
| 浏览中排序 | 依赖时间戳，收藏打开不置顶         | 按 viewingQuery 动态置顶     |

### 关联文档

- 更新 `docs/versions.md`：v1.0.2 更新
- 更新 `docs/todo.md`：标记完成
- 更新 `docs/issues.md`：记录已解决问题

---

## 2026-07-08（历史模块架构重构）

### 事件

- 历史模块架构重构：三个模块的历史侧边栏合并为通用 `HistorySidebar` 组件
- `useHistory` API 统一：新增 `updateSession` 和 `getSession` 方法，替代分散的 `updateQASession`/`updateSearchSession`/`getQASession`/`getSearchSession`
- props 传递链消除：`timeRefresh` 和 `currentViewing` 从 App.tsx → Header.tsx → FavoritesPanel/各模块的传递链全部移除
- 各组件内部独立调用 `useTimeRefresh()` 和 `useImperativeHandle`，实现状态自治
- 删除冗余文件：`TranslateHistory.tsx`、`DocHistory.tsx`（被通用组件替代）
- `FavoritesPanel` 内部化 `useTimeRefresh()`，移除外部传入依赖

### 文件变更

- 新建 `src/components/history/HistorySidebar.tsx`：通用历史侧边栏组件（支持 teal/amber/blue 三种主题色）
- 更新 `src/hooks/useHistory.ts`：新增 `updateSession(type, query, messages)` 和 `getSession(type, query)` 统一方法；保留原有方法作为兼容层
- 更新 `src/modules/search/index.tsx`：移除内联历史渲染，使用 `HistorySidebar`；移除 `getCurrentViewing` 方法；直接计算 `viewingQuery`
- 更新 `src/modules/translate/index.tsx`：移除 `TranslateHistory` 引用，使用 `HistorySidebar`；移除 `getCurrentViewing` 方法；直接计算 `viewingQuery`
- 更新 `src/modules/doc/index.tsx`：移除 `DocHistory` 引用，使用 `HistorySidebar`；移除 `getCurrentViewing` 方法；直接计算 `viewingQuery`
- 更新 `src/components/favorites/FavoritesPanel.tsx`：内部调用 `useTimeRefresh()`；移除 `timeRefresh` 和 `currentViewing` props；移除浏览中标记（简化）
- 更新 `src/components/layout/Header.tsx`：移除 `timeRefresh` 和 `currentViewing` props 传递
- 更新 `src/App.tsx`：移除 `useTimeRefresh` 调用、`currentViewing` state、`useEffect` 监听逻辑
- 删除 `src/modules/translate/TranslateHistory.tsx`：已被通用组件替代
- 删除 `src/modules/doc/DocHistory.tsx`：已被通用组件替代

### 构建验证

- TypeScript 类型检查：通过
- 生产构建：通过（68 modules）

### 重构收益

| 指标          | 重构前          | 重构后         | 改善幅度     |
| ----------- | ------------ | ----------- | -------- |
| 修改历史记录 UI   | 需要修改 3-4 个文件 | 需要修改 1 个文件  | **75%+** |
| 新增模块接入      | 需要编写新组件      | 只需配置 config | **80%+** |
| props 传递链长度 | 3-4 层        | 0 层         | **100%** |
| 删除冗余文件      | -            | 2 个         | -        |

### 关联文档

- 更新 `docs/versions.md`：v1.0.2 更新
- 更新 `docs/todo.md`：标记重构完成
- 更新 `docs/issues.md`：记录已解决问题

---

## 2026-07-08（搜索追问对话会话化 + 界面优化）

### 事件

- 搜索追问对话改为会话模式：追问追加到同一条搜索记录，不产生新记录（复用QA的session模式）
- `useHistory` 新增 `updateSearchSession`（更新搜索会话）和 `getSearchSession`（获取搜索会话）方法
- `handleSearch` 初始化带空 messages 的 data，点击历史记录时恢复完整追问对话
- 修复搜索追问被加到所有历史记录的bug：`handleSearch` 开头清空 `followUpMessages`
- 问答模式新增「新对话」按钮：点击清空当前会话，下次提问创建新话题
- 按钮统一样式优化：查词/翻译/生成按钮移入输入框内，使用渐变绿背景、圆角、hover效果
- 模式切换独立：搜索/问答模式切换从输入框上方移到独立一行，输入框与新对话按钮水平对齐
- 清空历史按类型隔离：search/qa、translate、doc 各自独立清空，不再互相影响

### 文件变更

- 更新 `src/hooks/useHistory.ts`：新增 `updateSearchSession`、`getSearchSession`；`clearHistory` 支持按类型清空
- 更新 `src/modules/search/index.tsx`：`handleSearch` 初始化带空 messages；`handleSendMessage` 搜索分支改用 `updateSearchSession`；`handleHistoryClick` 恢复 followUpMessages；新增「新对话」按钮；模式切换独立布局
- 更新 `src/modules/search/SearchInput.tsx`：新增 `hideModeToggle` 属性，支持隐藏模式切换
- 更新 `src/modules/translate/TranslateInput.tsx`：查词/翻译按钮移入输入框右侧，统一样式
- 更新 `src/modules/doc/DocEditor.tsx`：生成按钮移入输入框右侧，统一样式
- 更新 `src/modules/search/index.tsx`：清空历史调用 `clearHistory(['search', 'qa'])`
- 更新 `src/modules/translate/index.tsx`：清空历史调用 `clearHistory('translate')`
- 更新 `src/modules/doc/index.tsx`：清空历史调用 `clearHistory('doc')`

### 构建验证

- TypeScript 类型检查：通过
- 生产构建：通过

### 关联文档

- 更新 `docs/versions.md`：v1.0.2 更新
- 更新 `docs/todo.md`：标记完成
- 更新 `docs/issues.md`：记录已解决问题

---

## 2026-07-08（问答历史话题化 + 项目文档整理）

### 事件

- 问答历史重构：从单条消息改为完整对话会话（话题）
- 首次提问创建新会话，后续追问追加到同一会话，不产生新历史记录
- 点击历史记录时直接加载完整消息数组，恢复整个对话
- 新增 `QASession` 类型，`HistoryItem` 扩展支持存储完整对话
- `useHistory` 新增 `updateQASession`（更新会话）和 `getQASession`（获取会话）方法
- 修复「浏览中」标记被后续追问覆盖问题：`getCurrentViewing` 和 `isViewing` 以第一条消息为标识

### 文件变更

- 更新 `src/types/index.ts`：新增 `QASession` 类型；`HistoryItem` 扩展 `data?: QASession`
- 更新 `src/hooks/useHistory.ts`：`addHistory` 支持 session 参数；新增 `updateQASession`、`getQASession`
- 更新 `src/modules/search/index.tsx`：问答消息逻辑重构（区分首次提问/追问）；`handleHistoryClick` 加载完整会话；`getCurrentViewing`/`isViewing` 使用第一条消息

### 构建验证

- TypeScript 类型检查：通过
- 生产构建：通过（vite build）

### 关联文档

- 更新 `docs/versions.md`：v1.0.2 更新
- 更新 `docs/todo.md`：标记完成
- 更新 `docs/issues.md`：记录已解决问题

---

## 2026-07-07（历史记录时间自动更新 + 浏览中标记）

### 事件

- 历史记录时间每分钟自动更新（如"刚刚"→"1分钟前"→"2分钟前"）
- 当前浏览的内容在历史记录和收藏面板中高亮显示，并有「浏览中」标签
- 新增 `useTimeRefresh` hook，每分钟触发一次状态更新
- 各模块通过 `useImperativeHandle` 暴露 `getCurrentViewing` 方法
- `App.tsx` 聚合各模块的当前浏览内容，每分钟同步一次

### 文件变更

- 新建 `src/hooks/useTimeRefresh.ts`：每分钟触发状态更新
- 更新 `src/modules/translate/TranslateHistory.tsx`：支持 `timeRefresh` 和 `currentViewing`
- 更新 `src/modules/doc/DocHistory.tsx`：支持 `timeRefresh` 和 `currentViewing`
- 更新 `src/modules/search/index.tsx`：新增 `getCurrentViewing` 方法
- 更新 `src/modules/translate/index.tsx`：使用 `useTimeRefresh`，新增 `getCurrentViewing`
- 更新 `src/modules/doc/index.tsx`：使用 `useTimeRefresh`，新增 `getCurrentViewing`
- 更新 `src/components/favorites/FavoritesPanel.tsx`：当前浏览项高亮 +「浏览中」标签
- 更新 `src/components/layout/Header.tsx`：传递 `timeRefresh` 和 `currentViewing`
- 更新 `src/App.tsx`：聚合各模块的 `getCurrentViewing`，每分钟同步

### 构建验证

- TypeScript 类型检查：通过
- 生产构建：通过（vite build）

### 关联文档

- 更新 `docs/versions.md`：v1.0.2 更新
- 更新 `docs/todo.md`：标记完成

---

## 2026-07-07（收藏管理类型折叠）

### 事件

- `FavoritesPanel` 添加类型折叠功能，各类型支持独立展开/折叠
- 默认全部展开，点击类型标题可折叠/展开对应内容

### 文件变更

- 更新 `src/components/favorites/FavoritesPanel.tsx`：新增 `expandedTypes` 状态控制折叠

---

## 2026-07-07（B1+B2+B4：完成 Alpha 模块改进计划剩余任务）

### 事件

- B1：搜索模块增加问答历史记录（qa 类型，侧边栏按模式动态切换）
- B2：收藏项点击跳转到对应内容（sessionStorage 中转，3 模块恢复逻辑）
- B4：文档生成类型扩充 5→10 种（新增合同、简历、新闻稿、项目方案、周报/日报）

### 文件变更

- 更新 `src/types/index.ts`：HistoryItem 加 'qa' 类型；DocType 扩展为 10 种
- 更新 `src/modules/search/index.tsx`：问答历史记录（addHistory + 侧边栏按模式切换 + 动态图标/标题）
- 更新 `src/modules/doc/templates.ts`：新增 5 个模板函数（generateContract 等）+ docTypes 数组
- 更新 `src/modules/doc/index.tsx`：5 个新 case + pendingFavorite 恢复
- 更新 `src/components/favorites/FavoritesPanel.tsx`：onSelect 回调 + onClick 跳转
- 更新 `src/components/layout/Header.tsx`：onSelectFavorite 传递
- 更新 `src/App.tsx`：handleSelectFavorite（tab 映射 + sessionStorage）+ pendingFavorite 传递
- 更新 `src/modules/translate/index.tsx`：pendingFavorite 恢复（dictionary/translation）

### 构建验证

- TypeScript 类型检查：通过
- 生产构建：通过（vite build）

### 关联文档

- 更新 `docs/todo.md`：B1/B2/B4 标记完成
- 更新 `.trae/documents/alpha-module-improvement-plan.md`：B1/B2/B4 状态更新

## 2026-07-07（工作流修复：Skill 动态发现遗漏双路径搜索）

### 事件

- B3 任务完成后，文档同步时判断「无 project-document-manager Skill」，直接编辑文档
- 实际该 Skill 存在于全局 `~/.trae-cn/skills/`，但只搜索了项目 `.trae/skills/` 导致遗漏
- 修复：workflow-manager 的「Skill动态发现」部分补充双路径搜索规则（项目 + 全局）
- 本次遗漏暴露了项目管理重大漏洞：Skill 发现机制不完整

### 文件变更

- 更新 `c:\Users\asus\.trae-cn\skills\workflow-manager\SKILL.md`：Skill动态发现补充双路径搜索规则
- 更新 `project_memory.md`：新增教训「Skill 发现必须同时搜索两个目录」
- 更新 `docs/lessons/other.md`：新增 Skill 发现遗漏教训

### 关联文档

- 更新 `docs/todo.md`：记录本次修复

## 2026-07-07（B3：翻译模块关联术语 & 关键词/语法说明）

### 事件

- 查词模式增加「关联术语」展示：`WordResult` 新增 `relatedTerms` 字段，在结果卡片中以 Tag 形式展示（与同反义词区隔）
- 发音按钮增加朗读状态反馈：点击后显示「朗读中...」，朗读结束后恢复
- 翻译模式优化：移除「关联知识卡片」，改为「关键词」+「语法说明」
- `SentenceResult` 类型更新：`relatedCards` 字段替换为 `keywords` 和 `grammarNotes`
- 翻译结果导出同步更新：使用关键词和语法说明替换知识卡片内容
- 语言方向选择器优化：auto 模式下显示 `(自动)` 提示文本
- 设计原则：查词模式轻量高效（只加关联术语 Tag），翻译模式贴切实用（关键词+语法说明比知识卡片更贴合翻译场景）

### 文件变更

- 更新 `src/types/index.ts`：`WordResult` 加 `relatedTerms`；`SentenceResult` 移除 `relatedCards`，加 `keywords` + `grammarNotes`
- 更新 `src/modules/translate/mockData.ts`：4 个单词（algorithm/architecture/framework/interface）加关联术语；`mockSentenceResult` 改关键词+语法说明
- 更新 `src/modules/translate/WordResult.tsx`：发音按钮朗读中状态反馈；关联术语 Tag 展示区
- 更新 `src/modules/translate/SentenceResult.tsx`：知识卡片区替换为关键词 Tag + 语法说明编号列表；导出内容同步
- 更新 `src/modules/translate/TranslateInput.tsx`：auto 模式显示 `(自动)` 提示

### 构建验证

| 检查项             | 结果   | 说明              |
| --------------- | ---- | --------------- |
| TypeScript 类型检查 | ✅ 通过 | 无类型错误           |
| 生产构建            | ✅ 通过 | 68 modules 成功转换 |

### 关联文档

- 更新 `docs/todo.md`：标记 B3 完成
- [Alpha 模块改进计划](../.trae/documents/alpha-module-improvement-plan.md) - B3 任务

## 2026-07-07（收藏管理分类完善）

### 事件

- `FavoriteItem.type` 新增 `'dictionary'` 类型，收藏管理面板从三类扩展到四类
- 分类：知识卡片（knowledge）、词典查词（dictionary）、翻译（translation）、文档（document）
- `WordResult` 收藏类型从 `'translation'` 改为 `'dictionary'`，词典收藏与翻译收藏互相独立
- `FavoritesPanel` 新增 dictionary 分类的标签、颜色（绿色）、标题提取（data.word）、描述提取（首条释义）

## 2026-07-07（翻译模块双模式：词典查词 + 翻译）

### 事件

- 翻译模块新增「词典查词」模式，与「翻译」模式通过顶部 Tab 切换
- 查词模式：单行输入框，Enter 直接查词，展示 WordResult（音标、词性、释义、例句、同反义词）
- 翻译模式：多行文本域，展示 SentenceResult（原文/译文对照、风格切换、关联卡片）
- 历史记录按模式过滤展示：词典模式显示查词历史，翻译模式显示翻译历史
- 切换模式时自动清空当前显示结果
- 历史记录职责分离：`performTranslation`（纯翻译）、`handleTranslate`（输入框加历史 + 翻译）、`handleHistorySelect`（历史点击切换模式 + 翻译）
- 新增 `'dictionary'` 类型到 `HistoryItem.type` 联合类型
- `useHistory.getHistoryByType` 支持传入数组，兼容多类型合并查询
- mockData 词典数据从 1 个词扩展到 10 个词（algorithm、architecture、abstract、implement 等）
- Button 组件全局修复：`baseStyles` 增加 `inline-flex items-center gap-1.5`，图标文字对齐

## 2026-07-07（收藏逻辑重构：统一 hook + 去重）

### 事件

- 收藏功能改用 `useSyncExternalStore` 模块级共享状态，对齐历史记录 `useHistory` 的底层模式
- 移除 WordResult、SentenceResult、DocResult 中重复的 localStorage 操作代码
- 移除自定义事件通知机制（`notifyFavoritesChanged` / `FAVORITES_CHANGED`），不再需要
- 所有组件统一调用 `useFavorites()` 的 `addFavorite`/`removeFavorite`/`isFavorite`，状态即时同步

### 文件变更

- 重写 `src/hooks/useFavorites.ts`：`useState` → `useSyncExternalStore` + 模块级 `sharedFavorites` + `listeners` Set
- 更新 `src/modules/translate/WordResult.tsx`：移除直接 localStorage 操作，改用 `useFavorites` hook
- 更新 `src/modules/translate/SentenceResult.tsx`：同上
- 更新 `src/modules/doc/DocResult.tsx`：同上

### 构建验证

| 检查项             | 结果   | 说明              |
| --------------- | ---- | --------------- |
| TypeScript 类型检查 | ✅ 通过 | 无类型错误           |
| 生产构建            | ✅ 通过 | 68 modules 成功转换 |

### 关联文档

- 更新 `docs/history.md`：追加本次重构记录

## 2026-07-07（Alpha 模块体验对齐 + 修复）

### 事件

- A01: 翻译模块增加「自动检测」语言方向（默认选项，含中文→中译英，反之→英译中规则）
- A03: 翻译历史记录改为侧边栏（对齐搜索模块，支持收起/展开、悬浮按钮）
- A04: 查句结果增加关联知识卡片（3 张：NLP、翻译理论、跨文化交际）
- A05: 查句结果增加导出功能（txt 格式，含原文/译文/风格/关联知识）
- A02: 文档模块增加历史记录（侧边栏，对齐搜索模块）
- A06: 文档模块增加「重新生成」功能（使用上次参数重新生成文档）
- A07: 统一收藏管理视图（Header 星标入口，抽屉面板，按类型分组）
- 修复收起历史按钮位置：从主内容区 header 移到侧边栏内部（对齐搜索模块）
- 修复收藏状态同步：收藏/取消后通过自定义事件通知 useFavorites hook 即时刷新面板

### 文件变更

- 新建 `src/modules/translate/TranslateHistory.tsx`：翻译历史侧边栏组件
- 新建 `src/modules/doc/DocHistory.tsx`：文档历史侧边栏组件
- 新建 `src/components/favorites/FavoritesPanel.tsx`：统一收藏管理抽屉面板
- 更新 `src/types/index.ts`：新增 `RelatedKnowledgeCard`、`HistoryItem.type` 扩展 `'doc'`、`FavoriteItem` 扩展 `'document'`
- 更新 `src/modules/translate/index.tsx`：侧边栏布局、自动检测默认、收起按钮移至侧边栏内
- 更新 `src/modules/translate/SentenceResult.tsx`：关联知识卡片 + 导出按钮 + 事件通知
- 更新 `src/modules/translate/WordResult.tsx`：事件通知
- 更新 `src/modules/translate/TranslateHistory.tsx`：内部收起按钮
- 更新 `src/modules/translate/mockData.ts`：新增 `relatedCards` 数据
- 更新 `src/modules/doc/index.tsx`：侧边栏布局 + 历史记录 + 重新生成、收起按钮移至侧边栏内
- 更新 `src/modules/doc/DocResult.tsx`：`onRegenerate` 属性 + 事件通知
- 更新 `src/modules/doc/DocHistory.tsx`：内部收起按钮
- 更新 `src/components/layout/Header.tsx`：集成收藏入口
- 更新 `src/App.tsx`：传入收藏数据
- 更新 `src/hooks/useFavorites.ts`：自定义事件监听 + `notifyFavoritesChanged()` 导出

### 构建验证

| 检查项             | 结果   | 说明              |
| --------------- | ---- | --------------- |
| TypeScript 类型检查 | ✅ 通过 | 无类型错误           |
| 生产构建            | ✅ 通过 | 68 modules 成功转换 |

### 关联文档

- 更新 `docs/todo.md`：添加模块对齐相关完成项
- 更新 `docs/issues.md`：无新增问题

## 2026-07-05（搜索模块持续优化）

### 事件

- 添加热门标签：搜索框下方展示 10 个热门搜索标签，点击直接搜索
- 移除「智能知识搜索」脉冲徽章，简化标题区
- 支持单条历史记录删除：侧边栏每条记录悬停时显示 ✕ 删除按钮
- 字体大小优化：分类标签、清空/收起按钮、已选数量提示从 `text-xs` → `text-sm`
- 搜索范围标签折叠/展开：默认折叠为「筛选」按钮，展开后显示完整标签 + 清空 + 收起
- 侧边栏完全收起（w-0）：收起后仅显示左上角悬浮按钮，展开后恢复完整侧边栏
- 搜索范围标签功能修复：从直接搜索改为过滤条件，匹配 category 和 tags
- 移除「相关关键词」区域：精简搜索模块，仅保留搜索范围标签
- 知识内容区域完善：重写 SearchResults 组件，思维导图层级着色、概念卡片双色边框、示例步骤编号
- 补充 6 个搜索词生成数据：物理定律、化学反应、数学公式、历史事件、编程算法、生物结构
- 热搜标签折叠/展开：折叠时显示前 5 个标签 + `···` 展开按钮，展开后显示全部 + 箭头图标"收起"按钮
- 修复热搜标签 `···` 不可见问题：`overflow-hidden` 改为 `slice(0,5)` 截断显示

### 文件变更

- 更新 `src/modules/search/index.tsx`：添加热门标签、移除徽章、单条删除、侧边栏完全收起、热搜标签折叠/展开（含修复）
- 更新 `src/modules/search/SmartTags.tsx`：折叠/展开、清空选择、字体大小优化
- 更新 `src/modules/search/SearchResults.tsx`：全面优化视觉设计
- 更新 `src/modules/search/mockData.ts`：新增 6 个搜索词生成数据，添加 category/tags 字段
- 更新 `src/hooks/useHistory.ts`：暴露 removeHistory 方法

### 构建验证结果

| 检查项             | 结果   | 说明                      |
| --------------- | ---- | ----------------------- |
| TypeScript 类型检查 | ✅ 通过 | 无类型错误                   |
| 生产构建            | ✅ 通过 | 65 modules 成功转换         |
| 开发服务器           | ✅ 正常 | <http://localhost:3000> |

### 关联文档

- [版本里程碑](versions.md) - v1.0.1 更新
- [待办事项](todo.md) - 更新状态

---

## 2026-07-05（Skill 重写 - project-document-manager）

### 事件

- 复盘旧版 Skill（479行），提取经典细节：完整工作流链路、文档追溯链、讨论→文档映射、外部文件决策树、教训搜索机制、变更检测
- 新增"文档同步规则"映射表：8 类操作类型 × 文档映射，history.md 必更
- 新增"主动触发"机制：非琐碎改动完成后自行执行，不再依赖 workflow-manager 调用
- 新增"判断指南"：区分功能修改 vs 需求变更、教训记录判断标准
- 新增 history.md 五段式格式模板（事件→文件变更→构建验证→关联文档→经验教训）
- 精简至 266 行，融合新旧两版全部精华

### 文件变更

- 重写 `c:\Users\asus\.trae-cn\skills\project-document-manager\SKILL.md`：完整重写

### 关联文档

- [问题追踪](issues.md) - 标记 Skill 优化已解决
- [待办事项](todo.md) - 新增 Skill 重写任务

---

## 2026-07-05（直接问答模式）

### 事件

- 新增直接问答模式：搜索栏上方新增"搜索/问答"模式切换按钮
- 搜索模式：保留搜索栏 + 热搜标签 + 搜索范围 + 搜索结果 + 追问对话区
- 问答模式：搜索栏作为问答输入框，发送按钮调用问答逻辑，隐藏热搜标签和搜索范围，问答区无冗余输入框
- QASection 重构：支持 `hasContext`（追问/直接问答）和 `hideInput`（隐藏底部输入框）两种模式


- 消息顺序修复：从上到下（旧→新），新消息自动滚动到底部
- 对话历史分离：`followUpMessages` 和 `qaMessages` 独立管理，两个模式互不干扰
- mockData 新增：`directQAMockReplies`（4组预设回复）、`defaultQAReply`、`generateReply()` 函数（预留 API 接口）
- 对话复制/导出：QASection 工具栏新增"复制"和"导出"按钮，导出为 Q\&A 格式 .txt 文件
- 修复 formatQAText 多余 `.reverse()` 导致复制/导出顺序反转

### 文件变更

- 更新 `src/modules/search/index.tsx`：模式切换状态、独立消息状态、条件渲染
- 重写 `src/modules/search/QASection.tsx`：双模式支持、引导 UI、自动滚动、hideInput、复制/导出
- 重写 `src/modules/search/SearchInput.tsx`：新增模式切换 UI、按钮和 placeholder 联动
- 更新 `src/modules/search/mockData.ts`：新增直接问答 mock 数据和 generateReply 函数

### 构建验证

- TypeScript 类型检查通过
- 生产构建通过

### 关联文档

- [待办事项](todo.md) - 更新状态
- [问题追踪](issues.md) - 记录问题

---

## 2026-07-05（Skill 逻辑修复）

### 事件

- 修复 workflow-manager 逻辑疏漏：工作流中增加"功能确认 → 文档同步"强制步骤
- 新增约束10：凡涉及代码改动的任务，工作汇报后必须主动询问用户功能是否达成目的，确认后自动同步项目文档
- 反馈循环中新增"功能确认与文档同步"章节，明确适用/不适用场景
- 更新 project-document-manager 触发条件：新增"功能改动完成"作为首个触发条件

### 文件变更

- 更新 `skills/workflow-manager/SKILL.md`：工作流图、约束10、反馈循环、用途描述、示例2
- 更新 `skills/project-document-manager/SKILL.md`：工作流程、触发条件

### 关联文档

- [待办事项](todo.md) - 更新状态
- [问题追踪](issues.md) - 记录已解决问题

---

## 2026-07-05（搜索模块优化）

### 事件

- 重构搜索模块布局：搜索历史移至左侧侧边栏，主内容区优化
- 优化关键词标签：新增搜索范围标签（教育阶段、学科领域、知识类型），支持多选
- 实现知识内容智能生成呈现：知识点→思维导图→概念（定义/公式/定理）→示例→搜索结果
- 添加思维导图组件：可折叠树状结构展示知识层级和关联关系
- 添加概念解析组件：支持定义、公式（KaTeX渲染）、定理、原理四种类型卡片
- 添加示例演示组件：带步骤和结论的具体案例展示
- 支持多领域关键词搜索：速度、引擎、牛顿第二定律、人工智能等

### 文件变更

- 更新 `src/modules/search/index.tsx`：重构布局，添加左侧搜索历史侧边栏
- 更新 `src/modules/search/SmartTags.tsx`：支持分类范围标签展示和多选
- 更新 `src/modules/search/SearchResults.tsx`：按新结构呈现知识内容（思维导图→概念→示例→结果）
- 更新 `src/modules/search/mockData.ts`：添加范围标签数据和智能生成知识数据
- 更新 `src/types/index.ts`：添加 GeneratedKnowledge、MindMapNode、Concept、Example、ScopeTag 类型
- 更新 `src/modules/search/HotTags.tsx`：修复导入错误（hotTags → defaultTags）
- 更新 `src/modules/search/index.tsx`：修复侧边栏不可见问题，移除 `hidden lg:block`，添加响应式切换按钮
- 更新 `src/modules/search/index.tsx`：重构左右两栏布局，左侧边栏支持收起/展开（展开296px，收起64px），添加过渡动画
- 更新 `src/modules/search/index.tsx`：优化布局视觉效果，圆角卡片设计、渐变背景、悬停动效、徽章标签
- 更新 `src/modules/search/index.tsx`：改为完全收起隐藏侧边栏（w-0），收起后左上角显示简约悬浮按钮
- 更新 `src/modules/search/index.tsx`：修复搜索范围标签功能，从直接搜索改为过滤条件
- 更新 `src/modules/search/mockData.ts`：添加 category 和 tags 字段用于过滤
- 更新 `src/types/index.ts`：所有卡片类型添加 category 和 tags 字段
- 更新 `src/modules/search/SmartTags.tsx`：移除「相关关键词」部分，精简为仅保留搜索范围标签
- 更新 `src/modules/search/index.tsx`：移除未使用的 searchInput 状态和相关参数
- 更新 `src/modules/search/SmartTags.tsx`：搜索范围添加折叠/展开功能，默认折叠为「筛选」图标按钮，展开后显示完整标签

### 知识内容区域完善（2026-07-05）

- 重写 `src/modules/search/SearchResults.tsx`：全面优化视觉设计
  - 顶部新增知识概览区域（标题 + 分类标签 + 收藏/导出按钮）
  - 思维导图：按层级着色（青/蓝/黄），加子项计数，优化展开折叠
  - 概念解析：四种类型卡片（定义/公式/定理/原理），双色边框 + KaTeX 公式渲染
  - 示例演示：步骤编号 + 渐变结论区域 + 悬停阴影
  - 知识卡片：独立分区，带蓝色图标
  - 加载动画：旋转搜索图标
- 更新 `src/modules/search/mockData.ts`：新增 6 个搜索词的生成数据
  - 物理定律、化学反应、数学公式、历史事件、编程算法、生物结构
  - 每个关键词包含完整思维导图 + 概念解析 + 示例演示

### 构建验证结果

| 检查项             | 结果   | 说明                      |
| --------------- | ---- | ----------------------- |
| TypeScript 类型检查 | ✅ 通过 | 无类型错误                   |
| 生产构建            | ✅ 通过 | 65 modules 成功转换         |
| 开发服务器           | ✅ 正常 | <http://localhost:3000> |

### 关联文档

- [版本里程碑](versions.md) - v1.0.1 更新
- [待办事项](todo.md) - 更新状态

---

## 2026-07-05（v1.0.0 发布）

### 事件

- 完成 v1.0.0 MVP 全部功能开发
- 实现知识结构图谱：层级结构展示、基础/进阶阶段切换、概念关联跳转
- 实现智能标签：根据输入内容实时更新相关标签
- 实现知识笔记导出：支持 TXT 和 Markdown 格式
- 实现追问对话功能：支持对知识卡片进行深入提问
- 实现收藏功能：知识卡片、生词、文档的收藏与管理
- 实现历史记录功能：搜索/翻译历史记录与快速重新操作
- 实现 TTS 朗读功能：单词发音、句子原文/译文朗读（Web Speech API）
- 实现文档复制导出功能：复制全文、导出为 TXT 文件
- 移除动态可视化模块导航入口（已从 PRD 移除）
- 构建验证：TypeScript 类型检查通过，生产构建成功（66 modules）

### 文件变更

- 新建 `src/modules/search/KnowledgeGraph.tsx`：知识结构图谱组件
- 新建 `src/modules/search/SmartTags.tsx`：智能标签组件
- 新建 `src/utils/export.ts`：文件导出工具
- 新建 `src/hooks/useFavorites.ts`：收藏功能 Hook
- 新建 `src/hooks/useHistory.ts`：历史记录功能 Hook
- 更新 `src/types/index.ts`：新增 KnowledgeNode、KnowledgeStage 类型，移除 visual TabType
- 更新 `src/App.tsx`：移除 VisualModule，更新导航逻辑
- 更新 `src/components/layout/TabNav.tsx`：移除动态可视化导航项
- 更新 `src/modules/search/SearchModule.tsx`：集成 KnowledgeGraph 和 SmartTags
- 更新 `src/modules/search/KnowledgeCard.tsx`：添加追问对话和导出功能
- 更新 `src/modules/translate/SentenceResult.tsx`：添加 TTS 朗读按钮
- 更新 `src/modules/doc/DocResult.tsx`：添加文档导出和收藏功能

### 构建验证结果

| 检查项             | 结果   | 说明                      |
| --------------- | ---- | ----------------------- |
| TypeScript 类型检查 | ✅ 通过 | 无类型错误                   |
| 生产构建            | ✅ 通过 | 66 modules 成功转换         |
| 开发服务器           | ✅ 正常 | <http://localhost:3000> |

### 关联文档

- [版本里程碑](versions.md) - v1.0.0 已完成
- [待办事项](todo.md) - 更新状态
- [产品需求文档](prd.md) - 需求来源

---

## 2026-07-05（全面检查）

### 事件

- 按项目管理标准完成全面检查：文档完整性、一致性、代码与设计匹配度、构建验证
- 文档体系检查：PRD、Goal、Design、Todo、Versions、History、Convention全部齐全
- PRD与Design一致性验证：知识结构图谱、智能标签等功能在技术文档中有对应实现描述
- 代码与设计对比发现差异：当前HotTags为静态标签，需优化为SmartTags动态智能标签；KnowledgeGraph组件尚未实现
- 构建验证：TypeScript类型检查通过，生产构建成功（Chunk体积警告不影响功能）
- 更新文档约定：PRD为需求唯一真实来源，文档更新需同步相关文件

### 文件变更

- 更新 [prd.md](prd.md)：明确MVP核心能力、智能标签说明、知识结构图谱需求
- 更新 [design.md](design.md)：增加KnowledgeGraph组件、SmartTags组件、KnowledgeNode数据模型
- 更新 [goal.md](goal.md)：同步MVP核心能力描述
- 更新 [todo.md](todo.md)：新增知识结构图谱和智能标签开发任务
- 更新 [convention.md](convention.md)：建立文档查阅优先级和更新规则

### 检查结果

| 检查项           | 结果      | 说明                                       |
| ------------- | ------- | ---------------------------------------- |
| 文档完整性         | ✅ 通过    | 7个核心文档全部齐全                               |
| PRD与Design一致性 | ✅ 通过    | 功能需求与技术实现描述匹配                            |
| Goal与PRD一致性   | ✅ 通过    | MVP核心能力一致                                |
| Todo与PRD一致性   | ✅ 通过    | 任务列表与优先级一致                               |
| 代码与设计匹配度      | ⚠️ 部分差异 | HotTags需升级为SmartTags；KnowledgeGraph组件待实现 |
| 构建验证          | ✅ 通过    | TypeScript检查通过，生产构建成功                    |

### 待跟进事项

- 开发KnowledgeGraph组件（知识结构图谱）
- 将HotTags组件升级为SmartTags动态智能标签
- 优化Chunk体积（可通过动态import实现）

### 关联文档

- [产品需求文档](prd.md) - v1.0
- [技术架构文档](design.md) - v1.0
- [文档约定](convention.md) - 查阅优先级和更新规则
- [待办事项](todo.md) - 知识结构图谱开发任务

---

## 2026-07-02

### 事件

- 完成模块化重构：从单文件HTML升级为 Vite + React + TypeScript + Tailwind CSS
- 建立组件化架构：通用组件层 + 功能模块层 + 工具层
- 开发6种知识卡片组件、4个功能模块、UI基础组件
- 项目构建验证通过，开发服务器正常运行
- 功能测试全部通过（知识搜索/词典翻译/文档生成/动态可视化）
- 建立外部文件管理机制：docs/external/ 目录与清单
- 移动外部来源不明文件到 docs/external/（截图、Session ID.txt、开发需求.md）
- 设计方案文档归档到 docs/references/（原 design_docs/ 目录）
- 删除 ai-office-assistant.zip 压缩包
- 记录项目管理经验：不确定用途的文件不要擅自删除
- 优化 project-document-manager skill：增加外部文件检测与管理功能（先询问，再执行）

### 文件变更

- design_docs/ → docs/references/（设计方案归档）
- 知识灵动助手-开发需求.md → docs/external/（外部文件归类）
- ai-office-assistant.zip → 已删除

### 经验教训

- 做重大重构前必须先更新项目文档（goal/design/versions/todo）
- 不确定用途的外部文件不要擅自删除，应先归档到 docs/external/ 并询问用户
- project-document-manager skill 需要增加外部文件检测功能

### 关联文档

- [版本里程碑](versions.md) - v0.2.0 已完成
- [设计方案](design.md) - 更新技术架构
- [待办事项](todo.md) - 更新状态
- [外部文件](external/README.md) - 新增

---

## 2026-07-02（上午）

### 事件

- 创建项目文档结构（goal.md, design.md, versions.md, todo.md, issues.md）
- 创建项目规则文件 project_rules.md
- 创建 .trae/settings.json 配置文件
- 修复 component-config-manager 技能的 Python 兼容性问题
- 修复配置注入 JavaScript 语法错误

### 关联文档

- [待办事项](todo.md) - 更新状态
- [问题追踪](issues.md) - 更新问题状态

---

## 2026-07-01

### 事件

- 将 component-config-manager 技能从 .skills/ 迁移到 .trae/skills/
- 添加 add-missing 功能到 config_manager.py
- 更新 SKILL.md 的触发描述

### 关联文档

- [待办事项](todo.md) - 完成配置管理系统
- [问题追踪](issues.md) - 关闭配置文件路径问题

---

## 2026-06-30

### 事件

- 创建 component-config-manager 技能
- 创建 config/components.json 配置文件
- 创建 scripts/config_manager.py 和 scripts/inject_config.py

### 关联文档

- [项目目标](goal.md) - 更新状态为进行中

---

## 2026-06-29

### 事件

- 初始化项目，创建 index.html 主页面
- 创建知识灵动助手-开发需求.md

### 关联文档

- [项目目标](goal.md) - 创建
