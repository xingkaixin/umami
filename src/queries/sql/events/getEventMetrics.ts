import { parseFilters } from '@/db/filters';
import { rawQuery } from '@/db/query';
import { EVENT_TYPE, FILTER_COLUMNS, SESSION_COLUMNS } from '@/lib/constants';
import type { QueryFilters } from '@/lib/types';

export interface EventMetricParameters {
  type: string;
  limit?: string;
  offset?: string;
}

export interface EventMetricData {
  x: string;
  t: string;
  y: number;
}

export async function getEventMetrics(
  websiteId: string,
  parameters: EventMetricParameters,
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
    select ${column} x,
      count(*) as y
    from website_event
    ${cohortQuery}
    ${joinSessionQuery}
    where website_event.website_id = {{websiteId}}
      and website_event.created_at between {{startDate}} and {{endDate}}
      ${filterQuery}
    group by 1
    order by 2 desc
    limit ${limit}
    offset ${offset}
    `,
    { ...queryParams, ...parameters },
  );
}
