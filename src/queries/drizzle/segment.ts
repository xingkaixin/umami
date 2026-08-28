import { and, asc, count, eq } from 'drizzle-orm';
import { getDatabase } from '@/db/client';
import { contains, paginate } from '@/db/pagination';
import { type NewSegment, segment } from '@/db/schema';
import type { QueryFilters } from '@/lib/types';

export async function getSegment(id: string) {
  return (await getDatabase().select().from(segment).where(eq(segment.id, id)).get()) ?? null;
}

export async function getWebsiteSegment(websiteId: string, id: string) {
  return (
    (await getDatabase()
      .select()
      .from(segment)
      .where(and(eq(segment.id, id), eq(segment.websiteId, websiteId)))
      .get()) ?? null
  );
}

export function getWebsiteSegments(websiteId: string, type: string, filters: QueryFilters = {}) {
  const db = getDatabase();
  const where = and(
    eq(segment.websiteId, websiteId),
    type ? eq(segment.type, type) : undefined,
    contains(segment.name, filters.search),
  );
  return paginate(
    db.select().from(segment).where(where).orderBy(asc(segment.name), asc(segment.id)).$dynamic(),
    db.select({ count: count() }).from(segment).where(where),
    filters,
  );
}

export function createSegment(data: NewSegment) {
  return getDatabase().insert(segment).values(data).returning().get();
}

export function updateSegment(id: string, data: Partial<NewSegment>) {
  return getDatabase().update(segment).set(data).where(eq(segment.id, id)).returning().get();
}

export function deleteSegment(id: string) {
  return getDatabase().delete(segment).where(eq(segment.id, id)).returning().get();
}
