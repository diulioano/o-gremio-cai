// GET /api/data: specs/001-migracao-framework-web/contracts/api-data.md e o delta em
// specs/002-atualizacao-por-minuto/contracts/api-data.md.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CACHE_KEY, getData, slim, type FdResponse } from '../../src/worker/data';
import type { DataError, DataPayload, SlimMatch } from '../../src/shared/api';

const MIN = 60_000;
const HOUR = 60 * MIN;
/** jogo em andamento: deixa a janela ao vivo aberta em qualquer horário */
function liveMatch(): SlimMatch {
  const t = { id: 1, name: 'T', tla: 'T', crest: null };
  return {
    id: 9,
    md: 33,
    status: 'IN_PLAY',
    utc: new Date().toISOString(),
    h: t,
    a: { ...t, id: 2 },
    hs: 0,
    as: 0,
  };
}

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
const ctx = {
  waitUntil: (p: Promise<unknown>) => waits.push(p),
  passThroughOnException: () => undefined,
} as unknown as ExecutionContext;

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

  it('com cópia no KV: devolve sem consultar a fonte', async () => {
    const spy = vi.spyOn(globalThis, 'fetch');
    const cached = { fetchedAt: Date.now() - 10 * MIN, matches: [] };
    const r = await getData(fakeEnv('t', cached).env, ctx);
    expect(await r.json()).toEqual(cached);
    expect(spy).not.toHaveBeenCalled();
  });

  it('fora de jogo: só fica desatualizada depois de 3 h sem conferir', async () => {
    const ok = { fetchedAt: Date.now() - 2 * HOUR, matches: [] };
    expect(await (await getData(fakeEnv('t', ok).env, ctx)).json()).toEqual(ok);
    const old = { fetchedAt: Date.now() - 3 * HOUR - MIN, matches: [] };
    expect(await (await getData(fakeEnv('t', old).env, ctx)).json()).toEqual({ ...old, stale: true });
  });

  it('ao vivo: fica desatualizada depois de 15 min sem conferir', async () => {
    const matches = [liveMatch()];
    const ok = { fetchedAt: Date.now() - 14 * MIN, matches };
    expect(await (await getData(fakeEnv('t', ok).env, ctx)).json()).toEqual(ok);
    const old = { fetchedAt: Date.now() - 16 * MIN, matches };
    expect(await (await getData(fakeEnv('t', old).env, ctx)).json()).toEqual({ ...old, stale: true });
  });

  it('cache-control: 30 s com jogo ao vivo, 300 s fora', async () => {
    const live = { fetchedAt: Date.now(), matches: [liveMatch()] };
    const idle = { fetchedAt: Date.now(), matches: [] };
    const rl = await getData(fakeEnv('t', live).env, ctx);
    const ri = await getData(fakeEnv('t', idle).env, ctx);
    expect(rl.headers.get('cache-control')).toBe('public, max-age=30');
    expect(ri.headers.get('cache-control')).toBe('public, max-age=300');
  });

  it('KV vazio: busca uma vez, enxuga e grava', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json(fd));
    const { env, store } = fakeEnv('t');
    const body = await (await getData(env, ctx)).json<DataPayload>();
    await Promise.all(waits);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(body.matches[0]?.h.name).toBe('Grêmio');
    expect(JSON.parse(store.get(CACHE_KEY) ?? '')).toEqual(body);
  });

  it('KV vazio e fonte falha: 502', async () => {
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
