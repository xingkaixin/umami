import { getPropertyFilterQuery, parseFilters } from '@/db/filters';
import { rawQuery } from '@/db/query';
import { EVENT_TYPE } from '@/lib/constants';
import type { PropertyFilter, QueryFilters } from '@/lib/types';

export async function getSessionDataProperties(
  websiteId: string,
  filters: QueryFilters,
  propertyFilters: PropertyFilter[] = [],
  propertyName?: string,
) {
  const { timezone = 'utc' } = filters;
  const { filterQuery, joinSessionQuery, cohortQuery, queryParams } = await parseFilters({
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
    ),
    selected_property_sessions as (
      select distinct session_data.session_id, session_data.website_id
      from session_data
      join filtered_sessions
        on filtered_sessions.session_id = session_data.session_id
        and filtered_sessions.website_id = session_data.website_id
      ${propertyName ? 'where session_data.data_key = {{propertyName}}' : ''}
    )
    select
        data_key as "propertyName",
        data_type as "dataType",
        count(distinct session_data.session_id) as "total"
    from selected_property_sessions
    join session_data 
        on session_data.session_id = selected_property_sessions.session_id
          and session_data.website_id = selected_property_sessions.website_id
    group by 1, 2
    order by 3 desc, 1 asc
    limit 500
    `,
    { ...queryParams, websiteId, propertyName, ...pfParams },
  );
}
