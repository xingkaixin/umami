import { parseFilters } from '@/db/filters';
import { rawQuery } from '@/db/query';
import type { QueryFilters } from '@/lib/types';

export async function getEventDataStats(websiteId: string, filters: QueryFilters) {
  const { filterQuery, joinSessionQuery, cohortQuery, queryParams } = await parseFilters({
    ...filters,
    websiteId,
  });

  return rawQuery(
    `
    select 
      count(distinct t.website_event_id) as "events",
      count(distinct t.data_key) as "properties",
      sum(t.total) as "records"
    from (
      select
        website_event_id,
        data_key,
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
      group by website_event_id, data_key
      ) as t
    `,
    queryParams,
  ).then(results => results?.[0]);
}
