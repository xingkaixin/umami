import { getDateSQL } from '@/db/dates';
import { getPropertyFilterQuery, parseFilters } from '@/db/filters';
import { rawQuery } from '@/db/query';
import { DATA_TYPE } from '@/lib/constants';
import type { EventDataSeriesPoint, EventPropertyFilter, QueryFilters } from '@/lib/types';

export async function getEventDataArraySeries(
  websiteId: string,
  eventName: string,
  propertyName: string,
  filters: QueryFilters,
  eventFilters: EventPropertyFilter[] = [],
): Promise<EventDataSeriesPoint[]> {
  const { timezone = 'utc', unit = 'day' } = filters;
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
    `
    select
      array_item.value as x,
      ${getDateSQL('event_data.created_at', unit, timezone, queryParams)} as t,
      count(*) as y
    from event_data
    join website_event on website_event.event_id = event_data.website_event_id
      and website_event.website_id = {{websiteId}}
      and website_event.created_at between {{startDate}} and {{endDate}}
      and website_event.event_type = 2
      and website_event.event_name = {{eventName}}
    cross join json_each(coalesce(event_data.string_value, '[]')) as array_item
    ${cohortQuery}
    ${joinSessionQuery}
    where event_data.website_id = {{websiteId}}
      and event_data.created_at between {{startDate}} and {{endDate}}
      and event_data.data_key = {{propertyName}}
      and event_data.data_type = ${DATA_TYPE.array}
      ${filterQuery}
      ${pfSQL}
    group by 1, 2
    order by 2
    `,
    { ...queryParams, eventName, propertyName, ...pfParams },
  );
}
