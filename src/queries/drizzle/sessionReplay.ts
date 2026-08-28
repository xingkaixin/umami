import { and, asc, count, desc, eq } from 'drizzle-orm';
import { getDatabase } from '@/db/client';
import { contains, paginate } from '@/db/pagination';
import { sessionReplay, sessionReplaySaved } from '@/db/schema';
import { uuid } from '@/lib/crypto';
import type { QueryFilters } from '@/lib/types';

export interface CreateReplayChunkArgs {
  websiteId: string;
  sessionId: string;
  visitId: string;
  chunkIndex: number;
  events: Uint8Array;
  eventCount: number;
  startedAt: Date;
  endedAt: Date;
}

export function getReplayChunks(websiteId: string, visitId: string) {
  return getDatabase()
    .select({
      events: sessionReplay.events,
      sessionId: sessionReplay.sessionId,
      chunkIndex: sessionReplay.chunkIndex,
      eventCount: sessionReplay.eventCount,
      startedAt: sessionReplay.startedAt,
      endedAt: sessionReplay.endedAt,
    })
    .from(sessionReplay)
    .where(and(eq(sessionReplay.websiteId, websiteId), eq(sessionReplay.visitId, visitId)))
    .orderBy(asc(sessionReplay.chunkIndex));
}

export function createReplayChunk(data: CreateReplayChunkArgs) {
  return getDatabase()
    .insert(sessionReplay)
    .values({ id: uuid(), ...data })
    .returning()
    .get();
}

export function deleteReplaysByWebsite(websiteId: string) {
  return getDatabase().delete(sessionReplay).where(eq(sessionReplay.websiteId, websiteId));
}

export async function getReplaySaved(websiteId: string, visitId: string) {
  return !!(await getDatabase()
    .select({ id: sessionReplaySaved.id })
    .from(sessionReplaySaved)
    .where(
      and(eq(sessionReplaySaved.websiteId, websiteId), eq(sessionReplaySaved.visitId, visitId)),
    )
    .get());
}

export function createReplaySaved(websiteId: string, visitId: string, name: string) {
  return getDatabase()
    .insert(sessionReplaySaved)
    .values({ id: uuid(), websiteId, visitId, name })
    .returning()
    .get();
}

export function updateReplaySaved(websiteId: string, visitId: string, name: string) {
  return getDatabase()
    .update(sessionReplaySaved)
    .set({ name })
    .where(
      and(eq(sessionReplaySaved.websiteId, websiteId), eq(sessionReplaySaved.visitId, visitId)),
    );
}

export function deleteReplaySaved(websiteId: string, visitId: string) {
  return getDatabase()
    .delete(sessionReplaySaved)
    .where(
      and(eq(sessionReplaySaved.websiteId, websiteId), eq(sessionReplaySaved.visitId, visitId)),
    );
}

export function getSavedReplays(websiteId: string, filters: QueryFilters = {}) {
  const db = getDatabase();
  const where = and(
    eq(sessionReplaySaved.websiteId, websiteId),
    contains(sessionReplaySaved.name, filters.search),
  );
  return paginate(
    db
      .select()
      .from(sessionReplaySaved)
      .where(where)
      .orderBy(desc(sessionReplaySaved.createdAt), asc(sessionReplaySaved.id))
      .$dynamic(),
    db.select({ count: count() }).from(sessionReplaySaved).where(where),
    filters,
  );
}
