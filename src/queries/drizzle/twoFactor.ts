import { and, eq, lt, sql } from 'drizzle-orm';
import { getDatabase } from '@/db/client';
import {
  appSetting,
  team,
  teamUser,
  twoFactorAuth,
  twoFactorBackupCode,
  twoFactorOtpUsed,
  twoFactorRateLimit,
  user,
} from '@/db/schema';

export async function getTwoFactorAuth(userId: string) {
  return (
    (await getDatabase()
      .select()
      .from(twoFactorAuth)
      .where(eq(twoFactorAuth.userId, userId))
      .get()) ?? null
  );
}

export async function getTwoFactorRequirements(userId: string) {
  const db = getDatabase();
  const [global, account, teamRequirement] = await db.batch([
    db.select().from(appSetting).where(eq(appSetting.key, 'twoFactorRequiredGlobal')),
    db.select({ required: user.twoFactorRequired }).from(user).where(eq(user.id, userId)),
    db
      .select({ id: team.id })
      .from(team)
      .innerJoin(teamUser, eq(teamUser.teamId, team.id))
      .where(and(eq(teamUser.userId, userId), eq(team.twoFactorRequired, true)))
      .limit(1),
  ]);
  return {
    global: global[0]?.value === 'true',
    user: account[0]?.required ?? false,
    team: teamRequirement.length > 0,
  };
}

export function setGlobalTwoFactorRequired(required: boolean) {
  return getDatabase()
    .insert(appSetting)
    .values({ key: 'twoFactorRequiredGlobal', value: String(required) })
    .onConflictDoUpdate({ target: appSetting.key, set: { value: String(required) } });
}

export function setTeamTwoFactorRequired(teamId: string, required: boolean) {
  return getDatabase().update(team).set({ twoFactorRequired: required }).where(eq(team.id, teamId));
}

export async function savePendingTwoFactor(userId: string, secret: string) {
  const result = await getDatabase()
    .insert(twoFactorAuth)
    .values({ userId, secret, isEnabled: false })
    .onConflictDoUpdate({
      target: twoFactorAuth.userId,
      set: { secret },
      setWhere: eq(twoFactorAuth.isEnabled, false),
    })
    .returning({ id: twoFactorAuth.id });
  return result.length > 0;
}

export function cancelPendingTwoFactor(userId: string) {
  return getDatabase()
    .delete(twoFactorAuth)
    .where(and(eq(twoFactorAuth.userId, userId), eq(twoFactorAuth.isEnabled, false)));
}

function consumeOtpQuery(
  userId: string,
  otp: string,
  id = crypto.randomUUID(),
  condition = sql`1`,
) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 90_000);
  return getDatabase()
    .insert(twoFactorOtpUsed)
    .select(sql`select ${id}, ${userId}, ${otp}, ${expiresAt.toISOString()} where ${condition}`)
    .onConflictDoUpdate({
      target: [twoFactorOtpUsed.userId, twoFactorOtpUsed.otp],
      set: { id, expiresAt },
      setWhere: lt(twoFactorOtpUsed.expiresAt, now),
    })
    .returning({ id: twoFactorOtpUsed.id });
}

function currentSecret(userId: string, secret: string, enabled: boolean) {
  return sql`exists (select 1 from two_factor_auth
    where user_id = ${userId} and secret = ${secret} and is_enabled = ${Number(enabled)})`;
}

export async function consumeOtp(userId: string, otp: string, secret: string) {
  return (
    (await consumeOtpQuery(userId, otp, crypto.randomUUID(), currentSecret(userId, secret, true)))
      .length > 0
  );
}

export async function isOtpReplayed(userId: string, otp: string) {
  return !!(await getDatabase()
    .select({ id: twoFactorOtpUsed.id })
    .from(twoFactorOtpUsed)
    .where(
      and(
        eq(twoFactorOtpUsed.userId, userId),
        eq(twoFactorOtpUsed.otp, otp),
        sql`${twoFactorOtpUsed.expiresAt} >= ${new Date().toISOString()}`,
      ),
    )
    .get());
}

export async function confirmTwoFactorSetup(
  userId: string,
  otp: string,
  codeHashes: string[],
  secret: string,
) {
  const db = getDatabase();
  const operationId = crypto.randomUUID();
  const consumed = sql`exists (select 1 from two_factor_otp_used where id = ${operationId})`;
  const codes = codeHashes.map(codeHash => ({ id: crypto.randomUUID(), codeHash }));
  const [result] = await db.batch([
    consumeOtpQuery(userId, otp, operationId, currentSecret(userId, secret, false)),
    db
      .update(twoFactorAuth)
      .set({ isEnabled: true })
      .where(and(eq(twoFactorAuth.userId, userId), consumed)),
    db.delete(twoFactorBackupCode).where(and(eq(twoFactorBackupCode.userId, userId), consumed)),
    db.insert(twoFactorBackupCode).select(sql`
      select json_extract(value, '$.id'), ${userId}, json_extract(value, '$.codeHash'),
        0, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      from json_each(${JSON.stringify(codes)}) where ${consumed}
    `),
    db.delete(twoFactorRateLimit).where(and(eq(twoFactorRateLimit.userId, userId), consumed)),
  ]);
  return result.length > 0;
}

export async function disableTwoFactorAuth(userId: string, otp: string, secret: string) {
  const db = getDatabase();
  const operationId = crypto.randomUUID();
  const consumed = sql`exists (select 1 from two_factor_otp_used where id = ${operationId})`;
  const [result] = await db.batch([
    consumeOtpQuery(userId, otp, operationId, currentSecret(userId, secret, true)),
    db.delete(twoFactorAuth).where(and(eq(twoFactorAuth.userId, userId), consumed)),
    db.delete(twoFactorBackupCode).where(and(eq(twoFactorBackupCode.userId, userId), consumed)),
    db.delete(twoFactorRateLimit).where(and(eq(twoFactorRateLimit.userId, userId), consumed)),
  ]);
  return result.length > 0;
}

export function getUnusedBackupCodes(userId: string) {
  return getDatabase()
    .select()
    .from(twoFactorBackupCode)
    .where(and(eq(twoFactorBackupCode.userId, userId), eq(twoFactorBackupCode.used, false)));
}

export async function consumeBackupCode(id: string) {
  const result = await getDatabase()
    .update(twoFactorBackupCode)
    .set({ used: true })
    .where(and(eq(twoFactorBackupCode.id, id), eq(twoFactorBackupCode.used, false)))
    .returning({ id: twoFactorBackupCode.id });
  return result.length > 0;
}

export async function resetTwoFactorAuth(userId: string) {
  const db = getDatabase();
  const [auth, backupCodes, otpUsed, rateLimit] = await db.batch([
    db.delete(twoFactorAuth).where(eq(twoFactorAuth.userId, userId)),
    db.delete(twoFactorBackupCode).where(eq(twoFactorBackupCode.userId, userId)),
    db.delete(twoFactorOtpUsed).where(eq(twoFactorOtpUsed.userId, userId)),
    db.delete(twoFactorRateLimit).where(eq(twoFactorRateLimit.userId, userId)),
  ]);
  return {
    twoFactorAuth: auth.meta.changes,
    backupCodes: backupCodes.meta.changes,
    otpUsed: otpUsed.meta.changes,
    rateLimit: rateLimit.meta.changes,
  };
}
