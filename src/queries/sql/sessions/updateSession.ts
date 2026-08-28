import { and, eq } from 'drizzle-orm';
import { getDatabase } from '@/db/client';
import { session } from '@/db/schema';
import { FIELD_LENGTH } from '@/lib/constants';
import { truncateString } from '@/lib/format';

export interface UpdateSessionArgs {
  websiteId: string;
  sessionId: string;
  distinctId: string;
}

export async function updateSession({ websiteId, sessionId, distinctId }: UpdateSessionArgs) {
  await getDatabase()
    .update(session)
    .set({ distinctId: truncateString(distinctId, FIELD_LENGTH.distinctId) })
    .where(and(eq(session.websiteId, websiteId), eq(session.id, sessionId)));
}
