# 版本里程碑

## v1.7.4 (2026-10-10) —— 导图布局回退修复 + 在线语音朗读 + 续写上下文补齐

> **版本号说明**：本版是 **v1.7.3 之后的一个补丁版本**（PATCH）。它包含三条**修复**
> 与一项**朗读能力的增强**（接入在线 TTS）。按 §7，单看在线 TTS 属能力新增（MINOR 语义），
> 而 `1.8.0` 已按路线图锁定给「移动端适配」；**用户拍板（2026-10-10）：一并收进 PATCH `v1.7.4`**。
> 理由 —— 本版起因是"原文朗读没声音"这条缺陷，接入在线 TTS 是同一个
> **「本机语音不可靠」根因**的收尾（本机语音取决于操作系统装了哪些语音包，代码层面治不好）。
> `1.8.0` 仍锁给「移动端适配」。

### 一、思维导图布局算法在导出重构时被顺手改坏（回归）

- 现象（用户报）："思维导图渲染算法逻辑在封装时（处理导出文件功能）被其他模型意外改动了，
  请仅恢复渲染逻辑（之前很完美）"。
- 取证：`git diff 5bb1dd2 cf69235 -- src/components/knowledge/KnowledgeContentView.tsx`。
  导出重构把组件内联的布局算法抽成 `utils/mindMapLayout.ts`（这步本身是对的 —— 页面与导出
  必须共用同一份布局），但**顺手改了 `measureNode` 的非叶子分支**：

  | | 重构前（正确） | 重构后（回归） |
  |---|---|---|
  | `subtreeH` | `max(size.h, childrenTotalH)` | `childrenTotalH` |
  | `topOffset` | `subtreeH / 2` | `size.h / 2` |
  | `bottomOffset` | `subtreeH / 2` | `childrenTotalH` |

  `layoutMeasuredNode` 用 `startY + child.topOffset` 定位子节点，`topOffset` 的语义必须是
  **该子树带的中点**。改成 `size.h / 2` 后节点被顶到带上沿：子节点少而节点自身高的分支
  （单链 / 单子分支）会整体上移，与兄弟节点的子树带错位（重叠或留空不均）。
- 修复：非叶子分支恢复成重构前的算法。**保留**文件拆分与 `originX/originY` 参数
  （导出需要控制原点，默认 450/350 与旧硬编码一致）。
- 验证：用 esbuild 从 git 取出旧实现，与当前实现跑同一批夹具（7 组：单根 4 子 / 描述盒 /
  单子高节点 / 4 层单链 / 多根 / 奇数子节点 / 希腊字母宽估），**逐节点、逐连线 JSON 完全一致**；
  对出问题那版跑同样对比会红（4 层单链夹具里 B 从 y=330 偏到 334）。

### 二、原文朗读没有声音（本机缺该语言语音时静默失败）

- 现象（用户报）："查词翻译模块原文没有发音，译文发音正常"。
- 取证（真 Chromium + 页内探针）：本机 `speechSynthesis.getVoices()` 只有 3 个中文语音
  （Huihui / Kangkang / Yaoyao，Chromium 走 OneCore，注册表里那个 en-US Zira 它看不见），
  **没有英语语音**。英文原文请求 `en-US` 时 `getVoiceForLang` 返回 null → 旧实现
  **把 `utterance.voice` 留空**就发出去 → 引擎静默不播。中文译文有匹配语音，所以正常。
  更糟的是 `useSpeechSynthesis` 的 `error` 状态**从未在任何 UI 里渲染** —— 失败连提示都没有。
- 修复：
  - `speak()` 在无匹配语音时**显式退到**「引擎默认语音 → 第一个可用语音」，并把
    `utterance.lang` 对齐到该语音的 lang（多数引擎拿不到 voice 就什么都不播）；
  - 新增 `SpeechFallback`（`requested` / `usedLang` / `usedVoice`）暴露给 UI，
    `SentenceResult` / `WordResult` 渲染「本机未安装「English」语音，已用「中文」代读」，
    失败时渲染错误文案（不再静默）；
  - `WordResult` 的朗读语言从硬编码 `en-US` 改为跟随源语言（查非英语词条此前也读不出）；
  - 朗读前若 `voices` 为空会**再取一次**（`onvoiceschanged` 迟到导致的静默失败）。
- 验证：真 Chromium 实测 —— 原文现在用 `Microsoft Huihui` 朗读（`onstart` 触发），
  页面出现降级提示；新增 `src/hooks/__tests__/useSpeechSynthesis.test.tsx` 锁死
  「有匹配 / 无匹配 → 兜底并提示 / 一个语音都没有 / 空文本 / stop 清理」
  （第四节又扩充了"在线优先 / 在线失败降级"用例，该文件现共 10 例）。

### 三、续写提示词缺"主题"与"JSON 进度"

- 现象（用户报）："内容续写逻辑应优化，续写时应给模型用户输入的主题及当前正在生成的部分
  （json 写哪了，写得怎么样了）"。
- 根因：续写轮的用户消息**只有** `buildJSONContinuationPrompt(partial)` 的产物 ——
  没有会话历史、没有原始 prompt，回填的又只是**内容尾部**（`CONTINUATION_CONTEXT_LIMIT` 截断）。
  那段尾部通常从某个字段中间开始，模型既不知道在写什么主题，也不知道结构上还差什么字段。
- 修复：
  - `partialJSON`：`scan()` 的 `ScanState` 与 `analyzeJSON()` 增加 `pendingKey`
    （**正在写**的顶层字段名）；
  - 新增 `describeJSONProgress(partial, requiredKeys)`：给出「已写完 / 正在写 / 还必须补上」三行；
  - `buildJSONContinuationPrompt(partial, task?, requiredKeys?)` 输出
    【本次任务】+【当前 JSON 进度】+【已生成内容】+ 续写要求，并要求"内容必须始终围绕【本次任务】"；
  - `generateJSONWithContinuation` 增加 `taskLabel`；四处调用点分别带上主题
    （知识生成 `围绕「topic」生成知识内容` / 追问 `围绕「topic」回答：question` /
    文档 `生成 doc 文档，主题「topic」` / 查词 `词典查词：word` / 翻译 `翻译这段文本：text`）。
- 验证：`continuation.test.ts` +4 例（提示词含主题与三行进度、核心字段齐全时不谎报缺字段、
  无 JSON 时给人话、端到端断言续写轮实际发出的 prompt 带主题与进度）；
  `partialJSON.test.ts` +1 例锁 `pendingKey` 的四种状态。

### 四、接入在线语音合成（"发音准"的正解）

- 背景：用户反馈"发音准确更好，能接在线 TTS 比较好"。第二节只治好了
  **"点了没反应"**，治不了**"读不准"** —— 本机语音完全取决于操作系统装了哪些语音包，
  代码层面拿不到英文语音就是拿不到（本机实测只有 3 个 zh-CN）。
- 先验真（不是先写代码）：用真 Chromium 从 `file://` 页面直连各家 `/audio/speech`，
  **带对照组**证明探针真能测出拦截：

  | 端点 | 结果 |
  |---|---|
  | OpenAI `api.openai.com/v1/audio/speech`（对照） | ❌ `TypeError: Failed to fetch`（CORS 拦） |
  | Anthropic（对照） | ❌ `TypeError: Failed to fetch` |
  | 智谱 `open.bigmodel.cn/api/paas/v4/audio/speech` | ✅ `res.type === 'cors'`，HTTP 401（仅 key 无效） |
  | 硅基 `api.siliconflow.cn/v1/audio/speech` | ✅ 同上 |

  结论：**发布形态（单文件 HTML 双击打开 = `file://`）下智谱/硅基的在线朗读可用**；
  OpenAI 官方端点不行（除非用户自配代理 baseUrl）。
- 设计（关键：不新增一套厂商配置）：
  - 各家 TTS 端点都是「对话端点把 `/chat/completions` 换成 `/audio/speech`」，
    故 `onlineTts.deriveSpeechEndpoint()` 直接从用户**已配好的厂商 baseUrl** 派生 ——
    **一份 Key，对话与朗读共用**；
  - 新增 `services/onlineTts.ts`：厂商预置（智谱 `glm-tts` 7 音色 / 硅基
    `FunAudioLLM/CosyVoice2-0.5B` 8 音色 / OpenAI 预留）、文本分块
    （智谱 `input` 上限 1024，超长直接 400，按句读边界切并保证不丢字）、
    `synthesizeSpeech()`（**两种回包形态都吃**：`audio/*` 二进制，或 JSON 里的 base64/URL）；
  - 新增 `hooks/useSpeechConfigStore.ts`：朗读偏好独立于对话配置存储
    （用户可能用 DeepSeek 对话、要智谱发声），模型/音色**按厂商分别记**；
  - `useSpeechSynthesis` 变成**在线优先调度器**：在线可用 → `Audio` 播放（`AbortController`
    可中断、逐块播放）；**在线失败自动退本机**并如实提示失败原因（`SpeechNotice`）；
  - 设置面板新增第 4 个 tab「语音朗读」（引擎 / 服务商 / 模型 / 音色 / 派生端点预览）。
- 验证：真 Chromium（`page.route` 拦截 `/audio/speech` 回一段真 WAV）——
  点"朗读原文"命中 `https://open.bigmodel.cn/api/paas/v4/audio/speech`，
  body `{"model":"glm-tts","input":"Good morning","voice":"tongtong","response_format":"wav"}`，
  **本机语音 0 次调用**、`Audio.play` 播放了 blob、无失败提示；
  设置面板「语音朗读」tab 渲染完整（含派生端点）。

### 验证与产物

- `tsc --noEmit` 干净；`vitest run` **563 例全过（42 文件）**（较 v1.7.3 的 529/40，+34 例）。
- 真 Chromium：搜索页导图渲染 10 节点 / 9 连线、0 console 错误；父节点几何居中于其子树带。
- 版本门禁：`package.json` / `package-lock.json`（顶层 + `packages[""]`）/ `docs/versions.md` /
  `README.md` / `docs/todo.md` 六处一致 `1.7.4`（`node scripts/check-version.js` 通过，含 tag 比对）。
- 产物：`release/知识灵动助手.html` **2,757,169 字节**（≈2.63 MB）+ `使用说明.txt`（8,863 字节），**不入库**。
- 发布（2026-10-10）：commit `cd9a62a` → `main` + 附注 tag `v1.7.4` → Release
  `https://github.com/ceepuka/zhishilingdong/releases/tag/v1.7.4`；附件 `zhishilingdong-v1.7.4.html` /
  `usage-v1.7.4.txt`；**匿名（不带 token）下载复验** sha256 `2e2f8a8d…` / `466d090e…` 与本地产物**逐字节一致**。

## v1.7.3 (2026-10-06 ~ 10-07) —— 公式可读 + PDF 真正能看 + 正文示意图可导出

> **版本号说明**：本版是 **v1.7.2 之后的一个补丁版本**（PATCH）。本轮工作原本被拆成
> 两个号（复制/导出重构、公式与 PDF 修复），实际**合并为一次发布**；按「未发布的改动
> 不占号 + MINOR 留给路线图」的规则，统一收进 `v1.7.3`。**`1.8.0` 号段按路线图保留给
> 「移动端适配」**（见 `docs/convention.md` §7 版本号规范）。此前文档里出现过的
> `v1.8.0` / `v1.9.0` 两个号**均已作废**（从未对外发布，其 tag 与 Release 已撤回）。
>
> **关于第八节的越界（已确认，2026-10-07）**：第八节的"正文示意图导出"单看形态是
> **能力新增**（MINOR 语义），而 `1.8.0` 已按路线图锁定给「移动端适配」。用户拍板：
> **一并收进 v1.7.3，不为它单独开 MINOR 号**。理由 —— 它与本版"导出内容对不齐"是
> **同一条缺陷链的收尾**：用户报的是"所有文档会丢失示意图内容"，属于**修缺陷**而非加能力。
>
> ⚠️ 这是**唯一一次**已知的越界，**不作为先例**。后续凡"想塞进补丁版的新能力"，
> 一律按 §7 走 MINOR 号；路线图锁定的号段（当前 `1.8.0`）不得被临时代替。

> 起点是用户实测的两份桌面文件（`复数.docx` / `复数.pdf`）：**公式没渲染、PDF 整页看不见**。
> 两条症状各有一个根因，而 PDF 那条要**推翻上一版"改走浏览器打印"的结论** ——
> 打印对话框会把页面栅格化，产出的是**位图 PDF**（实测参考件 6 页、文本长度 0、
> 中文字符 0）：**只要经过打印，文字就不可能可复制**。
>
> 修的过程中又挖出 6 个会让导出"崩掉或难看"的隐藏缺陷（跨页共用同一张图、
> 横向画布被换回纵向、行盒外溢切字、字号单位不一致导致标题缩到 0.375×、
> 孤行标题、位图流多一个换行把 JPEG 吃掉一个字节）。
>
> 注：本版还包含**前半程**的"复制与导出文件能力重构"（原先误标为 `v1.8.0`），
> 见文末「附：复制与导出文件能力重构」一节 —— 两半合起来才是一次完整发布。
> 另外按用户方案把**思维导图导出改成"从画布截图"**（PDF 导图页 + Word 附录页两个出口），
> 见第六节之后的「七、思维导图导出改为"从画布截图"」。

### 一、PDF 为什么"看不见"：不嵌字体的矢量方案在 Windows 上必然空白

先记下走过的两条错路，省得后面再走一遍。

- **第一版：走浏览器打印**。中文正常，但产物是位图 PDF，**文字不可复制、不可检索**。
- **第二版：按 PDF 规范预定义 CJK 字体族**。`/BaseFont /STSong-Light` +
  `/Encoding /UniGB-UCS2-H`，**不嵌 FontFile**，自带 ToUnicode CMap —— 结构完全合规、
  体积零增长，pdf.js 也能提取到文字（975/1127/514/259 字）。**但阅读器没有字形**：
  Chrome / Edge / PDFium / pdf.js 在 Windows 上都不提供 STSong-Light，
  实测每页 inkRatio 0.0008~0.0023，油墨只来自 `2 Tr` 描边的鬼影，屏幕上等于白纸。
  pdf.js 的日志已经把话说尽了：`Cannot load system font: STSong-Light`。
- 结论写进代码注释：**不嵌字体就不能指望汉字在 Windows 上显示**。
  顺带否掉两条嵌字体的路：jsPDF + 嵌入字体（覆盖 3500 常用字要 1.5–2 MB，单文件产物撑不住；
  subset-font 在大字符集上根本没有真正子集化，21557 字仍输出 7 MB）、
  fonteditor-core 把 CFF 转 glyf（转换不完整，cmap 与 glyf 顺序错位 → 汉字全错）。

### 二、现行方案：每页位图 + 隐形文字层（扫描件 PDF 的标准做法）

- `utils/canvasRenderer.ts`：用**浏览器渲染层**（系统字库）把每一页画成 canvas，
  2 倍超采样（`PT_TO_PX = 96/72 × 2` ≈ 144 DPI），JPEG 后作为
  `/Subtype /Image /Filter /DCTDecode` 的 XObject 整页铺满 —— 字形由位图负责，
  **不依赖阅读器字体**。
- `utils/pdfCore.ts`：手写 PDF 对象（零第三方依赖），组装内容流、字体、ToUnicode、
  XObject 与 xref。
- 位图里的字没有文字信息，所以再补一层渲染模式 `3 Tr`（不显形）的文字层，
  恢复选择 / 复制 / 检索。**记录点只能在真正调 `fillText` 的地方**
  （`PageWriter.record()`）—— 事后重新排版一定对不上。
- 已知取舍（记在注释里）：位图页的文字选区框位置不精确（内容正确）；
  一页几百 KB，比矢量文字大。

### 三、公式没渲染：三条漏网通道

围符内 `$…$` / `$$…$$` / `\(…\)` / `\[…\]` 一直是处理过的，漏的是另外三条：

1. **围栏块 ` ```latex `**：`export.ts` 自己就会为 `concept.notation` 生成这种块，
   而 `parseMarkdown` 会把行 join 成一段 —— 围栏与正文混在同一行，
   靠"行首判围栏"的写法当场失效。
2. **裸 LaTeX**：提示词明确要求 `notation` 字段"纯 LaTeX，不加任何围符"，
   正文也常写 `i \times i=-1`。**这是用户看到的真因**。
3. 嵌套参数：`\frac{z_1}{z_2}` 能匹配，`\frac{z_1 \overline{z_2}}{z_2 \overline{z_2}}` 不行 ——
   原正则 `[^{}]*` 匹配不了嵌套花括号，且单次 `replace` 不回溯。

全部收敛在 `utils/latexToText.ts`（docx 与 PDF 共用，不新增第二处实现）：

- 新增 `readableLatexExpression()`（整段确定是公式 → 全量降级）与
  `readableBareCommands()`（散文里夹的 → 只做命令级降级）。
- `ARG` 允许一层嵌套 + `expandParamCommands()` 迭代 3 轮，
  `\frac{\frac{a}{b}}{c}` → `((a)/(b))/(c)`。
- **保守原则**：不确定是公式的散文里**不动花括号、不做裸 `_x` → 下标** ——
  否则会吃坏 `snake_case`、`C:\Users\asus`、正则 `[^a-z]`、JSON 花括号。
  实测 `把文件放到 C:\Users\asus 下面` 原样通过；`^` 转 `²` 用 `(?<!\[)` 避开字符类写法。

### 四、6 个隐藏缺陷（都不是用户报的那两条）

- **跨页共用同一张位图**：图片去重 key 用"尺寸 + 头 8 字节"，而同尺寸 JPEG 的头
  8 字节是同一段 JFIF 标记 → 整份 PDF 只剩 1 个 `/XObject`，第 2 页起显示第 1 页。
  改为全字节 FNV-1a 哈希；测试用"头 8 字节完全相同的假 JPEG"锁死。
- **横向页其实是纵向画布**：`createRealCanvasCtx` 按 landscape 交换宽高，
  而调用方已按"横向 = 宽 > 高"传参，二次交换互相抵消；超页时还会再换一次。
  删掉交换，导图页可用宽度改用 `ctx.pageWidthPt`。
- **行盒外溢致色块切字**：行高 1.55em 而文字画在"行顶 + 1em"，字形实际占 ~1.16em
  → 每行溢出 0.6em，被紧随其后的色块/分隔线横切（探针实测 `高等解释:` 与公式框重叠 17px）。
  统一为 `TEXT_TOP_GAP = 0.16` + `LINE_H = 1.6`。
- **字号单位不一致（本次新增修复）**：`layoutSegs` 按 pt 排版（`seg.size * PT_TO_PX`），
  `drawSegs` 却把 `seg.size` 当 px 画 —— 所有显式给了 `size` 的片段都缩到 **0.375×**：
  标题 20pt 画成 20px、小节标题 14pt 画成 14px、选项字母 10px、出处小字 9px，
  而行盒仍按正常字号预留 → **小节标题与选项字母小到看不清、还悬在行盒上半空**。
  统一按 pt 解释；`record()` 的坐标与字号取到 0.01pt
  （否则 `14*PT_TO_PX/PT_TO_PX` 会把 `13.999999999999998` 写进内容流）。
- **孤行标题**：`ensure()` 只按标题自身高度预留，于是 `趣味知识` 正好落在第 1 页最底部
  （画完只剩 7pt），标题与内容被劈到两页。新增 `KEEP_WITH_NEXT_PX`：标题后至少留两行正文，
  否则整块挪到下一页。
- **位图流多一个换行**：image 对象的字典串本身以 `stream\n` 结尾，组装时又补了一个 `\n`
  → 流的第一个字节变成 `0x0A`，而 `/Length` 仍按 JPEG 原长声明，
  解码器读到的是"前导换行 + JPEG 少最后一个字节"。测试直接用字节判据锁住
  （`stream\n` 之后必须是 `FF D8`，按声明长度切完必须正好接 `endstream`）。

### 五、依赖与产物体积

- **新增**：`pdfjs-dist`（**仅测试用**：提取文字、核对页数与方向）、`jszip`（docx）。
- **移除**：`jspdf` / `@types/jspdf`（写中文是乱码）、实验期引入但最终没用上的
  `opentype.js` / `subset-font`。
- 单文件产物 **2.61 MB**（重构前是 2.5 MB，增量来自 canvas 渲染器 + PDF 生成器）；
  实测导出的 PDF **4 页**（正文三页 + 横向导图一页；第八节加入正文示意图后从 3 页变 4 页）。

### 六、测试

- 新增 `utils/__tests__/exportPdf.test.ts`（14 项）：注入 stub canvas 工厂
  （生产工厂要 `document.createElement`，Node 里没有 DOM，此前直接调会 13 项全失败）、
  每页引用互不相同的 XObject、DCTDecode/DeviceRGB、MediaBox 方向与画布尺寸、
  `3 Tr` + hex Tj、pdf.js 文字提取、公式不露 `\frac`/`\mathbb`/`quad` 且含 `∈ℝ`/`i²`、
  ToUnicode 覆盖、无 FontFile、位图流字节对齐、字号单位、无孤行标题。
- `latexToText.test.ts` 45 项、`mindMapImage.test.ts` 8 项，
  均补上围栏块 / 裸 LaTeX / 嵌套分式 / 导图截图与降级路径。
- 第八节（口径对齐 + 正文示意图）另加：`exportFigures.test.ts` **12 项**（新建）、
  `exportDocx.test.ts` 23 → **36 项**、`exportPdf.test.ts` 14 → **17 项**。
- `tsc --noEmit` 干净；`vitest run` **529 项全过（40 文件）**。
- 真浏览器复验：在 **`file://` 的单文件产物**里走用户真实路径（搜索 → 结果卡 → 导出菜单）
  导出 PDF 与 Word，再用 pdf.js 渲染核对 —— 文字可提取、无 LaTeX 源码、版式无重叠。

### 七、思维导图导出改为"从画布截图"

> 用户方案：「关于导出思维导图我的方案是从生成的画布截图，更简单」。采纳，
> **PDF 导图页与 Word 导图附录两个出口都改成截图**。

- **统一绘制源**：导图绘制抽成 `canvasRenderer.paintMindMap(ctx, positioned, lines, transform, record?)`，
  **PDF 横向导图页与 Word 内嵌图共用这一份**（此前只有 PDF 侧会画）。新增
  `renderMindMapImage(nodes, createCtx?)` 输出 PNG（`ctx.toPng()`，不支持时退回 JPEG），
  按内容包围盒 + 16pt 白边定尺寸，缩放上限 1.35（与 PDF 页同口径）。
- **Word 附录页从"缩进文字"改为内嵌位图**：手写 `w:drawing/wp:inline` + `word/media/mindmap.*`
  （第八节起与正文示意图共用编号，改名 `figureN.*`）
  + `[Content_Types].xml` 的 `Default Extension` + `document.xml.rels` 的 image 关系 +
  `w:document` 上的 `xmlns:r` / `xmlns:wp` —— **五件缺一件 Word 就报"内容有问题"**。
- **缩放口径**：横向页正文区 728.5×481.9 pt，位图按 `min(728.5/w, 429.9/h, 1.35)` 等比缩放后写进
  `wp:extent`（EMU，1 pt = 12700）；不溢出页边距、不拉伸变形。
- **截图比重画强在哪**：节点标题 / 描述里的公式经 `readableLatexInText` 降级后**随图一起走**，
  不必再为"图"单独维护一套公式降级；代价是位图不可编辑（PDF 侧本来就是位图，无额外损失）。
- **降级路径**：`renderMindMapImage` 抛错或返回空字节 → 退回原来的缩进文字，
  **导出绝不因"配图失败"整份失败**；空字节时也**不写 rels 关系**，避免悬空引用让 Word 报文档损坏。
- 端到端复验（`file://` 单文件产物 + 真 Chromium，探针在
  `F:\WorkBuddyData\.workbuddy\tmp\exportprobe\`：`export-e2e.cjs` 走 UI 导出并抓 Blob 字节，
  `verify.cjs` 拆包核对）：
  - **Word**：`word/media/mindmap.png`（第八节起为 `figureN.png`）113 KB / 2245×658 px（2× 超采样），内容占位图 96%×87%；
    `wp:extent = 9251950×2713867` EMU（= 728.5×213.7 pt，恰好占满可用宽、未溢出）；
    正文无残留缩进导图文字、无 LaTeX 源码。
  - **PDF**：2 页（595×842 纵向 + 842×595 横向），两页各 1 张位图；`3 Tr` 出现 43 次；
    pdf.js 能提取到"虚数单位""共轭与模"，无 `\frac` / `\sqrt` 残留。

> ⚠️ 上面这组数字是**当时**的结果。加入正文示意图之后，产物变成 4 页 4 图，
> 媒体文件名也从 `mindmap.*` 统一成 `figureN.*`（见第八节）。

### 八、Word 与 PDF 口径对齐 + 正文示意图导出（用户第二轮实测反馈）

用户拿两份产物逐项对照 Word 与 PDF，报了三条。前两条是**同一份内容两个出口不一致**
（本项目的老毛病，见 `docs/issues.md`），第三条是导出链**整块能力缺失**。

#### 8.1 首标题：Word 里变成小字

`buildDocx` 为了让文档顶部只有一个标题，曾把 Markdown 首行 `# xxx` **改写成普通段落**——
于是 Word 里出现"居中大号标题 + 紧接一行同样文字的小号正文"这种双标题，而 PDF 里
是正常的 20pt 标题。用户原话：「首标题格式不一致」。

降级是错的：要么它是标题（用 `Title` 渲染），要么它不该出现（丢弃），**没有"变成正文"
这第三种身份**。改法：

- 首标题与文档标题**同文 → 整块丢弃**（顶部 `titleXml` 已经渲染过同一个标题）；
  **不同文 → 保留为 Heading1**（说明这份内容有自己的标题，不是文档标题的重复）。
- 顺手把 `Title` 样式改成与 PDF 的 `title` 块同格式：左对齐 / 20pt /
  `#0F172A` / 下方一条 `#0D9488` 分割线。旧版是居中 + 22pt + 青色，
  两份产物放一起就能看出不是一套东西。

#### 8.2 冗余内容：同一份导图在 Word 里出现两遍

`generateKnowledgeNote` 会把思维导图序列化成 `## 思维导图结构` + `- 节点` 大纲
（txt / md / html 出口靠它才有导图内容），而 Word 出口**另外**还有一张横向导图页。
更糟的是那段大纲在 docx 里必然**失去层级**：`parseMarkdown` 的列表分支不解析嵌套缩进，
父节点与子节点会渲染成同一层，出来的是一串平铺项。PDF 走结构化数据、本来就没这段——
这正是用户看到的"Word 比 PDF 多出一块不需要的内容"。

改法：`buildDocx` 在**有附录页时**剥掉该区块（新增 `stripMindMapSection`）。
剥离放在 `buildDocx` 内部而不是调用方——它是"有附录页"这条不变式的一部分，
谁调用都绕不过去。精确匹配 `## {label}` 整行，不碰同名短语与三级标题。

#### 8.3 正文示意图：五个出口全都丢

用户原话：「所有文档会丢失示意图内容」。页面上的配图有四条来源，导出链此前
**一条都没接**（概念配图的 `image` / `imageData` / `svg` 在导出层零引用）：

| 图源 | 页面优先级 | 导出能否拿到 | 处理方式 |
| --- | --- | --- | --- |
| `image`（可靠来源直链） | 1 | ❌ 跨域 | 退化成一行图题 |
| `imageData`（多模态直出 base64） | 2 | ✅ 字节已在手 | 原样取字节，不重编码 |
| 关键词检索图 | 3 | ❌ 数据里没有 | 无从获取（渲染期 hook 的结果） |
| `svg`（模型手绘） | 4 | ✅ 可栅格化 | 补尺寸 → 画到 canvas → PNG |

新增 `utils/exportFigures.ts` 采集层（`collectKnowledgeFigures`）：三种来源统一转成
"可 `drawImage` 的对象 + 位图字节 + data URL"，**单张失败一律降级、绝不抛**——
导出不能因为"配图失败"整份失败。远程图不静默吞掉：拿不到就不进 map，
调用方退化成提示行，而不是让人以为这题本来没图。

- **PDF**：`CanvasCtx` 增加 `drawImage`，`renderBlocks` 增加图片块（宽度占满可用区、
  居中、下方灰色小字图题）。**高度上限取页高的 45%**——没有上限时一张竖长图会
  "永远放不下"，`ensure` 每次都换页直到把页数翻爆。渲染链保持**同步**，
  异步边界留在 `export.ts` 一次性采集（canvas 的 `drawImage` 是同步的，
  而图片解码天生异步，这个缝必须开在最外层）。
- **Word**：序列化层只在图**确实拿得到**时写一行 `![alt](figure:key)` 标记
  （那份 md 同时是"复制"出口的正文，塞 base64 会把剪贴板撑到几百 KB），
  Word 解析到标记再换成真位图；拿不到就退化成一行图题。媒体与导图
  **共用同一套 rId / media 分配**（旧实现把 `rId3` 硬编码给导图，正文再插图必然撞号，
  而撞号时 Word 只会含糊地说"内容有问题"）。
- **HTML**：直接内联 data URL（单文件 HTML 本来就该自带图）。
- **txt / md**：不出图（纯文本/剪贴板场景），保留一行提示。

#### 8.4 顺带修掉的一个真缺陷：SVG 子元素的 width/height 被当成画布尺寸

`svgWithIntrinsicSize` 原本在**整段 SVG 源码**里搜 `width` / `height`，而
`<rect width="300" height="180">` 这类子元素天生就带这两个属性 → "已有尺寸"分支
被误判命中 → **跳过 viewBox 注入** → `<img>` 退回浏览器给无尺寸 SVG 的默认值。
实测对照：原样 320×200 的图，`naturalWidth` 被读成 **240×150**，栅格化出来整张缩水一圈。
修法是只在**根标签**上找尺寸。这个缺陷在单测里锁住了（子元素带尺寸的用例）。

#### 8.5 验证

- `tsc --noEmit` 干净；`vitest run` **529 项全过（40 文件）**（新增
  `exportFigures.test.ts` 12 项，`exportDocx.test.ts` 23→36 项，`exportPdf.test.ts` +3 项）。
- 新增的锁**逐条反向验证过会红**：首标题不丢 → 文档里"复数"出现 2 次；
  不剥大纲 → 导图节点标题漏进正文；图不接进渲染 → `drawImage` 调用数 0；
  SVG 尺寸用全局搜索 → 返回 300 而非 320。
- 真浏览器打 `file://` 单文件产物走 UI 导出，抓导出 Blob 字节（探针同第七节）：
  - **Word**：`word/media/figure1..4.png`（概念直出图 240×160 / SVG 栅格化 320×200 /
    试题图 240×160 / 导图页 2245×658）；`r:embed` 4 个、与 media 一一对应、
    **无重复、无悬空关系**；正文无导图节点标题、无 LaTeX 源码；
    拿不到的远程图正确退化成一行图题；`figure:` 标记全部消化。
  - **PDF**：4 页（3 纵向 + 1 横向导图），每页 1 张整页位图；页面位图里能统计到
    示意图的蓝色系像素（证明图真被 `drawImage` 进去了）；隐形文字层 `3 Tr` **70 处**、
    `Tf` 76、文字可提取。
  - ⚠️ 记一笔假绿：上一版 `verify.cjs` 用 pdf.js 的 `OPS.setRenderingMode` 数隐形文字，
    结果是 **0**，而同一份 PDF 里 `3 Tr` 明明有 70 处——现在改成直接 grep 原始字节。

## v1.7.3 · 附：复制与导出文件能力重构（修"导出一半内容"）

> 这是 v1.7.3 的**前半程**（原先误标为 `v1.8.0`，从未对外发布）。与上面的
> 「导出公式 / PDF」合起来构成一次完整发布。

> 起点是一个很小的问题：**复制和导出增强**。往下查发现这条链路上叠着六个真问题，
> 其中一个是**导出文件丢一半内容** —— 页面上渲染的知识脉络 / 试题 / 趣味知识
> 三个区块在导出文件里整段消失，而"复制"出口一直有。
>
> 根因不是漏写了三个 `if`，而是**同一份 Markdown 被两份独立代码各写一遍**：
> `SearchResults.handleCopy` 有一份手写拼接器，`generateKnowledgeNote` 又写一份。
> 早先"导出丢失概览"那条 bug 就是它的产物，这次是同一个坑的更大一次发作。
> 所以本版的重点不是补三个字段，是**消灭双写** —— 复制与导出从此共用同一来源。

### 一、消灭双写：复制与导出共用同一序列化结果

- 删除 `SearchResults.handleCopy` 里约 90 行的手写 Markdown 拼接器，改为直接复用
  `generateKnowledgeNote(data).md`。两个出口从此**同一来源**，结构上不可能再漂移
- 枚举文案（概念类型 / 题型 / 难度 / 趣味类型）抽到 `utils/knowledgeLabels.ts`：
  之前定义在 `.tsx` 组件里，工具层要用只能反向 import，于是各写一份映射 ——
  典型表现是页面上写「简答题」而导出里写「简答」。现为纯函数 + 显式传 `s`，
  页面与导出共用，**枚举文案只有一个来源**

### 二、补齐导出缺失字段（本次的核心修复）

`generateKnowledgeNote` 此前**完全没有** `knowledgeContext` / `examQuestions` /
`interestingFacts` 的分支，而这三个区块页面上都在渲染。现在三段在
txt / md / html 三格式同步补齐：

- **知识脉络**：前置知识 / 关联主题 / 学习路径 / 常用结论 / 易混辨析。学习路径与
  常用结论**逐条编号列出**（原先若挤成一行，项数一多就读不出层次）
- **试题**：题型 + 难度 + 题干 + 选项（A/B/C/D）+ 答案 + 解析 + 出处。带图的题会
  留一行"本题原有配图无法随文字导出"—— 试题"如图"缺图就是道废题，不能让用户
  直接答一道无图的题
- **趣味知识**：标题 + 正文 + 类型标签
- 三段顺序与页面上区块顺序一致（概览 → 思维导图 → 核心概念 → 知识脉络 → 试题 → 趣味知识）

### 三、统一工具层：新增 `utils/clipboard.ts` 与 `utils/serialize.ts`

- **`copyText(text)`：三级降级且永不抛异常**
  Async Clipboard → `execCommand` → 返回 `failed`。
  为什么必须降级：本项目发布形态是**本地单文件 HTML**（`file://`，非安全上下文），
  那里 `navigator.clipboard` 整个是 `undefined`，裸调会抛
  `TypeError: Cannot read properties of undefined (reading 'writeText')`。
  此前 `DocResult` / `SentenceResult` 就是裸调 —— 用户点了没反应也没提示。
  两条路径在权限被拒时也会静默失败，所以**必须返回状态给调用方**，否则用户只会觉得应用坏了
- **`safeFilename()`**：文件名清洗。直接拼 `${title}.md` 时，标题含
  `\ / : * ? " < > |` 会被浏览器静默改名或下载失败（`a\b.txt` 在 Win32 上还会
  被当子目录）；`CON` / `PRN` / `NUL` / `COM1` 是 Windows 保留设备名，直接写会
  写到设备而非文件。含保留名单、全非法字符回退、超长截断
- **`downloadText` / `triggerDownload` / `downloadImage`**：revoke 延后到下一帧
  （同步 revoke 在 `file://` 下会取消下载）；MIME 统一补 `charset`（否则 Windows
  记事本打开中文 txt 是乱码）
- **`serialize.ts`**：查词 / 查句 / 文档 / 问答四类结果的纯文本序列化，
  **各出口共用一份**。词条结果此前有三个出口（复制 / 导出 / 收藏详情），
  拼字符串各写一次必然漂移

### 四、复制与导出的反馈从"静默"变成"可见"

新增 `components/ui/ActionBar.tsx`（`useActionFeedback` / `copyWithFeedback` /
`CopyButton` / `ActionFeedbackToast`）与 `components/ui/ExportMenu.tsx`
（统一下拉菜单，自适应宽度 + Esc 关闭 + 点击外部关闭）。

文案集中在 `common.exportActions`（**唯一一处**），关键是有 `copyFailed`：
复制失败必须让用户知道，否则"点了没反应"和"应用坏了"在用户眼里没有区别。
`exportPdfHint` 说明 PDF 会走打印对话框 —— 否则用户会以为点了没反应。

### 五、新增 Word（.docx）导出

- `utils/exportDocx.ts`：JSZip + 手写最小 OOXML（`[Content_Types].xml` /
  `_rels` / `word/document.xml` / `styles.xml` / `numbering.xml`）。
  不引 `docx` 包的考量：本项目导出内容是纯文字 + 标题 + 列表，
  自己拼 XML 约 300 行，换来"零新增运行时代码体积"的收益 ——
  与"单文件 HTML 内联发布"的产物体积约束直接相关
- 标题层级 → Word Heading 样式；`- ` / `1. ` 列表 → 带编号定义的真实列表
- 行内公式降级为可读文本：`\frac{a}{b}` → `(a)/(b)`。
  **带参数的命令必须先于花括号转括号处理** —— 顺序反了会得到 `frac (a)(b)`，
  读起来像连乘，除法语义丢失（已锁测试）
- `w:eastAsia="Microsoft YaHei"` 是中文正常显示的关键：OOXML 里中西文各走一套
  字体属性，只设 `w:ascii`（西文）时中文会落到 Word 默认字体，部分系统上是方框
- 覆盖：知识笔记（docx / md / html / txt / pdf）、文档（docx / pdf / md / html / txt）、
  词条（docx / md / txt）、问答（md / txt）

### 六、移除 jspdf：PDF 改走浏览器打印

> ⚠️ **后来被推翻**：本节的"改走浏览器打印"在同一次发布的后半程就被自研 PDF
> 生成器取代了（打印产出的是位图 PDF，文字不可复制）—— 见本文档顶部
> 「一、PDF 为什么"看不见"」。此处保留当时的决策过程。

- **实测结论**：jsPDF 内置 14 种标准字体全是 latin-1 编码，
  `doc.text('中文测试')` 写进 PDF 后内容流是 `N-e mK Õ` —— 每个汉字被打成两个
  乱码字节。仓库内无可嵌入的中文字体（`docs/references/_shared/fonts` 只有
  Geist / Instrument 等拉丁字体）
- 改走隐藏 iframe + `print()`，由系统字体渲染，中文必然正常；顺带能带上
  已渲染的 Markdown 结构。代价是走一次打印对话框（用户选"另存为 PDF"）——
  这是浏览器沙箱里不引字体就拿到正确中文 PDF 的唯一办法
- 依赖变更：`+ jszip` / `- jspdf` / `- @types/jspdf`，
  **单文件产物从 3.2 MB 降到 2.5 MB**

### 七、补齐功能缺口

- `WordResult`（查词）此前**没有任何复制/导出入口**，查到的生词只能手抄进生词本
- 收藏详情页四类内容（知识 / 查词 / 翻译 / 文档）此前**完全取不出来**，
  现统一接入复制 + 导出；知识卡片额外支持 docx 与 pdf
- 查句的复制从"只有译文"改为"原文 + 译文 + 关键词 + 语法说明"
  ——只给译文会丢掉对照关系，而原文就在屏幕上
- 移除 services 层死代码 `document.export`（`baseAIProvider` 实现恒返回
  `text/plain`、忽略 format 参数；mock 里的 PDF 是手写伪造字节串；全项目无业务调用点）

### 八、测试

- 新增 `utils/__tests__/clipboard.test.ts`（14 项）：文件名清洗全部规则、
  file:// 降级、权限拒绝降级、两路皆失败、异常收敛、临时节点清理
- 扩充 `utils/__tests__/export.test.ts`（3 → 15 项）：锁住三字段在
  txt/md/html 三格式都不丢、区块顺序、选项字母、出处、空值不产 `undefined`
- 新增 `utils/__tests__/exportDocx.test.ts`（13 项）：zip 必需部件、
  PK 魔数、标题/列表样式映射、XML 转义防注入、中文 eastAsia 字体、
  公式降级保除法语义
- `tsc --noEmit` 干净；`vitest run` **421 项全过（36 文件）**

## v1.7.2 (2026-09-30) —— 查词/翻译接入统一续写链路 + 演示数据补齐

> 本版起点是一个用户实测报错：**点关键词跳转查词时报「Failed to parse JSON response」**。
> 根因不是模型不稳定，而是查词/翻译是全项目**唯一还没接入续写链路**的生成入口；
> 顺带把这条链路上"技术细节直接上屏"的老问题一并收掉，并补齐了演示用的 Mock 数据。

### 一、查词/翻译接入统一续写链路（修 "Failed to parse JSON response"）

- 新增 `BaseAIProvider.generateJSONWithContinuation<T>(prompt, systemPrompt, depth, requiredKeys, signal?)`：
  复用**同一个** `callModelStreamWithContinuation`（同一重试预算 `MAX_GENERATION_ATTEMPTS=3`、同一 `canContinueAfter` 判据、同一套中断归因），
  只是不需要增量回调。**没有另写一套非流式续写**（两套实现必然漂移）
- 新增 `buildJSONKeysCompleteChecker(requiredKeys)`：与 `buildGenerateCompleteChecker` 同口径（复用解析层 `analyzeJSON`，不另写括号配对）；
  查词必填 `['word','definitions']`、翻译必填 `['original','translation']`
- 确实一个字都没解析出来时才抛 `GenerationInterruptedError`，由 `withFallback(strict)` 透传 code；
  有半截 JSON 就渲染出来（`lastRenderable` 兜底），不再"整段丢弃"
- `DictionaryQueryResponse` / `TranslateQueryResponse` 与 `WordResult` / `SentenceResult` 新增 `truncated` / `continued` / `interruption`，
  `GenerationNotice` 挂在**结果卡末尾**（放内容之前等于"先报错再看内容"）
- 新建 `src/modules/translate/errorText.ts::friendlyTranslateError(code, raw)`：**不复用**搜索的 `toFriendlyError`
  （那套假设"已收到内容已展示"，措辞会与屏幕不符）；`translate/index.tsx` 的 catch **不再静默塞 mock 结果**

### 二、演示数据（Mock）补到"点得到就有内容"

- `mockData.ts`：新增 9 条**短语词条**（含复现用户报错原文的 `respond well to`）；新增 `mockExtra` 合并表，
  为全部 **68 条**词条补齐 `collocations` / `relatedTerms`（已有值优先）；删除无引用的死代码 `mockSentenceResult`
- `mockAIService.ts`：
  - `mockMiniGlossary` 兜底词表扩到 130+ 条（含关联术语/常用搭配里的词素）
  - 新增 `deriveMockKeywords()`：短语按词表拆出"词 + 一句话释义"，**查不到释义的词直接不返回**（不塞碎词）
  - 新增 `deriveMockFallbackDefinitions()`：未收录词不再一律"暂无该单词的释义"，改为按词素给一条**标注了降级**的拆解释义；
    一个词素都查不到时仍如实显示"暂无"（不编造词义）
  - 新增 `mockSentenceExtras`（10 条策展语料）：译文/关键词/关联术语/语法说明都是真内容，
    其中 `good morning → 早上好` 的 `tokens` 按**原文词序**配 key（key1 good→好、key2 morning→早上），
    演示"译文语序与原文相反时只能按 key 配对"；没策展数据就不给，不再编造 `相关词汇` / `语法说明` 这类占位垃圾

### 三、质量守卫

- 新增 `src/modules/translate/__tests__/mockLinks.test.ts`：**全量**遍历所有可点击目标（关联术语 / 常用搭配 / 关键词，354 个唯一词），
  用假时钟跳过 mock 的 `delay(300)` 逐个查一遍，断言没有一个落到空词条。以后往词条里加词而词表没跟上，这条测试立刻红
- 浏览器探针 `~/.workbuddy/tmp/probe-mock-v172.cjs`（21 项断言）与 `audit-mock-links.cjs`

### 验证

- `tsc --noEmit` 零错误；vitest **383 例 / 34 文件全绿**
- 真实浏览器（`http://localhost:5173`，Mock 模式）21 项断言全过、0 console error / 0 pageerror：
  - 查词 `algorithm`：常用搭配 4 条、关联术语 5 条全部出现，点击真的换成那个词的结果且**不是空词条**
  - 查词 `good morning`：短语徽标 + 2 条带释义的关键词 + 3 条常用搭配，点关键词跳查词
  - 翻译 `good morning`：译文片段 DOM 顺序为 `[2,1]`（语序相反、按 key 配对），关联术语 3 条不含占位垃圾、点击切到 `#search` 并真的发起搜索
- 可点击目标审计：354 个唯一目标词，落空 **0** 个（修复前 104/243 的关联术语、240/247 的常用搭配落到空词条）

---

## v1.7.1 (2026-09-29) —— 发布形态正式定为单文件 HTML

> 本版把**发布形态**收敛为一种：一个可以直接双击打开的 HTML。
> 同时收纳 v1.7.0 之后累计的一批生成链路与历史模块修复。

### 发布形态

- `npm run release` → `release/知识灵动助手.html`（全部 JS / CSS / 字体内联，约 3.2MB）+ `使用说明.txt`
- **产物不入库**，作为 GitHub Release 附件分发，仓库只留源码
- 移除云部署（`netlify.toml` / `vercel.json`）与本地静态服务（`server.js` / `start.bat` / `scripts/postbuild.js` / 多文件 `dist/`）
- 新增 `vite.standalone.config.ts`（构建到 `.tmp-standalone/`）与 `scripts/build-standalone.js`（内联并写入 `release/`）
- `package.json` version 由 `0.1.0` 更正为 `1.7.1` —— 此前该字段与 versions.md / README 记录的里程碑长期脱节

### 公开仓库建立

- 新建公开仓库 [ceepuka/zhishilingdong](https://github.com/ceepuka/zhishilingdong)（此前仓库为 private，外部无法下载体验）
- **首次公开采用单提交历史**：公开前全量扫描 git 历史发现两处真实泄露（`.env` 里的智谱 GLM API Key、`docs/external/Session ID.txt` 里的 Trae 会话标识）。
  `.env` 早已删除，`Session ID.txt` 当时仍在 HEAD 中被追踪 → 与其做历史重写，不如把干净的工作树作为一次全新初始提交推上去
- 公开仓库**排除开发过程产物**：`.trae/`（开发计划）与 `.workbuddy/memory/`（工作日志，含本机路径与内部推理）加入 `.gitignore`，
  不进入公开历史；旧私有仓库以 `archive` 远端保留完整历史与这些文件
- Release `v1.7.1` 在新仓库重建，附件 `zhishilingdong-v1.7.1.html`（3.18MB）+ `usage-v1.7.1.txt`，已用**匿名请求**验证可下载且内容完整

### 内容修复（v1.7.0 之后累计）

- **中断提示归位内容末尾**：`GenerationNotice` 由标题头之后移到所有内容区块之后；`DocResult`、收藏详情、`SearchContainer` 统一同一口径 —— 提示描述的是"末尾没写完"，位置就该紧接内容尾部
- **尾部快照兜底**：流结束时最后一次解析失败（例如正好停在半个转义序列上）不再把整段已渲染内容报废成技术性错误横幅，改用 `lastRenderable` 兜底并按内容侧 `incomplete` 归因
- **历史模块浏览登记重构（m035~m040）**：浏览中状态收归 `HistoryProvider`；存储改为单条键；数据层"磁盘是真相"；30s 心跳把"落盘丢失窗口"限制在一个周期内；登记身份改用用户输入而非模型返回字段

### 验证

- 真实浏览器以 `file://` 打开产物：应用正常挂载、localStorage 可写可回读、Mock 搜索端到端跑通（失败请求 0 / console error 0 / pageerror 0）
- CORS 对照矩阵（`file://` vs `http://localhost`）：智谱 / 通义 / DeepSeek / Moonshot / 硅基流动两边均放行（HTTP 401 仅因密钥无效）；OpenAI 两边均超时（网络问题，非 CORS）
- `tsc --noEmit` 零错误；vitest 341 例 / 30 文件全绿

---

## v1.7.0 (2026-09-15) —— 正式发布里程碑

> 本版为**正式发布版**：包含版权声明与 MIT License（`Copyright (c) 2026 ceepuka`），
> 并完成生成链路的"中断分类 → 全场景续写 → 错误处理"整体治理。

### 完成小目标
- **版权与合规**：页脚版权声明（署名 GitHub: ceepuka）+ `LICENSE`（MIT）+ README 全量纠错
- **仓库卫生**：`dist/` 停止被 git 追踪（修复仓库污染），清理可再生临时产物
- **生成中断分类模型**：明确区分「模型侧（输出上限 / 安全策略）」「链路侧（网络 / 超时 / 协议 / HTTP）」「内容侧（静默截断 / 解析失败）」「用户侧（取消）」
- **续写覆盖全链路**：不再只有"模型超限"会续写，网络中断/超时/协议错/静默截断一样会接着写
- **错误处理分层**：生成类调用改为严格模式，异常不再被吞成"成功但空数据"
- **提示按原因分档**：横幅区分中断原因并标注自动续写次数，搜索与文档模块共用

### 功能清单
- [x] 新增 `services/streaming/interruption.ts`：`InterruptionKind` / `InterruptionSide` / `GenerationInterruption` / `classifyThrown` / `canContinueAfter` / `kindFromFinishReason` / `interruptionFromCode` / `GenerationInterruptedError`
- [x] 新增 `StreamNetworkError`（fetch/body 传输层失败）与 `StreamAbortedError`（用户取消），与 `StreamTimeout` / `StreamProtocol` 区分开
- [x] `callModelStream` / `callModel`：`finishReason` 逐层透出；`fetchOrThrow` 把裸 `TypeError: Failed to fetch` 归类为网络中断
- [x] `callModelStreamWithContinuation` 重写：中断分类驱动续写；无内容时按原 prompt 重发 1 次；**总请求数硬上限 3**；返回结构化 `interruption`（kind/side/attempts/continued/resolved）
- [x] 续写提示词不再写死"达到输出长度上限"（措辞改为中性"输出中途被中断"，避免给模型错误上下文）
- [x] `withFallback` 增加 `strict` 模式：生成类调用（search generate/generateStream/followupStream、doc generate/generateStream）异常一律 `success:false + code`，不再吞成 `success:true` 空结构体
- [x] HTTP 错误（401/额度/限流/5xx）带 `aiError` 透传，不再静默降级
- [x] `SearchGenerateResponse` / `DocResult` / `DocumentGenerateResponse` 增 `interruption?` 字段
- [x] 新增 `components/ui/GenerationNotice.tsx`：按 `side` 配色、按 `kind` 取文案的分档横幅，兼容旧历史数据（只有 `truncated`/`continued` 布尔）
- [x] i18n：新增按原因分档提示文案 + 8 条错误文案（中英同步，英文作类型基准）
- [x] 状态机：`toFriendlyError` 覆盖全部中断 code；失败但已有内容时**保留内容并挂上归因**；catch 分支统一走 `classifyThrown`
- [x] 文档模块：`truncated`/`continued`/`interruption` 全链路接通（此前完全没接，用户只能看到半截正文且零提示）
- [x] 版权声明与 LICENSE（v1.6.2 之后、本版发布前完成的一批提交）
- [x] 仓库清理：`git rm -r --cached dist` + 删除可再生临时产物（≈5.9 MB）

### 技术栈
- Vite 5 + React 18 + TypeScript 5
- Tailwind CSS 3
- SSE 流式 + 增量 JSON 解析 + **中断分类驱动续写** + 首字节超时兜底
- KaTeX（行内公式 + 独立公式）

### 状态
已完成并通过构建验证

**构建验证（2026-09-15）：**
- ✅ TypeScript 类型检查通过（`tsc --noEmit` 零错误）
- ✅ vitest **277/277** 全部通过（**20 文件**；本次净增 47 例：中断分类 19 + 全链路续写与归因 11 + 严格模式 fallback 6 + 分档提示组件 11）
- ✅ 生产构建成功（`vite build`）

**关键行为契约（写进测试，防回归）：**
| 场景 | 结果 |
|---|---|
| 模型超限 `finish_reason=length` | 续写；归因 `length`（模型侧） |
| 流到一半网络断开（已收到内容） | **仍然续写**，不再直接终止；归因 `network`（链路侧） |
| 一个字都没拿到 | 按**原 prompt** 重发 1 次（不空转耗满 3 次），仍失败则抛错 |
| 用户取消 / 安全策略拦截 / 内容非 JSON | 不自动重试 |
| 已被续写补全 | 横幅显示"已自动续写并补全" |
| 未被补全 | 横幅按原因分档 + 标注自动续写次数 |

**新增文件：**
- `src/services/streaming/interruption.ts`（中断分类模型）
- `src/components/ui/GenerationNotice.tsx`（分档提示横幅）
- `src/services/streaming/__tests__/interruption.test.ts`
- `src/components/ui/__tests__/generationNotice.test.tsx`

**文件变更：**
- `src/services/baseAIProvider.ts`（`withFallback` 分级 / 续写循环重写 / 传输层分类 / `finishReason` 透出 / 生成类方法接 strict）
- `src/services/streaming/sseReader.ts`（新增两类异常 + 网络失败归类）
- `src/modules/search/useSearchStateMachine.ts`（错误映射与部分内容保留）
- `src/modules/search/SearchResults.tsx`、`src/modules/doc/{index,DocResult}.tsx`（接入分档横幅）
- `src/i18n/strings/search.ts`、`src/types/{ai,index}.ts`

---

## v0.2.0 (2026-07-02)

### 完成小目标
- 模块化重构：从单文件HTML升级为 Vite + React + TypeScript

### 功能清单
- [x] 项目结构模块化（components、modules、hooks、types）
- [x] 通用组件化（Button、Input、Card、Tag 等UI组件）
- [x] 知识卡片组件化（6种卡片独立组件：Concept/Process/Formula/Timeline/Compare/Hierarchy）
- [x] 三个功能模块独立目录（search、translate、doc）—— 注：visual 模块后续弃用，代码已于 2026-09-04 删除
- [x] TypeScript 类型系统
- [x] Tailwind CSS 样式方案
- [x] ECharts + KaTeX 集成（ECharts 后续移除）

### 技术栈
- Vite 5 + React 18 + TypeScript 5
- Tailwind CSS 3
- ECharts 5 + echarts-for-react（2026-09-04 随 visual 模块删除）
- KaTeX 0.16

### 状态
已完成并通过测试

**测试结果（2026-07-02）：**
- ✅ 构建验证：TypeScript 类型检查通过，生产构建成功
- ✅ 知识搜索模块：6种知识卡片组件正常渲染，热门标签点击正常
- ✅ 词典翻译模块：语言切换、输入框、翻译功能正常
- ✅ 文档生成模块：5种文档类型、语气切换、生成功能正常
- ⚠️ 动态可视化模块：ECharts函数图像、算法动画演示正常（**注**：后续已从主应用移除，PRD 标记为已弃用，代码已于 2026-09-04 删除）
- ✅ Tab导航切换正常，URL hash同步正确

---

## v0.1.0 (2026-06-29 ~ 2026-07-02)

### 完成小目标
- m001：整体框架与导航
- m002：知识搜索模块
- m003：词典翻译模块
- m004：文档生成模块
- ~~m005：数学函数动态图像~~（**已弃用**，代码已于 2026-09-04 删除）
- ~~m006：算法动画演示~~（**已弃用**，代码已于 2026-09-04 删除）

### 功能清单
- [x] 顶部导航栏（三个Tab切换）
- [x] 知识搜索框 + 热门标签
- [x] 知识卡片渲染（概念、流程、公式、时间轴、对比、层级）
- [x] 词典翻译（查词模式、查句模式）
- [x] 文档生成（邮件、报告、会议纪要、PPT、笔记）
- [x] ~~数学函数图像（ECharts）~~（**已弃用**）
- [x] ~~算法动画（冒泡排序、选择排序、插入排序）~~（**已弃用**）
- [x] 配置管理系统

### 技术栈
- 单文件 HTML + 原生 JavaScript
- Tailwind CSS (CDN)
- ECharts + KaTeX (CDN)

### 状态
已完成（已被 v0.2.0 模块化重构替代；动态可视化相关功能后续从 PRD 移除）

---

## v1.0.0 (2026-07-05)

### 完成小目标
- m007：追问对话功能
- m008：收藏功能
- m009：历史记录功能
- 智能标签（动态更新）
- 知识笔记导出（TXT/Markdown）
- TTS朗读功能
- 文档复制导出功能

### 功能清单
- [x] 智能标签功能（根据输入内容实时展示相关标签）
- [x] 知识笔记导出功能（TXT/Markdown格式）
- [x] 移除动态可视化模块导航入口（已弃用）
- [x] 追问对话区
- [x] 收藏功能（知识卡片/生词/文档）
- [x] 历史记录功能（搜索/翻译）
- [x] TTS朗读功能（单词发音、句子原文/译文朗读）
- [x] 文档复制导出功能
- [x] ~~知识结构图谱展示（层级结构、分阶段解释）~~（**修正**：实际未完整实现，后续降级为"知识目录"占位组件）
- [x] ~~阶段切换功能（基础/进阶）~~（**修正**：未实现）
- [x] ~~概念关联跳转~~（**修正**：未实现）

### 技术栈
- Vite 5 + React 18 + TypeScript 5
- Tailwind CSS 3
- Web Speech API（TTS）
- LocalStorage（数据持久化）

### 状态
已完成并通过构建验证（**注**：原 PRD 中"知识结构图谱""阶段切换""概念关联跳转"未实际实现，已在 v2.1 PRD 修正）

**构建验证（2026-07-05）：**
- ✅ TypeScript 类型检查通过
- ✅ 生产构建成功（66 modules）
- ✅ 开发服务器正常运行（http://localhost:3000）

**新增文件：**
- `src/modules/search/KnowledgeGraph.tsx` - 知识结构图谱组件（**注**：后续重写为 div 层级"知识目录"占位）
- `src/modules/search/SmartTags.tsx` - 智能标签组件
- `src/utils/export.ts` - 文件导出工具
- `src/hooks/useFavorites.ts` - 收藏功能Hook
- `src/hooks/useHistory.ts` - 历史记录功能Hook

---

## v1.0.1 (2026-07-05)

### 完成小目标
- 搜索模块布局优化：搜索历史移至左侧侧边栏
- 关键词标签优化：搜索范围标签（教育阶段、学科领域、知识类型）
- 知识内容智能生成呈现：思维导图→概念→示例→搜索结果

### 功能清单
- [x] 搜索历史侧边栏（固定显示、清空功能、时间标签、单条删除）
- [x] 搜索范围标签（教育阶段/学科领域/知识类型，支持多选、折叠/展开、清空选择）
- [x] 热门标签（搜索框下方 10 个标签，点击直接搜索）
- [x] 思维导图组件（可折叠树状结构、层级着色）
- [x] 概念解析组件（定义、公式、定理、原理四种类型，双色边框卡片）
- [x] 示例演示组件（步骤编号 + 渐变结论区域）
- [x] KaTeX 数学公式渲染支持
- [x] 10 个搜索词生成数据（速度、引擎、牛顿第二定律、人工智能、物理定律、化学反应、数学公式、历史事件、编程算法、生物结构）
- [x] 侧边栏完全收起/展开（收起 w-0，展开 296px，悬浮按钮恢复）
- [x] 字体大小优化（text-xs → text-sm）
- [x] 移除「相关关键词」区域
- [x] 移除「智能知识搜索」脉冲徽章

### 技术栈
- Vite 5 + React 18 + TypeScript 5
- Tailwind CSS 3
- KaTeX 0.16（数学公式渲染）
- LocalStorage（搜索历史持久化）

### 状态
已完成并通过构建验证

**构建验证（2026-07-05）：**
- ✅ TypeScript 类型检查通过
- ✅ 生产构建成功（65 modules）
- ✅ 开发服务器正常运行（http://localhost:3000）

**文件变更：**
- `src/modules/search/index.tsx` - 重构布局，添加热门标签、单条删除、侧边栏完全收起
- `src/modules/search/SmartTags.tsx` - 折叠/展开、清空选择、字体优化
- `src/modules/search/SearchResults.tsx` - 全面优化视觉设计
- `src/modules/search/mockData.ts` - 新增 6 个搜索词生成数据，添加 category/tags 字段
- `src/hooks/useHistory.ts` - 暴露 removeHistory 方法

---

## v1.0.2 (2026-07-07 ~ 2026-07-09)

### 完成小目标
- 模块体验对齐与改进（A系列 + B系列）
- 历史记录时间自动更新与浏览中标记
- 问答历史话题化重构
- 历史模块架构重构：通用 HistorySidebar 组件 + API 统一 + props 传递链消除
- **收藏与历史记录架构分离：职责清晰 + 完整状态恢复 + 用户友好标签**
- **全局菜单：主题切换（亮色/深色）、语言切换、设置（清空所有历史）**
- **疑难问题修复：全局清空历史记录失效、搜索历史追问对话恢复、收藏内容加入历史记录**

### 功能清单
- [x] 翻译模块「自动检测」语言方向（默认）
- [x] 翻译历史记录侧边栏（收起/展开、悬浮按钮）
- [x] 查句结果关联知识卡片 + 导出功能
- [x] 文档模块历史记录侧边栏
- [x] 文档模块「重新生成」功能
- [x] 统一收藏管理视图（四类：knowledge/dictionary/translation/document）
- [x] 翻译模块词典查词模式（Tab切换、单行输入）
- [x] 查词/翻译历史记录按模式过滤展示
- [x] 切换模式时清空结果显示
- [x] 收藏状态即时同步（useSyncExternalStore）
- [x] 查词模式关联术语展示
- [x] 翻译模式关键词 + 语法说明（替代知识卡片）
- [x] 发音按钮朗读状态反馈
- [x] 搜索模块问答历史记录
- [x] 收藏项点击跳转到对应内容
- [x] 文档生成类型扩充（5种→10种：合同、简历、新闻稿、项目方案、周报）
- [x] 历史记录时间每分钟自动更新
- [x] 当前浏览内容「浏览中」标记（历史记录 + 收藏面板）
- [x] 收藏管理类型折叠功能
- [x] 问答历史话题化（完整对话会话，区分首次提问/追问）
- [x] 搜索追问对话会话化（复用QA的session模式，追问追加到同一条记录）
- [x] 问答模式「新对话」按钮（清空当前会话，创建新话题）
- [x] 按钮统一样式优化（查词/翻译/生成按钮移入输入框内）
- [x] 模式切换独立布局（搜索/问答模式切换独立一行）
- [x] 清空历史按类型隔离（search/qa、translate、doc 各自独立）

### 技术栈
- Vite 5 + React 18 + TypeScript 5
- Tailwind CSS 3
- Web Speech API（TTS）
- LocalStorage（数据持久化）
- useSyncExternalStore（跨组件状态共享）

### 状态
已完成并通过构建验证

**构建验证（2026-07-09）：**
- ✅ TypeScript 类型检查通过
- ✅ 生产构建成功（71 modules，新增 ConfirmDialog 组件）

**新增文件：**
- `src/hooks/useTimeRefresh.ts` - 时间刷新Hook
- `src/components/favorites/FavoritesPanel.tsx` - 统一收藏管理面板
- `src/components/history/HistorySidebar.tsx` - 通用历史侧边栏组件（替代 TranslateHistory 和 DocHistory）
- `src/hooks/useTheme.ts` - 主题切换Hook（系统检测 + localStorage持久化）
- `src/hooks/useLanguage.ts` - 语言切换Hook（浏览器检测 + localStorage持久化）
- `src/components/ui/ConfirmDialog.tsx` - 通用确认对话框组件

**删除文件（历史模块重构）：**
- `src/modules/translate/TranslateHistory.tsx` - 已被通用组件替代
- `src/modules/doc/DocHistory.tsx` - 已被通用组件替代

---

## v1.1.0 (响应式适配 · 部分完成)

### 完成小目标
- 响应式适配（移动端布局优化）

### 功能清单
- [x] 部分组件响应式布局适配
- [ ] 移动端适配未彻底完成，保留在 [todo.md](todo.md) P0

### 状态
⚠️ 部分完成

---

## v1.2.0 (2026-07-09)

### 完成小目标
- AI服务抽象层（接口契约 + Mock实现 + Provider）
- 搜索状态机（搜索模式内部智能流程管理）
- 知识目录占位组件（**原"知识图谱导航"**，实际为 div 层级树形结构，非 SVG 知识图谱）
- 思维导图组件（SVG层级结构图、节点展开/收起）
- 文档导出增强（txt/md/html三种格式）
- 收藏空间管理（默认/工作/学习空间）
- 搜索/QA双模式解耦

### 功能清单
- [x] AI服务类型定义（AIService接口 + 搜索/翻译/文档类型）
- [x] Mock AI服务实现（search/translate/document三大模块）
- [x] AI服务Provider（环境变量切换Mock/真实服务）
- [x] 搜索状态机Hook（IDLE→VALIDATING→ANALYZING→KNOWLEDGE_GRAPH/GENERATING→DISPLAYING→FOLLOWUP）
- [x] 知识目录占位组件（div层级树形结构、节点展开/收起、叶子节点点击跳转）—— **修正**：实际非 SVG 知识图谱，是占位实现
- [x] 思维导图组件（SVG层级结构图、节点展开/收起、连接线动画）
- [x] 搜索模块重构（状态机驱动、搜索/QA双模式解耦）
- [x] 文档导出工具（exportTxt、exportMd、exportHtml）
- [x] 文档结果导出功能（txt/md/html三种格式选择）
- [x] 收藏空间管理（创建/切换/删除空间、内容分类）
- [x] AI智能标签（输入前热门标签、输入中实时推荐）
- [x] 追问对话功能（与AI服务集成、对话历史展示）
- [x] useSyncExternalStore修复（getSnapshot缓存，避免无限循环）

### 技术栈
- Vite 5 + React 18 + TypeScript 5
- Tailwind CSS 3
- useSyncExternalStore（跨组件状态共享）
- LocalStorage（数据持久化）

### 状态
已完成并通过构建验证

**构建验证（2026-07-09）：**
- ✅ TypeScript 类型检查通过
- ✅ 生产构建成功（76 modules）
- ✅ 开发服务器正常运行（http://localhost:3000）

**新增文件：**
- `src/types/ai.ts` - AI服务类型定义
- `src/services/mockAIService.ts` - Mock AI服务实现
- `src/services/aiServiceProvider.ts` - AI服务Provider
- `src/modules/search/useSearchStateMachine.ts` - 搜索状态机Hook
- ~~`src/modules/search/MindMap.tsx` - 思维导图组件~~（**注**：后续作为死代码删除，思维导图实际嵌入在 SearchResults.tsx 中）

**文件变更：**
- `src/types/index.ts` - 导入AI类型定义
- `src/modules/search/index.tsx` - 重构为状态机驱动，搜索/QA双模式解耦
- `src/modules/search/KnowledgeGraph.tsx` - 实现知识图谱交互
- `src/modules/search/SmartTags.tsx` - 实现智能标签
- `src/modules/search/QASection.tsx` - 实现追问对话与AI服务集成
- `src/modules/search/mockData.ts` - 迁移到AI服务
- `src/modules/translate/mockData.ts` - 迁移到AI服务
- `src/modules/doc/DocResult.tsx` - 添加多格式导出功能
- `src/modules/doc/templates.ts` - 迁移到AI服务
- `src/utils/export.ts` - 实现导出工具（txt/md/html）
- `src/hooks/useFavorites.ts` - 添加收藏空间管理功能

---

## v1.3.0 (已完成)

### 完成小目标
- 翻译风格切换（学术/商务/日常）
- PDF格式导出（jspdf，支持中文和分页）
- 文档生成结果 Markdown 渲染（react-markdown + remark-gfm）
- 文档类型选择器折叠效果
- 文档类型扩充 5→10 种（合同、简历、新闻稿、项目方案、周报）

### 功能清单
- [x] 翻译风格切换（performTranslateWithStyle 重新调用AI生成）
- [x] PDF格式导出（jspdf，支持中文和分页）
- [x] 文档生成结果 Markdown 渲染
- [x] 文档类型选择器折叠/展开效果
- [x] 文档类型扩充至 10 种（v1.4.0 后续增加 general 通用类型，共 11 种）
- ~~[x] m010：更多算法动画（快速排序、归并排序）~~（**修正**：实际未实现，算法动画模块已从主应用移除并弃用）

### 状态
已完成（**注**：原 "m010 算法动画" 实际未实现，已在 v2.1 PRD 修正为已弃用）

---

## v1.4.0 (2026-07-11 ~ 2026-07-14)

### 完成小目标
- **真实AI服务集成**：接入智谱GLM-4-Flash API，实现全模块真实AI调用
- **历史记录架构升级**：从useState hook重构为HistoryContext + Context模式
- **文档生成模块优化**：PDF导出、Markdown渲染、类型选择器折叠
- **词典翻译体验优化**：移除自动切换、修复翻译风格切换
- **搜索模块修复**：问答模式布局优化、追问等待提示、知识内容导出简化

### 功能清单
- [x] 智谱GLM-4-Flash AI服务集成（真实AI调用）
- [x] 统一AI接口契约（aiServiceProvider抽象层）
- [x] 翻译模块调用真实AI（查词/翻译）
- [x] 文档生成模块调用真实AI
- [x] 直接问答模式调用真实AI
- [x] 搜索模式AI生成知识内容
- [x] 加载状态显示 + 错误处理 + mock fallback
- [x] JSON解析增强（支持Markdown代码块格式）
- [x] 历史记录从useState hook重构为HistoryContext（Context模式）
- [x] 搜索/问答模式串扰修复（状态完全隔离）
- [x] AI搜索结果重复问题修复
- [x] PDF格式导出（jspdf，支持中文和分页）
- [x] 文档生成结果Markdown渲染（react-markdown + remark-gfm）
- [x] 文档类型选择器折叠效果（默认收起，展开显示网格）
- [x] 文档类型选择器移到输入框下方
- [x] 通用文档类型（默认选中）
- [x] 文档模块"浏览中"状态修复（currentTopic替代result.title）
- [x] 词典翻译移除输入自动检测切换（手动切换模式）
- [x] 翻译模式风格切换修复（重新调用AI生成）
- [x] 查词模式AI直接搜索关键词（不自动判断单词/句子）
- [x] 问答模式布局优化（对话内容和示例问题移到输入框上方）
- [x] 搜索模式追问等待提示（isLoading传递）
- [x] 知识内容导出简化为Markdown并添加复制功能
- [x] 问答模式连续输入防重机制（processingRef）
- [x] 代码质量优化（删除死代码、提取通用错误处理、统一类型定义）

### 技术栈
- Vite 5 + React 18 + TypeScript 5
- Tailwind CSS 3
- **智谱GLM-4-Flash API**（真实AI服务）
- **react-markdown + remark-gfm**（Markdown渲染）
- **jspdf**（PDF生成）
- React Context（全局状态管理）
- LocalStorage（数据持久化）

### 状态
已完成并通过构建验证

**构建验证（2026-07-14）：**
- ✅ TypeScript 类型检查通过
- ✅ 生产构建成功（718 modules）
- ✅ 浏览中状态正常显示
- ✅ Markdown内容正确渲染
- ✅ PDF导出功能可用
- ✅ 翻译风格切换正常
- ✅ 问答模式布局合理

**新增文件：**
- `src/services/glmAIService.ts` - 智谱GLM AI服务实现
- `src/hooks/HistoryContext.tsx` - 全局历史记录上下文（Context模式）
- `src/modules/doc/DocTypeSelector.tsx` - 文档类型选择器组件（带折叠效果）

**文件变更：**
- `src/services/aiServiceProvider.ts` - 集成真实AI服务
- `src/App.tsx` - 使用HistoryProvider包裹应用
- `src/modules/search/index.tsx` - 使用HistoryContext，修复模式串扰，布局优化
- `src/modules/translate/index.tsx` - 使用HistoryContext，接入真实AI，修复风格切换
- `src/modules/doc/index.tsx` - 使用HistoryContext，接入真实AI，修复浏览中状态
- `src/modules/doc/DocEditor.tsx` - 引入DocTypeSelector，布局调整
- `src/modules/doc/DocResult.tsx` - 添加Markdown渲染和PDF导出
- `src/utils/export.ts` - 添加PDF导出功能
- `src/modules/translate/TranslateInput.tsx` - 移除自动模式切换
- `package.json` - 新增react-markdown、remark-gfm、jspdf依赖

### 重要变更说明
1. **历史记录架构升级**：从原useState + key prop的hack方式，升级为标准的React Context模式，解决多实例状态不同步问题
2. **AI从Mock到真实**：所有模块从mock数据切换为真实AI调用，保留mock作为fallback
3. **viewingQuery标识一致性**：文档模块使用currentTopic（原始输入）替代result.title，确保"浏览中"状态正确匹配
4. **翻译体验优化**：移除反直觉的自动模式切换，改为用户手动选择；风格切换重新调用AI生成
5. **环境变量弃用**：API密钥已改为在应用内通过密钥管理组件配置，存储于LocalStorage，不再使用环境变量硬编码

---

## v1.5.0 (2026-09-06 ~ 2026-09-09)

### 完成小目标
- **内容生成改真流式**：生产者-消费者模型（`StreamingJSONParser` + `callModelStream`，不支持流式自动降级）
- **知识内容层次增强**：概念解释包含初等和高等两个层次
- **知识脉络扩展**：学习路径 / 前置知识 / 关联主题 / 易混辨析 / 常用结论
- **经典试题**：选择题、填空题、计算题、问答题（题型中英别名归一化）
- **趣味内容**：故事、应用、历史、趣味小知识
- **配图双通道**：模型内联 SVG + 图片 URL（Commons/维基双源兜底）
- **真实 AI 链路修复**：截断透出、LaTeX 渲染、厂商模型 ID/能力 cap、图片兜底
- **思维导图公式溢出修复**：按字符类分档估宽
- **自定义厂商模板**：8 套一键预填

### 功能清单
- [x] 核心概念双层结构（初等/高等）+ conceptsOverview 总述 + 概念示例独立卡片
- [x] `Concept.keyPoints`（关键要点）/ `pitfalls`（易错提醒）；`KnowledgeContext.confusables`（易混辨析）
- [x] 新增知识脉络：学习路径（纵向序号）→ 前置/关联 → 易混辨析 → 常用结论
- [x] 新增经典试题：选择题、填空题、计算题、问答题 + 难度 + 答案解析 + 来源标注
- [x] 新增趣味内容：故事、应用、历史、趣味小知识
- [x] 内容生成改真流式 `generateStream`（替换早期 3 步 `generatePartial`，旧路径已删除）
- [x] 快照合并 `mergeSnapshot`（仅非空覆盖，防增量回退闪回）
- [x] 截断透出 `truncated`（sseReader → 服务 → 状态机 → UI 警告横幅）
- [x] LaTeX 归一化 + 安全渲染（`utils/latex.ts`，失败降级等宽代码块）
- [x] 厂商模型 ID/能力 cap 重排 + `max_tokens` 收敛（防超上限 400）
- [x] 配图 `svg` 内联 + `image` 双通道；Commons/维基双源自动兜底（删除中英词表做法）
- [x] 试题题型适配重写（`sanitizeExamQuestions`）+ `ExamQuestionCard`
- [x] 思维导图公式溢出修复（`estimateTextWidthEm`）
- [x] 自定义厂商模板（`providerTemplates.ts`，8 套）
- [x] 更新 AI 提示词：结构化 JSON 输出（conceptsOverview/双层内容/conceptExamples/keyPoints/pitfalls/imageQuery）
- [x] 更新 Mock 数据：22 主题 concepts 全量双层化 + 总述 + 概念示例

### 技术栈
- Vite 5 + React 18 + TypeScript 5
- Tailwind CSS 3
- 多厂商 AI（智谱/通义/DeepSeek/Moonshot/OpenAI/Anthropic/Gemini/SiliconFlow，OpenAI 兼容协议）
- SSE 流式 + 增量 JSON 解析

### 状态
已完成并通过构建验证

**构建验证（2026-09-09）：**
- ✅ TypeScript 类型检查通过
- ✅ vitest 142/142 通过
- ✅ 生产构建成功（740 modules）

---

## v1.6.2 (2026-09-12)

### 完成小目标
- **流式链路诚实化**：移除"黑名单-自愈"隐式全局状态，改为拿到什么链路状态就诚实处理什么（链路失败抛错透传、不再降级重发）
- **首字节超时兜底**：60s 内未收到任何字节自动 abort，修「已等待 511 秒」卡死
- **链路错误透传**：`withFallback` 不再把超时/协议错误吞成笼统"生成失败"，透传 code 由 UI 显示具体原因
- **续写边界加固 + 判定同源化**：续写判定复用解析层权威判定，新增核心字段齐全判定，续写轮空内容/异常不空转、不丢尾巴
- **空结果兜底**：无内容时给明确的失败空状态卡片，不再是一片空白
- **多厂商思考适配**：智谱 GLM 关闭思考（修「总是生成失败」）+ 智谱/千问 `reasoning` 能力声明修正
- **AI 内容质量**：防编造答案/瞎猜（严谨性铁律）+ 含"如图"试题约束 + SVG 正向画法教学 + 图源积极引用

### 功能清单
- [x] 流式：`sseReader` 新增 `firstByteTimeoutMs`（默认 60s）+ `StreamTimeoutError`；收到任意字节即 `clearTimeout`
- [x] 流式：删除 `streamUnsupported` Map / `markStream*` / `isStreamPossiblySupported` / `STREAM_RETRY_COOLDOWN_MS` 一整套运行时黑名单；`wantStream` 只信 `caps.streaming`
- [x] 流式：`callModelStream` 传输层/协议/超时失败一律抛错（不降级重发）；删除 `RequestMeta.caps` 死字段
- [x] 流式：`withFallback` 识别 `StreamTimeoutError`/`StreamProtocolError` 透传为 `success:false + code(STREAM_TIMEOUT/STREAM_PROTOCOL)`
- [x] 状态机：`toFriendlyError` 错误码映射；`hasUsableContent` 覆盖全部实质字段；全空显式写 `error`；`IDLE` 分支补 `thinking:false`
- [x] UI：`SearchContainer` 失败空状态卡片；`WaitTimer` ≥30s 加重提示（`waitingSlow`）
- [x] i18n：`waitingSlow` / `errors.firstByteTimeout` / `errors.generateFailedEmpty`（中英同步）
- [x] 续写：`hasCompleteJSONObject` 复用 `isCompleteJSON`（消除双写）；新增 `buildGenerateCompleteChecker`（括号闭合 + 核心字段齐全）
- [x] 续写：续写轮空内容即 break；续写轮异常 catch 保留已累积内容（首轮异常仍上抛）
- [x] 解析：`partialJSON` 导出 `scan` + 新增 `isCompleteJSON` / `analyzeJSON`（权威完整性/字段判定）
- [x] 厂商：`THINKING_PARAM_PROVIDERS` → `DISABLE_THINKING_PARAMS`，按厂商分派关闭思考（zhipu `thinking:{type:'disabled'}`；dashscope/siliconflow `enable_thinking:false`）
- [x] 厂商：智谱 `glm-5.2/5.1/4.7/4.7-flash` 与千问 DashScope Qwen3 全系列 `capabilities.reasoning` → `true`
- [x] prompt：【严谨性铁律】（答案可验证/解析自洽/禁自我怀疑措辞/绝不编造）+【含"如图"的试题约束】+ `imageData` 说明强化
- [x] prompt：SVG 规则重写为**按学科的正向画法教学**（通用骨架 + 几何/函数/电路/受力/光学）；`image` 字段改为"可信图源直链，优先于手绘 SVG"

### 技术栈
- Vite 5 + React 18 + TypeScript 5
- Tailwind CSS 3
- SSE 流式 + 增量 JSON 解析 + 超限自动续写 + 首字节超时兜底
- KaTeX（行内公式 + 独立公式）

### 状态
已完成并通过构建验证

**构建验证（2026-09-12）：**
- ✅ TypeScript 类型检查通过（`tsc --noEmit` 零错误）
- ✅ vitest **210/210** 全部通过（**17 文件**；本次净增 31 例：首字节超时 4 + 链路错误透传 5 + 续写边界 10 + 解析判定 3 + 状态机空结果 3 + 关闭思考分派 5 + 提示词契约 2，并重写/更新既有断言）

**新增文件：**
- `src/services/streaming/__tests__/sseReaderTimeout.test.ts`（首字节超时契约）
- `src/services/__tests__/disableThinking.test.ts`（关闭思考参数按厂商分派契约）
- `src/services/__tests__/streamFallback.test.ts`（由"黑名单冷却契约"重写为"链路错误透传契约"）

---

## v1.6.1 (2026-09-11)

### 完成小目标
- **预置型号全量修正**：逐家核对官方模型目录，替换已下架/改名的型号
- **生图服务配置入口**：设置面板可配通义万相密钥
- **行内公式渲染**：正文里的 `$...$` 交给 KaTeX，不再原样露出源码
- **SVG 图示体验**：等比缩放不裁剪 + 线宽过粗自动压细
- **流式首字延迟治理**：清洗节流 + 思维链识别 + 首字等待计时 + 关闭思考模式
- **流式时序修复**：`completedKeys` 补记容器型字段（步骤指示不再卡死）+ 总述与概念列表门控解耦
- **流式能力黑名单治理**：由"永久禁用"改为 60s 冷却（自愈可达）+ 降级可观测 + 记账收敛到协议层证据
- **AI 内容质量治理**：公式统一渲染（双保险）+ 试题配图原图优先 + 学科制图规范

### 功能清单
- [x] 智谱 → `glm-5.2`/`glm-5.1`/`glm-4.7`/`glm-4.7-flash`（原 `glm-4-plus`/`glm-z1-air`/`glm-4-long` 已失效）
- [x] Gemini → `gemini-3.5-flash`/`3.5-flash-lite`/`3.7-flash`（2.5 系列 2026-10-20 退役）
- [x] OpenAI → 移除 `gpt-4.1-mini`/`o3-mini`，补 `gpt-5-nano`
- [x] 千问 → 补 `qwen3.7-max`/`qwen3.8-flash`，移除 `qwen-plus` 别名
- [x] Anthropic → `claude-opus-5` 提为 recommended
- [x] 新增 `WanxKeyInput`，接入 Header「密钥管理」Tab；i18n 增加 `wanx` 段
- [x] 新增 `components/ui/LatexText.tsx`，覆盖 10 处正文渲染点
- [x] SVG：`--svg-figure-max-h` 等比缩放 + `clampStrokeWidth`（>2 压到 2）+ prompt 画布/线宽要求
- [x] 流式：`generateStream` 清洗按 80ms 时间片产出 + `parser.finish()` 尾部补发
- [x] 流式：`sseReader` 识别 `reasoning_content` + `onReasoning` 透传 + `receivedReasoning` 防误降级
- [x] 流式：状态机 `thinking`/`generateStartedAt` + UI 首字等待秒数
- [x] 流式：白名单厂商发 `enable_thinking: false`（dashscope/siliconflow）降低首字延迟
- [x] 流式时序：`StreamingJSONParser.scan()` 容器弹栈后补记顶层字段完成（`completedKeys` 不再漏数组/对象型字段）
- [x] 流式时序：`SearchResults` 总述（`conceptsOverview`）与概念列表（`concepts`）门控解耦，总述到达即渲染
- [x] 流式降级：能力黑名单 `Set`(永久禁用) → `Map<key, failedAt>` + `STREAM_RETRY_COOLDOWN_MS=60s` 冷却
- [x] 流式降级：走非流式分支/记录黑名单均 `console.warn`；仅协议层证据记账（`receivedReasoning` 不记账）
- [x] 顺手修复：`prepareRequest` 能力画像改用解析后的实际 model id
- [x] 公式统一渲染：`utils/latex.ts` 新增 `splitBareLatex()`（强信号 + KaTeX 解析失败回退）；`LatexText` 重构为统一入口
- [x] 公式覆盖：把 keyPoints / pitfalls / learningPath / confusables / mindMap 节点标题·描述 / 趣事标题 / 标签 chip 全部接入 `LatexText`
- [x] 试题配图三通道：`ExamQuestion.imageData`（base64 直填，<4MB）；渲染优先级 image / imageData > svg，加载失败回退 SVG
- [x] 严格图源白名单：prompt 显式写入 upload.wikimedia.org / commons.wikimedia.org / cdn.kastatic.org / images.unsplash.com / raw.githubusercontent.com / lh*.googleusercontent.com / cdn.jsdelivr.net / ocw.mit.edu / math.mit.edu
- [x] 学科制图规范：SVG 规则新增"必须严格遵循该学科制图惯例"+ 高风险学科细则（数学几何对边 a/b/c、物理受力箭头·法线·标准元件、化学键角）
- [x] prompt 源头加固【公式书写规则】：置顶"凡数学符号一律 `$...$` 包裹"+ 正反例

### 技术栈
- Vite 5 + React 18 + TypeScript 5
- Tailwind CSS 3
- SSE 流式 + 增量 JSON 解析 + 自动续写 + 思维链识别
- KaTeX（行内公式 + 独立公式）

### 状态
已完成并通过构建验证

**构建验证（2026-09-11）：**
- ✅ TypeScript 类型检查通过（`tsc --noEmit` 零错误）
- ✅ vitest **185/185** 全部通过（**15 文件**；本次新增 **29 例**：公式统一渲染 +9、LatexText 组件 +7、searchResultsLatex +4、exam imageData +4、提示词契约 +5）
- ✅ 开发服务器热更新验证

**新增文件：**
- `src/components/ui/LatexText.tsx`（行内公式渲染；本次重构为统一入口）
- `src/components/ui/__tests__/latexText.test.tsx`（LatexText 组件回归）
- `src/components/settings/WanxKeyInput.tsx`（生图服务密钥输入）
- `src/modules/search/__tests__/searchResultsStreaming.test.tsx`（流式渲染时序回归）
- `src/modules/search/__tests__/searchResultsLatex.test.tsx`（公式渲染覆盖回归）
- `src/services/__tests__/streamFallback.test.ts`（流式能力黑名单冷却契约）
- `scripts/build-manifest.js`（`.manifest.json` 一键重建）

---

## v1.6.0 (2026-09-10)

### 完成小目标
- **多语言（i18n）字符串层**：英文作类型基准，UI 全量迁移，中文漏 key 立即 tsc 报错
- **用户语言绑定**：AI 输出语言跟随用户语言（`buildLanguageDirective`），JSON 字段名/枚举值保持英文
- **生成超限自动续写**：严格闭合判定 + 最多 3 次尝试
- **查词/翻译改造**：源/目标双下拉、逐段对齐、短语多词支持、输入上限计数

### 功能清单
- [x] `src/i18n/strings/` 按 area 拆文件（common/settings/search/translate/misc/aiProviderTexts/docTemplates）
- [x] 英文作类型基准（`xxxEn` → `typeof` 派生 → `xxxZh: XxxStrings`），运行时 `deepMerge(EN, {...Zh})` 缺 key 回退英文
- [x] 取值入口 `useStrings()`（React）/ `getCurrentStrings()`（非 React）+ 占位符 `fmt()`
- [x] `src/i18n/languages.ts` 语言目录 + `normalizeLanguage` 兼容旧格式
- [x] `useLanguageStore` 纯存储层 + `useLanguage` 改 `useSyncExternalStore`，Header 语言区改下拉
- [x] AI 输出绑定用户语言（search 生成/追问/文档 system prompt）
- [x] 超限自动续写 `callModelStreamWithContinuation`（首轮 1 次 + 续写 ≤2 次）
- [x] `hasCompleteJSONObject` 严格闭合判定（不修复，避免漏续写）
- [x] 续写提示 `continued` + SearchResults"已自动续写并补全"提示
- [x] `detect` 只检测源语言；`queryWord` 支持短语多词（≤10 关键词）；`queryTranslate` 逐段对齐
- [x] `TranslateInput` 源/目标双下拉 + 交换按钮 + 输入上限（查词 120 / 翻译 3000）
- [x] `SentenceResult` 选词实时映射（hover 优先于 pinned），对齐不完整追加剩余文本
- [x] 顺手修复两个真实 bug：具体错误被通用文案覆盖、全空结果被误判为有内容
- [x] 数据层文本不迁 i18n（厂商名/模型描述/文档模板正文由覆盖层提供）

### 技术栈
- Vite 5 + React 18 + TypeScript 5
- Tailwind CSS 3
- useSyncExternalStore（语言/主题/收藏/配置 store）
- SSE 流式 + 增量 JSON 解析 + 自动续写

### 状态
已完成并通过构建验证

**构建验证（2026-09-10）：**
- ✅ TypeScript 类型检查通过（`tsc --noEmit` 零错误）
- ✅ vitest 142/142 全部通过
- ✅ 生产构建成功（740 modules transformed）

**新增文件：**
- `src/i18n/strings/{common,settings,search,translate,misc,aiProviderTexts,docTemplates,index}.ts`
- `src/i18n/languages.ts`、`src/hooks/useStrings.ts`、`src/hooks/useLanguageStore.ts`

**删除文件：**
- `src/utils/imageQuery.ts`（及测试，中英词表被判定为坏做法）
