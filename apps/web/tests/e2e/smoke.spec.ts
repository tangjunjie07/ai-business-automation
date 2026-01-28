import { expect, test } from '@playwright/test';

test('login and chat flow', async ({ page }) => {
  const tenantCode = process.env.E2E_TENANT_CODE || '0001';
  const email = process.env.E2E_EMAIL || 'admin@gmail.com';
  const password = process.env.E2E_PASSWORD || '123456';
  const message = process.env.E2E_MESSAGE || 'E2E テスト: これは長文の入力です。'.repeat(10);

  await page.goto('/auth/signin', { waitUntil: 'domcontentloaded' });
  await expect(page.getByLabel('テナントコード')).toBeVisible();
  await expect(page.getByLabel('メールアドレス')).toBeVisible();
  await expect(page.getByLabel('パスワード')).toBeVisible();

  await page.getByLabel('テナントコード').fill(tenantCode);
  await page.getByLabel('メールアドレス').fill(email);
  await page.getByLabel('パスワード').fill(password);
  await page.getByRole('button', { name: 'ログイン' }).click();

  const loginError = page.getByText('ログイン情報が正しくありません');
  const result = await Promise.race([
    page.waitForURL(/\/(dashboard|chat)/, { timeout: 30_000 }).then(() => 'nav').catch(() => null),
    loginError.waitFor({ state: 'visible', timeout: 30_000 }).then(() => 'error').catch(() => null),
    page.waitForTimeout(30_000).then(() => 'timeout'),
  ]);

  if (result !== 'nav') {
    const errorShot = await page.screenshot({ fullPage: true, path: 'test-results/login-error.png' });
    await test.info().attach('login-error', { body: errorShot, contentType: 'image/png' });
    throw new Error(`Login did not navigate. result=${result}, url=${page.url()}`);
  }

  await page.waitForLoadState('domcontentloaded');
  const currentPath = new URL(page.url()).pathname;
  if (currentPath !== '/chat') {
    await page.goto('/chat', { waitUntil: 'domcontentloaded' });
    await page.waitForURL('**/chat', { timeout: 30_000 });
  }

  const input = page.getByPlaceholder('メッセージを入力...');
  await expect(input).toBeVisible();
  await input.fill(message);
  await page.getByRole('button', { name: '送信' }).click();

  await page.waitForFunction(() => {
    const items = document.querySelectorAll('.chat-answer-container');
    return items.length >= 2;
  }, { timeout: 60_000 });

  const screenshot = await page.screenshot({ fullPage: true, path: 'test-results/ui-screenshot.png' });
  await test.info().attach('ui-screenshot', {
    body: screenshot,
    contentType: 'image/png',
  });
});
