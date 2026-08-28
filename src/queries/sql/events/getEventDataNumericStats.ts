import { getPropertyFilterQuery, parseFilters } from '@/db/filters';
import { rawQuery } from '@/db/query';
import { percentileSQL, rankedQuery } from '@/db/stats';
import type { EventDataNumericStats, EventPropertyFilter, QueryFilters } from '@/lib/types';

export async function getEventDataNumericStats(
  websiteId: string,
  eventName: string,
  propertyName: string,
  filters: QueryFilters,
  eventFilters: EventPropertyFilter[] = [],
): Promise<EventDataNumericStats> {
  const { timezone = 'utc' } = filters;
  const { filterQuery, cohortQuery, joinSessionQuery, queryParams } = await parseFilters({
    ...filters,
    websiteId,
    timezone,
  });
  const { sql: pfSQL, params: pfParams } = await getPropertyFilterQuery(
    eventFilters,
    'event',
    timezone,
    queryParams,
  );

  return rawQuery(
    `${rankedQuery(
      `    select cast(event_data.number_value as real) as value
    from event_data
    join website_event on website_event.event_id = event_data.website_event_id
      and website_event.website_id = {{websiteId}}
      and website_event.created_at between {{startDate}} and {{endDate}}
      and website_event.event_type = 2
      and website_event.event_name = {{eventName}}
    ${cohortQuery}
    ${joinSessionQuery}
    where event_data.website_id = {{websiteId}}
      and event_data.created_at between {{startDate}} and {{endDate}}
      and event_data.data_key = {{propertyName}}
      and event_data.data_type = 2
      ${filterQuery}
      ${pfSQL}`,
      ['value'],
    )}
    select coalesce(sum(value), 0) as total, coalesce(avg(value), 0) as average,
      coalesce(${percentileSQL('value', 0.5)}, 0) as median,
      coalesce(max(value), 0) as max, coalesce(min(value), 0) as min
    from ranked`,
    { ...queryParams, eventName, propertyName, ...pfParams },
  ).then(results => results?.[0]);
}
