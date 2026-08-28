import { getDateSQL } from '@/db/dates';
import { parseFilters } from '@/db/filters';
import { rawQuery } from '@/db/query';
import type { QueryFilters } from '@/lib/types';

export async function getSessionStats(websiteId: string, filters: QueryFilters) {
  const { timezone = 'utc', unit = 'day' } = filters;
  const { filterQuery, joinSessionQuery, cohortQuery, excludeBounceQuery, queryParams } =
    await parseFilters({
      ...filters,
      websiteId,
    });

  return rawQuery(
    `
    select
      ${getDateSQL('website_event.created_at', unit, timezone, queryParams)} x,
      count(distinct website_event.session_id) y
    from website_event
    ${cohortQuery}
    ${excludeBounceQuery}
    ${joinSessionQuery}
    where website_event.website_id = {{websiteId}}
      and website_event.created_at between {{startDate}} and {{endDate}}
      and website_event.event_type NOT IN (2, 5)
      ${filterQuery}
    group by 1
    order by 1
    `,
    queryParams,
  );
}
