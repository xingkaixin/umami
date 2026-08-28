import { and, asc, count, desc, eq, getTableColumns, isNull, sql } from 'drizzle-orm';
import { getDatabase } from '@/db/client';
import { deleteOwnedEntities } from '@/db/delete';
import { contains, paginate } from '@/db/pagination';
import { type NewTeam, team, teamUser, user, website } from '@/db/schema';
import { ROLES } from '@/lib/constants';
import { uuid } from '@/lib/crypto';
import { sanitizeSortFilters } from '@/lib/sort';
import type { QueryFilters } from '@/lib/types';

const SORT_FIELDS = ['name', 'createdAt'] as const;

export async function getTeam(id: string, options: { includeMembers?: boolean } = {}) {
  const db = getDatabase();
  const row = await db.select().from(team).where(eq(team.id, id)).get();
  if (!row) return null;
  return options.includeMembers
    ? { ...row, members: await db.select().from(teamUser).where(eq(teamUser.teamId, id)) }
    : row;
}

export async function getTeamByAccessCode(accessCode: string) {
  return (
    (await getDatabase().select().from(team).where(eq(team.accessCode, accessCode)).get()) ?? null
  );
}

export async function getTeams(filters: QueryFilters = {}, userId?: string) {
  const db = getDatabase();
  const options = sanitizeSortFilters(filters, SORT_FIELDS, {
    orderBy: 'createdAt',
    sortDescending: true,
  });
  const where = and(
    userId
      ? and(
          isNull(team.deletedAt),
          sql`${team.id} in (select ${teamUser.teamId} from ${teamUser} where ${teamUser.userId} = ${userId})`,
        )
      : undefined,
    contains(team.name, options.search),
  );
  const sort = team[options.orderBy as (typeof SORT_FIELDS)[number]];
  const result = await paginate(
    db
      .select({
        ...getTableColumns(team),
        _count: {
          websites: sql<number>`(select count(*) from website where website.team_id = team.team_id and website.deleted_at is null)`,
          members: sql<number>`(select count(*) from team_user inner join user on user.user_id = team_user.user_id where team_user.team_id = team.team_id and user.deleted_at is null)`,
        },
      })
      .from(team)
      .where(where)
      .orderBy(options.sortDescending ? desc(sort) : asc(sort), asc(team.id))
      .$dynamic(),
    db.select({ count: count() }).from(team).where(where),
    options,
  );
  if (!result.data.length) return result;
  const ids = JSON.stringify(result.data.map(row => row.id));
  const members = await db
    .select({ ...getTableColumns(teamUser), user: { id: user.id, username: user.username } })
    .from(teamUser)
    .leftJoin(user, eq(teamUser.userId, user.id))
    .where(sql`${teamUser.teamId} in (select value from json_each(${ids}))`);
  return {
    ...result,
    data: result.data.map(row => ({
      ...row,
      members: members.filter(member => member.teamId === row.id),
    })),
  };
}

export function getUserTeams(userId: string, filters?: QueryFilters) {
  return getTeams(filters, userId);
}

export function getAllUserTeams(userId: string) {
  return getDatabase()
    .select({ id: team.id, name: team.name, logoUrl: team.logoUrl })
    .from(team)
    .where(
      and(
        isNull(team.deletedAt),
        sql`${team.id} in (select ${teamUser.teamId} from ${teamUser} where ${teamUser.userId} = ${userId})`,
      ),
    );
}

export async function getUserOwnedTeamCount(userId: string) {
  const row = await getDatabase()
    .select({ count: count() })
    .from(team)
    .where(
      and(
        isNull(team.deletedAt),
        sql`${team.id} in (
      select ${teamUser.teamId} from ${teamUser} where ${teamUser.userId} = ${userId} and ${teamUser.role} = ${ROLES.teamOwner}
    )`,
      ),
    )
    .get();
  return row.count;
}

export async function getTeamOwner(teamId: string) {
  return (
    (await getDatabase()
      .select({ userId: teamUser.userId })
      .from(teamUser)
      .where(and(eq(teamUser.teamId, teamId), eq(teamUser.role, ROLES.teamOwner)))
      .get()) ?? null
  );
}

export function createTeam(data: NewTeam, userId: string) {
  const db = getDatabase();
  return db
    .batch([
      db.insert(team).values(data).returning(),
      db
        .insert(teamUser)
        .values({ id: uuid(), teamId: data.id, userId, role: ROLES.teamOwner })
        .returning(),
    ])
    .then(([teams, members]) => [teams[0], members[0]]);
}

export function updateTeam(id: string, data: Partial<NewTeam>) {
  return getDatabase().update(team).set(data).where(eq(team.id, id)).returning().get();
}

export function deleteTeam(id: string) {
  const db = getDatabase();
  return db.batch([
    ...deleteOwnedEntities(db, sql`team_id = ${id}`),
    db.delete(teamUser).where(eq(teamUser.teamId, id)),
    db.update(website).set({ teamId: null }).where(eq(website.teamId, id)),
    db.delete(team).where(eq(team.id, id)).returning(),
  ]);
}
