import { afterEach, describe, expect, test, vi } from 'vitest';

const parseFiltersResult = {
  queryParams: { websiteId: 'website-1' },
  filterQuery: 'and website_event.url_path = {{path}}',
  joinSessionQuery: 'join session on session.session_id = website_event.session_id',
  cohortQuery: 'join cohort on cohort.session_id = website_event.session_id',
  excludeBounceQuery: 'join excludeBounce on excludeBounce.visit_id = website_event.visit_id',
};

async function loadModule() {
  vi.resetModules();

  const rawQueryMock = vi.fn().mockResolvedValue([{}]);
  const parseFiltersMock = vi.fn().mockReturnValue(parseFiltersResult);
  const getTimestampDiffSQL = vi.fn().mockReturnValue('ts_diff(t.min_time, t.max_time)');
  vi.doMock('@/db/query', () => ({ rawQuery: rawQueryMock }));
  vi.doMock('@/db/filters', () => ({ parseFilters: parseFiltersMock }));
  vi.doMock('@/db/dates', () => ({ getTimestampDiffSQL }));

  const mod = await import('./getPageviewExpandedMetrics');

  return {
    getPageviewExpandedMetrics: mod.getPageviewExpandedMetrics,
    rawQueryMock,
    getTimestampDiffSQL,
  };
}

afterEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

describe('getPageviewExpandedMetrics D1 query', () => {
  test('skips bounce and duration work for expanded pageview rows', async () => {
    const { getPageviewExpandedMetrics, rawQueryMock, getTimestampDiffSQL } = await loadModule();

    await getPageviewExpandedMetrics('website-1', { type: 'referrer' }, {
      path: '/pricing',
    } as any);

    const [query] = rawQueryMock.mock.calls[0];

    expect(query).toContain('0 as "bounces"');
    expect(query).toContain('0 as "totaltime"');
    expect(query).not.toContain('left join (');
    expect(query).not.toContain('min(website_event.created_at) as "min_time"');
    expect(query).not.toContain('max(website_event.created_at) as "max_time"');
    expect(query).not.toContain('event_type = 2');
    expect(getTimestampDiffSQL).not.toHaveBeenCalled();
  });
});
