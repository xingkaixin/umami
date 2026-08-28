import { sql } from 'drizzle-orm';
import { check, index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { dateTime } from '../columns';

const now = sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`;

export const website = sqliteTable(
  'website',
  {
    id: text('website_id').notNull().primaryKey(),
    name: text('name').notNull(),
    domain: text('domain'),
    resetAt: dateTime('reset_at'),
    userId: text('user_id'),
    teamId: text('team_id'),
    createdBy: text('created_by'),
    createdAt: dateTime('created_at').default(now),
    updatedAt: dateTime('updated_at')
      .default(now)
      .$onUpdate(() => new Date()),
    deletedAt: dateTime('deleted_at'),
    recorderEnabled: integer('recorder_enabled', { mode: 'boolean' }).notNull().default(false),
    replayConfig: text('replay_config', { mode: 'json' }),
  },
  table => [
    index('website_user_id_idx').on(table.userId),
    index('website_team_id_idx').on(table.teamId),
    index('website_created_at_idx').on(table.createdAt),
    index('website_created_by_idx').on(table.createdBy),
    check('website_name_length', sql`length(${table.name}) <= 100`),
    check('website_domain_length', sql`length(${table.domain}) <= 500`),
  ],
);

export type Website = typeof website.$inferSelect;
export type NewWebsite = typeof website.$inferInsert;

export const report = sqliteTable(
  'report',
  {
    id: text('report_id').notNull().primaryKey(),
    userId: text('user_id').notNull(),
    websiteId: text('website_id').notNull(),
    type: text('type').notNull(),
    name: text('name').notNull(),
    description: text('description').notNull(),
    parameters: text('parameters', { mode: 'json' }).notNull(),
    createdAt: dateTime('created_at').default(now),
    updatedAt: dateTime('updated_at')
      .default(now)
      .$onUpdate(() => new Date()),
  },
  table => [
    index('report_user_id_idx').on(table.userId),
    index('report_website_id_idx').on(table.websiteId),
    index('report_type_idx').on(table.type),
    index('report_name_idx').on(table.name),
    check('report_type_length', sql`length(${table.type}) <= 50`),
    check('report_name_length', sql`length(${table.name}) <= 200`),
    check('report_description_length', sql`length(${table.description}) <= 500`),
  ],
);

export type Report = typeof report.$inferSelect;
export type NewReport = typeof report.$inferInsert;

export const segment = sqliteTable(
  'segment',
  {
    id: text('segment_id').notNull().primaryKey(),
    websiteId: text('website_id').notNull(),
    type: text('type').notNull(),
    name: text('name').notNull(),
    parameters: text('parameters', { mode: 'json' }).notNull(),
    createdAt: dateTime('created_at').default(now),
    updatedAt: dateTime('updated_at')
      .default(now)
      .$onUpdate(() => new Date()),
  },
  table => [
    index('segment_website_id_idx').on(table.websiteId),
    check('segment_type_length', sql`length(${table.type}) <= 50`),
    check('segment_name_length', sql`length(${table.name}) <= 200`),
  ],
);

export type Segment = typeof segment.$inferSelect;
export type NewSegment = typeof segment.$inferInsert;

export const link = sqliteTable(
  'link',
  {
    id: text('link_id').notNull().primaryKey(),
    name: text('name').notNull(),
    url: text('url').notNull(),
    slug: text('slug').notNull().unique(),
    userId: text('user_id'),
    teamId: text('team_id'),
    createdAt: dateTime('created_at').default(now),
    updatedAt: dateTime('updated_at')
      .default(now)
      .$onUpdate(() => new Date()),
    deletedAt: dateTime('deleted_at'),
  },
  table => [
    index('link_slug_idx').on(table.slug),
    index('link_user_id_idx').on(table.userId),
    index('link_team_id_idx').on(table.teamId),
    index('link_created_at_idx').on(table.createdAt),
    check('link_name_length', sql`length(${table.name}) <= 100`),
    check('link_url_length', sql`length(${table.url}) <= 500`),
    check('link_slug_length', sql`length(${table.slug}) <= 100`),
  ],
);

export type Link = typeof link.$inferSelect;
export type NewLink = typeof link.$inferInsert;

export const pixel = sqliteTable(
  'pixel',
  {
    id: text('pixel_id').notNull().primaryKey(),
    name: text('name').notNull(),
    slug: text('slug').notNull().unique(),
    userId: text('user_id'),
    teamId: text('team_id'),
    createdAt: dateTime('created_at').default(now),
    updatedAt: dateTime('updated_at')
      .default(now)
      .$onUpdate(() => new Date()),
    deletedAt: dateTime('deleted_at'),
  },
  table => [
    index('pixel_slug_idx').on(table.slug),
    index('pixel_user_id_idx').on(table.userId),
    index('pixel_team_id_idx').on(table.teamId),
    index('pixel_created_at_idx').on(table.createdAt),
    check('pixel_name_length', sql`length(${table.name}) <= 100`),
    check('pixel_slug_length', sql`length(${table.slug}) <= 100`),
  ],
);

export type Pixel = typeof pixel.$inferSelect;
export type NewPixel = typeof pixel.$inferInsert;

export const board = sqliteTable(
  'board',
  {
    id: text('board_id').notNull().primaryKey(),
    type: text('type').notNull(),
    name: text('name').notNull(),
    description: text('description').notNull(),
    parameters: text('parameters', { mode: 'json' }).notNull(),
    userId: text('user_id'),
    teamId: text('team_id'),
    createdAt: dateTime('created_at').default(now),
    updatedAt: dateTime('updated_at')
      .default(now)
      .$onUpdate(() => new Date()),
  },
  table => [
    index('board_user_id_idx').on(table.userId),
    index('board_team_id_idx').on(table.teamId),
    index('board_created_at_idx').on(table.createdAt),
    check('board_type_length', sql`length(${table.type}) <= 50`),
    check('board_name_length', sql`length(${table.name}) <= 200`),
    check('board_description_length', sql`length(${table.description}) <= 500`),
  ],
);

export type Board = typeof board.$inferSelect;
export type NewBoard = typeof board.$inferInsert;

export const share = sqliteTable(
  'share',
  {
    id: text('share_id').notNull().primaryKey(),
    entityId: text('entity_id').notNull(),
    name: text('name').notNull(),
    shareType: integer('share_type').notNull(),
    slug: text('slug').notNull().unique(),
    parameters: text('parameters', { mode: 'json' }).notNull(),
    createdAt: dateTime('created_at').default(now),
    updatedAt: dateTime('updated_at')
      .default(now)
      .$onUpdate(() => new Date()),
  },
  table => [
    index('share_entity_id_idx').on(table.entityId),
    check('share_name_length', sql`length(${table.name}) <= 200`),
    check('share_share_type_range', sql`${table.shareType} between -2147483648 and 2147483647`),
    check('share_slug_length', sql`length(${table.slug}) <= 100`),
  ],
);

export type Share = typeof share.$inferSelect;
export type NewShare = typeof share.$inferInsert;
