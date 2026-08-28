import { parseFilters } from '@/db/filters';
import { rawQuery } from '@/db/query';
import { DEFAULT_PAGE_SIZE, EVENT_TYPE } from '@/lib/constants';
import type { QueryFilters } from '@/lib/types';

export async function getWebsiteEvents(websiteId: string, filters: QueryFilters) {
  const { search, page = 1, pageSize, maxResults, orderBy } = filters;
  const size = +pageSize || DEFAULT_PAGE_SIZE;
  const offset = +size * (+page - 1);
  const { filterQuery, dateQuery, cohortQuery, joinSessionQuery, queryParams } = await parseFilters(
    {
      ...filters,
      websiteId,
    },
  );
  const hasDataDateQuery = dateQuery.replaceAll('website_event.', 'event_data.');
  const searchParams = search ? { eventSearch: `%${search}%` } : {};

  const searchQuery = search
    ? `and ((event_name like {{eventSearch}} and event_type = ${EVENT_TYPE.customEvent})
           or (url_path like {{eventSearch}} and event_type = ${EVENT_TYPE.pageView}))`
    : '';

  const eventQuery = `
    select
      website_event.event_id,
      website_event.created_at
    from website_event
    ${cohortQuery}
    ${joinSessionQuery}
    where website_event.website_id = {{websiteId}}
      and website_event.event_type != ${EVENT_TYPE.performance}
    ${dateQuery}
    ${filterQuery}
    ${searchQuery}
  `;

  const countFromQuery = `
    from website_event
    ${cohortQuery}
    ${joinSessionQuery}
    where website_event.website_id = {{websiteId}}
      and website_event.event_type != ${EVENT_TYPE.performance}
    ${dateQuery}
    ${filterQuery}
    ${searchQuery}
  `;

  const countQuery = maxResults
    ? `select count(*) as num from (select 1 from (${eventQuery}) t limit ${+maxResults}) t2`
    : `select count(*) as num ${countFromQuery}`;

  const count = await rawQuery(countQuery, { ...queryParams, ...searchParams }).then(res =>
    Number(res[0].num),
  );

  const data = await rawQuery(
    `
    with paged_events as (
      ${eventQuery}
      order by created_at desc
      limit ${size} offset ${offset}
    ),
    paged_event_data as (
      select distinct event_data.website_event_id as event_id
      from event_data
      join paged_events on paged_events.event_id = event_data.website_event_id
      where event_data.website_id = {{websiteId}}
      ${hasDataDateQuery}
    )
    select
      website_event.event_id as "id",
      website_event.website_id as "websiteId", 
      website_event.session_id as "sessionId",
      website_event.created_at as "createdAt",
      website_event.hostname,
      website_event.url_path as "urlPath",
      website_event.url_query as "urlQuery",
      website_event.referrer_path as "referrerPath",
      website_event.referrer_query as "referrerQuery",
      website_event.referrer_domain as "referrerDomain",
      session.country as country,
      session.city as city,
      session.device as device,
      session.os as os,
      session.browser as browser,
      website_event.page_title as "pageTitle",
      website_event.event_type as "eventType",
      website_event.event_name as "eventName",
      (paged_event_data.event_id is not null) as "hasData"
    from paged_events
    join website_event on website_event.event_id = paged_events.event_id
    left join session on session.session_id = website_event.session_id
      and session.website_id = website_event.website_id
    left join paged_event_data on paged_event_data.event_id = website_event.event_id
    order by paged_events.created_at desc
    `,
    { ...queryParams, ...searchParams },
  );

  return {
    data,
    count,
    page: +page,
    pageSize: size,
    orderBy,
    isCapped: !!maxResults && +count >= +maxResults,
  };
}
