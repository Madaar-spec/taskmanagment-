import type { Metadata, Viewport } from 'next';
import { t } from '@/lib/i18n';
import './globals.css';

export const metadata: Metadata = {
  title: `${t('app.moduleTitle')} — ${t('app.name')}`,
  description: 'نظام إدارة المهام في بوابة مدار',
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#082029' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Readex+Pro:wght@300;400;500;600;700&display=swap"
        />
      </head>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
