import { parseFilters } from '@/db/filters';
import { pagedRawQuery } from '@/db/query';
import { EVENT_TYPE } from '@/lib/constants';
import type { QueryFilters } from '@/lib/types';

export async function getWebsiteSessions(websiteId: string, filters: QueryFilters) {
  const { search } = filters;
  const { filterQuery, dateQuery, cohortQuery, queryParams } = await parseFilters({
    ...filters,
    websiteId,
    search: search ? `%${search}%` : undefined,
  });

  const searchQuery = search
    ? `and (distinct_id like {{search}}
           or city like {{search}}
           or browser like {{search}}
           or os like {{search}}
           or device like {{search}})`
    : '';

  return pagedRawQuery(
    `
    select
      session.session_id as "id",
      session.website_id as "websiteId",
      website_event.hostname,
      session.browser,
      session.os,
      session.device,
      session.screen,
      session.language,
      session.country,
      session.region,
      session.city,
      min(website_event.created_at) as "firstAt",
      max(website_event.created_at) as "lastAt",
      count(distinct website_event.visit_id) as "visits",
      sum(case when website_event.event_type = ${EVENT_TYPE.pageView} then 1 else 0 end) as "views",
      sum(case when website_event.event_type = ${EVENT_TYPE.customEvent} then 1 else 0 end) as "events",
      max(website_event.created_at) as "createdAt"
    from website_event 
    ${cohortQuery}
    join session on session.session_id = website_event.session_id
      and session.website_id = website_event.website_id
    where website_event.website_id = {{websiteId}}
      and website_event.event_type != ${EVENT_TYPE.performance}
    ${dateQuery}
    ${filterQuery}
    ${searchQuery}
    group by session.session_id, 
      session.website_id, 
      website_event.hostname, 
      session.browser, 
      session.os, 
      session.device, 
      session.screen, 
      session.language, 
      session.country, 
      session.region, 
      session.city
    order by max(website_event.created_at) desc
    `,
    queryParams,
    filters,
  );
}
