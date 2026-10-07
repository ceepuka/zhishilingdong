/**
 * 版本号一致性校验（发布前置门禁）。
 *
 * ## 为什么需要它
 *
 * 2026-10-06 出过一次事故：`package.json` 先被写成 `1.8.0`（复制/导出重构），
 * 但那个版本**从没发布/打 tag**；随后公式/PDF 修复又把号抬到 `1.9.0` 一起发 ——
 * 于是"1.8.0 号段"被一个没发布过的东西占掉，而用户在路线图里把 `1.8.0`
 * 留给"移动端适配"。**未发布的改动不该占号**，六处版本号也必须始终一致。
 *
 * 所以 `npm run release` 之前先跑这个脚本：任何一处对不上，直接 fail，
 * 不允许把版本号不一致的产物发出去。
 *
 * ## 校验的六处
 *
 *   1. `package.json` 的 `version`
 *   2. `package-lock.json` 顶层的 `version`
 *   3. `package-lock.json` 里 `packages[""]` 的 `version`（npm 会同步这两处）
 *   4. `docs/versions.md` 里存在 `## vX.Y.Z` 里程碑标题
 *   5. `README.md` 版本表里存在 `| vX.Y.Z | ... |` 行
 *   6. `docs/todo.md` 版本表里存在 `| vX.Y.Z | ... |` 行
 *
 * 另外校验 SemVer 形状，并在设置 `RELEASE_TAG`（或 `--tag`）时比对 tag 值。
 *
 * 用法：
 *   node scripts/check-version.js            # 校验六处一致
 *   node scripts/check-version.js v1.7.3     # 额外要求 tag 名为 v1.7.3
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(resolve(root, p), 'utf-8');

const problems = [];
const ok = [];

const SEMVER = /^\d+\.\d+\.\d+$/;

function check(label, condition, detail) {
  if (condition) ok.push(label);
  else problems.push(`${label}${detail ? ` —— ${detail}` : ''}`);
}

// 1) package.json
const pkg = JSON.parse(read('package.json'));
const ver = pkg.version;
check('package.json 的 version 是合法 SemVer', SEMVER.test(ver), `实际 "${ver}"`);

// 2/3) package-lock.json
const lockText = read('package-lock.json');
const lock = JSON.parse(lockText);
check('package-lock.json 顶层 version 与 package.json 一致', lock.version === ver,
  `lock="${lock.version}" pkg="${ver}"`);
const lockRoot = lock.packages?.['']?.version;
check('package-lock.json packages[""] version 与 package.json 一致', lockRoot === ver,
  `lock.packages[""]="${lockRoot}" pkg="${ver}"`);

// 4) docs/versions.md —— 存在 `## vX.Y.Z` 里程碑
const versionsMd = read('docs/versions.md');
const versionsHit = new RegExp(`^##\\s+v${ver.replace(/\./g, '\\.')}(\\s|$|·)`, 'm').test(versionsMd);
check(`docs/versions.md 里有 v${ver} 里程碑`, versionsHit,
  '未找到 `## v' + ver + '` 开头的标题');

// 5) README.md 版本表
const readme = read('README.md');
const rowRe = new RegExp(`^\\|\\s*v${ver.replace(/\./g, '\\.')}\\s*\\|`, 'm');
check(`README.md 版本表里有 v${ver} 行`, rowRe.test(readme), `未找到 "| v${ver} |"`);

// 6) docs/todo.md 版本表
const todo = read('docs/todo.md');
check(`docs/todo.md 版本表里有 v${ver} 行`, rowRe.test(todo), `未找到 "| v${ver} |"`);

// 7) 可选：tag 比对
const tagArg = process.argv[2] || process.env.RELEASE_TAG;
if (tagArg) {
  const want = tagArg.startsWith('v') ? tagArg : `v${tagArg}`;
  check(`tag 与 version 一致`, want === `v${ver}`, `tag="${want}" version="v${ver}"`);
}

if (problems.length) {
  console.error(`\n✖ 版本号校验未通过（${problems.length} 项）：`);
  for (const p of problems) console.error(`   · ${p}`);
  console.error('\n修正后再发布。规则见 docs/convention.md §7。\n');
  process.exit(1);
}

console.log(`✔ 版本号校验通过：v${ver}（package.json / lock / versions.md / README / todo${tagArg ? ' / tag' : ''} 一致）`);
