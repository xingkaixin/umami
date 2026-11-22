---
name: umami
description: >-
  Use the `umami` CLI to query Umami web analytics data: list websites
  (`websites`), fetch traffic overviews with period comparisons (`summary`,
  `stats`), daily/hourly/monthly trends (`trend`), dimension breakdowns
  (`metrics` for path, referrer, country, device, browser, os, event, channel,
  UTM), active and realtime visitors (`active`, `realtime`), and recent
  pageviews or custom events (`events`). Activate whenever the user asks about
  Umami analytics, website traffic, pageviews, visitors, bounce rate, top
  pages, referrers, or realtime visits.
---

# Using the `umami` CLI

`umami` is a read-only Go CLI for querying a self-hosted Umami instance with a personal read-only API token (`umk_...`). Human-readable tables or `--json` payloads are written to `stdout`; errors are written to `stderr`.

## Agent Operating Rules

1. **Verify auth and resolve the site explicitly.**
   - If unsure whether the CLI is configured, run `umami auth status --json`.
   - If the user does not give a clear domain or website ID, run `umami websites --json` first instead of guessing.
   - `<site>` accepts a website ID, domain, site name, or unique partial match (for example `example.com`).
2. **Prefer `--json` and parallel single commands.**
   - Pass `--json` on read queries so output is structured and unambiguous.
   - Run independent queries as separate parallel commands rather than chaining multiple `--json` calls with `;` in one shell call.
   - Always pass `--tz` (for example `--tz Asia/Shanghai`) when the user asks about local calendar periods (`today`, `yesterday`, `this-week`, `this-month`, or `--from`/`--to` dates).
3. **Start with `summary` for broad traffic questions.**
   - `umami summary <site> --range 30d --json` fetches stats (with previous-period comparison), active visitors, and top pages, referrers, countries, and devices in one parallel round-trip.
   - Only run extra `trend`, `metrics`, `realtime`, or `events` calls when the user needs time-series data, a specific dimension, or raw event inspection.
4. **Never leak credentials or run destructive local auth commands.**
   - Never read or print the saved config file (`~/Library/Application Support/umami/config.json` on macOS, `${XDG_CONFIG_HOME:-~/.config}/umami/config.json` on Linux, or `$UMAMI_CONFIG`), and never echo `UMAMI_TOKEN`.
   - Never run `umami auth logout` or overwrite saved credentials with `umami auth login` unless the user explicitly asks.
5. **Interpret Umami metrics accurately.**
   - `stats.totaltime` is total seconds across visits; average visit duration is `totaltime / visits`.
   - Single-page visits with no subsequent pageview or custom event count as bounces and record `0s` duration in Umami, which lowers average visit time on content/blog sites.
   - When `pageviews` closely equals `sessions`, referrer share is tiny, and device/country distribution looks skewed, flag likely bot/crawler or direct automated traffic alongside the raw totals.

## Core Workflows

### 1. Check Auth & List Websites

```bash
umami auth status --json
umami websites --json
```

### 2. Traffic Overview & Trend

```bash
# One-shot overview: stats + comparison, active visitors, top pages/referrers/countries/devices
umami summary <site> --range 30d --tz Asia/Shanghai --json

# Time series (auto-picks hour/day/month unit, or override with --unit)
umami trend <site> --range 30d --unit day --tz Asia/Shanghai --json

# Explicit date window (YYYY-MM-DD or RFC3339)
umami stats <site> --from 2026-10-01 --to 2026-10-31 --tz Asia/Shanghai --json
```

Supported `--range` presets: `1h`, `24h`, `<N>h`, `7d`, `14d`, `30d`, `90d`, `<N>d`, `today`, `yesterday`, `this-week`, `this-month`, `this-year`.

### 3. Dimension Breakdowns & Filtering

```bash
# Common --type values: path, fullPath, entry, exit, title, query, referrer,
# channel, country, region, city, browser, os, device, language, event,
# utmSource, utmMedium, utmCampaign, utmContent, utmTerm
umami metrics <site> --type path --range 30d --limit 20 --json

# Expanded metrics include visitors, pageviews, visits, bounces, and totaltime
umami metrics <site> --type path --expanded --range 30d --limit 20 --json

# Repeatable --filter key=value works on summary, stats, trend, metrics, and events
umami stats <site> --range 30d --filter country=CN --filter device=mobile --json
```

### 4. Realtime & Recent Events

```bash
# Active visitors in the last 5 minutes
umami active <site> --json

# Last 30 minutes snapshot (totals, top URLs, referrers, countries)
umami realtime <site> --tz Asia/Shanghai --json

# Recent pageviews and custom events
umami events <site> --range 7d --limit 50 --search /posts/ --json
```

## Authentication Setup (Reference Only)

Only suggest these steps if `umami auth status --json` reports `configured: false` or unauthorized:

1. Create a read-only API token in Umami under **Settings → Security → API tokens**.
2. Save it locally: `umami auth login --url <umami-url> --token <token>` (or export `UMAMI_URL` and `UMAMI_TOKEN`).
