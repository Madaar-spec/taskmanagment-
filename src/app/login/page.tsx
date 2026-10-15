import { Suspense } from 'react';
import { LoginForm } from '@/components/LoginForm';
import { Logo } from '@/components/shell/Logo';
import { t } from '@/lib/i18n';

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="card w-full max-w-md p-6 sm:p-8">
        <div className="mb-6 flex flex-col items-center gap-4 text-center">
          <Logo />
          <div>
            <h1 className="text-xl font-semibold">{t('auth.loginTitle')}</h1>
            <p className="mt-1 text-sm text-ink-muted">{t('auth.loginSubtitle')}</p>
          </div>
        </div>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
