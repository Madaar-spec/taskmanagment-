'use client';
// النوافذ تُغلق بـ Esc وتحبس التركيز (Radix Dialog)
import * as D from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { t } from '@/lib/i18n';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

export function Modal({ open, onOpenChange, title, description, children, size = 'md' }: Props) {
  const width = size === 'sm' ? 'max-w-md' : size === 'lg' ? 'max-w-2xl' : 'max-w-xl';
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="overlay fixed inset-0 z-50 bg-black/60" />
        <D.Content
          dir="rtl"
          className={`fixed left-1/2 top-1/2 z-50 max-h-[92vh] w-[calc(100vw-1.5rem)] ${width} -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-card border border-border bg-surface-2 p-5 shadow-2xl sm:p-6`}
          {...(!description && { 'aria-describedby': undefined })}
        >
          <div className="mb-4 flex items-start justify-between gap-3">
            <D.Title className="text-lg font-semibold">{title}</D.Title>
            <D.Close className="btn-icon -mt-2 -me-2" aria-label={t('common.close')}>
              <X size={18} aria-hidden />
            </D.Close>
          </div>
          {description && <D.Description className="mb-4 text-sm text-ink-muted">{description}</D.Description>}
          {children}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
