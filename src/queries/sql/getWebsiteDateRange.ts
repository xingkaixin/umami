import { parseFilters } from '@/db/filters';
import { rawQuery } from '@/db/query';
import { DEFAULT_RESET_DATE } from '@/lib/constants';

export async function getWebsiteDateRange(websiteId: string) {
  const { queryParams } = await parseFilters({
    startDate: new Date(DEFAULT_RESET_DATE),
    websiteId,
  });

  const result = await rawQuery(
    `
    select
      min(created_at) as "startDate",
      max(created_at) as "endDate"
    from website_event
    where website_id = {{websiteId}}
      and created_at >= {{startDate}}
    `,
    queryParams,
  );

  return result[0] ?? null;
}
