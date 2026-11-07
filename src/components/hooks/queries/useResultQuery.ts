import { useDateParameters } from '@/components/hooks/useDateParameters';
import type { ReactQueryOptions } from '@/lib/types';
import { useApi } from '../useApi';
import { useFilterParameters } from '../useFilterParameters';
import { useTimezone } from '../useTimezone';

export function useResultQuery<T = any>(
  type: string,
  params?: Record<string, any>,
  options?: ReactQueryOptions<T>,
) {
  const { websiteId, ...rest } = params;
  const { post, useQuery } = useApi();
  const { startDate, endDate, timezone, unit } = useDateParameters();
  const { toUtc } = useTimezone();
  const filters = useFilterParameters({ includePagination: false });
  const parameters = {
    ...rest,
    ...(rest.startDate && { startDate: toUtc(rest.startDate) }),
    ...(rest.endDate && { endDate: toUtc(rest.endDate) }),
  };

  return useQuery<T>({
    queryKey: [
      'reports',
      {
        type,
        websiteId,
        startDate,
        endDate,
        timezone,
        unit,
        ...parameters,
        ...filters,
      },
    ],
    queryFn: () =>
      post(`/reports/${type}`, {
        websiteId,
        type,
        filters,
        parameters: {
          startDate,
          endDate,
          timezone,
          unit,
          ...parameters,
        },
      }),
    enabled: !!type,
    ...options,
  });
}
