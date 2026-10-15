'use client';
// عميل API للواجهة — يحوّل استجابات الخطأ إلى ApiError بالشكل الموحّد (القسم 7)
import { t } from './i18n';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly field: string | null,
  ) {
    super(message);
  }
}

interface Options {
  method?: string;
  body?: unknown;
  form?: FormData;
  /** طلب خلفية لا يجدّد الجلسة (FR-03) */
  background?: boolean;
}

export async function api<T>(path: string, opts: Options = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers['content-type'] = 'application/json';
  if (opts.background) headers['x-madaar-background'] = '1';
  let res: Response;
  try {
    res = await fetch(`/api/v1${path}`, {
      method: opts.method ?? 'GET',
      headers,
      body: opts.form ?? (opts.body === undefined ? undefined : JSON.stringify(opts.body)),
      credentials: 'same-origin',
    });
  } catch {
    throw new ApiError(0, 'NETWORK', t('errors.network'), null);
  }
  if (res.status === 401 && !path.startsWith('/auth/')) {
    window.location.assign('/login?expired=1');
  }
  const data = res.headers.get('content-type')?.includes('json') ? await res.json() : null;
  if (!res.ok) {
    const e = data?.error ?? {};
    throw new ApiError(res.status, e.code ?? 'INTERNAL', e.message ?? t('errors.INTERNAL'), e.field ?? null);
  }
  return data as T;
}

export function qs(params: Record<string, string | number | undefined | null>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') sp.set(k, String(v));
  const s = sp.toString();
  return s ? `?${s}` : '';
}
