import { beforeEach, describe, expect, test, vi } from 'vitest';
import { hashApiToken, isReadOnlyApiRequest } from '@/lib/api-token';
import { SHARE_TOKEN_HEADER, SHARE_TOKEN_TYPE } from '@/lib/constants';
import { hash } from '@/lib/crypto';
import { parseSecureToken, parseToken } from '@/lib/jwt';
import { getApiTokenByHash, touchApiTokenLastUsed } from '@/queries/drizzle/apiToken';
import { getShare } from '@/queries/drizzle/share';
import { getUser } from '@/queries/drizzle/user';
import { checkAuth, parseShareToken } from './auth';

vi.mock('@/lib/jwt', () => ({
  parseSecureToken: vi.fn(),
  parseToken: vi.fn(() => null),
}));

vi.mock('@/queries/drizzle/apiToken', () => ({
  getApiTokenByHash: vi.fn(),
  touchApiTokenLastUsed: vi.fn(),
}));

vi.mock('@/queries/drizzle/share', () => ({
  getShare: vi.fn(),
}));

vi.mock('@/queries/drizzle/user', () => ({
  getUser: vi.fn(),
}));

vi.mock('@/lib/redis', () => ({
  default: {
    enabled: false,
    client: {
      get: vi.fn(),
    },
  },
}));

const parseSecureTokenMock = vi.mocked(parseSecureToken);
const getUserMock = vi.mocked(getUser);

const PASSWORD_HASH = '$2b$10$currentpasswordhashvalue';

function authedRequest() {
  return new Request('http://localhost/api/test', {
    headers: { authorization: 'Bearer secure-token' },
  });
}

function mockUser() {
  getUserMock.mockResolvedValue({
    id: 'user-1',
    username: 'bob',
    role: 'user',
    password: PASSWORD_HASH,
  } as any);
}

beforeEach(() => {
  parseSecureTokenMock.mockReset();
  getUserMock.mockReset();
});

describe('checkAuth password fingerprint', () => {
  test('authorizes a stateless token whose fingerprint matches the current password', async () => {
    parseSecureTokenMock.mockReturnValue({ userId: 'user-1', pwd: hash(PASSWORD_HASH) } as any);
    mockUser();

    const result = await checkAuth(authedRequest());

    expect(result?.user?.id).toBe('user-1');
  });

  test('authorizes a legacy stateless token that does not include a password fingerprint', async () => {
    parseSecureTokenMock.mockReturnValue({ userId: 'user-1' } as any);
    mockUser();

    const result = await checkAuth(authedRequest());

    expect(result?.user?.id).toBe('user-1');
  });

  test('rejects a stateless token whose fingerprint predates a password change', async () => {
    // Token minted against the old password must stop working once the password changes.
    parseSecureTokenMock.mockReturnValue({
      userId: 'user-1',
      pwd: hash('old-password-hash'),
    } as any);
    mockUser();

    const result = await checkAuth(authedRequest());

    expect(result).toBeNull();
  });

  test('does not expose the password hash on the returned user', async () => {
    parseSecureTokenMock.mockReturnValue({ userId: 'user-1', pwd: hash(PASSWORD_HASH) } as any);
    mockUser();

    const result = await checkAuth(authedRequest());

    expect(result?.user).not.toHaveProperty('password');
  });

  test('rejects a Redis session whose fingerprint predates a password change', async () => {
    parseSecureTokenMock.mockReturnValue({ authKey: 'auth:session-key' } as any);
    mockUser();

    const result = await checkAuth(authedRequest());

    expect(result).toBeNull();
  });
});

test('does not authorize a partial 2FA token as a completed login', async () => {
  parseSecureTokenMock.mockReturnValue({ userId: 'user-1', type: 'partial-auth' } as any);
  mockUser();
  const result = await checkAuth(authedRequest());
  console.info('Partial authentication accepted:', Boolean(result?.user));
  expect(result).toBeNull();
});

describe('parseShareToken', () => {
  const token = {
    type: SHARE_TOKEN_TYPE,
    shareId: 'share-1',
    shareType: 1,
    websiteId: 'website-1',
    parameters: { overview: true, events: true },
  };

  function shareRequest() {
    return new Request('http://localhost/api/test', {
      headers: { [SHARE_TOKEN_HEADER]: 'share-token' },
    });
  }

  beforeEach(() => {
    vi.mocked(parseToken).mockReturnValue(token as any);
  });

  test('rejects a token whose share was deleted', async () => {
    vi.mocked(getShare).mockResolvedValue(null);

    expect(await parseShareToken(shareRequest())).toBeNull();
  });

  test('rejects a token whose share now points to another entity', async () => {
    vi.mocked(getShare).mockResolvedValue({
      id: 'share-1',
      shareType: 1,
      entityId: 'website-2',
      parameters: {},
    } as any);

    expect(await parseShareToken(shareRequest())).toBeNull();
  });

  test('uses the current share parameters', async () => {
    vi.mocked(getShare).mockResolvedValue({
      id: 'share-1',
      shareType: 1,
      entityId: 'website-1',
      parameters: { overview: true },
    } as any);

    expect(await parseShareToken(shareRequest())).toMatchObject({
      websiteId: 'website-1',
      parameters: { overview: true },
    });
  });
});

describe('API token auth and read-only policy', () => {
  const rawApiToken = `umk_${'a'.repeat(64)}`;

  beforeEach(() => {
    vi.mocked(getApiTokenByHash).mockReset();
    vi.mocked(touchApiTokenLastUsed).mockReset();
  });

  test('authorizes a valid API token and updates lastUsedAt', async () => {
    vi.mocked(getApiTokenByHash).mockResolvedValue({
      id: 'tok-1',
      userId: 'user-1',
      name: 'agent-cli',
      tokenPrefix: rawApiToken.slice(0, 12),
      tokenHash: hashApiToken(rawApiToken),
      expiresAt: null,
      lastUsedAt: null,
      createdAt: new Date(),
    });
    mockUser();

    const result = await checkAuth(
      new Request('http://localhost/api/websites', {
        headers: { authorization: `Bearer ${rawApiToken}` },
      }),
    );

    expect(result).toMatchObject({
      user: { id: 'user-1' },
      apiToken: { id: 'tok-1', name: 'agent-cli' },
      twoFactorSetupPending: false,
    });
    expect(touchApiTokenLastUsed).toHaveBeenCalledWith('tok-1', expect.any(Date));
  });

  test('rejects an expired API token', async () => {
    vi.mocked(getApiTokenByHash).mockResolvedValue({
      id: 'tok-1',
      userId: 'user-1',
      name: 'expired',
      tokenPrefix: rawApiToken.slice(0, 12),
      tokenHash: hashApiToken(rawApiToken),
      expiresAt: new Date(Date.now() - 60_000),
      lastUsedAt: null,
      createdAt: new Date(),
    });

    const result = await checkAuth(
      new Request('http://localhost/api/websites', {
        headers: { authorization: `Bearer ${rawApiToken}` },
      }),
    );

    expect(result).toBeNull();
  });

  test('enforces read-only request boundaries for API tokens', () => {
    expect(isReadOnlyApiRequest(new Request('http://localhost/api/websites'))).toBe(true);
    expect(
      isReadOnlyApiRequest(new Request('http://localhost/api/reports/funnel', { method: 'POST' })),
    ).toBe(true);
    expect(
      isReadOnlyApiRequest(new Request('http://localhost/api/auth/verify', { method: 'POST' })),
    ).toBe(true);
    expect(
      isReadOnlyApiRequest(new Request('http://localhost/api/websites', { method: 'POST' })),
    ).toBe(false);
    expect(
      isReadOnlyApiRequest(new Request('http://localhost/api/websites/1', { method: 'DELETE' })),
    ).toBe(false);
    expect(isReadOnlyApiRequest(new Request('http://localhost/api/me/tokens'))).toBe(false);
    expect(
      isReadOnlyApiRequest(new Request('http://localhost/api/me/tokens/1', { method: 'DELETE' })),
    ).toBe(false);
  });
});
