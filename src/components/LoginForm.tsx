'use client';
// FR-01
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { t } from '@/lib/i18n';
import { fieldErrors, loginSchema } from '@/lib/schemas';

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(
    params.get('expired') ? t('auth.sessionExpired') : params.get('out') ? t('auth.loggedOut') : null,
  );
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget));
    const parsed = loginSchema.safeParse(data);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setFormError(null);
    setBusy(true);
    try {
      await api('/auth/login', { method: 'POST', body: parsed.data });
      router.replace('/tasks');
      router.refresh();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : t('errors.INTERNAL'));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {formError && (
        <p role="alert" className="rounded-field border border-danger/50 bg-danger/10 px-3 py-2 text-sm text-ink">
          {formError}
        </p>
      )}
      <div>
        <label htmlFor="email" className="label">
          {t('auth.email')}
        </label>
        <input
          id="email"
          name="email"
          type="email"
          dir="ltr"
          autoComplete="username"
          className="field text-start"
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? 'email-error' : undefined}
        />
        {errors.email && (
          <p id="email-error" className="field-error">
            {errors.email}
          </p>
        )}
      </div>
      <div>
        <label htmlFor="password" className="label">
          {t('auth.password')}
        </label>
        <input
          id="password"
          name="password"
          type="password"
          dir="ltr"
          autoComplete="current-password"
          className="field text-start"
          aria-invalid={!!errors.password}
          aria-describedby={errors.password ? 'password-error' : undefined}
        />
        {errors.password && (
          <p id="password-error" className="field-error">
            {errors.password}
          </p>
        )}
      </div>
      <button type="submit" className="btn-primary w-full" disabled={busy}>
        {busy ? t('auth.submitting') : t('auth.submit')}
      </button>
    </form>
  );
}
