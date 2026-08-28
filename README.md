<p align="center">
  <img src="https://content.umami.is/website/images/umami-logo.png" alt="Umami Logo" width="100">
</p>

<h1 align="center">Umami — Cloudflare edition</h1>

<p align="center">
  <i>A personally maintained Umami deployment on Cloudflare Workers and D1.</i>
</p>

<p align="center">
  <a href="https://github.com/xingkaixin/umami/actions/workflows/ci.yml">CI</a> ·
  <a href="https://github.com/xingkaixin/umami/issues">Issues</a> ·
  <a href="LICENSE">MIT License</a> ·
  <a href="https://github.com/umami-software/umami">Upstream Umami</a>
</p>

---

## Cloudflare edition

This fork runs Umami on **Cloudflare Workers + D1**, using **vinext** and **Drizzle**.
It does not need Vercel, PostgreSQL, Prisma, Redis, or a Node.js application server.
It is based on the supplied Umami 3.3.1 source snapshot and maintained in
[`xingkaixin/umami`](https://github.com/xingkaixin/umami). Report problems in this
repository, not upstream. Upstream changes must be reviewed and ported explicitly.
The upstream Umami documentation still describes the original deployment; use the
[Cloudflare deployment guide](docs/cloudflare.md) for this fork.

### Local development

Requires Node.js 24 and pnpm 11.

```sh
pnpm install
cp .dev.vars.example .dev.vars
# Replace both secret placeholders with separate values from openssl rand -hex 32.
pnpm db:migrate:local
# Supply UMAMI_ADMIN_PASSWORD through your environment (at least 12 characters).
pnpm db:create-admin --local
pnpm dev
```

Build and preview the Worker:

```sh
pnpm test
pnpm build
pnpm start
```

Builds do not modify databases or create default accounts. The local preview and
migration commands share `.wrangler/state`; neither touches a remote database.

### Deployment

The configured production instance is [umami.xingkaixin.me](https://umami.xingkaixin.me).
Its Worker, account, D1 ID, and Custom Domain are recorded in `wrangler.jsonc`.
Commands using `--remote` target that production database. CI does not deploy.
For a new instance or a production update, follow [the deployment guide](docs/cloudflare.md).

### Compatibility

The self-hosted dashboard, collection API, teams, sharing, event/session properties,
reports, replay, heatmaps, and two-factor authentication remain in scope. Umami's
hosted subscription billing and Redis-backed white-label settings are not included.
vinext is pinned to a beta release; validate upgrades before deploying them.

---

## Maintenance

`main` is the maintained branch. Use `feat/` branches and pull requests targeting
this repository for future changes. See [CONTRIBUTING.md](CONTRIBUTING.md).

CI runs unit tests, D1 integration tests, the production build, a deployment dry
run, and browser tests against a local Worker. It needs no production credentials.
Do not run the browser suite against the live database: tests create and delete data.

## License and origin

Based on [Umami](https://github.com/umami-software/umami) by Umami Software, Inc.
The upstream [MIT license](LICENSE) is preserved. This repository is independently
maintained and is not an official Umami Cloudflare distribution.
