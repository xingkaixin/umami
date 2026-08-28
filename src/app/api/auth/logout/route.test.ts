import { beforeEach, expect, test, vi } from 'vitest';
import { parseRequest } from '@/lib/request';
import { POST } from './route';

vi.mock('@/lib/redis', () => ({
  default: {
    enabled: true,
    client: {
      del: vi.fn(),
    },
  },
}));

vi.mock('@/lib/request', () => ({
  parseRequest: vi.fn(),
}));

vi.mock('@/lib/response', () => ({
  ok: () => new Response(null, { status: 200 }),
}));

const parseRequestMock = vi.mocked(parseRequest);

beforeEach(() => {
  parseRequestMock.mockReset();
});

test('POST does not delete a key when auth fails', async () => {
  parseRequestMock.mockResolvedValue({
    auth: null,
    error: () => new Response(null, { status: 401 }),
  });

  const response = await POST(new Request('http://localhost/api/auth/logout', { method: 'POST' }));

  expect(response.status).toBe(401);
});
