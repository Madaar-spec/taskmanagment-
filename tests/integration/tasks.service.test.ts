import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/server/db';
import {
  createTask,
  deleteTask,
  getStats,
  getTask,
  listTasks,
  transitionTask,
  updateTask,
} from '@/server/services/tasks';
import { addSubtask, deleteSubtask, updateSubtask } from '@/server/services/subtasks';
import { addComment } from '@/server/services/comments';
import { listNotifications, markNotificationRead } from '@/server/services/notifications';
import { as, expectAppError, resetDb, TODAY } from '../helpers';

beforeEach(async () => {
  await resetDb();
});

const codes = (r: { items: { code: string }[] }) => r.items.map((i) => i.code).sort();

describe('BR-01: نطاق الرؤية', () => {
  it('BR-01 / AC-01 الموظف يرى ما أُسند إليه أو أنشأه فقط', async () => {
    const sara = await as('sara');
    expect(codes(await listTasks(sara, {}, TODAY))).toEqual(['T-1041', 'T-1048']);
    const stats = await getStats(sara, {}, TODAY);
    // AC-01: المؤشرات محسوبة من مهامه فقط
    expect(stats.kpi).toMatchObject({ total: 2, new: 1, active: 1, overdue: 1, done: 0 });
    expect(stats.sidebar).toMatchObject({ all: 2, mine: 2, overdue: 1, done: 0 });
  });
  it('BR-01 المدير والمستعرض يريان مهام إدارتهم (إدارة المسؤول)', async () => {
    const expected = ['T-1041', 'T-1043', 'T-1046', 'T-1048', 'T-1049', 'T-1050'];
    expect(codes(await listTasks(await as('manager'), { pageSize: 100 }, TODAY))).toEqual(expected);
    expect(codes(await listTasks(await as('viewer'), { pageSize: 100 }, TODAY))).toEqual(expected);
  });
  it('BR-01 مسؤول النظام يرى كل المهام', async () => {
    const r = await listTasks(await as('admin'), {}, TODAY);
    expect(r.total).toBe(10);
  });
  it('BR-01 المهمة خارج النطاق تُرجِع 404 في التفاصيل والتعديل والانتقال', async () => {
    const sara = await as('sara');
    await expectAppError(getTask(sara, 'T-1042', TODAY), 404, 'NOT_FOUND');
    await expectAppError(transitionTask(sara, 'T-1042', { to: 'DONE' }), 404);
    await expectAppError(addComment(sara, 'T-1042', { body: 'تعليق' }), 404);
    await expectAppError(getTask(await as('manager'), 'T-1042', TODAY), 404);
  });
  it('BR-01 البحث يحترم النطاق', async () => {
    const sara = await as('sara');
    expect((await listTasks(sara, { q: 'REQ-2026-0318' }, TODAY)).total).toBe(0);
  });
});

describe('FR-15..FR-22: القائمة والبحث والتصفية والفرز', () => {
  it('BR-04 / AC-04 الحقول المحسوبة للمهمة المتأخرة', async () => {
    const r = await listTasks(await as('admin'), { q: 'T-1041' }, TODAY);
    expect(r.items[0]).toMatchObject({ code: 'T-1041', isOverdue: true, daysToDue: -2, progress: 33 });
  });
  it('FR-18 / AC-11 البحث برقم الطلب يُظهر T-1042 فقط والعدّادات تتحدّث', async () => {
    const admin = await as('admin');
    const r = await listTasks(admin, { q: 'REQ-2026-0318' }, TODAY);
    expect(codes(r)).toEqual(['T-1042']);
    const s = await getStats(admin, { q: 'REQ-2026-0318' }, TODAY);
    expect(s.kpi.total).toBe(1);
    expect(s.byStatus.REVIEW).toBe(1);
  });
  it('FR-18 البحث في العنوان واسم المسؤول واسم الإدارة ورقم المهمة', async () => {
    const admin = await as('admin');
    expect(codes(await listTasks(admin, { q: 'عقد صيانة' }, TODAY))).toEqual(['T-1045']);
    expect(codes(await listTasks(admin, { q: 'خالد' }, TODAY))).toEqual(['T-1042']);
    expect(codes(await listTasks(admin, { q: 'الموارد البشرية' }, TODAY))).toEqual(['T-1042', 'T-1044']);
    expect(codes(await listTasks(admin, { q: 't-1050' }, TODAY))).toEqual(['T-1050']);
  });
  it('FR-19 التصفية حسب الحالة والأولوية والمسؤول ونطاق الاستحقاق', async () => {
    const admin = await as('admin');
    const noura = await as('noura');
    expect(codes(await listTasks(admin, { status: 'REVIEW' }, TODAY))).toEqual(['T-1042', 'T-1046']);
    expect(codes(await listTasks(admin, { priority: 'LOW' }, TODAY))).toEqual(['T-1047', 'T-1050']);
    expect(codes(await listTasks(admin, { assigneeId: noura.id }, TODAY))).toEqual(['T-1046', 'T-1050']);
    expect(codes(await listTasks(admin, { dueFrom: '2026-10-15', dueTo: '2026-10-17' }, TODAY))).toEqual([
      'T-1043',
      'T-1046',
      'T-1048',
    ]);
  });
  it('FR-20 القوائم الجاهزة: مهامي والمتأخرة والمكتملة', async () => {
    const mohammed = await as('mohammed');
    const admin = await as('admin');
    expect(codes(await listTasks(mohammed, { view: 'mine' }, TODAY))).toEqual(['T-1043', 'T-1049']);
    expect(codes(await listTasks(admin, { view: 'overdue' }, TODAY))).toEqual(['T-1041', 'T-1047']);
    expect(codes(await listTasks(admin, { view: 'done' }, TODAY))).toEqual(['T-1045', 'T-1049']);
  });
  it('FR-21 الفرز الافتراضي: المتأخرة أولاً ثم الأقرب استحقاقاً والمكتملة آخراً', async () => {
    const r = await listTasks(await as('admin'), {}, TODAY);
    expect(r.items.map((i) => i.code)).toEqual([
      'T-1047', // متأخرة 4 أيام
      'T-1041', // متأخرة يومين
      'T-1048', // اليوم
      'T-1046',
      'T-1043',
      'T-1042',
      'T-1044',
      'T-1050',
      'T-1049', // مكتملة (الأحدث إكمالاً)
      'T-1045',
    ]);
  });
  it('FR-21 الفرز حسب أي عمود', async () => {
    const admin = await as('admin');
    const first = async (sort: string) => (await listTasks(admin, { sort }, TODAY)).items[0]?.code;
    expect(await first('code')).toBe('T-1045'); // الأقدم إنشاءً
    expect(await first('-dueDate')).toBe('T-1050');
    expect(await first('priority')).toMatch(/T-10(41|43|45|46)/);
    expect(await first('-progress')).toMatch(/T-1045|T-1049|T-1042|T-1046/);
    expect(await first('progress')).toBe('T-1048'); // 0% وأقرب استحقاقاً
    expect((await listTasks(admin, { sort: 'assignee' }, TODAY)).items).toHaveLength(10);
    expect((await listTasks(admin, { sort: '-title' }, TODAY)).items).toHaveLength(10);
    expect((await listTasks(admin, { sort: 'status' }, TODAY)).items[0]?.status).toBe('NEW');
  });
  it('FR-22 ترقيم الصفحات', async () => {
    const admin = await as('admin');
    const p1 = await listTasks(admin, { pageSize: 4, page: 1 }, TODAY);
    const p3 = await listTasks(admin, { pageSize: 4, page: 3 }, TODAY);
    expect(p1.items).toHaveLength(4);
    expect(p3.items).toHaveLength(2);
    expect(p1.total).toBe(10);
    const pp = await listTasks(admin, { pageSize: 4, page: 3, sort: 'progress' }, TODAY);
    expect(pp.items).toHaveLength(2);
  });
});

describe('FR-25 / BR-16: المؤشرات', () => {
  it('FR-25 بطاقات المؤشرات للمسؤول', async () => {
    const s = await getStats(await as('admin'), {}, TODAY);
    expect(s.kpi).toEqual({
      total: 10,
      new: 3,
      active: 5,
      review: 2,
      overdue: 2,
      dueSoon: 3, // T-1048 (اليوم)، T-1046 (غداً)، T-1043 (بعد يومين)
      done: 2,
      completionRate: 20,
    });
    expect(s.bell).toBe(2);
    expect(s.sidebar.completionRate).toBe(20);
  });
  it('FR-26 شرائح الحالة تتجاهل تصفية الحالة نفسها', async () => {
    const s = await getStats(await as('admin'), { status: 'DONE' }, TODAY);
    expect(s.byStatus).toEqual({ NEW: 3, IN_PROGRESS: 3, REVIEW: 2, DONE: 2 });
  });
});

describe('FR-04 / BR-02 / BR-03 / BR-11 / BR-12 / BR-13: إنشاء المهام', () => {
  it('BR-02 / BR-11 / AC-03 القيم الافتراضية والرقم التالي ونشاط CREATED', async () => {
    const sara = await as('sara');
    const { code } = await createTask(sara, { title: 'مهمة اختبار جديدة', dueDate: '2026-10-20' }, TODAY);
    expect(code).toBe('T-1051');
    const d = await getTask(sara, code, TODAY);
    expect(d).toMatchObject({ status: 'NEW', priority: 'MEDIUM', assignee: { id: sara.id }, progress: 0 });
    expect(d.department.id).toBe(sara.departmentId);
    expect(d.activities.map((a) => a.type)).toEqual(['CREATED']);
    const next = await createTask(sara, { title: 'مهمة اختبار ثانية', dueDate: TODAY }, TODAY);
    expect(next.code).toBe('T-1052');
  });
  it('BR-11 الرقم لا يُعاد استخدامه بعد الحذف', async () => {
    const manager = await as('manager');
    const a = await createTask(manager, { title: 'مهمة ستُحذف لاحقاً', dueDate: TODAY }, TODAY);
    await deleteTask(manager, a.code);
    const b = await createTask(manager, { title: 'مهمة بعد الحذف', dueDate: TODAY }, TODAY);
    expect(b.code).not.toBe(a.code);
    expect(Number(b.code.slice(2))).toBe(Number(a.code.slice(2)) + 1);
  });
  it('BR-03 تاريخ استحقاق في الماضي ← 422', async () => {
    await expectAppError(createTask(await as('sara'), { title: 'مهمة متأخرة', dueDate: '2026-10-14' }, TODAY), 422, 'BR-03');
  });
  it('BR-12 رقم الطلب بصيغة خاطئة ← 422', async () => {
    await expectAppError(
      createTask(await as('sara'), { title: 'مهمة برقم طلب', dueDate: TODAY, requestRef: 'REQ-1' }, TODAY),
      422,
      'BR-12',
    );
  });
  it('BR-17 / AC-02 بلا عنوان ← خطأ برسالة الحقل ولا تُنشأ', async () => {
    const err = (await expectAppError(createTask(await as('sara'), { title: '', dueDate: TODAY }, TODAY), 422, 'BR-17')) as {
      message: string;
      field: string;
    };
    expect(err.message).toBe('يرجى إدخال عنوان المهمة');
    expect(err.field).toBe('title');
    expect(await prisma.task.count()).toBe(10);
  });
  it('BR-13 الموظف يُسند لنفسه فقط', async () => {
    const sara = await as('sara');
    const mohammed = await as('mohammed');
    await expectAppError(
      createTask(sara, { title: 'إسناد لزميل', dueDate: TODAY, assigneeId: mohammed.id }, TODAY),
      422,
      'BR-13',
    );
  });
  it('BR-13 المدير يُسند داخل إدارته فقط، والمسؤول نشط', async () => {
    const manager = await as('manager');
    const khalid = await as('khalid');
    const noura = await as('noura');
    await expectAppError(
      createTask(manager, { title: 'إسناد خارج الإدارة', dueDate: TODAY, assigneeId: khalid.id }, TODAY),
      422,
      'BR-13',
    );
    await prisma.user.update({ where: { id: noura.id }, data: { isActive: false } });
    await expectAppError(
      createTask(manager, { title: 'إسناد لمعطّل', dueDate: TODAY, assigneeId: noura.id }, TODAY),
      422,
      'BR-13',
    );
  });
  it('BR-13 / FR-28 الإسناد يُشعر المسؤول، والمهام الفرعية تُنشأ مرتبة', async () => {
    const manager = await as('manager');
    const sara = await as('sara');
    const { code } = await createTask(
      manager,
      { title: 'مهمة مسندة لسارة', dueDate: TODAY, assigneeId: sara.id, priority: 'HIGH', subtasks: ['أولى', 'ثانية'] },
      TODAY,
    );
    const d = await getTask(sara, code, TODAY);
    expect(d.subtasks.map((s) => [s.text, s.sortOrder])).toEqual([
      ['أولى', 1],
      ['ثانية', 2],
    ]);
    const n = await listNotifications(sara);
    expect(n.unread).toBe(1);
    expect(n.items[0]?.messageAr).toContain(code);
    await markNotificationRead(sara, n.items[0]!.id);
    expect((await listNotifications(sara)).unread).toBe(0);
    await expectAppError(markNotificationRead(await as('khalid'), n.items[0]!.id), 404);
  });
  it('المستعرض لا ينشئ (403)', async () => {
    await expectAppError(createTask(await as('viewer'), { title: 'مهمة مستعرض', dueDate: TODAY }, TODAY), 403);
  });
  it('مسؤول النظام يُسند لأي مستخدم، وإدارة المهمة = إدارة المسؤول', async () => {
    const khalid = await as('khalid');
    const { code } = await createTask(
      await as('admin'),
      { title: 'مهمة للموارد البشرية', dueDate: TODAY, assigneeId: khalid.id },
      TODAY,
    );
    expect((await getTask(khalid, code, TODAY)).department.id).toBe(khalid.departmentId);
  });
});

describe('FR-13 / BR-10: التعديل', () => {
  it('FR-11 / FR-13 تعديل البيانات وتسجيل التغييرات بالقيم القديمة والجديدة', async () => {
    const manager = await as('manager');
    const noura = await as('noura');
    const d = await getTask(manager, 'T-1043', TODAY);
    const r = await updateTask(
      manager,
      'T-1043',
      {
        title: 'تقرير مؤشرات الأداء المحدّث',
        description: 'وصف جديد',
        priority: 'LOW',
        dueDate: '2026-10-25',
        assigneeId: noura.id,
        requestRef: 'REQ-2026-0999',
        updatedAt: d.updatedAt,
      },
      TODAY,
    );
    expect(r.updatedAt).not.toBe(d.updatedAt);
    const after = await getTask(manager, 'T-1043', TODAY);
    expect(after).toMatchObject({ title: 'تقرير مؤشرات الأداء المحدّث', priority: 'LOW', dueDate: '2026-10-25', requestRef: 'REQ-2026-0999' });
    const types = after.activities.map((a) => a.type);
    expect(types).toEqual(expect.arrayContaining(['PRIORITY_CHANGED', 'DUE_CHANGED', 'ASSIGNEE_CHANGED']));
    const assign = after.activities.find((a) => a.type === 'ASSIGNEE_CHANGED')!;
    expect(assign.oldValue).toMatchObject({ name: 'محمد العتيبي' });
    expect(assign.newValue).toMatchObject({ name: 'نورة الدوسري' });
    // BR-13: تغيير المسؤول يُشعر المسؤول الجديد
    expect((await listNotifications(noura)).items.some((n) => n.messageAr.includes('T-1043'))).toBe(true);
  });
  it('409 تعارض التحديث عند اختلاف updatedAt', async () => {
    const manager = await as('manager');
    await expectAppError(
      updateTask(manager, 'T-1043', { title: 'عنوان متعارض', updatedAt: '2020-01-01T00:00:00.000Z' }, TODAY),
      409,
      'CONFLICT',
    );
  });
  it('تعديل بلا تغيير لا يُنشئ نشاطاً', async () => {
    const manager = await as('manager');
    const d = await getTask(manager, 'T-1043', TODAY);
    const r = await updateTask(manager, 'T-1043', { title: d.title, updatedAt: d.updatedAt }, TODAY);
    expect(r.updatedAt).toBe(d.updatedAt);
  });
  it('BR-10 / AC-09 المهمة المكتملة لا تُعدَّل ويُسمح بالتعليق', async () => {
    const manager = await as('manager');
    const d = await getTask(manager, 'T-1049', TODAY);
    expect(d.permissions).toMatchObject({ edit: false, comment: true, subtasks: false });
    await expectAppError(updateTask(manager, 'T-1049', { title: 'عنوان جديد', updatedAt: d.updatedAt }, TODAY), 422, 'BR-10');
    const c = await addComment(manager, 'T-1049', { body: 'تعليق على مهمة مكتملة' });
    expect(c.type).toBe('COMMENT');
  });
  it('BR-03 التعديل بتاريخ ماضٍ ← 422', async () => {
    const manager = await as('manager');
    const d = await getTask(manager, 'T-1043', TODAY);
    await expectAppError(updateTask(manager, 'T-1043', { dueDate: '2026-10-01', updatedAt: d.updatedAt }, TODAY), 422, 'BR-03');
  });
  it('المستعرض والموظف خارج مهامه لا يعدّلان', async () => {
    const viewer = await as('viewer');
    const d = await getTask(viewer, 'T-1043', TODAY);
    expect(d.permissions.edit).toBe(false);
    await expectAppError(updateTask(viewer, 'T-1043', { title: 'عنوان المستعرض', updatedAt: d.updatedAt }, TODAY), 403);
    await expectAppError(updateTask(await as('sara'), 'T-1043', { title: 'عنوان سارة', updatedAt: d.updatedAt }, TODAY), 404);
  });
});

describe('BR-05..BR-09: انتقالات الحالة', () => {
  it('BR-05 / AC-10 انتقال مسموح يُسجَّل في النشاط مع الفاعل', async () => {
    const sara = await as('sara');
    await transitionTask(sara, 'T-1048', { to: 'IN_PROGRESS' });
    const d = await getTask(sara, 'T-1048', TODAY);
    expect(d.status).toBe('IN_PROGRESS');
    const last = d.activities.at(-1)!;
    expect(last).toMatchObject({ type: 'STATUS_CHANGED', actor: { id: sara.id }, newValue: { status: 'IN_PROGRESS' } });
  });
  it('BR-05 / AC-13 من جديدة إلى مكتملة مرفوض وتبقى الحالة', async () => {
    const manager = await as('manager');
    await expectAppError(transitionTask(manager, 'T-1050', { to: 'DONE' }), 422, 'BR-05');
    expect((await getTask(manager, 'T-1050', TODAY)).status).toBe('NEW');
  });
  it('BR-06 / AC-06 المراجعة مع مهام فرعية غير منجزة مرفوضة', async () => {
    const sara = await as('sara');
    await expectAppError(transitionTask(sara, 'T-1041', { to: 'REVIEW' }), 422, 'BR-06');
    expect((await getTask(sara, 'T-1041', TODAY)).status).toBe('IN_PROGRESS');
  });
  it('BR-07 / AC-07 الموظف لا يعتمد الإكمال (403) والزر غير مفعّل', async () => {
    const noura = await as('noura');
    const d = await getTask(noura, 'T-1046', TODAY);
    expect(d.allowedTransitions.find((t) => t.to === 'DONE')?.allowed).toBe(false);
    await expectAppError(transitionTask(noura, 'T-1046', { to: 'DONE' }), 403, 'BR-07');
  });
  it('BR-07 المدير يعتمد ويُسجَّل completed_at وcompleted_by ويُشعَر المنشئ', async () => {
    const admin = await as('admin');
    await transitionTask(admin, 'T-1046', { to: 'DONE' });
    const t = await prisma.task.findUniqueOrThrow({ where: { code: 'T-1046' } });
    expect(t.completedById).toBe(admin.id);
    expect(t.completedAt).toBeInstanceOf(Date);
    const manager = await as('manager');
    expect((await listNotifications(manager)).items[0]?.messageAr).toContain('اكتملت المهمة T-1046');
    expect((await getTask(manager, 'T-1046', TODAY)).progress).toBe(100);
  });
  it('BR-09 / AC-08 الإعادة من المراجعة تتطلب سبباً ثم يُشعَر المسؤول', async () => {
    const manager = await as('manager');
    await expectAppError(transitionTask(manager, 'T-1046', { to: 'IN_PROGRESS' }), 422, 'BR-09');
    await transitionTask(manager, 'T-1046', { to: 'IN_PROGRESS', reason: 'يرجى استكمال متطلبات الأمن' });
    const d = await getTask(manager, 'T-1046', TODAY);
    expect(d.status).toBe('IN_PROGRESS');
    expect(d.activities.at(-1)).toMatchObject({ type: 'STATUS_CHANGED', body: 'يرجى استكمال متطلبات الأمن' });
    const n = await listNotifications(await as('noura'));
    expect(n.items[0]?.messageAr).toContain('أُعيدت المهمة T-1046 من المراجعة');
  });
  it('BR-09 إعادة الفتح للمدير فقط وبسبب، وتُسجَّل REOPENED وتُمسح بيانات الإكمال', async () => {
    const mohammed = await as('mohammed');
    await expectAppError(
      transitionTask(mohammed, 'T-1049', { to: 'IN_PROGRESS', reason: 'أريد التعديل مجدداً' }),
      403,
      'BR-09',
    );
    const manager = await as('manager');
    await transitionTask(manager, 'T-1049', { to: 'IN_PROGRESS', reason: 'ظهرت صلاحيات إضافية' });
    const t = await prisma.task.findUniqueOrThrow({ where: { code: 'T-1049' } });
    expect(t).toMatchObject({ status: 'IN_PROGRESS', completedAt: null, completedById: null });
    const d = await getTask(manager, 'T-1049', TODAY);
    expect(d.activities.at(-1)).toMatchObject({ type: 'REOPENED', body: 'ظهرت صلاحيات إضافية' });
    expect((await listNotifications(mohammed)).items[0]?.messageAr).toContain('أُعيد فتح');
  });
  it('المستعرض لا يغيّر الحالة', async () => {
    await expectAppError(transitionTask(await as('viewer'), 'T-1050', { to: 'IN_PROGRESS' }), 403, 'FORBIDDEN');
  });
});

describe('FR-06 / FR-09 / BR-08: المهام الفرعية', () => {
  it('BR-08 / AC-05 تعليم الثالثة يغيّر التقدم من 50% إلى 75%', async () => {
    const mohammed = await as('mohammed');
    const d = await getTask(mohammed, 'T-1043', TODAY);
    expect(d.progress).toBe(50);
    const third = d.subtasks.find((s) => !s.isDone)!;
    await updateSubtask(mohammed, third.id, { isDone: true });
    expect((await getTask(mohammed, 'T-1043', TODAY)).progress).toBe(75);
    expect((await listTasks(mohammed, { q: 'T-1043' }, TODAY)).items[0]?.progress).toBe(75);
    const act = (await getTask(mohammed, 'T-1043', TODAY)).activities.at(-1)!;
    expect(act).toMatchObject({ type: 'SUBTASK_TOGGLED', newValue: { isDone: true } });
  });
  it('FR-06 إضافة وتعديل وحذف', async () => {
    const sara = await as('sara');
    const s = await addSubtask(sara, 'T-1041', { text: 'مراجعة لغوية' });
    expect(s.sortOrder).toBe(4);
    const u = await updateSubtask(sara, s.id, { text: 'مراجعة لغوية نهائية' });
    expect(u.text).toBe('مراجعة لغوية نهائية');
    await deleteSubtask(sara, s.id);
    expect((await getTask(sara, 'T-1041', TODAY)).subtasks).toHaveLength(3);
  });
  it('BR-17 حد 20 مهمة فرعية', async () => {
    const sara = await as('sara');
    for (let i = 0; i < 17; i++) await addSubtask(sara, 'T-1041', { text: `بند ${i}` });
    await expectAppError(addSubtask(sara, 'T-1041', { text: 'البند 21' }), 422, 'BR-17');
  });
  it('BR-10 المهام الفرعية للمكتملة مقفلة', async () => {
    const admin = await as('admin');
    const d = await getTask(admin, 'T-1045', TODAY);
    await expectAppError(updateSubtask(admin, d.subtasks[0]!.id, { isDone: false }), 422, 'BR-10');
    await expectAppError(addSubtask(admin, 'T-1045', { text: 'بند جديد' }), 422, 'BR-10');
    await expectAppError(deleteSubtask(admin, d.subtasks[0]!.id), 422, 'BR-10');
  });
  it('BR-01 مهمة فرعية خارج النطاق ← 404، والمستعرض ← 403', async () => {
    const admin = await as('admin');
    const d = await getTask(admin, 'T-1042', TODAY);
    await expectAppError(updateSubtask(await as('sara'), d.subtasks[0]!.id, { isDone: false }), 404);
    const m = await getTask(admin, 'T-1043', TODAY);
    await expectAppError(updateSubtask(await as('viewer'), m.subtasks[0]!.id, { isDone: false }), 403);
  });
});

describe('FR-10 / BR-15: التعليقات وسجل النشاط', () => {
  it('FR-12 التعليقات والنشاط في خط زمني واحد تصاعدي', async () => {
    const sara = await as('sara');
    await addComment(sara, 'T-1041', { body: '  أول تعليق  ' });
    await transitionTask(sara, 'T-1048', { to: 'IN_PROGRESS' });
    const d = await getTask(sara, 'T-1041', TODAY);
    const times = d.activities.map((a) => a.createdAt);
    expect([...times].sort()).toEqual(times);
    expect(d.activities.at(-1)).toMatchObject({ type: 'COMMENT', body: 'أول تعليق' });
  });
  it('BR-15 سجل النشاط غير قابل للتعديل أو الحذف (Append-only)', async () => {
    const a = await prisma.taskActivity.findFirstOrThrow();
    await expect(prisma.taskActivity.update({ where: { id: a.id }, data: { body: 'x' } })).rejects.toThrow(/append-only/);
    await expect(prisma.taskActivity.delete({ where: { id: a.id } })).rejects.toThrow(/append-only/);
  });
  it('BR-17 التعليق الفارغ مرفوض، والمستعرض لا يعلّق', async () => {
    await expectAppError(addComment(await as('sara'), 'T-1041', { body: '   ' }), 422, 'BR-17');
    await expectAppError(addComment(await as('viewer'), 'T-1041', { body: 'تعليق' }), 403);
  });
});

describe('BR-14: الحذف المنطقي', () => {
  it('BR-14 المحذوفة لا تظهر في القوائم والمؤشرات والتفاصيل', async () => {
    const manager = await as('manager');
    await deleteTask(manager, 'T-1050');
    const t = await prisma.task.findUniqueOrThrow({ where: { code: 'T-1050' } });
    expect(t.deletedAt).toBeInstanceOf(Date);
    expect((await listTasks(manager, { pageSize: 100 }, TODAY)).items.some((i) => i.code === 'T-1050')).toBe(false);
    expect((await getStats(manager, {}, TODAY)).sidebar.all).toBe(5);
    await expectAppError(getTask(manager, 'T-1050', TODAY), 404);
  });
  it('BR-14 لا يُحذف المكتمل، والموظف لا يحذف، والمدير يحذف داخل إدارته فقط', async () => {
    await expectAppError(deleteTask(await as('manager'), 'T-1049'), 422, 'BR-14');
    await expectAppError(deleteTask(await as('sara'), 'T-1048'), 403);
    await expectAppError(deleteTask(await as('manager'), 'T-1042'), 404);
    await deleteTask(await as('admin'), 'T-1042');
  });
});
