import { type SQL, sql } from 'drizzle-orm';
import type { Database } from './client';
import * as tables from './schema';

export function deleteWebsiteData(db: Database, websiteIds: SQL) {
  return [
    db
      .delete(tables.sessionReplaySaved)
      .where(sql`${tables.sessionReplaySaved.websiteId} in (${websiteIds})`),
    db
      .delete(tables.sessionReplay)
      .where(sql`${tables.sessionReplay.websiteId} in (${websiteIds})`),
    db.delete(tables.heatmapEvent).where(sql`${tables.heatmapEvent.websiteId} in (${websiteIds})`),
    db.delete(tables.revenue).where(sql`${tables.revenue.websiteId} in (${websiteIds})`),
    db
      .delete(tables.eventData)
      .where(sql`${tables.eventData.websiteId} in (${websiteIds}) or ${tables.eventData.websiteEventId} in (
      select ${tables.websiteEvent.id} from ${tables.websiteEvent} where ${tables.websiteEvent.websiteId} in (${websiteIds})
    )`),
    db.delete(tables.sessionData).where(sql`${tables.sessionData.websiteId} in (${websiteIds})`),
    db.delete(tables.sessionLink).where(sql`${tables.sessionLink.websiteId} in (${websiteIds})`),
    db.delete(tables.websiteEvent).where(sql`${tables.websiteEvent.websiteId} in (${websiteIds})`),
    db.delete(tables.session).where(sql`${tables.session.websiteId} in (${websiteIds})`),
  ] as const;
}

export function deleteOwnedEntities(db: Database, owner: SQL) {
  const entityIds = sql`select link_id as id from link where ${owner}
    union all select pixel_id from pixel where ${owner}
    union all select board_id from board where ${owner}`;
  return [
    db.delete(tables.share).where(sql`${tables.share.entityId} in (${entityIds})`),
    db.delete(tables.link).where(owner),
    db.delete(tables.pixel).where(owner),
    db.delete(tables.board).where(owner),
  ] as const;
}
