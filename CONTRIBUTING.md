# Maintaining the Cloudflare edition

This repository is `xingkaixin/umami`. Submit issues and pull requests here, not
to `umami-software/umami`. The upstream project is a source reference only.

## Changes

1. Create a `feat/` branch from `main`.
2. Reproduce the issue and inspect browser or Worker logs before changing code.
3. Keep changes focused and add or extend tests for the affected behavior.
4. Run `pnpm test`, `pnpm build`, and `pnpm deploy:check`.
5. Push to your personal repository and open a pull request against `main`.

Use English PR titles and descriptions. Commit messages use `<scope>: <Description>`,
for example `database: Preserve session timestamps`. Split distinct changes into
separate commits. Check CI and merge conflicts before requesting a review.

## Testing and deployment

Use Node.js 24 and pnpm 11. Follow [the Cloudflare guide](docs/cloudflare.md) for
local setup and browser testing. Browser tests need a dedicated local D1 database.
CI runs them against the built Worker and never deploys to Cloudflare.

`wrangler.jsonc` contains production resource IDs. Commands with `--remote`
modify the production database; use them only for an intended production change.
Create new Drizzle migrations for schema changes. Never rewrite a migration that
has already run in production. Keep database backups before applying changes.

Do not commit passwords, tokens, `.dev.vars`, `.wrangler`, or generated output.
Remove credentials and visitor data from issue logs and screenshots.

## Reporting issues

Search [existing issues](https://github.com/xingkaixin/umami/issues) first.
Include reproduction steps, expected and actual behavior, the commit or Worker
version ID, browser details, and whether the problem occurs locally or on Workers.

## License

Contributions remain under the [MIT License](LICENSE). Preserve upstream attribution.
