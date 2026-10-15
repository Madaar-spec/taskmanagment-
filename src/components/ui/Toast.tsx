'use client';
// FR-29: رسائل تأكيد مؤقتة
import { X } from 'lucide-react';
import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { t } from '@/lib/i18n';

type Kind = 'success' | 'error';
interface ToastItem {
  id: number;
  message: string;
  kind: Kind;
}

const ToastContext = createContext<(message: string, kind?: Kind) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);
  const dismiss = useCallback((id: number) => setItems((xs) => xs.filter((x) => x.id !== id)), []);
  const push = useCallback(
    (message: string, kind: Kind = 'success') => {
      const id = ++seq.current;
      setItems((xs) => [...xs.slice(-3), { id, message, kind }]);
      setTimeout(() => dismiss(id), kind === 'error' ? 7000 : 4500);
    },
    [dismiss],
  );
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4">
        <div aria-live="polite" role="status" className="contents">
          {items
            .filter((i) => i.kind === 'success')
            .map((i) => (
              <ToastCard key={i.id} item={i} onClose={() => dismiss(i.id)} />
            ))}
        </div>
        <div aria-live="assertive" role="alert" className="contents">
          {items
            .filter((i) => i.kind === 'error')
            .map((i) => (
              <ToastCard key={i.id} item={i} onClose={() => dismiss(i.id)} />
            ))}
        </div>
      </div>
    </ToastContext.Provider>
  );
}

function ToastCard({ item, onClose }: { item: ToastItem; onClose: () => void }) {
  return (
    <div
      data-testid="toast"
      data-kind={item.kind}
      className={`pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-card border px-4 py-2 shadow-lg ${
        item.kind === 'error' ? 'border-danger/60 bg-[#3a2a26] text-ink' : 'border-accent/50 bg-surface-2 text-ink'
      }`}
    >
      <span className={`h-2 w-2 shrink-0 rounded-full ${item.kind === 'error' ? 'bg-danger' : 'bg-accent'}`} aria-hidden />
      <p className="flex-1 text-sm">{item.message}</p>
      <button type="button" onClick={onClose} className="btn-icon -me-2" aria-label={t('toast.dismiss')}>
        <X size={16} aria-hidden />
      </button>
    </div>
  );
}
