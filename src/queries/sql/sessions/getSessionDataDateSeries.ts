import { getUTCDateStringSQL, localizeDateSeries } from '@/db/dates';
import { getPropertyFilterQuery, parseFilters } from '@/db/filters';
import { rawQuery } from '@/db/query';
import { DATA_TYPE, EVENT_TYPE } from '@/lib/constants';
import type { EventDataDateSeriesPoint, PropertyFilter, QueryFilters } from '@/lib/types';

export async function getSessionDataDateSeries(
  websiteId: string,
  propertyName: string,
  filters: QueryFilters,
  propertyFilters: PropertyFilter[] = [],
): Promise<EventDataDateSeriesPoint[]> {
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

  const rows = await rawQuery(
    `
    select
      ${getUTCDateStringSQL('session_data.date_value')} as t,
      count(distinct session_data.session_id) as y
    from website_event
    ${cohortQuery}
    ${joinSessionQuery}
    join session_data
      on session_data.session_id = website_event.session_id
        and session_data.website_id = website_event.website_id
    where website_event.website_id = {{websiteId}}
      and website_event.created_at between {{startDate}} and {{endDate}}
      and website_event.event_type != ${EVENT_TYPE.performance}
      and session_data.data_key = {{propertyName}}
      and session_data.data_type = ${DATA_TYPE.date}
      ${filterQuery}
      ${pfSQL}
    group by 1
    order by 1
    `,
    { ...queryParams, propertyName, ...pfParams },
  );
  return localizeDateSeries(rows, timezone);
}
