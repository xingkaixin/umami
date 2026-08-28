import { count } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest';
import { getEventDataNumericStats } from '@/queries/sql/events/getEventDataNumericStats';
import { getChannelMetrics } from '@/queries/sql/getChannelMetrics';
import { saveEvent } from '@/queries/sql/events/saveEvent';
import { getPageviewStats } from '@/queries/sql/pageviews/getPageviewStats';
import { getPerformance } from '@/queries/sql/reports/getPerformance';
import { createSession } from '@/queries/sql/sessions/createSession';
import { saveSessionData } from '@/queries/sql/sessions/saveSessionData';
import { env } from '@/test/cloudflare';
import { createTestDatabase, resetTestDatabase } from '@/test/database';
import { getDatabase } from './client';
import { eventData, revenue, sessionData, websiteEvent } from './schema';

const websiteId = crypto.randomUUID();
const sessionId = crypto.randomUUID();
const visitId = crypto.randomUUID();
const startDate = new Date('2026-03-08T00:00:00Z');
const endDate = new Date('2026-03-09T23:59:59Z');
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

async function record(createdAt: string, properties: Record<string, any> = {}, overrides = {}) {
  return saveEvent({
    websiteId,
    sessionId,
    visitId,
    eventType: 1,
    urlPath: '/',
    createdAt: new Date(createdAt),
    eventData: properties,
    ...overrides,
  });
}

test('writes event properties in batches below D1’s parameter limit', async () => {
  const properties = Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`key-${i}`, i]));
  await record(
    '2026-03-08T06:30:00Z',
    { ...properties, revenue: 1.2345, currency: 'USD' },
    { eventType: 2, eventName: 'purchase' },
  );
  const db = getDatabase();
  expect((await db.select({ count: count() }).from(eventData).get()).count).toBe(32);
  expect((await db.select().from(revenue).get()).revenue).toBe('1.2345');
});

test('does not leave an event behind when its properties cannot be stored', async () => {
  await expect(record('2026-03-08T06:30:00Z', { amount: 1e50 })).rejects.toThrow();
  expect(await getDatabase().select().from(websiteEvent)).toEqual([]);
});

test('groups the spring daylight saving transition in local hours', async () => {
  await record('2026-03-08T06:30:00Z');
  await record('2026-03-08T07:30:00Z');
  expect(
    await getPageviewStats(websiteId, {
      startDate,
      endDate,
      timezone: 'America/New_York',
      unit: 'hour',
    }),
  ).toEqual([
    { x: '2026-03-08 01:00:00', y: 1 },
    { x: '2026-03-08 03:00:00', y: 1 },
  ]);
});

test('keeps repeated filters and event/session property names independent', async () => {
  await record('2026-03-08T06:30:00Z', { plan: 'paid' });
  await saveSessionData({ websiteId, sessionId, sessionData: { plan: 'trial' } });
  expect(
    await getPageviewStats(websiteId, {
      startDate,
      endDate,
      path: 'eq./',
      eventPropertyFilters: [{ propertyName: 'plan', dataType: 1, operator: 'eq', value: 'paid' }],
      sessionPropertyFilters: [
        { propertyName: 'plan', dataType: 1, operator: 'eq', value: 'trial' },
      ],
    }),
  ).toEqual([{ x: '2026-03-08T00:00:00Z', y: 1 }]);
});

test('applies regex filters to older sessions active in the selected period', async () => {
  await createSession({
    id: sessionId,
    websiteId,
    browser: 'Chrome',
    createdAt: new Date('2020-01-01'),
  });
  await record('2026-03-08T06:30:00Z');
  expect(await getPageviewStats(websiteId, { startDate, endDate, browser: 're.^chr' })).toEqual([
    { x: '2026-03-08T00:00:00Z', y: 1 },
  ]);
});

test('keeps the cohort action required when matching any demographic filter', async () => {
  for (const [country, browser, eventName] of [
    ['US', 'Firefox', 'purchase'],
    ['DE', 'Chrome', 'purchase'],
    ['US', 'Chrome', 'signup'],
    ['DE', 'Firefox', 'purchase'],
  ]) {
    const id = crypto.randomUUID();
    await createSession({ id, websiteId, country, browser });
    await record(
      '2026-03-06T12:00:00Z',
      {},
      {
        sessionId: id,
        eventType: 2,
        eventName,
      },
    );
    await record('2026-03-08T12:00:00Z', {}, { sessionId: id });
  }
  const filters = {
    startDate,
    endDate,
    cohort_startDate: new Date('2026-03-01'),
    cohort_endDate: new Date('2026-03-07'),
    cohort_event: 'eq.purchase',
    cohort_eventType: 'eq.2',
    cohort_actionName: 'cohort_event',
    cohort_country: 'eq.US',
    cohort_browser: 'eq.Chrome',
  };
  const anyFilters = { ...filters, cohort_match: 'any' };
  const allFilters = { ...filters, cohort_match: 'all' };
  expect(await getPageviewStats(websiteId, anyFilters)).toEqual([
    { x: '2026-03-08T00:00:00Z', y: 2 },
  ]);
  expect(await getPageviewStats(websiteId, allFilters)).toEqual([]);
});

test('preserves session property timestamps when updating without an explicit date', async () => {
  await saveSessionData({
    websiteId,
    sessionId,
    sessionData: { plan: 'trial' },
    createdAt: startDate,
  });
  await saveSessionData({ websiteId, sessionId, sessionData: { plan: 'paid' } });
  expect(await getDatabase().select().from(sessionData).get()).toMatchObject({
    stringValue: 'paid',
    createdAt: startDate,
  });
});

test('calculates numeric aggregates by value instead of decimal text order', async () => {
  for (const amount of [1, 2, 10, 20]) {
    await record('2026-03-08T06:30:00Z', { amount }, { eventType: 2, eventName: 'purchase' });
  }
  expect(
    await getEventDataNumericStats(websiteId, 'purchase', 'amount', { startDate, endDate }),
  ).toEqual({ total: 33, average: 8.25, median: 6, max: 20, min: 1 });
});

test('recognizes paid advertising parameters with literal underscores', async () => {
  await record(
    '2026-03-08T06:30:00Z',
    {},
    {
      urlQuery: 'ad_id=123',
      referrerDomain: 'example.com',
      hostname: 'site.com',
    },
  );
  const result = await getChannelMetrics(websiteId, { startDate, endDate });
  console.info('Paid channel result:', result);
  expect(result).toEqual([{ x: 'paidAds', y: 1 }]);
});

test('interpolates performance percentiles and excludes missing measurements', async () => {
  for (const [index, lcp] of [1, 2, 10, 20].entries()) {
    await record('2026-03-08T06:30:00Z', {}, { eventType: 5, lcp, inp: index < 2 ? null : lcp });
  }
  const result = await getPerformance(
    websiteId,
    { startDate, endDate, metric: 'lcp', timezone: 'utc', unit: 'day' },
    {},
  );
  expect(result.chart).toEqual([
    { t: '2026-03-08T00:00:00Z', p50: 6, p75: 12.5, p95: expect.closeTo(18.5) },
  ]);
  expect(result.summary).toMatchObject({
    lcp: { p50: 6, p75: 12.5, p95: expect.closeTo(18.5) },
    inp: { p50: 15, p75: 17.5, p95: expect.closeTo(19.5) },
    count: 4,
  });
});

test('uses the historical offset of session property timestamps outside the event range', async () => {
  const { getSessionDataNumericSeries } = await import(
    '@/queries/sql/sessions/getSessionDataNumericSeries'
  );
  await record('2026-08-10T12:00:00Z');
  await saveSessionData({
    websiteId,
    sessionId,
    sessionData: { amount: 10 },
    createdAt: new Date('2026-01-01T13:00:00Z'),
  });
  const result = await getSessionDataNumericSeries(websiteId, 'amount', 'sum', {
    startDate: new Date('2026-08-01'),
    endDate: new Date('2026-08-31'),
    timezone: 'America/New_York',
    unit: 'hour',
  });
  console.info('Historical property bucket:', result);
  expect(result).toEqual([{ t: '2026-01-01 08:00:00', y: 10 }]);
});
