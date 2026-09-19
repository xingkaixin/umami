import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest';
import { updateSession } from '@/queries/sql/sessions/updateSession';
import { createTestDatabase, resetTestDatabase } from '@/test/database';
import { getDatabase } from './client';
import { session } from './schema';

let worker: Awaited<ReturnType<typeof createTestDatabase>>;
beforeAll(async () => {
  worker = await createTestDatabase();
}, 30_000);
beforeEach(resetTestDatabase);
afterAll(() => worker?.dispose());

test('assigns anonymous sessions without overwriting an existing identity', async () => {
  const db = getDatabase();
  await db.insert(session).values([
    { id: 'known', websiteId: 'website', distinctId: 'original' },
    { id: 'anonymous', websiteId: 'website' },
  ]);
  await updateSession({ websiteId: 'website', sessionId: 'known', distinctId: 'other' });
  await updateSession({ websiteId: 'website', sessionId: 'anonymous', distinctId: 'new' });
  const rows = await db.select({ id: session.id, distinctId: session.distinctId }).from(session);
  expect(rows).toEqual(
    expect.arrayContaining([
      { id: 'known', distinctId: 'original' },
      { id: 'anonymous', distinctId: 'new' },
    ]),
  );
});
