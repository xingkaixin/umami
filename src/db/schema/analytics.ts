import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';
import { bytes, dateTime, decimal } from '../columns';

const now = sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`;

export const session = sqliteTable(
  'session',
  {
    id: text('session_id').notNull().primaryKey(),
    websiteId: text('website_id').notNull(),
    browser: text('browser'),
    os: text('os'),
    device: text('device'),
    screen: text('screen'),
    language: text('language'),
    country: text('country'),
    region: text('region'),
    city: text('city'),
    distinctId: text('distinct_id'),
    createdAt: dateTime('created_at').default(now),
  },
  table => [
    index('session_created_at_idx').on(table.createdAt),
    index('session_website_id_idx').on(table.websiteId),
    index('session_website_id_created_at_idx').on(table.websiteId, table.createdAt),
    index('session_website_id_created_at_browser_idx').on(
      table.websiteId,
      table.createdAt,
      table.browser,
    ),
    index('session_website_id_created_at_os_idx').on(table.websiteId, table.createdAt, table.os),
    index('session_website_id_created_at_device_idx').on(
      table.websiteId,
      table.createdAt,
      table.device,
    ),
    index('session_website_id_created_at_screen_idx').on(
      table.websiteId,
      table.createdAt,
      table.screen,
    ),
    index('session_website_id_created_at_language_idx').on(
      table.websiteId,
      table.createdAt,
      table.language,
    ),
    index('session_website_id_created_at_country_idx').on(
      table.websiteId,
      table.createdAt,
      table.country,
    ),
    index('session_website_id_created_at_region_idx').on(
      table.websiteId,
      table.createdAt,
      table.region,
    ),
    index('session_website_id_created_at_city_idx').on(
      table.websiteId,
      table.createdAt,
      table.city,
    ),
    check('session_browser_length', sql`length(${table.browser}) <= 20`),
    check('session_os_length', sql`length(${table.os}) <= 20`),
    check('session_device_length', sql`length(${table.device}) <= 20`),
    check('session_screen_length', sql`length(${table.screen}) <= 11`),
    check('session_language_length', sql`length(${table.language}) <= 35`),
    check('session_country_length', sql`length(${table.country}) <= 2`),
    check('session_region_length', sql`length(${table.region}) <= 20`),
    check('session_city_length', sql`length(${table.city}) <= 50`),
    check('session_distinct_id_length', sql`length(${table.distinctId}) <= 50`),
  ],
);

export type Session = typeof session.$inferSelect;
export type NewSession = typeof session.$inferInsert;

export const sessionLink = sqliteTable(
  'session_link',
  {
    websiteId: text('website_id').notNull(),
    sessionId: text('session_id').notNull(),
    distinctId: text('distinct_id').notNull(),
    createdAt: dateTime('created_at').default(now),
  },
  table => [
    primaryKey({ columns: [table.websiteId, table.distinctId, table.sessionId] }),
    index('session_link_website_id_session_id_idx').on(table.websiteId, table.sessionId),
    check('session_link_distinct_id_length', sql`length(${table.distinctId}) <= 50`),
  ],
);

export type SessionLink = typeof sessionLink.$inferSelect;
export type NewSessionLink = typeof sessionLink.$inferInsert;

export const websiteEvent = sqliteTable(
  'website_event',
  {
    id: text('event_id').notNull().primaryKey(),
    websiteId: text('website_id').notNull(),
    sessionId: text('session_id').notNull(),
    visitId: text('visit_id').notNull(),
    createdAt: dateTime('created_at').default(now),
    urlPath: text('url_path').notNull(),
    urlQuery: text('url_query'),
    utmSource: text('utm_source'),
    utmMedium: text('utm_medium'),
    utmCampaign: text('utm_campaign'),
    utmContent: text('utm_content'),
    utmTerm: text('utm_term'),
    referrerPath: text('referrer_path'),
    referrerQuery: text('referrer_query'),
    referrerDomain: text('referrer_domain'),
    pageTitle: text('page_title'),
    gclid: text('gclid'),
    fbclid: text('fbclid'),
    msclkid: text('msclkid'),
    ttclid: text('ttclid'),
    lifatid: text('li_fat_id'),
    twclid: text('twclid'),
    eventType: integer('event_type').notNull().default(1),
    eventName: text('event_name'),
    tag: text('tag'),
    hostname: text('hostname'),
    lcp: decimal('lcp', { precision: 10, scale: 1 }),
    inp: decimal('inp', { precision: 10, scale: 1 }),
    cls: decimal('cls', { precision: 10, scale: 4 }),
    fcp: decimal('fcp', { precision: 10, scale: 1 }),
    ttfb: decimal('ttfb', { precision: 10, scale: 1 }),
  },
  table => [
    index('website_event_created_at_idx').on(table.createdAt),
    index('website_event_session_id_idx').on(table.sessionId),
    index('website_event_visit_id_idx').on(table.visitId),
    index('website_event_website_id_idx').on(table.websiteId),
    index('website_event_website_id_created_at_idx').on(table.websiteId, table.createdAt),
    index('website_event_website_id_created_at_url_path_idx').on(
      table.websiteId,
      table.createdAt,
      table.urlPath,
    ),
    index('website_event_website_id_created_at_url_query_idx').on(
      table.websiteId,
      table.createdAt,
      table.urlQuery,
    ),
    index('website_event_website_id_created_at_referrer_domain_idx').on(
      table.websiteId,
      table.createdAt,
      table.referrerDomain,
    ),
    index('website_event_website_id_created_at_page_title_idx').on(
      table.websiteId,
      table.createdAt,
      table.pageTitle,
    ),
    index('website_event_website_id_created_at_event_name_idx').on(
      table.websiteId,
      table.createdAt,
      table.eventName,
    ),
    index('website_event_website_id_created_at_tag_idx').on(
      table.websiteId,
      table.createdAt,
      table.tag,
    ),
    index('website_event_website_id_session_id_created_at_idx').on(
      table.websiteId,
      table.sessionId,
      table.createdAt,
    ),
    index('website_event_website_id_visit_id_created_at_idx').on(
      table.websiteId,
      table.visitId,
      table.createdAt,
    ),
    index('website_event_website_id_created_at_hostname_idx').on(
      table.websiteId,
      table.createdAt,
      table.hostname,
    ),
    check('website_event_url_path_length', sql`length(${table.urlPath}) <= 500`),
    check('website_event_url_query_length', sql`length(${table.urlQuery}) <= 500`),
    check('website_event_utm_source_length', sql`length(${table.utmSource}) <= 255`),
    check('website_event_utm_medium_length', sql`length(${table.utmMedium}) <= 255`),
    check('website_event_utm_campaign_length', sql`length(${table.utmCampaign}) <= 255`),
    check('website_event_utm_content_length', sql`length(${table.utmContent}) <= 255`),
    check('website_event_utm_term_length', sql`length(${table.utmTerm}) <= 255`),
    check('website_event_referrer_path_length', sql`length(${table.referrerPath}) <= 500`),
    check('website_event_referrer_query_length', sql`length(${table.referrerQuery}) <= 500`),
    check('website_event_referrer_domain_length', sql`length(${table.referrerDomain}) <= 500`),
    check('website_event_page_title_length', sql`length(${table.pageTitle}) <= 500`),
    check('website_event_gclid_length', sql`length(${table.gclid}) <= 255`),
    check('website_event_fbclid_length', sql`length(${table.fbclid}) <= 255`),
    check('website_event_msclkid_length', sql`length(${table.msclkid}) <= 255`),
    check('website_event_ttclid_length', sql`length(${table.ttclid}) <= 255`),
    check('website_event_li_fat_id_length', sql`length(${table.lifatid}) <= 255`),
    check('website_event_twclid_length', sql`length(${table.twclid}) <= 255`),
    check(
      'website_event_event_type_range',
      sql`${table.eventType} between -2147483648 and 2147483647`,
    ),
    check('website_event_event_name_length', sql`length(${table.eventName}) <= 50`),
    check('website_event_tag_length', sql`length(${table.tag}) <= 50`),
    check('website_event_hostname_length', sql`length(${table.hostname}) <= 100`),
  ],
);

export type WebsiteEvent = typeof websiteEvent.$inferSelect;
export type NewWebsiteEvent = typeof websiteEvent.$inferInsert;

export const eventData = sqliteTable(
  'event_data',
  {
    id: text('event_data_id').notNull().primaryKey(),
    websiteId: text('website_id').notNull(),
    websiteEventId: text('website_event_id').notNull(),
    dataKey: text('data_key').notNull(),
    stringValue: text('string_value'),
    numberValue: decimal('number_value', { precision: 19, scale: 4 }),
    dateValue: dateTime('date_value'),
    dataType: integer('data_type').notNull(),
    createdAt: dateTime('created_at').default(now),
  },
  table => [
    index('event_data_created_at_idx').on(table.createdAt),
    index('event_data_website_id_idx').on(table.websiteId),
    index('event_data_website_event_id_idx').on(table.websiteEventId),
    index('event_data_website_id_created_at_idx').on(table.websiteId, table.createdAt),
    index('event_data_website_id_created_at_data_key_idx').on(
      table.websiteId,
      table.createdAt,
      table.dataKey,
    ),
    check('event_data_data_key_length', sql`length(${table.dataKey}) <= 500`),
    check('event_data_string_value_length', sql`length(${table.stringValue}) <= 500`),
    check('event_data_data_type_range', sql`${table.dataType} between -2147483648 and 2147483647`),
  ],
);

export type EventData = typeof eventData.$inferSelect;
export type NewEventData = typeof eventData.$inferInsert;

export const sessionData = sqliteTable(
  'session_data',
  {
    id: text('session_data_id').notNull().primaryKey(),
    websiteId: text('website_id').notNull(),
    sessionId: text('session_id').notNull(),
    dataKey: text('data_key').notNull(),
    stringValue: text('string_value'),
    numberValue: decimal('number_value', { precision: 19, scale: 4 }),
    dateValue: dateTime('date_value'),
    dataType: integer('data_type').notNull(),
    distinctId: text('distinct_id'),
    createdAt: dateTime('created_at').default(now),
  },
  table => [
    index('session_data_created_at_idx').on(table.createdAt),
    index('session_data_website_id_idx').on(table.websiteId),
    index('session_data_session_id_idx').on(table.sessionId),
    index('session_data_session_id_created_at_idx').on(table.sessionId, table.createdAt),
    index('session_data_website_id_created_at_data_key_idx').on(
      table.websiteId,
      table.createdAt,
      table.dataKey,
    ),
    uniqueIndex('session_data_session_id_data_key_key').on(table.sessionId, table.dataKey),
    check('session_data_data_key_length', sql`length(${table.dataKey}) <= 500`),
    check('session_data_string_value_length', sql`length(${table.stringValue}) <= 500`),
    check(
      'session_data_data_type_range',
      sql`${table.dataType} between -2147483648 and 2147483647`,
    ),
    check('session_data_distinct_id_length', sql`length(${table.distinctId}) <= 50`),
  ],
);

export type SessionData = typeof sessionData.$inferSelect;
export type NewSessionData = typeof sessionData.$inferInsert;

export const revenue = sqliteTable(
  'revenue',
  {
    id: text('revenue_id').notNull().primaryKey(),
    websiteId: text('website_id').notNull(),
    sessionId: text('session_id').notNull(),
    eventId: text('event_id').notNull(),
    eventName: text('event_name').notNull(),
    currency: text('currency').notNull(),
    revenue: decimal('revenue', { precision: 19, scale: 4 }),
    createdAt: dateTime('created_at').default(now),
  },
  table => [
    index('revenue_website_id_idx').on(table.websiteId),
    index('revenue_session_id_idx').on(table.sessionId),
    index('revenue_website_id_created_at_idx').on(table.websiteId, table.createdAt),
    index('revenue_website_id_session_id_created_at_idx').on(
      table.websiteId,
      table.sessionId,
      table.createdAt,
    ),
    check('revenue_event_name_length', sql`length(${table.eventName}) <= 50`),
    check('revenue_currency_length', sql`length(${table.currency}) <= 10`),
  ],
);

export type Revenue = typeof revenue.$inferSelect;
export type NewRevenue = typeof revenue.$inferInsert;

export const sessionReplay = sqliteTable(
  'session_replay',
  {
    id: text('replay_id').notNull().primaryKey(),
    websiteId: text('website_id').notNull(),
    sessionId: text('session_id').notNull(),
    visitId: text('visit_id').notNull(),
    chunkIndex: integer('chunk_index').notNull(),
    events: bytes('events').notNull(),
    eventCount: integer('event_count').notNull(),
    startedAt: dateTime('started_at').notNull(),
    endedAt: dateTime('ended_at').notNull(),
    createdAt: dateTime('created_at').default(now),
  },
  table => [
    index('session_replay_website_id_idx').on(table.websiteId),
    index('session_replay_session_id_idx').on(table.sessionId),
    index('session_replay_visit_id_idx').on(table.visitId),
    index('session_replay_website_id_session_id_idx').on(table.websiteId, table.sessionId),
    index('session_replay_website_id_visit_id_idx').on(table.websiteId, table.visitId),
    index('session_replay_website_id_created_at_idx').on(table.websiteId, table.createdAt),
    index('session_replay_session_id_chunk_index_idx').on(table.sessionId, table.chunkIndex),
    check(
      'session_replay_chunk_index_range',
      sql`${table.chunkIndex} between -2147483648 and 2147483647`,
    ),
    check(
      'session_replay_event_count_range',
      sql`${table.eventCount} between -2147483648 and 2147483647`,
    ),
  ],
);

export type SessionReplay = typeof sessionReplay.$inferSelect;
export type NewSessionReplay = typeof sessionReplay.$inferInsert;

export const sessionReplaySaved = sqliteTable(
  'session_replay_saved',
  {
    id: text('saved_replay_id').notNull().primaryKey(),
    name: text('name').notNull(),
    websiteId: text('website_id').notNull(),
    visitId: text('visit_id').notNull(),
    createdAt: dateTime('created_at').default(now),
    updatedAt: dateTime('updated_at')
      .default(now)
      .$onUpdate(() => new Date()),
  },
  table => [
    uniqueIndex('session_replay_saved_website_id_visit_id_key').on(table.websiteId, table.visitId),
    index('session_replay_saved_website_id_idx').on(table.websiteId),
    index('session_replay_saved_visit_id_idx').on(table.visitId),
    index('session_replay_saved_website_id_created_at_idx').on(table.websiteId, table.createdAt),
    check('session_replay_saved_name_length', sql`length(${table.name}) <= 100`),
  ],
);

export type SessionReplaySaved = typeof sessionReplaySaved.$inferSelect;
export type NewSessionReplaySaved = typeof sessionReplaySaved.$inferInsert;

export const heatmapEvent = sqliteTable(
  'heatmap_event',
  {
    id: text('heatmap_event_id').notNull().primaryKey(),
    websiteId: text('website_id').notNull(),
    sessionId: text('session_id').notNull(),
    visitId: text('visit_id').notNull(),
    urlPath: text('url_path').notNull(),
    eventType: integer('event_type').notNull(),
    x: integer('x'),
    y: integer('y'),
    pageX: integer('page_x'),
    pageY: integer('page_y'),
    pageW: integer('page_w'),
    viewportW: integer('viewport_w'),
    viewportH: integer('viewport_h'),
    pageH: integer('page_h'),
    scrollPct: integer('scroll_pct'),
    createdAt: dateTime('created_at').notNull().default(now),
  },
  table => [
    index('heatmap_event_website_id_idx').on(table.websiteId),
    index('heatmap_event_visit_id_idx').on(table.visitId),
    index('heatmap_event_website_id_created_at_idx').on(table.websiteId, table.createdAt),
    index('heatmap_event_website_id_url_path_event_type_created_at_idx').on(
      table.websiteId,
      table.urlPath,
      table.eventType,
      table.createdAt,
    ),
    check('heatmap_event_url_path_length', sql`length(${table.urlPath}) <= 500`),
    check(
      'heatmap_event_event_type_range',
      sql`${table.eventType} between -2147483648 and 2147483647`,
    ),
    check('heatmap_event_x_range', sql`${table.x} between -2147483648 and 2147483647`),
    check('heatmap_event_y_range', sql`${table.y} between -2147483648 and 2147483647`),
    check('heatmap_event_page_x_range', sql`${table.pageX} between -2147483648 and 2147483647`),
    check('heatmap_event_page_y_range', sql`${table.pageY} between -2147483648 and 2147483647`),
    check('heatmap_event_page_w_range', sql`${table.pageW} between -2147483648 and 2147483647`),
    check(
      'heatmap_event_viewport_w_range',
      sql`${table.viewportW} between -2147483648 and 2147483647`,
    ),
    check(
      'heatmap_event_viewport_h_range',
      sql`${table.viewportH} between -2147483648 and 2147483647`,
    ),
    check('heatmap_event_page_h_range', sql`${table.pageH} between -2147483648 and 2147483647`),
    check(
      'heatmap_event_scroll_pct_range',
      sql`${table.scrollPct} between -2147483648 and 2147483647`,
    ),
  ],
);

export type HeatmapEvent = typeof heatmapEvent.$inferSelect;
export type NewHeatmapEvent = typeof heatmapEvent.$inferInsert;
