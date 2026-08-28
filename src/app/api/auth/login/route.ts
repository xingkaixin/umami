import { z } from 'zod';
import { ROLES } from '@/lib/constants';
import { hash, secret } from '@/lib/crypto';
import { createSecureToken } from '@/lib/jwt';
import { checkPassword } from '@/lib/password';
import { getTwoFactorAuth } from '@/queries/drizzle/twoFactor';
import { parseRequest } from '@/lib/request';
import { json, serviceUnavailable, unauthorized } from '@/lib/response';
import { getTwoFactorConfigurationError, isTwoFactorConfigured } from '@/lib/two-factor/crypto';
import { getAllUserTeams, getUserByUsername } from '@/queries/drizzle';

export async function POST(request: Request) {
  const schema = z.object({
    username: z.string(),
    password: z.string(),
  });

  const { body, error } = await parseRequest(request, schema, { skipAuth: true });

  if (error) {
    return error();
  }

  const { username, password } = body;

  const user = await getUserByUsername(username, { includePassword: true });

  if (!user || !checkPassword(password, user.password)) {
    return unauthorized({ code: 'incorrect-username-password' });
  }

  const { id, role, createdAt } = user;
  const cloudMode = !!process.env.CLOUD_MODE;

  // Check if 2FA is enabled for this user
  const twoFactor = !cloudMode ? await getTwoFactorAuth(id) : null;

  if (twoFactor?.isEnabled) {
    if (!isTwoFactorConfigured()) {
      return serviceUnavailable(getTwoFactorConfigurationError());
    }

    const partialToken = createSecureToken({ userId: id, type: 'partial-auth' }, secret(), {
      expiresIn: '5m',
    });
    return json({ requiresTwoFactor: true, partialToken });
  }
  // Bind token to password hash so a password change invalidates old tokens.
  const pwd = hash(user.password);

  const token = createSecureToken({ userId: id, role, pwd }, secret());

  const teams = await getAllUserTeams(id);

  return json({
    token,
    user: { id, username, role, createdAt, isAdmin: role === ROLES.admin, teams },
  });
}
