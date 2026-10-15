'use client';
// الشعار: public/madaar-logo-light.png بارتفاع 44px، ولا يُعاد رسمه أو تلوينه (القسم 6).
// إن لم يتوفر الملف يُعرض اسم «مدار» نصاً إلى أن يُضاف الشعار المعتمد.
import { useState } from 'react';
import { t } from '@/lib/i18n';

export function Logo() {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <span className="flex h-11 items-center text-2xl font-bold tracking-wide text-ink" aria-label={t('app.logoAlt')}>
        {t('app.name')}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/madaar-logo-light.png" alt={t('app.logoAlt')} height={44} className="h-11 w-auto" onError={() => setFailed(true)} />
  );
}
