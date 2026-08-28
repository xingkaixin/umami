import { getColumnFilters, parseFilters } from '@/db/filters';
import { rawQuery } from '@/db/query';
import { HEATMAP_EVENT_TYPE } from '@/lib/constants';
import type { QueryFilters } from '@/lib/types';
import { getWebsite } from '@/queries/drizzle';

const POINT_LIMIT = 5000;
const PAGE_LIMIT = 100;
const SCROLL_BUCKET_SIZE = 10;

export type HeatmapMode = 'click' | 'scroll';

export interface HeatmapParameters extends QueryFilters {
  urlPath?: string;
  mode?: HeatmapMode;
}

export interface HeatmapPage {
  urlPath: string;
  count: number;
  sessions: number;
}

export interface HeatmapPoint {
  x: number;
  y: number;
  pageX: number;
  pageY: number;
  pageW: number;
  pageH: number;
  viewportW: number;
  viewportH: number;
  count: number;
}

export interface HeatmapScrollBucket {
  depth: number;
  sessions: number;
  pageW: number;
  pageH: number;
  viewportW: number;
  viewportH: number;
}

export interface HeatmapSnapshotIframe {
  kind: 'iframe';
  id: string;
  url: string;
  pageW: number;
  pageH: number;
  viewportW: number;
  viewportH: number;
}

export type HeatmapSnapshot = HeatmapSnapshotIframe;

export interface HeatmapResult {
  mode: HeatmapMode;
  pages: HeatmapPage[];
  points: HeatmapPoint[];
  snapshot: HeatmapSnapshot | null;
  scroll: {
    buckets: HeatmapScrollBucket[];
    totalSessions: number;
    pageW: number | null;
    pageH: number | null;
    viewportW: number | null;
    viewportH: number | null;
  };
}

interface HeatmapFilterContext {
  joinQuery: string;
  filterQuery: string;
  queryParams: Record<string, any>;
}

export async function getHeatmap(
  websiteId: string,
  parameters: HeatmapParameters,
): Promise<HeatmapResult> {
  const { startDate, endDate, urlPath, mode = 'click' } = parameters;
  const eventType = mode === 'scroll' ? HEATMAP_EVENT_TYPE.scroll : HEATMAP_EVENT_TYPE.click;
  const filterContext = await getHeatmapFilterContext(websiteId, parameters);
  const pageFilter =
    mode === 'click'
      ? `
      and x is not null
      and y is not null
      and page_x is not null
      and page_y is not null
      and page_w is not null
      and page_h is not null
      and viewport_w is not null
      and viewport_h is not null
    `
      : `
      and scroll_pct is not null
      and page_w is not null
      and page_h is not null
      and viewport_w is not null
      and viewport_h is not null
    `;

  const rawPages: HeatmapPage[] = await rawQuery(
    `
    select
      h.url_path as "urlPath",
      count(*) as count,
      count(distinct h.visit_id) as sessions
    from heatmap_event h
    ${filterContext.joinQuery}
    where h.website_id = {{websiteId}}
      and h.event_type = {{eventType}}
      and h.created_at between {{startDate}} and {{endDate}}
      ${filterContext.filterQuery}
      ${pageFilter}
    group by h.url_path
    order by sessions desc, count desc
    limit ${PAGE_LIMIT}
    `,
    { ...filterContext.queryParams, websiteId, eventType, startDate, endDate },
  );
  const pages = rawPages;

  if (!urlPath) {
    return { mode, pages, points: [], snapshot: null, scroll: emptyScroll() };
  }

  if (mode === 'scroll') {
    const bucketRows: {
      depth: number | string;
      sessions: number | string;
      pageW: number | string;
      pageH: number | string;
      viewportW: number | string;
      viewportH: number | string;
    }[] = await rawQuery(
      `
      with filtered as (
        select h.visit_id, h.scroll_pct, h.page_w, h.page_h, h.viewport_w, h.viewport_h
        from heatmap_event h ${filterContext.joinQuery}
        where h.website_id = {{websiteId}} and h.event_type = {{eventType}} and h.url_path = {{urlPath}}
          and h.created_at between {{startDate}} and {{endDate}}
          ${filterContext.filterQuery}
          and h.scroll_pct is not null and h.page_w is not null and h.page_h is not null
          and h.viewport_w is not null and h.viewport_h is not null
      ), sizes as (
        select visit_id, dimension.key, dimension.value, count(*) as frequency
        from filtered, json_each(json_object('page_w', page_w, 'page_h', page_h, 'viewport_w', viewport_w, 'viewport_h', viewport_h)) dimension
        group by visit_id, dimension.key, dimension.value
      ), ranked_sizes as (
        select *, row_number() over (partition by visit_id, key order by frequency desc, value) as rank from sizes
      ), geometry as (
        select visit_id,
          max(case when key = 'page_w' then value end) as page_w,
          max(case when key = 'page_h' then value end) as page_h,
          max(case when key = 'viewport_w' then value end) as viewport_w,
          max(case when key = 'viewport_h' then value end) as viewport_h
        from ranked_sizes where rank = 1 group by visit_id
      ), scroll_depth as (
        select visit_id, max(scroll_pct) as max_pct from filtered group by visit_id
      )
      select floor(max_pct / ${SCROLL_BUCKET_SIZE}) * ${SCROLL_BUCKET_SIZE} as depth,
        count(*) as sessions, page_w as "pageW", page_h as "pageH", viewport_w as "viewportW", viewport_h as "viewportH"
      from scroll_depth join geometry using (visit_id)
      group by depth, page_w, page_h, viewport_w, viewport_h order by depth
      `,
      { ...filterContext.queryParams, websiteId, eventType, urlPath, startDate, endDate },
    );

    const scrollBuckets = bucketRows.map(r => ({
      depth: Number(r.depth),
      sessions: Number(r.sessions),
      pageW: Number(r.pageW),
      pageH: Number(r.pageH),
      viewportW: Number(r.viewportW),
      viewportH: Number(r.viewportH),
    }));
    const viewport = pickScrollSnapshotViewport(scrollBuckets);
    const scroll = {
      buckets: scrollBuckets,
      totalSessions: scrollBuckets.reduce((sum, bucket) => sum + bucket.sessions, 0),
      pageW: viewport?.pageW ?? null,
      pageH: viewport?.pageH ?? null,
      viewportW: viewport?.width ?? null,
      viewportH: viewport?.height ?? null,
    };
    const snapshot = await resolveHeatmapSnapshot({
      websiteId,
      urlPath,
      viewportW: viewport?.width ?? null,
      viewportH: viewport?.height ?? null,
      pageW: viewport?.pageW ?? null,
      pageH: viewport?.pageH ?? null,
    });

    return {
      mode,
      pages,
      points: [],
      snapshot,
      scroll,
    };
  }

  const rawPoints: HeatmapPoint[] = await rawQuery(
    `
    select
      h.x,
      h.y,
      h.page_x as "pageX",
      h.page_y as "pageY",
      h.page_w as "pageW",
      h.page_h as "pageH",
      h.viewport_w as "viewportW",
      h.viewport_h as "viewportH",
      count(*) as count
    from heatmap_event h
    ${filterContext.joinQuery}
    where h.website_id = {{websiteId}}
      and h.event_type = {{eventType}}
      and h.url_path = {{urlPath}}
      and h.created_at between {{startDate}} and {{endDate}}
      ${filterContext.filterQuery}
      and h.x is not null
      and h.y is not null
      and h.page_x is not null
      and h.page_y is not null
      and h.page_w is not null
      and h.page_h is not null
      and h.viewport_w is not null
      and h.viewport_h is not null
    group by
      h.x,
      h.y,
      h.page_x,
      h.page_y,
      h.page_w,
      h.page_h,
      h.viewport_w,
      h.viewport_h
    order by count desc
    limit ${POINT_LIMIT}
    `,
    { ...filterContext.queryParams, websiteId, eventType, urlPath, startDate, endDate },
  );

  const viewport = pickSnapshotViewport(rawPoints);
  const snapshot = await resolveHeatmapSnapshot({
    websiteId,
    urlPath,
    viewportW: viewport?.width ?? null,
    viewportH: viewport?.height ?? null,
    pageW: viewport?.pageW ?? null,
    pageH: viewport?.pageH ?? null,
  });

  return { mode, pages, points: rawPoints, snapshot, scroll: emptyScroll() };
}

function emptyScroll(): HeatmapResult['scroll'] {
  return {
    buckets: [],
    totalSessions: 0,
    pageW: null,
    pageH: null,
    viewportW: null,
    viewportH: null,
  };
}

async function resolveHeatmapSnapshot({
  websiteId,
  urlPath,
  viewportW,
  viewportH,
  pageW,
  pageH,
}: {
  websiteId: string;
  urlPath: string;
  viewportW: number | null;
  viewportH: number | null;
  pageW: number | null;
  pageH: number | null;
}): Promise<HeatmapSnapshotIframe | null> {
  if (!urlPath || !viewportW || !pageW || !pageH) {
    return null;
  }

  const website = await getWebsite(websiteId);
  const url = buildHeatmapPageUrl(website?.domain, urlPath);

  if (!url) {
    return null;
  }

  const fallbackViewportH = Math.min(Math.max(pageH, 640), 1080);
  const height = viewportH || fallbackViewportH;

  return {
    kind: 'iframe',
    id: `iframe:${websiteId}:${urlPath}:${viewportW}x${height}`,
    url,
    pageW,
    pageH,
    viewportW,
    viewportH: height,
  };
}

function getFirstDomain(domain?: string | null) {
  return domain?.split(',')[0]?.trim() || null;
}

function getWebsiteOrigin(domain?: string | null) {
  const host = getFirstDomain(domain);

  if (!host) {
    return null;
  }

  if (host.startsWith('http://') || host.startsWith('https://')) {
    return new URL(host);
  }

  const protocol =
    host.startsWith('localhost') || host.startsWith('127.0.0.1') || host.startsWith('[::1]')
      ? 'http'
      : 'https';

  return new URL(`${protocol}://${host}`);
}

function buildHeatmapPageUrl(domain: string | null | undefined, urlPath: string) {
  try {
    const origin = getWebsiteOrigin(domain);

    if (!origin) {
      return null;
    }

    return new URL(urlPath || '/', origin).toString();
  } catch {
    return null;
  }
}

function pickSnapshotViewport(
  points: HeatmapPoint[],
): { width: number; height: number; pageW: number; pageH: number } | null {
  const viewportBuckets = new Map<
    string,
    {
      width: number;
      height: number;
      count: number;
      maxPageW: number;
      maxPageH: number;
    }
  >();

  for (const p of points) {
    const viewportKey = `${p.viewportW}x${p.viewportH}`;
    const viewportBucket = viewportBuckets.get(viewportKey);

    if (viewportBucket) {
      viewportBucket.count += p.count;
      viewportBucket.maxPageW = Math.max(viewportBucket.maxPageW, p.pageW);
      viewportBucket.maxPageH = Math.max(viewportBucket.maxPageH, p.pageH);
    } else {
      viewportBuckets.set(viewportKey, {
        width: p.viewportW,
        height: p.viewportH,
        count: p.count,
        maxPageW: p.pageW,
        maxPageH: p.pageH,
      });
    }
  }

  let bestViewport: {
    width: number;
    height: number;
    count: number;
    maxPageW: number;
    maxPageH: number;
  } | null = null;

  for (const bucket of viewportBuckets.values()) {
    if (!bestViewport || bucket.count > bestViewport.count) {
      bestViewport = bucket;
    }
  }

  if (!bestViewport) {
    return null;
  }

  return {
    width: bestViewport.width,
    height: bestViewport.height,
    pageW: bestViewport.maxPageW,
    pageH: bestViewport.maxPageH,
  };
}

function pickScrollSnapshotViewport(
  buckets: HeatmapScrollBucket[],
): { width: number; height: number; pageW: number; pageH: number } | null {
  const viewportBuckets = new Map<
    string,
    {
      width: number;
      height: number;
      sessions: number;
      maxPageW: number;
      maxPageH: number;
    }
  >();

  for (const bucket of buckets) {
    const viewportKey = `${bucket.viewportW}x${bucket.viewportH}`;
    const viewportBucket = viewportBuckets.get(viewportKey);

    if (viewportBucket) {
      viewportBucket.sessions += bucket.sessions;
      viewportBucket.maxPageW = Math.max(viewportBucket.maxPageW, bucket.pageW);
      viewportBucket.maxPageH = Math.max(viewportBucket.maxPageH, bucket.pageH);
    } else {
      viewportBuckets.set(viewportKey, {
        width: bucket.viewportW,
        height: bucket.viewportH,
        sessions: bucket.sessions,
        maxPageW: bucket.pageW,
        maxPageH: bucket.pageH,
      });
    }
  }

  let bestViewport: {
    width: number;
    height: number;
    sessions: number;
    maxPageW: number;
    maxPageH: number;
  } | null = null;

  for (const bucket of viewportBuckets.values()) {
    if (!bestViewport || bucket.sessions > bestViewport.sessions) {
      bestViewport = bucket;
    }
  }

  if (!bestViewport) {
    return null;
  }

  return {
    width: bestViewport.width,
    height: bestViewport.height,
    pageW: bestViewport.maxPageW,
    pageH: bestViewport.maxPageH,
  };
}

function omitHeatmapPathFilters(filters: QueryFilters): QueryFilters {
  return Object.fromEntries(
    Object.entries(filters).filter(([key]) => key.replace(/\d+$/, '') !== 'path'),
  ) as QueryFilters;
}

async function getHeatmapFilterContext(
  websiteId: string,
  filters: QueryFilters,
): Promise<HeatmapFilterContext> {
  const pathFilters = Object.fromEntries(
    Object.entries(filters).filter(([key]) => key.replace(/\d+$/, '') === 'path'),
  );
  const { sql: pathQuery, params: pathParams } = await getColumnFilters(
    {
      websiteId,
      startDate: filters.startDate,
      endDate: filters.endDate,
      match: filters.match,
      ...pathFilters,
    },
    { table: 'heatmap_event' },
  );
  const { filterQuery, cohortQuery, excludeBounceQuery, joinSessionQuery, queryParams } =
    await parseFilters({
      ...omitHeatmapPathFilters(filters),
      websiteId,
    });

  if (!(filterQuery || cohortQuery || excludeBounceQuery)) {
    return {
      joinQuery: '',
      filterQuery: pathQuery,
      queryParams: pathParams,
    };
  }

  return {
    joinQuery: `
    inner join (
      select distinct website_event.website_id, website_event.session_id, website_event.visit_id
      from website_event
      ${joinSessionQuery}
      ${cohortQuery}
      ${excludeBounceQuery}
      where website_event.website_id = {{websiteId}}
        and website_event.created_at between {{startDate}} and {{endDate}}
        ${filterQuery}
    ) filtered_visits
      on filtered_visits.website_id = h.website_id
      and filtered_visits.session_id = h.session_id
      and filtered_visits.visit_id = h.visit_id
    `,
    filterQuery: pathQuery,
    queryParams: { ...queryParams, ...pathParams },
  };
}
