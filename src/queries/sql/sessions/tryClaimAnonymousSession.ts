import { sql } from 'drizzle-orm';
import { getDatabase } from '@/db/client';
import { FIELD_LENGTH } from '@/lib/constants';
import { truncateString } from '@/lib/format';

export interface TryClaimAnonymousSessionArgs {
  websiteId: string;
  sessionId: string;
  distinctId: string;
  createdAt: Date;
}

export async function tryClaimAnonymousSession({
  websiteId,
  sessionId,
  distinctId,
  createdAt,
}: TryClaimAnonymousSessionArgs): Promise<boolean> {
  const db = getDatabase();
  const id = truncateString(distinctId, FIELD_LENGTH.distinctId);
  const claimedByOther = sql`
    exists (
      select 1 from session_link
      where website_id = ${websiteId} and session_id = ${sessionId} and distinct_id <> ${id}
    )
    or exists (
      select 1 from session
      where website_id = ${websiteId} and session_id = ${sessionId}
        and distinct_id is not null and distinct_id <> '' and distinct_id <> ${id}
    )`;

  await db.run(sql`
    insert into session_link (website_id, session_id, distinct_id, created_at)
    select ${websiteId}, ${sessionId}, ${id}, ${createdAt.toISOString()}
    where not (${claimedByOther})
    on conflict (website_id, distinct_id, session_id) do nothing`);

  // The guarded insert is the atomic claim. Once any identity holds a link, every other
  // identity's insert is rejected, so this read reports the winner without a transaction.
  const result = await db.get<{ claimed: number }>(sql`select not (${claimedByOther}) as claimed`);

  return result?.claimed === 1;
}
