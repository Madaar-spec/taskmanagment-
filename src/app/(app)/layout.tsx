import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AppProviders } from '@/components/shell/AppProviders';
import { Header } from '@/components/shell/Header';
import { getToday } from '@/lib/clock';
import { t } from '@/lib/i18n';
import { userFromToken } from '@/server/auth/currentUser';
import { SESSION_COOKIE } from '@/server/auth/session';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await userFromToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (!user) redirect('/login?expired=1');
  return (
    <AppProviders user={user} today={getToday()}>
      <a
        href="#main"
        className="sr-only z-[200] rounded-pill bg-primary px-4 py-2 focus:not-sr-only focus:fixed focus:right-4 focus:top-4"
      >
        {t('app.skipToContent')}
      </a>
      <Header />
      {children}
    </AppProviders>
  );
}
