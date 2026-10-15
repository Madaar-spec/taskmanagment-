// بيانات Seed — بتاريخ مثبّت 2026-10-15 (القسم 9)
// الإدارات، الموظفون السبعة، حساب ADMIN وحساب MANAGER لإدارة التحول الرقمي (وحساب VIEWER للتجربة)،
// والمهام العشر T-1041 إلى T-1050. البيانات مصمّمة لتغطي معايير القبول AC-01 إلى AC-15.
import { Prisma, PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

export const SEED_PASSWORD = 'Madaar@2026';
export const SEED_TODAY = '2026-10-15';

export const DEPARTMENTS = {
  digital: 'إدارة التحول الرقمي',
  hr: 'إدارة الموارد البشرية',
  finance: 'الإدارة المالية',
  comms: 'إدارة الاتصال المؤسسي',
} as const;
type DeptKey = keyof typeof DEPARTMENTS;

export const USERS = {
  admin: { name: 'مسؤول النظام', email: 'admin@madaar.test', role: 'ADMIN', dept: 'digital' },
  manager: { name: 'عبدالله الشهري', email: 'manager@madaar.test', role: 'MANAGER', dept: 'digital' },
  viewer: { name: 'هيفاء العنزي', email: 'viewer@madaar.test', role: 'VIEWER', dept: 'digital' },
  // الموظفون السبعة
  sara: { name: 'سارة القحطاني', email: 'sara@madaar.test', role: 'EMPLOYEE', dept: 'digital' },
  mohammed: { name: 'محمد العتيبي', email: 'mohammed@madaar.test', role: 'EMPLOYEE', dept: 'digital' },
  noura: { name: 'نورة الدوسري', email: 'noura@madaar.test', role: 'EMPLOYEE', dept: 'digital' },
  khalid: { name: 'خالد الحربي', email: 'khalid@madaar.test', role: 'EMPLOYEE', dept: 'hr' },
  lama: { name: 'لمى الغامدي', email: 'lama@madaar.test', role: 'EMPLOYEE', dept: 'hr' },
  reem: { name: 'ريم الزهراني', email: 'reem@madaar.test', role: 'EMPLOYEE', dept: 'finance' },
  fahad: { name: 'فهد المطيري', email: 'fahad@madaar.test', role: 'EMPLOYEE', dept: 'comms' },
} as const satisfies Record<string, { name: string; email: string; role: string; dept: DeptKey }>;
type UserKey = keyof typeof USERS;

interface SeedTask {
  code: string;
  title: string;
  description: string;
  status: 'NEW' | 'IN_PROGRESS' | 'REVIEW' | 'DONE';
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  due: string;
  requestRef?: string;
  assignee: UserKey;
  createdBy: UserKey;
  createdAt: string;
  completedBy?: UserKey;
  completedAt?: string;
  subtasks?: [string, boolean][];
}

export const TASKS: SeedTask[] = [
  {
    // AC-04: استحقاقها 2026-10-13 وقيد التنفيذ ← «متأخرة يومين»
    code: 'T-1041',
    title: 'تحديث دليل إجراءات الخدمات الإلكترونية',
    description: 'مراجعة الدليل الحالي وتحديث الإجراءات وفق نموذج الخدمات الجديد في بوابة مدار.',
    status: 'IN_PROGRESS',
    priority: 'HIGH',
    due: '2026-10-13',
    requestRef: 'REQ-2026-0312',
    assignee: 'sara',
    createdBy: 'manager',
    createdAt: '2026-10-01T06:30:00Z',
    subtasks: [
      ['حصر الإجراءات الحالية', true],
      ['صياغة الإجراءات المحدّثة', false],
      ['اعتماد الدليل من الإدارة', false],
    ],
  },
  {
    // AC-11: البحث بـ REQ-2026-0318 يُظهر T-1042 فقط
    code: 'T-1042',
    title: 'مراجعة طلب ربط منصة التوظيف بنظام الموارد البشرية',
    description: 'دراسة متطلبات الربط التقني وتحديد البيانات المتبادلة بين المنصتين.',
    status: 'REVIEW',
    priority: 'MEDIUM',
    due: '2026-10-20',
    requestRef: 'REQ-2026-0318',
    assignee: 'khalid',
    createdBy: 'admin',
    createdAt: '2026-10-04T07:00:00Z',
    subtasks: [
      ['تحليل واجهات الربط', true],
      ['إعداد مسودة اتفاقية تبادل البيانات', true],
    ],
  },
  {
    // AC-05: 4 مهام فرعية منجز منها 2 (50% ← 75%)
    code: 'T-1043',
    title: 'إعداد تقرير مؤشرات الأداء للربع الثالث',
    description: 'جمع بيانات المؤشرات من الإدارات وإعداد التقرير الربعي للعرض على القيادة.',
    status: 'IN_PROGRESS',
    priority: 'HIGH',
    due: '2026-10-17',
    requestRef: 'REQ-2026-0301',
    assignee: 'mohammed',
    createdBy: 'manager',
    createdAt: '2026-10-02T08:15:00Z',
    subtasks: [
      ['جمع البيانات من الإدارات', true],
      ['تدقيق البيانات', true],
      ['إعداد الرسوم البيانية', false],
      ['كتابة الملخص التنفيذي', false],
    ],
  },
  {
    code: 'T-1044',
    title: 'تصميم نموذج طلب الإجازة الإلكتروني',
    description: 'تصميم نموذج إلكتروني موحّد لطلبات الإجازات ومسار اعتمادها.',
    status: 'NEW',
    priority: 'MEDIUM',
    due: '2026-10-28',
    requestRef: 'REQ-2026-0325',
    assignee: 'lama',
    createdBy: 'admin',
    createdAt: '2026-10-08T09:00:00Z',
  },
  {
    code: 'T-1045',
    title: 'اعتماد عقد صيانة الخوادم',
    description: 'مراجعة بنود عقد الصيانة السنوي واستكمال إجراءات الاعتماد المالي.',
    status: 'DONE',
    priority: 'HIGH',
    due: '2026-10-10',
    assignee: 'reem',
    createdBy: 'admin',
    createdAt: '2026-09-28T07:45:00Z',
    completedBy: 'admin',
    completedAt: '2026-10-09T11:20:00Z',
    subtasks: [
      ['مراجعة البنود المالية', true],
      ['توقيع العقد', true],
    ],
  },
  {
    // AC-07 / AC-08: «قيد المراجعة» في إدارة التحول الرقمي، مسندة لموظفة
    code: 'T-1046',
    title: 'تحليل متطلبات بوابة الخدمات الذاتية',
    description: 'توثيق متطلبات الأعمال لبوابة الخدمات الذاتية للموظفين وتحديد الأولويات.',
    status: 'REVIEW',
    priority: 'HIGH',
    due: '2026-10-16',
    requestRef: 'REQ-2026-0307',
    assignee: 'noura',
    createdBy: 'manager',
    createdAt: '2026-10-03T06:00:00Z',
    subtasks: [
      ['ورش عمل مع أصحاب المصلحة', true],
      ['توثيق المتطلبات', true],
      ['مراجعة المتطلبات مع الفريق التقني', true],
    ],
  },
  {
    code: 'T-1047',
    title: 'إعداد خطة التواصل لإطلاق خدمات مدار',
    description: 'خطة تواصل داخلية وخارجية تشمل الرسائل والقنوات والجدول الزمني.',
    status: 'IN_PROGRESS',
    priority: 'LOW',
    due: '2026-10-11',
    requestRef: 'REQ-2026-0290',
    assignee: 'fahad',
    createdBy: 'admin',
    createdAt: '2026-09-30T10:30:00Z',
    subtasks: [
      ['تحديد الجمهور المستهدف', true],
      ['إعداد الرسائل الرئيسية', false],
    ],
  },
  {
    // AC-06: مهام فرعية غير منجزة
    code: 'T-1048',
    title: 'ترحيل بيانات الأرشيف إلى النظام الجديد',
    description: 'ترحيل سجلات الأرشيف الورقي المؤرشف إلكترونياً إلى نظام إدارة الوثائق.',
    status: 'NEW',
    priority: 'MEDIUM',
    due: '2026-10-15',
    assignee: 'sara',
    createdBy: 'sara',
    createdAt: '2026-10-10T07:10:00Z',
    subtasks: [
      ['حصر السجلات', false],
      ['تنفيذ الترحيل التجريبي', false],
      ['التحقق من سلامة البيانات', false],
    ],
  },
  {
    // AC-09: مهمة مكتملة
    code: 'T-1049',
    title: 'تحديث صلاحيات المستخدمين في نظام المراسلات',
    description: 'مراجعة صلاحيات المستخدمين وإزالة الصلاحيات غير المستخدمة.',
    status: 'DONE',
    priority: 'MEDIUM',
    due: '2026-10-12',
    assignee: 'mohammed',
    createdBy: 'manager',
    createdAt: '2026-09-29T08:00:00Z',
    completedBy: 'manager',
    completedAt: '2026-10-12T12:00:00Z',
  },
  {
    // AC-13: بطاقة «جديدة» للسحب
    code: 'T-1050',
    title: 'إعداد عرض تقديمي لورشة التحول الرقمي',
    description: 'عرض تقديمي يلخّص منجزات التحول الرقمي وخطة المرحلة القادمة.',
    status: 'NEW',
    priority: 'LOW',
    due: '2026-10-30',
    assignee: 'noura',
    createdBy: 'manager',
    createdAt: '2026-10-12T09:30:00Z',
  },
];

const STATUS_PATH: Record<SeedTask['status'], SeedTask['status'][]> = {
  NEW: [],
  IN_PROGRESS: ['IN_PROGRESS'],
  REVIEW: ['IN_PROGRESS', 'REVIEW'],
  DONE: ['IN_PROGRESS', 'REVIEW', 'DONE'],
};

/** يمسح الجداول ويعيد إنشاء بيانات Seed (يُستخدم أيضاً في الاختبارات) */
export async function seed(prisma: PrismaClient) {
  await prisma.$executeRawUnsafe(
    'TRUNCATE "notifications", "attachments", "task_activities", "subtasks", "tasks", "login_attempts", "users", "departments" CASCADE',
  );

  const deptIds = {} as Record<DeptKey, string>;
  for (const [key, nameAr] of Object.entries(DEPARTMENTS) as [DeptKey, string][]) {
    deptIds[key] = (await prisma.department.create({ data: { nameAr } })).id;
  }

  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);
  const userIds = {} as Record<UserKey, string>;
  for (const [key, u] of Object.entries(USERS) as [UserKey, (typeof USERS)[UserKey]][]) {
    userIds[key] = (
      await prisma.user.create({
        data: { fullNameAr: u.name, email: u.email, role: u.role, departmentId: deptIds[u.dept], passwordHash },
      })
    ).id;
  }
  await prisma.department.update({ where: { id: deptIds.digital }, data: { managerId: userIds.manager } });

  for (const t of TASKS) {
    const created = new Date(t.createdAt);
    const assigneeDept = deptIds[USERS[t.assignee].dept];
    const task = await prisma.task.create({
      data: {
        code: t.code,
        title: t.title,
        description: t.description,
        status: t.status,
        priority: t.priority,
        dueDate: new Date(`${t.due}T00:00:00Z`),
        requestRef: t.requestRef ?? null,
        assigneeId: userIds[t.assignee],
        departmentId: assigneeDept,
        createdById: userIds[t.createdBy],
        completedAt: t.completedAt ? new Date(t.completedAt) : null,
        completedById: t.completedBy ? userIds[t.completedBy] : null,
        createdAt: created,
        subtasks: { create: (t.subtasks ?? []).map(([text, isDone], i) => ({ text, isDone, sortOrder: i + 1 })) },
      },
    });

    const activities: Prisma.TaskActivityCreateManyInput[] = [
      {
        taskId: task.id,
        actorId: userIds[t.createdBy],
        type: 'CREATED',
        createdAt: created,
        newValue: {
          code: t.code,
          title: t.title,
          status: 'NEW',
          priority: t.priority,
          dueDate: t.due,
          assignee: { id: userIds[t.assignee], name: USERS[t.assignee].name },
        },
      },
    ];
    let prev: SeedTask['status'] = 'NEW';
    STATUS_PATH[t.status].forEach((to, i) => {
      const actor = to === 'DONE' ? (t.completedBy ?? 'manager') : t.assignee;
      const at = to === 'DONE' && t.completedAt ? new Date(t.completedAt) : new Date(created.getTime() + (i + 1) * 86_400_000);
      activities.push({
        taskId: task.id,
        actorId: userIds[actor],
        type: 'STATUS_CHANGED',
        oldValue: { status: prev },
        newValue: { status: to },
        createdAt: at,
      });
      prev = to;
    });
    await prisma.taskActivity.createMany({ data: activities });
  }

  // BR-11: التسلسل يستمر بعد آخر رقم مزروع (التالي T-1051)
  await prisma.$executeRawUnsafe(`SELECT setval('task_code_seq', 1050, true)`);

  return { deptIds, userIds };
}
