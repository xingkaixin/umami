import Decimal from 'decimal.js';
import { customType } from 'drizzle-orm/sqlite-core';

export const dateTime = customType<{ data: Date; driverData: string }>({
  dataType: () => 'text',
  toDriver: value => value.toISOString(),
  fromDriver: value => new Date(value),
});

export function decimal(name: string, config: { precision: number; scale: number }) {
  return customType<{ data: string | number; driverData: string }>({
    dataType: () => 'text',
    toDriver(value) {
      const number = new Decimal(value).toDecimalPlaces(config.scale);
      if (
        !number.isFinite() ||
        number.abs().gte(new Decimal(10).pow(config.precision - config.scale))
      ) {
        throw new RangeError('Decimal value exceeds the column precision.');
      }
      return number.toFixed(config.scale);
    },
    fromDriver: value => value,
  })(name);
}

export const bytes = customType<{ data: Uint8Array; driverData: ArrayBuffer }>({
  dataType: () => 'blob',
  toDriver: value => Uint8Array.from(value).buffer,
  fromDriver: value => new Uint8Array(value),
});
