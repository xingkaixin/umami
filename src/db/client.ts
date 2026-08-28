import { env } from 'cloudflare:workers';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from './schema';

export function getDatabase() {
  return drizzle(env.DB, {
    schema,
    logger:
      env.LOG_QUERY === '1'
        ? {
            logQuery: (query, parameters) =>
              console.debug('D1 query', { query, parameterCount: parameters.length }),
          }
        : false,
  });
}

export type Database = ReturnType<typeof getDatabase>;
