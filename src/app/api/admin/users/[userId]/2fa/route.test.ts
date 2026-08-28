import { beforeEach, expect, test, vi } from 'vitest';
import { parseRequest } from '@/lib/request';
import { isTwoFactorConfigured } from '@/lib/two-factor/crypto';
import { canEnforceTwoFactorAuthForUser } from '@/permissions';
import { getTwoFactorAuth, resetTwoFactorAuth } from '@/queries/drizzle/twoFactor';
import { updateUser } from '@/queries/drizzle/user';
import { DELETE, GET, POST } from './route';

vi.mock('@/lib/request', () => ({
  parseRequest: vi.fn(),
}));

vi.mock('@/permissions', () => ({
  canEnforceTwoFactorAuthForUser: vi.fn(),
}));

vi.mock('@/queries/drizzle/user', () => ({
  updateUser: vi.fn(),
}));

vi.mock('@/lib/two-factor/crypto', () => ({
  getTwoFactorConfigurationError: () => ({
    code: 'two-factor-error-not-configured',
    message: 'TWO_FACTOR_ENCRYPTION_KEY is missing or invalid',
  }),
  isTwoFactorConfigured: vi.fn(),
}));

vi.mock('@/queries/drizzle/twoFactor', () => ({
  getTwoFactorAuth: vi.fn(),
  resetTwoFactorAuth: vi.fn(),
}));

const parseRequestMock = vi.mocked(parseRequest);
const canEnforceTwoFactorAuthForUserMock = vi.mocked(canEnforceTwoFactorAuthForUser);
const isTwoFactorConfiguredMock = vi.mocked(isTwoFactorConfigured);
const updateUserMock = vi.mocked(updateUser);
const getTwoFactorAuthMock = vi.mocked(getTwoFactorAuth);
const resetTwoFactorAuthMock = vi.mocked(resetTwoFactorAuth);

beforeEach(() => {
  parseRequestMock.mockReset();
  canEnforceTwoFactorAuthForUserMock.mockReset();
  isTwoFactorConfiguredMock.mockReset();
  updateUserMock.mockReset();
  getTwoFactorAuthMock.mockReset();
  resetTwoFactorAuthMock.mockReset();

  parseRequestMock.mockResolvedValue({
    auth: {
      user: {
        id: 'admin-1',
        isAdmin: true,
      },
    },
    error: undefined,
  });
  canEnforceTwoFactorAuthForUserMock.mockResolvedValue(true);
  isTwoFactorConfiguredMock.mockReturnValue(true);
});

test('GET returns whether 2FA is enabled for the target user', async () => {
  getTwoFactorAuthMock.mockResolvedValue({
    userId: 'user-1',
    isEnabled: true,
  } as any);

  const response = await GET(new Request('http://localhost/api/admin/users/user-1/2fa'), {
    params: Promise.resolve({ userId: 'user-1' }),
  });

  await expect(response.json()).resolves.toEqual({ isEnabled: true });
  expect(response.status).toBe(200);
});

test('POST updates the user-level 2FA requirement flag', async () => {
  parseRequestMock.mockResolvedValue({
    auth: {
      user: {
        id: 'admin-1',
        isAdmin: true,
      },
    },
    body: {
      required: true,
    },
    error: undefined,
  });
  updateUserMock.mockResolvedValue({ id: 'user-1' } as any);

  const response = await POST(
    new Request('http://localhost/api/admin/users/user-1/2fa', { method: 'POST' }),
    {
      params: Promise.resolve({ userId: 'user-1' }),
    },
  );

  expect(updateUserMock).toHaveBeenCalledWith('user-1', { twoFactorRequired: true });
  await expect(response.json()).resolves.toEqual({
    ok: true,
    userId: 'user-1',
    twoFactorRequired: true,
  });
  expect(response.status).toBe(200);
});

test('POST rejects enabling a user-level 2FA requirement when the encryption key is missing', async () => {
  parseRequestMock.mockResolvedValue({
    auth: {
      user: {
        id: 'admin-1',
        isAdmin: true,
      },
    },
    body: {
      required: true,
    },
    error: undefined,
  });
  isTwoFactorConfiguredMock.mockReturnValue(false);

  const response = await POST(
    new Request('http://localhost/api/admin/users/user-1/2fa', { method: 'POST' }),
    {
      params: Promise.resolve({ userId: 'user-1' }),
    },
  );

  expect(updateUserMock).not.toHaveBeenCalled();
  await expect(response.json()).resolves.toMatchObject({
    error: {
      code: 'two-factor-error-not-configured',
    },
  });
  expect(response.status).toBe(503);
});

test('DELETE clears the user 2FA configuration and related support tables', async () => {
  resetTwoFactorAuthMock.mockResolvedValue({
    twoFactorAuth: 1,
    backupCodes: 8,
    otpUsed: 2,
    rateLimit: 1,
  });

  const response = await DELETE(
    new Request('http://localhost/api/admin/users/user-1/2fa', { method: 'DELETE' }),
    {
      params: Promise.resolve({ userId: 'user-1' }),
    },
  );

  expect(resetTwoFactorAuthMock).toHaveBeenCalledWith('user-1');
  await expect(response.json()).resolves.toEqual({
    ok: true,
    userId: 'user-1',
    reset: {
      twoFactorAuth: 1,
      backupCodes: 8,
      otpUsed: 2,
      rateLimit: 1,
    },
  });
  expect(response.status).toBe(200);
});
