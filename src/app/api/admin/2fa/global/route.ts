import { z } from 'zod';
import { setGlobalTwoFactorRequired } from '@/queries/drizzle/twoFactor';
import { parseRequest } from '@/lib/request';
import { json, notFound, serviceUnavailable, unauthorized } from '@/lib/response';
import { getTwoFactorConfigurationError, isTwoFactorConfigured } from '@/lib/two-factor/crypto';
import { canEnforceTwoFactorAuthForEveryone } from '@/permissions';

export async function POST(request: Request) {
  if (process.env.CLOUD_MODE) {
    return notFound();
  }

  const schema = z.object({ required: z.boolean() });

  const { auth, body, error } = await parseRequest(request, schema);

  if (error) {
    return error();
  }

  if (!(await canEnforceTwoFactorAuthForEveryone(auth))) {
    return unauthorized();
  }

  const { required } = body;

  if (required && !isTwoFactorConfigured()) {
    return serviceUnavailable(getTwoFactorConfigurationError());
  }

  await setGlobalTwoFactorRequired(required);

  return json({ ok: true, required });
}
