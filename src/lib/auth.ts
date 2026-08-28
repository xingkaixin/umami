import debug from 'debug';
import {
  ROLE_PERMISSIONS,
  ROLES,
  SHARE_CONTEXT_HEADER,
  SHARE_TOKEN_HEADER,
  SHARE_TOKEN_TYPE,
} from '@/lib/constants';
import { hash, secret } from '@/lib/crypto';
import { parseSecureToken, parseToken } from '@/lib/jwt';
import { ensureArray } from '@/lib/utils';
import { getUser } from '@/queries/drizzle/user';

const log = debug('umami:auth');

export function getBearerToken(request: Request) {
  const auth = request.headers.get('authorization');

  return auth?.split(' ')[1];
}

export async function checkAuth(request: Request) {
  const token = getBearerToken(request);
  const payload = parseSecureToken(token, secret());
  const shareToken = await parseShareToken(request);

  let user = null;
  const { userId } = payload || {};

  if (userId && !payload.type) {
    user = await getUser(userId, { includePassword: true });

    // Reject tokens issued before the current password.
    // Allow legacy stateless tokens that were minted without a password fingerprint.
    if (user && payload.pwd && hash(user.password) !== payload.pwd) {
      user = null;
    }
  }

  log({
    hasToken: !!token,
    hasPayload: !!payload,
    hasShareToken: !!shareToken,
    userId: user?.id,
  });

  if (!user?.id && !shareToken) {
    log('User not authorized');
    return null;
  }

  if (!user?.id && shareToken) {
    const shareContext = request.headers.get(SHARE_CONTEXT_HEADER);
    if (!shareContext) {
      log('Share token used outside share context');
      return null;
    }
  }

  if (user) {
    delete user.password;
    user.isAdmin = user.role === ROLES.admin;
  }

  return {
    token,
    shareToken,
    user,
  };
}

export async function hasPermission(role: string, permission: string | string[]) {
  return ensureArray(permission).some(e => ROLE_PERMISSIONS[role]?.includes(e));
}

export function parseShareToken(request: Request) {
  try {
    const token: any = parseToken(request.headers.get(SHARE_TOKEN_HEADER), secret());

    // Only accept tokens explicitly minted as share tokens. This prevents other
    // tokens signed with the same secret (e.g. the cache token from /api/send)
    // from being replayed as share tokens to gain analytics access.
    if (token?.type !== SHARE_TOKEN_TYPE) {
      return null;
    }

    return token;
  } catch (e) {
    log(e);
    return null;
  }
}
