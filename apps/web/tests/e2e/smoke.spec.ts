import { expect, test } from '@playwright/test';

test('homepage renders a body element', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('body')).toBeVisible();
});
