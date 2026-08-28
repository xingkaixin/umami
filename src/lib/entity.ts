import type { Board, Link, Pixel, Website } from '@/db/schema';
import { getBoard, getLink, getPixel, getWebsite } from '@/queries/drizzle';

export async function getEntity(entityId: string): Promise<Website | Link | Pixel | Board | null> {
  const [website, link, pixel, board] = await Promise.all([
    getWebsite(entityId),
    getLink(entityId),
    getPixel(entityId),
    getBoard(entityId),
  ]);

  const entity = website || link || pixel || board;

  return entity;
}
