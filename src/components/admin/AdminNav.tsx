'use client';
import clsx from 'clsx';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { t } from '@/lib/i18n';

export function AdminNav() {
  const path = usePathname();
  const tabs = [
    { href: '/admin/users', label: t('admin.users') },
    { href: '/admin/departments', label: t('admin.departments') },
  ];
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Link href="/tasks" className="btn-secondary">
        <ArrowRight size={16} aria-hidden /> {t('admin.backToTasks')}
      </Link>
      <nav aria-label={t('admin.nav')} className="flex gap-1 rounded-pill border border-border-strong p-0.5">
        {tabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={path === tab.href ? 'page' : undefined}
            className={clsx(
              'inline-flex min-h-[40px] items-center rounded-pill px-4 text-sm',
              path === tab.href ? 'bg-primary text-ink' : 'text-ink-muted hover:text-ink',
            )}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
