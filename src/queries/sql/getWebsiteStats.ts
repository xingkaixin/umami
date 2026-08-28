import { getTimestampDiffSQL } from '@/db/dates';
import { parseFilters } from '@/db/filters';
import { rawQuery } from '@/db/query';
import { EVENT_COLUMNS, EVENT_TYPE } from '@/lib/constants';
import type { QueryFilters } from '@/lib/types';

export interface WebsiteStatsData {
  pageviews: number;
  visitors: number;
  visits: number;
  bounces: number;
  totaltime: number;
}

export async function getWebsiteStats(
  websiteId: string,
  filters: QueryFilters,
): Promise<WebsiteStatsData[]> {
  const { filterQuery, joinSessionQuery, cohortQuery, excludeBounceQuery, queryParams } =
    await parseFilters({
      ...filters,
      websiteId,
    });

  const { excludeBounce } = filters;
  const hasEventFilters =
    EVENT_COLUMNS.some(item => Object.keys(filters).includes(item)) ||
    !!filters.eventPropertyFilters?.length;

  if (!hasEventFilters) {
    return rawQuery(
      `
      select
        cast(coalesce(sum(t.c), 0) as bigint) as "pageviews",
        count(distinct t.session_id) as "visitors",
        count(distinct t.visit_id) as "visits",
        ${excludeBounce ? '0' : 'coalesce(sum(case when t.c = 1 and t.has_custom_event = 0 then 1 else 0 end), 0)'} as "bounces",
        cast(coalesce(sum(${getTimestampDiffSQL('t.min_time', 't.max_time')}), 0) as bigint) as "totaltime"
      from (
        select
          website_event.session_id,
          website_event.visit_id,
          sum(case when website_event.event_type NOT IN (2, 5) then 1 else 0 end) as "c",
          min(case when website_event.event_type NOT IN (2, 5) then website_event.created_at end) as "min_time",
          max(case when website_event.event_type NOT IN (2, 5) then website_event.created_at end) as "max_time",
          max(case when website_event.event_type = ${EVENT_TYPE.customEvent} then 1 else 0 end) as "has_custom_event"
        from website_event
        ${cohortQuery}
        ${excludeBounceQuery}
        ${joinSessionQuery}
        where website_event.website_id = {{websiteId}}
          and website_event.created_at between {{startDate}} and {{endDate}}
          and website_event.event_type != ${EVENT_TYPE.performance}
          ${filterQuery}
        group by 1, 2
        having sum(case when website_event.event_type NOT IN (2, 5) then 1 else 0 end) > 0
      ) as t
      `,
      queryParams,
    ).then(result => result?.[0]);
  }

  const bounceQuery = excludeBounce
    ? '0'
    : 'coalesce(sum(case when t.c = 1 and coalesce(e.has_custom_event, 0) = 0 then 1 else 0 end), 0)';
  const visitEventsJoin = excludeBounce
    ? ''
    : `
      left join (
        select session_id, visit_id, 1 as "has_custom_event"
        from website_event
        where website_id = {{websiteId}}
          and created_at between {{startDate}} and {{endDate}}
          and event_type = ${EVENT_TYPE.customEvent}
        group by 1, 2
      ) as e
        on e.session_id = t.session_id
        and e.visit_id = t.visit_id`;

  return rawQuery(
    `
    select
      cast(coalesce(sum(t.c), 0) as bigint) as "pageviews",
      count(distinct t.session_id) as "visitors",
      count(distinct t.visit_id) as "visits",
      ${bounceQuery} as "bounces",
      cast(coalesce(sum(${getTimestampDiffSQL('t.min_time', 't.max_time')}), 0) as bigint) as "totaltime"
    from (
      select
        website_event.session_id,
        website_event.visit_id,
        count(*) as "c",
        min(website_event.created_at) as "min_time",
        max(website_event.created_at) as "max_time"
      from website_event
      ${cohortQuery}
      ${excludeBounceQuery}
      ${joinSessionQuery}
      where website_event.website_id = {{websiteId}}
        and website_event.created_at between {{startDate}} and {{endDate}}
        and website_event.event_type NOT IN (2, 5)
        ${filterQuery}
      group by 1, 2
    ) as t
    ${visitEventsJoin}
    `,
    queryParams,
  ).then(result => result?.[0]);
}
