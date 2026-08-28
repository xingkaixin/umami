import { parseFilters } from '@/db/filters';
import { rawQuery } from '@/db/query';
import type { QueryFilters } from '@/lib/types';

export interface WebsiteEventData {
  eventName?: string;
  propertyName: string;
  dataType: number;
  propertyValue?: string;
  total: number;
}

export async function getEventDataEvents(websiteId: string, filters: QueryFilters) {
  const { event } = filters;
  const { filterQuery, cohortQuery, joinSessionQuery, queryParams } = await parseFilters({
    ...filters,
    websiteId,
  });

  if (event) {
    return rawQuery(
      `
      select
        website_event.event_name as "eventName",
        event_data.data_key as "propertyName",
        event_data.data_type as "dataType",
        event_data.string_value as "propertyValue",
        count(*) as "total"
      from event_data
      inner join website_event
        on website_event.event_id = event_data.website_event_id
      ${cohortQuery}
      ${joinSessionQuery}
      where event_data.website_id = {{websiteId}}
        and event_data.created_at between {{startDate}} and {{endDate}}
      ${filterQuery}
      group by website_event.event_name, event_data.data_key, event_data.data_type, event_data.string_value
      order by 1 asc, 2 asc, 3 asc, 5 desc
      `,
      queryParams,
    );
  }

  return rawQuery(
    `
    select
      website_event.event_name as "eventName",
      event_data.data_key as "propertyName",
      event_data.data_type as "dataType",
      count(*) as "total"
    from event_data
    inner join website_event
      on website_event.event_id = event_data.website_event_id
    ${cohortQuery}
    ${joinSessionQuery}
    where event_data.website_id = {{websiteId}}
      and event_data.created_at between {{startDate}} and {{endDate}}
    ${filterQuery}
    group by website_event.event_name, event_data.data_key, event_data.data_type
    order by 1 asc, 2 asc
    limit 500
    `,
    queryParams,
  );
}
