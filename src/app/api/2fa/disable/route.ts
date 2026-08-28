import { z } from 'zod';
import { checkPassword } from '@/lib/password';
import { parseRequest } from '@/lib/request';
import { badRequest, forbidden, json, notFound, serviceUnavailable } from '@/lib/response';
import {
  decryptSecret,
  getTwoFactorConfigurationError,
  isTwoFactorConfigured,
} from '@/lib/two-factor/crypto';
import { checkRateLimit, recordFailedAttempt } from '@/lib/two-factor/rate-limit';
import { isOtpReplayed } from '@/queries/drizzle/twoFactor';
import { verifyTotp } from '@/lib/two-factor/totp';
import {
  disableTwoFactorAuth,
  getTwoFactorAuth,
  getTwoFactorRequirements,
} from '@/queries/drizzle/twoFactor';
import { getUser } from '@/queries/drizzle/user';

export async function POST(request: Request) {
  if (process.env.CLOUD_MODE) {
    return notFound();
  }

  const schema = z.object({
    password: z.string(),
    token: z.string().length(6),
  });

  const { auth, body, error } = await parseRequest(request, schema);

  if (error) {
    return error();
  }

  if (!isTwoFactorConfigured()) {
    return serviceUnavailable(getTwoFactorConfigurationError());
  }

  const userId = auth.user.id;
  const { password, token } = body;

  const requirements = await getTwoFactorRequirements(userId);

  // Cannot disable 2FA if required
  if (requirements.global || requirements.user || requirements.team) {
    return forbidden({
      code: 'two-factor-error-disable-not-allowed',
      message: '2FA is required and cannot be disabled',
    });
  }

  // Verify password
  const userWithPw = await getUser(userId, { includePassword: true });
  if (!userWithPw || !checkPassword(password, userWithPw.password)) {
    return badRequest({
      code: 'two-factor-error-incorrect-password',
      message: 'Incorrect password',
    });
  }

  // Verify if 2FA is enabled
  const twoFactor = await getTwoFactorAuth(userId);
  if (!twoFactor?.isEnabled) {
    return badRequest({ code: 'two-factor-error-not-enabled', message: '2FA is not enabled' });
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

  if (!(await disableTwoFactorAuth(userId, token, twoFactor.secret))) {
    return badRequest({ code: 'two-factor-error-code-used', message: 'Code already used' });
  }

  return json({ ok: true });
}
