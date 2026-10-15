import { describe, expect, it } from 'vitest';
import { addDays, diffDays, formatDate, formatDateTime, isIsoDate, riyadhDate } from '@/lib/dates';
import { createTaskSchema, commentSchema, listQuerySchema, addSubtaskSchema } from '@/lib/schemas';
import {
  allowedTransitions,
  checkTransition,
  completionRate,
  computeProgress,
  daysToDue,
  dueLabel,
  findTransition,
  formatDayCount,
  isDueDateAllowed,
  isDueSoon,
  isLocked,
  isOverdue,
  isValidReason,
  REQUEST_REF_PATTERN,
  STATUSES,
  TRANSITIONS,
  type Status,
} from '@/lib/taskRules';

const TODAY = '2026-10-15';
const done = (n: number) => Array.from({ length: n }, () => ({ isDone: true }));
const open = (n: number) => Array.from({ length: n }, () => ({ isDone: false }));
const base = { role: 'EMPLOYEE' as const, canChangeStatus: true, subtasks: [] as { isDone: boolean }[] };

describe('BR-02: قيم افتراضية للمهمة الجديدة', () => {
  it('BR-02 الأولوية الافتراضية MEDIUM والمسؤول اختياري (يُستبدل بالمنشئ)', () => {
    const r = createTaskSchema.parse({ title: 'مهمة تجريبية', dueDate: TODAY });
    expect(r.priority).toBe('MEDIUM');
    expect(r.assigneeId).toBeUndefined();
    expect(r.subtasks).toEqual([]);
  });
});

describe('BR-03: تاريخ الاستحقاق', () => {
  it('BR-03 يقبل اليوم وما بعده ويرفض الماضي', () => {
    expect(isDueDateAllowed(TODAY, TODAY)).toBe(true);
    expect(isDueDateAllowed('2026-10-16', TODAY)).toBe(true);
    expect(isDueDateAllowed('2026-10-14', TODAY)).toBe(false);
  });
  it('BR-03 التاريخ إلزامي وبصيغة صحيحة', () => {
    expect(createTaskSchema.safeParse({ title: 'مهمة تجريبية' }).success).toBe(false);
    expect(createTaskSchema.safeParse({ title: 'مهمة تجريبية', dueDate: '2026-02-30' }).success).toBe(false);
  });
  it('BR-03 «اليوم» بتوقيت الرياض (UTC+3)', () => {
    // 22:30 UTC يوم 14 = 01:30 فجر 15 في الرياض
    expect(riyadhDate(new Date('2026-10-14T22:30:00Z'))).toBe('2026-10-15');
    expect(riyadhDate(new Date('2026-10-14T20:59:00Z'))).toBe('2026-10-14');
  });
});

describe('BR-04: التأخير وقرب الاستحقاق والنص المساعد', () => {
  it('BR-04 المتأخرة: استحقاق قبل اليوم وحالة ليست DONE', () => {
    expect(isOverdue('IN_PROGRESS', '2026-10-13', TODAY)).toBe(true);
    expect(isOverdue('DONE', '2026-10-13', TODAY)).toBe(false);
    expect(isOverdue('NEW', TODAY, TODAY)).toBe(false);
  });
  it('BR-04 قريبة الاستحقاق: بين 0 ويومين', () => {
    expect(isDueSoon('NEW', TODAY, TODAY)).toBe(true);
    expect(isDueSoon('NEW', '2026-10-17', TODAY)).toBe(true);
    expect(isDueSoon('NEW', '2026-10-18', TODAY)).toBe(false);
    expect(isDueSoon('NEW', '2026-10-14', TODAY)).toBe(false);
    expect(isDueSoon('DONE', TODAY, TODAY)).toBe(false);
  });
  it('BR-04 صيغ العدد العربية', () => {
    expect(formatDayCount(1)).toBe('يوم واحد');
    expect(formatDayCount(2)).toBe('يومين');
    expect(formatDayCount(3)).toBe('3 أيام');
    expect(formatDayCount(10)).toBe('10 أيام');
    expect(formatDayCount(11)).toBe('11 يومًا');
    expect(formatDayCount(-25)).toBe('25 يومًا');
  });
  it('BR-04 / AC-04 النص المساعد', () => {
    expect(dueLabel('IN_PROGRESS', '2026-10-13', TODAY)).toBe('متأخرة يومين');
    expect(dueLabel('NEW', TODAY, TODAY)).toBe('تستحق اليوم');
    expect(dueLabel('NEW', '2026-10-16', TODAY)).toBe('متبقٍ يوم واحد');
    expect(dueLabel('NEW', '2026-10-20', TODAY)).toBe('متبقٍ 5 أيام');
    expect(dueLabel('NEW', '2026-11-15', TODAY)).toBe('متبقٍ 31 يومًا');
    expect(dueLabel('REVIEW', '2026-10-14', TODAY)).toBe('متأخرة يوم واحد');
    expect(dueLabel('DONE', '2026-10-01', TODAY)).toBe('منجزة');
  });
  it('BR-04 daysToDue سالب للمتأخرة', () => {
    expect(daysToDue('2026-10-13', TODAY)).toBe(-2);
    expect(daysToDue('2026-10-20', TODAY)).toBe(5);
  });
});

describe('BR-05: مصفوفة الانتقالات', () => {
  it('BR-05 خمسة انتقالات فقط', () => {
    expect(TRANSITIONS).toHaveLength(5);
  });
  const allowed = new Set(['NEW>IN_PROGRESS', 'IN_PROGRESS>REVIEW', 'REVIEW>IN_PROGRESS', 'REVIEW>DONE', 'DONE>IN_PROGRESS']);
  for (const from of STATUSES) {
    for (const to of STATUSES) {
      if (from === to) continue;
      const key = `${from}>${to}`;
      it(`BR-05 ${key} ${allowed.has(key) ? 'مسموح' : 'مرفوض'}`, () => {
        expect(Boolean(findTransition(from, to))).toBe(allowed.has(key));
        if (!allowed.has(key)) {
          const v = checkTransition({ ...base, role: 'ADMIN', from, to, reason: 'سبب كافٍ للإعادة' });
          expect(v?.code).toBe('BR-05');
          expect(v?.status).toBe(422);
        }
      });
    }
  }
  it('BR-05 / AC-13 من «جديدة» إلى «مكتملة» مرفوض برسالة عربية', () => {
    const v = checkTransition({ ...base, from: 'NEW', to: 'DONE' });
    expect(v?.code).toBe('BR-05');
    expect(v?.message).toBe('لا يمكن نقل المهمة من «جديدة» إلى «مكتملة»');
  });
  it('BR-05 بلا صلاحية تغيير الحالة ← 403', () => {
    const v = checkTransition({ ...base, canChangeStatus: false, from: 'NEW', to: 'IN_PROGRESS' });
    expect(v?.status).toBe(403);
  });
});

describe('BR-06: المراجعة تشترط إنجاز المهام الفرعية', () => {
  it('BR-06 / AC-06 يُرفض مع مهام فرعية غير منجزة', () => {
    const v = checkTransition({ ...base, from: 'IN_PROGRESS', to: 'REVIEW', subtasks: [...done(1), ...open(1)] });
    expect(v).toMatchObject({ code: 'BR-06', status: 422, message: 'يجب إنجاز جميع المهام الفرعية قبل الإرسال للمراجعة' });
  });
  it('BR-06 يُقبل مع إنجاز الكل أو بلا مهام فرعية', () => {
    expect(checkTransition({ ...base, from: 'IN_PROGRESS', to: 'REVIEW', subtasks: done(3) })).toBeNull();
    expect(checkTransition({ ...base, from: 'IN_PROGRESS', to: 'REVIEW', subtasks: [] })).toBeNull();
  });
});

describe('BR-07: الإكمال من المراجعة وبواسطة المدير', () => {
  it('BR-07 / AC-07 الموظف ← 403', () => {
    const v = checkTransition({ ...base, from: 'REVIEW', to: 'DONE' });
    expect(v).toMatchObject({ code: 'BR-07', status: 403 });
  });
  it('BR-07 MANAGER وADMIN مسموح', () => {
    expect(checkTransition({ ...base, role: 'MANAGER', from: 'REVIEW', to: 'DONE' })).toBeNull();
    expect(checkTransition({ ...base, role: 'ADMIN', from: 'REVIEW', to: 'DONE' })).toBeNull();
  });
  it('BR-07 allowedTransitions تعطّل «مكتملة» للموظف', () => {
    const list = allowedTransitions('REVIEW', 'EMPLOYEE', true, []);
    expect(list.find((t) => t.to === 'DONE')).toMatchObject({ allowed: false, blockedBy: 'BR-07' });
    expect(list.find((t) => t.to === 'IN_PROGRESS')).toMatchObject({ allowed: true, requiresReason: true });
    expect(allowedTransitions('REVIEW', 'MANAGER', true, []).every((t) => t.allowed)).toBe(true);
    expect(allowedTransitions('NEW', 'VIEWER', false, []).every((t) => !t.allowed)).toBe(true);
    expect(allowedTransitions('IN_PROGRESS', 'EMPLOYEE', true, open(1))[0]?.warning).toBe('BR-06');
  });
});

describe('BR-08: نسبة التقدم', () => {
  it('BR-08 النسبة مقرّبة لأقرب عدد صحيح', () => {
    expect(computeProgress('IN_PROGRESS', [...done(2), ...open(2)])).toBe(50);
    expect(computeProgress('IN_PROGRESS', [...done(3), ...open(1)])).toBe(75);
    expect(computeProgress('IN_PROGRESS', [...done(1), ...open(2)])).toBe(33);
    expect(computeProgress('IN_PROGRESS', [...done(2), ...open(1)])).toBe(67);
  });
  it('BR-08 بلا مهام فرعية = 0% والمكتملة = 100%', () => {
    expect(computeProgress('NEW', [])).toBe(0);
    expect(computeProgress('DONE', [])).toBe(100);
    expect(computeProgress('DONE', open(3))).toBe(100);
  });
});

describe('BR-09: سبب الإعادة وإعادة الفتح', () => {
  it('BR-09 / AC-08 الإعادة من المراجعة بلا سبب ← 422', () => {
    const v = checkTransition({ ...base, role: 'MANAGER', from: 'REVIEW', to: 'IN_PROGRESS', reason: '' });
    expect(v).toMatchObject({ code: 'BR-09', status: 422, field: 'reason' });
  });
  it('BR-09 السبب 10 أحرف على الأقل بعد إزالة المسافات', () => {
    expect(isValidReason('قصير')).toBe(false);
    expect(isValidReason('   تسعة حر   ')).toBe(false);
    expect(isValidReason('يحتاج إلى استكمال البيانات')).toBe(true);
    expect(checkTransition({ ...base, from: 'REVIEW', to: 'IN_PROGRESS', reason: 'يحتاج إلى استكمال' })).toBeNull();
  });
  it('BR-09 إعادة الفتح لـ MANAGER وADMIN فقط', () => {
    const reason = 'ملاحظات جديدة من الإدارة';
    expect(checkTransition({ ...base, from: 'DONE', to: 'IN_PROGRESS', reason })).toMatchObject({ code: 'BR-09', status: 403 });
    expect(checkTransition({ ...base, role: 'MANAGER', from: 'DONE', to: 'IN_PROGRESS', reason })).toBeNull();
    expect(checkTransition({ ...base, role: 'ADMIN', from: 'DONE', to: 'IN_PROGRESS' })).toMatchObject({ code: 'BR-09', status: 422 });
  });
});

describe('BR-10: المهمة المكتملة مقفلة', () => {
  it('BR-10 isLocked', () => {
    const locked = STATUSES.filter((s: Status) => isLocked(s));
    expect(locked).toEqual(['DONE']);
  });
});

describe('BR-12: صيغة رقم الطلب', () => {
  it('BR-12 التعبير ^REQ-\\d{4}-\\d{4}$', () => {
    expect(REQUEST_REF_PATTERN.test('REQ-2026-0318')).toBe(true);
    expect(REQUEST_REF_PATTERN.test('REQ-26-0318')).toBe(false);
    expect(REQUEST_REF_PATTERN.test('REQ-2026-03181')).toBe(false);
  });
  it('BR-12 اختياري، ويُحوَّل لأحرف كبيرة، ويُرفض بصيغة خاطئة', () => {
    expect(createTaskSchema.parse({ title: 'مهمة تجريبية', dueDate: TODAY }).requestRef).toBe('');
    expect(createTaskSchema.parse({ title: 'مهمة تجريبية', dueDate: TODAY, requestRef: ' req-2026-0001 ' }).requestRef).toBe(
      'REQ-2026-0001',
    );
    const r = createTaskSchema.safeParse({ title: 'مهمة تجريبية', dueDate: TODAY, requestRef: 'R-1' });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toBe('رقم الطلب يجب أن يكون بالصيغة REQ-YYYY-NNNN');
  });
});

describe('BR-16: معدل الإنجاز', () => {
  it('BR-16 المكتملة ÷ الإجمالي × 100', () => {
    expect(completionRate(2, 10)).toBe(20);
    expect(completionRate(1, 3)).toBe(33);
    expect(completionRate(0, 0)).toBe(0);
  });
});

describe('BR-17: أطوال الحقول', () => {
  const parse = (title: string, extra = {}) => createTaskSchema.safeParse({ title, dueDate: TODAY, ...extra });
  it('BR-17 / AC-02 العنوان إلزامي برسالة عربية', () => {
    const r = parse('   ');
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]).toMatchObject({ path: ['title'], message: 'يرجى إدخال عنوان المهمة' });
  });
  it('BR-17 العنوان 5–200 بعد إزالة المسافات الطرفية', () => {
    expect(parse('  أربع  ').success).toBe(false);
    expect(parse('  مراجع  ').success).toBe(true);
    expect(parse('  مراجع  ').data?.title).toBe('مراجع');
    expect(parse('أ'.repeat(200)).success).toBe(true);
    expect(parse('أ'.repeat(201)).success).toBe(false);
  });
  it('BR-17 الوصف حتى 2000 والمهمة الفرعية حتى 200 وحد 20 مهمة فرعية', () => {
    expect(parse('عنوان صالح', { description: 'و'.repeat(2001) }).success).toBe(false);
    expect(parse('عنوان صالح', { subtasks: ['م'.repeat(201)] }).success).toBe(false);
    expect(parse('عنوان صالح', { subtasks: Array(21).fill('مهمة') }).success).toBe(false);
    expect(parse('عنوان صالح', { subtasks: Array(20).fill('مهمة') }).success).toBe(true);
    expect(addSubtaskSchema.safeParse({ text: '  ' }).success).toBe(false);
  });
  it('BR-17 التعليق 1–1000', () => {
    expect(commentSchema.safeParse({ body: '  ' }).success).toBe(false);
    expect(commentSchema.safeParse({ body: 'ت' }).success).toBe(true);
    expect(commentSchema.safeParse({ body: 'ت'.repeat(1001) }).success).toBe(false);
  });
});

describe('BR-18: عرض التواريخ', () => {
  it('BR-18 أسماء الأشهر العربية والتقويم الميلادي', () => {
    expect(formatDate('2026-10-15')).toBe('15 أكتوبر 2026');
    expect(formatDate('2026-01-01')).toBe('1 يناير 2026');
    expect(formatDate('2026-12-31')).toBe('31 ديسمبر 2026');
  });
  it('BR-18 الوقت يُعرض بتوقيت الرياض', () => {
    expect(formatDateTime('2026-10-15T07:30:00Z')).toBe('15 أكتوبر 2026، 10:30 ص');
    expect(formatDateTime('2026-10-15T21:05:00Z')).toBe('16 أكتوبر 2026، 12:05 ص');
    expect(formatDateTime('2026-10-15T12:00:00Z')).toBe('15 أكتوبر 2026، 3:00 م');
  });
  it('أدوات التاريخ', () => {
    expect(isIsoDate('2026-10-15')).toBe(true);
    expect(isIsoDate('2026-13-01')).toBe(false);
    expect(addDays('2026-10-30', 3)).toBe('2026-11-02');
    expect(diffDays('2026-10-15', '2026-10-13')).toBe(-2);
  });
});

describe('معاملات القائمة', () => {
  it('FR-22 حجم الصفحة الافتراضي 25', () => {
    const q = listQuerySchema.parse({});
    expect(q).toMatchObject({ view: 'all', page: 1, pageSize: 25, status: [], priority: [] });
  });
  it('FR-19 حالات وأولويات متعددة', () => {
    const q = listQuerySchema.parse({ status: 'NEW,REVIEW', priority: 'HIGH', sort: '-dueDate' });
    expect(q.status).toEqual(['NEW', 'REVIEW']);
    expect(q.sort).toBe('-dueDate');
    expect(listQuerySchema.safeParse({ sort: 'drop table' }).success).toBe(false);
  });
});
