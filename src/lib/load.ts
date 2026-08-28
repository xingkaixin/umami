import { getWebsite } from '@/queries/drizzle';
import { getWebsiteSession } from '@/queries/sql/sessions/getWebsiteSession';

export async function fetchWebsite(websiteId: string) {
  const website = await getWebsite(websiteId);
  return website && !website.deletedAt ? website : null;
}

export async function fetchSession(websiteId: string, sessionId: string) {
  return (await getWebsiteSession(websiteId, sessionId)) ?? null;
}
