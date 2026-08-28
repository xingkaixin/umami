import { rawQuery } from '@/db/query';

export async function getLinkedSessionIds(websiteId: string, distinctId: string) {
  return rawQuery(
    `
    select
      session_id as "sessionId",
      min(created_at) as "createdAt"
    from session_link
    where website_id = {{websiteId}}
      and distinct_id = {{distinctId}}
    group by session_id
    `,
    { websiteId, distinctId },
  );
}
