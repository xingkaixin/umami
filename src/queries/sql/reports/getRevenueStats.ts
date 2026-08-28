import { parseFilters } from '@/db/filters';
import { rawQuery } from '@/db/query';
import { EVENT_TYPE } from '@/lib/constants';
import type { QueryFilters } from '@/lib/types';
import type { RevenuParameters } from './getRevenueChart';

export interface RevenueStatsResult {
  sum: number;
  count: number;
  average: number;
  unique_count: number;
  arpu: number;
}

export async function getRevenueStats(
  websiteId: string,
  parameters: RevenuParameters,
  filters: QueryFilters,
): Promise<RevenueStatsResult> {
  const { startDate, endDate, currency } = parameters;
  const { queryParams, filterQuery, cohortQuery, joinSessionQuery, dateQuery } = await parseFilters(
    {
      ...filters,
      websiteId,
      startDate,
      endDate,
      currency,
    },
  );

  const total = await rawQuery(
    `
    with
      filtered_sessions as (
        select distinct website_event.website_id, website_event.session_id
        from website_event
        ${cohortQuery}
        ${joinSessionQuery}
        where website_event.website_id = {{websiteId}}
          and website_event.event_type != ${EVENT_TYPE.performance}
        ${dateQuery}
        ${filterQuery}
      ),
      filtered_revenue as (
        select revenue.website_id, revenue.session_id, revenue.event_id, revenue.revenue
        from revenue
        join filtered_sessions
          on filtered_sessions.website_id = revenue.website_id
         and filtered_sessions.session_id = revenue.session_id
        where revenue.website_id = {{websiteId}}
          and revenue.created_at between {{startDate}} and {{endDate}}
          and upper(revenue.currency) = {{currency}}
      )
    select
      sum(filtered_revenue.revenue) as sum,
      count(distinct filtered_revenue.event_id) as count,
      count(distinct filtered_revenue.session_id) as unique_count,
      (select count(*) from filtered_sessions) as total_sessions
    from filtered_revenue
    `,
    queryParams,
  ).then(result => result?.[0]);

  total.average = total.count > 0 ? Number(total.sum) / Number(total.count) : 0;
  total.arpu = total.total_sessions > 0 ? Number(total.sum) / Number(total.total_sessions) : 0;

  return total;
}
