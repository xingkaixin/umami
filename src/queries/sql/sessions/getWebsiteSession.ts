import { getTimestampDiffSQL } from '@/db/dates';
import { rawQuery } from '@/db/query';
import { EVENT_TYPE } from '@/lib/constants';

export async function getWebsiteSession(websiteId: string, sessionId: string) {
  return rawQuery(
    `
    select id,
      distinct_id as "distinctId",
      website_id as "websiteId",
      browser,
      os,
      device,
      screen,
      language,
      country,
      region,
      city,
      min(min_time) as "firstAt",
      max(max_time) as "lastAt",
      count(distinct visit_id) as visits,
      sum(views) as views,
      sum(events) as events,
      sum(${getTimestampDiffSQL('min_time', 'max_time')}) as "totaltime" 
    from (select
          session.session_id as id,
          session.distinct_id,
          website_event.visit_id,
          session.website_id,
          session.browser,
          session.os,
          session.device,
          session.screen,
          session.language,
          session.country,
          session.region,
          session.city,
          min(website_event.created_at) as min_time,
          max(website_event.created_at) as max_time,
          sum(case when website_event.event_type = ${EVENT_TYPE.pageView} then 1 else 0 end) as views,
          sum(case when website_event.event_type = ${EVENT_TYPE.customEvent} then 1 else 0 end) as events
    from session
    join website_event on website_event.session_id = session.session_id
    where session.website_id = {{websiteId}}
      and session.session_id = {{sessionId}}
      and website_event.event_type != ${EVENT_TYPE.performance}
    group by session.session_id, session.distinct_id, visit_id, session.website_id, session.browser, session.os, session.device, session.screen, session.language, session.country, session.region, session.city) t
    group by id, distinct_id, website_id, browser, os, device, screen, language, country, region, city;
    `,
    { websiteId, sessionId },
  ).then(result => result?.[0]);
}
