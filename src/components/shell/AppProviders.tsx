'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useState } from 'react';
import { ToastProvider } from '@/components/ui/Toast';
import { api } from '@/lib/api';
import type { SessionUser } from '@/lib/types';

interface SessionValue {
  user: SessionUser;
  /** «اليوم» بتوقيت الرياض من الخادم (BR-03، BR-04) */
  today: string;
}

const SessionContext = createContext<SessionValue | null>(null);

export function useSession(): SessionValue {
  const v = useContext(SessionContext);
  if (!v) throw new Error('useSession outside AppProviders');
  return v;
}

const IDLE_MS = 30 * 60 * 1000;

/** FR-03: تسجيل خروج تلقائي بعد 30 دقيقة من عدم النشاط */
function IdleWatcher() {
  useEffect(() => {
    let last = Date.now();
    const bump = () => {
      last = Date.now();
    };
    const events = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;
    events.forEach((e) => window.addEventListener(e, bump, { passive: true }));
    const timer = window.setInterval(async () => {
      if (Date.now() - last >= IDLE_MS) {
        window.clearInterval(timer);
        await api('/auth/logout', { method: 'POST' }).catch(() => {});
        window.location.assign('/login?expired=1');
      }
    }, 15_000);
    return () => {
      events.forEach((e) => window.removeEventListener(e, bump));
      window.clearInterval(timer);
    };
  }, []);
  return null;
}

export function AppProviders({ user, today, children }: SessionValue & { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 15_000, retry: 1, refetchOnWindowFocus: false } },
      }),
  );
  return (
    <SessionContext.Provider value={{ user, today }}>
      <QueryClientProvider client={client}>
        <ToastProvider>
          <IdleWatcher />
          {children}
        </ToastProvider>
      </QueryClientProvider>
    </SessionContext.Provider>
  );
}
