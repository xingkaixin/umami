import { parseFilters } from '@/db/filters';
import { rawQuery } from '@/db/query';
import { EVENT_TYPE } from '@/lib/constants';
import type { QueryFilters } from '@/lib/types';

export interface AttributionParameters {
  startDate: Date;
  endDate: Date;
  model: string;
  type: string;
  step: string;
}

export interface AttributionResult {
  referrer: { name: string; value: number }[];
  paidAds: { name: string; value: number }[];
  utm_source: { name: string; value: number }[];
  utm_medium: { name: string; value: number }[];
  utm_campaign: { name: string; value: number }[];
  utm_content: { name: string; value: number }[];
  utm_term: { name: string; value: number }[];
  total: { pageviews: number; visitors: number; visits: number };
}

export async function getAttribution(
  websiteId: string,
  parameters: AttributionParameters,
  filters: QueryFilters,
): Promise<AttributionResult> {
  const { model, type } = parameters;
  const eventType = type === 'path' ? EVENT_TYPE.pageView : EVENT_TYPE.customEvent;
  const column = type === 'path' ? 'url_path' : 'event_name';
  const { filterQuery, joinSessionQuery, cohortQuery, queryParams } = await parseFilters({
    ...filters,
    ...parameters,
    websiteId,
    eventType,
  });

  function getUTMQuery(utmColumn: string) {
    return `
    select
        coalesce(we.${utmColumn}, '') as "name",
        count(distinct we.session_id) as "value"
    from model m
    join website_event we
    on we.created_at = m.created_at
        and we.session_id = m.session_id
    where we.website_id = {{websiteId}}
          and we.created_at between {{startDate}} and {{endDate}}
          and we.${utmColumn} != ''
    group by 1
    order by 2 desc
    limit 20`;
  }

  const eventQuery = `WITH events AS (
        select distinct
            website_event.session_id,
            max(website_event.created_at) max_dt
        from website_event
        ${cohortQuery}
        ${joinSessionQuery}
        where website_event.website_id = {{websiteId}}
          and website_event.created_at between {{startDate}} and {{endDate}}
          and website_event.${column} = {{step}}
          ${filterQuery}
        group by 1),`;

  function getModelQuery(model: string) {
    return model === 'first-click'
      ? `\n
    model AS (select e.session_id,
        min(we.created_at) created_at
    from events e
    join website_event we
    on we.session_id = e.session_id
    where we.website_id = {{websiteId}}
          and we.created_at between {{startDate}} and {{endDate}}
    group by e.session_id)`
      : `\n
    model AS (select e.session_id,
        max(we.created_at) created_at
    from events e
    join website_event we
    on we.session_id = e.session_id
    where we.website_id = {{websiteId}}
          and we.created_at between {{startDate}} and {{endDate}}
          and we.created_at < e.max_dt
    group by e.session_id)`;
  }

  const referrerRes = await rawQuery(
    `
    ${eventQuery}
    ${getModelQuery(model)}
    select coalesce(we.referrer_domain, '') as "name",
        count(distinct we.session_id) value
    from model m
    join website_event we
    on we.created_at = m.created_at
        and we.session_id = m.session_id
    join session s
    on s.session_id = m.session_id
    where we.website_id = {{websiteId}}
          and we.created_at between {{startDate}} and {{endDate}}
          and we.referrer_domain != (case when substr(we.hostname, 1, 4) = 'www.' then substr(we.hostname, 5) else we.hostname end)
          and we.referrer_domain != ''
    group by 1
    order by 2 desc
    limit 20
    `,
    queryParams,
  );

  const paidAdsres = await rawQuery(
    `
    ${eventQuery}
    ${getModelQuery(model)},

    results AS (
    select case
            when coalesce(gclid, '') != '' then 'Google Ads'
            when coalesce(fbclid, '') != '' then 'Facebook / Meta'
            when coalesce(msclkid, '') != '' then 'Microsoft Ads'
            when coalesce(ttclid, '') != '' then 'TikTok Ads'
            when coalesce(li_fat_id, '') != '' then 'LinkedIn Ads'
            when coalesce(twclid, '') != '' then 'Twitter Ads (X)'
            else ''
          end as "name",
        count(distinct we.session_id) as "value"
    from model m
    join website_event we
    on we.created_at = m.created_at
        and we.session_id = m.session_id
    where we.website_id = {{websiteId}}
          and we.created_at between {{startDate}} and {{endDate}}
    group by 1
    order by 2 desc
    limit 20)
    SELECT *
    FROM results
    WHERE name != ''
    `,
    queryParams,
  );

  const sourceRes = await rawQuery(
    `
    ${eventQuery}
    ${getModelQuery(model)}
    ${getUTMQuery('utm_source')}
    `,
    queryParams,
  );

  const mediumRes = await rawQuery(
    `
    ${eventQuery}
    ${getModelQuery(model)}
    ${getUTMQuery('utm_medium')}
    `,
    queryParams,
  );

  const campaignRes = await rawQuery(
    `
    ${eventQuery}
    ${getModelQuery(model)}
    ${getUTMQuery('utm_campaign')}
    `,
    queryParams,
  );

  const contentRes = await rawQuery(
    `
    ${eventQuery}
    ${getModelQuery(model)}
    ${getUTMQuery('utm_content')}
    `,
    queryParams,
  );

  const termRes = await rawQuery(
    `
    ${eventQuery}
    ${getModelQuery(model)}
    ${getUTMQuery('utm_term')}
    `,
    queryParams,
  );

  const totalRes = await rawQuery(
    `
    select
        count(*) as "pageviews",
        count(distinct website_event.session_id) as "visitors",
        count(distinct website_event.visit_id) as "visits"
    from website_event
    ${joinSessionQuery}
    ${cohortQuery}
    where website_event.website_id = {{websiteId}}
        and website_event.created_at between {{startDate}} and {{endDate}}
        and website_event.${column} = {{step}}
        ${filterQuery}
    `,
    queryParams,
  ).then(result => result?.[0]);

  return {
    referrer: referrerRes,
    paidAds: paidAdsres,
    utm_source: sourceRes,
    utm_medium: mediumRes,
    utm_campaign: campaignRes,
    utm_content: contentRes,
    utm_term: termRes,
    total: totalRes,
  };
}
