import { getUTCDateStringSQL } from '@/db/dates';
import { getPropertyFilterQuery, parseFilters } from '@/db/filters';
import { readPropertyRows } from '@/db/properties';
import { pagedRawQuery } from '@/db/query';
import type { EventPropertyFilter, QueryFilters } from '@/lib/types';

export async function getEventDataPivot(
  websiteId: string,
  eventName: string,
  filters: QueryFilters,
  eventFilters: EventPropertyFilter[] = [],
) {
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

  const page = await pagedRawQuery(
    `
    with paged_events as (
      select website_event.event_id, max(website_event.created_at) as sort_created_at
      from website_event
      join event_data on event_data.website_event_id = website_event.event_id
        and event_data.website_id = {{websiteId}}
        and event_data.created_at between {{startDate}} and {{endDate}}
      ${cohortQuery}
      ${joinSessionQuery}
      where website_event.website_id = {{websiteId}}
        and website_event.created_at between {{startDate}} and {{endDate}}
        and website_event.event_name = {{eventName}}
        ${filterQuery}
        ${pfSQL}
      group by website_event.event_id
    )
    select
      website_event.event_id as "eventId",
      website_event.session_id as "sessionId",
      website_event.event_name as "eventName",
      website_event.url_path as "urlPath",
      max(website_event.created_at) as "createdAt",
      json_group_array(event_data.data_key order by event_data.data_key asc) as "propertyKeys",
      json_group_array(
        json_object('type', event_data.data_type, 'value', coalesce(
          case when event_data.data_type = 1 then event_data.string_value end,
          case when event_data.data_type = 2 then cast(event_data.number_value as varchar) end,
          case when event_data.data_type = 3 then event_data.string_value end,
          case when event_data.data_type = 4 then ${getUTCDateStringSQL('event_data.date_value')} end,
          case when event_data.data_type = 5 then event_data.string_value end,
          ''
        )
        ) order by event_data.data_key asc
      ) as "propertyValues"
    from event_data
    join website_event on website_event.event_id = event_data.website_event_id
      and website_event.website_id = {{websiteId}}
    join paged_events on paged_events.event_id = event_data.website_event_id
    where event_data.website_id = {{websiteId}}
      and event_data.created_at between {{startDate}} and {{endDate}}
    group by
      website_event.event_id,
      website_event.session_id,
      website_event.event_name,
      website_event.url_path,
      paged_events.sort_created_at
    order by paged_events.sort_created_at desc
    `,
    { ...queryParams, eventName, ...pfParams },
    filters,
  );
  return { ...page, data: readPropertyRows(page.data, timezone) };
}
