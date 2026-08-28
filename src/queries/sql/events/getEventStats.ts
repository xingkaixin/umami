import { getDateSQL } from '@/db/dates';
import { parseFilters } from '@/db/filters';
import { rawQuery } from '@/db/query';
import type { QueryFilters } from '@/lib/types';

export interface EventStatsParameters {
  limit?: number | string;
}

export async function getEventStats(
  websiteId: string,
  parameters: EventStatsParameters,
  filters: QueryFilters,
) {
  const { limit } = parameters;
  const { timezone = 'utc', unit = 'day' } = filters;
  const { filterQuery, cohortQuery, joinSessionQuery, queryParams } = await parseFilters({
    ...filters,
    websiteId,
  });

  const limitQuery = limit
    ? `and event_name in (
    select event_name
    from website_event
    where website_id = {{websiteId}}
      and created_at between {{startDate}} and {{endDate}}
      and event_type = 2
    group by event_name
    order by count(*) desc
    limit ${limit}
  )`
    : '';

  return rawQuery(
    `
    select
      event_name x,
      ${getDateSQL('website_event.created_at', unit, timezone, queryParams)} t,
      count(*) y
    from website_event
    ${cohortQuery}
    ${joinSessionQuery}
    where website_event.website_id = {{websiteId}}
      and website_event.created_at between {{startDate}} and {{endDate}}
      and website_event.event_type = 2
      ${filterQuery}
      ${limitQuery}
    group by 1, 2
    order by 2
    `,
    queryParams,
  );
}
