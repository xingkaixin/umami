import { sql } from 'drizzle-orm';
import { getDatabase } from '@/db/client';
import { getPropertyValues } from '@/db/properties';
import { sessionData as sessionDataTable } from '@/db/schema';
import { FIELD_LENGTH } from '@/lib/constants';
import { uuid } from '@/lib/crypto';
import { truncateString } from '@/lib/format';
import type { DynamicData } from '@/lib/types';

export interface SaveSessionDataArgs {
  websiteId: string;
  sessionId: string;
  sessionData: DynamicData;
  distinctId?: string;
  createdAt?: Date;
}

export async function saveSessionData({
  websiteId,
  sessionId,
  sessionData,
  distinctId,
  createdAt,
}: SaveSessionDataArgs) {
  const db = getDatabase();
  const statements = getPropertyValues(sessionData).map(data =>
    db
      .insert(sessionDataTable)
      .values({
        ...data,
        id: uuid(),
        websiteId,
        sessionId,
        distinctId: truncateString(distinctId, FIELD_LENGTH.distinctId),
        createdAt,
      })
      .onConflictDoUpdate({
        target: [sessionDataTable.sessionId, sessionDataTable.dataKey],
        set: {
          websiteId,
          stringValue: sql`excluded.string_value`,
          numberValue: sql`excluded.number_value`,
          dateValue: sql`excluded.date_value`,
          dataType: sql`excluded.data_type`,
          distinctId: sql`excluded.distinct_id`,
          ...(createdAt ? { createdAt } : {}),
        },
      }),
  );
  const [first, ...rest] = statements;
  if (first) await db.batch([first, ...rest]);
}
