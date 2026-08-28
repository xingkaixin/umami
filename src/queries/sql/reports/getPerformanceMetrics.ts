import { parseFilters } from '@/db/filters';
import { rawQuery } from '@/db/query';
import { percentileSQL, rankedQuery } from '@/db/stats';
import { SESSION_COLUMNS } from '@/lib/constants';
import type { QueryFilters } from '@/lib/types';
import type { PerformanceParameters } from './getPerformance';

export interface PerformanceMetricsData {
  name: string;
  p50: number;
  p75: number;
  p95: number;
  count: number;
}

export async function getPerformanceMetrics(
  websiteId: string,
  parameters: PerformanceParameters,
  filters: QueryFilters,
  column: string,
  limit?: number,
): Promise<PerformanceMetricsData[]> {
  const { startDate, endDate, metric = 'lcp' } = parameters;
  const { filterQuery, joinSessionQuery, cohortQuery, queryParams } = await parseFilters(
    { ...filters, websiteId, startDate, endDate },
    { joinSession: SESSION_COLUMNS.includes(column) },
  );

  if (!['lcp', 'inp', 'cls', 'fcp', 'ttfb'].includes(metric))
    throw new Error('Invalid performance metric.');
  if (!/^[a-z_]+$/.test(column)) throw new Error('Invalid performance dimension.');
  const source = `select ${column} as name, ${metric} as value from website_event
    ${cohortQuery} ${joinSessionQuery}
    where website_event.website_id = {{websiteId}} and website_event.event_type = 5
      and website_event.created_at between {{startDate}} and {{endDate}} ${filterQuery}`;
  return rawQuery(
    `${rankedQuery(source, ['value'], ['name'])}
    select name, ${percentileSQL('value', 0.5)} as p50, ${percentileSQL('value', 0.75)} as p75,
      ${percentileSQL('value', 0.95)} as p95, count(*) as count
    from ranked group by name order by p75 desc ${limit ? `limit ${limit}` : ''}`,
    { ...queryParams, startDate, endDate },
  );
}
