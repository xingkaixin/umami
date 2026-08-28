'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, ZenProvider } from '@umami/react-zen';
import { NextIntlClientProvider } from 'next-intl';
import { useEffect } from 'react';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { useLocale } from '@/components/hooks';
import 'chartjs-adapter-date-fns';
// Keep global styles in the client graph so vinext includes them in the initial HTML.
import '@umami/react-zen/styles.full.css';
import './global.css';

const client = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60,
    },
  },
});

function MessagesProvider({ children }) {
  const { locale, messages, dir } = useLocale();

  useEffect(() => {
    document.documentElement.setAttribute('dir', dir);
    document.documentElement.setAttribute('lang', locale);
  }, [locale, dir]);

  return (
    <NextIntlClientProvider locale={locale} messages={messages[locale]} onError={() => null}>
      {children}
    </NextIntlClientProvider>
  );
}

export function Providers({ children }) {
  return (
    <ZenProvider>
      <RouterProvider>
        <MessagesProvider>
          <QueryClientProvider client={client}>
            <ErrorBoundary>{children}</ErrorBoundary>
          </QueryClientProvider>
        </MessagesProvider>
      </RouterProvider>
    </ZenProvider>
  );
}
