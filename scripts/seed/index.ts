/* eslint-disable no-console */
import 'dotenv/config';
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { getPlatformProxy } from 'wrangler';
import type { D1Database } from '@cloudflare/workers-types';
import { insertRows } from '../../src/db/insert';
import { deleteWebsiteData } from '../../src/db/delete';
import * as schema from '../../src/db/schema';
import {
  session,
  websiteEvent,
  eventData,
  revenue,
  website,
  user,
  report,
  segment,
  share,
} from '../../src/db/schema';
import { getSessionCountForDay } from './distributions/temporal.js';
import {
  type EventData,
  type EventDataEntry,
  generateEventsForSession,
} from './generators/events.js';
import {
  generateRevenueForEvents,
  type RevenueConfig,
  type RevenueData,
} from './generators/revenue.js';
import { createSessions, type SessionData } from './generators/sessions.js';
import {
  BLOG_SESSIONS_PER_DAY,
  BLOG_WEBSITE_DOMAIN,
  BLOG_WEBSITE_NAME,
  getBlogJourney,
  getBlogSiteConfig,
} from './sites/blog.js';
import {
  getSaasJourney,
  getSaasSiteConfig,
  SAAS_SESSIONS_PER_DAY,
  SAAS_WEBSITE_DOMAIN,
  SAAS_WEBSITE_NAME,
  saasRevenueConfigs,
} from './sites/saas.js';
import { formatNumber, generateDatesBetween, progressBar, subDays, uuid } from './utils.js';

type Database = ReturnType<typeof drizzle<typeof schema>>;

export interface SeedConfig {
  days: number;
  clear: boolean;
  verbose: boolean;
}

export interface SeedResult {
  websites: number;
  sessions: number;
  events: number;
  eventData: number;
  revenue: number;
}

async function findAdminUser(db: Database): Promise<string> {
  const admin = await db
    .select({ id: user.id })
    .from(user)
    .where(and(eq(user.role, 'admin'), isNull(user.deletedAt)))
    .get();
  if (!admin) throw new Error('Create a local administrator before seeding demo data.');
  return admin.id;
}

async function createWebsite(db: Database, name: string, domain: string, adminUserId: string) {
  const id = uuid();
  await db
    .insert(website)
    .values({ id, name, domain, userId: adminUserId, createdBy: adminUserId });
  return id;
}

async function clearDemoData(db: Database) {
  const ids = sql`select website_id from website where name in (${BLOG_WEBSITE_NAME}, ${SAAS_WEBSITE_NAME})`;
  await db.batch([
    ...deleteWebsiteData(db, ids),
    db.delete(report).where(inArray(report.websiteId, ids)),
    db.delete(segment).where(inArray(segment.websiteId, ids)),
    db.delete(share).where(inArray(share.entityId, ids)),
    db.delete(website).where(inArray(website.id, ids)),
  ]);
}

interface SiteGeneratorConfig {
  name: string;
  domain: string;
  sessionsPerDay: number;
  getSiteConfig: () => ReturnType<typeof getBlogSiteConfig>;
  getJourney: () => string[];
  revenueConfigs?: RevenueConfig[];
}

async function generateSiteData(
  db: Database,
  config: SiteGeneratorConfig,
  days: Date[],
  adminUserId: string,
  verbose: boolean,
): Promise<{ sessions: number; events: number; eventData: number; revenue: number }> {
  console.log(`\nGenerating data for ${config.name}...`);

  const websiteId = await createWebsite(db, config.name, config.domain, adminUserId);
  console.log(`  Created website: ${config.name} (${websiteId})`);

  const siteConfig = config.getSiteConfig();

  const allSessions: SessionData[] = [];
  const allEvents: EventData[] = [];
  const allEventData: EventDataEntry[] = [];
  const allRevenue: RevenueData[] = [];

  for (let dayIndex = 0; dayIndex < days.length; dayIndex++) {
    const day = days[dayIndex];
    const sessionCount = getSessionCountForDay(config.sessionsPerDay, day);
    const sessions = createSessions(websiteId, day, sessionCount);

    for (const session of sessions) {
      const journey = config.getJourney();
      const { events, eventDataEntries } = generateEventsForSession(session, siteConfig, journey);

      allSessions.push(session);
      allEvents.push(...events);
      allEventData.push(...eventDataEntries);

      if (config.revenueConfigs) {
        const revenueEntries = generateRevenueForEvents(events, config.revenueConfigs);
        allRevenue.push(...revenueEntries);
      }
    }

    // Show progress (every day in verbose mode, otherwise every 2 days)
    const shouldShowProgress = verbose || dayIndex % 2 === 0 || dayIndex === days.length - 1;
    if (shouldShowProgress) {
      process.stdout.write(
        `\r  ${progressBar(dayIndex + 1, days.length)} Day ${dayIndex + 1}/${days.length}`,
      );
    }
  }

  console.log(''); // New line after progress bar

  // Batch insert all data
  console.log(`  Inserting ${formatNumber(allSessions.length)} sessions...`);
  for (const statement of insertRows(db, session, allSessions)) await statement;

  console.log(`  Inserting ${formatNumber(allEvents.length)} events...`);
  for (const statement of insertRows(db, websiteEvent, allEvents)) await statement;

  if (allEventData.length > 0) {
    console.log(`  Inserting ${formatNumber(allEventData.length)} event data entries...`);
    for (const statement of insertRows(db, eventData, allEventData)) await statement;
  }

  if (allRevenue.length > 0) {
    console.log(`  Inserting ${formatNumber(allRevenue.length)} revenue entries...`);
    for (const statement of insertRows(db, revenue, allRevenue)) await statement;
  }

  return {
    sessions: allSessions.length,
    events: allEvents.length,
    eventData: allEventData.length,
    revenue: allRevenue.length,
  };
}

export async function seed(config: SeedConfig): Promise<SeedResult> {
  const proxy = await getPlatformProxy<{ DB: D1Database }>({
    configPath: 'wrangler.jsonc',
    persist: { path: '.wrangler/state/v3' },
  });
  const db = drizzle(proxy.env.DB, { schema });

  try {
    const endDate = new Date();
    const startDate = subDays(endDate, config.days);
    const days = generateDatesBetween(startDate, endDate);

    console.log(`\nSeed Configuration:`);
    console.log(
      `  Date range: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`,
    );
    console.log(`  Days: ${days.length}`);
    console.log(`  Clear existing: ${config.clear}`);

    if (config.clear) {
      await clearDemoData(db);
    }

    // Find admin user to own the demo websites
    const adminUserId = await findAdminUser(db);
    console.log(`  Using admin user: ${adminUserId}`);

    // Generate Blog site (low traffic)
    const blogResults = await generateSiteData(
      db,
      {
        name: BLOG_WEBSITE_NAME,
        domain: BLOG_WEBSITE_DOMAIN,
        sessionsPerDay: BLOG_SESSIONS_PER_DAY,
        getSiteConfig: getBlogSiteConfig,
        getJourney: getBlogJourney,
      },
      days,
      adminUserId,
      config.verbose,
    );

    // Generate SaaS site (high traffic)
    const saasResults = await generateSiteData(
      db,
      {
        name: SAAS_WEBSITE_NAME,
        domain: SAAS_WEBSITE_DOMAIN,
        sessionsPerDay: SAAS_SESSIONS_PER_DAY,
        getSiteConfig: getSaasSiteConfig,
        getJourney: getSaasJourney,
        revenueConfigs: saasRevenueConfigs,
      },
      days,
      adminUserId,
      config.verbose,
    );

    const result: SeedResult = {
      websites: 2,
      sessions: blogResults.sessions + saasResults.sessions,
      events: blogResults.events + saasResults.events,
      eventData: blogResults.eventData + saasResults.eventData,
      revenue: blogResults.revenue + saasResults.revenue,
    };

    console.log(`\n${'─'.repeat(50)}`);
    console.log(`Seed Complete!`);
    console.log(`${'─'.repeat(50)}`);
    console.log(`  Websites:   ${formatNumber(result.websites)}`);
    console.log(`  Sessions:   ${formatNumber(result.sessions)}`);
    console.log(`  Events:     ${formatNumber(result.events)}`);
    console.log(`  Event Data: ${formatNumber(result.eventData)}`);
    console.log(`  Revenue:    ${formatNumber(result.revenue)}`);
    console.log(`${'─'.repeat(50)}\n`);

    return result;
  } finally {
    await proxy.dispose();
  }
}
