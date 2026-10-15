'use client';
// FR-32: إدارة الإدارات — الاسم والمدير
import { useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { t } from '@/lib/i18n';
import { adminDepartmentSchema, fieldErrors } from '@/lib/schemas';
import { Modal } from '../ui/Dialog';
import { SkeletonRows } from '../ui/Skeleton';
import { useToast } from '../ui/Toast';
import { type AdminDepartment, useAdminDepartments, useAdminUsers } from './useAdmin';

export function DepartmentsAdmin() {
  const depts = useAdminDepartments();
  const [editing, setEditing] = useState<AdminDepartment | null | 'new'>(null);
  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
        <h1 className="text-xl font-semibold">{t('admin.departments')}</h1>
        <button type="button" className="btn-primary" onClick={() => setEditing('new')}>
          <Plus size={16} aria-hidden /> {t('admin.addDepartment')}
        </button>
      </div>
      {depts.isLoading ? (
        <SkeletonRows />
      ) : (
        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-border text-ink-muted">
                {['departmentName', 'manager', 'usersCount', 'actions'].map((k) => (
                  <th key={k} scope="col" className="px-4 py-3 text-start font-medium">{t(`admin.${k}`)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {depts.data?.map((d) => (
                <tr key={d.id} className="border-b border-border/70">
                  <td className="px-4 py-2 font-medium">{d.nameAr}</td>
                  <td className="px-4 py-2">{d.manager?.fullNameAr ?? <span className="text-ink-muted">{t('admin.noManager')}</span>}</td>
                  <td className="px-4 py-2 tabular-nums">{d.usersCount}</td>
                  <td className="px-4 py-2">
                    <button type="button" className="btn-icon" onClick={() => setEditing(d)} aria-label={t('admin.edit', { name: d.nameAr })}>
                      <Pencil size={16} aria-hidden />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <DepartmentDialog dept={editing === 'new' ? null : editing} open={editing !== null} onClose={() => setEditing(null)} />
    </section>
  );
}

function DepartmentDialog({ dept, open, onClose }: { dept: AdminDepartment | null; open: boolean; onClose: () => void }) {
  const users = useAdminUsers();
  const qc = useQueryClient();
  const toast = useToast();
  const [nameAr, setNameAr] = useState('');
  const [managerId, setManagerId] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setNameAr(dept?.nameAr ?? '');
      setManagerId(dept?.manager?.id ?? '');
      setErrors({});
    }
  }, [open, dept]);

  // المدير من موظفي الإدارة النشطين
  const candidates = users.data?.filter((u) => u.isActive && dept && u.departmentId === dept.id) ?? [];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = adminDepartmentSchema.safeParse({ nameAr, managerId: managerId || null });
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    try {
      await api(dept ? `/admin/departments/${dept.id}` : '/admin/departments', { method: dept ? 'PATCH' : 'POST', body: parsed.data });
      toast(t('toast.saved'));
      qc.invalidateQueries({ queryKey: ['admin'] });
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.field) setErrors({ [err.field]: err.message });
      else toast(err instanceof ApiError ? err.message : t('errors.INTERNAL'), 'error');
    }
  }

  return (
    <Modal open={open} onOpenChange={(o) => !o && onClose()} title={dept ? t('admin.editDepartment') : t('admin.addDepartment')} size="sm">
      <form onSubmit={submit} noValidate className="space-y-4">
        <div>
          <label htmlFor="d-name" className="label">{t('admin.departmentName')}</label>
          <input id="d-name" className="field" value={nameAr} onChange={(e) => setNameAr(e.target.value)} aria-invalid={!!errors.nameAr} aria-describedby={errors.nameAr ? 'd-name-error' : undefined} />
          {errors.nameAr && <p id="d-name-error" className="field-error">{errors.nameAr}</p>}
        </div>
        {dept && (
          <div>
            <label htmlFor="d-manager" className="label">{t('admin.manager')}</label>
            <select id="d-manager" className="field" value={managerId} onChange={(e) => setManagerId(e.target.value)} aria-invalid={!!errors.managerId} aria-describedby={errors.managerId ? 'd-manager-error' : undefined}>
              <option value="">{t('admin.noManager')}</option>
              {candidates.map((u) => (
                <option key={u.id} value={u.id}>{u.fullNameAr}</option>
              ))}
            </select>
            {errors.managerId && <p id="d-manager-error" className="field-error">{errors.managerId}</p>}
          </div>
        )}
        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <button type="button" className="btn-secondary" onClick={onClose}>{t('admin.cancel')}</button>
          <button type="submit" className="btn-primary">{t('admin.save')}</button>
        </div>
      </form>
    </Modal>
  );
}
