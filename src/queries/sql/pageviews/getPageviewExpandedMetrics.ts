import { parseFilters } from '@/db/filters';
import { rawQuery } from '@/db/query';
import { FILTER_COLUMNS, GROUPED_DOMAINS, SESSION_COLUMNS } from '@/lib/constants';
import type { QueryFilters } from '@/lib/types';

export interface PageviewExpandedMetricsParameters {
  type: string;
  limit?: number | string;
  offset?: number | string;
}

export interface PageviewExpandedMetricsData {
  name: string;
  pageviews: number;
  visitors: number;
  visits: number;
  bounces: number;
  totaltime: number;
}

export async function getPageviewExpandedMetrics(
  websiteId: string,
  parameters: PageviewExpandedMetricsParameters,
  filters: QueryFilters,
): Promise<PageviewExpandedMetricsData[]> {
  const { type, limit = 500, offset = 0 } = parameters;
  let column = getPageviewColumn(type);
  const { filterQuery, joinSessionQuery, cohortQuery, excludeBounceQuery, queryParams } =
    await parseFilters(
      {
        ...filters,
        websiteId,
      },
      { joinSession: SESSION_COLUMNS.includes(type) },
    );
  const fullPathSearchQuery =
    type === 'fullPath' && filters.search
      ? `and (case when website_event.url_query != '' then website_event.url_path || '?' || website_event.url_query else website_event.url_path end) like {{fullPathSearch}}`
      : '';

  let entryExitQuery = '';
  let excludeDomain = '';
  if (column === 'referrer_domain') {
    excludeDomain = `and website_event.referrer_domain != (case when substr(website_event.hostname, 1, 4) = 'www.' then substr(website_event.hostname, 5) else website_event.hostname end)
      and website_event.referrer_domain != ''`;
    if (type === 'domain') {
      column = getGroupedReferrerSQL(GROUPED_DOMAINS);
    }
  }

  if (type === 'entry' || type === 'exit') {
    const aggregrate = type === 'entry' ? 'min' : 'max';

    entryExitQuery = `
      join (
        select visit_id,
            ${aggregrate}(created_at) target_created_at
        from website_event
        where website_event.website_id = {{websiteId}}
          and website_event.created_at between {{startDate}} and {{endDate}}
          and website_event.event_type NOT IN (2, 5)
        group by visit_id
      ) x
      on x.visit_id = website_event.visit_id
          and x.target_created_at = website_event.created_at
    `;
  }

  const selectColumn =
    type === 'fullPath'
      ? `case when website_event.url_query != '' then website_event.url_path || '?' || website_event.url_query else website_event.url_path end`
      : column;

  const groupByColumn =
    type === 'fullPath'
      ? `case when website_event.url_query != '' then website_event.url_path || '?' || website_event.url_query else website_event.url_path end`
      : column;

  return rawQuery(
    `
    select
      name,
      sum(t.c) as "pageviews",
      count(distinct t.session_id) as "visitors",
      count(distinct t.visit_id) as "visits",
      0 as "bounces",
      0 as "totaltime"
    from (
      select
        ${selectColumn} as "name",
        website_event.session_id,
        website_event.visit_id,
        count(*) as "c"
      from website_event
      ${cohortQuery}
      ${excludeBounceQuery}
      ${joinSessionQuery}
      ${entryExitQuery}
      where website_event.website_id = {{websiteId}}
      and website_event.created_at between {{startDate}} and {{endDate}}
      and website_event.event_type NOT IN (2, 5)
        ${excludeDomain}
        ${fullPathSearchQuery}
        ${filterQuery}
      group by ${groupByColumn}, website_event.session_id, website_event.visit_id
    ) as t
    where name != ''
    group by name
    order by visitors desc, visits desc
    limit ${limit}
    offset ${offset}
    `,
    {
      ...queryParams,
      ...(type === 'fullPath' && filters.search ? { fullPathSearch: `%${filters.search}%` } : {}),
    },
  );
}

export function getGroupedReferrerSQL(domains: any[], column: string = 'referrer_domain'): string {
  return [
    'CASE',
    ...domains.map(group => {
      const matches = Array.isArray(group.match) ? group.match : [group.match];

      return `WHEN ${getContainsAnySQL(column, matches)} THEN '${group.domain}'`;
    }),
    "  ELSE 'Other'",
    'END',
  ].join('\n');
}

function getContainsAnySQL(column: string, arr: string[]) {
  return arr.map(val => `${column} like '%${val.replace(/'/g, "''")}%'`).join(' OR\n  ');
}

function getPageviewColumn(type: string) {
  if (type === 'fullPath') {
    return 'url_path';
  }

  return FILTER_COLUMNS[type] || type;
}
