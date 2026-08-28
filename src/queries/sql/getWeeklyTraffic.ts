import { getDateWeeklySQL } from '@/db/dates';
import { parseFilters } from '@/db/filters';
import { rawQuery } from '@/db/query';
import type { QueryFilters } from '@/lib/types';

export async function getWeeklyTraffic(websiteId: string, filters: QueryFilters) {
  const { timezone = 'utc' } = filters;
  const { filterQuery, joinSessionQuery, cohortQuery, excludeBounceQuery, queryParams } =
    await parseFilters({
      ...filters,
      websiteId,
    });

  return rawQuery(
    `
    select
      ${getDateWeeklySQL('website_event.created_at', timezone, queryParams)} as time,
      count(distinct website_event.session_id) as value
    from website_event
    ${cohortQuery}
    ${excludeBounceQuery}
    ${joinSessionQuery}
    where website_event.website_id = {{websiteId}}
      and website_event.created_at between {{startDate}} and {{endDate}}
      and website_event.event_type NOT IN (2, 5)
      ${filterQuery}
    group by time
    order by 1
    `,
    queryParams,
  ).then(formatResults);
}

function formatResults(data: any) {
  const days = [];

  for (let i = 0; i < 7; i++) {
    days.push([]);

    for (let j = 0; j < 24; j++) {
      days[i].push(
        Number(
          data.find(({ time }) => time === `${i}:${j.toString().padStart(2, '0')}`)?.value || 0,
        ),
      );
    }
  }

  return days;
}
