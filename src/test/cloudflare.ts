export const env: {
  DB: import('@cloudflare/workers-types').D1Database;
  LOG_QUERY?: string;
} = { DB: undefined };
