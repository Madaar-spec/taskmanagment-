import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/server/db';
import * as loginRoute from '@/app/api/v1/auth/login/route';
import * as logoutRoute from '@/app/api/v1/auth/logout/route';
import * as meRoute from '@/app/api/v1/me/route';
import * as tasksRoute from '@/app/api/v1/tasks/route';
import * as statsRoute from '@/app/api/v1/tasks/stats/route';
import * as taskRoute from '@/app/api/v1/tasks/[code]/route';
import * as transitionRoute from '@/app/api/v1/tasks/[code]/transition/route';
import * as subtasksRoute from '@/app/api/v1/tasks/[code]/subtasks/route';
import * as subtaskRoute from '@/app/api/v1/subtasks/[id]/route';
import * as commentsRoute from '@/app/api/v1/tasks/[code]/comments/route';
import * as attachmentsRoute from '@/app/api/v1/tasks/[code]/attachments/route';
import * as attachmentRoute from '@/app/api/v1/attachments/[id]/route';
import * as notificationsRoute from '@/app/api/v1/notifications/route';
import * as readRoute from '@/app/api/v1/notifications/[id]/read/route';
import * as usersRoute from '@/app/api/v1/users/route';
import * as adminUsersRoute from '@/app/api/v1/admin/users/route';
import * as adminUserRoute from '@/app/api/v1/admin/users/[id]/route';
import * as adminDeptsRoute from '@/app/api/v1/admin/departments/route';
import * as adminDeptRoute from '@/app/api/v1/admin/departments/[id]/route';
import { SEED_PASSWORD } from '../../prisma/seedData';
import { as, ctx, request, resetDb } from '../helpers';

beforeEach(async () => {
  await resetDb();
});

const body = async (res: Response) => (await res.json()) as Record<string, any>;

describe('المصادقة FR-01 / FR-03 / NFR-02', () => {
  it('FR-01 الدخول الصحيح يضبط ملف تعريف HttpOnly وSameSite=Lax', async () => {
    const res = await loginRoute.POST(await request(null, 'POST', '/auth/login', { email: 'SARA@madaar.test', password: SEED_PASSWORD }));
    expect(res.status).toBe(200);
    const cookie = res.headers.get('set-cookie')!;
    expect(cookie).toMatch(/madaar_session=/);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Lax/);
    expect(cookie).toMatch(/Max-Age=1800/);
    expect((await body(res)).user.fullNameAr).toBe('سارة القحطاني');
  });
  it('FR-01 بيانات خاطئة ← 401 برسالة عربية', async () => {
    const res = await loginRoute.POST(await request(null, 'POST', '/auth/login', { email: 'sara@madaar.test', password: 'wrong-pass' }));
    expect(res.status).toBe(401);
    expect((await body(res)).error.message).toBe('البريد الإلكتروني أو كلمة المرور غير صحيحة');
  });
  it('FR-01 المستخدم المعطّل لا يدخل', async () => {
    await prisma.user.update({ where: { email: 'sara@madaar.test' }, data: { isActive: false } });
    const res = await loginRoute.POST(await request(null, 'POST', '/auth/login', { email: 'sara@madaar.test', password: SEED_PASSWORD }));
    expect(res.status).toBe(401);
    // الجلسة القائمة لمستخدم معطّل تُرفض أيضاً
    expect((await meRoute.GET(await request('sara', 'GET', '/me'), ctx())).status).toBe(401);
  });
  it('NFR-02 تحديد المحاولات: 5 محاولات فاشلة خلال 15 دقيقة ← 429', async () => {
    for (let i = 0; i < 5; i++) {
      await loginRoute.POST(await request(null, 'POST', '/auth/login', { email: 'noura@madaar.test', password: 'bad-password' }));
    }
    const res = await loginRoute.POST(await request(null, 'POST', '/auth/login', { email: 'noura@madaar.test', password: SEED_PASSWORD }));
    expect(res.status).toBe(429);
    expect((await body(res)).error.code).toBe('RATE_LIMITED');
  });
  it('مدخلات الدخول غير الصالحة ← 400', async () => {
    const res = await loginRoute.POST(await request(null, 'POST', '/auth/login', { email: 'x', password: '' }));
    expect(res.status).toBe(400);
    expect((await body(res)).error.field).toBe('email');
    const bad = await loginRoute.POST(new Request('http://localhost/api/v1/auth/login', { method: 'POST', body: '{bad' }));
    expect(bad.status).toBe(400);
  });
  it('FR-03 تسجيل الخروج يمسح ملف التعريف', async () => {
    const res = await logoutRoute.POST(await request('sara', 'POST', '/auth/logout'));
    expect(res.headers.get('set-cookie')).toMatch(/Max-Age=0/);
  });
  it('FR-02 /me يُرجِع الاسم والإدارة والدور وتاريخ اليوم', async () => {
    const res = await meRoute.GET(await request('sara', 'GET', '/me'), ctx());
    expect(await body(res)).toMatchObject({
      user: { fullNameAr: 'سارة القحطاني', departmentName: 'إدارة التحول الرقمي', role: 'EMPLOYEE' },
      today: '2026-10-15',
    });
  });
  it('401 بلا جلسة أو بجلسة مزوّرة', async () => {
    expect((await tasksRoute.GET(await request(null, 'GET', '/tasks'), ctx())).status).toBe(401);
    const forged = new Request('http://localhost/api/v1/tasks', { headers: { cookie: 'madaar_session=abc.def.ghi' } });
    const res = await tasksRoute.GET(forged, ctx());
    expect(res.status).toBe(401);
    expect((await body(res)).error).toEqual({ code: 'UNAUTHENTICATED', message: 'يجب تسجيل الدخول أولاً', field: null });
  });
});

describe('واجهات المهام — القسم 7', () => {
  it('GET /tasks قائمة مرقّمة + total بحقول محسوبة', async () => {
    const res = await tasksRoute.GET(await request('admin', 'GET', '/tasks?view=overdue&pageSize=25'), ctx());
    const b = await body(res);
    expect(b.total).toBe(2);
    expect(b.items[0]).toHaveProperty('progress');
    expect(b.items[0]).toHaveProperty('isOverdue', true);
    expect(b.items[0]).toHaveProperty('daysToDue');
  });
  it('GET /tasks معاملات غير صالحة ← 400', async () => {
    expect((await tasksRoute.GET(await request('admin', 'GET', '/tasks?view=bogus'), ctx())).status).toBe(400);
  });
  it('GET /tasks/stats', async () => {
    const b = await body(await statsRoute.GET(await request('sara', 'GET', '/tasks/stats'), ctx()));
    expect(b.sidebar).toMatchObject({ all: 2, overdue: 1 });
  });
  it('POST /tasks ← 201 والخطأ بالشكل الموحّد عند مخالفة قاعدة (422)', async () => {
    const ok = await tasksRoute.POST(await request('sara', 'POST', '/tasks', { title: 'مهمة عبر الواجهة', dueDate: '2026-10-20' }), ctx());
    expect(ok.status).toBe(201);
    expect((await body(ok)).code).toBe('T-1051');
    const bad = await tasksRoute.POST(await request('sara', 'POST', '/tasks', { title: 'مهمة عبر الواجهة', dueDate: '2026-10-01' }), ctx());
    expect(bad.status).toBe(422);
    expect((await body(bad)).error).toEqual({ code: 'BR-03', message: 'تاريخ الاستحقاق لا يمكن أن يكون قبل تاريخ اليوم', field: 'dueDate' });
  });
  it('GET /tasks/:code التفاصيل مع allowedTransitions، و404 خارج النطاق', async () => {
    const res = await taskRoute.GET(await request('noura', 'GET', '/tasks/T-1046'), ctx({ code: 'T-1046' }));
    const b = await body(res);
    expect(b.allowedTransitions.map((t: { to: string }) => t.to).sort()).toEqual(['DONE', 'IN_PROGRESS']);
    expect((await taskRoute.GET(await request('noura', 'GET', '/tasks/T-1042'), ctx({ code: 'T-1042' }))).status).toBe(404);
  });
  it('AC-07 الطلب المباشر لاعتماد الإكمال من موظف ← 403', async () => {
    const res = await transitionRoute.POST(await request('noura', 'POST', '/tasks/T-1046/transition', { to: 'DONE' }), ctx({ code: 'T-1046' }));
    expect(res.status).toBe(403);
    expect((await body(res)).error.code).toBe('BR-07');
  });
  it('AC-06 رسالة BR-06 عبر الواجهة', async () => {
    const res = await transitionRoute.POST(await request('sara', 'POST', '/tasks/T-1041/transition', { to: 'REVIEW' }), ctx({ code: 'T-1041' }));
    expect(res.status).toBe(422);
    expect((await body(res)).error).toEqual({ code: 'BR-06', message: 'يجب إنجاز جميع المهام الفرعية قبل الإرسال للمراجعة', field: null });
  });
  it('PATCH و409 و DELETE', async () => {
    const d = await body(await taskRoute.GET(await request('manager', 'GET', '/tasks/T-1050'), ctx({ code: 'T-1050' })));
    const ok = await taskRoute.PATCH(await request('manager', 'PATCH', '/tasks/T-1050', { priority: 'HIGH', updatedAt: d.updatedAt }), ctx({ code: 'T-1050' }));
    expect(ok.status).toBe(200);
    const stale = await taskRoute.PATCH(await request('manager', 'PATCH', '/tasks/T-1050', { priority: 'LOW', updatedAt: d.updatedAt }), ctx({ code: 'T-1050' }));
    expect(stale.status).toBe(409);
    const status = await taskRoute.PATCH(await request('manager', 'PATCH', '/tasks/T-1050', { status: 'DONE', updatedAt: d.updatedAt }), ctx({ code: 'T-1050' }));
    expect(status.status).toBe(400); // الحالة لا تُعدَّل عبر PATCH
    const del = await taskRoute.DELETE(await request('manager', 'DELETE', '/tasks/T-1050'), ctx({ code: 'T-1050' }));
    expect(del.status).toBe(200);
  });
  it('المهام الفرعية والتعليقات عبر الواجهة', async () => {
    const add = await subtasksRoute.POST(await request('sara', 'POST', '/tasks/T-1048/subtasks', { text: 'بند جديد' }), ctx({ code: 'T-1048' }));
    expect(add.status).toBe(201);
    const s = await body(add);
    const tog = await subtaskRoute.PATCH(await request('sara', 'PATCH', `/subtasks/${s.id}`, { isDone: true }), ctx({ id: s.id }));
    expect((await body(tog)).isDone).toBe(true);
    expect((await subtaskRoute.DELETE(await request('sara', 'DELETE', `/subtasks/${s.id}`), ctx({ id: s.id }))).status).toBe(200);
    const c = await commentsRoute.POST(await request('sara', 'POST', '/tasks/T-1048/comments', { body: 'تعليق' }), ctx({ code: 'T-1048' }));
    expect(c.status).toBe(201);
  });
});

describe('FR-07: المرفقات', () => {
  const upload = async (user: 'sara' | 'khalid', code: string, file: File | null) => {
    const { SESSION_COOKIE, signSession } = await import('@/server/auth/session');
    const u = await as(user);
    const form = new FormData();
    if (file) form.append('file', file);
    return attachmentsRoute.POST(
      new Request(`http://localhost/api/v1/tasks/${code}/attachments`, {
        method: 'POST',
        headers: { cookie: `${SESSION_COOKIE}=${await signSession(u.id)}` },
        body: form,
      }),
      ctx({ code }),
    );
  };
  it('FR-07 رفع وتنزيل ضمن النطاق', async () => {
    const res = await upload('sara', 'T-1041', new File(['محتوى الملف'], 'تقرير.txt', { type: 'text/plain' }));
    expect(res.status).toBe(201);
    const a = await body(res);
    const dl = await attachmentRoute.GET(await request('sara', 'GET', `/attachments/${a.id}`), ctx({ id: a.id }));
    expect(dl.status).toBe(200);
    expect(await dl.text()).toBe('محتوى الملف');
    expect(dl.headers.get('content-disposition')).toContain('attachment');
    // BR-01: خارج النطاق ← 404
    expect((await attachmentRoute.GET(await request('khalid', 'GET', `/attachments/${a.id}`), ctx({ id: a.id }))).status).toBe(404);
  });
  it('FR-07 بلا ملف ← 400، ومهمة خارج النطاق ← 404', async () => {
    expect((await upload('sara', 'T-1041', null)).status).toBe(400);
    expect((await upload('sara', 'T-1042', new File(['x'], 'a.txt'))).status).toBe(404);
  });
  it('FR-07 حد 25 ميجابايت', async () => {
    const big = new File([new Uint8Array(25 * 1024 * 1024 + 1)], 'big.bin');
    const res = await upload('sara', 'T-1041', big);
    expect(res.status).toBe(422);
    expect((await body(res)).error.message).toBe('حجم الملف يجب ألا يزيد على 25 ميجابايت');
  });
});

describe('التنبيهات والمستخدمون', () => {
  it('FR-28 GET /notifications و POST /read', async () => {
    const sara = await as('sara');
    await tasksRoute.POST(
      await request('manager', 'POST', '/tasks', { title: 'مهمة لسارة من المدير', dueDate: '2026-10-20', assigneeId: sara.id }),
      ctx(),
    );
    const list = await body(await notificationsRoute.GET(await request('sara', 'GET', '/notifications'), ctx()));
    expect(list.unread).toBe(1);
    const id = list.items[0].id;
    expect((await readRoute.POST(await request('sara', 'POST', `/notifications/${id}/read`), ctx({ id }))).status).toBe(200);
  });
  it('BR-13 /users يُرجِع من يحق الإسناد إليهم فقط', async () => {
    const names = async (u: 'sara' | 'manager' | 'admin' | 'viewer', qs = '') =>
      ((await body(await usersRoute.GET(await request(u, 'GET', `/users?active=true${qs}`), ctx()))) as unknown as { fullNameAr: string }[]).map(
        (x) => x.fullNameAr,
      );
    expect(await names('sara')).toEqual(['سارة القحطاني']);
    expect(await names('manager')).toHaveLength(6);
    expect(await names('admin')).toHaveLength(10);
    expect(await names('viewer')).toHaveLength(0);
    expect(await names('viewer', '&purpose=filter')).toHaveLength(6);
  });
});

describe('FR-31 / FR-32: الإدارة لـ ADMIN فقط', () => {
  it('غير ADMIN ← 403', async () => {
    expect((await adminUsersRoute.GET(await request('manager', 'GET', '/admin/users'), ctx())).status).toBe(403);
    expect((await adminDeptsRoute.GET(await request('sara', 'GET', '/admin/departments'), ctx())).status).toBe(403);
  });
  it('FR-31 إضافة مستخدم وتعطيله وتغيير دوره وإدارته', async () => {
    const depts = await body(await adminDeptsRoute.GET(await request('admin', 'GET', '/admin/departments'), ctx()));
    const hr = (depts as unknown as { id: string; nameAr: string }[]).find((d) => d.nameAr === 'إدارة الموارد البشرية')!;
    const created = await adminUsersRoute.POST(
      await request('admin', 'POST', '/admin/users', {
        fullNameAr: 'موظف جديد',
        email: 'New.User@madaar.test',
        password: 'Passw0rd!',
        role: 'EMPLOYEE',
        departmentId: hr.id,
      }),
      ctx(),
    );
    expect(created.status).toBe(201);
    const u = await body(created);
    expect(u.email).toBe('new.user@madaar.test');
    const dup = await adminUsersRoute.POST(
      await request('admin', 'POST', '/admin/users', { fullNameAr: 'مكرر', email: 'new.user@madaar.test', password: 'Passw0rd!', role: 'EMPLOYEE', departmentId: hr.id }),
      ctx(),
    );
    expect((await body(dup)).error.message).toBe('البريد الإلكتروني مستخدم مسبقاً');
    const upd = await adminUserRoute.PATCH(await request('admin', 'PATCH', `/admin/users/${u.id}`, { role: 'MANAGER', isActive: false, password: '' }), ctx({ id: u.id }));
    expect(await body(upd)).toMatchObject({ role: 'MANAGER', isActive: false });
    const admin = await as('admin');
    const self = await adminUserRoute.PATCH(await request('admin', 'PATCH', `/admin/users/${admin.id}`, { isActive: false }), ctx({ id: admin.id }));
    expect(self.status).toBe(400);
    const missing = '00000000-0000-0000-0000-000000000000';
    expect((await adminUserRoute.PATCH(await request('admin', 'PATCH', `/admin/users/${missing}`, { role: 'VIEWER' }), ctx({ id: missing }))).status).toBe(404);
  });
  it('FR-32 إضافة إدارة وتعديل اسمها ومديرها', async () => {
    const res = await adminDeptsRoute.POST(await request('admin', 'POST', '/admin/departments', { nameAr: 'إدارة الشؤون القانونية', managerId: '' }), ctx());
    expect(res.status).toBe(201);
    const d = await body(res);
    const dup = await adminDeptsRoute.POST(await request('admin', 'POST', '/admin/departments', { nameAr: 'إدارة الشؤون القانونية' }), ctx());
    expect((await body(dup)).error.message).toBe('اسم الإدارة مستخدم مسبقاً');
    const renamed = await adminDeptRoute.PATCH(await request('admin', 'PATCH', `/admin/departments/${d.id}`, { nameAr: 'الإدارة القانونية' }), ctx({ id: d.id }));
    expect((await body(renamed)).nameAr).toBe('الإدارة القانونية');
    // المدير يجب أن يكون من موظفي الإدارة
    const sara = await as('sara');
    const badMgr = await adminDeptRoute.PATCH(await request('admin', 'PATCH', `/admin/departments/${d.id}`, { managerId: sara.id }), ctx({ id: d.id }));
    expect(badMgr.status).toBe(400);
    const okMgr = await adminDeptRoute.PATCH(await request('admin', 'PATCH', `/admin/departments/${sara.departmentId}`, { managerId: sara.id }), ctx({ id: sara.departmentId }));
    expect(okMgr.status).toBe(200);
  });
});
