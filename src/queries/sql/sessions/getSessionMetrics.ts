import { parseFilters } from '@/db/filters';
import { rawQuery } from '@/db/query';
import { FILTER_COLUMNS, SESSION_COLUMNS } from '@/lib/constants';
import type { QueryFilters } from '@/lib/types';

export interface SessionMetricsParameters {
  type: string;
  limit?: number | string;
  offset?: number | string;
}

export async function getSessionMetrics(
  websiteId: string,
  parameters: SessionMetricsParameters,
  filters: QueryFilters,
) {
  const { type, limit = 500, offset = 0 } = parameters;
  let column = FILTER_COLUMNS[type] || type;
  const { filterQuery, joinSessionQuery, cohortQuery, excludeBounceQuery, queryParams } =
    await parseFilters(
      {
        ...filters,
        websiteId,
      },
      {
        joinSession: SESSION_COLUMNS.includes(type),
      },
    );
  const includeCountry = column === 'city' || column === 'region';

  if (type === 'language') {
    column = `lower(substr(${type}, 1, 2))`;
  }

  return rawQuery(
    `
    select 
      ${column} x,
      count(distinct website_event.session_id) y
      ${includeCountry ? ', country' : ''}
    from website_event
    ${cohortQuery}
    ${excludeBounceQuery}
    ${joinSessionQuery}
    where website_event.website_id = {{websiteId}}
      and website_event.created_at between {{startDate}} and {{endDate}}
      and website_event.event_type NOT IN (2, 5)
      and ${column} != ''
    ${filterQuery}
    group by 1
    ${includeCountry ? ', 3' : ''}
    order by 2 desc
    limit ${limit}
    offset ${offset}
    `,
    { ...queryParams, ...parameters },
  );
}
