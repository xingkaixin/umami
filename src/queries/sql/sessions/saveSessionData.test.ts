import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest';
import { getDatabase } from '@/db/client';
import { sessionData } from '@/db/schema';
import { createTestDatabase, resetTestDatabase } from '@/test/database';
import { saveSessionData } from './saveSessionData';

let worker: Awaited<ReturnType<typeof createTestDatabase>>;
beforeAll(async () => {
  worker = await createTestDatabase();
}, 30_000);
beforeEach(resetTestDatabase);
afterAll(() => worker?.dispose());

test('upserts one property per session and applies explicit timestamps', async () => {
  const args = { websiteId: 'website-1', sessionId: 'session-1', distinctId: 'distinct-1' };
  await saveSessionData({ ...args, sessionData: { plan: 'trial' } });
  const createdAt = new Date('2026-07-30T10:00:00Z');
  await saveSessionData({ ...args, sessionData: { plan: 'pro' }, createdAt });
  expect(await getDatabase().select().from(sessionData)).toEqual([
    expect.objectContaining({ ...args, dataKey: 'plan', stringValue: 'pro', createdAt }),
  ]);
});

test('defaults the initial timestamp and preserves it on later updates', async () => {
  const args = { websiteId: 'website-1', sessionId: 'session-1' };
  const before = Date.now();
  await saveSessionData({ ...args, sessionData: { plan: 'trial' } });
  const first = await getDatabase().select().from(sessionData).get();
  expect(first.createdAt.getTime()).toBeGreaterThanOrEqual(before);
  await saveSessionData({ ...args, sessionData: { plan: 'pro' } });
  const next = await getDatabase().select().from(sessionData).get();
  expect(next).toMatchObject({ id: first.id, createdAt: first.createdAt, stringValue: 'pro' });
});
