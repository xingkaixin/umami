import { eq, sql } from 'drizzle-orm';
import { getDatabase } from '@/db/client';
import { twoFactorRateLimit } from '@/db/schema';

const MAX_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

export async function checkRateLimit(
  userId: string,
): Promise<{ allowed: boolean; lockedUntil?: Date }> {
  const record = await getDatabase()
    .select()
    .from(twoFactorRateLimit)
    .where(eq(twoFactorRateLimit.userId, userId))
    .get();
  if (record?.lockedUntil && record.lockedUntil > new Date()) {
    return { allowed: false, lockedUntil: record.lockedUntil };
  }
  return { allowed: true };
}

export async function recordFailedAttempt(userId: string): Promise<{ lockedUntil?: Date }> {
  const lockedUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60_000);
  const record = await getDatabase()
    .insert(twoFactorRateLimit)
    .values({ userId, attempts: 1 })
    .onConflictDoUpdate({
      target: twoFactorRateLimit.userId,
      set: {
        attempts: sql`min(${twoFactorRateLimit.attempts} + 1, ${MAX_ATTEMPTS})`,
        lockedUntil: sql`case when ${twoFactorRateLimit.attempts} + 1 >= ${MAX_ATTEMPTS}
          then ${lockedUntil.toISOString()} else ${twoFactorRateLimit.lockedUntil} end`,
      },
    })
    .returning({ lockedUntil: twoFactorRateLimit.lockedUntil })
    .get();
  return record.lockedUntil ? { lockedUntil: record.lockedUntil } : {};
}

export async function resetRateLimit(userId: string): Promise<void> {
  await getDatabase().delete(twoFactorRateLimit).where(eq(twoFactorRateLimit.userId, userId));
}
