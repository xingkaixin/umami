import { and, asc, count, desc, eq, isNull, or } from 'drizzle-orm';
import { getDatabase } from '@/db/client';
import { contains, paginate } from '@/db/pagination';
import { link, type NewLink } from '@/db/schema';
import { sanitizeSortFilters } from '@/lib/sort';
import type { QueryFilters } from '@/lib/types';

const SORT_FIELDS = ['name', 'slug', 'url', 'createdAt'] as const;

export async function getLink(id: string) {
  return (await getDatabase().select().from(link).where(eq(link.id, id)).get()) ?? null;
}

export async function getLinkBySlug(slug: string) {
  return (
    (await getDatabase()
      .select()
      .from(link)
      .where(and(eq(link.slug, slug), isNull(link.deletedAt)))
      .get()) ?? null
  );
}

async function listLinks(owner: { userId?: string; teamId?: string }, filters: QueryFilters = {}) {
  const db = getDatabase();
  const options = sanitizeSortFilters(filters, SORT_FIELDS);
  const where = and(
    owner.userId ? eq(link.userId, owner.userId) : undefined,
    owner.teamId ? eq(link.teamId, owner.teamId) : undefined,
    owner.userId ? isNull(link.deletedAt) : undefined,
    options.search
      ? or(
          contains(link.name, options.search),
          contains(link.url, options.search),
          contains(link.slug, options.search),
        )
      : undefined,
  );
  const sort = link[options.orderBy as (typeof SORT_FIELDS)[number]] ?? link.createdAt;
  return paginate(
    db
      .select()
      .from(link)
      .where(where)
      .orderBy(options.sortDescending ? desc(sort) : asc(sort), asc(link.id))
      .$dynamic(),
    db.select({ count: count() }).from(link).where(where),
    options,
  );
}

export function getUserLinks(userId: string, filters?: QueryFilters) {
  return listLinks({ userId }, filters);
}

export function getTeamLinks(teamId: string, filters?: QueryFilters) {
  return listLinks({ teamId }, filters);
}

export async function createLink(data: NewLink) {
  return getDatabase().insert(link).values(data).returning().get();
}

export async function updateLink(id: string, data: Partial<NewLink>) {
  return getDatabase().update(link).set(data).where(eq(link.id, id)).returning().get();
}

export async function deleteLink(id: string) {
  return getDatabase().delete(link).where(eq(link.id, id)).returning().get();
}
