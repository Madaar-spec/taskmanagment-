// FR-01..FR-03، FR-24، FR-31، FR-32
import { db, expect, login, row, test } from './fixtures';

test('FR-01 بيانات دخول خاطئة تُظهر رسالة عربية', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('البريد الإلكتروني المؤسسي').fill('sara@madaar.test');
  await page.getByLabel('كلمة المرور').fill('wrong-password');
  await page.getByRole('button', { name: 'دخول' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'غير صحيحة' })).toHaveText('البريد الإلكتروني أو كلمة المرور غير صحيحة');
});

test('FR-02 / FR-03 الشريط العلوي يعرض المستخدم، وتسجيل الخروج يعيد لصفحة الدخول', async ({ page }) => {
  await login(page, 'sara');
  const menu = page.getByTestId('user-menu');
  await expect(menu).toContainText('سارة القحطاني');
  await expect(menu).toContainText('إدارة التحول الرقمي');
  await expect(menu).toContainText('س');
  await menu.click();
  await page.getByRole('menuitem', { name: 'تسجيل الخروج' }).click();
  await page.waitForURL('**/login**');
  await page.goto('/tasks');
  await page.waitForURL('**/login**');
});

test('FR-24 طريقة العرض والتصفية محفوظة في الرابط', async ({ page }) => {
  await login(page, 'admin');
  await page.goto('/tasks?mode=board&priority=HIGH&view=all');
  await expect(page.getByTestId('task-board')).toBeVisible();
  await expect(page.getByLabel('الأولوية', { exact: true })).toHaveValue('HIGH');
  await expect(page.locator('[data-testid^="card-"]')).toHaveCount(4);
  await page.goto('/tasks?task=T-1042');
  await expect(page.getByTestId('task-panel').getByTestId('panel-title')).toContainText('منصة التوظيف');
});

test('FR-31 / FR-32 مسؤول النظام يضيف مستخدماً وإدارة، وغيره لا يصل', async ({ page }) => {
  await login(page, 'admin');
  await page.goto('/admin/departments');
  await page.getByRole('button', { name: 'إضافة إدارة' }).click();
  await page.getByLabel('اسم الإدارة').fill('إدارة الشؤون القانونية');
  await page.getByRole('button', { name: 'حفظ' }).click();
  await expect(page.getByRole('cell', { name: 'إدارة الشؤون القانونية', exact: true })).toBeVisible();

  await page.goto('/admin/users');
  await page.getByRole('button', { name: 'إضافة مستخدم' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('الاسم الكامل').fill('ياسر القانوني');
  await dialog.getByLabel('البريد الإلكتروني').fill('yasser@madaar.test');
  await dialog.getByLabel('كلمة المرور').fill('Strong#Pass1');
  await dialog.getByLabel('الدور').selectOption('MANAGER');
  await dialog.getByLabel('الإدارة').selectOption({ label: 'إدارة الشؤون القانونية' });
  await dialog.getByRole('button', { name: 'حفظ' }).click();
  await expect(page.getByRole('cell', { name: 'ياسر القانوني', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'تعطيل ياسر القانوني' }).click();
  await expect.poll(async () => (await db.user.findUnique({ where: { email: 'yasser@madaar.test' } }))?.isActive).toBe(false);
});

test('FR-31 صفحات الإدارة غير متاحة لغير ADMIN', async ({ page }) => {
  await login(page, 'manager');
  const res = await page.goto('/admin/users');
  expect(res?.status()).toBe(404);
});

test('VIEWER قراءة فقط: لا زر إنشاء ولا أزرار حالة مفعّلة ولا تعليق', async ({ page }) => {
  await login(page, 'viewer');
  await expect(page.getByTestId('new-task')).toHaveCount(0);
  await row(page, 'T-1043').getByRole('button', { name: 'T-1043' }).click();
  const panel = page.getByTestId('task-panel');
  await expect(panel.getByTestId('transition-REVIEW')).toBeDisabled();
  await expect(panel.getByTestId('send-comment')).toHaveCount(0);
  await expect(panel.getByRole('checkbox').first()).toBeDisabled();
});
