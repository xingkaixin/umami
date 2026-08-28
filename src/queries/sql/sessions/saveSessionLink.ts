import { getDatabase } from '@/db/client';
import { sessionLink } from '@/db/schema';
import { FIELD_LENGTH } from '@/lib/constants';
import { truncateString } from '@/lib/format';

export interface SaveSessionLinkArgs {
  websiteId: string;
  sessionId: string;
  distinctId: string;
  createdAt?: Date;
}

export async function saveSessionLink(data: SaveSessionLinkArgs) {
  await getDatabase()
    .insert(sessionLink)
    .values({ ...data, distinctId: truncateString(data.distinctId, FIELD_LENGTH.distinctId) })
    .onConflictDoNothing();
}
