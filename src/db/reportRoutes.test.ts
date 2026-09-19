import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest';
import { POST } from '@/app/api/reports/[reportId]/route';
import { hash, secret } from '@/lib/crypto';
import { createSecureToken } from '@/lib/jwt';
import { createReport, getReport } from '@/queries/drizzle/report';
import { createUser } from '@/queries/drizzle/user';
import { createWebsite } from '@/queries/drizzle/website';
import { createTestDatabase, resetTestDatabase } from '@/test/database';

let worker: Awaited<ReturnType<typeof createTestDatabase>>;
let token: string;
let websiteId: string;
let otherWebsiteId: string;
let reportId: string;

beforeAll(async () => {
  worker = await createTestDatabase();
}, 30_000);

beforeEach(async () => {
  await resetTestDatabase();
  const userId = crypto.randomUUID();
  const otherUserId = crypto.randomUUID();
  websiteId = crypto.randomUUID();
  otherWebsiteId = crypto.randomUUID();
  reportId = crypto.randomUUID();
  await createUser({ id: userId, username: 'owner', password: 'hash', role: 'user' });
  await createUser({ id: otherUserId, username: 'other', password: 'hash', role: 'user' });
  await createWebsite({ id: websiteId, userId, name: 'Owned' });
  await createWebsite({ id: otherWebsiteId, userId: otherUserId, name: 'Other' });
  await createReport({
    id: reportId,
    userId,
    websiteId,
    type: 'funnel',
    name: 'Original',
    description: '',
    parameters: {},
  });
  token = createSecureToken({ userId, pwd: hash('hash') }, secret());
});

afterAll(async () => {
  await worker?.dispose();
});

test('updates a report without relocating it to an inaccessible website', async () => {
  const response = await POST(
    new Request('http://localhost/api/reports/test', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        websiteId: otherWebsiteId,
        type: 'funnel',
        name: 'Renamed',
        description: '',
        parameters: {},
      }),
    }),
    { params: Promise.resolve({ reportId }) },
  );
  const saved = await getReport(reportId);
  expect(response.status).toBe(200);
  expect(saved).toMatchObject({ websiteId, name: 'Renamed' });
  expect(await response.json()).toMatchObject({ websiteId, name: 'Renamed' });
});
