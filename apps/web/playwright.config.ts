import { defineConfig } from '@playwright/test';

const port = process.env.PORT ? Number(process.env.PORT) : 3000;

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  reporter: [['html', { open: 'never' }]],
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: `http://localhost:${port}`,
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run start',
    port,
    reuseExistingServer: !process.env.CI,
    env: {
      ...process.env,
      PORT: String(port),
      NEXTAUTH_URL: process.env.NEXTAUTH_URL || `http://localhost:${port}`,
      NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET || 'test-secret',
    },
  },
});
