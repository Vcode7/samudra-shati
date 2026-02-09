import type { Metadata } from 'next';
import { AppProviders } from '@/providers/AppProviders';

export const metadata: Metadata = {
  title: 'Authority Dashboard',
  description: 'Smart Disaster Management System - Authority Dashboard',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
