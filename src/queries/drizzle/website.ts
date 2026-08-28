import { and, asc, count, desc, eq, getTableColumns, isNull, or, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core';
import { z } from 'zod';
import { getDatabase } from '@/db/client';
import { deleteWebsiteData } from '@/db/delete';
import { contains, paginate } from '@/db/pagination';
import {
  type NewWebsite,
  report,
  segment,
  share,
  team,
  teamUser,
  user,
  website,
} from '@/db/schema';
import { ROLES } from '@/lib/constants';
import { sanitizeSortFilters } from '@/lib/sort';
import type { QueryFilters } from '@/lib/types';

const SORT_FIELDS = ['name', 'domain', 'createdAt'] as const;
const creator = alias(user, 'creator');
const shareId = sql<
  string | null
>`(select slug from share where entity_id = website.website_id order by created_at desc, share_id asc limit 1)`;

export async function getWebsite(id: string) {
  if (!z.uuid().safeParse(id).success) return null;
  return (
    (await getDatabase()
      .select({ ...getTableColumns(website), shareId })
      .from(website)
      .where(eq(website.id, id))
      .get()) ?? null
  );
}

export async function getAccessibleWebsiteIds(userId: string, ids: string[]) {
  const rows = await getDatabase()
    .select({ id: website.id })
    .from(website)
    .where(
      and(
        sql`${website.id} in (select value from json_each(${JSON.stringify(ids)}))`,
        isNull(website.deletedAt),
        or(
          eq(website.userId, userId),
          sql`exists (
      select 1 from team_user where team_user.team_id = ${website.teamId}
        and team_user.user_id = ${userId}
    )`,
        ),
      ),
    );
  return rows.map(row => row.id);
}

export async function getWebsites(
  filters: QueryFilters = {},
  options: {
    userId?: string;
    teamId?: string;
    accessUserId?: string;
    includeUser?: boolean;
    includeCreator?: boolean;
    includeTeam?: boolean;
  } = {},
) {
  const db = getDatabase();
  const sorting = sanitizeSortFilters(filters, SORT_FIELDS, {
    orderBy: 'createdAt',
    sortDescending: true,
  });
  const where = and(
    isNull(website.deletedAt),
    options.userId ? eq(website.userId, options.userId) : undefined,
    options.teamId ? eq(website.teamId, options.teamId) : undefined,
    options.accessUserId
      ? or(
          eq(website.userId, options.accessUserId),
          sql`${website.teamId} in (
      select team.team_id from team inner join team_user on team_user.team_id = team.team_id
      where team.deleted_at is null and team_user.user_id = ${options.accessUserId}
        and team_user.role in (${ROLES.teamOwner}, ${ROLES.teamManager})
    )`,
        )
      : undefined,
    sorting.search
      ? or(contains(website.name, sorting.search), contains(website.domain, sorting.search))
      : undefined,
  );
  const sort = website[sorting.orderBy as (typeof SORT_FIELDS)[number]];
  const result = await paginate(
    db
      .select({
        ...getTableColumns(website),
        shareId,
        user: { id: user.id, username: user.username },
        createUser: { id: creator.id, username: creator.username },
        team: getTableColumns(team),
      })
      .from(website)
      .leftJoin(user, and(eq(user.id, website.userId), isNull(user.deletedAt)))
      .leftJoin(creator, eq(creator.id, website.createdBy))
      .leftJoin(team, and(eq(team.id, website.teamId), isNull(team.deletedAt)))
      .where(where)
      .orderBy(sorting.sortDescending ? desc(sort) : asc(sort), asc(website.id))
      .$dynamic(),
    db.select({ count: count() }).from(website).where(where),
    sorting,
  );
  const teamIds = options.includeTeam
    ? result.data.flatMap(row => (row.team ? [row.team.id] : []))
    : [];
  const owners = teamIds.length
    ? await db
        .select()
        .from(teamUser)
        .where(
          and(
            sql`${teamUser.teamId} in (select value from json_each(${JSON.stringify(teamIds)}))`,
            eq(teamUser.role, ROLES.teamOwner),
          ),
        )
    : [];
  return {
    ...result,
    data: result.data.map(({ user: owner, createUser, team: ownerTeam, ...row }) => ({
      ...row,
      ...(options.includeUser ? { user: owner } : {}),
      ...(options.includeCreator ? { createUser } : {}),
      ...(options.includeTeam
        ? {
            team: ownerTeam
              ? { ...ownerTeam, members: owners.filter(member => member.teamId === ownerTeam.id) }
              : null,
          }
        : {}),
    })),
  };
}

export function getAllUserWebsitesIncludingTeamAccess(userId: string, filters?: QueryFilters) {
  return getWebsites(sanitizeSortFilters(filters, SORT_FIELDS, { orderBy: 'name' }), {
    accessUserId: userId,
  });
}

export function getUserWebsites(userId: string, filters?: QueryFilters) {
  return getWebsites(sanitizeSortFilters(filters, SORT_FIELDS, { orderBy: 'name' }), {
    userId,
    includeUser: true,
  });
}

export function getTeamWebsites(teamId: string, filters?: QueryFilters) {
  return getWebsites(filters, { teamId, includeCreator: true });
}

export function createWebsite(data: NewWebsite) {
  return getDatabase().insert(website).values(data).returning().get();
}

export function updateWebsite(id: string, data: Partial<NewWebsite>) {
  if (Object.values(data).every(value => value === undefined)) return getWebsite(id);
  return getDatabase().update(website).set(data).where(eq(website.id, id)).returning().get();
}

export async function resetWebsite(id: string) {
  const db = getDatabase();
  const [rows] = await db.batch([
    db.update(website).set({ resetAt: new Date() }).where(eq(website.id, id)).returning(),
    ...deleteWebsiteData(db, sql`select ${id}`),
  ]);
  return rows[0];
}

export async function deleteWebsite(id: string) {
  const db = getDatabase();
  return db.batch([
    ...deleteWebsiteData(db, sql`select ${id}`),
    db.delete(report).where(eq(report.websiteId, id)),
    db.delete(segment).where(eq(segment.websiteId, id)),
    db.delete(share).where(eq(share.entityId, id)),
    db.delete(website).where(eq(website.id, id)).returning(),
  ]);
}

export async function getWebsiteCount(userId: string) {
  return (
    await getDatabase()
      .select({ count: count() })
      .from(website)
      .where(and(eq(website.userId, userId), isNull(website.deletedAt)))
      .get()
  ).count;
}

export async function getTeamWebsiteCount(teamId: string) {
  return (
    await getDatabase()
      .select({ count: count() })
      .from(website)
      .where(and(eq(website.teamId, teamId), isNull(website.deletedAt)))
      .get()
  ).count;
}
