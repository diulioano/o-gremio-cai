// Grava as fixtures de paridade a partir da versão antiga. Só roda com a tag pre-migracao em checkout
// (usa src/demo.js e as funções globais do public/app.js antigos).
// Uso: com a versão antiga rodando em http://localhost:8787 (npx wrangler dev --port 8787),
//   node tests/visual/capture-fixtures.mjs
import { writeFileSync, readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { demoData } from '../../src/demo.js';

const BASE = process.env.BASE_URL || 'http://localhost:8787';
const payload = { ...demoData(), demo: true, fetchedAt: 0 };
writeFileSync('tests/domain/fixtures/demo-payload.json', JSON.stringify(payload));

const palpites = JSON.parse(readFileSync('tests/visual/fixtures/palpites.json', 'utf8'));
const browser = await chromium.launch();
const page = await browser.newPage();
await page.route('**/api/data', (r) => r.fulfill({ json: payload }));
await page.goto(BASE + '/gremio');
await page.waitForFunction(() => typeof window.compute === 'function');
const expected = await page.evaluate(({ payload, palpites }) => {
  const P = window.prepare(payload);
  const pick = (r) => ({
    table: r.table.map((t) => t.id),
    pts: Object.fromEntries(r.table.map((t) => [t.id, t.pts])),
    pct: r.pct,
    dec: r.dec,
  });
  return { gid: P.gid, current: P.current, real: pick(window.compute(P, {})), comPalpites: pick(window.compute(P, palpites)) };
}, { payload, palpites });
writeFileSync('tests/domain/fixtures/demo-expected.json', JSON.stringify(expected, null, 1));
console.log('gid', expected.gid, 'rodada', expected.current, 'times', expected.real.table.length);
await browser.close();
