import { beforeEach, expect, test, vi } from 'vitest';
import { POST } from './route';

const mocks = vi.hoisted(() => ({
  parseRequest: vi.fn(),
  getUser: vi.fn(),
  getTwoFactorAuth: vi.fn(),
  savePendingTwoFactor: vi.fn(),
  generateTotpSecret: vi.fn(),
  encryptSecret: vi.fn(),
  isTwoFactorConfigured: vi.fn(),
  generateOtpAuthUri: vi.fn(),
  generateQrCodeDataUrl: vi.fn(),
}));

vi.mock('@/lib/request', () => ({
  parseRequest: mocks.parseRequest,
}));

vi.mock('@/queries/drizzle/user', () => ({
  getUser: mocks.getUser,
}));

vi.mock('@/queries/drizzle/twoFactor', () => ({
  getTwoFactorAuth: mocks.getTwoFactorAuth,
  savePendingTwoFactor: mocks.savePendingTwoFactor,
}));

vi.mock('@/lib/two-factor/crypto', () => ({
  encryptSecret: mocks.encryptSecret,
  getTwoFactorConfigurationError: () => ({
    code: 'two-factor-error-not-configured',
    message: 'TWO_FACTOR_ENCRYPTION_KEY is missing or invalid',
  }),
  isTwoFactorConfigured: mocks.isTwoFactorConfigured,
}));

vi.mock('@/lib/two-factor/totp', () => ({
  generateOtpAuthUri: mocks.generateOtpAuthUri,
  generateQrCodeDataUrl: mocks.generateQrCodeDataUrl,
  generateTotpSecret: mocks.generateTotpSecret,
}));

beforeEach(() => {
  mocks.parseRequest.mockReset();
  mocks.getUser.mockReset();
  mocks.getTwoFactorAuth.mockReset();
  mocks.savePendingTwoFactor.mockReset();
  mocks.generateTotpSecret.mockReset();
  mocks.encryptSecret.mockReset();
  mocks.isTwoFactorConfigured.mockReset();
  mocks.generateOtpAuthUri.mockReset();
  mocks.generateQrCodeDataUrl.mockReset();

  mocks.isTwoFactorConfigured.mockReturnValue(true);
  mocks.parseRequest.mockResolvedValue({
    auth: { user: { id: 'user-1' } },
    error: undefined,
  });
  mocks.getUser.mockResolvedValue({ id: 'user-1', username: 'alice' });
  mocks.getTwoFactorAuth.mockResolvedValue(null);
  mocks.generateTotpSecret.mockReturnValue('plain-secret');
  mocks.encryptSecret.mockReturnValue('encrypted-secret');
  mocks.generateOtpAuthUri.mockReturnValue('otpauth://alice');
  mocks.generateQrCodeDataUrl.mockResolvedValue('data:image/png;base64,qr');
  mocks.savePendingTwoFactor.mockResolvedValue(true);
});

test('POST creates a pending 2FA setup and returns the manual key and QR data', async () => {
  const response = await POST(
    new Request('http://localhost/api/2fa/setup/initiate', { method: 'POST' }),
  );

  expect(mocks.getTwoFactorAuth).toHaveBeenCalledWith('user-1');
  expect(mocks.savePendingTwoFactor).toHaveBeenCalledWith('user-1', 'encrypted-secret');
  await expect(response.json()).resolves.toEqual({
    manualKey: 'plain-secret',
    qrCodeDataUrl: 'data:image/png;base64,qr',
  });
  expect(response.status).toBe(200);
});

test('POST reports a configuration error when the encryption key is missing', async () => {
  mocks.isTwoFactorConfigured.mockReturnValue(false);

  const response = await POST(
    new Request('http://localhost/api/2fa/setup/initiate', { method: 'POST' }),
  );

  expect(mocks.savePendingTwoFactor).not.toHaveBeenCalled();
  await expect(response.json()).resolves.toMatchObject({
    error: {
      code: 'two-factor-error-not-configured',
    },
  });
  expect(response.status).toBe(503);
});

test('POST rejects setup when 2FA is already enabled for the user', async () => {
  mocks.getTwoFactorAuth.mockResolvedValue({ userId: 'user-1', isEnabled: true });

  const response = await POST(
    new Request('http://localhost/api/2fa/setup/initiate', { method: 'POST' }),
  );

  expect(mocks.savePendingTwoFactor).not.toHaveBeenCalled();
  await expect(response.json()).resolves.toMatchObject({
    error: {
      code: 'two-factor-error-already-enabled',
    },
  });
  expect(response.status).toBe(400);
});
