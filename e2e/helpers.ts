import { expect, type Page } from '@playwright/test';

export async function boot(page: Page, query = 'debug'): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`/?${query}`);
  await expect(page.locator('.plate.big')).toBeVisible({ timeout: 30_000 });
  return errors;
}

export const fp = <T>(page: Page, fn: string, ...args: unknown[]): Promise<T> =>
  page.evaluate(([f, a]) => (window as any).__FP__[f as string](...(a as unknown[])), [fn, args] as const) as Promise<T>;

export async function startViaMenus(page: Page, member: string): Promise<void> {
  await page.locator('.plate.big').click();
  await page.locator(`.card[data-id=${member}]`).click();
  await page.locator('[data-act=start]').click();
  await page.locator('[data-act=skip]').click();
  await expect.poll(async () => (await fp<any>(page, 'state')).started, { timeout: 30_000 }).toBe(true);
}
