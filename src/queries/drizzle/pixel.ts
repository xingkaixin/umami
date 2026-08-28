import { and, asc, count, desc, eq, isNull, or } from 'drizzle-orm';
import { getDatabase } from '@/db/client';
import { contains, paginate } from '@/db/pagination';
import { type NewPixel, pixel } from '@/db/schema';
import { sanitizeSortFilters } from '@/lib/sort';
import type { QueryFilters } from '@/lib/types';

const SORT_FIELDS = ['name', 'slug', 'createdAt'] as const;

export async function getPixel(id: string) {
  return (await getDatabase().select().from(pixel).where(eq(pixel.id, id)).get()) ?? null;
}

export async function getPixelBySlug(slug: string) {
  return (
    (await getDatabase()
      .select()
      .from(pixel)
      .where(and(eq(pixel.slug, slug), isNull(pixel.deletedAt)))
      .get()) ?? null
  );
}

async function listPixels(owner: { userId?: string; teamId?: string }, filters: QueryFilters = {}) {
  const db = getDatabase();
  const options = sanitizeSortFilters(filters, SORT_FIELDS);
  const where = and(
    owner.userId ? eq(pixel.userId, owner.userId) : undefined,
    owner.teamId ? eq(pixel.teamId, owner.teamId) : undefined,

    options.search
      ? or(contains(pixel.name, options.search), contains(pixel.slug, options.search))
      : undefined,
  );
  const sort = pixel[options.orderBy as (typeof SORT_FIELDS)[number]] ?? pixel.createdAt;
  return paginate(
    db
      .select()
      .from(pixel)
      .where(where)
      .orderBy(options.sortDescending ? desc(sort) : asc(sort), asc(pixel.id))
      .$dynamic(),
    db.select({ count: count() }).from(pixel).where(where),
    options,
  );
}

export function getUserPixels(userId: string, filters?: QueryFilters) {
  return listPixels({ userId }, filters);
}

export function getTeamPixels(teamId: string, filters?: QueryFilters) {
  return listPixels({ teamId }, filters);
}

export async function createPixel(data: NewPixel) {
  return getDatabase().insert(pixel).values(data).returning().get();
}

export async function updatePixel(id: string, data: Partial<NewPixel>) {
  return getDatabase().update(pixel).set(data).where(eq(pixel.id, id)).returning().get();
}

export async function deletePixel(id: string) {
  return getDatabase().delete(pixel).where(eq(pixel.id, id)).returning().get();
}
