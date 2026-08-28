import { parseRequest } from '@/lib/request';
import { badRequest, json, notFound, serviceUnavailable } from '@/lib/response';
import {
  encryptSecret,
  getTwoFactorConfigurationError,
  isTwoFactorConfigured,
} from '@/lib/two-factor/crypto';
import {
  generateOtpAuthUri,
  generateQrCodeDataUrl,
  generateTotpSecret,
} from '@/lib/two-factor/totp';
import { getTwoFactorAuth, savePendingTwoFactor } from '@/queries/drizzle/twoFactor';
import { getUser } from '@/queries/drizzle/user';

export async function POST(request: Request) {
  if (process.env.CLOUD_MODE) {
    return notFound();
  }

  const { auth, error } = await parseRequest(request);

  if (error) {
    return error();
  }

  // Secrets cannot be stored without an encryption key
  if (!isTwoFactorConfigured()) {
    return serviceUnavailable(getTwoFactorConfigurationError());
  }

  const userId = auth.user.id;
  const user = await getUser(userId);

  if (!user) {
    return badRequest({ message: 'User not found' });
  }

  const existing = await getTwoFactorAuth(userId);

  if (existing?.isEnabled) {
    return badRequest({
      code: 'two-factor-error-already-enabled',
      message: '2FA is already enabled',
    });
  }

  const secret = generateTotpSecret();
  const encryptedSecret = encryptSecret(secret);
  const otpAuthUri = generateOtpAuthUri(secret, user.username);
  const qrCodeDataUrl = await generateQrCodeDataUrl(otpAuthUri);

  if (!(await savePendingTwoFactor(userId, encryptedSecret))) {
    return badRequest({
      code: 'two-factor-error-already-enabled',
      message: '2FA is already enabled',
    });
  }

  /*
  `manualKey` is intentionally plaintext as the user needs it once for manual entry.
  The encrypted copy in DB is what matters for long-term storage.
   */
  return json({ qrCodeDataUrl, manualKey: secret });
}
