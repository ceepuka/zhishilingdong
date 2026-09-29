import fs from 'fs'
import path from 'path'

/**
 * 把 `release/` 的产物发成 GitHub Release（成品不入库，见 .gitignore）。
 *
 * 用法：
 *   GH_TOKEN=<你的 token> node scripts/publish-release.mjs
 *
 * 为什么需要 token：本机没装 `gh`。token 从环境变量读，脚本不会打印它。
 * 若你懒得单独生成 token，本机 git 推送用的那份凭据可以这样取（bash）：
 *   printf 'protocol=https\nhost=github.com\n\n' | git credential fill
 * 取到的 password 字段就是 token（需要 repo / public_repo 权限）。
 *
 * ⚠️ 一个必须知道的坑：**GitHub 的 Release 附件名只接受 ASCII**。
 * 传中文名不会报错，会被静默替换成 `default.html` 之类的名字
 * （HTTP 200，name 变成 "default.*"，不报错，只有去看列表才发现）。
 * 所以这里做映射：ASCII 文件名用于下载，中文名放 `label` 供界面显示。
 */

const OWNER = 'ceepuka'
const REPO = 'zhishilingdong'
const projectRoot = path.join(import.meta.dirname, '..')
const releaseDir = path.join(projectRoot, 'release')

/** 本地文件名 → Release 附件（ASCII 名 + 中文 label） */
const assetName = (file, version) => {
  if (file.endsWith('.html')) return { name: `zhishilingdong-v${version}.html`, label: file }
  if (file === '使用说明.txt') return { name: `usage-v${version}.txt`, label: file }
  return { name: `asset-v${version}-${file}`, label: file }
}

const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN
if (!token) {
  console.error('[publish] 缺少 GH_TOKEN 环境变量。见本文件顶部用法说明。')
  process.exit(1)
}
if (!fs.existsSync(releaseDir)) {
  console.error('[publish] 找不到 release/，请先运行 npm run release')
  process.exit(1)
}

const { version } = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf-8'))
const tag = `v${version}`

const API = `https://api.github.com/repos/${OWNER}/${REPO}`
const headers = {
  Authorization: `Bearer ${token}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'publish-release',
}

const buildNotes = (files) => `正式发布形态是**一个可以直接双击打开的 HTML**：零后端、不需要 Node、不需要服务器、不需要联网（默认 Mock 模式零网络请求）。

## 下载

| 下载文件 | 内容 |
|----------|------|
${files
  .map((f) => {
    const a = assetName(f, version)
    const size = (fs.statSync(path.join(releaseDir, f)).size / 1024 / 1024).toFixed(2)
    return `| \`${a.name}\` | ${a.label}（${size} MB） |`
  })
  .join('\n')}

> 附件名只能用 ASCII，所以下载下来是 \`zhishilingdong-v${version}.html\` 这种名字。
> 它就是 \`${files.find((f) => f.endsWith('.html'))}\`，双击用 Chrome / Edge 打开即可。

第一次打开是 **Mock 模式**（顶部显示"未配置密钥"），用的是内置示例数据，四个模块都能完整走一遍，且一个网络请求都不会发出去。想用真实 AI 就在设置里填任一厂商的 API Key（智谱 / 通义 / 硅基流动 / DeepSeek / Moonshot / OpenAI / Anthropic / Gemini），从那时起才需要联网。
`

;(async () => {
  const files = fs.readdirSync(releaseDir).filter((f) => fs.statSync(path.join(releaseDir, f)).isFile())
  if (!files.length) {
    console.error('[publish] release/ 是空的，先运行 npm run release')
    process.exit(1)
  }
  const notes = buildNotes(files)

  const found = await fetch(`${API}/releases/tags/${tag}`, { headers })
  let release
  if (found.ok) {
    release = await found.json()
    const res = await fetch(`${API}/releases/${release.id}`, {
      method: 'PATCH',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: `${tag} —— 单文件 HTML 发布版`, body: notes }),
    })
    release = await res.json()
    console.log(`[publish] 已更新已存在的 Release：${release.html_url}`)
  } else {
    const res = await fetch(`${API}/releases`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ tag_name: tag, name: `${tag} —— 单文件 HTML 发布版`, body: notes, draft: false, prerelease: false }),
    })
    if (!res.ok) {
      console.error('[publish] 创建 Release 失败：', res.status, (await res.text()).slice(0, 300))
      console.error('[publish] 若报 404/403，检查 tag 是否已推送、token 是否有 repo 权限。')
      process.exit(1)
    }
    release = await res.json()
    console.log(`[publish] 已创建 Release：${release.html_url}`)
  }

  // 同名附件先删后传，保证脚本可重复运行
  const existing = await (await fetch(`${API}/releases/${release.id}/assets`, { headers })).json()
  const wanted = files.map((f) => assetName(f, version).name)

  for (const asset of existing) {
    if (wanted.includes(asset.name)) {
      await fetch(`${API}/releases/assets/${asset.id}`, { method: 'DELETE', headers })
      console.log(`[publish] 已移除同名旧附件：${asset.name}`)
    }
  }

  for (const file of files) {
    const { name, label } = assetName(file, version)
    const buf = fs.readFileSync(path.join(releaseDir, file))
    const res = await fetch(
      `https://uploads.github.com/repos/${OWNER}/${REPO}/releases/${release.id}/assets?name=${encodeURIComponent(name)}`,
      { method: 'POST', headers: { ...headers, 'Content-Type': 'application/octet-stream' }, body: buf }
    )
    if (!res.ok) {
      console.error(`[publish] 上传失败：${file} → ${res.status} ${(await res.text()).slice(0, 200)}`)
      continue
    }
    let asset = await res.json()

    // 中文 label 供界面显示；名字被 GitHub 吃掉时给出明确警告，不静默略过
    const patched = await fetch(`${API}/releases/assets/${asset.id}`, {
      method: 'PATCH',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, label }),
    })
    if (patched.ok) asset = await patched.json()
    if (asset.name !== name) {
      console.warn(`[publish] ⚠ ${file} 的附件名被 GitHub 改成了 "${asset.name}"（expect "${name}"）`)
    }
    console.log(`[publish]   ${asset.name}  ${(asset.size / 1024 / 1024).toFixed(2)}MB  label=${asset.label}`)
  }
})().catch((e) => {
  console.error('[publish] 出错：', String(e).slice(0, 300))
  process.exit(1)
})
