import { getUTCDateStringSQL, localizeDateSeries } from '@/db/dates';
import { getPropertyFilterQuery, parseFilters } from '@/db/filters';
import { rawQuery } from '@/db/query';
import { DATA_TYPE } from '@/lib/constants';
import type { EventDataDateSeriesPoint, EventPropertyFilter, QueryFilters } from '@/lib/types';

export async function getEventDataDateSeries(
  websiteId: string,
  eventName: string,
  propertyName: string,
  filters: QueryFilters,
  eventFilters: EventPropertyFilter[] = [],
): Promise<EventDataDateSeriesPoint[]> {
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

  const rows = await rawQuery(
    `
    select
      ${getUTCDateStringSQL('event_data.date_value')} as t,
      count(*) as y
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
      and event_data.data_type = ${DATA_TYPE.date}
      ${filterQuery}
      ${pfSQL}
    group by 1
    order by 1
    `,
    { ...queryParams, eventName, propertyName, ...pfParams },
  );
  return localizeDateSeries(rows, timezone);
}
