import { renderHook } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { getClientAuthToken } from '@/lib/client';
import { httpGet } from '@/lib/fetch';
import { useApi } from './useApi';

vi.mock('@/store/app', () => ({
  useApp: (selector: (state: object) => unknown) => selector({}),
}));
vi.mock('@/lib/client', () => ({ getClientAuthToken: vi.fn() }));
vi.mock('@/lib/fetch', () => ({
  httpGet: vi.fn(async () => ({ ok: true, data: {} })),
  httpPost: vi.fn(),
  httpPut: vi.fn(),
  httpDelete: vi.fn(),
}));

test('uses a replaced token from an already mounted API callback', async () => {
  vi.mocked(getClientAuthToken).mockReturnValue('old-token');
  const { get } = renderHook(() => useApi()).result.current;

  vi.mocked(getClientAuthToken).mockReturnValue('new-token');
  await get('/me');

  expect(httpGet).toHaveBeenCalledWith(
    expect.any(String),
    {},
    expect.objectContaining({ authorization: 'Bearer new-token' }),
  );
});
