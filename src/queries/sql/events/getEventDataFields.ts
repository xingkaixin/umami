import { parseFilters } from '@/db/filters';
import { rawQuery } from '@/db/query';
import type { QueryFilters } from '@/lib/types';

export async function getEventDataFields(
  websiteId: string,
  eventName: string | undefined,
  filters: QueryFilters,
) {
  const { filterQuery, cohortQuery, joinSessionQuery, queryParams } = await parseFilters({
    ...filters,
    websiteId,
  });
  const eventNameFilter = eventName ? 'and website_event.event_name = {{eventName}}' : '';

  return rawQuery(
    `
    select
      data_key as "propertyName",
      data_type as "dataType",
      count(*) as "total"
    from event_data
    join website_event on website_event.event_id = event_data.website_event_id
      and website_event.website_id = {{websiteId}}
      and website_event.created_at between {{startDate}} and {{endDate}}
      ${eventNameFilter}
    ${cohortQuery}
    ${joinSessionQuery}
    where event_data.website_id = {{websiteId}}
      and event_data.created_at between {{startDate}} and {{endDate}}
    ${filterQuery}
    group by data_key, data_type
    order by "total" desc, "propertyName" asc
    `,
    { ...queryParams, eventName },
  );
}
