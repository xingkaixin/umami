import { formatInTimeZone } from 'date-fns-tz';
import { DATA_TYPE, FIELD_LENGTH } from '@/lib/constants';
import { flattenJSON, getStoredStringValue } from '@/lib/data';
import { truncateString } from '@/lib/format';
import type { DynamicData } from '@/lib/types';

export function getPropertyValues(data: DynamicData) {
  return flattenJSON(data).map(({ key, value, dataType }) => ({
    dataKey: truncateString(key, FIELD_LENGTH.dataKey),
    stringValue: getStoredStringValue(value, dataType),
    numberValue: dataType === DATA_TYPE.number ? value : null,
    dateValue: dataType === DATA_TYPE.date ? new Date(value) : null,
    dataType,
  }));
}

export function readPropertyRows(rows: Record<string, any>[], timezone: string) {
  return rows.map(row => ({
    ...row,
    propertyKeys: JSON.parse(row.propertyKeys),
    propertyValues: JSON.parse(row.propertyValues).map(
      ({ type, value }: { type: number; value: string }) =>
        type === DATA_TYPE.date && value && timezone.toLowerCase() !== 'utc'
          ? formatInTimeZone(new Date(value), timezone, "yyyy-MM-dd'T'HH:mm:ss")
          : value,
    ),
  }));
}
