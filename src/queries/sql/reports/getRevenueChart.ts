import { getDateSQL } from '@/db/dates';
import { parseFilters } from '@/db/filters';
import { rawQuery } from '@/db/query';
import { EVENT_TYPE } from '@/lib/constants';
import type { QueryFilters } from '@/lib/types';

export interface RevenuParameters {
  startDate: Date;
  endDate: Date;
  unit: string;
  timezone: string;
  currency: string;
  compare?: string;
}

export async function getRevenueChart(
  websiteId: string,
  parameters: RevenuParameters,
  filters: QueryFilters,
) {
  const { startDate, endDate, unit = 'day', timezone = 'utc', currency } = parameters;
  const { queryParams, filterQuery, cohortQuery, joinSessionQuery, dateQuery } = await parseFilters(
    {
      ...filters,
      websiteId,
      startDate,
      endDate,
      currency,
    },
  );

  const chart = await rawQuery(
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
        select
          revenue.event_id,
          revenue.event_name,
          revenue.created_at,
          revenue.revenue
        from revenue
        join filtered_sessions
          on filtered_sessions.website_id = revenue.website_id
         and filtered_sessions.session_id = revenue.session_id
        where revenue.website_id = {{websiteId}}
          and revenue.created_at between {{startDate}} and {{endDate}}
          and upper(revenue.currency) = {{currency}}
      )
    select
      filtered_revenue.event_name x,
      ${getDateSQL('filtered_revenue.created_at', unit, timezone, queryParams)} t,
      sum(filtered_revenue.revenue) y,
      count(filtered_revenue.event_id) count
    from filtered_revenue
    group by x, t
    order by t
    `,
    queryParams,
  );

  return { chart };
}
