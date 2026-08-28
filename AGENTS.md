# 项目约定

- 始终使用中文回复。
- 本仓库是 `xingkaixin/umami`，基于 Umami 3.3.1，独立维护 Cloudflare 版本。
- `origin` 必须指向 `xingkaixin/umami`。未经明确要求，不向上游推送或提交 PR。
- 技术栈是 vinext、Cloudflare Workers、D1、Drizzle。不要重新引入 Prisma 或 PostgreSQL 运行时。
- 保留上游 MIT 许可证和来源说明。

## 开发与验证

- 使用 Node.js 24、pnpm 11。安装依赖执行 `pnpm install --frozen-lockfile`。
- 修复问题先增加必要日志、复现并读取运行结果，再修改代码；不要仅凭静态猜测。
- 保持修改集中、状态最少、函数和模块职责清晰。代码正文默认不加注释，只解释不直观的原因。
- 常规检查：`pnpm test`、`pnpm build`、`pnpm deploy:check`。
- 浏览器测试使用独立的本地 D1；详见 `docs/cloudflare.md`。禁止对生产库运行整套 E2E 或种子数据。
- 不要让多个本地 Worker 同时写同一份 `.wrangler/state`。

## 生产环境

- `wrangler.jsonc` 指向 `umami.xingkaixin.me` 的生产资源。`--remote` 操作会影响生产库。
- 未明确要求部署或修改线上数据时，只做本地验证。CI 不自动部署。
- 数据库结构变更使用新的 Drizzle 迁移；已在生产执行的迁移不可重写。
- 不提交 `.dev.vars`、`.wrangler`、构建产物、密码或生产密钥，也不要将它们输出到日志。

## Git 与 PR

- 日常分支使用 `feat/` 前缀，PR 目标为本仓库的 `main`。
- 按逻辑需求拆分提交，英文提交标题使用 `<scope>: <Description>`，不要使用 Conventional Commit 类型前缀。
- PR 标题和内容使用英文。提交后检查 CI 和冲突，修复失败项。
- 默认由用户合并 PR；只有明确要求时才执行合并。
