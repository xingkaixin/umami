import { gzipSync } from 'node:zlib';
import { getDatabase } from '@/db/client';
import { sessionReplay } from '@/db/schema';
import { uuid } from '@/lib/crypto';

export interface SaveRecordingArgs {
  websiteId: string;
  sessionId: string;
  visitId: string;
  chunkIndex: number;
  events: any[];
  eventCount: number;
  startedAt: Date;
  endedAt: Date;
}

export async function saveRecording({
  websiteId,
  sessionId,
  visitId,
  chunkIndex,
  events,
  eventCount,
  startedAt,
  endedAt,
}: SaveRecordingArgs) {
  const compressed = gzipSync(Buffer.from(JSON.stringify(events), 'utf-8'));

  if (compressed.byteLength > 1_900_000)
    throw new RangeError('Recording chunk exceeds D1’s row limit.');
  return getDatabase()
    .insert(sessionReplay)
    .values({
      id: uuid(),
      websiteId,
      sessionId,
      visitId,
      chunkIndex,
      events: compressed,
      eventCount,
      startedAt,
      endedAt,
    })
    .returning()
    .get();
}
