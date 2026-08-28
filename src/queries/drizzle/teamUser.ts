import { and, asc, count, eq, getTableColumns, isNull } from 'drizzle-orm';
import { getDatabase } from '@/db/client';
import { contains, paginate } from '@/db/pagination';
import { type NewTeamUser, teamUser, user } from '@/db/schema';
import { uuid } from '@/lib/crypto';
import type { QueryFilters } from '@/lib/types';

export async function getTeamUser(teamId: string, userId: string) {
  return (
    (await getDatabase()
      .select()
      .from(teamUser)
      .where(and(eq(teamUser.teamId, teamId), eq(teamUser.userId, userId)))
      .get()) ?? null
  );
}

export function getTeamUsers(teamId: string, filters: QueryFilters = {}) {
  const db = getDatabase();
  const where = and(
    eq(teamUser.teamId, teamId),
    isNull(user.deletedAt),
    contains(user.username, filters.search),
  );
  return paginate(
    db
      .select({ ...getTableColumns(teamUser), user: { id: user.id, username: user.username } })
      .from(teamUser)
      .innerJoin(user, eq(teamUser.userId, user.id))
      .where(where)
      .orderBy(asc(teamUser.createdAt), asc(teamUser.id))
      .$dynamic(),
    db
      .select({ count: count() })
      .from(teamUser)
      .innerJoin(user, eq(teamUser.userId, user.id))
      .where(where),
    filters,
  );
}

export async function getTeamMemberIds(teamId: string) {
  const rows = await getDatabase()
    .select({ userId: teamUser.userId })
    .from(teamUser)
    .where(eq(teamUser.teamId, teamId));
  return rows.map(row => row.userId);
}

export function createTeamUser(userId: string, teamId: string, role: string) {
  return getDatabase()
    .insert(teamUser)
    .values({ id: uuid(), userId, teamId, role })
    .returning()
    .get();
}

export function updateTeamUser(id: string, data: Partial<NewTeamUser>) {
  return getDatabase().update(teamUser).set(data).where(eq(teamUser.id, id)).returning().get();
}

export function deleteTeamUser(teamId: string, userId: string) {
  return getDatabase()
    .delete(teamUser)
    .where(and(eq(teamUser.teamId, teamId), eq(teamUser.userId, userId)));
}
