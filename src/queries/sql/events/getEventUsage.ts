import { rawQuery } from '@/db/query';
import type { QueryFilters } from '@/lib/types';

export function getEventUsage(
  websiteIds: string[],
  filters: QueryFilters,
): Promise<{ websiteId: string; count: number }[]> {
  return rawQuery(
    `select website_id as websiteId, count(*) as count from website_event
    where website_id in (select value from json_each({{websiteIds}}))
      and created_at between {{startDate}} and {{endDate}} group by website_id`,
    { ...filters, websiteIds },
  );
}
