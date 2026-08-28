import { beforeEach, describe, expect, test, vi } from 'vitest';
import {
  EMAIL_DOMAINS,
  LLM_DOMAINS,
  PAID_AD_PARAMS,
  SEARCH_DOMAINS,
  SHOPPING_DOMAINS,
  SOCIAL_DOMAINS,
  VIDEO_DOMAINS,
} from '@/lib/constants';
import { getChannelExpandedMetrics } from './getChannelExpandedMetrics';

const { rawQueryMock, parseFiltersMock, getTimestampDiffSQL } = vi.hoisted(() => ({
  rawQueryMock: vi.fn(),
  parseFiltersMock: vi.fn(),
  getTimestampDiffSQL: vi.fn(),
}));
vi.mock('@/db/query', () => ({ rawQuery: rawQueryMock }));
vi.mock('@/db/filters', () => ({ parseFilters: parseFiltersMock }));
vi.mock('@/db/dates', () => ({ getTimestampDiffSQL }));

const parseFiltersResult = {
  queryParams: { websiteId: 'website-1' },
  filterQuery: 'and website_event.utm_source = {{utmSource}}',
  joinSessionQuery: 'join session on session.session_id = website_event.session_id',
  cohortQuery: 'join cohort on cohort.session_id = website_event.session_id',
  excludeBounceQuery: 'and website_event.visit_id in (select visit_id from bounces)',
  dateQuery: 'and created_at between {{startDate}} and {{endDate}}',
};

beforeEach(() => {
  rawQueryMock.mockReset();
  parseFiltersMock.mockReset();
  getTimestampDiffSQL.mockReset();

  parseFiltersMock.mockReturnValue(parseFiltersResult);
  getTimestampDiffSQL.mockReturnValue('ts_diff(min_time, max_time)');
  rawQueryMock.mockResolvedValue([]);
});

describe('getChannelExpandedMetrics D1 query', () => {
  test('builds the expanded aggregation query with parseFilters fragments', async () => {
    await getChannelExpandedMetrics('website-1', {});

    expect(rawQueryMock).toHaveBeenCalledTimes(1);
    const [query, params] = rawQueryMock.mock.calls[0];

    expect(query).toContain('WITH prefix AS');
    expect(query).toContain('visit_stats as');
    expect(query).toContain('sum(visit_stats.c) as "pageviews"');
    expect(query).toContain('count(distinct visit_stats.session_id) as "visitors"');
    expect(query).toContain('count(distinct visit_stats.visit_id) as "visits"');
    expect(query).toContain(
      'sum(case when visit_stats.c = 1 and coalesce(visit_events.has_custom_event, 0) = 0 then 1 else 0 end) as "bounces"',
    );
    expect(query).toContain('visit_events as');
    expect(query).toContain('left join visit_events');
    // getTimestampDiffSQL output is injected into the totaltime column
    expect(query).toContain('sum(ts_diff(min_time, max_time)) as "totaltime"');
    expect(getTimestampDiffSQL).toHaveBeenCalledWith(
      'visit_stats.min_time',
      'visit_stats.max_time',
    );
    expect(query).toContain(parseFiltersResult.filterQuery);
    expect(query).toContain(parseFiltersResult.cohortQuery);
    expect(query).toContain(parseFiltersResult.excludeBounceQuery);
    expect(query).toContain(parseFiltersResult.joinSessionQuery);
    expect(params).toBe(parseFiltersResult.queryParams);
  });

  test('getContainsAnySQL renders one like per array entry', async () => {
    await getChannelExpandedMetrics('website-1', {});
    const [query] = rawQueryMock.mock.calls[0];

    // LIKE wildcards/backslashes are escaped so values match literally (e.g. the
    // underscores in PAID_AD_PARAMS like `ad_id=` become `ad\_id=`).
    const escapeLike = (val: string) =>
      val.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_').replace(/'/g, "''");

    for (const val of PAID_AD_PARAMS) {
      expect(query).toContain(`url_query like '%${escapeLike(val)}%'`);
    }
    for (const domainList of [
      LLM_DOMAINS,
      SEARCH_DOMAINS,
      SOCIAL_DOMAINS,
      EMAIL_DOMAINS,
      SHOPPING_DOMAINS,
      VIDEO_DOMAINS,
    ]) {
      for (const val of domainList) {
        expect(query).toContain(`referrer_domain like '%${escapeLike(val)}%'`);
      }
    }
  });

  test('returns the query rows unchanged without a spurious y column', async () => {
    const rows = [
      { name: 'direct', pageviews: 10, visitors: 4, visits: 5, bounces: 1, totaltime: 100 },
    ];
    rawQueryMock.mockResolvedValue(rows);

    const result = await getChannelExpandedMetrics('website-1', {});

    expect(result).toEqual(rows);
    expect(result[0]).not.toHaveProperty('y');
  });
});
