import { parseFilters } from '@/db/filters';
import { rawQuery } from '@/db/query';
import { EVENT_TYPE } from '@/lib/constants';
import type { QueryFilters } from '@/lib/types';

export async function getRealtimeActivity(websiteId: string, filters: QueryFilters) {
  const { queryParams, filterQuery, cohortQuery, dateQuery } = await parseFilters({
    ...filters,
    websiteId,
  });

  return rawQuery(
    `
    select
        website_event.session_id as "sessionId",
        website_event.event_name as "eventName",
        website_event.created_at as "createdAt",
        session.browser,
        session.os,
        session.device,
        session.country,
        website_event.url_path as "urlPath",
        website_event.referrer_domain as "referrerDomain",
        website_event.hostname
    from website_event
    ${cohortQuery}
    inner join session
      on session.session_id = website_event.session_id
        and session.website_id = website_event.website_id
    where website_event.website_id = {{websiteId}}
      and website_event.event_type != ${EVENT_TYPE.performance}
    ${filterQuery}
    ${dateQuery}
    order by website_event.created_at desc
    limit 100
    `,
    queryParams,
  );
}
