import { and, asc, count, desc, eq, getTableColumns, isNull, type SQL, sql } from 'drizzle-orm';
import { getDatabase } from '@/db/client';
import { deleteOwnedEntities, deleteWebsiteData } from '@/db/delete';
import { contains, paginate } from '@/db/pagination';
import {
  type NewUser,
  report,
  segment,
  share,
  team,
  teamUser,
  twoFactorAuth,
  twoFactorBackupCode,
  twoFactorOtpUsed,
  twoFactorRateLimit,
  user,
  website,
} from '@/db/schema';
import { ROLES } from '@/lib/constants';
import { sanitizeSortFilters } from '@/lib/sort';
import type { QueryFilters } from '@/lib/types';

const SORT_FIELDS = ['username', 'role', 'createdAt'] as const;

export interface GetUserOptions {
  includePassword?: boolean;
  showDeleted?: boolean;
}

async function findUser(where: SQL, options: GetUserOptions = {}) {
  const result = await getDatabase()
    .select({
      id: user.id,
      username: user.username,
      password: user.password,
      role: user.role,
      createdAt: user.createdAt,
      twoFactorRequired: user.twoFactorRequired,
    })
    .from(user)
    .where(and(where, options.showDeleted ? undefined : isNull(user.deletedAt)))
    .get();
  if (!result) return null;
  const { password, ...publicUser } = result;
  return options.includePassword ? result : { ...publicUser, password: undefined };
}

export function getUser(id: string, options?: GetUserOptions) {
  return findUser(eq(user.id, id), options);
}

export function getUserByUsername(username: string, options?: GetUserOptions) {
  return findUser(eq(user.username, username.toLowerCase()), options);
}

export function getUsers(filters: QueryFilters = {}) {
  const db = getDatabase();
  const options = sanitizeSortFilters(filters, SORT_FIELDS, {
    orderBy: 'createdAt',
    sortDescending: true,
  });
  const where = and(isNull(user.deletedAt), contains(user.username, options.search));
  const { password, ...columns } = getTableColumns(user);
  const sort = user[options.orderBy as (typeof SORT_FIELDS)[number]];
  return paginate(
    db
      .select({
        ...columns,
        _count: {
          websites: sql<number>`(select count(*) from website where website.user_id = user.user_id and website.deleted_at is null)`,
        },
      })
      .from(user)
      .where(where)
      .orderBy(options.sortDescending ? desc(sort) : asc(sort), asc(user.id))
      .$dynamic(),
    db.select({ count: count() }).from(user).where(where),
    options,
  );
}

export function createUser(data: NewUser) {
  return getDatabase()
    .insert(user)
    .values(data)
    .returning({ id: user.id, username: user.username, role: user.role })
    .get();
}

export function updateUser(id: string, data: Partial<NewUser>) {
  return getDatabase()
    .update(user)
    .set(data)
    .where(eq(user.id, id))
    .returning({ id: user.id, username: user.username, role: user.role, createdAt: user.createdAt })
    .get();
}

export function deleteUser(id: string) {
  const db = getDatabase();
  const websiteIds = sql`select website_id from website where user_id = ${id}`;
  const teamIds = sql`select team_id from team_user where user_id = ${id} and role = ${ROLES.teamOwner}`;
  return db.batch([
    ...deleteWebsiteData(db, websiteIds),
    ...deleteOwnedEntities(db, sql`user_id = ${id} or team_id in (${teamIds})`),
    db
      .delete(report)
      .where(sql`${report.userId} = ${id} or ${report.websiteId} in (${websiteIds})`),
    db.delete(segment).where(sql`${segment.websiteId} in (${websiteIds})`),
    db.delete(share).where(sql`${share.entityId} in (${websiteIds})`),
    db.delete(website).where(eq(website.userId, id)),
    db.update(website).set({ createdBy: null }).where(eq(website.createdBy, id)),
    db.update(website).set({ teamId: null }).where(sql`${website.teamId} in (${teamIds})`),
    db.delete(team).where(sql`${team.id} in (${teamIds})`),
    db
      .delete(teamUser)
      .where(sql`${teamUser.teamId} in (${teamIds}) or ${teamUser.userId} = ${id}`),
    db.delete(twoFactorAuth).where(eq(twoFactorAuth.userId, id)),
    db.delete(twoFactorBackupCode).where(eq(twoFactorBackupCode.userId, id)),
    db.delete(twoFactorOtpUsed).where(eq(twoFactorOtpUsed.userId, id)),
    db.delete(twoFactorRateLimit).where(eq(twoFactorRateLimit.userId, id)),
    db.delete(user).where(eq(user.id, id)).returning(),
  ]);
}
