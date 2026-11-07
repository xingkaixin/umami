import { afterAll, beforeAll, expect, test } from 'vitest';
import * as q from '@/queries/sql';
import { getGoal } from '@/queries/sql/reports/getGoal';
import { createTestDatabase } from '@/test/database';
import { getDatabase } from './client';
import { website } from './schema';

const site = crypto.randomUUID();
const dates = { startDate: new Date('2026-08-01'), endDate: new Date('2026-08-31') };
let worker: Awaited<ReturnType<typeof createTestDatabase>>;

beforeAll(async () => {
  worker = await createTestDatabase();
  await getDatabase().insert(website).values({ id: site, name: 'Test', domain: 'example.com' });
  for (const [browser, urlPath] of [
    ['Chrome', '/blog/a/edit'],
    ['Firefox', '/blog/a/view'],
    ['Safari', '/50%off'],
    ['Edge', '/50xoff'],
    ['Opera', '/my_page/b'],
    ['Brave', '/myxpage/b'],
  ]) {
    const sessionId = crypto.randomUUID();
    const createdAt = new Date('2026-08-10T12:00:00Z');
    await q.createSession({ id: sessionId, websiteId: site, browser, createdAt });
    await q.saveEvent({
      websiteId: site,
      sessionId,
      visitId: crypto.randomUUID(),
      eventType: 1,
      urlPath,
      createdAt,
    });
  }
}, 30_000);
afterAll(async () => {
  await worker?.dispose();
});

test('multi-value search matches each term as a substring', async () => {
  const rows = await q.getValues(site, 'browser', { ...dates, search: 'chro,FIRE' });
  expect(rows.map(row => row.value).sort()).toEqual(['Chrome', 'Firefox']);
});

test('search treats % and _ literally', async () => {
  const percent = await q.getValues(site, 'url_path', { ...dates, search: '50%' });
  const underscore = await q.getValues(site, 'url_path', { ...dates, search: 'my_page' });
  expect(percent.map(row => row.value)).toEqual(['/50%off']);
  expect(underscore.map(row => row.value)).toEqual(['/my_page/b']);
});

test.each([
  ['/blog/*/edit', 1],
  ['/blog/*', 2],
  ['*/b', 2],
  ['/my_page/*', 1],
  ['/50%off', 1],
])('goal %s matches %i sessions', async (value, num) => {
  const row = await getGoal(site, { ...dates, type: 'path', value }, {});
  expect(row.num).toBe(num);
});

test('funnel steps support inner wildcards', async () => {
  const steps = [{ type: 'path', value: '/blog/*/edit' }];
  expect(await q.getFunnel(site, { ...dates, window: 30, steps }, {})).toEqual([
    expect.objectContaining({ visitors: 1 }),
  ]);
});
