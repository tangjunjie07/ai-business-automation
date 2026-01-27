import { defineConfig } from '@playwright/test';

const port = process.env.PORT ? Number(process.env.PORT) : 3000;

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
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
    },
  },
});
