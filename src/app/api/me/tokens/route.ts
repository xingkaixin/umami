import { z } from 'zod';
import { generateApiToken } from '@/lib/api-token';
import { uuid } from '@/lib/crypto';
import { parseRequest } from '@/lib/request';
import { forbidden, json } from '@/lib/response';
import { createApiToken, getUserApiTokens } from '@/queries/drizzle';

const DAY_MS = 24 * 60 * 60 * 1000;

export async function GET(request: Request) {
  const { auth, error } = await parseRequest(request);

  if (error) {
    return error();
  }

  if (auth.apiToken) {
    return forbidden({ code: 'read-only-token', message: 'API tokens cannot manage API tokens' });
  }

  const data = await getUserApiTokens(auth.user.id);

  return json({ data });
}

export async function POST(request: Request) {
  const schema = z.object({
    name: z.string().trim().min(1).max(100),
    expiresInDays: z.number().int().min(1).max(3650).nullable().optional(),
  });

  const { auth, body, error } = await parseRequest(request, schema);

  if (error) {
    return error();
  }

  if (auth.apiToken) {
    return forbidden({ code: 'read-only-token', message: 'API tokens cannot manage API tokens' });
  }

  const { token, tokenPrefix, tokenHash } = generateApiToken();
  const expiresAt = body.expiresInDays ? new Date(Date.now() + body.expiresInDays * DAY_MS) : null;

  const created = await createApiToken({
    id: uuid(),
    userId: auth.user.id,
    name: body.name,
    tokenPrefix,
    tokenHash,
    expiresAt,
  });

  return json({ ...created, token });
}
