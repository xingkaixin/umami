import { getDatabase } from '@/db/client';
import { type NewSession, session } from '@/db/schema';
import { FIELD_LENGTH } from '@/lib/constants';
import { truncateString } from '@/lib/format';

export async function createSession(data: NewSession) {
  const normalizedData: NewSession = {
    ...data,
    browser: truncateString(data.browser, FIELD_LENGTH.browser),
    os: truncateString(data.os, FIELD_LENGTH.os),
    device: truncateString(data.device, FIELD_LENGTH.device),
    screen: truncateString(data.screen, FIELD_LENGTH.screen),
    language: truncateString(data.language, FIELD_LENGTH.language),
    country: truncateString(data.country, FIELD_LENGTH.country),
    region: truncateString(data.region, FIELD_LENGTH.region),
    city: truncateString(data.city, FIELD_LENGTH.city),
    distinctId: truncateString(data.distinctId, FIELD_LENGTH.distinctId),
  };

  await getDatabase()
    .insert(session)
    .values(normalizedData)
    .onConflictDoNothing({ target: session.id });
}
