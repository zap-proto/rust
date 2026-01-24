import { RootProvider } from 'fumadocs-ui/provider';
import 'fumadocs-ui/style.css';
import type { ReactNode } from 'react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: {
    template: '%s | ZAP Rust',
    default: 'ZAP Rust Documentation',
  },
  description: 'Rust bindings for ZAP - Zero-Copy App Proto for AI agent communication',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}
