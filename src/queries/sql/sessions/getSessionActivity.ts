import { rawQuery } from '@/db/query';
import { EVENT_TYPE } from '@/lib/constants';
import type { QueryFilters } from '@/lib/types';

export async function getSessionActivity(
  websiteId: string,
  sessionIds: string[],
  filters: QueryFilters,
) {
  const { startDate, endDate } = filters;

  return rawQuery(
    `
    select
      created_at as "createdAt",
      url_path as "urlPath",
      url_query as "urlQuery",
      referrer_domain as "referrerDomain",
      event_id as "eventId",
      event_type as "eventType",
      event_name as "eventName",
      visit_id as "visitId",
      hostname,
      event_id IN (select website_event_id 
                   from event_data
                   where website_id = {{websiteId}}
                      and created_at between {{startDate}} and {{endDate}}) AS "hasData"
    from website_event
    where website_id = {{websiteId}}
      and session_id in (select value from json_each({{sessionIds}}))
      and event_type != ${EVENT_TYPE.performance}
      and created_at between {{startDate}} and {{endDate}}
    order by created_at desc
    limit 500
    `,
    { websiteId, sessionIds, startDate, endDate },
  );
}
