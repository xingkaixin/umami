import { getDatabase } from '@/db/client';
import { insertRows } from '@/db/insert';
import { getPropertyValues } from '@/db/properties';
import { eventData as eventDataTable, revenue as revenueTable, websiteEvent } from '@/db/schema';
import { FIELD_LENGTH } from '@/lib/constants';
import { uuid } from '@/lib/crypto';
import { truncateString } from '@/lib/format';

export interface SaveEventArgs {
  websiteId: string;
  sessionId: string;
  visitId: string;
  eventType: number;
  createdAt?: Date;

  // Page
  pageTitle?: string;
  hostname?: string;
  urlPath: string;
  urlQuery?: string;
  referrerPath?: string;
  referrerQuery?: string;
  referrerDomain?: string;

  // Session
  distinctId?: string;
  browser?: string;
  os?: string;
  device?: string;
  screen?: string;
  language?: string;
  country?: string;
  region?: string;
  city?: string;

  // Events
  eventName?: string;
  eventData?: any;
  tag?: string;

  // UTM
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;

  // Click IDs
  gclid?: string;
  fbclid?: string;
  msclkid?: string;
  ttclid?: string;
  lifatid?: string;
  twclid?: string;

  // Performance
  lcp?: number;
  inp?: number;
  cls?: number;
  fcp?: number;
  ttfb?: number;
}

export async function saveEvent({
  websiteId,
  sessionId,
  visitId,
  eventType,
  createdAt = new Date(),
  pageTitle,
  hostname,
  urlPath,
  urlQuery,
  referrerPath,
  referrerQuery,
  referrerDomain,
  eventName,
  eventData,
  tag,
  utmSource,
  utmMedium,
  utmCampaign,
  utmContent,
  utmTerm,
  gclid,
  fbclid,
  msclkid,
  ttclid,
  lifatid,
  twclid,
  lcp,
  inp,
  cls,
  fcp,
  ttfb,
}: SaveEventArgs) {
  const websiteEventId = uuid();

  const db = getDatabase();
  const insertEvent = db.insert(websiteEvent).values({
    id: websiteEventId,
    websiteId,
    sessionId,
    visitId,
    urlPath: truncateString(urlPath, FIELD_LENGTH.url),
    urlQuery: truncateString(urlQuery, FIELD_LENGTH.url),
    utmSource: truncateString(utmSource, FIELD_LENGTH.fieldValue),
    utmMedium: truncateString(utmMedium, FIELD_LENGTH.fieldValue),
    utmCampaign: truncateString(utmCampaign, FIELD_LENGTH.fieldValue),
    utmContent: truncateString(utmContent, FIELD_LENGTH.fieldValue),
    utmTerm: truncateString(utmTerm, FIELD_LENGTH.fieldValue),
    referrerPath: truncateString(referrerPath, FIELD_LENGTH.url),
    referrerQuery: truncateString(referrerQuery, FIELD_LENGTH.url),
    referrerDomain: truncateString(referrerDomain, FIELD_LENGTH.url),
    pageTitle: truncateString(pageTitle, FIELD_LENGTH.pageTitle),
    gclid: truncateString(gclid, FIELD_LENGTH.fieldValue),
    fbclid: truncateString(fbclid, FIELD_LENGTH.fieldValue),
    msclkid: truncateString(msclkid, FIELD_LENGTH.fieldValue),
    ttclid: truncateString(ttclid, FIELD_LENGTH.fieldValue),
    lifatid: truncateString(lifatid, FIELD_LENGTH.fieldValue),
    twclid: truncateString(twclid, FIELD_LENGTH.fieldValue),
    eventType,
    eventName: truncateString(eventName, FIELD_LENGTH.eventName) ?? null,
    tag: truncateString(tag, FIELD_LENGTH.tag),
    hostname: truncateString(hostname, FIELD_LENGTH.hostname),
    lcp,
    inp,
    cls,
    fcp,
    ttfb,
    createdAt,
  });

  const properties = eventData
    ? getPropertyValues(eventData).map(data => ({
        ...data,
        id: uuid(),
        websiteId,
        websiteEventId,
        createdAt,
      }))
    : [];
  const revenue = eventData?.revenue;
  const currency = eventData?.currency;
  await db.batch([
    insertEvent,
    ...insertRows(db, eventDataTable, properties),
    ...(revenue > 0 && currency
      ? [
          db.insert(revenueTable).values({
            id: uuid(),
            websiteId,
            sessionId,
            eventId: websiteEventId,
            eventName: truncateString(eventName, FIELD_LENGTH.eventName),
            revenue,
            currency: truncateString(currency, FIELD_LENGTH.currency),
            createdAt,
          }),
        ]
      : []),
  ]);
}
