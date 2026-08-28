import { rawQuery } from '@/db/query';
import type { QueryFilters } from '@/lib/types';

export function getEventDataUsage(
  websiteIds: string[],
  filters: QueryFilters,
): Promise<{ websiteId: string; count: number }[]> {
  return rawQuery(
    `select website_id as websiteId, count(*) as count from event_data
    where website_id in (select value from json_each({{websiteIds}}))
      and created_at between {{startDate}} and {{endDate}} group by website_id`,
    { ...filters, websiteIds },
  );
}
