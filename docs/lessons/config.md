# 配置错误

## Skill路径配置错误
- 时间：2026-07-02
- 场景：项目级Skill部署（component-config-manager）
- 错误：将Skill放在 `.skills/` 目录，Trae无法识别
- 正确：项目级Skill必须放在 `.trae/skills/` 目录
- 标签：Skill路径, 项目配置, 部署

## Skill触发配置缺失
- 时间：2026-07-02
- 场景：项目初始化
- 错误：缺少 `.trae/settings.json` 配置文件，技能无法自动触发
- 正确：创建 settings.json 并配置 requiredSkills 数组
- 标签：Skill触发, settings.json, 配置文件

## .gitignore 不会取消已追踪的构建产物
- 时间：2026-09-14
- 场景：仓库卫生治理（剔除垃圾文件）
- 错误：`.gitignore` 里早已写入 `dist`，却仍以为仓库已排除 `dist/`——实际 64 个构建产物一直躺在版本库里
- 原因：**`.gitignore` 只约束"未追踪"文件**；对"在加规则之前就已提交"的文件完全无效（ignore 规则不会自动 untrack）
- 正确：`git rm -r --cached dist`（**保留本地文件**）后再提交；并且**删前必须确认该目录是否被构建/部署依赖**——本项目 `vercel.json`(`buildCommand: npm run build`) 与 `netlify.toml`(`command = npm run build`) 都由平台自行构建，故仓库内 dist 属纯污染
- 标签：gitignore, 构建产物, 仓库污染, git-rm-cached, 部署配置

## 清理前先只读扫描并分档
- 时间：2026-09-14
- 场景：用户要求"剔除垃圾文件"
- 错误做法：拿到"清理"指令就直接删，容易把 IDE 配置（`.trae/` 是 Trae 项目级 Skill 的必需目录）、素材（`remotion-videos/public/assets` 11MB 抽帧图/配音）、成品一并当垃圾清掉
- 正确：**先只读扫描出清单（含规模 + git 追踪状态），报告并确认后再动手**；分「可删 / 待定夺 / 必留」三档；可再生（构建产物、配置快照）才归入可删
- 附加环境坑：`Add-Type` 被安全策略拦截 → PowerShell「送回收站」方案不可用，需退回直接删除（仅限 gitignore 的可再生产物）
- 标签：清理, 只读扫描, 三档分类, 回收站, 安全策略