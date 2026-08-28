import { parseFilters } from '@/db/filters';
import { rawQuery } from '@/db/query';
import { EVENT_TYPE } from '@/lib/constants';
import type { QueryFilters } from '@/lib/types';

export interface WebsiteSessionStatsData {
  pageviews: number;
  visitors: number;
  visits: number;
  countries: number;
  events: number;
}

export async function getWebsiteSessionStats(
  websiteId: string,
  filters: QueryFilters,
): Promise<WebsiteSessionStatsData[]> {
  const { filterQuery, cohortQuery, queryParams } = await parseFilters({
    ...filters,
    websiteId,
  });

  return rawQuery(
    `
    select
      sum(case when website_event.event_type = ${EVENT_TYPE.pageView} then 1 else 0 end) as "pageviews",
      count(distinct website_event.session_id) as "visitors",
      count(distinct website_event.visit_id) as "visits",
      count(distinct session.country) as "countries",
      sum(case when website_event.event_type = ${EVENT_TYPE.customEvent} then 1 else 0 end) as "events"
    from website_event
    ${cohortQuery}
    join session on website_event.session_id = session.session_id
      and website_event.website_id = session.website_id
    where website_event.website_id = {{websiteId}}
      and website_event.created_at between {{startDate}} and {{endDate}}
      and website_event.event_type != ${EVENT_TYPE.performance}
      ${filterQuery}
    `,
    queryParams,
  );
}
