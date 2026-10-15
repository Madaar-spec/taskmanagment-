// NFR-04: فحص إتاحة آلي (axe) وفق WCAG 2.1 AA
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, login, openTask, test } from './fixtures';

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

async function audit(page: Page, label: string) {
  // انتظار اكتمال الانتقالات والعنوان قبل الفحص
  await expect(page).toHaveTitle(/مدار/);
  await page.waitForTimeout(300);
  await page.mouse.move(0, 0);
  const results = await new AxeBuilder({ page: page as never }).withTags(TAGS).analyze();
  const summary = results.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`);
  expect(summary, `${label}\n${summary.join('\n')}`).toEqual([]);
}

test.describe('NFR-04 الإتاحة', () => {
  test('صفحة الدخول', async ({ page }) => {
    await page.goto('/login');
    await audit(page, 'login');
  });

  test('القائمة واللوحة والتفاصيل والنوافذ', async ({ page }) => {
    await login(page, 'manager');
    await audit(page, 'tasks list');
    await page.getByTestId('mode-board').click();
    await expect(page.getByTestId('task-board')).toBeVisible();
    await audit(page, 'tasks board');
    await page.getByTestId('mode-list').click();
    await openTask(page, 'T-1046');
    await audit(page, 'task panel');
    await page.getByTestId('transition-IN_PROGRESS').click();
    await expect(page.getByRole('dialog', { name: 'سبب الإعادة' })).toBeVisible();
    await audit(page, 'reason dialog');
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await page.getByTestId('new-task').click();
    await expect(page.getByTestId('task-form')).toBeVisible();
    await page.getByTestId('submit-task').click();
    await audit(page, 'task form with errors');
  });

  test('حالة فارغة وشاشات الإدارة', async ({ page }) => {
    await login(page, 'admin');
    await page.getByTestId('search').fill('لا يوجد');
    await expect(page.getByTestId('empty-state')).toBeVisible();
    await audit(page, 'empty state');
    await page.goto('/admin/users');
    await expect(page.getByRole('heading', { name: 'المستخدمون' })).toBeVisible();
    await audit(page, 'admin users');
    await page.goto('/admin/departments');
    await expect(page.getByRole('heading', { name: 'الإدارات' })).toBeVisible();
    await audit(page, 'admin departments');
  });

  test('لغة الصفحة واتجاهها', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  });
});
