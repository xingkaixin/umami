import { eq, isNull, lte, or, sql } from 'drizzle-orm';
import { getDatabase } from '@/db/client';
import { twoFactorRateLimit } from '@/db/schema';

const MAX_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

/**
 * Counts the attempt before the code is checked, in one statement, so concurrent guesses cannot
 * all pass the lockout gate. The attempt that reaches the limit is still allowed and returns
 * `lockedUntil`; a successful verification clears the record.
 */
export async function reserveAttempt(
  userId: string,
): Promise<{ allowed: boolean; lockedUntil?: Date }> {
  const db = getDatabase();
  const now = new Date();
  const lockedUntil = new Date(now.getTime() + LOCKOUT_MINUTES * 60_000);
  const [reserved] = await db
    .insert(twoFactorRateLimit)
    .values({ userId, attempts: 1 })
    .onConflictDoUpdate({
      target: twoFactorRateLimit.userId,
      set: {
        attempts: sql`min(${twoFactorRateLimit.attempts} + 1, ${MAX_ATTEMPTS})`,
        lockedUntil: sql`case when ${twoFactorRateLimit.attempts} + 1 >= ${MAX_ATTEMPTS}
          then ${lockedUntil.toISOString()} else ${twoFactorRateLimit.lockedUntil} end`,
      },
      setWhere: or(
        isNull(twoFactorRateLimit.lockedUntil),
        lte(twoFactorRateLimit.lockedUntil, now),
      ),
    })
    .returning({ lockedUntil: twoFactorRateLimit.lockedUntil });

  if (reserved) {
    return reserved.lockedUntil > now
      ? { allowed: true, lockedUntil: reserved.lockedUntil }
      : { allowed: true };
  }

  const record = await db
    .select({ lockedUntil: twoFactorRateLimit.lockedUntil })
    .from(twoFactorRateLimit)
    .where(eq(twoFactorRateLimit.userId, userId))
    .get();
  return { allowed: false, lockedUntil: record?.lockedUntil };
}

export async function resetRateLimit(userId: string): Promise<void> {
  await getDatabase().delete(twoFactorRateLimit).where(eq(twoFactorRateLimit.userId, userId));
}
