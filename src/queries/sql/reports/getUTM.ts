import { parseFilters } from '@/db/filters';
import { rawQuery } from '@/db/query';
import { EVENT_TYPE } from '@/lib/constants';
import type { QueryFilters } from '@/lib/types';

export interface UTMParameters {
  column: string;
  startDate: Date;
  endDate: Date;
}

export async function getUTM(websiteId: string, parameters: UTMParameters, filters: QueryFilters) {
  const { column, startDate, endDate } = parameters;

  const { filterQuery, joinSessionQuery, cohortQuery, queryParams } = await parseFilters({
    ...filters,
    websiteId,
    startDate,
    endDate,
    eventType: EVENT_TYPE.pageView,
  });

  return rawQuery(
    `
    select website_event.${column} utm, count(*) as views
    from website_event
    ${cohortQuery}
    ${joinSessionQuery}
    where website_event.website_id = {{websiteId}}
      and website_event.created_at between {{startDate}} and {{endDate}}
      and coalesce(website_event.${column}, '') != ''
      ${filterQuery}
    group by 1
    order by 2 desc
    limit 50
    `,
    queryParams,
  );
}
