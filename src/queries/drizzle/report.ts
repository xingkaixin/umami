import { and, asc, count, eq, getTableColumns, isNull, or } from 'drizzle-orm';
import { getDatabase } from '@/db/client';
import { contains, paginate } from '@/db/pagination';
import { type NewReport, report, user, website } from '@/db/schema';
import type { QueryFilters } from '@/lib/types';

export async function getReport(id: string) {
  return (await getDatabase().select().from(report).where(eq(report.id, id)).get()) ?? null;
}

export async function getReports(
  options: {
    userId?: string;
    websiteId?: string;
    type?: string;
    activeWebsite?: boolean;
    includeWebsite?: boolean;
  },
  filters: QueryFilters = {},
) {
  const db = getDatabase();
  const where = and(
    options.userId ? eq(report.userId, options.userId) : undefined,
    options.websiteId ? eq(report.websiteId, options.websiteId) : undefined,
    options.type ? eq(report.type, options.type) : undefined,
    options.activeWebsite ? isNull(website.deletedAt) : undefined,
    filters.search
      ? or(
          contains(report.name, filters.search),
          contains(report.description, filters.search),
          contains(report.type, filters.search),
          contains(user.username, filters.search),
          contains(website.name, filters.search),
          contains(website.domain, filters.search),
        )
      : undefined,
  );
  const result = await paginate(
    db
      .select({
        ...getTableColumns(report),
        website: { domain: website.domain, userId: website.userId },
      })
      .from(report)
      .leftJoin(user, eq(user.id, report.userId))
      .leftJoin(website, eq(website.id, report.websiteId))
      .where(where)
      .orderBy(asc(report.name), asc(report.id))
      .$dynamic(),
    db
      .select({ count: count() })
      .from(report)
      .leftJoin(user, eq(user.id, report.userId))
      .leftJoin(website, eq(website.id, report.websiteId))
      .where(where),
    filters,
  );
  return {
    ...result,
    data: result.data.map(({ website: websiteInfo, ...row }) =>
      options.includeWebsite ? { ...row, website: websiteInfo } : row,
    ),
  };
}

export function getUserReports(userId: string, filters?: QueryFilters) {
  return getReports({ userId, includeWebsite: true }, filters);
}

export function getWebsiteReports(websiteId: string, filters?: QueryFilters) {
  return getReports({ websiteId }, filters);
}

export function createReport(data: NewReport) {
  return getDatabase().insert(report).values(data).returning().get();
}

export function updateReport(id: string, data: Partial<NewReport>) {
  return getDatabase().update(report).set(data).where(eq(report.id, id)).returning().get();
}

export function deleteReport(id: string) {
  return getDatabase().delete(report).where(eq(report.id, id)).returning().get();
}
