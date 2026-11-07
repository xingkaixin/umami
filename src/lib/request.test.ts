import { beforeEach, expect, test, vi } from 'vitest';
import { fetchWebsite } from '@/lib/load';
import { getWebsiteSegment } from '@/queries/drizzle';
import { getQueryFilters } from './request';

vi.mock('@/lib/load', () => ({
  fetchAccount: vi.fn(),
  fetchWebsite: vi.fn(),
}));

vi.mock('@/queries/drizzle', () => ({
  getWebsiteSegment: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(fetchWebsite).mockResolvedValue({ id: 'website-1' } as any);
});

test("combines a saved segment's session property filters with active filters", async () => {
  vi.mocked(getWebsiteSegment).mockResolvedValue({
    parameters: {
      sessionPropertyFilters: [{ propertyName: 'plan', dataType: 1, operator: 'eq', value: 'pro' }],
    },
  } as any);

  const filters = await getQueryFilters(
    {
      startAt: String(+new Date('2026-09-01T00:00:00.000Z')),
      endAt: String(+new Date('2026-09-02T00:00:00.000Z')),
      segment: 'segment-1',
      spf0: '1.eq.country.US',
    },
    'website-1',
  );

  expect(filters.sessionPropertyFilters).toEqual([
    { propertyName: 'country', dataType: 1, operator: 'eq', value: 'US' },
    { propertyName: 'plan', dataType: 1, operator: 'eq', value: 'pro' },
  ]);
});

test('ignores saved segment filters that are not filter columns', async () => {
  vi.mocked(getWebsiteSegment).mockResolvedValue({
    parameters: {
      filters: [
        { name: 'timezone', operator: 'eq', value: 'Invalid/Zone' },
        { name: 'browser', operator: 'eq', value: 'firefox' },
      ],
    },
  } as any);

  const filters = await getQueryFilters(
    {
      startAt: String(+new Date('2026-09-01T00:00:00.000Z')),
      endAt: String(+new Date('2026-09-02T00:00:00.000Z')),
      timezone: 'UTC',
      segment: 'segment-1',
    },
    'website-1',
  );

  expect(filters.timezone).toBe('UTC');
  expect(filters.browser).toBe('eq.firefox');
});
