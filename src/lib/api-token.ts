import crypto from 'node:crypto';

export const API_TOKEN_PREFIX = 'umk_';

const API_TOKEN_PREFIX_DISPLAY_LENGTH = 12;

const READ_ONLY_POST_PATHS = new Set([
  '/api/auth/verify',
  '/api/reports/attribution',
  '/api/reports/breakdown',
  '/api/reports/funnel',
  '/api/reports/goal',
  '/api/reports/heatmap',
  '/api/reports/journey',
  '/api/reports/performance',
  '/api/reports/retention',
  '/api/reports/revenue',
  '/api/reports/utm',
]);

export function isApiToken(token?: string | null): token is string {
  return typeof token === 'string' && token.startsWith(API_TOKEN_PREFIX);
}

export function hashApiToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function generateApiToken() {
  const token = `${API_TOKEN_PREFIX}${crypto.randomBytes(32).toString('hex')}`;
  return {
    token,
    tokenPrefix: token.slice(0, API_TOKEN_PREFIX_DISPLAY_LENGTH),
    tokenHash: hashApiToken(token),
  };
}

function normalizeApiPathname(url: string): string {
  const rawPathname = new URL(url).pathname.replace(/\/+$/, '');
  const basePath = process.env.basePath?.replace(/^\/+|\/+$/g, '');
  if (basePath && rawPathname.startsWith(`/${basePath}/`)) {
    return rawPathname.slice(basePath.length + 1);
  }
  return rawPathname;
}

export function isReadOnlyApiRequest(request: Request): boolean {
  const method = request.method.toUpperCase();
  const pathname = normalizeApiPathname(request.url);

  // Token management routes require an interactive login session.
  if (pathname === '/api/me/tokens' || pathname.startsWith('/api/me/tokens/')) {
    return false;
  }

  if (method === 'GET' || method === 'HEAD') {
    return true;
  }

  return method === 'POST' && READ_ONLY_POST_PATHS.has(pathname);
}
