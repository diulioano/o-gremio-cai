import { readFileSync } from 'node:fs';
import { test, expect, type Page } from '@playwright/test';

const payload = readFileSync('tests/domain/fixtures/demo-payload.json', 'utf8');
const palpites = readFileSync('tests/visual/fixtures/palpites.json', 'utf8');
// escudo fixo no lugar dos PNGs da football-data.org, para a tela não depender da rede
const crest = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" fill="#8C98A8"/></svg>',
);

const PAGES = ['', 'gremio', 'inter', 'corinthians', 'vasco', 'botafogo', 'coritiba', 'vitoria', 'mirassol', 'remo'];
const STATES = { real: null, palpites } as const;

async function setup(page: Page, pal: string | null) {
  await page.route('**/api/data', (r) => r.fulfill({ contentType: 'application/json', body: payload }));
  await page.route('https://crests.football-data.org/**', (r) => r.fulfill({ contentType: 'image/svg+xml', body: crest }));
  await page.addInitScript((p) => {
    localStorage.clear();
    if (p) localStorage.setItem('gremiocai-palpites-v1', p);
  }, pal);
}

for (const slug of PAGES) {
  for (const [state, pal] of Object.entries(STATES)) {
    test(`${slug || 'home'} ${state}`, async ({ page }, info) => {
      await setup(page, pal);
      await page.goto('/' + slug);
      await expect(page.getByText('Dados de demonstração', { exact: false })).toBeVisible();
      await page.waitForLoadState('networkidle');
      await page.evaluate(() => document.fonts.ready);
      await expect(page).toHaveScreenshot(`${slug || 'home'}-${state}-${info.project.name}.png`, { fullPage: true });
    });
  }
}
