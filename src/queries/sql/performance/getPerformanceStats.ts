import type { QueryFilters } from '@/lib/types';
import { getPerformanceSummary } from './getPerformanceSummary';

export interface PerformanceStatsResult {
  lcp: number;
  inp: number;
  cls: number;
  fcp: number;
  ttfb: number;
  count: number;
}

export async function getPerformanceStats(
  websiteId: string,
  filters: QueryFilters,
): Promise<PerformanceStatsResult> {
  const summary = await getPerformanceSummary(websiteId, filters);
  return {
    lcp: summary.lcp.p75,
    inp: summary.inp.p75,
    cls: summary.cls.p75,
    fcp: summary.fcp.p75,
    ttfb: summary.ttfb.p75,
    count: summary.count,
  };
}
