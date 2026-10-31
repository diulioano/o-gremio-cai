// Cron de atualização: specs/002-atualizacao-por-minuto/contracts/scheduled.md.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CACHE_KEY, slim, type FdResponse } from '../../src/worker/data';
import { refresh } from '../../src/worker/refresh';
import type { DataPayload } from '../../src/shared/api';

const MIN = 60_000;
const KICKOFF = Date.parse('2026-11-01T19:00:00Z');

type Fd = FdResponse['matches'][number];
function fdMatch(id: number, utcDate: string, status = 'TIMED', home: number | null = null): Fd {
  return {
    id,
    matchday: 33,
    status,
    utcDate,
    homeTeam: { id: 1767, name: 'Grêmio', tla: 'FBP', crest: null },
    awayTeam: { id: 6684, name: 'Internacional', tla: 'INT', crest: null },
    score: { fullTime: { home, away: home === null ? null : 0 } },
  };
}
const one = (status = 'TIMED', home: number | null = null): FdResponse => ({
  matches: [fdMatch(1, '2026-11-01T19:00:00Z', status, home)],
});

/** KV em memória que conta as gravações. */
function fakeEnv(token: string, cached?: DataPayload) {
  const store = new Map<string, string>();
  if (cached) store.set(CACHE_KEY, JSON.stringify(cached));
  let puts = 0;
  const CACHE = {
    get: (k: string) => Promise.resolve(store.has(k) ? (JSON.parse(store.get(k) ?? '') as unknown) : null),
    put: (k: string, v: string) => {
      puts++;
      store.set(k, v);
      return Promise.resolve();
    },
  };
  const env = { FOOTBALL_DATA_TOKEN: token, CACHE } as unknown as Env;
  return {
    env,
    store,
    puts: () => puts,
    saved: () => JSON.parse(store.get(CACHE_KEY) ?? 'null') as DataPayload | null,
  };
}

/** O que já estaria guardado no KV: a resposta da fonte enxuta, conferida em `fetchedAt`. */
function snapshot(fd: FdResponse, fetchedAt: number): DataPayload {
  return { ...slim(fd), fetchedAt };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('refresh', () => {
  it('sem token: não faz nada', async () => {
    const spy = vi.spyOn(globalThis, 'fetch');
    const k = fakeEnv('');
    await refresh(k.env, KICKOFF);
    expect(spy).not.toHaveBeenCalled();
    expect(k.puts()).toBe(0);
  });

  it('KV vazio: busca e grava', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json(one()));
    const k = fakeEnv('t');
    await refresh(k.env, KICKOFF + 17 * MIN);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(k.puts()).toBe(1);
    expect(k.saved()?.fetchedAt).toBe(KICKOFF + 17 * MIN);
  });

  it('fora de jogo: só consulta no minuto 0', async () => {
    const snap = snapshot(one('FINISHED', 1), KICKOFF);
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json(one('FINISHED', 1)));
    await refresh(fakeEnv('t', snap).env, KICKOFF + 5 * 60 * MIN + 17 * MIN);
    expect(spy).not.toHaveBeenCalled();
    await refresh(fakeEnv('t', snap).env, KICKOFF + 5 * 60 * MIN);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('ao vivo, nada mudou e pulso não venceu: consulta mas não grava', async () => {
    const t = KICKOFF + 10 * MIN;
    const snap = snapshot(one('IN_PLAY', 0), t - 2 * MIN);
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json(one('IN_PLAY', 0)));
    const k = fakeEnv('t', snap);
    await refresh(k.env, t);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(k.puts()).toBe(0);
  });

  it('ao vivo, nada mudou e pulso de 5 min venceu: grava', async () => {
    const t = KICKOFF + 10 * MIN;
    const snap = snapshot(one('IN_PLAY', 0), t - 5 * MIN);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json(one('IN_PLAY', 0)));
    const k = fakeEnv('t', snap);
    await refresh(k.env, t);
    expect(k.puts()).toBe(1);
  });

  it('ao vivo, saiu gol: grava o placar novo', async () => {
    const t = KICKOFF + 10 * MIN;
    const snap = snapshot(one('IN_PLAY', 0), t - MIN);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json(one('IN_PLAY', 1)));
    const k = fakeEnv('t', snap);
    await refresh(k.env, t);
    expect(k.puts()).toBe(1);
    expect(k.saved()?.matches[0]?.hs).toBe(1);
    expect(k.saved()?.fetchedAt).toBe(t);
  });

  it('fonte recusa (429): não grava nem lança erro', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const t = KICKOFF + 10 * MIN;
    const snap = snapshot(one('IN_PLAY', 0), t - 30 * MIN);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('x', { status: 429 }));
    const k = fakeEnv('t', snap);
    await expect(refresh(k.env, t)).resolves.toBeUndefined();
    expect(k.puts()).toBe(0);
    expect(warn).toHaveBeenCalled();
  });

  it('fora de jogo, nada mudou: grava só com 60 min de pulso', async () => {
    const t = KICKOFF + 5 * 60 * MIN;
    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(Response.json(one('FINISHED', 1))),
    );
    const recent = fakeEnv('t', snapshot(one('FINISHED', 1), t - 59 * MIN));
    await refresh(recent.env, t);
    expect(recent.puts()).toBe(0);
    const old = fakeEnv('t', snapshot(one('FINISHED', 1), t - 60 * MIN));
    await refresh(old.env, t);
    expect(old.puts()).toBe(1);
  });
});

describe('um dia de rodada inteiro (SC-002, SC-003)', () => {
  const DAY = Date.parse('2026-11-01T00:00:00Z');
  const kickoffs = [
    '16:00',
    '16:00',
    '18:30',
    '18:30',
    '19:00',
    '20:00',
    '21:30',
    '21:30',
    '21:30',
    '21:30',
  ].map((h) => Date.parse(`2026-11-01T${h}:00Z`));

  /** O que a fonte diria no instante t: 1º tempo 45 min, intervalo 15, 2º tempo 50, gols do mandante aos 20 e 80. */
  function sourceAt(t: number): FdResponse {
    return {
      matches: kickoffs.map((k, i) => {
        const m = (t - k) / MIN;
        const status =
          m < 0 ? 'TIMED' : m < 45 ? 'IN_PLAY' : m < 60 ? 'PAUSED' : m < 110 ? 'IN_PLAY' : 'FINISHED';
        const goals = m < 0 ? null : (m >= 20 ? 1 : 0) + (m >= 80 ? 1 : 0);
        return fdMatch(i + 1, new Date(k).toISOString(), status, goals);
      }),
    };
  }

  it('fica abaixo de 700 gravações e de 1 consulta por minuto', async () => {
    let clock = DAY;
    let calls = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
      calls++;
      return Promise.resolve(Response.json(sourceAt(clock)));
    });
    const k = fakeEnv('t');
    for (let i = 0; i < 1440; i++) {
      clock = DAY + i * MIN;
      const before = calls;
      await refresh(k.env, clock);
      expect(calls - before).toBeLessThanOrEqual(1);
    }
    expect(k.puts()).toBeLessThan(700);
    expect(k.saved()?.matches.every((m) => m.status === 'FINISHED')).toBe(true);
  });
});
