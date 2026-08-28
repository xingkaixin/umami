import { rawQuery } from '@/db/query';

export async function getSessionData(websiteId: string, sessionId: string) {
  return rawQuery(
    `
    select
        website_id as "websiteId",
        session_id as "sessionId",
        data_key as "dataKey",
        data_type as "dataType",
        replace(string_value, '.0000', '') as "stringValue",
        number_value as "numberValue",
        date_value as "dateValue",
        created_at as "createdAt"
    from session_data
    where website_id = {{websiteId}}
      and session_id = {{sessionId}}
    order by data_key asc
    `,
    { websiteId, sessionId },
  );
}
