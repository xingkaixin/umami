import { rawQuery } from '@/db/query';

export async function getLinkedDistinctIds(
  websiteId: string,
  sessionId: string,
): Promise<string[]> {
  return rawQuery(
    `
    select distinct distinct_id as "distinctId"
    from session_link
    where website_id = {{websiteId}}
      and session_id = {{sessionId}}
    `,
    { websiteId, sessionId },
  ).then(result => (result as { distinctId: string }[]).map(({ distinctId }) => distinctId));
}
