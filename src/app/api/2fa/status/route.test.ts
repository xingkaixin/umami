import { beforeEach, expect, test, vi } from 'vitest';
import { parseRequest } from '@/lib/request';
import { GET } from './route';

const KEY = 'a'.repeat(64);
const mocks = vi.hoisted(() => ({
  findTwoFactorAuth: vi.fn(),
  getTwoFactorRequirements: vi.fn(),
}));

vi.mock('@/lib/request', () => ({
  parseRequest: vi.fn(),
}));

vi.mock('@/queries/drizzle/twoFactor', () => ({
  getTwoFactorAuth: mocks.findTwoFactorAuth,
  getTwoFactorRequirements: mocks.getTwoFactorRequirements,
}));

const parseRequestMock = vi.mocked(parseRequest);

beforeEach(() => {
  vi.unstubAllEnvs();
  parseRequestMock.mockReset();
  mocks.findTwoFactorAuth.mockReset();
  mocks.getTwoFactorRequirements.mockReset();

  parseRequestMock.mockResolvedValue({
    auth: {
      user: {
        id: 'user-1',
      },
    },
    error: undefined,
  });
  mocks.findTwoFactorAuth.mockResolvedValue(null as any);
  mocks.getTwoFactorRequirements.mockResolvedValue({ global: true, user: false, team: false });
});

test('GET requires 2FA when it is globally enabled', async () => {
  vi.stubEnv('TWO_FACTOR_ENCRYPTION_KEY', KEY);

  const response = await GET(new Request('http://localhost/api/2fa/status'));

  await expect(response.json()).resolves.toEqual({
    isEnabled: false,
    isRequired: true,
    isConfigured: true,
    globalRequired: true,
    requiredReason: 'global',
  });
  expect(response.status).toBe(200);
});

test('GET does not require 2FA when the encryption key is missing', async () => {
  vi.stubEnv('TWO_FACTOR_ENCRYPTION_KEY', '');

  const response = await GET(new Request('http://localhost/api/2fa/status'));

  await expect(response.json()).resolves.toEqual({
    isEnabled: false,
    isRequired: false,
    isConfigured: false,
    globalRequired: true,
    requiredReason: null,
  });
  expect(response.status).toBe(200);
});
