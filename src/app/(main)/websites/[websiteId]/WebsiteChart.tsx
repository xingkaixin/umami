import { useMemo } from 'react';
import { LoadingPanel } from '@/components/common/LoadingPanel';
import { useDateRange, useTimezone } from '@/components/hooks';
import { useWebsitePageviewsQuery } from '@/components/hooks/queries/useWebsitePageviewsQuery';
import { PageviewsChart } from '@/components/metrics/PageviewsChart';
import { alignCompareSeries, minDate } from '@/lib/date';

export function WebsiteChart({
  websiteId,
  compareMode,
}: {
  websiteId: string;
  compareMode?: boolean;
}) {
  const { timezone, fromUtc } = useTimezone();
  const { dateRange, dateCompare } = useDateRange({ timezone });
  const { startDate, endDate, unit, value } = dateRange;
  const { data, isLoading, isFetching, error } = useWebsitePageviewsQuery({
    websiteId,
    compare: compareMode ? dateCompare?.compare : undefined,
  });
  const { pageviews, sessions, compare } = (data || {}) as any;

  const chartData = useMemo(() => {
    if (!data) {
      return { pageviews: [], sessions: [] };
    }

    if (!compare) {
      return { pageviews, sessions };
    }

    const compareStartDate = fromUtc(compare.startDate);
    const compareEndDate = minDate(fromUtc(new Date()), endDate);
    const align = (series: { x: string; y: number }[]) =>
      alignCompareSeries(series, compareStartDate, startDate, compareEndDate, unit);

    return {
      pageviews,
      sessions,
      compare: { pageviews: align(compare.pageviews), sessions: align(compare.sessions) },
    };
  }, [data, startDate, endDate, unit, timezone]);

  return (
    <LoadingPanel data={data} isFetching={isFetching} isLoading={isLoading} error={error}>
      <PageviewsChart
        key={value}
        data={chartData}
        minDate={startDate}
        maxDate={endDate}
        unit={unit}
      />
    </LoadingPanel>
  );
}
