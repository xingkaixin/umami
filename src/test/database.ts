import { getTableName } from 'drizzle-orm';
import { Miniflare } from 'miniflare';
import * as schema from '@/db/schema';
import journal from '../../db/d1/meta/_journal.json';
import { env } from './cloudflare';

const migrations = import.meta.glob<string>('../../db/d1/*.sql', {
  query: '?raw',
  import: 'default',
  eager: true,
});

export async function createTestDatabase() {
  const worker = new Miniflare({
    workers: [
      {
        config: {
          name: 'umami-test',
          compatibilityDate: '2026-08-28',
          manifest: {
            mainModule: 'worker.mjs',
            modules: {
              'worker.mjs': {
                type: 'esm',
                contents: 'export default { fetch() { return new Response("ok"); } };',
              },
            },
          },
          env: { DB: { type: 'd1', id: 'umami-test' } },
        },
      },
    ],
  });
  try {
    env.DB = (await worker.getD1Database('DB')) as typeof env.DB;
    for (const entry of journal.entries) {
      const migration = migrations[`../../db/d1/${entry.tag}.sql`];
      if (!migration) {
        throw new Error(`Missing D1 migration file: ${entry.tag}.sql`);
      }
      const statements = migration
        .split('--> statement-breakpoint')
        .map(statement => statement.trim())
        .filter(Boolean);
      await env.DB.batch(statements.map(statement => env.DB.prepare(statement)));
    }
    return worker;
  } catch (error) {
    await worker.dispose();
    throw error;
  }
}

export async function resetTestDatabase() {
  await env.DB.batch(
    Object.values(schema).map(table => env.DB.prepare(`delete from "${getTableName(table)}"`)),
  );
}
