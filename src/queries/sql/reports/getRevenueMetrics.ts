import { parseFilters } from '@/db/filters';
import { rawQuery } from '@/db/query';
import {
  EMAIL_DOMAINS,
  EVENT_TYPE,
  LLM_DOMAINS,
  PAID_AD_PARAMS,
  SEARCH_DOMAINS,
  SHOPPING_DOMAINS,
  SOCIAL_DOMAINS,
  VIDEO_DOMAINS,
} from '@/lib/constants';
import type { QueryFilters } from '@/lib/types';
import type { RevenuParameters } from './getRevenueChart';

export interface RevenueMetricsResult {
  country: { name: string; value: number }[];
  region: { name: string; value: number; country: string }[];
  referrer: { name: string; value: number }[];
  channel: { name: string; value: number }[];
}

export type RevenueMetricType = keyof RevenueMetricsResult;

export async function getRevenueMetrics(
  websiteId: string,
  parameters: RevenuParameters,
  filters: QueryFilters,
  type: RevenueMetricType,
): Promise<RevenueMetricsResult[RevenueMetricType]> {
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
  const filteredSessionsQuery = `
    filtered_sessions as (
      select distinct website_event.website_id, website_event.session_id
      from website_event
      ${cohortQuery}
      ${joinSessionQuery}
      where website_event.website_id = {{websiteId}}
        and website_event.event_type != ${EVENT_TYPE.performance}
      ${dateQuery}
      ${filterQuery}
    )
  `;
  const filteredRevenueQuery = `
    filtered_revenue as (
      select revenue.website_id, revenue.session_id, revenue.created_at, revenue.revenue
      from revenue
      join filtered_sessions
        on filtered_sessions.website_id = revenue.website_id
       and filtered_sessions.session_id = revenue.session_id
      where revenue.website_id = {{websiteId}}
        and revenue.created_at between {{startDate}} and {{endDate}}
        and upper(revenue.currency) = {{currency}}
    )
  `;

  if (type === 'country') {
    return rawQuery(
      `
      with
      ${filteredSessionsQuery},
      ${filteredRevenueQuery}
      select
        session.country as "name",
        sum(filtered_revenue.revenue) as "value"
      from filtered_revenue
      join session
        on session.website_id = filtered_revenue.website_id
          and session.session_id = filtered_revenue.session_id
      group by session.country
      order by value desc
      `,
      queryParams,
    );
  }

  if (type === 'region') {
    return rawQuery(
      `
      with
      ${filteredSessionsQuery},
      ${filteredRevenueQuery}
      select
        session.country,
        session.region as "name",
        sum(filtered_revenue.revenue) as "value"
      from filtered_revenue
      join session
        on session.website_id = filtered_revenue.website_id
          and session.session_id = filtered_revenue.session_id
      group by session.country, session.region
      order by value desc
      `,
      queryParams,
    );
  }

  if (type === 'referrer') {
    return rawQuery(
      `
      with
      ${filteredSessionsQuery},
      events as (
        select
          revenue.website_id,
          revenue.session_id,
          sum(revenue.revenue) as "value"
        from revenue
        join filtered_sessions
          on filtered_sessions.website_id = revenue.website_id
         and filtered_sessions.session_id = revenue.session_id
        where revenue.website_id = {{websiteId}}
          and revenue.created_at between {{startDate}} and {{endDate}}
          and upper(revenue.currency) = {{currency}}
        group by revenue.website_id, revenue.session_id),

      revenue_data as (
        select
          e.website_id,
          e.session_id,
          e.value,
          we.min_date as created_at
        from events e
        join (
          select session_id, min(created_at) as min_date
          from website_event
          where website_id = {{websiteId}}
            and created_at between {{startDate}} and {{endDate}}
          group by session_id
        ) we on we.session_id = e.session_id)

      select
        we.referrer_domain as "name",
        sum(revenue_data.value) as "value"
      from revenue_data
      join (
        select website_id, session_id, referrer_domain, created_at
        from website_event
        where website_id = {{websiteId}}
          and created_at between {{startDate}} and {{endDate}}) we
      on we.website_id = revenue_data.website_id
        and we.session_id = revenue_data.session_id
        and we.created_at = revenue_data.created_at
      group by we.referrer_domain
      order by value desc
      `,
      queryParams,
    );
  }

  return rawQuery(
    `
    with
    ${filteredSessionsQuery},
    events as (
      select
        revenue.website_id,
        revenue.session_id,
        sum(revenue.revenue) as "value"
      from revenue
      join filtered_sessions
        on filtered_sessions.website_id = revenue.website_id
       and filtered_sessions.session_id = revenue.session_id
      where revenue.website_id = {{websiteId}}
        and revenue.created_at between {{startDate}} and {{endDate}}
        and upper(revenue.currency) = {{currency}}
      group by revenue.website_id, revenue.session_id),

    revenue_data as (
      select
        e.website_id,
        e.session_id,
        e.value,
        we.min_date as created_at
      from events e
      join (
        select session_id, min(created_at) as min_date
        from website_event
        where website_id = {{websiteId}}
          and created_at between {{startDate}} and {{endDate}}
        group by session_id
      ) we on we.session_id = e.session_id),

    revenue_prefix as (
      select
        case when we.utm_medium like '%cp%' OR
              we.utm_medium like '%ppc%' OR
              we.utm_medium like '%retargeting%' OR
              we.utm_medium like '%paid%' then 'paid' else 'organic' end AS prefix,
        we.referrer_domain,
        we.url_query,
        we.utm_medium,
        we.utm_source,
        we.hostname,
        r.value
      from revenue_data r
      join (
        select website_id, session_id, referrer_domain, url_query, utm_medium, utm_source, hostname, created_at
        from website_event
        where website_id = {{websiteId}}
          and created_at between {{startDate}} and {{endDate}}) we
      on we.website_id = r.website_id
        and we.session_id = r.session_id
        and we.created_at = r.created_at),

    channels AS (
      select
        case
          when referrer_domain = '' and url_query = '' then 'direct'
          when ${getContainsAnySQL('url_query', PAID_AD_PARAMS)} then 'paidAds'
          when ${getContainsAnySQL('utm_medium', ['referral', 'app', 'link'])} then 'referral'
          when utm_medium like '%affiliate%' then 'affiliate'
          when utm_medium like '%sms%' or utm_source like '%sms%' then 'sms'
          when ${getContainsAnySQL('referrer_domain', LLM_DOMAINS)} then 'llm'
          when ${getContainsAnySQL('referrer_domain', SEARCH_DOMAINS)} or utm_medium like '%organic%' then concat(prefix, 'Search')
          when ${getContainsAnySQL('referrer_domain', SOCIAL_DOMAINS)} then concat(prefix, 'Social')
          when ${getContainsAnySQL('referrer_domain', EMAIL_DOMAINS)} or utm_medium like '%mail%' then 'email'
          when ${getContainsAnySQL('referrer_domain', SHOPPING_DOMAINS)} or utm_medium like '%shop%' then concat(prefix, 'Shopping')
          when ${getContainsAnySQL('referrer_domain', VIDEO_DOMAINS)} or utm_medium like '%video%' then concat(prefix, 'Video')
          when referrer_domain != (case when substr(hostname, 1, 4) = 'www.' then substr(hostname, 5) else hostname end) and referrer_domain != '' then 'referral'
          else 'Unknown' end AS "name",
        value
      from revenue_prefix)

    select name, sum(value) as value
    from channels
    group by name
    order by value desc
    `,
    queryParams,
  );
}

function getContainsAnySQL(column: string, arr: string[]) {
  return arr.map(val => `${column} like '%${val.replace(/'/g, "''")}%'`).join(' OR\n  ');
}
