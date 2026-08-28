import { gunzipSync } from 'node:zlib';
import { rawQuery } from '@/db/query';

export interface ReplayChunk {
  sessionId: string;
  visitId: string;
  events: any[];
  chunkIndex: number;
  eventCount: number;
  startedAt: Date;
  endedAt: Date;
}

interface GetReplayChunksOptions {
  endAt?: Date;
  endChunkIndex?: number;
}

export async function getReplayChunks(
  websiteId: string,
  visitId: string,
  { endAt, endChunkIndex }: GetReplayChunksOptions = {},
): Promise<ReplayChunk[]> {
  const endAtFilter = endAt
    ? `
      and started_at <= {{endAt}}
    `
    : '';
  const endChunkFilter =
    endChunkIndex !== undefined
      ? `
      and chunk_index <= {{endChunkIndex}}
    `
      : '';

  const chunks: {
    sessionId: string;
    visitId: string;
    events: Buffer;
    chunkIndex: number;
    eventCount: number;
    startedAt: Date;
    endedAt: Date;
  }[] = await rawQuery(
    `
    select
      session_id as "sessionId",
      visit_id as "visitId",
      events,
      chunk_index as "chunkIndex",
      event_count as "eventCount",
      started_at as "startedAt",
      ended_at as "endedAt"
    from session_replay
    where website_id = {{websiteId}}
      and visit_id = {{visitId}}
      ${endAtFilter}
      ${endChunkFilter}
    order by chunk_index asc
    `,
    { websiteId, visitId, endAt, endChunkIndex },
  );

  return chunks.map(chunk => ({
    ...chunk,
    events: JSON.parse(gunzipSync(Buffer.from(chunk.events)).toString('utf-8')),
  }));
}
