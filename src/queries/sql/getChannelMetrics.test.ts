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
import { getChannelMetrics } from './getChannelMetrics';

const { rawQueryMock, parseFiltersMock } = vi.hoisted(() => ({
  rawQueryMock: vi.fn(),
  parseFiltersMock: vi.fn(),
}));
vi.mock('@/db/query', () => ({ rawQuery: rawQueryMock }));
vi.mock('@/db/filters', () => ({ parseFilters: parseFiltersMock }));

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

  parseFiltersMock.mockReturnValue(parseFiltersResult);
  rawQueryMock.mockResolvedValue([]);
});

describe('getChannelMetrics D1 query', () => {
  test('builds the channel classification CTE with parseFilters fragments injected', async () => {
    await getChannelMetrics('website-1', {});

    expect(rawQueryMock).toHaveBeenCalledTimes(1);
    const [query, params] = rawQueryMock.mock.calls[0];

    expect(query).toContain('WITH prefix AS');
    expect(query).toContain('channels as');
    expect(query).toContain('visit_channels as');
    expect(query).toContain('where website_event.website_id = {{websiteId}}');
    expect(query).toContain('and website_event.event_type NOT IN (2, 5)');
    // parseFilters fragments are interpolated verbatim
    expect(query).toContain(parseFiltersResult.filterQuery);
    expect(query).toContain(parseFiltersResult.cohortQuery);
    expect(query).toContain(parseFiltersResult.excludeBounceQuery);
    expect(query).toContain(parseFiltersResult.joinSessionQuery);
    expect(query).toContain(parseFiltersResult.dateQuery);
    expect(params).toBe(parseFiltersResult.queryParams);
  });

  test('emits the direct/paidAds/referral CASE branches in order', async () => {
    await getChannelMetrics('website-1', {});
    const [query] = rawQueryMock.mock.calls[0];

    expect(query).toContain("when referrer_domain = '' and url_query = '' then 'direct'");
    expect(query).toContain("then 'paidAds'");
    expect(query).toContain("utm_medium like '%affiliate%' then 'affiliate'");
    expect(query).toContain("utm_medium like '%sms%' or utm_source like '%sms%' then 'sms'");
    expect(query).toContain("concat(prefix, 'Search')");
    expect(query).toContain("concat(prefix, 'Social')");
    expect(query).toContain("concat(prefix, 'Shopping')");
    expect(query).toContain("concat(prefix, 'Video')");
  });

  test('getContainsAnySQL renders one like per array entry joined by OR', async () => {
    await getChannelMetrics('website-1', {});
    const [query] = rawQueryMock.mock.calls[0];

    // LIKE wildcards/backslashes are escaped so values match literally (e.g. the
    // underscores in PAID_AD_PARAMS like `ad_id=` become `ad\_id=`).
    const escapeLike = (val: string) =>
      val.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_').replace(/'/g, "''");

    for (const val of PAID_AD_PARAMS) {
      expect(query).toContain(`url_query like '%${escapeLike(val)}%'`);
    }
    for (const val of SEARCH_DOMAINS) {
      expect(query).toContain(`referrer_domain like '%${escapeLike(val)}%'`);
    }
    for (const domainList of [
      LLM_DOMAINS,
      SOCIAL_DOMAINS,
      EMAIL_DOMAINS,
      SHOPPING_DOMAINS,
      VIDEO_DOMAINS,
    ]) {
      for (const val of domainList) {
        expect(query).toContain(`referrer_domain like '%${escapeLike(val)}%'`);
      }
    }
    // referral clause uses a literal array, not a constant
    expect(query).toContain("utm_medium like '%referral%'");
    expect(query).toContain("utm_medium like '%app%'");
    expect(query).toContain("utm_medium like '%link%'");
  });

  test('coerces the y column to a number in results', async () => {
    rawQueryMock.mockResolvedValue([{ x: 'direct', y: '42' }]);

    const result = await getChannelMetrics('website-1', {});

    expect(result).toEqual([{ x: 'direct', y: 42 }]);
  });

  // getContainsAnySQL escapes LIKE wildcards (% and _) and backslashes so the
  // value matches literally, then escapes single quotes for the SQL string
  // literal. The hardcoded constants contain none of these, so their rendered
  // form is unchanged; this asserts each constant appears intact in the clause.
  test('renders an like clause for each escaped constant value', async () => {
    await getChannelMetrics('website-1', {});
    const [query] = rawQueryMock.mock.calls[0];

    const escapeLike = (val: string) =>
      val.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_').replace(/'/g, "''");

    for (const val of [...PAID_AD_PARAMS, ...LLM_DOMAINS, ...SEARCH_DOMAINS]) {
      expect(query).toContain(`'%${escapeLike(val)}%'`);
    }
  });
});
