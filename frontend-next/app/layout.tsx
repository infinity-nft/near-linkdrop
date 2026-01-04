'use client';

import '@near-pagoda/ui/styles.css';
import './globals.css';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PagodaUiProvider, Toaster } from '@near-pagoda/ui';
import { ReactNode } from 'react';

export default function RootLayout({ children }: { children: ReactNode }) {
  const router = useRouter();

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, minimum-scale=1" />
        <title>NEAR Linkdrop</title>
      </head>
      <body>
        <PagodaUiProvider
          value={{
            Link,
            useRouter: () => router
          }}
        >
          <Toaster />
          <main className="min-h-screen bg-black">{children}</main>
        </PagodaUiProvider>
      </body>
    </html>
  );
}
