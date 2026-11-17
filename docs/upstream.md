# Upstream tracking

This fork selectively ports changes from [umami-software/umami](https://github.com/umami-software/umami).
Its original source is the Umami 3.3.1 snapshot. The package version is not an
upstream synchronization marker.

## Review checkpoints

Last reviewed: **2026-11-17** against fork commit `a86147ae4de4ccbc28e6f68671752823fb94a612`.

| Upstream branch | Reviewed through | Release context |
| --- | --- | --- |
| `master` | [`b18d5144dfe7342edeeca6f61d13ba3baabed9ad`](https://github.com/umami-software/umami/commit/b18d5144dfe7342edeeca6f61d13ba3baabed9ad) | v3.5.0 and the following dependency security update |
| `dev` | [`051620da1ff1555ab36f2cf14d701ac8e734a743`](https://github.com/umami-software/umami/commit/051620da1ff1555ab36f2cf14d701ac8e734a743) | Unreleased changes through 2026-11-16 |

These are review checkpoints, not merge bases or claims of feature parity.
The review compared release changes and relevant source code with the fork's
existing selective ports. Older deferred work stays in the decisions below;
it does not need another discovery pass unless its scope or implementation changes.

## Ported in this review

The source SHAs identify provenance. Implementations are adapted to this fork,
not cherry-picked together with unrelated upstream code.

| Upstream commit | Ported behavior | Adaptation |
| --- | --- | --- |
| [`10559f868383f6259d9a577a9f21972fc2761193`](https://github.com/umami-software/umami/commit/10559f868383f6259d9a577a9f21972fc2761193) | Preserve newer search text when a delayed DataGrid navigation finishes | Include the final `master` behavior for clearing abandoned pushes; retain the fork's layout |
| [`25bb82411bd9583bb76a56f113af59850ce000d3`](https://github.com/umami-software/umami/commit/25bb82411bd9583bb76a56f113af59850ce000d3) | Return and store a replacement token after changing a password; read the current token per API request | Use the existing password-bound stateless JWT; keep the existing administrator initialization and profile page |
| [`b12b1e07342368718d6e4ce4b7763426855d5e2c`](https://github.com/umami-software/umami/commit/b12b1e07342368718d6e4ce4b7763426855d5e2c) | Send logout before removing authentication, then always clear local state and redirect | No Redis session handling or API version bump |
| [`9469bcc09bb02be5cbbabf8fed94830c59fb83fb`](https://github.com/umami-software/umami/commit/9469bcc09bb02be5cbbabf8fed94830c59fb83fb) | Reject script/local-content schemes and URL credentials in short-link destinations | Use the self-hosted rule in forms, create/update APIs and redirects; preserve IP, localhost, mail and application destinations |

## Other review decisions

| Status | Changes | Decision |
| --- | --- | --- |
| Already covered | Required 2FA, atomic attempt reservation, share revocation and section/row permissions, team/password permissions, entity ID conflicts, website transfers, collection input and cache-token binding | Existing D1 and permission implementations cover the relevant behavior |
| Already covered | Anonymous session claims, identified visit reuse, elapsed-period comparison, timezone/date fixes, recorder performance fixes, replay navigation/IDs, team website switcher, session referrers, 12/24-hour preference and `period` query parameters | Retain the existing implementations; do not replace them with upstream Prisma/PostgreSQL code |
| Already covered | Security dependency floors after v3.5.0 | Existing lockfile/overrides cover the relevant packages, including Undici, Zod, fast-uri, serialize-javascript, sucrase and minimatch |
| Deferred | Chart-bar date drill-down, retention shading and mobile Dashboard navigation | Optional frontend enhancements; this batch contains fixes only |
| Deferred | Annotations | Separate feature requiring a new D1 table, CRUD and chart markers |
| Deferred | `window.umamiConfig`, client salts and fixed server salts | Separate tracker configuration work; retain the current daily/weekly/monthly server rotation |
| Deferred | Browser error tracking | Separate feature requiring D1 storage, collection, issue queries, quotas and retention |
| Deferred | API keys, MCP, typed API client, redesigned analytics routes and event-response `visitId` | Separate API compatibility and authentication work |
| Deferred | Remaining UI changes, including device/unknown labels, language menu, preferences popover and update-notice styling | Revisit when those interfaces are in scope |
| Not applicable | Google Ads/Search Console and paid-plan restrictions | Depend on upstream commercial Cloud services; this is the self-hosted Cloudflare edition |
| Not applicable | Redis session/cache fixes, Docker/Podman and PostgreSQL/ClickHouse-specific changes | Those runtimes are absent from this fork |
| Retained fork behavior | Public config loading and explicit strong administrator creation | Keep the existing configuration flow and administrator setup |

## Next review

1. Read this file before searching upstream history. Keep `origin` pointing to
   `xingkaixin/umami`.
2. Fetch both upstream branches before comparing them so both checkpoints are
   available in a fresh checkout. Keep local tracking refs without merging:

   ```sh
   git fetch --no-tags https://github.com/umami-software/umami.git \
     master:refs/remotes/upstream/master dev:refs/remotes/upstream/dev
   git log --no-merges --oneline upstream/master ^<master-checkpoint> ^<dev-checkpoint>
   git log --no-merges --oneline upstream/dev ^<master-checkpoint> ^<dev-checkpoint>
   ```

3. Exclude both checkpoints so a commit reviewed on `dev` is not reviewed again
   when it reaches `master`. Check actual code and fork history before marking a change as missing.
   Consult the deferred decisions instead of rediscovering older candidates.
4. Record each selected source SHA and its adaptation. Advance each branch's
   checkpoint only after reviewing its new commits, even if none are ported.
   A failed or partial review must leave that checkpoint unchanged.
