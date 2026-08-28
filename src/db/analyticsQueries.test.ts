import { afterAll, beforeAll, expect, test } from 'vitest';
import * as q from '@/queries/sql';
import { getAttribution } from '@/queries/sql/reports/getAttribution';
import { getGoal } from '@/queries/sql/reports/getGoal';
import { getPerformance } from '@/queries/sql/reports/getPerformance';
import { getPerformanceMetrics } from '@/queries/sql/reports/getPerformanceMetrics';
import { getRevenueChart } from '@/queries/sql/reports/getRevenueChart';
import { getRevenueMetrics } from '@/queries/sql/reports/getRevenueMetrics';
import { getRevenueSessions } from '@/queries/sql/reports/getRevenueSessions';
import { getRevenueStats } from '@/queries/sql/reports/getRevenueStats';
import { env } from '@/test/cloudflare';
import { createTestDatabase } from '@/test/database';
import { getDatabase } from './client';
import { website } from './schema';

const site = crypto.randomUUID();
const session = crypto.randomUUID();
const visit = crypto.randomUUID();
const dates = { startDate: new Date('2026-08-01'), endDate: new Date('2026-08-31') };
const filters = { ...dates, unit: 'day', timezone: 'America/New_York' };
const revenueParams = { ...filters, currency: 'USD' };
const performanceParams = { ...filters, metric: 'lcp' };
let worker: Awaited<ReturnType<typeof createTestDatabase>>;

beforeAll(async () => {
  worker = await createTestDatabase();
  env.LOG_QUERY = '1';
  await getDatabase().insert(website).values({ id: site, name: 'Test', domain: 'example.com' });
  await q.createSession({
    id: session,
    websiteId: site,
    browser: 'Chrome',
    language: 'en-US',
    country: 'US',
    region: 'CA',
    city: 'Oakland',
    createdAt: new Date('2026-08-10'),
  });
  const base = {
    websiteId: site,
    sessionId: session,
    visitId: visit,
    hostname: 'example.com',
    referrerDomain: 'google.com',
    urlQuery: 'utm_source=test',
    utmSource: 'test',
    eventData: { plan: 'pro', amount: 10, tags: ['a', 'b'], birthday: '1990-01-01T00:00:00Z' },
  };
  await q.saveEvent({
    ...base,
    eventType: 1,
    urlPath: '/',
    createdAt: new Date('2026-08-10T12:00:00Z'),
  });
  await q.saveEvent({
    ...base,
    eventType: 1,
    urlPath: '/buy',
    createdAt: new Date('2026-08-10T12:01:00Z'),
  });
  await q.saveEvent({
    ...base,
    eventType: 2,
    urlPath: '/buy',
    eventName: 'purchase',
    createdAt: new Date('2026-08-10T12:02:00Z'),
    eventData: { ...base.eventData, revenue: 10, currency: 'USD' },
  });
  await q.saveEvent({
    ...base,
    eventType: 5,
    urlPath: '/buy',
    lcp: 100,
    createdAt: new Date('2026-08-10T12:03:00Z'),
  });
  await q.saveSessionData({
    websiteId: site,
    sessionId: session,
    distinctId: 'buyer',
    sessionData: base.eventData,
    createdAt: new Date('2026-08-10T12:00:00Z'),
  });
  await q.saveSessionLink({ websiteId: site, sessionId: session, distinctId: 'buyer' });
  await q.saveRecording({
    websiteId: site,
    sessionId: session,
    visitId: visit,
    chunkIndex: 0,
    events: [{ type: 2, timestamp: 1786363200000 }],
    eventCount: 1,
    startedAt: new Date('2026-08-10T12:00:00Z'),
    endedAt: new Date('2026-08-10T12:02:00Z'),
  });
  await q.saveHeatmapEvents(
    [1, 2].map(eventType => ({
      websiteId: site,
      sessionId: session,
      visitId: visit,
      eventType,
      urlPath: '/',
      x: 10,
      y: 20,
      pageX: 10,
      pageY: 20,
      pageW: 1024,
      pageH: 2000,
      viewportW: 1024,
      viewportH: 768,
      scrollPct: 80,
      createdAt: new Date('2026-08-10T12:00:00Z'),
    })),
  );
}, 30_000);
afterAll(async () => {
  env.LOG_QUERY = undefined;
  await worker?.dispose();
});

const reads: Record<string, () => Promise<unknown>> = {
  'active visitors': () => q.getActiveVisitors(site),
  channels: () => q.getChannelMetrics(site, filters),
  'expanded channels': () => q.getChannelExpandedMetrics(site, filters),
  'realtime activity': () => q.getRealtimeActivity(site, filters),
  'realtime data': () => q.getRealtimeData(site, filters),
  values: () => q.getValues(site, 'browser', filters),
  'date range': () => q.getWebsiteDateRange(site),
  'site charts': () => q.getWebsiteListCharts([site], filters),
  'site stats': () => q.getWebsiteStats(site, filters),
  weekly: () => q.getWeeklyTraffic(site, filters),
  'event arrays': () => q.getEventDataArraySeries(site, 'purchase', 'tags', filters),
  'event dates': () => q.getEventDataDateSeries(site, 'purchase', 'birthday', filters),
  'event fields': () => q.getEventDataFields(site, 'purchase', filters),
  'event names': () => q.getEventDataEvents(site, filters),
  'event numbers': () => q.getEventDataNumericSeries(site, 'purchase', 'amount', 'sum', filters),
  'event pivot': () => q.getEventDataPivot(site, 'purchase', filters),
  'event properties': () => q.getEventDataProperties(site, filters),
  'event property series': () => q.getEventDataPropertySeries(site, 'purchase', 'plan', filters),
  'event property stats': () => q.getEventDataStats(site, filters),
  'event property usage': () => q.getEventDataUsage([site], filters),
  'event property values': () =>
    q.getEventDataValues(site, 'purchase', { ...filters, propertyName: 'plan' }),
  'event metrics': () => q.getEventMetrics(site, { type: 'event' }, filters),
  'event expanded': () => q.getEventExpandedMetrics(site, { type: 'event' }, filters),
  'event stats': () => q.getEventStats(site, {}, filters),
  'event usage': () => q.getEventUsage([site], filters),
  events: () => q.getWebsiteEvents(site, filters),
  'page paths': () => q.getPageviewMetrics(site, { type: 'path' }, filters),
  'page entry': () => q.getPageviewMetrics(site, { type: 'entry' }, filters),
  'page exit': () => q.getPageviewMetrics(site, { type: 'exit' }, filters),
  'page expanded': () => q.getPageviewExpandedMetrics(site, { type: 'path' }, filters),
  performance: () => q.getPerformanceStats(site, filters),
  'performance report': () => getPerformance(site, performanceParams, {}),
  'performance metrics': () => getPerformanceMetrics(site, performanceParams, {}, 'browser'),
  'replay chunks': () => q.getReplayChunks(site, visit),
  replays: () => q.getSessionReplays(site, filters),
  attribution: () =>
    getAttribution(site, { ...dates, model: 'first-click', type: 'event', step: 'purchase' }, {}),
  breakdown: () => q.getBreakdown(site, { ...dates, fields: ['path', 'browser'] }, {}),
  funnel: () =>
    q.getFunnel(
      site,
      {
        ...dates,
        window: 30,
        steps: [
          { type: 'path', value: '/' },
          { type: 'event', value: 'purchase' },
        ],
      },
      {},
    ),
  goal: () => getGoal(site, { ...dates, type: 'event', value: 'purchase' }, {}),
  journey: () => q.getJourney(site, { ...dates, steps: 2 }, {}),
  retention: () => q.getRetention(site, filters, {}),
  'revenue chart': () => getRevenueChart(site, revenueParams, {}),
  'revenue stats': () => getRevenueStats(site, revenueParams, {}),
  'revenue country': () => getRevenueMetrics(site, revenueParams, {}, 'country'),
  'revenue channel': () => getRevenueMetrics(site, revenueParams, {}, 'channel'),
  'revenue sessions': () => getRevenueSessions(site, 'USD', filters),
  utm: () => q.getUTM(site, { ...dates, column: 'utm_source' }, {}),
  'linked identities': () => q.getLinkedDistinctIds(site, session),
  'linked sessions': () => q.getLinkedSessionIds(site, 'buyer'),
  activity: () => q.getSessionActivity(site, [session], filters),
  'session data': () => q.getSessionData(site, session),
  'session property activity': () => q.getSessionDataActivityStats(site, 'plan', filters),
  'session arrays': () => q.getSessionDataArraySeries(site, 'tags', filters),
  'session dates': () => q.getSessionDataDateSeries(site, 'birthday', filters),
  'session numbers': () => q.getSessionDataNumericSeries(site, 'amount', 'sum', filters),
  'session numeric stats': () => q.getSessionDataNumericStats(site, 'amount', filters),
  'session pivot': () => q.getSessionDataPivot(site, 'plan', filters),
  'session properties': () => q.getSessionDataProperties(site, filters),
  'session property series': () => q.getSessionDataPropertySeries(site, 'plan', filters),
  'session values': () => q.getSessionDataValues(site, { ...filters, propertyName: 'plan' }),
  'session metrics': () => q.getSessionMetrics(site, { type: 'language' }, filters),
  'session expanded': () => q.getSessionExpandedMetrics(site, { type: 'language' }, filters),
  'session stats': () => q.getSessionStats(site, filters),
  'session detail': () => q.getWebsiteSession(site, session),
  'session detail stats': () => q.getWebsiteSessionStats(site, filters),
  sessions: () => q.getWebsiteSessions(site, filters),
  'heatmap clicks': () => q.getHeatmap(site, { ...filters, urlPath: '/', mode: 'click' }),
  'heatmap scroll': () => q.getHeatmap(site, { ...filters, urlPath: '/', mode: 'scroll' }),
};

test.each(Object.entries(reads))('executes %s against D1', async (_name, read) => {
  expect(await read()).toBeDefined();
});

test('returns entry and exit pages, a complete funnel and scroll depth', async () => {
  expect(await reads['page entry']()).toEqual([{ x: '/', y: 1 }]);
  expect(await reads['page exit']()).toEqual([{ x: '/buy', y: 1 }]);
  expect(await reads.funnel()).toEqual([
    expect.objectContaining({ visitors: 1 }),
    expect.objectContaining({ visitors: 1, remaining: 1 }),
  ]);
  expect(await reads['heatmap scroll']()).toMatchObject({
    scroll: { totalSessions: 1, buckets: [expect.objectContaining({ depth: 80 })] },
  });
});
