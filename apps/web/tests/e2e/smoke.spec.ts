import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

test('login and chat flow', async ({ page }) => {
  const resultsDir = path.resolve('test-results');
  fs.mkdirSync(resultsDir, { recursive: true });

  const tenantCode = process.env.E2E_TENANT_CODE || '0001';
  const email = process.env.E2E_EMAIL || 'admin@gmail.com';
  const password = process.env.E2E_PASSWORD || '123456';
  const message = process.env.E2E_MESSAGE || 'E2E テスト: これは長文の入力です。'.repeat(10);

  const stamp = () => new Date().toISOString().replace(/[:.]/g, '-');
  const sanitize = (label: string) => label.replace(/[^a-zA-Z0-9_-]+/g, '_').toLowerCase();

  const attachUrl = async (label: string) => {
    await test.info().attach(`${label}-url`, {
      body: page.url(),
      contentType: 'text/plain',
    });
  };

  const attachDomShot = async (label: string) => {
    if (page.isClosed()) return;
    try {
      let region = page.locator('main');
      if (await region.count() === 0) {
        region = page.locator('body');
      }
      const fileName = `${sanitize(label)}-dom-${stamp()}.png`;
      const filePath = path.join(resultsDir, fileName);
      const shot = await region.screenshot({ path: filePath });
      await test.info().attach(`${label}-dom`, { body: shot, contentType: 'image/png' });
    } catch {
      // Ignore screenshot failures caused by page teardown.
    }
  };

  const attachFullShot = async (label: string) => {
    if (page.isClosed()) return;
    try {
      const fileName = `${sanitize(label)}-${stamp()}.png`;
      const filePath = path.join(resultsDir, fileName);
      const shot = await page.screenshot({ fullPage: true, path: filePath });
      await test.info().attach(label, { body: shot, contentType: 'image/png' });
    } catch {
      // Ignore screenshot failures caused by page teardown.
    }
  };

  await page.goto('/auth/signin', { waitUntil: 'domcontentloaded' });
  await expect(page.getByLabel('テナントコード')).toBeVisible();
  await expect(page.getByLabel('メールアドレス')).toBeVisible();
  await expect(page.getByLabel('パスワード')).toBeVisible();

  await page.getByLabel('テナントコード').fill(tenantCode);
  await page.getByLabel('メールアドレス').fill(email);
  await page.getByLabel('パスワード').fill(password);
  await page.getByRole('button', { name: 'ログイン' }).click();

  const loginError = page.getByText('ログイン情報が正しくありません');
  const navSucceeded = await page
    .waitForURL(/\/(dashboard|chat)/, { timeout: 30_000 })
    .then(() => true)
    .catch(() => false);

  if (!navSucceeded) {
    if (await loginError.isVisible().catch(() => false)) {
      await test.info().attach('login-error-text', {
        body: 'ログイン情報が正しくありません',
        contentType: 'text/plain',
      });
    }
    await attachUrl('login-failed');
    await attachDomShot('login-failed');
    await attachFullShot('login-failed');
    throw new Error(`Login did not navigate. url=${page.url()}`);
  }

  await page.waitForLoadState('domcontentloaded');
  await attachFullShot('after-login');
  const currentPath = new URL(page.url()).pathname;
  if (currentPath !== '/chat') {
    await page.goto('/chat', { waitUntil: 'domcontentloaded' });
    await page.waitForURL('**/chat', { timeout: 30_000 });
  }
  await attachFullShot('chat-page');

  const input = page.getByPlaceholder('メッセージを入力...');
  await expect(input).toBeVisible();
  await input.fill(message);
  await page.getByRole('button', { name: '送信' }).click();
  await attachFullShot('after-send');

  await page.waitForFunction(() => {
    const items = document.querySelectorAll('.chat-answer-container');
    return items.length >= 2;
  }, { timeout: 60_000 });

  await attachFullShot('after-reply');
});
