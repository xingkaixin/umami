import { Temporal } from '@js-temporal/polyfill';
import { formatInTimeZone } from 'date-fns-tz';
import type { DateParams } from '@/lib/types';

const formats = {
  minute: '%Y-%m-%d %H:%M:00',
  hour: '%Y-%m-%d %H:00:00',
  day: '%Y-%m-%d 00:00:00',
  month: '%Y-%m-01 00:00:00',
  year: '%Y-01-01 00:00:00',
};

function localDateSQL(field: string, timezone: string, range: DateParams) {
  const start = range.startDate;
  const end = range.endDate ?? new Date();
  if (!start || !Number.isFinite(+start) || !Number.isFinite(+end) || +start > +end) {
    throw new RangeError('A valid date range is required for timezone aggregation.');
  }
  let zoned = Temporal.Instant.fromEpochMilliseconds(+start).toZonedDateTimeISO(timezone);
  let offset = zoned.offsetNanoseconds / 1_000_000_000;
  const branches: string[] = [];
  for (
    let next = zoned.getTimeZoneTransition('next');
    next && next.epochMilliseconds <= +end;
    next = zoned.getTimeZoneTransition('next')
  ) {
    if (branches.length >= 200)
      throw new RangeError('Date range contains too many timezone transitions.');
    branches.push(
      `when ${field} < '${new Date(next.epochMilliseconds).toISOString()}' then ${offset}`,
    );
    zoned = next;
    offset = zoned.offsetNanoseconds / 1_000_000_000;
  }
  const offsetSQL = branches.length
    ? `(case ${branches.join(' ')} else ${offset} end)`
    : String(offset);
  return `datetime(${field}, ${offsetSQL} || ' seconds')`;
}

export function getDateSQL(field: string, unit: string, timezone = 'utc', range: DateParams = {}) {
  const format = formats[unit];
  if (!format) throw new Error('Invalid date unit.');
  if (timezone.toLowerCase() === 'utc') return `strftime('${format.replace(' ', 'T')}Z', ${field})`;
  return `strftime('${format}', ${localDateSQL(field, timezone, range)})`;
}

export function getUTCDateStringSQL(field: string) {
  return `strftime('%Y-%m-%dT%H:%M:%SZ', ${field})`;
}

export function localizeDateSeries(rows: { t: string; y: number }[], timezone: string) {
  if (timezone.toLowerCase() === 'utc') return rows;
  const counts = new Map<string, number>();
  for (const { t, y } of rows) {
    const date = formatInTimeZone(new Date(t), timezone, "yyyy-MM-dd'T'HH:mm:ss");
    counts.set(date, (counts.get(date) ?? 0) + Number(y));
  }
  return [...counts].sort(([a], [b]) => a.localeCompare(b)).map(([t, y]) => ({ t, y }));
}

export function getDateWeeklySQL(field: string, timezone = 'utc', range: DateParams = {}) {
  const local = timezone.toLowerCase() === 'utc' ? field : localDateSQL(field, timezone, range);
  return `strftime('%w:%H', ${local})`;
}

export function getTimestampSQL(field: string) {
  return `floor(unixepoch(${field}, 'subsec'))`;
}

export function getTimestampDiffSQL(first: string, last: string) {
  return `floor(round((julianday(${last}) - julianday(${first})) * 86400000) / 1000.0)`;
}

export function getDayDiffQuery(first: string, last: string) {
  return `cast(julianday(date(${first})) - julianday(date(${last})) as integer)`;
}

export function getCastColumnQuery(field: string, type: string) {
  if (!['float', 'int', 'text', 'varchar', 'decimal'].includes(type))
    throw new Error('Invalid SQL cast.');
  return `cast(${field} as ${type === 'float' ? 'real' : type})`;
}

export function getAddIntervalQuery(field: string, interval: string) {
  if (!/^\d+ (second|minute|hour|day)s?$/.test(interval)) throw new Error('Invalid SQL interval.');
  return `strftime('%Y-%m-%dT%H:%M:%fZ', ${field}, '+${interval}')`;
}

export function getLocalDayRange(value: string, timezone = 'UTC') {
  const date = Temporal.PlainDate.from(value);
  const start = date.toZonedDateTime(timezone).epochMilliseconds;
  const end = date.add({ days: 1 }).toZonedDateTime(timezone).epochMilliseconds;
  return { start: new Date(start), end: new Date(end) };
}
