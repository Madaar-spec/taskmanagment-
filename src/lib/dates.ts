// BR-18: التخزين بـ UTC والعرض بتوقيت الرياض وبأسماء الأشهر العربية الميلادية
import { messages } from './i18n';

export const TIME_ZONE = 'Asia/Riyadh';
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** تاريخ اليوم (YYYY-MM-DD) بتوقيت الرياض للحظة معيّنة */
export function riyadhDate(at: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(at);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** فرق الأيام (b - a) بين تاريخين YYYY-MM-DD */
export function diffDays(a: string, b: string): number {
  const ms = Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** تحويل حقل due_date (Date عند منتصف ليل UTC) إلى YYYY-MM-DD */
export function dateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function toDbDate(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}

/** «15 أكتوبر 2026» */
export function formatDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return `${d} ${messages.months[(m ?? 1) - 1]} ${y}`;
}

/** «15 أكتوبر 2026، 10:30 ص» بتوقيت الرياض */
export function formatDateTime(iso: string | Date): string {
  const at = typeof iso === 'string' ? new Date(iso) : iso;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).formatToParts(at);
  const hour = parts.find((p) => p.type === 'hour')?.value ?? '';
  const minute = parts.find((p) => p.type === 'minute')?.value ?? '';
  const pm = parts.find((p) => p.type === 'dayPeriod')?.value === 'PM';
  return `${formatDate(riyadhDate(at))}، ${hour}:${minute} ${pm ? 'م' : 'ص'}`;
}
