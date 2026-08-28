import { and, eq, sql } from 'drizzle-orm';
import { getDatabase } from '@/db/client';
import {
  eventData,
  heatmapEvent,
  revenue,
  session,
  sessionData,
  sessionLink,
  sessionReplay,
  sessionReplaySaved,
  websiteEvent,
} from '@/db/schema';

export async function deleteSession(
  websiteId: string,
  sessionId: string,
): Promise<{ id: string } | null> {
  const db = getDatabase();
  const where = and(eq(session.websiteId, websiteId), eq(session.id, sessionId));
  const existing = await db.select({ id: session.id }).from(session).where(where).get();
  if (!existing) return null;
  const scope = sql`website_id = ${websiteId} and session_id = ${sessionId}`;
  await db.batch([
    db
      .delete(eventData)
      .where(
        sql`${eventData.websiteEventId} in (select event_id from website_event where ${scope})`,
      ),
    db
      .delete(sessionReplaySaved)
      .where(sql`${sessionReplaySaved.websiteId} = ${websiteId} and ${sessionReplaySaved.visitId} in (
      select visit_id from website_event where ${scope}
      union select visit_id from session_replay where ${scope}
    )`),
    db.delete(sessionReplay).where(scope),
    db.delete(heatmapEvent).where(scope),
    db.delete(revenue).where(scope),
    db.delete(sessionData).where(scope),
    db.delete(sessionLink).where(scope),
    db.delete(websiteEvent).where(scope),
    db.delete(session).where(where),
  ]);
  return existing;
}
