import { getDateSQL } from '@/db/dates';
import { parseFilters } from '@/db/filters';
import { rawQuery } from '@/db/query';
import { percentileSQL, rankedQuery } from '@/db/stats';
import type { QueryFilters } from '@/lib/types';
import { getPerformanceSummary } from '../performance/getPerformanceSummary';

export interface PerformanceParameters {
  startDate: Date;
  endDate: Date;
  unit: string;
  timezone: string;
  metric: string;
}

export interface PerformanceResult {
  chart: { t: string; p50: number; p75: number; p95: number }[];
  summary: {
    lcp: { p50: number; p75: number; p95: number };
    inp: { p50: number; p75: number; p95: number };
    cls: { p50: number; p75: number; p95: number };
    fcp: { p50: number; p75: number; p95: number };
    ttfb: { p50: number; p75: number; p95: number };
    count: number;
  };
}

export async function getPerformance(
  websiteId: string,
  parameters: PerformanceParameters,
  filters: QueryFilters,
): Promise<PerformanceResult> {
  const { unit = 'day', timezone = 'utc', metric = 'lcp' } = parameters;
  if (!['lcp', 'inp', 'cls', 'fcp', 'ttfb'].includes(metric))
    throw new Error('Invalid performance metric.');
  const { filterQuery, joinSessionQuery, cohortQuery, queryParams } = await parseFilters({
    ...filters,
    ...parameters,
    websiteId,
  });
  const source = `select ${getDateSQL('website_event.created_at', unit, timezone, queryParams)} as t, ${metric} as value
    from website_event ${cohortQuery} ${joinSessionQuery}
    where website_event.website_id = {{websiteId}} and website_event.event_type = 5
      and website_event.created_at between {{startDate}} and {{endDate}} ${filterQuery}`;
  const [chart, summary] = await Promise.all([
    rawQuery(
      `${rankedQuery(source, ['value'], ['t'])}
      select t, ${percentileSQL('value', 0.5)} as p50, ${percentileSQL('value', 0.75)} as p75,
        ${percentileSQL('value', 0.95)} as p95 from ranked group by t order by t`,
      queryParams,
    ),
    getPerformanceSummary(websiteId, { ...filters, ...parameters }),
  ]);
  return { chart, summary };
}
