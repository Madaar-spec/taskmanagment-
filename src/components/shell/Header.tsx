'use client';
// الشريط العلوي: الشعار، «إدارة المهام»، جرس التنبيهات، المستخدم (FR-02، FR-27، FR-28)
import * as Menu from '@radix-ui/react-dropdown-menu';
import * as Popover from '@radix-ui/react-popover';
import { useQueryClient } from '@tanstack/react-query';
import { Bell, ChevronDown, Inbox, LogOut, Settings, Users } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/dates';
import { t } from '@/lib/i18n';
import { initialOf } from '@/lib/taskRules';
import { useBell, useNotifications } from '../hooks';
import { useSession } from './AppProviders';
import { Logo } from './Logo';

export function Header() {
  const { user } = useSession();
  const router = useRouter();
  const bell = useBell();
  const overdue = bell.data?.bell ?? 0;

  async function logout() {
    await api('/auth/logout', { method: 'POST' }).catch(() => {});
    router.replace('/login?out=1');
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-header">
      <div className="flex h-16 items-center gap-2 px-3 sm:gap-4 sm:px-6">
        <Link href="/tasks" className="shrink-0 rounded-field">
          <Logo />
        </Link>
        <span aria-hidden className="hidden h-7 w-px bg-border-strong sm:block" />
        <p className="truncate text-base font-semibold sm:text-lg">{t('app.moduleTitle')}</p>
        <div className="ms-auto flex items-center gap-1 sm:gap-2">
          {/* FR-27: جرس بعدد المتأخرة ينقل إلى قائمة «المتأخرة» */}
          <Link
            href="/tasks?view=overdue"
            className="btn-icon relative"
            aria-label={t('notifications.bell', { n: overdue })}
            data-testid="bell"
          >
            <Bell size={20} aria-hidden />
            {overdue > 0 && (
              <span
                aria-hidden
                data-testid="bell-count"
                className="absolute end-1 top-1 min-w-5 rounded-pill bg-danger px-1 text-center text-[11px] font-bold leading-5 text-header"
              >
                {overdue}
              </span>
            )}
          </Link>
          <NotificationsPopover />
          <Menu.Root dir="rtl">
            <Menu.Trigger
              className="flex min-h-touch items-center gap-2 rounded-pill px-1.5 hover:bg-surface sm:pe-3"
              aria-label={t('user.menu', { name: user.fullNameAr })}
              data-testid="user-menu"
            >
              <span
                aria-hidden
                className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-base font-bold"
              >
                {initialOf(user.fullNameAr)}
              </span>
              <span className="hidden text-start leading-tight md:block">
                <span className="block text-sm font-medium">{user.fullNameAr}</span>
                <span className="block text-xs text-ink-muted">{user.departmentName}</span>
              </span>
              <ChevronDown size={16} aria-hidden className="hidden text-ink-muted md:block" />
            </Menu.Trigger>
            <Menu.Portal>
              <Menu.Content
                align="end"
                sideOffset={6}
                className="z-50 min-w-56 rounded-card border border-border bg-surface-2 p-1.5 shadow-xl"
              >
                <div className="px-3 py-2 md:hidden">
                  <p className="text-sm font-medium">{user.fullNameAr}</p>
                  <p className="text-xs text-ink-muted">{user.departmentName}</p>
                </div>
                <p className="px-3 pb-1 pt-1 text-xs text-ink-muted">{t(`role.${user.role}`)}</p>
                {user.role === 'ADMIN' && (
                  <>
                    <Menu.Item asChild>
                      <Link href="/admin/users" className="menu-item flex min-h-touch items-center gap-2 rounded-field px-3 outline-none data-[highlighted]:bg-surface">
                        <Users size={16} aria-hidden /> {t('admin.users')}
                      </Link>
                    </Menu.Item>
                    <Menu.Item asChild>
                      <Link href="/admin/departments" className="flex min-h-touch items-center gap-2 rounded-field px-3 outline-none data-[highlighted]:bg-surface">
                        <Settings size={16} aria-hidden /> {t('admin.departments')}
                      </Link>
                    </Menu.Item>
                    <Menu.Separator className="my-1 h-px bg-border" />
                  </>
                )}
                <Menu.Item
                  onSelect={logout}
                  className="flex min-h-touch cursor-pointer items-center gap-2 rounded-field px-3 text-danger outline-none data-[highlighted]:bg-surface"
                >
                  <LogOut size={16} aria-hidden /> {t('auth.logout')}
                </Menu.Item>
              </Menu.Content>
            </Menu.Portal>
          </Menu.Root>
        </div>
      </div>
    </header>
  );
}

function NotificationsPopover() {
  const { data } = useNotifications();
  const qc = useQueryClient();
  const router = useRouter();
  const unread = data?.unread ?? 0;

  async function open(id: string, code: string, isRead: boolean) {
    if (!isRead) {
      await api(`/notifications/${id}/read`, { method: 'POST' }).catch(() => {});
      qc.invalidateQueries({ queryKey: ['notifications'] });
    }
    router.push(`/tasks?task=${code}`);
  }

  return (
    <Popover.Root>
      <Popover.Trigger className="btn-icon relative" aria-label={t('notifications.inbox', { n: unread })}>
        <Inbox size={20} aria-hidden />
        {unread > 0 && <span aria-hidden className="absolute end-2 top-2 h-2.5 w-2.5 rounded-full bg-accent" />}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          dir="rtl"
          align="end"
          sideOffset={6}
          className="z-50 w-[min(22rem,calc(100vw-1.5rem))] rounded-card border border-border bg-surface-2 p-2 shadow-xl"
        >
          <p className="section-title px-2 py-1.5">{t('notifications.title')}</p>
          {!data?.items.length ? (
            <p className="px-2 py-4 text-sm text-ink-muted">{t('notifications.empty')}</p>
          ) : (
            <ul className="max-h-96 overflow-y-auto">
              {data.items.map((n) => (
                <li key={n.id}>
                  <Popover.Close asChild>
                    <button
                      type="button"
                      onClick={() => open(n.id, n.taskCode, !!n.readAt)}
                      className="flex w-full items-start gap-2 rounded-field px-2 py-2 text-start hover:bg-surface"
                    >
                      <span
                        aria-hidden
                        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.readAt ? 'bg-transparent' : 'bg-accent'}`}
                      />
                      <span>
                        <span className="block text-sm">{n.messageAr}</span>
                        <span className="block text-xs text-ink-muted">{formatDateTime(n.createdAt)}</span>
                      </span>
                    </button>
                  </Popover.Close>
                </li>
              ))}
            </ul>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
