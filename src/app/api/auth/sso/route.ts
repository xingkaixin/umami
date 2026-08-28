import { hash, secret } from '@/lib/crypto';
import { createSecureToken } from '@/lib/jwt';
import { parseRequest } from '@/lib/request';
import { json } from '@/lib/response';
import { getUser } from '@/queries/drizzle';

export async function POST(request: Request) {
  const { auth, error } = await parseRequest(request);

  if (error) {
    return error();
  }

  const user = await getUser(auth.user.id, { includePassword: true });
  const token = await createSecureToken(
    { userId: auth.user.id, pwd: hash(user.password) },
    secret(),
    { expiresIn: '1d' },
  );

  return json({ user: auth.user, token });
}
