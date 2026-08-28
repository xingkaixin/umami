import { beforeEach, describe, expect, test, vi } from 'vitest';
import { getFunnel } from './getFunnel';

const { rawQueryMock, parseFiltersMock, getAddIntervalQuery } = vi.hoisted(() => ({
  rawQueryMock: vi.fn(),
  parseFiltersMock: vi.fn(),
  getAddIntervalQuery: vi.fn(),
}));
vi.mock('@/db/query', () => ({ rawQuery: rawQueryMock }));
vi.mock('@/db/filters', () => ({ parseFilters: parseFiltersMock }));
vi.mock('@/db/dates', () => ({ getAddIntervalQuery }));

const parseFiltersResult = {
  queryParams: { websiteId: 'website-1' },
  filterQuery: 'and website_event.utm_source = {{utmSource}}',
  joinSessionQuery: 'join session on session.session_id = website_event.session_id',
  cohortQuery: 'join cohort on cohort.session_id = website_event.session_id',
};

const baseParameters = {
  startDate: new Date('2026-05-18T00:00:00.000Z'),
  endDate: new Date('2026-05-19T00:00:00.000Z'),
  window: 30,
  steps: [
    { type: 'path', value: '/home' },
    { type: 'path', value: '/checkout' },
  ],
};

beforeEach(() => {
  rawQueryMock.mockReset();
  parseFiltersMock.mockReset();
  getAddIntervalQuery.mockReset();

  parseFiltersMock.mockReturnValue(parseFiltersResult);
  getAddIntervalQuery.mockReturnValue('add_interval(l.created_at, 30 minute)');
  // formatResults reads results[0].count etc, so provide numeric counts
  rawQueryMock.mockResolvedValue([{ count: 100 }, { count: 40 }]);
});

describe('getFunnel D1 query', () => {
  test('builds level CTEs and a UNION sum query, one per step', async () => {
    await getFunnel('website-1', baseParameters, {});

    expect(rawQueryMock).toHaveBeenCalledTimes(1);
    const [query, params] = rawQueryMock.mock.calls[0];

    expect(query).toContain('WITH level1 AS');
    expect(query).toContain(', level2 AS');
    expect(query).toContain('select 1 as level, count(distinct(session_id)) as count from level1');
    expect(query).toContain('union ');
    expect(query).toContain('select 2 as level, count(distinct(session_id)) as count from level2');
    expect(query).toContain('ORDER BY level');
    // step values become positional params keyed by index
    expect(params).toMatchObject({ 0: '/home', 1: '/checkout' });
    // merged with parseFilters queryParams
    expect(params).toMatchObject({ websiteId: 'website-1' });
    // level1 filters use equality against {{0}}; level2 against {{1}}
    expect(query).toContain('and url_path = {{0}}');
    expect(query).toContain('and we.url_path = {{1}}');
    // level2 window uses getAddIntervalQuery output
    expect(query).toContain('add_interval(l.created_at, 30 minute)');
    expect(getAddIntervalQuery).toHaveBeenCalledWith('l.created_at ', '30 minute');
  });

  test('wildcard step values switch to LIKE and translate * to %', async () => {
    await getFunnel(
      'website-1',
      {
        ...baseParameters,
        steps: [
          { type: 'path', value: '/blog/*' },
          { type: 'path', value: '*/thanks' },
        ],
      },
      {},
    );

    const [query, params] = rawQueryMock.mock.calls[0];
    expect(query).toContain('and url_path like {{0}}');
    expect(query).toContain('and we.url_path like {{1}}');
    expect(params).toMatchObject({ 0: '/blog/%', 1: '%/thanks' });
  });

  test('event steps with contains filter emit exists() subqueries and like params', async () => {
    await getFunnel(
      'website-1',
      {
        ...baseParameters,
        steps: [
          {
            type: 'event',
            value: 'purchase',
            filters: [{ property: 'plan', operator: 'c', value: 'pro' }],
          },
          { type: 'event', value: 'confirm' },
        ],
      },
      {},
    );

    const [query, params] = rawQueryMock.mock.calls[0];
    expect(query).toContain('and event_name = {{0}}');
    expect(query).toContain('and exists (');
    expect(query).toContain('_ed0_0.data_key = {{f_0_0_k}}');
    expect(query).toContain('like {{f_0_0_v}}');
    // contains -> like operator, value wrapped in % ... %
    expect(params).toMatchObject({ f_0_0_k: 'plan', f_0_0_v: '%pro%' });
  });

  test('filter operators map to the expected SQL operators', async () => {
    await getFunnel(
      'website-1',
      {
        ...baseParameters,
        steps: [
          {
            type: 'event',
            value: 'e',
            filters: [
              { property: 'a', operator: 'eq', value: 'x' },
              { property: 'b', operator: 'neq', value: 'y' },
              { property: 'c', operator: 'dnc', value: 'z' },
            ],
          },
          { type: 'event', value: 'f' },
        ],
      },
      {},
    );

    const [query, params] = rawQueryMock.mock.calls[0];
    // eq -> '=' with raw value
    expect(query).toContain('= {{f_0_0_v}}');
    expect(params).toMatchObject({ f_0_0_v: 'x' });
    // neq -> '!=' with raw value
    expect(query).toContain('!= {{f_0_1_v}}');
    expect(params).toMatchObject({ f_0_1_v: 'y' });
    // dnc -> 'not like' with wrapped value
    expect(query).toContain('not like {{f_0_2_v}}');
    expect(params).toMatchObject({ f_0_2_v: '%z%' });
  });

  test('formatResults computes dropoff / remaining relative to first step', async () => {
    rawQueryMock.mockResolvedValue([{ count: 100 }, { count: 40 }]);

    const result = await getFunnel('website-1', baseParameters, {});

    expect(result[0]).toMatchObject({ visitors: 100, previous: 0, dropped: 0, remaining: 1 });
    expect(result[1]).toMatchObject({
      visitors: 40,
      previous: 100,
      dropped: 60,
      remaining: 0.4,
    });
    expect(result[1].dropoff).toBeCloseTo(0.6);
  });
});
