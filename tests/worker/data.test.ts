// GET /api/data: specs/001-migracao-framework-web/contracts/api-data.md.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CACHE_KEY, getData, slim, type FdResponse } from '../../src/worker/data';
import type { DataError, DataPayload } from '../../src/shared/api';

const fd: FdResponse = {
  matches: [
    {
      id: 1,
      matchday: 33,
      status: 'FINISHED',
      utcDate: '2026-11-01T19:00:00Z',
      homeTeam: { id: 1767, name: 'Grêmio FBPA', shortName: 'Grêmio', tla: 'FBP', crest: 'g.png' },
      awayTeam: { id: 6684, name: 'Internacional', shortName: null, tla: 'INT', crest: null },
      score: { fullTime: { home: 2, away: 1 } },
    },
  ],
};

function fakeEnv(token: string, cached?: DataPayload) {
  const store = new Map<string, string>();
  if (cached) store.set(CACHE_KEY, JSON.stringify(cached));
  const CACHE = {
    get: (k: string) => Promise.resolve(store.has(k) ? (JSON.parse(store.get(k) ?? '') as unknown) : null),
    put: (k: string, v: string) => {
      store.set(k, v);
      return Promise.resolve();
    },
  };
  return { env: { FOOTBALL_DATA_TOKEN: token, CACHE } as unknown as Env, store };
}
const waits: Promise<unknown>[] = [];
const ctx = { waitUntil: (p: Promise<unknown>) => waits.push(p), passThroughOnException: () => undefined } as unknown as ExecutionContext;

afterEach(() => {
  vi.restoreAllMocks();
});

describe('getData', () => {
  it('sem token: dados demo', async () => {
    const r = await getData(fakeEnv('').env, ctx);
    expect(r.status).toBe(200);
    expect(r.headers.get('content-type')).toBe('application/json; charset=utf-8');
    expect(r.headers.get('cache-control')).toBe('public, max-age=300');
    const body = await r.json<DataPayload>();
    expect(body.demo).toBe(true);
    expect(body.matches).toHaveLength(380);
  });

  it('cópia do KV com menos de 1 h: devolve sem buscar', async () => {
    const spy = vi.spyOn(globalThis, 'fetch');
    const cached = { fetchedAt: Date.now() - 10 * 60_000, matches: [] };
    const r = await getData(fakeEnv('t', cached).env, ctx);
    expect(await r.json()).toEqual(cached);
    expect(spy).not.toHaveBeenCalled();
  });

  it('cópia vencida: busca, enxuga e grava no KV', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json(fd));
    const { env, store } = fakeEnv('t', { fetchedAt: 0, matches: [] });
    const body = await (await getData(env, ctx)).json<DataPayload>();
    await Promise.all(waits);
    expect(body.matches[0]?.h.name).toBe('Grêmio');
    expect(JSON.parse(store.get(CACHE_KEY) ?? '')).toEqual(body);
  });

  it('API falha com cópia: devolve a cópia marcada stale', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('x', { status: 500 }));
    const cached = { fetchedAt: 0, matches: [] };
    const body = await (await getData(fakeEnv('t', cached).env, ctx)).json<DataPayload>();
    expect(body).toEqual({ ...cached, stale: true });
  });

  it('API falha sem cópia: 502', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('x', { status: 429 }));
    const r = await getData(fakeEnv('t').env, ctx);
    expect(r.status).toBe(502);
    expect(await r.json<DataError>()).toEqual({ error: 'football-data 429' });
  });
});

describe('slim', () => {
  it('usa shortName ou name e o placar fullTime', () => {
    const m = slim(fd).matches[0];
    expect(m).toEqual({
      id: 1,
      md: 33,
      status: 'FINISHED',
      utc: '2026-11-01T19:00:00Z',
      h: { id: 1767, name: 'Grêmio', tla: 'FBP', crest: 'g.png' },
      a: { id: 6684, name: 'Internacional', tla: 'INT', crest: null },
      hs: 2,
      as: 1,
    });
  });
});
