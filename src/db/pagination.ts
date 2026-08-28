import { type SQLWrapper, sql } from 'drizzle-orm';
import type { SQLiteSelect } from 'drizzle-orm/sqlite-core';
import { DEFAULT_PAGE_SIZE } from '@/lib/constants';
import type { QueryFilters } from '@/lib/types';

export function contains(column: SQLWrapper, value?: string) {
  return value ? sql`instr(lower(${column}), lower(${value})) > 0` : undefined;
}

export function getPage(filters: QueryFilters = {}) {
  const page = Number(filters.page ?? 1);
  const pageSize = Number(filters.pageSize) || DEFAULT_PAGE_SIZE;
  const offset = pageSize > 0 ? pageSize * (page - 1) : 0;
  if (
    !Number.isSafeInteger(page) ||
    page < 1 ||
    !Number.isSafeInteger(pageSize) ||
    !Number.isSafeInteger(offset)
  ) {
    throw new RangeError('Invalid pagination.');
  }
  return { page, pageSize, offset };
}

export async function paginate<T extends SQLiteSelect>(
  query: T,
  countQuery: PromiseLike<{ count: number }[]>,
  filters: QueryFilters = {},
) {
  const { page, pageSize, offset } = getPage(filters);
  const [data, counts] = await Promise.all([
    pageSize > 0 ? query.limit(pageSize).offset(offset) : query,
    countQuery,
  ]);
  return {
    data,
    count: counts[0]?.count ?? 0,
    page,
    pageSize,
    orderBy: filters.orderBy,
    search: filters.search,
  };
}
