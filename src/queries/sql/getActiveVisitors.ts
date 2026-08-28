import { subMinutes } from 'date-fns';
import { rawQuery } from '@/db/query';

export async function getActiveVisitors(websiteId: string) {
  const startDate = subMinutes(new Date(), 5);

  const result = await rawQuery(
    `
    select count(distinct session_id) as "visitors"
    from website_event
    where website_id = {{websiteId}}
    and created_at >= {{startDate}}
    `,
    { websiteId, startDate },
  );

  return result?.[0] ?? null;
}
