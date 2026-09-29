// 重建 .manifest.json：遍历 src/ docs/ scripts/ config/，记录每个文件的最后修改时间与大小。
// 用法：node scripts/build-manifest.js   （或 npm run manifest）
// 说明：manifest 用于检测用户手动改动；仅追踪这四个目录（根目录 README.md 不在扫描范围）。
import fs from 'fs';
import path from 'path';

const projectRoot = path.join(import.meta.dirname, '..');
const TRACKED_DIRS = ['src', 'docs', 'scripts', 'config'];
const IGNORED_DIRS = new Set(['node_modules']);

const pad = (n) => String(n).padStart(2, '0');
// 本地时间，格式与既有 manifest 一致（无时区后缀）
const localIso = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T` +
  `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

const files = {};
const walk = (absDir) => {
  for (const entry of fs.readdirSync(absDir, { withFileTypes: true })) {
    if (entry.isDirectory() && IGNORED_DIRS.has(entry.name)) continue;
    const abs = path.join(absDir, entry.name);
    if (entry.isDirectory()) {
      walk(abs);
    } else if (entry.isFile()) {
      const rel = path.relative(projectRoot, abs).split(path.sep).join('/');
      const st = fs.statSync(abs);
      files[rel] = { lastModified: localIso(st.mtime), size: st.size };
    }
  }
};

for (const dir of TRACKED_DIRS) {
  const abs = path.join(projectRoot, dir);
  if (fs.existsSync(abs)) walk(abs);
}

// 路径排序，保证输出稳定（便于 diff）
const sorted = {};
for (const key of Object.keys(files).sort()) sorted[key] = files[key];

fs.writeFileSync(
  path.join(projectRoot, '.manifest.json'),
  JSON.stringify({ files: sorted }, null, 4) + '\n',
  'utf8',
);

console.log(`build-manifest: ${Object.keys(sorted).length} files tracked`);
