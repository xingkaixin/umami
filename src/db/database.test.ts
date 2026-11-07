import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { checkRateLimit, recordFailedAttempt } from '@/lib/two-factor/rate-limit';
import { createTeam } from '@/queries/drizzle/team';
import {
  confirmTwoFactorSetup,
  consumeOtp,
  getTwoFactorAuth,
  getUnusedBackupCodes,
  savePendingTwoFactor,
} from '@/queries/drizzle/twoFactor';
import { createUser } from '@/queries/drizzle/user';
import { createWebsite, getWebsite, resetWebsite } from '@/queries/drizzle/website';
import { env } from '@/test/cloudflare';
import { createTestDatabase, resetTestDatabase } from '@/test/database';
import { getDatabase } from './client';
import { eventData, session, share, team, teamUser, twoFactorAuth, websiteEvent } from './schema';

let worker: Awaited<ReturnType<typeof createTestDatabase>>;

beforeAll(async () => {
  worker = await createTestDatabase();
  env.LOG_QUERY = '1';
}, 30_000);
beforeEach(resetTestDatabase);
afterAll(async () => {
  env.LOG_QUERY = undefined;
  await worker?.dispose();
});

describe('D1 data access', () => {
  it('creates a team together with its owner', async () => {
    const userId = crypto.randomUUID();
    const teamId = crypto.randomUUID();
    await createUser({ id: userId, username: 'owner', password: 'hash', role: 'user' });
    await createTeam({ id: teamId, name: 'Team' }, userId);
    const db = getDatabase();
    expect(await db.select().from(team).where(eq(team.id, teamId)).get()).toMatchObject({
      name: 'Team',
    });
    expect(await db.select().from(teamUser).get()).toMatchObject({ teamId, userId });
  });

  it('rolls back all writes if a batch violates a constraint', async () => {
    const db = getDatabase();
    const entityId = crypto.randomUUID();
    const data = { entityId, name: 'Share', shareType: 1, slug: 'duplicate', parameters: {} };
    await expect(
      db.batch([
        db.insert(share).values({ id: crypto.randomUUID(), ...data }),
        db.insert(share).values({ id: crypto.randomUUID(), ...data }),
      ]),
    ).rejects.toThrow();
    expect(await db.select().from(share)).toEqual([]);
  });

  it('preserves decimal precision and UTC timestamps through D1', async () => {
    const db = getDatabase();
    const createdAt = new Date('2026-03-29T01:30:00.123Z');
    await db.insert(eventData).values({
      id: crypto.randomUUID(),
      websiteId: crypto.randomUUID(),
      websiteEventId: crypto.randomUUID(),
      dataKey: 'amount',
      dataType: 2,
      numberValue: '999999999999999.9999',
      dateValue: createdAt,
      createdAt,
    });
    const row = await db.select().from(eventData).get();
    expect(row.numberValue).toBe('999999999999999.9999');
    expect(row.dateValue).toEqual(createdAt);
    expect(row.createdAt).toEqual(createdAt);
  });

  it('resets only the selected website and removes event properties with a drifted website ID', async () => {
    const db = getDatabase();
    const websiteId = crypto.randomUUID();
    const otherWebsiteId = crypto.randomUUID();
    const sessionId = crypto.randomUUID();
    const eventId = crypto.randomUUID();
    await createWebsite({ id: websiteId, name: 'Selected' });
    await createWebsite({ id: otherWebsiteId, name: 'Other' });
    await db.insert(session).values({ id: sessionId, websiteId });
    await db
      .insert(websiteEvent)
      .values({ id: eventId, websiteId, sessionId, visitId: crypto.randomUUID(), urlPath: '/' });
    await db.insert(eventData).values({
      id: crypto.randomUUID(),
      websiteId: otherWebsiteId,
      websiteEventId: eventId,
      dataKey: 'legacy',
      dataType: 1,
    });
    await resetWebsite(websiteId);
    expect(await db.select().from(websiteEvent)).toEqual([]);
    expect(await db.select().from(eventData)).toEqual([]);
    expect((await getWebsite(websiteId)).resetAt).toBeInstanceOf(Date);
    expect((await getWebsite(otherWebsiteId)).resetAt).toBeNull();
  });

  it('allows only one concurrent request to consume an OTP', async () => {
    const userId = crypto.randomUUID();
    await getDatabase().insert(twoFactorAuth).values({ userId, secret: 'secret', isEnabled: true });
    const consumed = await Promise.all(
      Array.from({ length: 5 }, () => consumeOtp(userId, '123456', 'secret')),
    );
    expect(consumed.filter(Boolean)).toHaveLength(1);
  });

  it('does not overwrite backup codes when a setup OTP is replayed', async () => {
    const userId = crypto.randomUUID();
    await savePendingTwoFactor(userId, 'encrypted-secret');
    expect(await confirmTwoFactorSetup(userId, '123456', ['first-code'], 'encrypted-secret')).toBe(
      true,
    );
    expect(
      await confirmTwoFactorSetup(userId, '123456', ['replacement-code'], 'encrypted-secret'),
    ).toBe(false);
    expect((await getTwoFactorAuth(userId)).isEnabled).toBe(true);
    expect((await getUnusedBackupCodes(userId)).map(row => row.codeHash)).toEqual(['first-code']);
  });

  it('counts concurrent failed attempts atomically', async () => {
    const userId = crypto.randomUUID();
    await Promise.all(Array.from({ length: 5 }, () => recordFailedAttempt(userId)));
    expect(await checkRateLimit(userId)).toMatchObject({
      allowed: false,
      lockedUntil: expect.any(Date),
    });
  });
});

it('does not enable a replaced pending 2FA secret', async () => {
  const userId = crypto.randomUUID();
  await savePendingTwoFactor(userId, 'old-secret');
  await savePendingTwoFactor(userId, 'new-secret');
  const confirmed = await confirmTwoFactorSetup(userId, '123456', ['backup'], 'old-secret');
  console.info('Stale 2FA setup accepted:', confirmed);
  expect(confirmed).toBe(false);
  expect((await getTwoFactorAuth(userId)).isEnabled).toBe(false);
  expect(await getUnusedBackupCodes(userId)).toEqual([]);
});

it('normalizes username lookups and hides deleted users unless requested', async () => {
  const { getUserByUsername, updateUser } = await import('@/queries/drizzle/user');
  const id = crypto.randomUUID();
  await createUser({ id, username: 'kaki87', password: 'hash', role: 'user' });
  expect(await getUserByUsername('KaKi87', { includePassword: true })).toMatchObject({
    id,
    password: 'hash',
  });
  await updateUser(id, { deletedAt: new Date() });
  expect(await getUserByUsername('KaKi87')).toBeNull();
  expect(await getUserByUsername('KaKi87', { showDeleted: true })).toMatchObject({
    id,
    password: undefined,
  });
});

it('deletes website data and shares without touching another website', async () => {
  const { deleteWebsite } = await import('@/queries/drizzle/website');
  const { heatmapEvent } = await import('./schema');
  const id = crypto.randomUUID();
  const otherId = crypto.randomUUID();
  await createWebsite({ id, name: 'Delete' });
  await createWebsite({ id: otherId, name: 'Keep' });
  const db = getDatabase();
  await db.insert(heatmapEvent).values({
    id: crypto.randomUUID(),
    websiteId: id,
    sessionId: crypto.randomUUID(),
    visitId: crypto.randomUUID(),
    eventType: 1,
    urlPath: '/',
  });
  await db.insert(share).values({
    id: crypto.randomUUID(),
    entityId: id,
    shareType: 1,
    slug: 'deleted-site',
    name: 'Share',
    parameters: {},
  });
  await deleteWebsite(id);
  expect(await getWebsite(id)).toBeNull();
  expect(await getWebsite(otherId)).toMatchObject({ id: otherId });
  expect(await db.select().from(heatmapEvent)).toEqual([]);
  expect(await db.select().from(share)).toEqual([]);
});

it('creates a board when the optional description is omitted', async () => {
  const { POST } = await import('@/app/api/boards/route');
  const { hash, secret } = await import('@/lib/crypto');
  const { createSecureToken } = await import('@/lib/jwt');
  const { getBoard } = await import('@/queries/drizzle/board');
  const userId = crypto.randomUUID();
  await createUser({ id: userId, username: 'board-owner', password: 'hash', role: 'user' });
  const token = createSecureToken({ userId, pwd: hash('hash') }, secret());
  const response = await POST(
    new Request('http://localhost/api/boards', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Board', type: 'mixed' }),
    }),
  );
  const result = await response.json();
  expect(response.status).toBe(200);
  expect(await getBoard(result.id)).toMatchObject({ name: 'Board', description: '' });
});

it('only lists team access codes for members who can edit the team', async () => {
  const { getUserTeams } = await import('@/queries/drizzle/team');
  const ownerId = crypto.randomUUID();
  const viewerId = crypto.randomUUID();
  const teamId = crypto.randomUUID();
  await createUser({ id: ownerId, username: 'owner', password: 'hash', role: 'user' });
  await createTeam({ id: teamId, name: 'Team', accessCode: 'team_secret' }, ownerId);
  await getDatabase()
    .insert(teamUser)
    .values({ id: crypto.randomUUID(), teamId, userId: viewerId, role: 'team-view-only' });
  expect((await getUserTeams(ownerId)).data[0].accessCode).toBe('team_secret');
  expect((await getUserTeams(viewerId)).data[0]).not.toHaveProperty('accessCode');
});

it('limits a login to 2FA setup routes until required 2FA is enabled', async () => {
  const { POST: login } = await import('@/app/api/auth/login/route');
  const { GET: getStatus } = await import('@/app/api/2fa/status/route');
  const { GET: getTeams } = await import('@/app/api/me/teams/route');
  const { hashPassword } = await import('@/lib/password');
  const { setGlobalTwoFactorRequired } = await import('@/queries/drizzle/twoFactor');
  vi.stubEnv('TWO_FACTOR_ENCRYPTION_KEY', 'a'.repeat(64));
  const userId = crypto.randomUUID();
  await createUser({ id: userId, username: 'alice', password: hashPassword('pass'), role: 'user' });
  await setGlobalTwoFactorRequired(true);
  const response = await login(
    new Request('http://localhost/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'alice', password: 'pass' }),
    }),
  );
  const { token } = await response.json();
  const get = (handler: (request: Request) => Promise<Response>, path: string) =>
    handler(
      new Request(`http://localhost${path}`, { headers: { authorization: `Bearer ${token}` } }),
    );

  expect((await get(getTeams, '/api/me/teams')).status).toBe(403);
  expect((await get(getStatus, '/api/2fa/status')).status).toBe(200);
  await getDatabase().insert(twoFactorAuth).values({ userId, secret: 'secret', isEnabled: true });
  expect((await get(getTeams, '/api/me/teams')).status).toBe(200);
  vi.unstubAllEnvs();
});
