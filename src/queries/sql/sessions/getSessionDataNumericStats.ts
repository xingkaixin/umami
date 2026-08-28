import { getPropertyFilterQuery, parseFilters } from '@/db/filters';
import { rawQuery } from '@/db/query';
import { percentileSQL, rankedQuery } from '@/db/stats';
import { EVENT_TYPE } from '@/lib/constants';
import type { EventDataNumericStats, PropertyFilter, QueryFilters } from '@/lib/types';

export async function getSessionDataNumericStats(
  websiteId: string,
  propertyName: string,
  filters: QueryFilters,
  propertyFilters: PropertyFilter[] = [],
): Promise<EventDataNumericStats> {
  const { timezone = 'utc' } = filters;
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

  return rawQuery(
    `${rankedQuery(
      `    with filtered_sessions as (
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
    select cast(session_data.number_value as real) as value
    from session_data
    join filtered_sessions
      on filtered_sessions.session_id = session_data.session_id
        and filtered_sessions.website_id = session_data.website_id
    where session_data.website_id = {{websiteId}}
      and session_data.data_key = {{propertyName}}
      and session_data.data_type = 2`,
      ['value'],
    )}
    select coalesce(sum(value), 0) as total, coalesce(avg(value), 0) as average,
      coalesce(${percentileSQL('value', 0.5)}, 0) as median,
      coalesce(max(value), 0) as max, coalesce(min(value), 0) as min
    from ranked`,
    { ...queryParams, propertyName, ...pfParams },
  ).then(results => results?.[0]);
}
