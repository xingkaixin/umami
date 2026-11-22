import { and, desc, eq } from 'drizzle-orm';
import { getDatabase } from '@/db/client';
import { apiToken, type NewApiToken } from '@/db/schema';

export function getUserApiTokens(userId: string) {
  return getDatabase()
    .select({
      id: apiToken.id,
      name: apiToken.name,
      tokenPrefix: apiToken.tokenPrefix,
      expiresAt: apiToken.expiresAt,
      lastUsedAt: apiToken.lastUsedAt,
      createdAt: apiToken.createdAt,
    })
    .from(apiToken)
    .where(eq(apiToken.userId, userId))
    .orderBy(desc(apiToken.createdAt));
}

export async function getApiTokenByHash(tokenHash: string) {
  return (
    (await getDatabase().select().from(apiToken).where(eq(apiToken.tokenHash, tokenHash)).get()) ??
    null
  );
}

export function createApiToken(data: NewApiToken) {
  return getDatabase()
    .insert(apiToken)
    .values(data)
    .returning({
      id: apiToken.id,
      name: apiToken.name,
      tokenPrefix: apiToken.tokenPrefix,
      expiresAt: apiToken.expiresAt,
      lastUsedAt: apiToken.lastUsedAt,
      createdAt: apiToken.createdAt,
    })
    .get();
}

export async function deleteApiToken(id: string, userId: string) {
  const result = await getDatabase()
    .delete(apiToken)
    .where(and(eq(apiToken.id, id), eq(apiToken.userId, userId)))
    .returning({ id: apiToken.id });
  return result.length > 0;
}

export function touchApiTokenLastUsed(id: string, now = new Date()) {
  return getDatabase().update(apiToken).set({ lastUsedAt: now }).where(eq(apiToken.id, id));
}
