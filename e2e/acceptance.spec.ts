// معايير القبول AC-01 إلى AC-15 — BRD القسم 9
import { db, expect, login, openTask, row, test } from './fixtures';

test.describe('معايير القبول', () => {
  test('AC-01 موظف في إدارة التحول الرقمي يرى مهامه فقط والمؤشرات محسوبة منها', async ({ page }) => {
    await login(page, 'sara');
    const rows = page.locator('[data-testid^="row-"]');
    await expect(rows).toHaveCount(2);
    await expect(row(page, 'T-1041')).toBeVisible();
    await expect(row(page, 'T-1048')).toBeVisible();
    await expect(page.getByTestId('kpi-total-value')).toHaveText('2');
    await expect(page.getByTestId('kpi-overdue-value')).toHaveText('1');
    await expect(page.getByTestId('view-all-count')).toHaveText('2');
  });

  test('AC-02 إنشاء مهمة بلا عنوان يُظهر «يرجى إدخال عنوان المهمة» ولا تُنشأ', async ({ page }) => {
    await login(page, 'sara');
    await page.getByTestId('new-task').click();
    await page.getByTestId('submit-task').click();
    const title = page.getByLabel('عنوان المهمة');
    await expect(page.locator('#tf-title-error')).toHaveText('يرجى إدخال عنوان المهمة');
    await expect(title).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByTestId('task-form')).toBeVisible();
    expect(await db.task.count()).toBe(10);
  });

  test('AC-03 إنشاء مهمة صحيحة: أعلى القائمة برقم تالٍ وحالة «جديدة» ورسالة تأكيد ونشاط CREATED', async ({ page }) => {
    await login(page, 'sara');
    await page.getByTestId('new-task').click();
    await page.getByLabel('عنوان المهمة').fill('إعداد محضر اجتماع اللجنة');
    await page.getByLabel('تاريخ الاستحقاق').fill('2026-10-22');
    await page.getByLabel('رقم الطلب المرتبط').fill('REQ-2026-0400');
    await page.getByTestId('submit-task').click();
    await expect(page.getByTestId('toast')).toContainText('أُنشئت المهمة T-1051 بنجاح');
    const first = page.locator('[data-testid^="row-"]').first();
    await expect(first).toHaveAttribute('data-testid', 'row-T-1051');
    await expect(first).toContainText('جديدة');
    const panel = await openTask(page, 'T-1051');
    await expect(panel.getByTestId('timeline')).toContainText('أنشأ سارة القحطاني المهمة');
    const act = await db.taskActivity.findFirst({ where: { task: { code: 'T-1051' } } });
    expect(act?.type).toBe('CREATED');
  });

  test('AC-04 مهمة استحقاقها 2026-10-13 قيد التنفيذ تظهر «متأخرة يومين» وتُحتسب في الجرس و«المتأخرة»', async ({ page }) => {
    await login(page, 'admin');
    await expect(row(page, 'T-1041').getByTestId('due-label')).toHaveText('متأخرة يومين');
    await expect(page.getByTestId('bell-count')).toHaveText('2');
    await page.getByTestId('bell').click();
    await expect(page).toHaveURL(/view=overdue/);
    await expect(page.locator('[data-testid^="row-"]')).toHaveCount(2);
    await expect(row(page, 'T-1041')).toBeVisible();
    await expect(page.getByTestId('view-overdue')).toHaveAttribute('aria-current', 'page');
  });

  test('AC-05 تعليم المهمة الفرعية الثالثة يغيّر التقدم من 50% إلى 75% في التفاصيل والقائمة واللوحة', async ({ page }) => {
    await login(page, 'mohammed');
    await expect(row(page, 'T-1043').getByTestId('progress-value')).toHaveText('50%');
    const panel = await openTask(page, 'T-1043');
    await expect(panel.getByTestId('panel-progress').getByTestId('progress-value')).toHaveText('50%');
    await panel.getByRole('checkbox', { name: 'إعداد الرسوم البيانية' }).check();
    await expect(panel.getByTestId('panel-progress').getByTestId('progress-value')).toHaveText('75%');
    await page.keyboard.press('Escape');
    await expect(row(page, 'T-1043').getByTestId('progress-value')).toHaveText('75%');
    await page.getByTestId('mode-board').click();
    await expect(page.getByTestId('card-T-1043').getByTestId('progress-value')).toHaveText('75%');
  });

  test('AC-06 نقل مهمة بمهام فرعية غير منجزة إلى «قيد المراجعة» يُرفض برسالة BR-06 وتبقى الحالة', async ({ page }) => {
    await login(page, 'sara');
    const panel = await openTask(page, 'T-1041');
    await panel.getByTestId('transition-REVIEW').click();
    await expect(page.getByTestId('toast').filter({ hasText: 'يجب إنجاز جميع المهام الفرعية قبل الإرسال للمراجعة' })).toBeVisible();
    await expect(panel.locator('[data-status]').first()).toHaveText(/قيد التنفيذ/);
    expect((await db.task.findUniqueOrThrow({ where: { code: 'T-1041' } })).status).toBe('IN_PROGRESS');
  });

  test('AC-07 الموظف: زر «مكتملة» غير مفعّل والطلب المباشر للـ API يُرجِع 403', async ({ page }) => {
    await login(page, 'noura');
    const panel = await openTask(page, 'T-1046');
    await expect(panel.getByTestId('transition-DONE')).toBeDisabled();
    const res = await page.request.post('/api/v1/tasks/T-1046/transition', {
      data: { to: 'DONE' },
      headers: { origin: new URL(page.url()).origin },
    });
    expect(res.status()).toBe(403);
    expect((await res.json()).error.code).toBe('BR-07');
  });

  test('AC-08 المدير يعيد مهمة من المراجعة: يُطلب السبب ثم تعود «قيد التنفيذ» ويُشعَر المسؤول', async ({ page }) => {
    await login(page, 'manager');
    const panel = await openTask(page, 'T-1046');
    await panel.getByTestId('transition-IN_PROGRESS').click();
    const dialog = page.getByRole('dialog', { name: 'سبب الإعادة' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'تأكيد' }).click();
    await expect(dialog.locator('#reason-error')).toHaveText('يرجى كتابة سبب الإعادة (10 أحرف على الأقل)');
    await dialog.getByLabel('السبب').fill('يرجى استكمال متطلبات الأمن السيبراني');
    await dialog.getByRole('button', { name: 'تأكيد' }).click();
    await expect(page.getByTestId('toast').filter({ hasText: 'نُقلت المهمة T-1046 إلى «قيد التنفيذ»' })).toBeVisible();
    await expect(panel.getByTestId('timeline')).toContainText('السبب: يرجى استكمال متطلبات الأمن السيبراني');
    const noura = await db.user.findUniqueOrThrow({ where: { email: 'noura@madaar.test' } });
    const n = await db.notification.findFirst({ where: { userId: noura.id } });
    expect(n?.messageAr).toContain('أُعيدت المهمة T-1046 من المراجعة');
  });

  test('AC-09 المهمة المكتملة: تعديل العنوان مرفوض (BR-10) والتعليق مسموح', async ({ page }) => {
    await login(page, 'manager');
    const panel = await openTask(page, 'T-1049');
    await expect(panel.getByTestId('edit-task')).toHaveCount(0);
    await expect(panel).toContainText('المهمة مكتملة ومقفلة');
    const detail = await (await page.request.get('/api/v1/tasks/T-1049')).json();
    const res = await page.request.patch('/api/v1/tasks/T-1049', {
      data: { title: 'عنوان معدّل للمهمة', updatedAt: detail.updatedAt },
      headers: { origin: new URL(page.url()).origin },
    });
    expect(res.status()).toBe(422);
    expect((await res.json()).error.code).toBe('BR-10');
    await panel.getByLabel('إضافة تعليق').fill('تمت المراجعة النهائية');
    await panel.getByTestId('send-comment').click();
    await expect(page.getByTestId('toast').filter({ hasText: 'أُضيف التعليق' })).toBeVisible();
    await expect(panel.getByTestId('timeline')).toContainText('تمت المراجعة النهائية');
  });

  test('AC-10 تغيير الحالة يظهر في سجل النشاط «غيّر [الاسم] الحالة إلى «…»» بالوقت', async ({ page }) => {
    await login(page, 'sara');
    const panel = await openTask(page, 'T-1048');
    await panel.getByTestId('transition-IN_PROGRESS').click();
    await expect(page.getByTestId('toast').filter({ hasText: 'نُقلت المهمة T-1048 إلى «قيد التنفيذ»' })).toBeVisible();
    const last = panel.getByTestId('timeline').locator('li').last();
    await expect(last).toContainText('غيّر سارة القحطاني الحالة إلى «قيد التنفيذ»');
    await expect(last.locator('time')).toHaveText(/\d+ (يناير|فبراير|مارس|أبريل|مايو|يونيو|يوليو|أغسطس|سبتمبر|أكتوبر|نوفمبر|ديسمبر) \d{4}، \d{1,2}:\d{2} (ص|م)/);
  });

  test('AC-11 البحث بـ REQ-2026-0318 يُظهر T-1042 فقط والعدّادات تتحدّث', async ({ page }) => {
    await login(page, 'admin');
    await expect(page.getByTestId('kpi-total-value')).toHaveText('10');
    await page.getByTestId('search').fill('REQ-2026-0318');
    await expect(page.locator('[data-testid^="row-"]')).toHaveCount(1);
    await expect(row(page, 'T-1042')).toBeVisible();
    await expect(page.getByTestId('kpi-total-value')).toHaveText('1');
    await expect(page.getByTestId('chip-ALL-count')).toHaveText('1');
    await expect(page.getByTestId('chip-REVIEW-count')).toHaveText('1');
    await expect(page).toHaveURL(/q=REQ-2026-0318/);
  });

  test('AC-12 تصفية بلا نتائج ثم «إعادة ضبط التصفية» تعيد كل المهام ضمن النطاق', async ({ page }) => {
    await login(page, 'admin');
    await page.getByTestId('search').fill('لا توجد مهمة بهذا الاسم');
    await page.getByLabel('الأولوية', { exact: true }).selectOption('LOW');
    await expect(page.getByTestId('empty-state')).toBeVisible();
    await expect(page.getByTestId('showing')).toHaveCount(0);
    await page.getByTestId('reset-filters').click();
    await expect(page.locator('[data-testid^="row-"]')).toHaveCount(10);
    await expect(page.getByTestId('search')).toHaveValue('');
    await expect(page.getByTestId('showing')).toHaveText('عرض 1–10 من 10');
  });

  test('AC-13 سحب بطاقة من «جديدة» إلى «مكتملة» يُرفض وتعود البطاقة مكانها مع رسالة BR-05', async ({ page }) => {
    await login(page, 'manager');
    await page.getByTestId('mode-board').click();
    const card = page.getByTestId('card-T-1050');
    const target = page.getByTestId('column-DONE');
    await expect(card).toBeVisible();
    const from = (await card.boundingBox())!;
    const to = (await target.boundingBox())!;
    await page.mouse.move(from.x + from.width / 2, from.y + 20);
    await page.mouse.down();
    await page.mouse.move(from.x + from.width / 2 + 10, from.y + 30, { steps: 5 });
    await page.mouse.move(to.x + to.width / 2, to.y + 80, { steps: 15 });
    await page.mouse.up();
    await expect(page.getByTestId('toast').filter({ hasText: 'لا يمكن نقل المهمة من «جديدة» إلى «مكتملة»' })).toBeVisible();
    await expect(page.getByTestId('column-NEW').getByTestId('card-T-1050')).toBeVisible();
    expect((await db.task.findUniqueOrThrow({ where: { code: 'T-1050' } })).status).toBe('NEW');
  });

  test('AC-13 السحب إلى عمود مسموح يغيّر الحالة', async ({ page }) => {
    await login(page, 'manager');
    await page.getByTestId('mode-board').click();
    const card = page.getByTestId('card-T-1050');
    const from = (await card.boundingBox())!;
    const to = (await page.getByTestId('column-IN_PROGRESS').boundingBox())!;
    await page.mouse.move(from.x + from.width / 2, from.y + 20);
    await page.mouse.down();
    await page.mouse.move(from.x + from.width / 2 - 10, from.y + 30, { steps: 5 });
    await page.mouse.move(to.x + to.width / 2, to.y + 60, { steps: 15 });
    await page.mouse.up();
    await expect(page.getByTestId('column-IN_PROGRESS').getByTestId('card-T-1050')).toBeVisible();
    await expect(page.getByTestId('column-IN_PROGRESS-count')).toHaveText('3');
  });

  test('AC-14 شاشة بعرض 360px: لا تمرير أفقي للصفحة وكل الوظائف متاحة', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await login(page, 'manager');
    const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(await overflow()).toBeLessThanOrEqual(0);
    for (const id of ['new-task', 'search', 'mode-board', 'view-overdue', 'bell', 'user-menu']) {
      await expect(page.getByTestId(id)).toBeVisible();
    }
    await page.getByTestId('mode-board').click();
    await expect(page.getByTestId('task-board')).toBeVisible();
    expect(await overflow()).toBeLessThanOrEqual(0);
    await page.getByTestId('mode-list').click();
    const panel = await openTask(page, 'T-1043');
    await expect(panel.getByTestId('transition-REVIEW')).toBeVisible();
    expect(await overflow()).toBeLessThanOrEqual(0);
    await page.keyboard.press('Escape');
    await page.getByTestId('new-task').click();
    await expect(page.getByTestId('task-form')).toBeVisible();
    expect(await overflow()).toBeLessThanOrEqual(0);
  });

  test('AC-15 لوحة المفاتيح فقط: إنشاء مهمة وتغيير حالتها والتركيز ظاهر دائماً', async ({ page }) => {
    await login(page, 'sara');
    const assertFocusVisible = async () => {
      const outline = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body) return null;
        const s = getComputedStyle(el);
        return { width: s.outlineWidth, style: s.outlineStyle, color: s.outlineColor };
      });
      expect(outline).not.toBeNull();
      expect(outline!.style).toBe('solid');
      expect(outline!.width).toBe('2px');
      expect(outline!.color).toBe('rgb(73, 186, 166)');
    };

    // التنقل إلى زر «مهمة جديدة» بالـ Tab
    let guard = 0;
    while (guard++ < 40) {
      await page.keyboard.press('Tab');
      if (await page.getByTestId('new-task').evaluate((el) => el === document.activeElement)) break;
    }
    await assertFocusVisible();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('task-form')).toBeVisible();
    // التركيز محبوس داخل النافذة
    await page.keyboard.press('Tab');
    await expect(page.getByLabel('عنوان المهمة')).toBeFocused();
    await assertFocusVisible();
    await page.keyboard.type('مهمة منشأة بلوحة المفاتيح');
    await page.getByLabel('تاريخ الاستحقاق').focus();
    await page.keyboard.press('Enter'); // إرسال النموذج من الحقل
    await expect(page.getByTestId('toast').filter({ hasText: 'T-1051' })).toBeVisible();

    // فتح المهمة وتغيير حالتها بلوحة المفاتيح
    const open = row(page, 'T-1051').getByRole('button', { name: 'T-1051' });
    await open.focus();
    await assertFocusVisible();
    await page.keyboard.press('Enter');
    const panel = page.getByTestId('task-panel');
    await expect(panel.getByTestId('panel-title')).toBeVisible();
    const start = panel.getByTestId('transition-IN_PROGRESS');
    guard = 0;
    while (guard++ < 30) {
      await page.keyboard.press('Tab');
      if (await start.evaluate((el) => el === document.activeElement)) break;
    }
    await assertFocusVisible();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('toast').filter({ hasText: 'نُقلت المهمة T-1051 إلى «قيد التنفيذ»' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(panel).toHaveCount(0);
    await expect(row(page, 'T-1051')).toContainText('قيد التنفيذ');
  });
});
