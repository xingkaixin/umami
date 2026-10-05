import { bindings, defineConfig } from '@cloudflare/config/public';

export default defineConfig({
  accountId: '99e4ea6d8ee7b6cd8ef5577b13cc1c39',
  worker: {
    name: 'umami',
    compatibilityDate: '2026-08-28',
    compatibilityFlags: ['nodejs_compat'],
    entrypoint: 'vinext/server/fetch-handler',
    workersDev: false,
    previewUrls: false,
    observability: {
      enabled: true,
    },
    assets: {
      notFoundHandling: 'none',
    },
    domains: ['umami.xingkaixin.me'],
    env: {
      APP_SECRET: bindings.secret(),
      TWO_FACTOR_ENCRYPTION_KEY: bindings.secret(),
      DB: bindings.d1({
        name: 'umami',
        id: 'dee22116-3720-47a1-9042-185750498e79',
      }),
      ASSETS: bindings.assets(),
    },
  },
});
