import fs from 'fs'
import path from 'path'

/**
 * 把 `.tmp-standalone/` 的构建产物压成一个 HTML，发布到 `release/`。
 *
 * `release/` 是入库的发布包，也是唯一对外的交付形态，里面只应该有两个文件：
 *   - 知识灵动助手.html   —— 双击即用
 *   - 使用说明.txt        —— 给接收方看的说明
 *
 * 为什么不直接让 vite 构建到 release/：构建过程会产出一堆 hash 命名的 chunk 和字体文件，
 * 它们只是内联用的原料，不该进仓库。原料放中间目录，只把成品写进 release/。
 *
 * 关键细节：内联 JS 时必须把 `</script` 转义成 `<\/script`。
 * 否则 JS 里任何一处字符串/正则出现 `</script>` 都会提前把 script 标签截断，
 * 页面直接白屏 —— 而且报错信息完全不指向这里，极难查。
 * 转义是安全的：JS 里 `<\/` 和 `</` 是同一个字符。
 */

const projectRoot = path.join(import.meta.dirname, '..')
const tmpDir = path.join(projectRoot, '.tmp-standalone')
const outDir = path.join(projectRoot, 'release')
const indexPath = path.join(tmpDir, 'index.html')
const htmlName = '知识灵动助手.html'

if (!fs.existsSync(indexPath)) {
  console.error('[release] 找不到 .tmp-standalone/index.html')
  console.error('[release] 请先运行：vite build --config vite.standalone.config.ts')
  process.exit(1)
}

const pkg = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf-8'))

/** 把构建产物里的相对资源引用解析回磁盘路径 */
const resolveAsset = (href) => {
  const clean = href.replace(/^\.?\//, '').split('?')[0].split('#')[0]
  return path.join(tmpDir, clean)
}

const readAsset = (href) => {
  const file = resolveAsset(href)
  if (!fs.existsSync(file)) {
    throw new Error(`[release] 引用的资源不存在：${href} -> ${file}`)
  }
  return fs.readFileSync(file, 'utf-8')
}

let html = fs.readFileSync(indexPath, 'utf-8')
const inlined = []

// ---- 1. 内联入口 JS ----
html = html.replace(
  /<script\b[^>]*\btype="module"[^>]*\bsrc="([^"]+)"[^>]*><\/script>/g,
  (_m, src) => {
    const code = readAsset(src).replace(/<\/script/gi, '<\\/script')
    inlined.push(`js   ${src} (${(code.length / 1024 / 1024).toFixed(2)}MB)`)
    return `<script type="module">\n${code}\n</script>`
  }
)

// ---- 2. 内联样式 ----
html = html.replace(
  /<link\b[^>]*\brel="stylesheet"[^>]*\bhref="([^"]+)"[^>]*>/g,
  (_m, href) => {
    const css = readAsset(href)
    inlined.push(`css  ${href} (${(css.length / 1024).toFixed(0)}KB)`)
    return `<style>\n${css}\n</style>`
  }
)

// ---- 3. 内联 favicon ----
// Vite 的 assetsInlineLimit 管不到 HTML 里 <link rel="icon"> 引用的资源，
// 不处理的话它会在 `file://` 下变成一个加载失败的请求（标签页图标缺失）。
html = html.replace(/<link\b([^>]*\brel="icon"[^>]*)>/g, (m, attrs) => {
  const href = attrs.match(/\bhref="([^"]+)"/)?.[1]
  if (!href || href.startsWith('data:')) return m
  const mime = href.endsWith('.svg') ? 'image/svg+xml' : href.endsWith('.png') ? 'image/png' : 'image/x-icon'
  const b64 = fs.readFileSync(resolveAsset(href)).toString('base64')
  inlined.push(`icon ${href} (${(b64.length / 1024).toFixed(1)}KB)`)
  return `<link rel="icon" type="${mime}" href="data:${mime};base64,${b64}">`
})

// ---- 4. 清掉不再需要的 preload（资源已内联，留着只会发一堆 file:// 请求） ----
html = html.replace(/<link\b[^>]*\brel="modulepreload"[^>]*>\s*/g, '')

// ---- 自检：内联之后不应再有任何指向 assets/ 的外部引用 ----
const leftovers = html.match(/\.\/assets\/[^"')]+/g)
if (leftovers) {
  console.error('[release] 仍有未内联的 assets 引用，产物不完整：')
  for (const l of [...new Set(leftovers)]) console.error('   ', l)
  process.exit(1)
}

fs.mkdirSync(outDir, { recursive: true })
fs.writeFileSync(path.join(outDir, htmlName), html, 'utf-8')

const sizeMB = (Buffer.byteLength(html, 'utf-8') / 1024 / 1024).toFixed(2)
const buildDate = new Date().toISOString().slice(0, 10)

/**
 * 使用说明与产物一起生成。
 * 由脚本生成而不是手写静态文件，是因为里面的体积 / 版本 / 构建日期都跟产物绑定，
 * 手写的那份迟早会跟产物对不上。
 */
const readme = `知识灵动助手 v${pkg.version}
========================================================
单文件离线版 · 构建于 ${buildDate} · 体积约 ${sizeMB} MB

一个 HTML 文件，双击打开即用。不需要装任何东西，
不需要 Node，不需要服务器，不需要联网。


────────────────────────────────────────────────────────
一、怎么打开
────────────────────────────────────────────────────────
双击「${htmlName}」，用 Chrome 或 Edge 打开。

如果双击后被别的程序抢走（比如某些压缩软件、编辑器），
右键 → 打开方式 → 选 Chrome / Edge。

建议用 Chrome 或 Edge 的较新版本。Firefox 也能用，
Safari 未做验证。


────────────────────────────────────────────────────────
二、第一次打开是「Mock 模式」（建议先这样试）
────────────────────────────────────────────────────────
首次打开时顶部会显示「未配置密钥」，这是正常的 ——
此时用的是内置示例数据，四个模块都能完整体验一遍，
而且完全离线，一个网络请求都不会发出去。

可以直接试这些关键词（内置了示例数据）：
  知识搜索：勾股定理、牛顿第二定律、光合作用、三角函数、
            化学元素、人工智能、物理定律、数学定理、函数、复数
  词典翻译：algorithm、architecture、machine learning、
            deep neural network，或任意中英文句子
  文档生成：商务邮件、会议纪要、学习笔记、项目方案、周报……

Mock 数据是写死的，用来验证界面和流程，不代表真实生成质量。


────────────────────────────────────────────────────────
三、想用真实 AI
────────────────────────────────────────────────────────
1. 点右上角的钥匙图标，打开 AI 配置面板；
2. 在「模型」里选厂商，共 8 家预设：
     智谱 AI / 阿里通义千问 / 硅基流动 / DeepSeek /
     Moonshot Kimi / OpenAI / Anthropic / Google Gemini
   （也可以「添加厂商」，自己填名称和 Base URL，兼容任何
     走 OpenAI 协议的服务）
3. 把该厂商的 API Key 填进去，保存时会自动发一次请求验证；
4. 各厂商的密钥分开保存，可以只配一家，也可以配多家随时切。

从这一刻起需要联网。API Key 存在**你自己的浏览器**里
（localStorage），不会上传到任何别的地方。

关于「思考模式」：推理型模型默认会先输出一大段思考内容，
本项目对智谱 / 通义 / 硅基流动等已做关闭适配，避免思考
内容吃掉输出预算。


────────────────────────────────────────────────────────
四、功能一览
────────────────────────────────────────────────────────
【知识搜索】
  · 搜索 / 问答双模式
  · 真流式生成：AI 边写、界面边显示（打字机效果）
  · 核心概念（初等 + 高等两层解释、关键要点、易错提醒、配图）
  · 知识脉络（学习路径、前置与关联知识、易混辨析）
  · 经典试题（选择 / 填空 / 计算 / 问答，可点选判对错）
  · 思维导图（可拖动）、趣味知识
  · 内容没写完会**自动续写**，并按原因分档提示
    （模型输出上限 / 网络中断 / 响应超时 / 安全策略拦截）
  · 导出 Markdown / TXT / HTML

【词典翻译】
  · 查词：音标、词性、释义、例句、同反义词、常用搭配、语域、词源
  · 翻译：原文与译文逐段对齐，可点选词条实时映射
  · 风格切换（学术 / 商务 / 日常），支持朗读

【文档生成】
  · 11 种类型：通用写作、商务邮件、报告大纲、会议纪要、
    PPT 结构、学习笔记、合同、简历、新闻稿、项目方案、周报
  · 导出 TXT / Markdown / HTML / PDF

【通用】
  · 收藏（可建多个空间，自定义名称与颜色）
  · 历史记录（自动记录最后浏览时间）
  · 中英文界面切换，AI 输出语言跟随界面语言
  · 亮色 / 深色主题


────────────────────────────────────────────────────────
五、数据存在哪 · 会不会丢
────────────────────────────────────────────────────────
历史、收藏、API Key 全部存在浏览器本地的 localStorage 里。

要注意：
  · 换浏览器、换电脑 → 数据不会跟过去，是空的；
  · 清理浏览器缓存 / 用无痕模式 → 数据会丢；
  · 同一个浏览器下，这个文件被移动到别的路径打开 → 仍然读到
    同一份数据（本地文件的来源是共享的，既方便也危险）。

重要内容记得用「导出」存成文件。


────────────────────────────────────────────────────────
六、常见问题
────────────────────────────────────────────────────────
Q: 打开是空白页？
A: 大概三类原因：
   ① 浏览器太旧（需要支持 ES Module，2018 年后的版本都行）；
   ② 用了 IE 或某些浏览器的兼容模式，换成 Chrome / Edge；
   ③ 文件没下载完整，重新下载一次（正常约 ${sizeMB} MB）。

Q: 打开很慢 / 卡一下？
A: 正常。JS、CSS、字体全部以 base64 内联在一个文件里，
   首次解析要一两秒。

Q: 公式显示成红色的代码块？
A: 说明这条公式的 LaTeX 写法不合法。是模型输出格式问题，
   不影响其他内容，换个模型或重新生成一般就好。

Q: 点「导出 PDF」没反应？
A: 单文件版本已通过合并打包规避了懒加载失败的问题；
   若仍遇到，请反馈。

Q: 配了 API Key 还是提示未配置？
A: 确认保存后状态变成「已配置 / 有效」。另外检查 Key 是否
   有余额、是否选对了厂商。

Q: 提示「网络中断 / 响应超时」？
A: 已经生成的部分会照常显示，末尾会有一行提示说明原因，
   并且系统已经尝试过自动续写。可以直接重新生成。


────────────────────────────────────────────────────────
七、已知限制
────────────────────────────────────────────────────────
· 从本地文件打开时，页面的「来源」是 null。实测智谱 / 通义 /
  DeepSeek / Moonshot / 硅基流动的接口都放行；个别厂商若返回
  CORS 错误，属于浏览器对该来源的限制，不是配置问题。
· 配图依赖网络，离线状态下不显示图片。
· 输出上限、网络状况取决于你用的模型和网络，
  生成结果的长短与质量会有波动。


────────────────────────────────────────────────────────
八、关于这个文件
────────────────────────────────────────────────────────
版本：v${pkg.version}
构建：${buildDate}
体积：约 ${sizeMB} MB（其中约 1.5MB 是内联的数学公式字体）

源码与文档：https://github.com/ceepuka/zhishilingdong
许可证：MIT
`
fs.writeFileSync(path.join(outDir, '使用说明.txt'), readme, 'utf-8')

console.log('[release] 已内联：')
for (const line of inlined) console.log('   ', line)
console.log(`[release] 产物目录：${outDir}`)
console.log(`[release]   ${htmlName}   ${sizeMB} MB`)
console.log('[release]   使用说明.txt')
