import { parseRequest } from '@/lib/request';
import { json } from '@/lib/response';
import { isTwoFactorConfigured } from '@/lib/two-factor/crypto';
import { getTwoFactorAuth, getTwoFactorRequirements } from '@/queries/drizzle/twoFactor';

export async function GET(request: Request) {
  const { auth, error } = await parseRequest(request);
  if (error) return error();
  if (process.env.CLOUD_MODE) {
    return json({
      isEnabled: false,
      isRequired: false,
      requiredReason: null,
      isConfigured: false,
      globalRequired: false,
    });
  }
  const [twoFactor, requirements] = await Promise.all([
    getTwoFactorAuth(auth.user.id),
    getTwoFactorRequirements(auth.user.id),
  ]);
  const isConfigured = isTwoFactorConfigured();
  const requiredReason = !isConfigured
    ? null
    : requirements.global
      ? 'global'
      : requirements.user
        ? 'user'
        : requirements.team
          ? 'team'
          : null;
  return json({
    isEnabled: twoFactor?.isEnabled ?? false,
    isRequired: requiredReason !== null,
    requiredReason,
    isConfigured,
    globalRequired: requirements.global,
  });
}
