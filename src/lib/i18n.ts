// NFR-08: كل النصوص العربية في messages/ar.json
import ar from '../../messages/ar.json';

export const messages = ar;

type Params = Record<string, string | number>;

/** استبدال {param} في النص */
export function fmt(template: string, params: Params = {}): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => (k in params ? String(params[k]) : `{${k}}`));
}

/** قراءة نص بالمسار المنقّط، مثل t('errors.titleRequired') */
export function t(path: string, params?: Params): string {
  const value = path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object' && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, ar);
  if (typeof value !== 'string') return path;
  return fmt(value, params);
}
