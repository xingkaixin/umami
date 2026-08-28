import { parseFilters } from '@/db/filters';
import { rawQuery } from '@/db/query';
import { FILTER_COLUMNS, SESSION_COLUMNS } from '@/lib/constants';
import type { QueryFilters } from '@/lib/types';

export interface PageviewMetricsParameters {
  type: string;
  limit?: number | string;
  offset?: number | string;
}

export interface PageviewMetricsData {
  x: string;
  y: number;
}

export async function getPageviewMetrics(
  websiteId: string,
  parameters: PageviewMetricsParameters,
  filters: QueryFilters,
): Promise<PageviewMetricsData[]> {
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
  }

  if (type === 'entry' || type === 'exit') {
    const order = type === 'entry' ? 'asc' : 'desc';

    entryExitQuery = `
      join (
        select visit_id, url_path, url_query from (
        select row_number() over (partition by visit_id order by created_at ${order}, event_id ${order}) as row_num,
          visit_id,
          url_path,
          url_query
        from website_event
        where website_event.website_id = {{websiteId}}
          and website_event.created_at between {{startDate}} and {{endDate}}
          and website_event.event_type NOT IN (2, 5)
        ) ranked where row_num = 1
      ) x
      on x.visit_id = website_event.visit_id
    `;

    column = `x.${FILTER_COLUMNS[type] || type}`;
  }

  const selectColumn =
    type === 'fullPath'
      ? `case when website_event.url_query != '' then website_event.url_path || '?' || website_event.url_query else website_event.url_path end`
      : column;

  return rawQuery(
    `
    select ${selectColumn} x,
      count(distinct website_event.session_id) as y
    from website_event
    ${cohortQuery}
    ${excludeBounceQuery}
    ${joinSessionQuery}
    ${entryExitQuery}
    where website_event.website_id = {{websiteId}}
      and website_event.created_at between {{startDate}} and {{endDate}}
      and website_event.event_type NOT IN (2, 5)
      and ${column} != ''
      ${excludeDomain}
      ${fullPathSearchQuery}
      ${filterQuery}
    group by 1
    order by 2 desc
    limit ${limit}
    offset ${offset}
    `,
    {
      ...queryParams,
      ...parameters,
      ...(type === 'fullPath' && filters.search ? { fullPathSearch: `%${filters.search}%` } : {}),
    },
  );
}

function getPageviewColumn(type: string) {
  if (type === 'fullPath') {
    return 'url_path';
  }

  return FILTER_COLUMNS[type] || type;
}
