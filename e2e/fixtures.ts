import { test as base, expect, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { seed, SEED_PASSWORD, USERS } from '../prisma/seedData';
import { E2E_DB } from '../playwright.config';

export const db = new PrismaClient({ datasources: { db: { url: E2E_DB } } });

export type SeedUser = keyof typeof USERS;

export async function login(page: Page, user: SeedUser) {
  await page.goto('/login');
  await page.getByLabel('البريد الإلكتروني المؤسسي').fill(USERS[user].email);
  await page.getByLabel('كلمة المرور').fill(SEED_PASSWORD);
  await page.getByRole('button', { name: 'دخول' }).click();
  await page.waitForURL('**/tasks');
  await expect(page.getByTestId('task-table').or(page.getByTestId('empty-state'))).toBeVisible();
}

export const row = (page: Page, code: string) => page.getByTestId(`row-${code}`);

export async function openTask(page: Page, code: string) {
  await row(page, code).getByRole('button', { name: code }).click();
  const panel = page.getByTestId('task-panel');
  await expect(panel.getByTestId('panel-title')).toBeVisible();
  return panel;
}

/** كل اختبار يبدأ من بيانات Seed نظيفة */
export const test = base.extend({
  page: async ({ page }, use) => {
    await seed(db);
    await use(page);
  },
});

export { expect };
