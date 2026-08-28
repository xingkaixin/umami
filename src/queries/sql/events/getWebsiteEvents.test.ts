import { afterEach, describe, expect, test, vi } from 'vitest';

const parseFiltersMockResult = {
  queryParams: { websiteId: 'website-1' },
  filterQuery: 'and website_event.url_path = {{path}}',
  dateQuery: 'and website_event.created_at between {{startDate}} and {{endDate}}',
  cohortQuery: 'join cohort on cohort.session_id = website_event.session_id',
  joinSessionQuery: '',
};

async function loadModule() {
  vi.resetModules();

  const rawQueryMock = vi
    .fn()
    .mockResolvedValueOnce([{ num: '25' }])
    .mockResolvedValueOnce([{ id: 'event-1' }]);
  const parseFiltersMock = vi.fn().mockReturnValue(parseFiltersMockResult);
  vi.doMock('@/db/query', () => ({ rawQuery: rawQueryMock }));
  vi.doMock('@/db/filters', () => ({ parseFilters: parseFiltersMock }));

  const mod = await import('./getWebsiteEvents');

  return {
    getWebsiteEvents: mod.getWebsiteEvents,
    rawQueryMock,
  };
}

afterEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

describe('getWebsiteEvents', () => {
  test('D1 counts from the lightweight filtered event query and keeps paged rows even when session enrichment is missing', async () => {
    const { getWebsiteEvents, rawQueryMock } = await loadModule();

    const result = await getWebsiteEvents('website-1', {
      page: 1,
      pageSize: 20,
      maxResults: 10000,
      orderBy: 'createdAt',
      search: 'signup',
    } as any);

    const [countQuery] = rawQueryMock.mock.calls[0];
    const [, countParams] = rawQueryMock.mock.calls[0];
    const [dataQuery] = rawQueryMock.mock.calls[1];
    const [, dataParams] = rawQueryMock.mock.calls[1];

    expect(countQuery).toContain('select count(*) as num from (select 1 from (');
    expect(countQuery).not.toContain('exists(');
    expect(countQuery).toContain('event_name like {{eventSearch}}');
    expect(countQuery).not.toContain('inner join session on website_event.session_id');
    expect(dataQuery).toContain('with paged_events as (');
    expect(dataQuery).toContain('paged_event_data as (');
    expect(dataQuery).toContain(
      'join paged_events on paged_events.event_id = event_data.website_event_id',
    );
    expect(dataQuery).toContain('where event_data.website_id = {{websiteId}}');
    expect(dataQuery).toContain('and event_data.created_at between {{startDate}} and {{endDate}}');
    expect(dataQuery).toContain(
      'left join paged_event_data on paged_event_data.event_id = website_event.event_id',
    );
    expect(dataQuery).toContain(
      'left join session on session.session_id = website_event.session_id',
    );
    expect(dataQuery).toContain('order by paged_events.created_at desc');
    expect(dataQuery).toContain('(paged_event_data.event_id is not null) as "hasData"');
    expect(countParams).toMatchObject({ eventSearch: '%signup%' });
    expect(dataParams).toMatchObject({ eventSearch: '%signup%' });
    expect(result).toEqual({
      data: [{ id: 'event-1' }],
      count: 25,
      page: 1,
      pageSize: 20,
      orderBy: 'createdAt',
      isCapped: false,
    });
  });
});
