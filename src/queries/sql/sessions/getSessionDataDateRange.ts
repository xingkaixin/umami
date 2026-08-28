import { rawQuery } from '@/db/query';

export async function getSessionDataDateRange(websiteId: string) {
  const [row] = await rawQuery<{ first: string; last: string }[]>(
    'select min(created_at) as first, max(created_at) as last from session_data where website_id = {{websiteId}}',
    { websiteId },
  );
  return row?.first && row?.last
    ? { startDate: new Date(row.first), endDate: new Date(row.last) }
    : null;
}
