import { beforeEach, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getBearerToken: vi.fn(),
  saveAuth: vi.fn(),
  parseSecureToken: vi.fn(),
  createSecureToken: vi.fn(),
  getUser: vi.fn(),
  getAllUserTeams: vi.fn(),
  findTwoFactorAuth: vi.fn(),
  findBackupCodes: vi.fn(),
  updateBackupCodes: vi.fn(),
  verifyBackupCode: vi.fn(),
  decryptSecret: vi.fn(),
  isTwoFactorConfigured: vi.fn(),
  checkRateLimit: vi.fn(),
  recordFailedAttempt: vi.fn(),
  resetRateLimit: vi.fn(),
  isOtpReplayed: vi.fn(),
  consumeOtp: vi.fn(),
  verifyTotp: vi.fn(),
  secret: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  getBearerToken: mocks.getBearerToken,
  saveAuth: mocks.saveAuth,
}));

vi.mock('@/lib/crypto', () => ({
  hash: () => 'password-fingerprint',
  secret: mocks.secret,
}));

vi.mock('@/lib/jwt', () => ({
  createSecureToken: mocks.createSecureToken,
  parseSecureToken: mocks.parseSecureToken,
}));

vi.mock('@/queries/drizzle', () => ({
  getAllUserTeams: mocks.getAllUserTeams,
  getUser: mocks.getUser,
}));

vi.mock('@/queries/drizzle/twoFactor', () => ({
  isOtpReplayed: mocks.isOtpReplayed,
  consumeOtp: mocks.consumeOtp,

  getTwoFactorAuth: mocks.findTwoFactorAuth,
  getUnusedBackupCodes: mocks.findBackupCodes,
  consumeBackupCode: mocks.updateBackupCodes,
}));

vi.mock('@/lib/two-factor/backup-codes', () => ({
  verifyBackupCode: mocks.verifyBackupCode,
}));

vi.mock('@/lib/two-factor/crypto', () => ({
  decryptSecret: mocks.decryptSecret,
  getTwoFactorConfigurationError: () => ({
    code: 'two-factor-error-not-configured',
    message: 'TWO_FACTOR_ENCRYPTION_KEY is missing or invalid',
  }),
  isTwoFactorConfigured: mocks.isTwoFactorConfigured,
}));

vi.mock('@/lib/two-factor/rate-limit', () => ({
  checkRateLimit: mocks.checkRateLimit,
  recordFailedAttempt: mocks.recordFailedAttempt,
  resetRateLimit: mocks.resetRateLimit,
}));

vi.mock('@/lib/two-factor/totp', () => ({
  verifyTotp: mocks.verifyTotp,
}));

vi.mock('@/lib/redis', () => ({
  default: {
    enabled: false,
  },
}));

import { POST } from './route';

beforeEach(() => {
  mocks.getBearerToken.mockReset();
  mocks.saveAuth.mockReset();
  mocks.parseSecureToken.mockReset();
  mocks.createSecureToken.mockReset();
  mocks.getUser.mockReset();
  mocks.getAllUserTeams.mockReset();
  mocks.findTwoFactorAuth.mockReset();
  mocks.findBackupCodes.mockReset();
  mocks.updateBackupCodes.mockReset();
  mocks.verifyBackupCode.mockReset();
  mocks.decryptSecret.mockReset();
  mocks.isTwoFactorConfigured.mockReset();
  mocks.checkRateLimit.mockReset();
  mocks.recordFailedAttempt.mockReset();
  mocks.resetRateLimit.mockReset();
  mocks.isOtpReplayed.mockReset();
  mocks.consumeOtp.mockReset();
  mocks.verifyTotp.mockReset();
  mocks.secret.mockReset();

  mocks.getBearerToken.mockReturnValue('partial-token');
  mocks.secret.mockReturnValue('app-secret');
  mocks.parseSecureToken.mockReturnValue({ type: 'partial-auth', userId: 'user-1' });
  mocks.getUser.mockResolvedValue({
    id: 'user-1',
    username: 'alice',
    role: 'admin',
    createdAt: new Date('2026-07-23T00:00:00.000Z'),
  });
  mocks.getAllUserTeams.mockResolvedValue([]);
  mocks.findTwoFactorAuth.mockResolvedValue({
    userId: 'user-1',
    isEnabled: true,
    secret: 'encrypted',
  });
  mocks.createSecureToken.mockReturnValue('full-auth-token');
  mocks.decryptSecret.mockReturnValue('plain-secret');
  mocks.isTwoFactorConfigured.mockReturnValue(true);
  mocks.checkRateLimit.mockResolvedValue({ allowed: true });
  mocks.recordFailedAttempt.mockResolvedValue({ lockedUntil: undefined });
  mocks.resetRateLimit.mockResolvedValue(undefined);
  mocks.isOtpReplayed.mockResolvedValue(false);
  mocks.consumeOtp.mockResolvedValue(true);
  mocks.verifyTotp.mockResolvedValue(true);
  mocks.findBackupCodes.mockResolvedValue([]);
  mocks.updateBackupCodes.mockResolvedValue(false);
  mocks.verifyBackupCode.mockResolvedValue(null);
});

test('POST accepts a token-only payload and completes 2FA verification', async () => {
  const response = await POST(
    new Request('http://localhost/api/2fa/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer partial-token',
      },
      body: JSON.stringify({ token: '123456' }),
    }),
  );

  expect(mocks.verifyTotp).toHaveBeenCalledWith('123456', 'plain-secret');
  expect(mocks.consumeOtp).toHaveBeenCalledWith('user-1', '123456', 'encrypted');
  expect(mocks.resetRateLimit).toHaveBeenCalledWith('user-1');
  await expect(response.json()).resolves.toMatchObject({
    token: 'full-auth-token',
    user: {
      id: 'user-1',
      username: 'alice',
    },
  });
  expect(response.status).toBe(200);
});

test('POST returns a configuration error when the encryption key is missing', async () => {
  mocks.isTwoFactorConfigured.mockReturnValue(false);

  const response = await POST(
    new Request('http://localhost/api/2fa/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer partial-token',
      },
      body: JSON.stringify({ token: '123456' }),
    }),
  );

  expect(mocks.findTwoFactorAuth).not.toHaveBeenCalled();
  await expect(response.json()).resolves.toMatchObject({
    error: {
      code: 'two-factor-error-not-configured',
    },
  });
  expect(response.status).toBe(503);
});
