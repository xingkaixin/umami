import { describe, expect, test } from 'vitest';
import {
  buildPath,
  getQueryString,
  isValidLinkUrl,
  safeDecodeURI,
  safeDecodeURIComponent,
} from './url';

describe('getQueryString', () => {
  test('returns an empty string for no params', () => {
    expect(getQueryString()).toBe('');
    expect(getQueryString({})).toBe('');
  });

  test('serializes params into a query string', () => {
    expect(getQueryString({ a: 1, b: 'two' })).toBe('a=1&b=two');
  });

  test('skips undefined, null and NaN values', () => {
    expect(getQueryString({ a: 1, b: undefined, c: null, d: NaN })).toBe('a=1');
  });

  test('encodes special characters', () => {
    expect(getQueryString({ q: 'a b&c' })).toBe('q=a+b%26c');
  });
});

describe('buildPath', () => {
  test('appends a query string when params are present', () => {
    expect(buildPath('/api', { a: 1 })).toBe('/api?a=1');
  });

  test('returns the path unchanged when there are no params', () => {
    expect(buildPath('/api')).toBe('/api');
    expect(buildPath('/api', {})).toBe('/api');
  });
});

describe('safeDecodeURI', () => {
  test('decodes a valid encoded URI', () => {
    expect(safeDecodeURI('a%20b')).toBe('a b');
  });

  test('returns the original string for malformed input', () => {
    expect(safeDecodeURI('%')).toBe('%');
    expect(safeDecodeURI('%E0%A4%A')).toBe('%E0%A4%A');
  });

  test('passes through null and undefined', () => {
    expect(safeDecodeURI(null)).toBeNull();
    expect(safeDecodeURI(undefined)).toBeUndefined();
  });
});

describe('safeDecodeURIComponent', () => {
  test('decodes a valid encoded component', () => {
    expect(safeDecodeURIComponent('a%26b')).toBe('a&b');
  });

  test('returns the original string for malformed input', () => {
    expect(safeDecodeURIComponent('%')).toBe('%');
    expect(safeDecodeURIComponent('%ZZ')).toBe('%ZZ');
  });

  test('passes through null and undefined', () => {
    expect(safeDecodeURIComponent(null)).toBeNull();
    expect(safeDecodeURIComponent(undefined)).toBeUndefined();
  });
});

describe('isValidLinkUrl', () => {
  test('returns true for valid urls', () => {
    expect(isValidLinkUrl('https://umami.is')).toBe(true);
    expect(isValidLinkUrl('http://localhost:3000/path?q=1')).toBe(true);
    expect(isValidLinkUrl('http://192.168.1.1')).toBe(true);
    expect(isValidLinkUrl('http://[2001:db8::1]')).toBe(true);
    expect(isValidLinkUrl('mailto:hi@example.com')).toBe(true);
    expect(isValidLinkUrl('myapp://open')).toBe(true);
  });

  test('returns false for invalid urls', () => {
    expect(isValidLinkUrl('not a url')).toBe(false);
    expect(isValidLinkUrl('/relative/path')).toBe(false);
    expect(isValidLinkUrl('')).toBe(false);
  });
});
