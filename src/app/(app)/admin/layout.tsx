import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { AdminNav } from '@/components/admin/AdminNav';
import { userFromToken } from '@/server/auth/currentUser';
import { SESSION_COOKIE } from '@/server/auth/session';

// FR-31، FR-32: لـ ADMIN فقط (والواجهات الخلفية تفرض ذلك أيضاً)
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await userFromToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (user?.role !== 'ADMIN') notFound();
  return (
    <div className="mx-auto max-w-6xl space-y-4 p-3 sm:p-6">
      <AdminNav />
      <main id="main" tabIndex={-1}>
        {children}
      </main>
    </div>
  );
}
