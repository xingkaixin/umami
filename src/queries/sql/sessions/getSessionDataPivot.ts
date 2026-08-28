import { getUTCDateStringSQL } from '@/db/dates';
import { getPropertyFilterQuery, parseFilters } from '@/db/filters';
import { readPropertyRows } from '@/db/properties';
import { pagedRawQuery } from '@/db/query';
import { EVENT_TYPE } from '@/lib/constants';
import type { PropertyFilter, QueryFilters } from '@/lib/types';

export async function getSessionDataPivot(
  websiteId: string,
  propertyName: string,
  filters: QueryFilters,
  propertyFilters: PropertyFilter[] = [],
) {
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

  const page = await pagedRawQuery(
    `
    with filtered_sessions as (
      select distinct website_event.session_id
      from website_event
      ${cohortQuery}
      ${joinSessionQuery}
      where website_event.website_id = {{websiteId}}
        and website_event.created_at between {{startDate}} and {{endDate}}
        and website_event.event_type != ${EVENT_TYPE.performance}
        ${filterQuery}
        ${pfSQL}
    ),
    latest_session_properties as (
      select
        ranked.session_id,
        ranked.distinct_id,
        ranked.created_at,
        ranked.data_key,
        ranked.data_type,
        ranked.string_value,
        ranked.number_value,
        ranked.date_value
      from (
        select
          session_data.session_id,
          session_data.distinct_id,
          session_data.created_at,
          session_data.data_key,
          session_data.data_type,
          session_data.string_value,
          session_data.number_value,
          session_data.date_value,
          row_number() over (
            partition by session_data.session_id, session_data.data_key
            order by session_data.created_at desc, session_data.session_data_id desc
          ) as row_num
        from session_data
        join filtered_sessions
          on filtered_sessions.session_id = session_data.session_id
        where session_data.website_id = {{websiteId}}
      ) ranked
      where ranked.row_num = 1
    ),
    paged_sessions as (
      select
        latest_session_properties.session_id,
        latest_session_properties.created_at as sort_created_at
      from latest_session_properties
      where latest_session_properties.data_key = {{propertyName}}
    )
    select
      latest_session_properties.session_id as "sessionId",
      coalesce(max(latest_session_properties.distinct_id), '') as "distinctId",
      max(latest_session_properties.created_at) as "createdAt",
      json_group_array(latest_session_properties.data_key order by latest_session_properties.data_key asc) as "propertyKeys",
      json_group_array(
        json_object('type', latest_session_properties.data_type, 'value', coalesce(
          case when latest_session_properties.data_type = 1 then latest_session_properties.string_value end,
          case when latest_session_properties.data_type = 2 then cast(latest_session_properties.number_value as varchar) end,
          case when latest_session_properties.data_type = 3 then latest_session_properties.string_value end,
          case when latest_session_properties.data_type = 4 then ${getUTCDateStringSQL('latest_session_properties.date_value')} end,
          case when latest_session_properties.data_type = 5 then latest_session_properties.string_value end,
          ''
        )
        ) order by latest_session_properties.data_key asc
      ) as "propertyValues"
    from latest_session_properties
    join paged_sessions
      on paged_sessions.session_id = latest_session_properties.session_id
    group by latest_session_properties.session_id, paged_sessions.sort_created_at
    order by paged_sessions.sort_created_at desc
    `,
    { ...queryParams, websiteId, propertyName, ...pfParams },
    filters,
  );
  return { ...page, data: readPropertyRows(page.data, timezone) };
}
