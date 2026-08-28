import { asc, count, desc, eq } from 'drizzle-orm';
import { getDatabase } from '@/db/client';
import { paginate } from '@/db/pagination';
import { type NewShare, share } from '@/db/schema';
import type { QueryFilters } from '@/lib/types';

export async function getShare(id: string) {
  return (await getDatabase().select().from(share).where(eq(share.id, id)).get()) ?? null;
}

export async function getShareByCode(slug: string) {
  return (await getDatabase().select().from(share).where(eq(share.slug, slug)).get()) ?? null;
}

export async function getShareByEntityId(entityId: string) {
  return (
    (await getDatabase()
      .select()
      .from(share)
      .where(eq(share.entityId, entityId))
      .orderBy(desc(share.createdAt), asc(share.id))
      .get()) ?? null
  );
}

export function getSharesByEntityId(entityId: string, filters?: QueryFilters) {
  const db = getDatabase();
  const where = eq(share.entityId, entityId);
  return paginate(
    db.select().from(share).where(where).orderBy(desc(share.createdAt), asc(share.id)).$dynamic(),
    db.select({ count: count() }).from(share).where(where),
    filters,
  );
}

export function createShare(data: NewShare) {
  return getDatabase().insert(share).values(data).returning().get();
}

export function updateShare(id: string, data: Partial<NewShare>) {
  return getDatabase().update(share).set(data).where(eq(share.id, id)).returning().get();
}

export function deleteShare(id: string) {
  return getDatabase().delete(share).where(eq(share.id, id)).returning().get();
}

export function deleteSharesByEntityId(entityId: string) {
  return getDatabase().delete(share).where(eq(share.entityId, entityId));
}
