import { getDateSQL } from '@/db/dates';
import { getPropertyFilterQuery, parseFilters } from '@/db/filters';
import { rawQuery } from '@/db/query';
import { DATA_TYPE, EVENT_TYPE } from '@/lib/constants';
import type { EventDataSeriesPoint, PropertyFilter, QueryFilters } from '@/lib/types';
import { getSessionDataDateRange } from './getSessionDataDateRange';

export async function getSessionDataArraySeries(
  websiteId: string,
  propertyName: string,
  filters: QueryFilters,
  propertyFilters: PropertyFilter[] = [],
): Promise<EventDataSeriesPoint[]> {
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

  const propertyDates =
    timezone.toLowerCase() === 'utc'
      ? queryParams
      : ((await getSessionDataDateRange(websiteId)) ?? queryParams);

  return rawQuery(
    `
    select
      array_item.value as x,
      ${getDateSQL('session_data.created_at', unit, timezone, propertyDates)} as t,
      count(distinct session_data.session_id) as y
    from website_event
    ${cohortQuery}
    ${joinSessionQuery}
    join session_data
      on session_data.session_id = website_event.session_id
        and session_data.website_id = website_event.website_id
    cross join json_each(coalesce(session_data.string_value, '[]')) as array_item
    where website_event.website_id = {{websiteId}}
      and website_event.created_at between {{startDate}} and {{endDate}}
      and website_event.event_type != ${EVENT_TYPE.performance}
      and session_data.data_key = {{propertyName}}
      and session_data.data_type = ${DATA_TYPE.array}
      ${filterQuery}
      ${pfSQL}
    group by 1, 2
    order by 2
    `,
    { ...queryParams, propertyName, ...pfParams },
  );
}
