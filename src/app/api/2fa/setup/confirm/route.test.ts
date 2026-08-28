import { beforeEach, expect, test, vi } from 'vitest';
import { POST } from './route';

const mocks = vi.hoisted(() => ({
  parseRequest: vi.fn(),
  getTwoFactorAuth: vi.fn(),
  confirmTwoFactorSetup: vi.fn(),
  generateBackupCodes: vi.fn(),
  decryptSecret: vi.fn(),
  isTwoFactorConfigured: vi.fn(),
  checkRateLimit: vi.fn(),
  recordFailedAttempt: vi.fn(),
  isOtpReplayed: vi.fn(),
  verifyTotp: vi.fn(),
}));

vi.mock('@/lib/request', () => ({
  parseRequest: mocks.parseRequest,
}));

vi.mock('@/queries/drizzle/twoFactor', () => ({
  isOtpReplayed: mocks.isOtpReplayed,

  getTwoFactorAuth: mocks.getTwoFactorAuth,
  confirmTwoFactorSetup: mocks.confirmTwoFactorSetup,
}));

vi.mock('@/lib/two-factor/backup-codes', () => ({
  generateBackupCodes: mocks.generateBackupCodes,
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
}));

vi.mock('@/lib/two-factor/totp', () => ({
  verifyTotp: mocks.verifyTotp,
}));

beforeEach(() => {
  mocks.parseRequest.mockReset();
  mocks.getTwoFactorAuth.mockReset();
  mocks.confirmTwoFactorSetup.mockReset();
  mocks.generateBackupCodes.mockReset();
  mocks.decryptSecret.mockReset();
  mocks.isTwoFactorConfigured.mockReset();
  mocks.checkRateLimit.mockReset();
  mocks.recordFailedAttempt.mockReset();
  mocks.isOtpReplayed.mockReset();
  mocks.verifyTotp.mockReset();

  mocks.parseRequest.mockResolvedValue({
    auth: { user: { id: 'user-1' } },
    body: { token: '123456' },
    error: undefined,
  });
  mocks.getTwoFactorAuth.mockResolvedValue({
    userId: 'user-1',
    isEnabled: false,
    secret: 'encrypted',
  });
  mocks.confirmTwoFactorSetup.mockResolvedValue(true);
  mocks.generateBackupCodes.mockResolvedValue({
    plaintext: ['code-1', 'code-2'],
    hashed: ['hash-1', 'hash-2'],
  });
  mocks.decryptSecret.mockReturnValue('plain-secret');
  mocks.isTwoFactorConfigured.mockReturnValue(true);
  mocks.checkRateLimit.mockResolvedValue({ allowed: true });
  mocks.recordFailedAttempt.mockResolvedValue({ lockedUntil: undefined });
  mocks.isOtpReplayed.mockResolvedValue(false);
  mocks.verifyTotp.mockResolvedValue(true);
});

test('POST confirms setup, enables 2FA, stores backup codes, and resets the rate limit', async () => {
  const response = await POST(
    new Request('http://localhost/api/2fa/setup/confirm', { method: 'POST' }),
  );

  expect(mocks.checkRateLimit).toHaveBeenCalledWith('user-1');
  expect(mocks.decryptSecret).toHaveBeenCalledWith('encrypted');
  expect(mocks.verifyTotp).toHaveBeenCalledWith('123456', 'plain-secret');
  expect(mocks.confirmTwoFactorSetup).toHaveBeenCalledWith(
    'user-1',
    '123456',
    ['hash-1', 'hash-2'],
    'encrypted',
  );
  await expect(response.json()).resolves.toEqual({
    backupCodes: ['code-1', 'code-2'],
  });
  expect(response.status).toBe(200);
});

test('POST reports a configuration error when the encryption key is missing', async () => {
  mocks.isTwoFactorConfigured.mockReturnValue(false);

  const response = await POST(
    new Request('http://localhost/api/2fa/setup/confirm', { method: 'POST' }),
  );

  expect(mocks.checkRateLimit).not.toHaveBeenCalled();
  expect(mocks.decryptSecret).not.toHaveBeenCalled();
  await expect(response.json()).resolves.toMatchObject({
    error: {
      code: 'two-factor-error-not-configured',
    },
  });
  expect(response.status).toBe(503);
});

test('POST records a failed attempt and skips writes when the token is invalid', async () => {
  mocks.verifyTotp.mockResolvedValue(false);

  const response = await POST(
    new Request('http://localhost/api/2fa/setup/confirm', { method: 'POST' }),
  );

  expect(mocks.recordFailedAttempt).toHaveBeenCalledWith('user-1');
  expect(mocks.confirmTwoFactorSetup).not.toHaveBeenCalled();
  await expect(response.json()).resolves.toMatchObject({
    error: {
      code: 'two-factor-error-invalid-code',
    },
  });
  expect(response.status).toBe(400);
});
