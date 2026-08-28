import { parseFilters } from '@/db/filters';
import { rawQuery } from '@/db/query';
import { percentileSQL, rankedQuery } from '@/db/stats';
import type { QueryFilters } from '@/lib/types';

const metrics = ['lcp', 'inp', 'cls', 'fcp', 'ttfb'] as const;

export async function getPerformanceSummary(websiteId: string, filters: QueryFilters) {
  const { filterQuery, joinSessionQuery, cohortQuery, queryParams } = await parseFilters({
    ...filters,
    websiteId,
  });
  const source = `select lcp, inp, cls, fcp, ttfb from website_event
    ${cohortQuery} ${joinSessionQuery}
    where website_event.website_id = {{websiteId}} and website_event.event_type = 5
      and website_event.created_at between {{startDate}} and {{endDate}} ${filterQuery}`;
  const columns = metrics.flatMap(metric =>
    [50, 75, 95].map(p => `${percentileSQL(metric, p / 100)} as ${metric}_p${p}`),
  );
  const [row] = await rawQuery(
    `${rankedQuery(source, [...metrics])}
    select ${columns.join(', ')}, count(*) as count from ranked`,
    queryParams,
  );
  return {
    lcp: {
      p50: Number(row.lcp_p50 || 0),
      p75: Number(row.lcp_p75 || 0),
      p95: Number(row.lcp_p95 || 0),
    },
    inp: {
      p50: Number(row.inp_p50 || 0),
      p75: Number(row.inp_p75 || 0),
      p95: Number(row.inp_p95 || 0),
    },
    cls: {
      p50: Number(row.cls_p50 || 0),
      p75: Number(row.cls_p75 || 0),
      p95: Number(row.cls_p95 || 0),
    },
    fcp: {
      p50: Number(row.fcp_p50 || 0),
      p75: Number(row.fcp_p75 || 0),
      p95: Number(row.fcp_p95 || 0),
    },
    ttfb: {
      p50: Number(row.ttfb_p50 || 0),
      p75: Number(row.ttfb_p75 || 0),
      p95: Number(row.ttfb_p95 || 0),
    },
    count: Number(row.count),
  };
}
