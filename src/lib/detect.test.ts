import { beforeEach, expect, test } from 'vitest';
import { getClientInfo, getLocation, hasBlockedIp } from './detect';
import { getIpAddress } from './ip';

beforeEach(() => {
  delete process.env.CLIENT_IP_HEADER;
  delete process.env.IGNORE_IP;
});

test('uses the connecting IP and honors an explicitly configured proxy header', () => {
  expect(
    getIpAddress(new Headers({ 'cf-connecting-ip': '8.8.8.8', 'x-forwarded-for': '1.1.1.1' })),
  ).toBe('8.8.8.8');
  process.env.CLIENT_IP_HEADER = 'x-custom-ip';
  expect(getIpAddress(new Headers({ 'x-custom-ip': '1.1.1.1' }))).toBe('1.1.1.1');
});

test.each(['not-an-ip', '127.0.0.1', '192.168.1.1', '::1'])(
  'does not locate private or invalid address %s',
  ip => {
    expect(getLocation(ip, { country: 'US', regionCode: 'CA' })).toBeNull();
  },
);

test('reads geographic metadata supplied by the Workers runtime', () => {
  expect(getLocation('8.8.8.8', { country: 'US', regionCode: 'CA', city: 'Los Angeles' })).toEqual({
    country: 'US',
    region: 'US-CA',
    city: 'Los Angeles',
  });
});

test('does not trust geographic headers or associate an overridden IP with the request location', async () => {
  const request = new Request('https://example.com', {
    headers: { 'cf-connecting-ip': '8.8.8.8', 'x-vercel-ip-country': 'CN', 'cf-ipcountry': 'CN' },
  });
  expect(await getClientInfo(request, {})).toMatchObject({ country: undefined });
  Object.defineProperty(request, 'cf', { value: { country: 'US', regionCode: 'CA' } });
  expect(await getClientInfo(request, {})).toMatchObject({ country: 'US', region: 'US-CA' });
  expect(await getClientInfo(request, { ip: '1.1.1.1' })).toMatchObject({ country: undefined });
});

test('ignores malformed blocked addresses', () => {
  process.env.IGNORE_IP = '10.0.0.0/8';
  expect(hasBlockedIp('not-an-ip')).toBe(false);
});
