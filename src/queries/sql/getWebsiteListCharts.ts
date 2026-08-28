import { Temporal } from '@js-temporal/polyfill';
import { getDateSQL } from '@/db/dates';
import { rawQuery } from '@/db/query';
import { EVENT_TYPE } from '@/lib/constants';

const DEFAULT_TIMEZONE = 'UTC';
const BUCKET_HOURS = 12;

interface WebsiteListChartPoint {
  websiteId: string;
  x: string | null;
  y: number;
}

export interface WebsiteListChartData {
  values: number[];
  total: number;
}

export async function getWebsiteListCharts(
  websiteIds: string[],
  {
    startDate,
    endDate,
    timezone = DEFAULT_TIMEZONE,
    eventType,
  }: {
    startDate: Date;
    endDate: Date;
    timezone?: string;
    eventType?: number;
  },
): Promise<Record<string, WebsiteListChartData>> {
  if (!websiteIds.length) {
    return {};
  }

  const points = await queryChartPoints(websiteIds, startDate, endDate, timezone, eventType);

  return formatResults({ points, websiteIds, startDate, endDate, timezone });
}

async function queryChartPoints(
  websiteIds: string[],
  startDate: Date,
  endDate: Date,
  timezone: string,
  eventType?: number,
): Promise<WebsiteListChartPoint[]> {
  const eventTypeQuery =
    eventType != null
      ? `and website_event.event_type = ${eventType}`
      : `and website_event.event_type NOT IN (${EVENT_TYPE.customEvent}, ${EVENT_TYPE.performance})`;
  const hourSql = getDateSQL('website_event.created_at', 'hour', timezone, { startDate, endDate });
  const bucketSql = `substr(${hourSql}, 1, 10) || ' ' ||
    case when cast(substr(${hourSql}, 12, 2) as integer) < ${BUCKET_HOURS} then '00' else '12' end || ':00:00'`;

  return rawQuery(
    `
    with events as (
      select website_event.website_id as "websiteId", ${bucketSql} as x, website_event.session_id
      from website_event
      where website_event.website_id in (select value from json_each({{websiteIds}}))
        ${eventTypeQuery}
        and website_event.created_at between {{startDate}} and {{endDate}}
    )
    select websiteId, x, count(distinct session_id) as y from events group by websiteId, x
    union all
    select websiteId, null as x, count(distinct session_id) as y from events group by websiteId
    order by 1, 2
    `,
    { websiteIds, startDate, endDate },
  );
}

function formatResults({
  points,
  websiteIds,
  startDate,
  endDate,
  timezone,
}: {
  points: WebsiteListChartPoint[];
  websiteIds: string[];
  startDate: Date;
  endDate: Date;
  timezone: string;
}) {
  const buckets: string[] = [];

  const first = Temporal.Instant.fromEpochMilliseconds(+startDate)
    .toZonedDateTimeISO(timezone)
    .toPlainDateTime();
  const last = Temporal.Instant.fromEpochMilliseconds(+endDate)
    .toZonedDateTimeISO(timezone)
    .toPlainDateTime();
  for (
    let current = first.with({
      hour: Math.floor(first.hour / BUCKET_HOURS) * BUCKET_HOURS,
      minute: 0,
      second: 0,
      millisecond: 0,
    });
    Temporal.PlainDateTime.compare(current, last) <= 0;
    current = current.add({ hours: BUCKET_HOURS })
  ) {
    buckets.push(current.toString({ smallestUnit: 'second' }).replace('T', ' '));
  }

  const bucketIndex = new Map(buckets.map((bucket, index) => [bucket, index]));
  const charts = websiteIds.reduce<Record<string, WebsiteListChartData>>((result, websiteId) => {
    result[websiteId] = {
      values: Array.from({ length: buckets.length }, () => 0),
      total: 0,
    };
    return result;
  }, {});

  points.forEach(({ websiteId, x, y }) => {
    if (!charts[websiteId]) {
      return;
    }

    if (!x) {
      charts[websiteId].total = Number(y);
      return;
    }

    const index = bucketIndex.get(String(x).slice(0, 19));

    if (index !== undefined) {
      charts[websiteId].values[index] = Number(y);
    }
  });

  return charts;
}
