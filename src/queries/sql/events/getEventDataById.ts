import { rawQuery } from '@/db/query';

export async function getEventDataById(websiteId: string, eventId: string) {
  return rawQuery(
    `
    select event_data.website_id as "websiteId",
       event_data.website_event_id as "eventId",
       website_event.event_name as "eventName",
       event_data.data_key as "dataKey",
       event_data.string_value as "stringValue",
       event_data.number_value as "numberValue",
       event_data.date_value as "dateValue",
       event_data.data_type as "dataType",
       event_data.created_at as "createdAt"
    from event_data
    join website_event on website_event.event_id = event_data.website_event_id
      and website_event.website_id = {{websiteId}}
    where event_data.website_id = {{websiteId}}
      and event_data.website_event_id = {{eventId}}
    `,
    { websiteId, eventId },
  );
}
