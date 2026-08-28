import { z } from 'zod';
import { setTeamTwoFactorRequired } from '@/queries/drizzle/twoFactor';
import { parseRequest } from '@/lib/request';
import { json, notFound, serviceUnavailable, unauthorized } from '@/lib/response';
import { getTwoFactorConfigurationError, isTwoFactorConfigured } from '@/lib/two-factor/crypto';
import { canEnforceTwoFactorAuthForTeam } from '@/permissions';

export async function POST(request: Request, { params }: { params: Promise<{ teamId: string }> }) {
  if (process.env.CLOUD_MODE) {
    return notFound();
  }

  const schema = z.object({ required: z.boolean() });

  const { auth, body, error } = await parseRequest(request, schema);

  if (error) {
    return error();
  }

  const { teamId } = await params;

  if (!(await canEnforceTwoFactorAuthForTeam(auth, teamId))) {
    return unauthorized();
  }
  const { required } = body;

  if (required && !isTwoFactorConfigured()) {
    return serviceUnavailable(getTwoFactorConfigurationError());
  }

  await setTeamTwoFactorRequired(teamId, required);

  return json({ ok: true, teamId, twoFactorRequired: required });
}
