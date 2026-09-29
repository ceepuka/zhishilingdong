import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * 开发配置（`npm run dev`，端口 5173）。
 *
 * 正式发布不走这里 —— 发布的唯一形态是单文件 HTML，
 * 由 `vite.standalone.config.ts` + `scripts/build-standalone.js` 产出到 `release/`，
 * 见 `npm run release`。所以这里只留开发需要的东西。
 */
export default defineConfig({
  plugins: [react()],
  base: './',
})
