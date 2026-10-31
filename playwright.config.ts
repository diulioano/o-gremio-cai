import { defineConfig, devices } from '@playwright/test';

// Regressão visual: compara cada tela com o baseline (regravado na spec 003, com o compartilhar e a votação).
// BASE_URL aponta para o servidor a comparar; sem ela, o próprio Playwright sobe o build novo.
const external = !!process.env.BASE_URL;

export default defineConfig({
  testDir: 'tests/visual',
  testMatch: '*.spec.ts',
  snapshotPathTemplate: 'tests/visual/__baseline__/{arg}{ext}',
  fullyParallel: true,
  // o workerd do preview às vezes derruba conexões com muitas abas ao mesmo tempo; uma regressão visual
  // real falha nas duas tentativas
  workers: 4,
  retries: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:8787',
    reducedMotion: 'reduce',
  },
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.01 } },
  projects: [
    {
      name: 'mobile',
      use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 }, browserName: 'chromium' },
    },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
  ],
  webServer: external
    ? undefined
    : {
        command: 'npm run build && npm run preview -- --port 8787 --strictPort',
        url: 'http://localhost:8787',
        reuseExistingServer: true,
        timeout: 180_000,
      },
});
