import { parseFilters } from '@/db/filters';
import { rawQuery } from '@/db/query';
import type { QueryFilters } from '@/lib/types';

export interface WebsiteEventStatsData {
  events: number;
  visitors: number;
  visits: number;
  uniqueEvents: number;
}

export async function getWebsiteEventStats(
  websiteId: string,
  filters: QueryFilters,
): Promise<WebsiteEventStatsData[]> {
  const { filterQuery, joinSessionQuery, cohortQuery, queryParams } = await parseFilters({
    ...filters,
    websiteId,
  });

  return rawQuery(
    `
    select
      cast(count(*) as bigint) as "events",
      count(distinct website_event.session_id) as "visitors",
      count(distinct website_event.visit_id) as "visits",
      count(distinct website_event.event_name) as "uniqueEvents"
    from website_event
    ${cohortQuery}
    ${joinSessionQuery}
    where website_event.website_id = {{websiteId}}
      and website_event.created_at between {{startDate}} and {{endDate}}
      and website_event.event_type = 2
      ${filterQuery}
    `,
    queryParams,
  ).then(result => result?.[0]);
}
