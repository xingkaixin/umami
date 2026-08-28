import { sql } from 'drizzle-orm';
import { check, index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { dateTime } from '../columns';

const now = sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`;

export const user = sqliteTable(
  'user',
  {
    id: text('user_id').notNull().primaryKey(),
    username: text('username').notNull().unique(),
    password: text('password').notNull(),
    role: text('role').notNull(),
    logoUrl: text('logo_url'),
    displayName: text('display_name'),
    twoFactorRequired: integer('two_factor_required', { mode: 'boolean' }).notNull().default(false),
    createdAt: dateTime('created_at').default(now),
    updatedAt: dateTime('updated_at')
      .default(now)
      .$onUpdate(() => new Date()),
    deletedAt: dateTime('deleted_at'),
  },
  table => [
    check('user_username_length', sql`length(${table.username}) <= 255`),
    check('user_password_length', sql`length(${table.password}) <= 60`),
    check('user_role_length', sql`length(${table.role}) <= 50`),
    check('user_logo_url_length', sql`length(${table.logoUrl}) <= 2183`),
    check('user_display_name_length', sql`length(${table.displayName}) <= 255`),
  ],
);

export type User = typeof user.$inferSelect;
export type NewUser = typeof user.$inferInsert;

export const team = sqliteTable(
  'team',
  {
    id: text('team_id').notNull().primaryKey(),
    name: text('name').notNull(),
    accessCode: text('access_code').unique(),
    logoUrl: text('logo_url'),
    twoFactorRequired: integer('two_factor_required', { mode: 'boolean' }).notNull().default(false),
    createdAt: dateTime('created_at').default(now),
    updatedAt: dateTime('updated_at')
      .default(now)
      .$onUpdate(() => new Date()),
    deletedAt: dateTime('deleted_at'),
  },
  table => [
    index('team_access_code_idx').on(table.accessCode),
    check('team_name_length', sql`length(${table.name}) <= 50`),
    check('team_access_code_length', sql`length(${table.accessCode}) <= 50`),
    check('team_logo_url_length', sql`length(${table.logoUrl}) <= 2183`),
  ],
);

export type Team = typeof team.$inferSelect;
export type NewTeam = typeof team.$inferInsert;

export const teamUser = sqliteTable(
  'team_user',
  {
    id: text('team_user_id').notNull().primaryKey(),
    teamId: text('team_id').notNull(),
    userId: text('user_id').notNull(),
    role: text('role').notNull(),
    createdAt: dateTime('created_at').default(now),
    updatedAt: dateTime('updated_at')
      .default(now)
      .$onUpdate(() => new Date()),
  },
  table => [
    index('team_user_team_id_idx').on(table.teamId),
    index('team_user_user_id_idx').on(table.userId),
    check('team_user_role_length', sql`length(${table.role}) <= 50`),
  ],
);

export type TeamUser = typeof teamUser.$inferSelect;
export type NewTeamUser = typeof teamUser.$inferInsert;

export const twoFactorAuth = sqliteTable('two_factor_auth', {
  id: text('id')
    .notNull()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().unique(),
  secret: text('secret').notNull(),
  isEnabled: integer('is_enabled', { mode: 'boolean' }).notNull().default(false),
  createdAt: dateTime('created_at').notNull().default(now),
  updatedAt: dateTime('updated_at')
    .notNull()
    .default(now)
    .$onUpdate(() => new Date()),
});

export type TwoFactorAuth = typeof twoFactorAuth.$inferSelect;
export type NewTwoFactorAuth = typeof twoFactorAuth.$inferInsert;

export const twoFactorBackupCode = sqliteTable(
  'two_factor_backup_code',
  {
    id: text('id')
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id').notNull(),
    codeHash: text('code_hash').notNull(),
    used: integer('used', { mode: 'boolean' }).notNull().default(false),
    createdAt: dateTime('created_at').notNull().default(now),
  },
  table => [index('two_factor_backup_code_user_id_idx').on(table.userId)],
);

export type TwoFactorBackupCode = typeof twoFactorBackupCode.$inferSelect;
export type NewTwoFactorBackupCode = typeof twoFactorBackupCode.$inferInsert;

export const twoFactorOtpUsed = sqliteTable(
  'two_factor_otp_used',
  {
    id: text('id')
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id').notNull(),
    otp: text('otp').notNull(),
    expiresAt: dateTime('expires_at').notNull(),
  },
  table => [uniqueIndex('two_factor_otp_used_user_id_otp_key').on(table.userId, table.otp)],
);

export type TwoFactorOtpUsed = typeof twoFactorOtpUsed.$inferSelect;
export type NewTwoFactorOtpUsed = typeof twoFactorOtpUsed.$inferInsert;

export const twoFactorRateLimit = sqliteTable(
  'two_factor_rate_limit',
  {
    id: text('id')
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id').notNull().unique(),
    attempts: integer('attempts').notNull().default(0),
    lockedUntil: dateTime('locked_until'),
    updatedAt: dateTime('updated_at')
      .notNull()
      .default(now)
      .$onUpdate(() => new Date()),
  },
  table => [
    check(
      'two_factor_rate_limit_attempts_range',
      sql`${table.attempts} between -2147483648 and 2147483647`,
    ),
  ],
);

export type TwoFactorRateLimit = typeof twoFactorRateLimit.$inferSelect;
export type NewTwoFactorRateLimit = typeof twoFactorRateLimit.$inferInsert;

export const appSetting = sqliteTable('app_setting', {
  key: text('key').notNull().primaryKey(),
  value: text('value').notNull(),
});

export type AppSetting = typeof appSetting.$inferSelect;
export type NewAppSetting = typeof appSetting.$inferInsert;
