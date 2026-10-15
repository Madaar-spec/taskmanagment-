// حالات التحميل هياكل رمادية لا مؤشرات دوّارة (القسم 6)
import { t } from '@/lib/i18n';

export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden className={`skeleton ${className}`} />;
}

export function SkeletonRows({ rows = 6 }: { rows?: number }) {
  return (
    <div role="status" aria-label={t('common.loading')} className="space-y-3 p-4">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-11 w-full" />
      ))}
    </div>
  );
}
