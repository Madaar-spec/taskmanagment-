import { riyadhDate } from './dates';

/**
 * «اليوم» بتوقيت الرياض (BR-03، BR-04). يمكن تثبيته عبر APP_FIXED_TODAY
 * لاختبارات القبول (بيانات Seed بتاريخ 2026-10-15) — يُترك فارغاً في الإنتاج.
 */
export function getToday(): string {
  const fixed = process.env.APP_FIXED_TODAY?.trim();
  if (fixed && /^\d{4}-\d{2}-\d{2}$/.test(fixed)) return fixed;
  return riyadhDate();
}
