import { getTimestampDiffSQL } from '@/db/dates';
import { parseFilters } from '@/db/filters';
import { rawQuery } from '@/db/query';
import { EVENT_TYPE, FILTER_COLUMNS, SESSION_COLUMNS } from '@/lib/constants';
import type { QueryFilters } from '@/lib/types';

export interface EventExpandedMetricParameters {
  type: string;
  limit?: string;
  offset?: string;
}

export interface EventExpandedMetricData {
  name: string;
  pageviews: number;
  visitors: number;
  visits: number;
  bounces: number;
  totaltime: number;
}

export async function getEventExpandedMetrics(
  websiteId: string,
  parameters: EventExpandedMetricParameters,
  filters: QueryFilters,
) {
  const { type, limit = 500, offset = 0 } = parameters;
  const column = FILTER_COLUMNS[type] || type;
  const { filterQuery, cohortQuery, joinSessionQuery, queryParams } = await parseFilters(
    {
      ...filters,
      websiteId,
      eventType: EVENT_TYPE.customEvent,
    },
    { joinSession: SESSION_COLUMNS.includes(type) },
  );

  return rawQuery(
    `
    select
      name,
      sum(t.c) as "pageviews",
      count(distinct t.session_id) as "visitors",
      count(distinct t.visit_id) as "visits",
      sum(case when t.c = 1 then 1 else 0 end) as "bounces",
      sum(${getTimestampDiffSQL('t.min_time', 't.max_time')}) as "totaltime"
    from (
      select
        ${column} as "name",
        website_event.session_id,
        website_event.visit_id,
        count(*) as "c",
        min(website_event.created_at) as "min_time",
        max(website_event.created_at) as "max_time"
      from website_event
      ${cohortQuery}
      ${joinSessionQuery}  
      where website_event.website_id = {{websiteId}}
        and website_event.created_at between {{startDate}} and {{endDate}}
        ${filterQuery}
      group by name, website_event.session_id, website_event.visit_id
    ) as t
    where name != ''
    group by name 
    order by visitors desc, visits desc
    limit ${limit}
    offset ${offset}
    `,
    queryParams,
  );
}
