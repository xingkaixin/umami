import { parseRequest } from '@/lib/request';
import { json, notFound } from '@/lib/response';
import { cancelPendingTwoFactor } from '@/queries/drizzle/twoFactor';

export async function POST(request: Request) {
  if (process.env.CLOUD_MODE) {
    return notFound();
  }

  const { auth, error } = await parseRequest(request);

  if (error) {
    return error();
  }

  const userId = auth.user.id;

  await cancelPendingTwoFactor(userId);

  return json({ ok: true });
}
