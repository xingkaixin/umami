import { parseFilters } from '@/db/filters';
import { rawQuery } from '@/db/query';
import { EVENT_TYPE } from '@/lib/constants';
import type { QueryFilters } from '@/lib/types';

export interface GoalParameters {
  startDate: Date;
  endDate: Date;
  type: string;
  value: string;
}

export async function getGoal(
  websiteId: string,
  parameters: GoalParameters,
  filters: QueryFilters,
) {
  const { startDate, endDate, type, value } = parameters;
  const eventType = type === 'path' ? EVENT_TYPE.pageView : EVENT_TYPE.customEvent;
  const column = type === 'path' ? 'url_path' : 'event_name';

  let operator = '=';
  let paramValue = value;
  if (value.startsWith('*') || value.endsWith('*')) {
    operator = 'like';
    paramValue = value.replace(/^\*|\*$/g, '%');
  }

  const { filterQuery, dateQuery, joinSessionQuery, cohortQuery, queryParams } = await parseFilters(
    {
      ...filters,
      websiteId,
      value: paramValue,
      startDate,
      endDate,
      eventType,
    },
  );

  const excludeEventTypeFilterQuery = filterQuery
    .split('\n')
    .filter(filter => !filter.includes('event_type'))
    .join('\n')
    .trim();

  return rawQuery(
    `
    select count(distinct website_event.session_id) as num,
    (
      select count(distinct website_event.session_id)
      from website_event
      ${cohortQuery}
      ${joinSessionQuery}
      where website_event.website_id = {{websiteId}}
      ${dateQuery}
      ${excludeEventTypeFilterQuery}
    ) as total
    from website_event
    ${cohortQuery}
    ${joinSessionQuery}
    where website_event.website_id = {{websiteId}}
      and ${column} ${operator} {{value}}
      ${dateQuery}
      ${filterQuery}
    `,
    queryParams,
  ).then(results => results?.[0]);
}
