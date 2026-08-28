import { type SQL, sql } from 'drizzle-orm';
import type { QueryFilters } from '@/lib/types';
import { getDatabase } from './client';
import { getPage } from './pagination';

export function bindQuery(query: string, data: Record<string, unknown> = {}): SQL {
  const parts: SQL[] = [];
  let position = 0;
  let count = 0;
  for (const match of query.matchAll(/\{\{\s*(\w+)\s*}}/g)) {
    parts.push(sql.raw(query.slice(position, match.index)));
    const value = data[match[1]];
    const parameter =
      value instanceof Date
        ? value.toISOString()
        : Array.isArray(value)
          ? JSON.stringify(value)
          : typeof value === 'boolean'
            ? Number(value)
            : (value ?? null);
    parts.push(sql`${parameter}`);
    position = match.index + match[0].length;
    count++;
  }
  if (count > 100)
    throw new RangeError(
      'The query exceeds D1’s 100 parameter limit. Reduce the number of filters.',
    );
  parts.push(sql.raw(query.slice(position)));
  return sql.join(parts, sql.empty());
}

export async function rawQuery<T = any[]>(
  query: string,
  data: Record<string, unknown> = {},
): Promise<T> {
  return (await getDatabase().all(bindQuery(query, data))) as T;
}

export function writeRawQuery(query: string, data: Record<string, unknown>) {
  return getDatabase().run(bindQuery(query, data));
}

export async function pagedRawQuery(
  query: string,
  parameters: Record<string, unknown>,
  filters: QueryFilters = {},
) {
  const { page, pageSize, offset } = getPage(filters);
  const { orderBy, sortDescending, maxResults } = filters;
  if (orderBy && !/^[a-zA-Z_][\w.]*$/.test(orderBy)) throw new Error('Invalid sort column.');
  if (maxResults !== undefined && (!Number.isSafeInteger(maxResults) || maxResults < 1))
    throw new RangeError('Invalid result limit.');
  const order = orderBy ? ` order by ${orderBy} ${sortDescending ? 'desc' : 'asc'}` : '';
  const limit = pageSize > 0 ? ` limit ${pageSize} offset ${offset}` : '';
  const countQuery = maxResults
    ? `select count(*) as num from (select 1 from (${query}) limit ${maxResults})`
    : `select count(*) as num from (${query})`;
  const [counts, data] = await Promise.all([
    rawQuery(countQuery, parameters),
    rawQuery(orderBy ? `select * from (${query})${order}${limit}` : `${query}${limit}`, parameters),
  ]);
  const count = Number(counts[0].num);
  return { data, count, page, pageSize, orderBy, isCapped: !!maxResults && count >= maxResults };
}
