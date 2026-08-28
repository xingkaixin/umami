import { getTableColumns } from 'drizzle-orm';
import type { SQLiteInsertValue, SQLiteTable } from 'drizzle-orm/sqlite-core';
import type { Database } from './client';

export function insertRows<T extends SQLiteTable>(
  db: Database,
  table: T,
  rows: SQLiteInsertValue<T>[],
) {
  const size = Math.floor(100 / Object.keys(getTableColumns(table)).length);
  if (size < 1) throw new Error('Table exceeds D1’s parameter limit.');
  const statements = [];
  for (let index = 0; index < rows.length; index += size) {
    statements.push(db.insert(table).values(rows.slice(index, index + size)));
  }
  return statements;
}
