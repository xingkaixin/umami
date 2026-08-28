import { z } from 'zod';
import { parseRequest } from '@/lib/request';
import { badRequest, json, notFound, serviceUnavailable } from '@/lib/response';
import { generateBackupCodes } from '@/lib/two-factor/backup-codes';
import {
  decryptSecret,
  getTwoFactorConfigurationError,
  isTwoFactorConfigured,
} from '@/lib/two-factor/crypto';
import { checkRateLimit, recordFailedAttempt } from '@/lib/two-factor/rate-limit';
import { isOtpReplayed } from '@/queries/drizzle/twoFactor';
import { verifyTotp } from '@/lib/two-factor/totp';
import { confirmTwoFactorSetup, getTwoFactorAuth } from '@/queries/drizzle/twoFactor';

export async function POST(request: Request) {
  if (process.env.CLOUD_MODE) {
    return notFound();
  }

  const schema = z.object({ token: z.string().length(6) });

  const { auth, body, error } = await parseRequest(request, schema);

  if (error) {
    return error();
  }

  if (!isTwoFactorConfigured()) {
    return serviceUnavailable(getTwoFactorConfigurationError());
  }

  const userId = auth.user.id;
  const { token } = body;

  const twoFactor = await getTwoFactorAuth(userId);

  // Verify if 2FA is waiting for setup
  if (!twoFactor || twoFactor.isEnabled) {
    return badRequest({
      code: 'two-factor-error-no-pending-setup',
      message: 'No pending 2FA setup found',
    });
  }

  // Verify rate limit
  const rateCheck = await checkRateLimit(userId);
  if (!rateCheck.allowed) {
    return Response.json(
      {
        error: {
          code: 'two-factor-error-too-many-attempts',
          message: 'Too many failed attempts',
          lockedUntil: rateCheck.lockedUntil,
        },
      },
      { status: 429 },
    );
  }

  // Prevent OTP replay
  if (await isOtpReplayed(userId, token)) {
    return badRequest({ code: 'two-factor-error-code-used', message: 'Code already used' });
  }

  // Verify TOTP
  const secret = decryptSecret(twoFactor.secret);
  if (!(await verifyTotp(token, secret))) {
    const { lockedUntil } = await recordFailedAttempt(userId);
    return badRequest({
      code: 'two-factor-error-invalid-code',
      message: 'Invalid verification code',
      ...(lockedUntil && { lockedUntil }),
    });
  }

  const { plaintext, hashed } = await generateBackupCodes();

  if (!(await confirmTwoFactorSetup(userId, token, hashed, twoFactor.secret))) {
    return badRequest({ code: 'two-factor-error-code-used', message: 'Code already used' });
  }

  return json({ backupCodes: plaintext });
}
