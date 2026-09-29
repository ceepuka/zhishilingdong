import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * 「单文件 HTML」发布构建配置 —— 本项目**唯一的正式发布形态**。
 *
 * 产物链路：
 *   1. 本配置把应用构建到 `.tmp-standalone/`（中间产物，已 gitignore）；
 *   2. `scripts/build-standalone.js` 把它压成一个 HTML，输出到 `release/`（入库，即发布包）。
 *
 * 之所以要一份独立配置，是因为 `file://` 页面（双击打开时页面的来源是 `null`）
 * 有两条普通构建过不去的限制，三点差异全部为此：
 *
 * 1. `inlineDynamicImports: true`
 *    动态 `import()` 在 `file://` 下会走网络式加载并被 CORS 拦掉 —— 而默认构建会把
 *    jspdf / html2canvas / purify 拆成懒加载 chunk，不合并的结果是「PDF 导出点了没反应」，
 *    不报错、不提示，只在控制台留一行。
 *
 * 2. `assetsInlineLimit: Infinity`
 *    `<style>` 里 `url(./x.woff2)` 在 `file://` 下同样算跨源字体加载，Chrome 直接拒。
 *    KaTeX 有 60 个字体文件，不内联等于公式排版全崩。
 *
 * 3. 不配 `manualChunks`
 *    与 `inlineDynamicImports` 互斥，加了会直接构建失败。
 *
 * 另外 `cssCodeSplit: false` 同理：CSS 必须合成一份才方便整体内联。
 */
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: '.tmp-standalone',
    assetsInlineLimit: Infinity,
    cssCodeSplit: false,
    sourcemap: false,
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
})
