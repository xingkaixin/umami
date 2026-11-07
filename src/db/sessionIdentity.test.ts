import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest';
import { tryClaimAnonymousSession } from '@/queries/sql/sessions/tryClaimAnonymousSession';
import { updateSession } from '@/queries/sql/sessions/updateSession';
import { createTestDatabase, resetTestDatabase } from '@/test/database';
import { getDatabase } from './client';
import { session, sessionLink } from './schema';

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

test('lets only one identity claim an anonymous session', async () => {
  const db = getDatabase();
  await db.insert(session).values([
    { id: 'anonymous', websiteId: 'website' },
    { id: 'identified', websiteId: 'website', distinctId: 'owner' },
  ]);
  const claim = (sessionId: string, distinctId: string) =>
    tryClaimAnonymousSession({
      websiteId: 'website',
      sessionId,
      distinctId,
      createdAt: new Date(),
    });
  const ids = ['a', 'b', 'c', 'd'];

  const results = await Promise.all(ids.map(id => claim('anonymous', id)));
  const winner = ids[results.indexOf(true)];
  expect(results.filter(Boolean)).toHaveLength(1);
  await expect(claim('anonymous', winner)).resolves.toBe(true);
  await expect(claim('identified', 'other')).resolves.toBe(false);
  await expect(claim('identified', 'owner')).resolves.toBe(true);
  const links = await db
    .select({ sessionId: sessionLink.sessionId, distinctId: sessionLink.distinctId })
    .from(sessionLink);
  expect(links).toHaveLength(2);
  expect(links).toEqual(
    expect.arrayContaining([
      { sessionId: 'anonymous', distinctId: winner },
      { sessionId: 'identified', distinctId: 'owner' },
    ]),
  );
});
