import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { expect, test } from '@playwright/test';
import { uuid } from '../../src/lib/crypto';
import { teams, websites } from './fixtures';
import { type Auth, authHeaders, deleteTeam, deleteWebsite, loginViaApi } from './helpers';

test.describe('Website API tests', () => {
  test.describe.configure({ mode: 'serial' });

  let auth: Auth;
  let websiteId = '';
  let teamId = '';

  test.beforeAll(async ({ request }) => {
    auth = await loginViaApi(request);

    const response = await request.post('/api/teams', {
      headers: authHeaders(auth),
      data: teams.teamCreate,
    });
    const body = await response.json();

    teamId = body[0].id;

    expect(response.status()).toBe(200);
    expect(body[0]).toHaveProperty('name', 'playwright');
    expect(body[1]).toHaveProperty('role', 'team-owner');
  });

  test.afterAll(async ({ request }) => {
    if (websiteId) {
      await deleteWebsite(request, auth, websiteId);
    }
    if (teamId) {
      await deleteTeam(request, auth, teamId);
    }
  });

  test('creates a website for user', async ({ request }) => {
    const response = await request.post('/api/websites', {
      headers: authHeaders(auth),
      data: websites.websiteCreate,
    });
    const body = await response.json();

    websiteId = body.id;

    expect(response.status()).toBe(200);
    expect(body).toHaveProperty('name', 'Playwright Website');
    expect(body).toHaveProperty('domain', 'playwright.com');
  });

  test('creates a website for team', async ({ request }) => {
    const response = await request.post('/api/websites', {
      headers: authHeaders(auth),
      data: {
        name: 'Team Website',
        domain: 'teamwebsite.com',
        teamId,
      },
    });
    const body = await response.json();

    expect(response.status()).toBe(200);
    expect(body).toHaveProperty('name', 'Team Website');
    expect(body).toHaveProperty('domain', 'teamwebsite.com');
  });

  test('creates a website with a fixed ID', async ({ request }) => {
    const fixedId = uuid();
    const response = await request.post('/api/websites', {
      headers: authHeaders(auth),
      data: { ...websites.websiteCreate, id: fixedId },
    });
    const body = await response.json();

    expect(response.status()).toBe(200);
    expect(body).toHaveProperty('id', fixedId);
    expect(body).toHaveProperty('name', 'Playwright Website');
    expect(body).toHaveProperty('domain', 'playwright.com');

    await request.delete(`/api/websites/${fixedId}`, {
      headers: authHeaders(auth),
    });
  });

  test('returns all tracked websites', async ({ request }) => {
    const response = await request.get('/api/websites', {
      headers: authHeaders(auth),
    });
    const body = await response.json();

    expect(response.status()).toBe(200);
    expect(body.data[0]).toHaveProperty('id');
    expect(body.data[0]).toHaveProperty('name');
    expect(body.data[0]).toHaveProperty('domain');
  });

  test('gets a website by ID', async ({ request }) => {
    const response = await request.get(`/api/websites/${websiteId}`, {
      headers: authHeaders(auth),
    });
    const body = await response.json();

    expect(response.status()).toBe(200);
    expect(body).toHaveProperty('name', 'Playwright Website');
    expect(body).toHaveProperty('domain', 'playwright.com');
  });

  test('updates a website', async ({ request }) => {
    const response = await request.post(`/api/websites/${websiteId}`, {
      headers: authHeaders(auth),
      data: websites.websiteUpdate,
    });
    const body = await response.json();

    websiteId = body.id;

    expect(response.status()).toBe(200);
    expect(body).toHaveProperty('name', 'Playwright Website Updated');
    expect(body).toHaveProperty('domain', 'playwrightupdated.com');
  });

  test('updates a website with only shareId', async ({ request }) => {
    const shareId = uuid().replaceAll('-', '').slice(0, 12);
    const response = await request.post(`/api/websites/${websiteId}`, {
      headers: authHeaders(auth),
      data: { shareId },
    });
    const body = await response.json();

    expect(response.status()).toBe(200);
    expect(body).toHaveProperty('shareId', shareId);
  });

  test('resets a website by removing all data related to the website', async ({ request }) => {
    const response = await request.post(`/api/websites/${websiteId}/reset`, {
      headers: authHeaders(auth),
    });
    const body = await response.json();

    expect(response.status()).toBe(200);
    expect(body).toHaveProperty('ok', true);
  });

  test('collects events and identity properties into D1 reports', async ({ request }) => {
    const startAt = Date.now() - 60_000;
    const payload = {
      website: websiteId,
      hostname: 'playwrightupdated.com',
      url: '/checkout',
      language: 'en-US',
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    };
    const pageview = await request.post('/api/send', { data: { type: 'event', payload } });
    expect(pageview.status()).toBe(200);
    const { cache, sessionId } = await pageview.json();
    expect(sessionId).toBeTruthy();

    for (const collection of [
      {
        type: 'event',
        payload: { ...payload, name: 'purchase', data: { plan: 'pro', amount: 29.5 } },
      },
      { type: 'identify', payload: { ...payload, id: 'customer-1', data: { plan: 'pro' } } },
      { type: 'performance', payload: { ...payload, lcp: 1200, cls: 0.05, ttfb: 250 } },
    ]) {
      const response = await request.post('/api/send', {
        headers: { 'x-umami-cache': cache },
        data: collection,
      });
      expect(response.status()).toBe(200);
      expect((await response.json()).sessionId).toBe(sessionId);
    }

    const params = { startAt, endAt: Date.now() + 60_000 };
    const stats = await request.get(`/api/websites/${websiteId}/stats`, {
      headers: authHeaders(auth),
      params,
    });
    expect(stats.status()).toBe(200);
    expect(await stats.json()).toMatchObject({ pageviews: 1, visitors: 1, visits: 1, bounces: 0 });

    const events = await request.get(`/api/websites/${websiteId}/events`, {
      headers: authHeaders(auth),
      params,
    });
    expect(events.status()).toBe(200);
    const { data, count } = await events.json();
    expect(count).toBe(2);
    expect(data.find(event => event.eventName === 'purchase')).toMatchObject({
      urlPath: '/checkout',
      sessionId,
    });
    expect(data.find(event => event.eventName === 'purchase').hasData).toBeTruthy();

    const properties = await request.get(
      `/api/websites/${websiteId}/sessions/${sessionId}/properties`,
      {
        headers: authHeaders(auth),
      },
    );
    expect(properties.status()).toBe(200);
    expect(await properties.json()).toEqual(
      expect.arrayContaining([expect.objectContaining({ dataKey: 'plan', stringValue: 'pro' })]),
    );
  });

  test('serves the tracker and collects events from another origin', async ({
    page,
    request,
  }, testInfo) => {
    const baseURL = testInfo.project.use.baseURL;
    const preflight = await request.fetch('/api/send', {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://tracked.localhost',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type,x-umami-cache',
      },
    });
    expect(preflight.ok()).toBe(true);
    expect(preflight.headers()['access-control-allow-origin']).toBe('*');

    const server = createServer((_request, response) => {
      response.writeHead(200, { 'Content-Type': 'text/html' });
      response.end(
        `<html><head><script defer src="${baseURL}/script.js" data-website-id="${websiteId}"></script></head><body>Tracker test</body></html>`,
      );
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    try {
      const pageview = page.waitForResponse(
        response =>
          response.url() === `${baseURL}/api/send` && response.request().method() === 'POST',
      );
      await page.goto(`http://127.0.0.1:${(server.address() as AddressInfo).port}/browser-tracker`);
      expect((await pageview).status()).toBe(200);

      const event = page.waitForResponse(
        response =>
          response.url() === `${baseURL}/api/send` && response.request().method() === 'POST',
      );
      await page.evaluate(() =>
        (window as any).umami.track('browser-event', { source: 'tracker' }),
      );
      expect((await event).status()).toBe(200);

      const events = await request.get(`/api/websites/${websiteId}/events`, {
        headers: authHeaders(auth),
        params: { startAt: Date.now() - 60_000, endAt: Date.now() + 60_000 },
      });
      expect(events.status()).toBe(200);
      expect((await events.json()).data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ eventName: 'browser-event', urlPath: '/browser-tracker' }),
        ]),
      );
    } finally {
      await new Promise<void>(resolve => server.close(() => resolve()));
    }
  });

  test('deletes a website', async ({ request }) => {
    const response = await request.delete(`/api/websites/${websiteId}`, {
      headers: authHeaders(auth),
    });
    const body = await response.json();

    websiteId = '';

    expect(response.status()).toBe(200);
    expect(body).toHaveProperty('ok', true);
  });
});
