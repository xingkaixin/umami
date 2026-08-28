import { RE2JS } from 're2js';
import type { DateParams } from '@/lib/types';
import { rawQuery } from './query';

export async function getRegexValues(
  table: string,
  column: string,
  pattern: string,
  scope: DateParams & { websiteId: string },
  propertyName?: string,
) {
  if (!scope.websiteId || !/^[a-z_]+$/.test(table) || !/^[a-z_]+$/.test(column))
    throw new Error('Invalid regex scope.');
  const regex = RE2JS.compile(pattern, RE2JS.CASE_INSENSITIVE);
  const values: string[] = [];
  let bytes = 0;
  let cursor: string | null = null;
  const encoder = new TextEncoder();
  const dates = `${scope.startDate ? 'and created_at >= {{startDate}}' : ''}
    ${scope.endDate ? 'and created_at <= {{endDate}}' : ''}`;
  const activity =
    table === 'session' || table === 'session_data'
      ? `and session_id in (select session_id from website_event where website_id = {{websiteId}} ${dates})`
      : dates;
  for (let page = 0; page < 100; page++) {
    const rows = await rawQuery<{ value: string }[]>(
      `
      select distinct ${column} as value from ${table}
      where website_id = {{websiteId}} and ${column} is not null
        ${activity}
        ${propertyName !== undefined ? 'and data_key = {{propertyName}}' : ''}
        ${cursor !== null ? `and ${column} > {{cursor}}` : ''}
      order by ${column} limit 500
    `,
      { ...scope, propertyName, cursor },
    );
    for (const row of rows) {
      if (!regex.matcher(row.value).find()) continue;
      bytes += encoder.encode(JSON.stringify(row.value)).byteLength + 1;
      if (bytes > 1_000_000)
        throw new RangeError('Regex matches too many values. Narrow the date range or pattern.');
      values.push(row.value);
    }
    if (rows.length < 500) return values;
    cursor = rows.at(-1).value;
  }
  throw new RangeError('Regex search exceeds 50,000 distinct values. Narrow the date range.');
}
