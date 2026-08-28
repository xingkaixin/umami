import { parseFilters } from '@/db/filters';
import { rawQuery } from '@/db/query';
import { DEFAULT_PAGE_SIZE } from '@/lib/constants';
import type { QueryFilters } from '@/lib/types';

export async function getEventData(websiteId: string, filters: QueryFilters) {
  const { page = 1, pageSize } = filters;
  const size = +pageSize || DEFAULT_PAGE_SIZE;
  const offset = +size * (+page - 1);

  const { filterQuery, cohortQuery, joinSessionQuery, queryParams } = await parseFilters({
    ...filters,
    websiteId,
  });

  // Selects distinct event IDs matching all filters — reused for count and paged data
  const eventQuery = `
    select website_event.event_id
    from website_event
    join event_data on event_data.website_event_id = website_event.event_id
      and event_data.website_id = {{websiteId}}
      and event_data.created_at between {{startDate}} and {{endDate}}
    ${cohortQuery}
    ${joinSessionQuery}
    where website_event.website_id = {{websiteId}}
      and website_event.created_at between {{startDate}} and {{endDate}}
      ${filterQuery}
    group by website_event.event_id
  `;

  const count = await rawQuery(`select count(*) as num from (${eventQuery}) t`, queryParams).then(
    (res: any) => res[0].num,
  );

  const data = await rawQuery(
    `
    with paged_events as (
      ${eventQuery}
      order by max(website_event.created_at) desc
      limit ${size} offset ${offset}
    )
    select
      event_data.website_id as "websiteId",
      event_data.website_event_id as "eventId",
      website_event.event_name as "eventName",
      event_data.data_key as "dataKey",
      event_data.string_value as "stringValue",
      event_data.number_value as "numberValue",
      event_data.date_value as "dateValue",
      event_data.data_type as "dataType",
      event_data.created_at as "createdAt"
    from event_data
    join website_event on website_event.event_id = event_data.website_event_id
      and website_event.website_id = {{websiteId}}
      and website_event.created_at between {{startDate}} and {{endDate}}
    join paged_events on paged_events.event_id = event_data.website_event_id
    where event_data.website_id = {{websiteId}}
      and event_data.created_at between {{startDate}} and {{endDate}}
    order by event_data.created_at desc
    `,
    queryParams,
  );

  return { data, count, page: +page, pageSize: size };
}
