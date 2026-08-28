import { getDateSQL } from '@/db/dates';
import { getPropertyFilterQuery, parseFilters } from '@/db/filters';
import { rawQuery } from '@/db/query';
import { EVENT_TYPE } from '@/lib/constants';
import type { PropertyFilter, QueryFilters } from '@/lib/types';
import { getSessionDataDateRange } from './getSessionDataDateRange';

export async function getSessionDataNumericSeries(
  websiteId: string,
  propertyName: string,
  metric: 'sum' | 'avg' | 'count',
  filters: QueryFilters,
  propertyFilters: PropertyFilter[] = [],
) {
  const { timezone = 'utc', unit = 'day' } = filters;
  const { filterQuery, cohortQuery, joinSessionQuery, queryParams } = await parseFilters({
    ...filters,
    websiteId,
    timezone,
  });
  const { sql: pfSQL, params: pfParams } = await getPropertyFilterQuery(
    propertyFilters,
    'session',
    timezone,
    queryParams,
  );
  const aggSql =
    metric === 'avg'
      ? 'avg(cast(session_data.number_value as decimal))'
      : metric === 'count'
        ? 'count(distinct session_data.session_id)'
        : 'sum(cast(session_data.number_value as decimal))';

  const propertyDates =
    timezone.toLowerCase() === 'utc'
      ? queryParams
      : ((await getSessionDataDateRange(websiteId)) ?? queryParams);

  return rawQuery(
    `
    with filtered_sessions as (
      select distinct website_event.session_id, website_event.website_id
      from website_event
      ${cohortQuery}
      ${joinSessionQuery}
      where website_event.website_id = {{websiteId}}
        and website_event.created_at between {{startDate}} and {{endDate}}
        and website_event.event_type != ${EVENT_TYPE.performance}
        ${filterQuery}
        ${pfSQL}
    )
    select
      ${getDateSQL('session_data.created_at', unit, timezone, propertyDates)} t,
      ${aggSql} y
    from session_data
    join filtered_sessions
      on filtered_sessions.session_id = session_data.session_id
        and filtered_sessions.website_id = session_data.website_id
    where session_data.website_id = {{websiteId}}
      and session_data.data_key = {{propertyName}}
      and session_data.data_type = 2
    group by 1
    order by 1
    `,
    { ...queryParams, propertyName, ...pfParams },
  );
}
