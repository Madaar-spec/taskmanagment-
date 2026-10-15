'use client';
// FR-31: إدارة المستخدمين — إضافة، تعطيل، تغيير الدور والإدارة
import { useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { t } from '@/lib/i18n';
import { adminCreateUserSchema, adminUpdateUserSchema, fieldErrors } from '@/lib/schemas';
import { ROLES } from '@/lib/taskRules';
import { useSession } from '../shell/AppProviders';
import { Modal } from '../ui/Dialog';
import { SkeletonRows } from '../ui/Skeleton';
import { useToast } from '../ui/Toast';
import { type AdminUser, useAdminDepartments, useAdminUsers } from './useAdmin';

export function UsersAdmin() {
  const { user: me } = useSession();
  const users = useAdminUsers();
  const qc = useQueryClient();
  const toast = useToast();
  const [editing, setEditing] = useState<AdminUser | null | 'new'>(null);

  async function toggle(u: AdminUser) {
    try {
      await api(`/admin/users/${u.id}`, { method: 'PATCH', body: { isActive: !u.isActive } });
      toast(t('toast.saved'));
      qc.invalidateQueries({ queryKey: ['admin'] });
    } catch (err) {
      toast(err instanceof ApiError ? err.message : t('errors.INTERNAL'), 'error');
    }
  }

  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
        <h1 className="text-xl font-semibold">{t('admin.users')}</h1>
        <button type="button" className="btn-primary" onClick={() => setEditing('new')}>
          <Plus size={16} aria-hidden /> {t('admin.addUser')}
        </button>
      </div>
      {users.isLoading ? (
        <SkeletonRows />
      ) : (
        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-border text-ink-muted">
                {['fullName', 'email', 'role', 'department', 'status', 'actions'].map((k) => (
                  <th key={k} scope="col" className="px-4 py-3 text-start font-medium">
                    {t(`admin.${k}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.data?.map((u) => (
                <tr key={u.id} className="border-b border-border/70">
                  <td className="px-4 py-2 font-medium">{u.fullNameAr}</td>
                  <td className="px-4 py-2" dir="ltr">
                    <span className="block text-end">{u.email}</span>
                  </td>
                  <td className="px-4 py-2">{t(`role.${u.role}`)}</td>
                  <td className="px-4 py-2">{u.department.nameAr}</td>
                  <td className="px-4 py-2">
                    <span className={`rounded-pill px-2.5 py-1 text-xs ${u.isActive ? 'bg-st-done/15 text-st-done' : 'bg-pr-low/15 text-pr-low'}`}>
                      {u.isActive ? t('admin.active') : t('admin.inactive')}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-1">
                      <button type="button" className="btn-icon" onClick={() => setEditing(u)} aria-label={t('admin.edit', { name: u.fullNameAr })}>
                        <Pencil size={16} aria-hidden />
                      </button>
                      {u.id !== me.id && (
                        <button
                          type="button"
                          className="btn-secondary min-h-[40px] px-3 text-xs"
                          onClick={() => toggle(u)}
                          aria-label={t('admin.toggleActive', { action: u.isActive ? t('admin.disable') : t('admin.enable'), name: u.fullNameAr })}
                        >
                          {u.isActive ? t('admin.disable') : t('admin.enable')}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <UserDialog user={editing === 'new' ? null : editing} open={editing !== null} onClose={() => setEditing(null)} />
    </section>
  );
}

function UserDialog({ user, open, onClose }: { user: AdminUser | null; open: boolean; onClose: () => void }) {
  const depts = useAdminDepartments();
  const qc = useQueryClient();
  const toast = useToast();
  const [form, setForm] = useState({ fullNameAr: '', email: '', password: '', role: 'EMPLOYEE', departmentId: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setForm({
        fullNameAr: user?.fullNameAr ?? '',
        email: user?.email ?? '',
        password: '',
        role: user?.role ?? 'EMPLOYEE',
        departmentId: user?.departmentId ?? '',
      });
      setErrors({});
    }
  }, [open, user]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = user ? adminUpdateUserSchema.safeParse(form) : adminCreateUserSchema.safeParse(form);
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    try {
      await api(user ? `/admin/users/${user.id}` : '/admin/users', { method: user ? 'PATCH' : 'POST', body: parsed.data });
      toast(t('toast.saved'));
      qc.invalidateQueries({ queryKey: ['admin'] });
      qc.invalidateQueries({ queryKey: ['users'] });
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.field) setErrors({ [err.field]: err.message });
      else toast(err instanceof ApiError ? err.message : t('errors.INTERNAL'), 'error');
    }
  }

  const fieldProps = (k: string) => ({
    id: `u-${k}`,
    'aria-invalid': !!errors[k],
    'aria-describedby': errors[k] ? `u-${k}-error` : undefined,
  });
  const err = (k: string) => errors[k] && <p id={`u-${k}-error`} className="field-error">{errors[k]}</p>;

  return (
    <Modal open={open} onOpenChange={(o) => !o && onClose()} title={user ? t('admin.editUser') : t('admin.addUser')}>
      <form onSubmit={submit} noValidate className="space-y-4">
        <div>
          <label htmlFor="u-fullNameAr" className="label">{t('admin.fullName')}</label>
          <input className="field" value={form.fullNameAr} onChange={set('fullNameAr')} {...fieldProps('fullNameAr')} />
          {err('fullNameAr')}
        </div>
        <div>
          <label htmlFor="u-email" className="label">{t('admin.email')}</label>
          <input type="email" dir="ltr" className="field text-start" value={form.email} onChange={set('email')} {...fieldProps('email')} />
          {err('email')}
        </div>
        <div>
          <label htmlFor="u-password" className="label">{t('admin.password')}</label>
          <input type="password" dir="ltr" autoComplete="new-password" className="field text-start" value={form.password} onChange={set('password')} {...fieldProps('password')} />
          {user && <p className="mt-1 text-xs text-ink-muted">{t('admin.passwordHintEdit')}</p>}
          {err('password')}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="u-role" className="label">{t('admin.role')}</label>
            <select className="field" value={form.role} onChange={set('role')} {...fieldProps('role')}>
              {ROLES.map((r) => (
                <option key={r} value={r}>{t(`role.${r}`)}</option>
              ))}
            </select>
            {err('role')}
          </div>
          <div>
            <label htmlFor="u-departmentId" className="label">{t('admin.department')}</label>
            <select className="field" value={form.departmentId} onChange={set('departmentId')} {...fieldProps('departmentId')}>
              <option value="">—</option>
              {depts.data?.map((d) => (
                <option key={d.id} value={d.id}>{d.nameAr}</option>
              ))}
            </select>
            {err('departmentId')}
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <button type="button" className="btn-secondary" onClick={onClose}>{t('admin.cancel')}</button>
          <button type="submit" className="btn-primary">{t('admin.save')}</button>
        </div>
      </form>
    </Modal>
  );
}
