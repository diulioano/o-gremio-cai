// Rotas HTML: specs/001-migracao-framework-web/contracts/api-data.md ("Contract: rotas HTML").
import { exports } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

const get = (url: string) => exports.default.fetch(new Request(url, { redirect: 'manual' }));

describe('redirect dos subdomínios antigos', () => {
  it('o-inter-cai → /inter (301)', async () => {
    const r = await get('https://o-inter-cai.diuliano.com/qualquer/coisa');
    expect(r.status).toBe(301);
    expect(r.headers.get('location')).toBe('https://vaicair.diuliano.com/inter');
  });

  it('slug desconhecido → raiz', async () => {
    const r = await get('https://a-xyz-cai.diuliano.com/');
    expect(r.status).toBe(301);
    expect(r.headers.get('location')).toBe('https://vaicair.diuliano.com/');
  });
});

describe('páginas', () => {
  it('/Gremio/ vira a página do Grêmio', async () => {
    const r = await get('https://vaicair.diuliano.com/Gremio/');
    expect(r.status).toBe(200);
    const html = await r.text();
    expect(html).toContain('data-team="gremio"');
    expect(html).toContain('<title>O Grêmio cai?</title>');
    expect(html).toMatch(/<meta property="og:title" content="O Grêmio cai\?"/);
    expect(html).toContain('href="/gremio.svg"');
  });

  it('/ é a lista de times, sem data-team', async () => {
    const r = await get('https://vaicair.diuliano.com/');
    expect(r.status).toBe(200);
    expect(await r.text()).not.toContain('data-team');
  });

  it('/flamengo: 404, como na versão antiga', async () => {
    const r = await get('https://vaicair.diuliano.com/flamengo');
    expect(r.status).toBe(404);
  });
});

describe('/crest (proxy dos escudos para o card)', () => {
  it.each(['/crest/png/abc', '/crest/gif/1782', '/crest/png/1782/x', '/crest/png/', '/crest/png/1772_small'])(
    '%s: 404, não vira proxy aberto',
    async (path) => {
      const r = await get(`https://vaicair.diuliano.com${path}`);
      expect(r.status).toBe(404);
    },
  );
});
