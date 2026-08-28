import { parseFilters } from '@/db/filters';
import { rawQuery } from '@/db/query';
import type { QueryFilters } from '@/lib/types';

export async function getEventDataProperties(
  websiteId: string,
  filters: QueryFilters & { propertyName?: string },
) {
  const { filterQuery, cohortQuery, joinSessionQuery, queryParams } = await parseFilters(
    { ...filters, websiteId },
    {
      columns: { propertyName: 'data_key' },
    },
  );

  return rawQuery(
    `
    select
      website_event.event_name as "eventName",
      event_data.data_key as "propertyName",
      event_data.data_type as "dataType",
      count(*) as "total"
    from event_data 
    join website_event on website_event.event_id = event_data.website_event_id
      and website_event.website_id = {{websiteId}}
      and website_event.created_at between {{startDate}} and {{endDate}}
    ${cohortQuery}
    ${joinSessionQuery}
    where event_data.website_id = {{websiteId}}
      and event_data.created_at between {{startDate}} and {{endDate}}
    ${filterQuery}
    group by website_event.event_name, event_data.data_key, event_data.data_type
    order by 4 desc
    limit 500
    `,
    queryParams,
  );
}
