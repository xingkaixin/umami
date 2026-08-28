import { z } from 'zod';
import { parseRequest } from '@/lib/request';
import { json, notFound, serviceUnavailable, unauthorized } from '@/lib/response';
import { getTwoFactorConfigurationError, isTwoFactorConfigured } from '@/lib/two-factor/crypto';
import { canEnforceTwoFactorAuthForUser } from '@/permissions';
import { getTwoFactorAuth, resetTwoFactorAuth } from '@/queries/drizzle/twoFactor';
import { updateUser } from '@/queries/drizzle/user';

export async function GET(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  if (process.env.CLOUD_MODE) {
    return notFound();
  }

  const { auth, error } = await parseRequest(request);

  if (error) {
    return error();
  }

  if (!(await canEnforceTwoFactorAuthForUser(auth))) {
    return unauthorized();
  }

  const { userId } = await params;

  const twoFactor = await getTwoFactorAuth(userId);

  return json({ isEnabled: twoFactor?.isEnabled ?? false });
}

export async function POST(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  if (process.env.CLOUD_MODE) {
    return notFound();
  }

  const schema = z.object({ required: z.boolean() });

  const { auth, body, error } = await parseRequest(request, schema);

  if (error) {
    return error();
  }

  if (!(await canEnforceTwoFactorAuthForUser(auth))) {
    return unauthorized();
  }

  const { userId } = await params;
  const { required } = body;

  if (required && !isTwoFactorConfigured()) {
    return serviceUnavailable(getTwoFactorConfigurationError());
  }

  const user = await updateUser(userId, { twoFactorRequired: required });

  return json({ ok: true, userId: user.id, twoFactorRequired: required });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  if (process.env.CLOUD_MODE) {
    return notFound();
  }

  const { auth, error } = await parseRequest(request);

  if (error) {
    return error();
  }

  if (!(await canEnforceTwoFactorAuthForUser(auth))) {
    return unauthorized();
  }

  const { userId } = await params;

  const reset = await resetTwoFactorAuth(userId);
  return json({ ok: true, userId, reset });
}
