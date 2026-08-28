import { getDateSQL } from '@/db/dates';
import { parseFilters } from '@/db/filters';
import { rawQuery } from '@/db/query';
import { DATA_TYPE, EVENT_TYPE } from '@/lib/constants';
import type { QueryFilters } from '@/lib/types';

export async function getSessionDataValues(
  websiteId: string,
  filters: QueryFilters & { propertyName?: string; dataType?: number },
) {
  const { dataType } = filters;
  const { filterQuery, joinSessionQuery, cohortQuery, queryParams } = await parseFilters({
    ...filters,
    websiteId,
  });

  if (dataType === DATA_TYPE.array) {
    return rawQuery(
      `
      select
        array_item.value as "value",
        count(*) as "total"
      from website_event
      ${cohortQuery}
      ${joinSessionQuery}
      join session_data
          on session_data.session_id = website_event.session_id
            and session_data.website_id = website_event.website_id
      cross join json_each(coalesce(session_data.string_value, '[]')) as array_item
      where website_event.website_id = {{websiteId}}
        and website_event.created_at between {{startDate}} and {{endDate}}
        and website_event.event_type != ${EVENT_TYPE.performance}
        and session_data.data_key = {{propertyName}}
        and session_data.data_type = ${DATA_TYPE.array}
      ${filterQuery}
      group by array_item.value
      order by 2 desc
      limit 500
      `,
      queryParams,
    );
  }

  return rawQuery(
    `
    select
      case 
        when data_type = 2 then replace(string_value, '.0000', '') 
        when data_type = 4 then ${getDateSQL('date_value', 'hour')} 
        else string_value
      end as "value",
      count(*) as "total"
    from website_event
    ${cohortQuery}
    ${joinSessionQuery}
    join session_data
        on session_data.session_id = website_event.session_id
          and session_data.website_id = website_event.website_id
    where website_event.website_id = {{websiteId}}
      and website_event.created_at between {{startDate}} and {{endDate}}
      and website_event.event_type != ${EVENT_TYPE.performance}
      and session_data.data_key = {{propertyName}}
      ${dataType ? `and session_data.data_type = ${dataType}` : ''}
    ${filterQuery}
    group by value
    order by 2 desc
    limit 500
    `,
    queryParams,
  );
}
