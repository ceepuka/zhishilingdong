# 问题追踪

## 待解决
- [ ] **6种知识卡片为死代码**：流程过程/对比关系/层级结构/时间序列/公式定理卡片组件存在于 `src/components/cards/`，但未被搜索结果主流程引用（`src/components/favorites/FavoritesPanel.tsx` 同理）；按开发期策略需接入主流程 **或** 直接删除，待用户决策（详见 [todo.md](todo.md) P0）
- [ ] **知识图谱导航未完成**：当前仅保留 div 层级"知识目录"占位组件（`src/modules/search/KnowledgeGraph.tsx`），非 SVG 知识图谱；是否后续开发 SVG 知识图谱待用户决策
- [ ] 内容质量进一步优化设计：内容深度、准确性、来源可靠性（用户要求）
- [ ] 外部文件管理：截图文件和 Session ID.txt 待用户确认处理方式
- [ ] 响应式适配优化（移动端）
- [ ] 构建 chunk > 500kB：主 chunk 需代码分割优化
- [ ] **死接口**：`modules/favorites/index.tsx` 声明了 `FavoritesModuleRef.showFavorite`，但既未 `useImperativeHandle` 实现、也从未被任何调用方使用（`App.tsx` 只是把 `ref` 传进来）；按开发期"不写兼容层/死代码直接删"的策略应连同 `App.tsx` 的 `favoritesRef` 一起收敛

## 进行中

## 已解决

### 导图布局回归 / 朗读静默失败 / 续写缺上下文 / 在线语音接入（2026-10-10 → v1.7.4）

用户一次报三条，分属渲染、交互、生成三层；三条修完后用户实测反馈"**导图还是有问题、
发音也没解决**"，查下来是**他在测 10-07 的已发布产物**（那份构建源里导图算法还是坏的），
dev 一直是好的 —— 结论收敛为"发版即修好"，并按用户要求追加了在线语音合成。
（**已随 v1.7.4 发布**。）

- [x] **思维导图布局算法在导出重构时被改坏**：`cf69235` 把布局从 `KnowledgeContentView.tsx`
  抽到 `utils/mindMapLayout.ts`（抽取本身正确，页面与导出要共用一份布局），但顺手把
  `measureNode` 非叶子分支的 `subtreeH = max(size.h, childrenTotalH)` 改成 `childrenTotalH`、
  把 `topOffset` 从 `subtreeH / 2` 改成 `size.h / 2`。`topOffset` 的语义是"子树带顶部 → 节点中心"
  的距离，必须是带中点；改完之后**子节点少而节点自身高的分支**（单链 / 单子）被顶到带上沿，
  与兄弟子树带错位。修复：恢复旧算法（保留文件拆分与 `originX/originY`）
- [x] **原文朗读没有声音（本机缺该语言语音时静默失败）**：`getVoiceForLang()` 返回 `null` 时
  旧实现只是**不设** `utterance.voice` 就发出去 —— Web Speech API 对此不报错也不保证出声；
  本机只有中文语音（Chromium 走 OneCore，看不到注册表里的 en-US Zira），于是英文原文点朗读
  "没反应"、中文译文正常。且 `useSpeechSynthesis` 的 `error` 状态**从未在任何 UI 渲染**，
  失败连提示都没有。修复：无匹配语音时显式退到「引擎默认 → 第一个可用」并让
  `utterance.lang` 跟随所选 voice；把降级事实暴露给 UI；`WordResult` 的朗读语言改为跟随源语言
- [x] **续写提示词缺"主题"与"JSON 进度"**：续写轮的用户消息**只有**提示词本身，没有会话历史，
  回填的又只是内容尾部；`analyzeJSON` 也只给 `completedKeys`。模型不知道在写什么、
  也不知道结构上还差哪些字段 → 跑题改写或漏掉末尾区块。修复：`scan`/`analyzeJSON` 补
  `pendingKey`，新增 `describeJSONProgress()`，`buildJSONContinuationPrompt(partial, task?, requiredKeys?)`
  带上【本次任务】+【当前 JSON 进度】，并把主题透传到查词 / 翻译 / 知识生成 / 追问 / 文档五处
- [x] **本机语音"读不准"（能力缺口，非缺陷）**：本机语音完全取决于操作系统装了哪些语音包，
  本机实测只有 3 个 `zh-CN`，英文原文只能拿中文语音硬念 —— 代码层面治不好。
  按用户要求接入**在线语音合成**：新增「语音朗读」设置 tab，在线优先、失败自动退本机；
  端点由对话端点派生（`/chat/completions` → `/audio/speech`），**复用同一份 Key**；
  预置智谱 `glm-tts` / 硅基 `CosyVoice2-0.5B` / OpenAI。已实测发布形态（`file://`）下
  智谱、硅基可直连，OpenAI 官方被 CORS 拦（需自配代理）

**新增经验教训**：

- **用户说"修了还是有问题"时，第一嫌疑是"他测的不是这份构建"**：本项目有"源码 / dev 服务 /
  已发布单文件产物"三种表面，用户手上那份可能停在几天前的构建。先问清（或直接查产物 mtime +
  构建源 commit），再决定要不要动代码 —— 否则会在已经正确的代码上反复"修"。
- **重构时"顺手删掉的 `Math.max` / 兜底分支"比新写的代码更危险**：它长得像冗余，实际在兜边界
  （这里兜的是"节点自身比子节点总高更高"）。抽函数时若**只搬不改**，就必须逐行确认没做等价变换；
  本项目已经两次栽在"搬运时顺手优化"上（另一次是 `estimateTextWidthEm` 的相等判定）。
- **凡是"引擎/API 不报错也可能不做"的能力，必须给用户一个出口**：Web Speech 找不到语音时
  既不抛错也不出声，代码里"没抛异常"不等于"用户听到了"。这类外部能力要显式判可用性，
  并把降级 / 失败渲染出来 —— 否则症状就是永久性的"点了没反应"，连排查线索都没有。
- **回填上下文要给"任务"而不是只给"片段"**：续写 / 重试 / 二次调用这类场景里，
  模型看到的只有你塞进这一次请求的东西。只给尾部片段等于让它盲猜全局；至少要补
  ①在做什么（主题）②做到哪了（结构进度）③还剩什么。
- **判定"跨域能不能通"这类环境问题，探针必须带对照组**：这次测"浏览器能否直连厂商 TTS 端点"，
  如果只测智谱/硅基拿到 401 就下"放行"的结论，无法排除"探针本身失灵"（比如浏览器被放宽了策略）。
  加了 OpenAI / Anthropic 两个**已知会被拦**的对照组（实测 `TypeError: Failed to fetch`），
  实验组拿到 `res.type === 'cors'` 才算证据成立。

### Word 与 PDF 口径对齐 + 正文示意图导出（2026-10-07）

用户拿两份产物逐项对照后报三条（原话）：**"首标题格式不一致"**、**"被添加了不需要的冗余内容"**、
**"所有文档会丢失示意图内容"**。前两条是"同一份内容两个出口不一致"的复发，第三条是导出链**整块能力缺失**。

- [x] **Word 首标题被降级成小字**：`buildDocx` 为了让文档顶部只有一个标题，把 Markdown 首行 `# xxx` **改写成普通段落**，于是 Word 里出现"居中大号标题 + 紧接一行同样文字的小号正文"（PDF 侧是正常 20pt 标题）。**降级是错的**——要么它是标题、要么它不该出现，没有"标题变正文"这第三种身份。修复：同文 → **整块丢弃**；异文 → 保留为 Heading1。顺带把 `Title` 样式对齐 PDF 的 `title` 块（左对齐 + `w:pBdr` 青色下划线，原为居中 22pt 青色，两份产物放一起就能看出不是一套东西）✅
- [x] **Word 里多出"思维导图结构"平铺项（PDF 没有）**：`generateKnowledgeNote` 会序列化 `## 思维导图结构` + 节点大纲（txt/md/html 出口靠它才有导图内容），而 Word 出口**另有一张横向导图页**；更糟的是 `parseMarkdown` 的列表分支不解析嵌套缩进 → 父/子节点压成同一层，输出一串平铺项。PDF 走结构化数据、本来就没这段。修复：新增 `stripMindMapSection(md, label)`，`buildDocx` 在**有附录页时**剥掉该区块（剥离放在 `buildDocx` 内部，它是"有附录页"这条不变式的一部分，谁调用都绕不过去；精确匹配整行 `## {label}`，不碰同名短语与三级标题）✅
- [x] **导出链整块丢失正文示意图**（概念配图 / 试题配图在所有文件出口都不见）：页面上配图有四条来源（`image` 直链 / `imageData` 多模态 base64 / 关键词检索 / `svg` 手绘），而导出层对 `image` / `imageData` / `svg` 三个字段**零引用**。修复：新增 `utils/exportFigures.ts` 采集层（`collectKnowledgeFigures`）把可用图源统一转成"可 `drawImage` 的对象 + 位图字节 + data URL"，**单张失败一律降级、绝不抛**；PDF 侧加 `drawImage` + 图片块（**高度上限取页高 45%**，否则竖长图永远放不下 → 换页翻爆）；Word 侧走 `![alt](figure:key)` 标记 + **统一的 rId / media 分配器**（旧实现把 `rId3` 硬编码给导图，正文再插图必然撞号，撞号时 Word 只会含糊报"内容有问题"）；HTML 内联 data URL；txt/md 保留一行提示 ✅
- [x] **`svgWithIntrinsicSize` 把子元素尺寸当画布尺寸**：原本在**整段 SVG 源码**里搜 `width`/`height`，`<rect width="300" height="180">` 这类子元素天生带这两个属性 → "已有尺寸"分支被误判命中 → **跳过 viewBox 注入** → `<img>` 退回浏览器给无尺寸 SVG 的默认值。实测：原样 320×200 的图被读成 **240×150**，栅格化整张缩水。修复：只在**根标签**上找尺寸 ✅

### 导出公式与 PDF（2026-10-06）

用户实测反馈（原话）："公式没渲染，pdf看不见" —— 桌面上的 `复数.docx` / `复数.pdf`。

- [x] **导出的 PDF 整页看不见（Windows 上等于白纸）**：上一版的"浏览器打印"产出的是**位图 PDF**（打印对话框把页面栅格化，实测参考件 6 页、文本长度 0、中文字符 0 —— 只要经过打印，文字就不可能可复制）。改成自研 PDF 后第一版走"PDF 预定义 CJK 字体族"（`/STSong-Light` + `/UniGB-UCS2-H`，不嵌字体）：结构完全合规、pdf.js 能提取到文字，**但 Chrome / Edge / PDFium / pdf.js 在 Windows 上都不提供 STSong-Light 字形** —— 实测每页 inkRatio 0.0008~0.0023，只有 `2 Tr` 描边的鬼影，屏幕上没有字。**最终方案 = 每页位图（浏览器系统字库渲染，2× 超采样）+ 一层 `3 Tr` 隐形文字层**（扫描件 PDF 的标准做法）：字形由位图负责、复制检索由文字层负责，实测 inkRatio 升到 0.031~0.039、文字可提取 ✅
- [x] **公式没渲染（导出里露 LaTeX 源码）**：三条漏网通道 —— ① ```` ```latex ```` 围栏块被 `parseMarkdown` join 成一行后认不出（而 `export.ts` 自己就会为 `notation` 生成这种块）；② **无围符裸 LaTeX**（提示词明确要求 `notation` 字段"纯 LaTeX，不加围符"，正文也常写 `i \times i=-1`）；③ 嵌套参数 `\frac{z_1 \overline{z_2}}{z_2 \overline{z_2}}`（原正则 `[^{}]*` 匹配不了嵌套花括号且单次 replace 不回溯）。修复：`latexToText.ts` 新增 `readableLatexExpression()` / `readableBareCommands()` / 围栏识别 + `ARG` 一层嵌套 + 迭代 3 轮展开；docx 与 PDF 共用同一实现 ✅
- [x] **公式降级的"保守原则"必须守住**：不确定是公式的散文里**不动花括号、不做裸 `_x` → 下标** —— 否则吃坏 `snake_case`、Windows 路径 `C:\Users\asus`、正则 `[^a-z]`、JSON 花括号。实测 `把文件放到 C:\Users\asus 下面` 原样通过；`^` → `²` 用 `(?<!\[)` 避开字符类写法 ✅
- [x] **多页 PDF 全部显示第 1 页的图**：图片去重 key 用"尺寸 + 头 8 字节"，而同尺寸 JPEG 的头 8 字节是同一段 JFIF 标记 → 整份只剩 1 个 `/XObject`。修复：全字节 FNV-1a 哈希；测试用"头 8 字节完全相同的假 JPEG"锁死这个行为 ✅
- [x] **思维导图页画在纵向画布上**：`createRealCanvasCtx` 按 landscape 交换宽高，而调用方已按"横向 = 宽 > 高"传参，二次交换互相抵消；超页时还会再换一次。修复：不再交换，导图页可用宽度改用 `ctx.pageWidthPt`；测试断言画布尺寸真是宽 > 高 ✅
- [x] **小节标题/选项字母/列表序号小到看不清**：`layoutSegs` 按 pt 排版（`seg.size * PT_TO_PX`），`drawSegs` 却把 `seg.size` 当 px 画 —— 所有显式给了 `size` 的片段都缩到 **0.375×**（标题 20pt 画成 20px、小节标题 14px、选项字母 10px、出处小字 9px），而行盒仍按正常字号预留，于是小字悬在行盒上半空。修复：统一按 pt 解释；`record()` 的坐标与字号取到 0.01pt（否则 `13.999999999999998` 会写进内容流）✅
- [x] **行盒外溢导致色块横切文字**：行高 1.55em 而文字画在"行顶 + 1em"，字形实际占 ~1.16em → 每行溢出 0.6em，被紧随其后的带底色公式框/分隔线横切（探针实测 `高等解释:` 与公式框重叠 17px）。修复：统一 `TEXT_TOP_GAP = 0.16` + `LINE_H = 1.6`（不变量 `TEXT_TOP_GAP + 1.16 ≤ LINE_H`）✅
- [x] **孤行标题**：`ensure()` 只按标题自身高度预留，`趣味知识` 正好落在第 1 页最底部（画完只剩 7pt），标题与内容被劈到两页。修复：新增 `KEEP_WITH_NEXT_PX`（标题后至少留两行正文，否则整块挪页）；测试断言"除最后一页外，每页最后一行都不是标题字号" ✅
- [x] **位图流多一个换行，JPEG 被吃掉最后一个字节**：image 对象的字典串本身以 `stream\n` 结尾，组装时又补一个 `\n` → 流的第一个字节成了 `0x0A`，而 `/Length` 仍按 JPEG 原长声明，解码器读到的是"前导换行 + JPEG 少一个字节"。修复：image 对象不再补换行；测试用字节判据锁住（`stream\n` 之后必须是 `FF D8`，按声明长度切完必须正好接 `endstream`）✅
- [x] **测试在 Node 里跑不起来**：生产 ctx 工厂要 `document.createElement('canvas')`，Node 无 DOM，`buildKnowledgePdf` 一调就 13 项全失败（`2d context unavailable`）。修复：给 `buildKnowledgePdf` / `buildMarkdownPdf` 留可注入的 `CanvasCtxFactory`，测试注入 stub（顺带让"每页是独立位图""画布方向"变得可断言）✅

### 思维导图导出（2026-10-06）

用户方案（原话）："**关于导出思维导图我的方案是从生成的画布截图，更简单**"，
并明确两个出口都改。

- [x] **同一个导图在两个出口长得不一样**：PDF 横向页画的是真导图（框 + 贝塞尔连线 + 描述盒），
  Word 附录页却是 `walk()` 出来的"缩进 + 项目符号"文字 —— 因为当时判断"Word 里画形状要
  DrawingML，成本远大于收益"。代价不只是观感：文字版只能把节点里的公式降级成 ASCII
  （`\sqrt{a^2+b^2}` → `sqrt(a²+b²)`），和图里的公式是两套降级。修复：绘制收敛成
  `canvasRenderer.paintMindMap()` **一份**（PDF 页与图片共用），新增
  `renderMindMapImage()` 输出 PNG；Word 附录页改成内嵌位图 ✅
- [x] **"截图"截的不是屏幕，是离屏 canvas 重绘**：页面上的导图是 **SVG 连线 + 绝对定位 DOM 节点**
  （不是 canvas），真去截页面像素得引 html2canvas 这类重依赖、还要跟 500px 固定容器 +
  拖拽位移纠缠。做法是按**同一份 `layoutMindMap`** 在离屏 canvas 上重画再导 PNG ——
  视觉一致，零新依赖。**"从画布截图"要落在"画布"上，不是落在"屏幕"上** ✅
- [x] **⚠️ 陷阱：`layoutMindMap` 只给叶子节点画描述盒**（`hasDesc = isLeaf(node) && !!node.description`）。
  给有子节点的节点写 `description` 会被**静默丢弃**，不报错不告警。写回归测试时第一版就把
  "公式降级"的样本挂在中间节点上，断言永远碰不到描述盒 —— 测试"通过"但什么都没验到 ✅
- [x] **⚠️ 陷阱：0 字节的图会写出悬空 rels**：若 `renderMindMapImage` 返回空字节仍按"有图"
  写 `document.xml.rels` 的 image 关系，包里就会出现"关系指向不存在的 media 文件"，
  Word 直接报文档损坏。修复：`bytes.length === 0` 就地归一化为"无图"，
  rels / Content_Types / `w:drawing` 三处同步不写 ✅
- [x] **⚠️ 探针陷阱：JSZip 把目录也列进 `files`**：`files.find(f => f.startsWith('word/media/'))`
  会先命中目录项 `word/media/`，随后 `zip.file('word/media/')` 返回 `null`，
  验证脚本在 `.async()` 上炸。凡按前缀找文件都要排除以 `/` 结尾的条目（探针侧问题，非产品缺陷）✅

### 复制与导出（2026-10-06）

- [x] **搜索结果导出丢失一半内容**：`generateKnowledgeNote()` 当时**完全没有** `knowledgeContext` / `examQuestions` / `interestingFacts` 的分支，而这三个区块页面上都在渲染（`components/knowledge/KnowledgeContentView`）、「复制」出口也有。导出后知识脉络 / 试题 / 趣味知识整段消失。这是比早期"概览丢失"严重得多的同类问题，但同一个函数里一直没人注意到。修复：三段在 txt / md / html 三格式同步补齐 ✅
- [x] **Markdown 序列化双写**（上述丢内容的结构性根因）：`SearchResults.handleCopy` 有一份约 90 行的手写拼接器，`generateKnowledgeNote` 又写一份，两份独立代码生成同一份内容 —— 任一侧加字段而另一侧没加，就出现"页面有、导出没有"。早先"概览丢失"那条 bug 就是它的产物。修复：删除手写拼接器，复制直接复用 `generateKnowledgeNote(data).md`，两个出口**同一来源** ✅
- [x] **复制无降级会直接抛错**：`SentenceResult` / `DocResult` 裸调 `navigator.clipboard.writeText`。本项目发布形态是**本地单文件 HTML**（`file://`，非安全上下文），那里 `navigator.clipboard` 是 `undefined`，点击抛 `TypeError` 且无任何提示，从用户视角就是"这按钮坏了"。修复：新增 `utils/clipboard.ts::copyText`，Async Clipboard → `execCommand` → `failed` 三级降级，**永不抛异常**，并统一给出成功/失败反馈 ✅
- [x] **PDF 导出中文全是乱码**：实测 jsPDF 内置 14 种标准字体全是 latin-1 编码，`doc.text('中文测试')` 写进 PDF 后内容流是 `N-e mK Õ`，每个汉字被打成两个乱码字节；仓库内无可嵌入的中文字体（`docs/references/_shared/fonts` 下只有 Geist / Instrument 等拉丁字体）。修复：移除 jspdf 依赖，PDF 改走**浏览器打印**（隐藏 iframe + 系统字体渲染，中文正常）。代价是用户需在打印对话框选"另存为 PDF" ✅
- [x] **查词结果与收藏详情零复制/导出入口**：词条此前只能朗读+收藏，查到的生词想存进生词本必须手抄；收藏详情页四类内容同样完全取不出来。修复：`WordResult` 与收藏详情（知识/查词/翻译/文档四类）统一接入复制 + 导出 ✅
- [x] **复制内容不完整**：查句的复制只有 `result.translation` 一段译文，实际用途（贴给别人看、存档对照）会丢掉对照关系，而原文就在屏幕上。修复：复制改为原文 + 译文 + 关键词 + 语法说明，与导出共用 `serializeSentenceResult` ✅
- [x] **文件名未清洗**：各出口直接拼 `${title}.md`。标题含 `\ / : * ? " < > |` 时浏览器静默改名或下载失败（`a\b.txt` 在 Win32 上还会被当子目录）；`CON` / `PRN` / `NUL` 等Windows 保留名直接写会写到设备而非文件。修复：`safeFilename()` 统一清洗（含保留名单与全非法字符回退） ✅
- [x] **`QASection.handleExport` 手写重复下载逻辑**：自拼 Blob + `<a>` + `revokeObjectURL`，文件名硬编码 `qa-dialog.txt` 未走 i18n；与 `utils/export.ts` 的 `downloadFile` 重复实现。修复：改走统一出口，文件名本地化 ✅
- [x] **公式围栏语言不一致**：复制用 ` ```math `、导出用 ` ```latex `。修复：统一由 `generateKnowledgeNote` 单点产出 ✅
- [x] **services 层 `document.export` 是死代码且实现有误**：`baseAIProvider.ts` 的实现恒返回 `text/plain`、忽略 format 参数，mock 实现里的 PDF 是手写伪造字节串，且全项目无业务调用点。修复：随 jspdf 一并移除该链路 ✅
- [x] **"关闭整个浏览器后 lastViewedAt 不刷新"——真因是"离开那一刻的落盘本身不可靠"，不是触发漏挂**（用户不接受 m039 的旧构建结论，指正"关闭 = 关掉整个应用页面/整个浏览器"，并断言"问题必定在 lastViewedAt 的修改上，关闭页面的触发被漏掉了"。**排查先排除再定位**：dev `:5173` 真实生成流程 ✅、重建后的 dist `:3000` ✅、三模块 `viewingQuery` 与记录 `query` 静态核对无失配 —— 唯一没测过的是**关掉整个浏览器 + 多标签并存**，实测 ❌。**两步 beacon 把"事件没来"和"处理函数没写"分开**：① 事件侧 —— 关单个标签页时 `beforeunload`/`pagehide`/`vis:hidden`/`unload` 全到，**关整个浏览器时 `beforeunload` 被跳过**、`pagehide`/`vis:hidden`/`unload` 每页各一次；② 写入侧 —— 包一层 `Storage.prototype.setItem`，关整个浏览器时 beacon 明确收到应用写入的 `lastViewedAt=…494949`，但重开后磁盘仍是 `…493768`。**根因**：事件来了、函数跑了、`setItem` 也调了，**是这次写入没落盘**（`pagehide` 之后渲染进程紧接着被杀，localStorage 异步提交来不及刷盘）。**修复**：不变式从"在浏览消失的一刻登记"换成「**磁盘值落后真实浏览时刻不超过一个心跳周期**」—— `HistoryContext.tsx` 新增 `VIEWING_HEARTBEAT_MS = 30_000`，`viewingId` effect **进入即写兜底基线**，新增心跳 effect（浏览期间每 30s 一次，`visibilityState === 'hidden'` 时跳过），离开路径保留写精确时刻，四处统一 `Math.max` 单调不回退；因浏览中侧栏显示"浏览中"徽标而非时间，新增写入对用户不可见。**验证**：`historyViewing.test.tsx` 改写 2 例 + 新增 2 例（341/341，tsc 零错误）；A/B 实测（生成 → 停留 35s → 关整个浏览器 → 重开）旧 dist "+0ms ❌" vs 新 src "**+30015ms ✅**"；`dist` 重建并复测 `:3000`）✅ 2026-09-20
- [x] **"关闭标签页时 lastViewedAt 依旧不刷新"——连续三轮报告的其实是同一件事：跑的是 09-10 的旧构建**（用户第三次反馈"必须额外处理了"。这次不读代码猜，改用**真实浏览器 + 页内探针**取证：Playwright 注入脚本劫持 `Storage.prototype.setItem` 逐笔记录写入，同时监听 `beforeunload`/`pagehide`/`visibilitychange`/`freeze`，关标签页后新开一页读回。**两个入口对比**：dev `:5173`（服务 `src/`）关标签页时四类事件全部触发、**确实写入了** `…history:<id>`、三个模块（search/dictionary/doc）逐一 ✅；demo `:3000`（`start.bat` → `server.js` 服务 `dist/`）事件同样全部触发，但**一次写入都没有**、时间停在"打开它"的那一刻 ❌ —— 与用户描述逐字吻合。**根因**：`dist/` 最后一次构建是 **2026-09-10**，早于 m033，构建产物里**连 `lastViewedAt` 字段都不存在**（只有旧的整表键 `ai-office-assistant-history` + `JSON.stringify(全表)`）；m033→m038 的改动全在 `src/`，只有 dev server 服务它 → 在 3000 上怎么改都不可能生效。**修复**：① 重建 `dist`（751 模块 + postbuild 去 `crossorigin`），并用同一套探针在 3000 复测三个模块全部 ✅；② `server.js` 新增 `checkBuildFreshness()` —— 启动时比较 `src/` 与 `dist/` 最新 mtime，`dist` 旧了就打醒目告警（两侧时间 + `npm run build` 提示 + 建议走 dev 5173），双向验证过；③ `server.js` 全部响应加 `Cache-Control: no-store, must-revalidate`（原先无缓存头，浏览器可启发式缓存旧 `index.html` → "构建了但页面没变"的第二个静默误判源））✅ 2026-09-20
- [x] **"浏览中"记录在关闭标签页后 lastViewedAt 仍停在旧值（用户二次复测，指正"应该放在关闭过程中特别处理"）**（复查发现两处叠加，都不是"没挂监听"：① **翻译模块的"浏览中"身份取错** —— `viewingQuery` 从结果字段派生（`wordResult?.word` / `sentenceResult?.original`），而记录是拿**用户输入**当 `query` 建的；模型一旦返回归一化词形（大小写、词形还原）两者就不一致 → Provider 按 `(type, query)` **永远解析不到条目** → 这条记录永远不会被登记，表现为"关掉标签页时间一直不变"。搜索（`canonicalTopic`）/问答（首条消息内容 = `trimmedQuestion`）/文档（`currentTopic`）本来取的就是记录身份，只有翻译是例外。**修法**：`viewingQuery` 改显式 state，值一律取用户输入文本。② **关闭路径过度依赖 React 状态** —— `viewingId` 是 `useMemo` 从 state 派生的，页面卸载那一刻可能还没解析好（条目刚建 / 本页内存副本尚未收敛，例如记录由另一个标签页写入、`storage` 事件被节流未投递），ref 仍是 null → 什么都不写。**修法**：Provider 保留声明的**同步副本** `viewingDeclRef`（`declareViewing` 里同步写入，不等 React 提交），并把登记拆成两条路径 —— React 侧（内容消失 / 卸载）只认 `viewingIdRef`；页面级离开（`visibilitychange→hidden` / `pagehide` / `beforeunload` / `freeze`）在 ref 为空时按 `(type, query)` 走 `findByQuery` **回磁盘兜底**。**两条路径刻意不共用兜底**：共用会让"进入一条内容"的那次 cleanup 也命中磁盘兜底 → 一进页面就把时间刷成现在，违背"只在浏览消失的一刻登记"（第一版共用实现直接让 `historyViewing` 红 2 例）。回归锁：`historyViewing.test.tsx` 新增"记录只在磁盘上、内存未收敛时页面级离开须兜底登记"，摘掉兜底即红）✅ 2026-09-20
- [x] **重构对性能的代价（用户追问，实测答复）**（100 条真实体量记录（含 `generatedData`，合计 906 KB）下 jsdom 实测：**新布局**读单条 `readItem` 0.026 ms、一次浏览登记（读+写）**0.080 ms**、扫全表 `readAll` 2.849 ms（只在超 100 条裁剪时走一次）；**旧整表布局**一次浏览登记（读全表 + 写全表）**7.260 ms**。结论：新布局单次登记**快约 90 倍**，且成本与记录条数**脱钩**（旧布局线性增长、每次写入都要序列化整表）。重构不是性能代价而是净收益，无需为性能做取舍）✅ 2026-09-20
- [x] **"浏览中"状态归属错误：关闭标签页后 lastViewedAt 仍不刷新 + 多标签页"整表覆盖写、后写者赢"**（用户二次反馈，指出"应该单独处理此状态，'浏览中'内容消失时必须走卸载路径"。两个问题同源：**状态归属错了**。① 登记寄生在 `HistorySidebar` 上，但侧栏不是"浏览中"状态的所有者 —— 它收起时仍在挂载（宽度归零），关标签页/刷新时更不会被卸载，"退出应用页面"这一整类离开必然漏；② 存储是**整表一个键**，每次写入重写全部记录，后写的标签页用自己内存里的旧快照盖掉另一个标签页刚写的东西（新建记录凭空消失、刚登记的时间被退回）。修复：**"浏览中"状态单独收归常驻的 `HistoryProvider`** —— 模块只用 `useViewingHistory(type, query)` 声明"在看哪一条"，登记时机全由 Provider 负责（内容消失/声明变化/组件卸载 + 页面级 `visibilitychange→hidden`/`pagehide`/`beforeunload`/`freeze`，落盘同步，不等 React 提交）；侧栏退回纯展示（不再持有任何登记逻辑）。存储改为**一条记录一个键**（`…history:<id>`）：写入单条原子、删除就是 `removeItem`、外部改动通过 `storage` 事件收敛，整表覆盖问题从根上消失；旧整表数据首次加载摊成单条键后删除旧键（否则删掉的条目会被旧副本复活）。顺带清掉 4 处散写且指向不存在 id 的 `touchHistory`（`dict-<ts>` vs 条目 id `dictionary-<ts>`）✅ 2026-09-20
- [x] **多标签页数据处理（用户判定为"重大问题，决定重构"）+ 关闭标签页后"浏览中"记录的时间仍不刷新**（复查发现四条实锤缺陷，全部根因相同：**写操作相信内存副本，而不是磁盘真相**。① `commit()` 按**本页内存排序**裁剪上限并**连键一起删** → 本页不知道别的标签页刚建/刚刷新的记录，把它当"尾部"删掉 = 真实数据丢失；② 所有更新基于 `historyRef` 读改写 → 落后的标签页把同一条记录（含 `lastViewedAt`）覆盖回旧值，"关标签页新登记的时间被写旧"；③ 旧的整表键吸收逻辑可重复触发，旧代码标签页写回的快照会让**已删除的条目复活**；④ 同一主题在两个标签页各自生成时 id 是随机时间戳，谁都看不见对方的 id → **两条同主题记录**（表现为"两边历史各看各的"）。修复：先确立**磁盘是真相**——新增 `readItem()` 写前重读、`mutate()` 以磁盘最新副本为基准读改写、`lastViewedAt` 一律取 `Math.max(Date.now(), 磁盘值)`（单调不回退）；`commit()` 不再删内存尾巴，改由 `trimDisk()` **按磁盘排序**才删键；新增 `dedupe()` 加载时按 `(type, query)` 归并重复记录、`findByQuery()` 内存未命中时扫磁盘（两标签页同主题复用同一条记录）；迁移加 `SCHEMA_KEY` 标记改为**一次性**（旧键再出现也不再读）；新建 id 加随机后缀避免同毫秒撞键。另修 `freeze` 挂在 window 上永不触发（Page Lifecycle 的 freeze 是 document 事件）。关于"一个标签页正在生成、其他标签页怎么办"：生成期间每次写入都落同一个键，另一标签页经 `storage` 事件实时看到同一条记录在长，**不会产生重复条目、不会互相删**；同一记录被两个标签页同时写仍是后写者赢（单条原子，不会丢整条）✅ 2026-09-20
- [x] **搜索切到问答后再切回，旧结果原样复活、历史条目一直停在"浏览中"**（"浏览中"的语义是"内容正显示在屏幕上"，而搜索模块的模式切换**只清问答消息、从不清搜索内容** —— 内容留在 state 里，切回来就复活，徽标也回来，这个状态永远退不出去、既不显示时间也不登记 `lastViewedAt`。**注意：这条不是 m036 引入的**，`switchMode` 自 initial commit 起就这样，`handleModeChange` 在搜索模块从未存在过；但词典/翻译模块一直是"切模式即清结果"，搜索模块是唯一不一致的例外。修复：`SearchModule` 加 `useEffect(() => { if (mode === 'qa') reset(); }, [mode, reset])`，对齐同一口径，内容已落历史、点条目可原样恢复。契约测试 `searchModeSwitch.test.tsx`，反向验证：注掉该 effect 恰好卡在"切回搜索仍是浏览中"）✅ 2026-09-20
- [x] **"浏览中"状态归属错误：关闭标签页后 lastViewedAt 仍不刷新 + 多标签页"整表覆盖写、后写者赢"**（用户二次反馈，指出"应该单独处理此状态，'浏览中'内容消失时必须走卸载路径"。两个问题同源：**状态归属错了**。① 登记寄生在 `HistorySidebar` 上，但侧栏不是"浏览中"状态的所有者 —— 它收起时仍在挂载（宽度归零），关标签页/刷新时更不会被卸载，"退出应用页面"这一整类离开必然漏；② 存储是**整表一个键**，每次写入重写全部记录，后写的标签页用自己内存里的旧快照盖掉另一个标签页刚写的东西（新建记录凭空消失、刚登记的时间被退回）。修复：**"浏览中"状态单独收归常驻的 `HistoryProvider`** —— 模块只用 `useViewingHistory(type, query)` 声明"在看哪一条"，登记时机全由 Provider 负责（内容消失/声明变化/组件卸载 + 页面级 `visibilitychange→hidden`/`pagehide`/`beforeunload`/`freeze`，落盘同步，不等 React 提交）；侧栏退回纯展示（不再持有任何登记逻辑）。存储改为**一条记录一个键**（`…history:<id>`）：写入单条原子、删除就是 `removeItem`、外部改动通过 `storage` 事件收敛，整表覆盖问题从根上消失；旧整表数据首次加载摊成单条键后删除旧键（否则删掉的条目会被旧副本复活）。顺带清掉 4 处散写且指向不存在 id 的 `touchHistory`（`dict-<ts>` vs 条目 id `dictionary-<ts>`）✅ 2026-09-20
- [x] **退出应用页面时 lastViewedAt 没有刷新**（症状：正在浏览某条记录时直接关闭标签页 / 刷新 / 切到其他 Tab，下次打开时该记录仍显示上次离开的旧时间。根因有两层：① **登记入口只有 React 侧** —— 唯一的 touch 点是 `HistorySidebar` 的 effect cleanup，而 pagehide / 切后台这类"退出应用页面"场景 React **不会卸载组件**，cleanup 永不执行；② **持久化走 effect** —— `touchHistory` 只 `setState`，落盘靠 `useEffect([history])`，页面卸载时该 effect 同样不会跑，即便补了监听也会丢。修复：`HistorySidebar` 增加 `visibilitychange → hidden`（切走 / 切后台 / 最小化）与 `pagehide`（刷新 / 关闭 / 跳走，含 bfcache）两个页面级监听，复用与 cleanup 相同的 `flushViewing()`（幂等：第二次调用 ref 已置空）；`touchHistory` 改为**同步落盘**（用 `historyRef` 取最近已提交列表 → 直接 `saveToStorage` → 再 `setState`），并抽出唯一实现 `applyTouch()`。新增 4 条契约测试，其中一条刻意不用 `act` 包裹以确保"事件回调内已落盘"（回退同步写会红，已实测））✅ 2026-09-20
- [x] **内容已经渲染出来，页面顶部却弹"流式生成结束但未解析出有效 JSON（已收到 N 字符）"红色横幅**（用户带截图反馈。两个缺陷叠加：① **归因错误** —— 续写轮把第二份 JSON 追加在第一轮文本之后，整段文本不再合法，`StreamingJSONParser.finish()` 返回 `null`；旧代码只认 `finish()` 的返回值，于是把 `push()` 期间早已渲染的 summary/mindMap/concepts 一并判成"解析失败"抛致命异常。修复：`generateStream` 记录最后一份可渲染快照，判定改 `finalSnap.data ?? lastRenderable`，仅"全程零可渲染快照"才真正抛错，兜底路径打 `truncated` + `incomplete`（内容侧归因）。② **位置错误** —— 提示说的是"末尾没写完"，位置却在内容**上方**，流式过程中还持续把正文往下挤。修复：`GenerationNotice` 在 `KnowledgeContentView` / `DocResult` / 收藏文档详情三个出口统一落到内容末尾；`SearchContainer` 删除顶部横幅，无任何内容时原因写进空状态卡。技术细节（"已收到 N 字符"、解析器 preview）只进 `interruption.detail`，不再给用户看）✅ 2026-09-20
- [x] **历史记录时间显示不一致 / lastViewedAt 语义不牢**（症状：切换模块（搜索↔问答、查词↔翻译）后，刚离开的那条记录仍显示"x分钟前"，而同一场景下切换条目却显示"刚刚"—— 原因是离开路径上散点式 `touch` 漏了"切换模式"这条路。修复：把"最后浏览时刻"的登记收敛到共享 `HistorySidebar` 的 effect cleanup 单点（覆盖切换条目/清空内容/卸载切页），无轮询、无散写 touch；随后按用户指正把模型收敛为**单一基准**：`lastViewedAt` 必填、创建时初始化为创建时刻，显示与排序都以它为准，`timestamp` 只保留"创建时刻"语义，旧数据在加载时一次性转换）✅ 2026-09-20
- [x] **收藏详情"内容不全"：缺少概览（summary）**（根因同属"双实现漂移"的残留：`summary` 被写在 `SearchResults.tsx` 的**标题卡（页面外壳）**内部，而 `KnowledgeContentView`（共享内容区）里没有它；收藏详情渲染的是「标题头 + 共享内容区」，于是 summary 整段消失。修复：把**标题头（标题 + 概览）与中断提示整体收进** `KnowledgeContentView`，页面级操作（返回按钮）用 `headerActions` 插槽注入 —— 两个入口内容完全一致，搜索页观感零变化。**中途踩坑**：第一版只把 summary 单独挪进内容区，搜索页的概览从标题卡里搬了出去，观感回退，用户当场指出"搜索页的概览效果不能变"。教训：**内容字段必须连同它的视觉容器一起搬**，只搬字段等于没搬）✅ 2026-09-15
- [x] **导出文件不含概览（summary），与"复制"口径不一致**（`generateKnowledgeNote()` 输出 txt/md/html 时从未写 summary，而 `SearchResults.handleCopy()` 生成的 Markdown 一直有它——同一份内容的两个出口内容不同。修复：导出在标题之后补上概览段，与复制对齐；新增 `utils/__tests__/export.test.ts` 锁定三种格式都含概览）✅ 2026-09-15
- [x] **收藏的内容不支持公式、也不能展示思维导图**（根因不是"漏了一处渲染"，而是**收藏详情是手写的第二套渲染实现**：`modules/favorites/index.tsx` 用裸 `<p>{summary}</p>` 输出 → `$...$` 原样裸露（未走 `LatexText`）；`mindMap` 只 `slice(0,8)` 取标题平铺成标签（`MindMap` 组件私有在 `SearchResults.tsx` 内部，收藏拿不到）；概念配图四通道、notation、keyPoints、pitfalls、knowledgeContext、试题选项与配图**全部丢失**。修复：抽出 `components/knowledge/KnowledgeContentView.tsx` 作为**唯一实现**（含 `MindMap`/`ExamQuestionCard`/`ConceptIllustration`/`normalizeGenerated`），搜索与收藏共用；`SearchResults` 删掉约 600 行重复 JSX）✅ 2026-09-15
- [x] **有 topic 但 concepts 缺失/为空的收藏打开后近乎空白**（边界 bug：旧判据 `typeof topic === 'string' && Array.isArray(concepts)` 把这类数据误判为旧格式 `KnowledgeCardData`，转去渲染 `title/definition/points` 这些不存在的字段。修复：新增 `isGeneratedKnowledge()`，按 `topic` / 顶层 `type` 语义判定而非字段是否存在）✅ 2026-09-15
- [x] **思维导图脏数据会导致整页白屏**（`calculateNodeSize()` 读 `title.length`，任一节点缺 `title`（localStorage 旧数据 / 流式半截数据）即抛异常。修复：新增递归 `sanitizeMindMap()`，保证每个节点有 id/title，非法节点整支丢弃——宁缺勿崩）✅ 2026-09-15
- [x] **`$$...$$` 公式渲染后残留美元符号**（`LatexText` 切分正则只有 `$[^$\n]+$`，对 `$$E=mc^2$$` 会从**第二个** `$` 开始匹配，首尾各漏一个 `$`。模型写块级公式常用 `$$`。修复：把 `$$...$$`、`\[...\]` 排到正则前面，并按块级模式渲染）✅ 2026-09-15
- [x] **收藏列表摘要裸露公式源码与 Markdown 标记**（摘要直接对原文 `slice(0,60)` → 预览显示 `$x>0$`、`## 标题`，且截断点可能落在 `$...$` 中间只剩半截公式。修复：新增 `utils/preview.ts` 的 `toPlainPreview()`——先剥离公式围符与 Markdown 标记、折叠空白，再截断，并避免留下半截反斜杠命令）✅ 2026-09-15
- [x] **收藏"保存了但刷新就没了"**（localStorage 超配额时 `saveStorage` 只 `console.error`，而内存数组已改 → 界面显示已收藏、刷新后消失，用户无从判断。收藏的知识卡带 base64 `imageData`（单个可达数 MB），极易触发。修复：完整写入失败 → 剥离 `imageData`/`svg` 重试（保住全部文字）→ 仍失败才置 failed；结果通过 `storageWarning` 在收藏页显示分档横幅）✅ 2026-09-15
- [x] **星标显示"已收藏"但点一下又新增一条**（`addFavorite` 用 `JSON.stringify(f.data) === JSON.stringify(data)` 深度比对去重，而 `isFavorite` 只比标题——两套判定口径不一致；且对含几 MB base64 的对象逐条深度序列化，是性能陷阱。修复：统一为「类型 + 收藏夹 + 标题」指纹）✅ 2026-09-15
- [x] **文档正文里的公式不渲染**（文档正文是 Markdown，一直用裸 `ReactMarkdown`；Markdown 不认识 LaTeX，`$E=mc^2$` 原样显示。修复：新增 `components/ui/MarkdownContent.tsx`——结构交给 ReactMarkdown，`p/li/td/th/h1~h6/blockquote` 的字符串子节点交给 `LatexText`，`code`/`pre` 内部不解析；`DocResult` 与收藏的文档视图共用）✅ 2026-09-15
- [x] **内容未完全生成就自动截止，且无任何提示**（三类叠加根因：① `withFallback` 把未分类异常（网络断开 / body 读取失败 / 解析失败）吞成 `success:true + 空结构体`，状态机看到"成功且空"便丢弃已流出的内容、回 IDLE、只剩笼统"生成失败"；② 续写循环在**首轮**遇链路异常直接上抛，一次续写都不做；③ 文档模块/追问流根本没接截断标记。修复：新增中断分类模型 + `withFallback` strict 模式 + 续写扩展到全链路 + 分档提示横幅）✅ 2026-09-15
- [x] **"模型超限"与"网络超时/异常"没有明确区分界限**（此前只有 `truncated: boolean`，承载不了归因，UI 把网络中断也报成"模型输出上限被截断"——错误归因比不提示更糟。修复：新增 `services/streaming/interruption.ts`，四类归因（模型侧 length/content_filter；链路侧 timeout/network/protocol/http；内容侧 incomplete/parse；用户侧 aborted），每类带标准 code；`sseReader` 新增 `StreamNetworkError`/`StreamAbortedError`，`fetchOrThrow()` 归类裸 `TypeError`）✅ 2026-09-15
- [x] **续写只覆盖"模型超限"，实际几乎不会超限**（用户观察正确：链路中断/静默截断才是常态。修复：`callModelStreamWithContinuation` 重写为分类驱动——network/timeout/protocol/incomplete/length 都会续写；无内容时按原 prompt 重发 1 次；`canContinueAfter()` 明确 content_filter/aborted/parse 不重试；总请求数硬上限仍是 3）✅ 2026-09-15
- [x] **重发轮已收到的内容被整段丢弃**（边界 bug：catch 里复用"本轮开始前"的 `hasContent` 快照判断有无内容——首轮无内容触发重发后，重发轮吐了几千字符才断，会被当成"什么都没有"直接上抛。修复：改用本轮结束后的累积量判断，新增回归测试锁定）✅ 2026-09-15
- [x] **文档生成正文被中断时零提示**（`document.generateStream` 从未接 `truncated`/`continued`；修复：透出 + 落库 + `GenerationNotice` 渲染）✅ 2026-09-15
- [x] **提示词限制处缺"应该怎么做" + AI 画图后不自检**（`buildGeneratePrompt` 等处的限制句只写禁令不写正向替代（"不要编造 URL""不编造""不得硬填无关图"），模型缺少执行路径；且 AI 画完 SVG 后不主动核对，常出"顶点没闭合/标记标错位/数值与题干不符"的错图。修复：① 用"应该 X，而不是 Y"对照补全正向动作；② SVG 硬性要求改写 + 末尾新增【画完自检】6 条清单（关键点闭合/标记对号/数值一致/符号规范/没有多余元素/发现对不上必须重画）；③ 简单禁令（禁止 <script>、只返回 JSON、直角不要画成弧）保持原样；④ 沉淀 `llm-prompt-writing` 技能）✅ 2026-09-13- [x] **提示词否定式约束的可读性（后经复核收窄适用范围）**（`buildGeneratePrompt` 等处散布"不要画成弧""交叉处不要画实心点""禁止 <script>""不要任何前后解释"等否定句。修复：**按原句复杂度分档**——条件句 / 多重禁止这类难读的描述改写为"必须 X，不得 Y，否则 Z"（如电路导线、续写格式要求）；**短小明确的硬性规则保持原样**（SVG 安全限制、输出格式注意事项、直角符号、语言检测等）——第一轮曾全量改写，被用户指为"过度改写、生搬硬套句式"，已还原）✅ 2026-09-12
- [x] **反例措辞过于具体 + 来源要求表述为"绝不编造"**（`严谨性铁律` 用"答案写 9W、解析算出 8W"这类具体数值反例，覆盖面窄；④条为"绝不编造"否定式。修复：反例改为"答案是 1、解析却是 2"这类**通常**解释；第 4 条改为"**来源必须真实**"正向表述——能确定就填、查不到填空字符串，否则不得填写推测内容）✅ 2026-09-12
- [x] **含"如图"试题缺图时无强制兜底**（题干"如图"却无图，模型强行作答。修复：【含"如图"的试题约束】重写为"**必须**为该题配图（imageData > image > svg，**必须至少满足其一**），**否则**舍弃该题，或改写为纯文字可作答的等价题型并**必须**注明'（xxxx年xx考试改编）'"）✅ 2026-09-12- [x] **搜索页卡在「模型正在思考…已等待 511 秒」**（全链路无首字节超时兜底：`sseReader`/`callModelStream` 都没有主动 abort，`AbortController` 只由用户手动取消触发，`WaitTimer` 只是 UI 秒表。修复：`readSSEStream` 新增 `firstByteTimeoutMs`（默认 60s）+ `StreamTimeoutError`，到点 `reader.cancel()` 抛错；已收到任意字节（含思维链）立即 `clearTimeout` 避免误杀慢速流；`FIRST_BYTE_TIMEOUT_MS=60_000` 透传，UI 显示"等待模型响应超时，请检查网络或尝试其他模型"）✅ 2026-09-12
- [x] **链路错误（超时/协议失败）被静默吞成笼统"生成失败"**（`withFallback` 是"吞错器"：任何异常都转成空结构体 + `success:true`，导致状态机里的 `StreamTimeoutError` 识别成为**永远走不到的死代码**。修复：`withFallback` 识别 `StreamTimeoutError`/`StreamProtocolError`，以 `success:false + code(STREAM_TIMEOUT/STREAM_PROTOCOL) + retryable:true` 透传；状态机新增 `toFriendlyError(code,msg)` 映射友好文案）✅ 2026-09-12
- [x] **超限续写半截收尾 + 空转 + 丢尾巴**（三处边界缺陷：① `hasCompleteJSONObject` 只跟踪 `{}` 不跟踪 `[]`，`{"a":[1,2}` 数组未闭合被误判"完整"→ 跳过续写；② 续写轮返回空内容空转浪费次数；③ 续写轮抛链路错误时异常冒泡，丢弃已生成尾巴。修复：`hasCompleteJSONObject` 复用解析层权威判定 `isCompleteJSON`（正确追踪 `{}`/`[]` + 转义 + 围栏），消除双写；续写轮空内容即 break、续写轮异常 catch 保留已累积内容）✅ 2026-09-12
- [x] **续写判定与解析层双写导致漂移**（续写用一套括号配对、解析用 `StreamingJSONParser.scan()` 另一套，必然改一处漏一处。修复：导出 `scan`/新增 `isCompleteJSON`/`analyzeJSON` 作为唯一权威判定；新增 `buildGenerateCompleteChecker()` 把 search 续写判定升级为「括号闭合 **且** 核心字段齐全」（`mindMap`/`concepts`/`knowledgeContext`/`examQuestions`/`interestingFacts`），防止模型输出"括号闭合但缺末尾区块"就收尾）✅ 2026-09-12
- [x] **模型没生成内容 → 页面空白**（两处叠加：① `hasUsableContent` 只认 `summary`/`mindMap`/`concepts`，模型只产出 `knowledgeContext`/`examQuestions`/`interestingFacts` 时被误判"无内容"→ `IDLE`；② `SearchContainer` 在失败态只剩一条红字 + 大块空白。修复：`hasUsableContent` 覆盖全部实质字段；全空分支显式写 `error=generateFailed`；新增带图标的失败空状态卡片 `errors.generateFailedEmpty`）✅ 2026-09-12
- [x] **智谱 GLM "总是生成失败"，千问正常**（智谱 GLM-5.2 默认开启深度思考，思维链吃掉 `max_tokens` 总预算 → 正文 JSON 被截断 → 续写也失败。千问正常是因为已被显式关闭思考。修复：`THINKING_PARAM_PROVIDERS`（只能发单一 `enable_thinking`）改为 `DISABLE_THINKING_PARAMS` 按厂商分派——dashscope/siliconflow 发 `enable_thinking:false`，**zhipu 发 `thinking:{type:'disabled'}`**（智谱传 `thinking:false` 会 400）；同时修正智谱/千问 `capabilities.reasoning` 为 `true`）✅ 2026-09-12
- [x] **模型编造答案 / 自我怀疑式瞎猜**（截图证据：电路题答案写"最大功率 9W"、解析却算出"8W"自相矛盾；圆周角题解析里模型写"改原题更可能问的是另一角"。根因：prompt 只说"准确性>完整性"，无可执行判断标准。修复：`buildGeneratePrompt` 新增【严谨性铁律】——答案必须可验证（不确定→`examQuestions:[]`）、解析必须与答案自洽、不准出现"此题若/改原题"类措辞、绝不编造年份/考试名/图片数据）✅ 2026-09-12
- [x] **试题缺图 + 纯文本模型被要求输出图片数据**（题干"如图"却无图：prompt 让模型"能直接给图片数据时填 base64"，但纯文本模型看不到任何原图。修复：新增【含"如图"的试题约束】——无原图/可信直链/能精确手绘的 SVG 时不要出这道题或改写为纯文字可解；`imageData` 说明强化"纯文本模型严禁填入、绝不编造 base64"）✅ 2026-09-12
- [x] **SVG 规则只有负面限制、公开图源引导过保守**（原规则全是"只能画什么""画不准就空字符串"，没有正向绘图步骤；`image` 字段"拿不准就空字符串"导致模型不愿给直链。修复：SVG 规则重写为**按学科的正向画法教学**——通用骨架 + 数学几何（对边命名/直角符号/等长标记/角弧/直径/平行线）+ 函数图象（坐标轴→刻度→曲线）+ 电路（元件符号+串并联拓扑）+ 受力分析 + 光学（法线+角度）；`image` 字段改为"可信图源直链，优先于手绘 SVG"，引导按 Commons 规范文件名拼直链）✅ 2026-09-12
- [x] **公式渲染报红复发 + 试题裸 LaTeX 原样露出**（两独立根因：① `LatexText` 仅覆盖 11 个字段，遗漏 `keyPoints` / `pitfalls` / `learningPath` / `confusables` / `mindMap` 节点标题·描述 / `interestingFacts.title` / 标签 chip；② `MATH_SPLIT` 只认 `$...$` / `\(...\)`，模型在试题里大量输出裸 LaTeX（`\triangle ABC`、`\sqrt{13}`、`60^\circ`）走过了渲染器也原样露出。修复：`utils/latex.ts` 新增 `splitBareLatex()`（强信号 + 必须 KaTeX 解析成功才渲染 + 失败回退原文）+ `LatexText` 重构为统一入口 + 遗漏字段统一接入 + prompt 置顶【公式书写规则】要求所有数学符号一律 `$...$`）✅ 2026-09-11
- [x] **AI 画图不符合学科惯例 + 试题配图策略反向**（此前 prompt 让 AI 凭印象给图链、被白名单静默落空；试题配图"固定填空统一用 svg"与"原图最可靠"反向；SVG 缺学科制图惯例约束。修复：`ExamQuestion` 新增 `imageData`（base64 直填）+ 渲染优先级 image/imageData > svg + 加载失败自动回退；prompt 把可信图源域名（upload.wikimedia.org / commons.wikimedia.org / cdn.kastatic.org 等）显式写入；SVG 规则新增"必须严格遵循该学科制图惯例"+ 高风险学科细则）✅ 2026-09-11
- [x] **流式内容迟迟不显示（summary 憋很久一次性出现）**（根因不在渲染侧，而在 `baseAIProvider.ts` 的运行时"流式能力黑名单"：原为 `Set` 永久禁用，某型号一次流式失败即整会话改走非流式，且"流式成功即自愈"的路径因不再发 `stream:true` 而**永远不可达**；改为 `Map<key, failedAt>` + 60s 冷却，到期自动重试自愈，降级全程 `console.warn` 可观测，且只按协议层证据记账）✅ 2026-09-11
- [x] **流式"总述不立刻显示 + 步骤指示卡在'正在生成知识导图'**（两处根因：① `StreamingJSONParser.scan()` 只在**字符串/字面量**型值收尾时登记 `completedKeys`，数组/对象型字段（`mindMap`/`concepts`/`knowledgeContext`…）在流式中间态永不登记 → `deriveStep` 从第二个字段起一直返回 `mindMap`；② `SearchResults` 把「总述」(`conceptsOverview`) 渲染在 `concepts.length > 0` 门控内，而产出顺序是 `conceptsOverview → concepts`，总述被迫等到概念列表出现才显示）✅ 2026-09-11
- [x] **界面文案写死中文 / AI 输出语言写死中文**（拆出 `src/i18n/strings/` 字符串层，英文作类型基准；`buildLanguageDirective` 让 AI 输出跟随用户语言）✅ 2026-09-10
- [x] **流式生成是"假流式"**（原 `callModel` 等全文返回后用 `setTimeout(0)` 分块弹出；改为真流式 `generateStream`：`StreamingJSONParser` 共享缓冲 + `callModelStream` 自动降级）✅ 2026-09-09
- [x] **生成被输出上限截断且静默**（`sseReader` 丢弃 `finish_reason`，半截 JSON 被当完整渲染；改为逐层透出 `truncated` 并显示警告）✅ 2026-09-09
- [x] **长内容被模型上限截断无补救**（新增 `hasCompleteJSONObject` 严格闭合判定 + `callModelStreamWithContinuation`，最多 3 次尝试续写）✅ 2026-09-10
- [x] **公式渲染报红**（模型把 LaTeX 包在 `$$…$$`/`\[…\]`/`\(…\)`，KaTeX 不识别；新增 `utils/latex.ts` 归一化 + `renderLatexSafe` 降级等宽代码块）✅ 2026-09-09
- [x] **他厂模型几乎全失败**（模型 ID 与能力 cap 过时；`max_tokens` 超模型输出上限被多数厂商 400 拒绝 → 收敛为 `min(基线, caps, ctx*40%)`）✅ 2026-09-09
- [x] **知识配图从未成功生成**（改为 `svg` 内联 + `image` 双通道，Commons/维基双源自动兜底，删除"中英词表"坏做法）✅ 2026-09-09
- [x] **试卷题型适配差**（`sanitizeExamQuestions` 只认英文白名单，全降级 essay；重写为中文/英文别名映射 + 题型反推 + 选项归一化 + 答案收敛字母）✅ 2026-09-09
- [x] **思维导图公式文字溢出边框**（`calculateDescSize` 统一按 0.55em/字符估宽，希腊字母/全角实宽更大；改为按字符类分档 `estimateTextWidthEm` 并对齐测量盒/渲染盒样式）✅ 2026-09-09
- [x] **思维导图"生成中"状态错误卡死**（生成异常未正确回到 IDLE/错误态）✅ 2026-09-09
- [x] **提示词中文语境偏见 /"白熊效应"**（提示词改写，去除负面示例与中文语境强绑定）✅ 2026-09-09
- [x] **试题/概念配图未经校验直接渲染**（新增严格校验 + 失败回退）✅ 2026-09-09
- [x] **API 密钥跨厂商相互覆盖**（多厂商密钥统一由 `useAIConfigStore` 的 v2 结构按厂商隔离存储）✅ 2026-09-09
- [x] **生成失败时具体错误被通用文案覆盖**（`runGenerate` 返回 false 会用通用"生成失败"覆盖异常路径写入的具体错误 → 改为保留 `prev.error`）✅ 2026-09-10
- [x] **全空结果被误判为有内容并渲染空卡片**（空对象为 truthy 使 `if (latest)` 成立 → 新增 `hasUsableContent()` 判定，全空回到 IDLE）✅ 2026-09-10
- [x] **查词/翻译交互不满足需求**（改为源/目标双下拉 + 逐段对齐 + 短语多词支持 + 选词实时映射 + 输入上限计数）✅ 2026-09-10
- [x] 问答模式连续输入相同内容重复处理（添加processingRef防重机制）✅ 2026-07-12
- [x] 问答模式示例问题被加到输入框（移除setValue调用）✅ 2026-07-12
- [x] 代码质量优化：删除死代码、提取通用错误处理、统一类型定义位置、清理未使用导入 ✅ 2026-07-12
- [x] 文档模块"浏览中"状态不显示（viewingQuery从result.title改为currentTopic，使用原始输入topic作为标识）✅ 2026-07-12
- [x] 文档生成结果只能显示纯文本（改用ReactMarkdown + remark-gfm渲染Markdown富文本）✅ 2026-07-12
- [x] PDF导出功能缺失（集成jspdf，支持PDF格式导出）✅ 2026-07-12
- [x] 文档类型选择器太占版面（新增DocTypeSelector组件，支持折叠/展开效果）✅ 2026-07-12
- [x] 词典翻译输入自动检测切换反直觉（移除isSingleWord自动切换，用户手动切换模式）✅ 2026-07-12
- [x] 翻译模式风格切换不生效（新增performTranslateWithStyle，点击风格按钮重新调用AI翻译）✅ 2026-07-12
- [x] 历史记录多实例状态不同步（从useState hook重构为HistoryContext + Context模式）✅ 2026-07-11
- [x] 搜索/问答模式串扰（重构状态管理，两个模式完全隔离）✅ 2026-07-11
- [x] 搜索框搜索后未清空（handleSearch后调用setValue('')清空，避免query拼接）✅ 2026-07-11
- [x] 知识图谱节点展开/收起不生效（子节点expanded硬编码false → 从expandedNodes Set读取）✅ 2026-07-11
- [x] 历史记录内容冲突（物理定律与牛顿第二定律记录串台，添加topic===query一致性检查）✅ 2026-07-11
- [x] 叶子节点与知识点映射不唯一（添加topic字段，"牛顿第二定律（运动定律）"→"牛顿第二定律"）✅ 2026-07-11
- [x] mockData.ts重复属性编译错误（删除重复的"化学反应"和"编程算法"条目）✅ 2026-07-11
- [x] 优化 project-document-manager skill：完整重写，增加文档同步规则表、主动触发、判断指南 ✅ 2026-07-05
- [x] 配置文件路径问题（已从 .skills/ 迁移到 .trae/skills/）
- [x] Python版本兼容性问题（已修复f-string兼容性）
- [x] 配置注入JavaScript语法错误（已修复json.dumps换行问题）
- [x] 项目结构混乱（已完成模块化重构 v0.2.0）
- [x] 项目文档未及时更新（已补全 goal/design/versions/todo/history）
- [x] 追问对话功能未实现（m007）✅ 2026-07-05
- [x] 收藏功能未实现（m008）✅ 2026-07-05
- [x] 历史记录功能未实现（m009）✅ 2026-07-05
- [x] 搜索历史侧边栏不可见问题（已移除 hidden lg:block）✅ 2026-07-05
- [x] 搜索范围标签折叠后无法收起（已修复收起按钮）✅ 2026-07-05
- [x] 搜索范围标签缺少清空选择（已添加清空按钮）✅ 2026-07-05
- [x] 搜索范围标签功能无作用（已改为过滤条件匹配 category/tags）✅ 2026-07-05
- [x] 相关关键词无实际作用（已移除）✅ 2026-07-05
- [x] 字体太小（text-xs → text-sm）✅ 2026-07-05
- [x] 项目管理文档未同步更新（已同步 history/versions/todo/issues）✅ 2026-07-05
- [x] 热搜标签优化后文档未及时更新（已补更 history/todo/issues）✅ 2026-07-05
- [x] 热搜标签 `···` 按钮不可见（overflow-hidden 隐藏了按钮，改为 slice(0,5) 截断显示）✅ 2026-07-05
- [x] workflow-manager 缺少功能确认与文档同步步骤（已修复 Skill 逻辑）✅ 2026-07-05
- [x] 直接问答模式 - 消息顺序反转（已修复为从上到下追加）✅ 2026-07-05
- [x] 直接问答模式 - 两个模式对话共享（已分离为 followUpMessages/qaMessages）✅ 2026-07-05
- [x] 直接问答模式 - 搜索模式初始显示知识问答（已改为仅在搜索模式下有结果时显示追问）✅ 2026-07-05
- [x] 问答历史追加而不是切换（已改为完整对话会话，点击历史加载完整消息）✅ 2026-07-08
- [x] 问答历史浏览中标记被追问覆盖（已改为以第一条消息为标识）✅ 2026-07-08
- [x] 搜索历史浏览中标记不准确（已改为使用 currentQuery 判断）✅ 2026-07-08
- [x] 搜索追问被加到所有历史记录（已在 handleSearch 开头清空 followUpMessages）✅ 2026-07-08
- [x] 历史模块架构重构（通用 HistorySidebar 组件 + API 统一 + props 传递链消除）✅ 2026-07-08
- [x] 收藏与历史记录架构分离（label字段 + HistoryData联合类型 + 完整状态恢复）✅ 2026-07-08
- [x] 删除浏览中记录时内容区不清空（已修复：handleRemove 同步清空状态）✅ 2026-07-08
- [x] 收藏项打开时创建新历史记录（已修复：showFavorite 不再调用 addHistory）✅ 2026-07-08
- [x] 收藏面板显示卡片标题而非搜索词（已修复：优先显示 item.label）✅ 2026-07-08
- [x] 全局菜单（主题/语言/设置）✅ 2026-07-08
- [x] 浏览中历史记录未置顶（已修复：getHistoryByType 按 viewingQuery 动态排序）✅ 2026-07-08
- [x] 浏览状态切换未更新时间戳（已修复：各模块添加 useEffect 监听 viewingQuery 变化）✅ 2026-07-08
- [x] 清空历史/收藏缺少确认提示（已添加：ConfirmDialog 组件 + 二次确认）✅ 2026-07-08
- [x] 全局清空历史记录失效（已修复：`key` prop 强制组件重新挂载 + `refreshKey` 状态计数器）✅ 2026-07-09
- [x] 搜索历史追问对话无法查看（已修复：`updateSession` 保留原有数据 + `getSearchSession` 获取完整数据）✅ 2026-07-09
- [x] 收藏内容打开后未加入历史记录（已修复：`showFavorite` 添加 `addHistory` 调用）✅ 2026-07-09
- [x] 主题切换失效（已修复：`useTheme` 重构为 `useSyncExternalStore`）✅ 2026-07-09
- [x] 深色模式大片亮色区域（已修复：18 个组件添加 `dark:` 变体）✅ 2026-07-09
- [x] 深色模式配色不协调（已修复：`slate` → `zinc` 中性灰色系）✅ 2026-07-09
- [x] AI服务调用问题：翻译模块和文档生成模块未调用真实AI服务，使用mock数据（已修复：三个模块统一调用aiService）✅ 2026-07-11
- [x] 直接问答模式使用简单规则匹配而非真实AI（已修复：调用aiService.search.followup）✅ 2026-07-11
- [x] AI搜索结果重复问题：搜索模式生成一次内容后重复显示（已修复：状态管理优化）✅ 2026-07-11
- [x] 问答模式 setState 在 render 中更新警告（已修复：useRef + useEffect 异步执行 touchHistory）✅ 2026-07-12
- [x] 问答模式布局不合理（已修复：对话内容和示例问题移到输入框上方）✅ 2026-07-12
- [x] 搜索模式追问缺少等待提示（已修复：QASection 添加 isLoading 属性）✅ 2026-07-12
- [x] 知识内容导出格式复杂且缺少复制功能（已修复：简化为 Markdown 格式，添加复制按钮）✅ 2026-07-12
- [x] 历史记录时间戳漏洞修复：从"浏览中"状态切换到其他模块时时间未更新（已恢复原逻辑，保持原有行为）✅ 2026-07-14
- [x] 密钥管理图标替换：从Heroicons key替换为Bootstrap Key SVG图标 ✅ 2026-07-14

## 已关闭
- [x] Skill未添加到列表（已迁移到正确目录）
- [x] 配置文件报错（已修复验证和注入逻辑）

## 经验教训
- 做重大变更前必须先更新项目文档
- 不确定用途的外部文件不要擅自删除，应先归档并询问用户
- 所有功能实现后必须同步更新 issues.md 和其他项目文档
- **React Hooks 本地状态与外部存储同步问题**：`useState` 初始化只执行一次，多个组件实例独立维护状态，localStorage 变化不会自动同步。解决方案：使用 `key` prop 强制重挂载，或改用 `useSyncExternalStore`（推荐长期方案）
- **数据更新时避免覆盖完整对象**：`updateSession` 更新历史数据时使用 `...(item.data || {})` 保留原有字段，防止丢失 `result`、`generatedData` 等关键数据
- **参考已有模式**：搜索历史恢复逻辑参考问答模式的 `getQASession` 实现，使用统一的 store 获取方法而非直接读取列表数据
- **英文作类型基准 + 中文深合并兜底**（i18n）：改文案先改 `*En`（类型来源）再补 `*Zh`，漏补立即 tsc 报错；运行时缺 key 回退英文，不会出现 `undefined` 文案。切忌用 `Partial` 放宽中文表——那会让漏翻译静默溜过
- **并行编辑同一批文件存在写入丢失风险**：多次出现"工具报告成功但内容未落盘"（含 EBUSY）。批量编辑后**必须用 grep / tsc 复核**，发现未生效立即重做
- **测试不要断言写死的中文错误串**：文案本地化后应断言 `getCurrentStrings().<area>.*`，否则随语言或文案变动而失败
- **"流式"必须真流式**：分块 `setTimeout` 弹出只是把等待伪装成分段出现；真流式需要增量 JSON 解析 + 节流 setState，且最终态要用服务端完整结果兜底一次
- **判断生成是否写完不要用带 repair 的解析器**：`parseJSONResponse` 会把截断 JSON 补成合法，导致续写逻辑被静默跳过；必须用严格的闭合判定（`hasCompleteJSONObject`）
- **"吞错器"会让下游错误处理变成死代码**：`withFallback` 把链路异常吞成 `success:true` 的空结构体，使状态机里的超时识别永远不触发；改错误处理前先确认这一层是否会把异常吞掉（2026-09-12）
- **同一语义不要有两套实现**：续写判定与解析层的括号配对双写，先出现"漏判 `[]`"的边界 bug；凡"完整性/解析"类判定都应指向同一权威实现（2026-09-12）
- **思考型模型的默认思考会吃掉输出预算**：关闭思考的字段名**逐厂商不同**（千问 `enable_thinking` / 智谱 `thinking:{type:'disabled'}` / DeepSeek `reasoning_effort`），传错会 400；且思维链会占满 `max_tokens` 导致正文截断——"生成失败"的高频隐蔽来源（2026-09-12）
- **负面约束 ≠ 可执行约束**：写"别画错""要准确"模型无法执行；必须给**正向的、分步骤的**做法（先立骨架→定坐标→补标记）与**反例句 + 判定准则**（"答案与解析不一致""不准出现'改原题'类措辞"）（2026-09-12）
- **"不完整"与"为什么不完整"必须分开建模**：一个 `truncated` 布尔承载不了归因，UI 就必然把网络中断报成"模型输出上限"——**错误归因比不提示更糟**（用户会去换模型，而真正该做的是检查网络）。凡状态判定都要配原因字段（2026-09-15）
- **兜底（fallback）必须分级**：无差别 `catch → 返回兜底值` 对"输入校验/翻译"是善意降级，对"内容生成"是灾难——它把 `success:true + 空结构体` 交给上层，使**已流出的内容与真实原因一起被丢掉**。生成类调用一律 strict 透传（2026-09-15）
- **续写的边界不是"原因"而是"次数 + 值不值得"**：只要已收到内容且中断值得再试，回填续写就是正解；真正要设计的是硬上限（3 次）与"不值得再试"清单（用户取消 / 安全策略拦截 / 内容根本不是 JSON）（2026-09-15）
- **不要在 catch 里复用循环开头的快照判断"现在有没有内容"**：`hasContent` 这类循环内状态在异常路径上必须是**当下重算**的，否则"本轮吐了几千字符才断"会被当成空内容直接上抛，丢掉整段内容（2026-09-15）
- **声明式接口的参数必须是"调用方能保证稳定"的那个值**：翻译模块把"我在看哪条记录"交给模型返回的 `word` / `original`，归一化一次就静默失配 —— 表现是"某个功能悄悄不生效"，无报错无日志，最难查。凡是往声明式接口传的参数，都要问一句：它的值会不会被第三方改写？（2026-09-20）
- **页面卸载路径上不能依赖任何 React 派生的值**：`useMemo` / `useEffect` / state 提交都可能来不及。凡"离开页面时必须落盘"的状态，都需要一份**同步写入的 ref 副本**，外加一条不依赖 React 的兜底路径（本次是 `findByQuery` 回磁盘找）（2026-09-20）
- **兜底要绑死"触发场景"，不能做成通用能力**：同一个兜底函数被两条语义不同的路径复用，A 场景的容错就会泄漏到 B 场景（"进入内容"被当成"离开"）。分档不是啰嗦，是防串味（2026-09-20）
- **性能问题先量再答**：直觉"写前重读磁盘 = 多一次 IO，会不会更慢"与实测相反 —— 单条重读 0.026 ms，而旧布局每次都要序列化整表 906 KB（7.260 ms）。凭直觉下结论容易劝退正确的方案（2026-09-20）
- **"改了没生效"先确认跑的是哪份代码，再改第二遍**：本仓库有两条入口 —— dev（5173，服务 `src/`）与 demo（`start.bat` → 3000，服务构建产物 `dist/`）。连续两轮都在改 `src/`，而用户看的是 `dist/`，于是每轮"修好了"都无从验证。**症状与代码分析矛盾时，第一嫌疑是"他跑的不是这份代码"**（2026-09-20）
- **取证要用页面内的探针，不要读代码推理**：劫持 `setItem` + 监听页面级事件，一次运行就能把"事件有没有来 / 写有没有发生"钉死；比来回读代码猜快一个数量级（2026-09-20）
- **构建产物必须能识别出"自己旧了"，静态服务不要省 `Cache-Control`**：不发缓存头 ≠ 不缓存，浏览器会启发式缓存 `index.html`，重新构建后可能仍加载旧 hash 资源 —— 旧行为于是伪装成新 bug，且能连续误判好几轮（2026-09-20）
- **"更简单的方案"要按"要维护的代码量"算，不是按产物里的字节数算**：导图导出原先不肯嵌图，理由是"Word 里画形状要 DrawingML，成本大"—— 那等于在导出层**重造一遍布局与绘制**（两份实现必然漂移）。改成嵌位图后，导出层只剩"布局（本来就有）+ 一次 `toDataURL`"。产物大了几十 KB，代码少了一整条分支（2026-10-06）
- **同一个语义对象的多个出口必须共用同一份绘制/序列化源**：本项目已经因"复制与导出各写一份"吃过一次大亏（导出丢一半内容），"PDF 导图页与 Word 导图页各画一份"是同一个坑的第二个入口。凡"同一内容要在多处呈现"，先问"这两处能不能指向同一份实现"（2026-10-06）
- **出口的"输入形态"不同，能力就不等价，必须显式对账**：PDF 出口走结构化数据、Word 出口走 Markdown，于是"同一份内容"在两侧天然有差（首标题处理、有没有导图大纲段、列表能不能表达嵌套）。统一源做不到时，**差异要写成清单逐条对齐**，不能靠"看起来差不多"糊过去（2026-10-07）
- **"降级"不许改变语义身份**：把 Markdown 首行 `# 标题` 改写成普通段落，看着只是字号差异，实际是让同一份内容有了两个身份，读的人无从判断该信哪个。要么按它本来的身份渲染、要么丢掉，**没有中间态**（2026-10-07）