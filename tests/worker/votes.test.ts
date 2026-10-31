// /api/votes com o D1 de verdade (miniflare). Ver specs/003-votacao-rebaixados/contracts/api-votes.md.
import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';
import { DAILY_CAP } from '../../src/domain/votes';
import type { DataPayload, SlimMatch, VoteError, VoteState } from '../../src/shared/api';
import { TEAMS } from '../../src/shared/teams';
import { CACHE_KEY } from '../../src/worker/data';
import { votes } from '../../src/worker/votes';

const URL_ = 'https://vaicair.diuliano.com/api/votes';
const DAY = 24 * 3600_000;
const { gremio, inter, vasco, remo, mirassol } = TEAMS;
const PICKS = [gremio.id, inter.id, vasco.id];

let ipSeq = 0;
/** cada teste usa IPs próprios, para o limitador de um não afetar o outro */
const newIp = () => `203.0.113.${++ipSeq}`;
const uuid = () => crypto.randomUUID();

/** env com a última rodada começando em `closesAt` (padrão: daqui a 30 dias) */
function envClosing(closesAt = Date.now() + 30 * DAY): Env {
  const last: SlimMatch = {
    id: 1,
    md: 38,
    status: 'TIMED',
    utc: new Date(closesAt).toISOString(),
    h: { id: gremio.id, name: 'Grêmio', tla: 'GRE', crest: null },
    a: { id: inter.id, name: 'Inter', tla: 'INT', crest: null },
    hs: null,
    as: null,
  };
  const data: DataPayload = { fetchedAt: Date.now(), matches: [last] };
  const CACHE = { get: (k: string) => Promise.resolve(k === CACHE_KEY ? data : null) };
  return { DB: env.DB, VOTE_LIMITER: env.VOTE_LIMITER, FOOTBALL_DATA_TOKEN: 't', CACHE } as unknown as Env;
}

function post(body: unknown, opts: { ip?: string; headers?: Record<string, string>; raw?: string } = {}) {
  return new Request(URL_, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'cf-connecting-ip': opts.ip ?? newIp(),
      origin: 'https://vaicair.diuliano.com',
      ...opts.headers,
    },
    body: opts.raw ?? JSON.stringify(body),
  });
}

const get = (voter?: string) => new Request(voter ? `${URL_}?voter=${voter}` : URL_);

async function tally(): Promise<Record<number, number>> {
  const { results } = await env.DB.prepare('SELECT team_id, n FROM tally').all<{
    team_id: number;
    n: number;
  }>();
  return Object.fromEntries(results.map((r) => [r.team_id, r.n]));
}

beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM votes'),
    env.DB.prepare('DELETE FROM tally'),
    env.DB.prepare('DELETE FROM daily'),
  ]);
});

describe('POST /api/votes', () => {
  it('201: conta nos 3 times, no total e no dia', async () => {
    const r = await votes(post({ voter: uuid(), picks: PICKS }), envClosing());
    expect(r.status).toBe(201);
    const s = await r.json<VoteState>();
    expect(s.mine).toEqual(PICKS);
    expect(s.total).toBe(1);
    expect(s.warmingUp).toBe(true);
    expect(await tally()).toEqual({ 0: 1, [gremio.id]: 1, [inter.id]: 1, [vasco.id]: 1 });
    const day = await env.DB.prepare('SELECT n FROM daily').first<number>('n');
    expect(day).toBe(1);
  });

  it('pela rota do Worker também', async () => {
    const { exports } = await import('cloudflare:workers');
    const r = await exports.default.fetch(post({ voter: uuid(), picks: PICKS }));
    expect(r.status).toBe(201);
  });

  it('409: mesmo aparelho de novo vale o voto gravado e não conta duas vezes', async () => {
    const voter = uuid();
    await votes(post({ voter, picks: PICKS }), envClosing());
    const r = await votes(post({ voter, picks: [remo.id, mirassol.id, vasco.id] }), envClosing());
    expect(r.status).toBe(409);
    expect((await r.json<VoteState>()).mine).toEqual(PICKS);
    expect((await tally())[0]).toBe(1);
    expect((await tally())[remo.id]).toBeUndefined();
  });

  it('dois envios ao mesmo tempo do mesmo aparelho: um 201, um 409, conta 1', async () => {
    const voter = uuid();
    const rs = await Promise.all([
      votes(post({ voter, picks: PICKS }), envClosing()),
      votes(post({ voter, picks: PICKS }), envClosing()),
    ]);
    expect(rs.map((r) => r.status).sort()).toEqual([201, 409]);
    expect((await tally())[0]).toBe(1);
  });

  it('com 10 votos, quem votou recebe as porcentagens', async () => {
    for (let i = 0; i < 9; i++) await votes(post({ voter: uuid(), picks: PICKS }), envClosing());
    const r = await votes(post({ voter: uuid(), picks: [remo.id, gremio.id, vasco.id] }), envClosing());
    const s = await r.json<VoteState>();
    expect(s.total).toBe(10);
    expect(s.rows?.[0]).toEqual({ id: gremio.id, votes: 10, pct: 100 });
    expect(s.rows?.find((x) => x.id === remo.id)).toEqual({ id: remo.id, votes: 1, pct: 10 });
  });

  it.each([
    ['4 times', { voter: uuid(), picks: [...PICKS, remo.id] }],
    ['2 times', { voter: uuid(), picks: [gremio.id, inter.id] }],
    ['repetido', { voter: uuid(), picks: [gremio.id, gremio.id, inter.id] }],
    ['Chapecoense', { voter: uuid(), picks: [gremio.id, inter.id, 90003] }],
    ['sem voter', { picks: PICKS }],
    ['voter que não é UUID', { voter: "x'; DROP TABLE votes; --", picks: PICKS }],
    ['lista em vez de objeto', [uuid(), PICKS]],
    ['nulo', null],
  ])('400 sem gravar nada: %s', async (_, body) => {
    const r = await votes(post(body), envClosing());
    expect(r.status).toBe(400);
    expect((await r.json<VoteError>()).error).toBe('invalid');
    expect(await tally()).toEqual({});
  });

  it('400: JSON quebrado', async () => {
    const r = await votes(post(null, { raw: '{"voter":' }), envClosing());
    expect(r.status).toBe(400);
  });

  it('400: corpo maior que 1 KB', async () => {
    const big = { voter: uuid(), picks: PICKS, lixo: 'x'.repeat(2000) };
    const r = await votes(post(big), envClosing());
    expect(r.status).toBe(400);
    expect(await tally()).toEqual({});
  });

  it('403: vindo de outro site', async () => {
    const r = await votes(
      post({ voter: uuid(), picks: PICKS }, { headers: { origin: 'https://site-do-mal.com' } }),
      envClosing(),
    );
    expect(r.status).toBe(403);
    expect(await tally()).toEqual({});
  });

  it('403: sem ser JSON (formulário ou text/plain, que pulam a checagem do navegador)', async () => {
    for (const ct of ['text/plain', 'application/x-www-form-urlencoded', 'multipart/form-data']) {
      const r = await votes(
        post({ voter: uuid(), picks: PICKS }, { headers: { 'content-type': ct } }),
        envClosing(),
      );
      expect(r.status).toBe(403);
    }
    expect(await tally()).toEqual({});
  });

  it('410: a última rodada já começou', async () => {
    const r = await votes(post({ voter: uuid(), picks: PICKS }), envClosing(Date.now() - 1000));
    expect(r.status).toBe(410);
    const e = await r.json<VoteError>();
    expect(e.error).toBe('closed');
    expect(e.state?.open).toBe(false);
    expect(await tally()).toEqual({});
  });

  it('503: teto diário atingido', async () => {
    const today = new Date().toISOString().slice(0, 10);
    await env.DB.prepare('INSERT INTO daily (day, n) VALUES (?, ?)').bind(today, DAILY_CAP).run();
    const r = await votes(post({ voter: uuid(), picks: PICKS }), envClosing());
    expect(r.status).toBe(503);
    expect((await r.json<VoteError>()).error).toBe('daily-cap');
    expect((await tally())[0]).toBeUndefined();
  });

  it('429: o 6º envio do mesmo IP em 1 minuto', async () => {
    const ip = newIp();
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) {
      statuses.push((await votes(post({ voter: uuid(), picks: PICKS }, { ip }), envClosing())).status);
    }
    expect(statuses.slice(0, 5)).toEqual([201, 201, 201, 201, 201]);
    expect(statuses[5]).toBe(429);
  });

  it('DEV_VOTES=1 (só no .dev.vars local) libera o limite por IP e o teto diário', async () => {
    const dev = { ...envClosing(), DEV_VOTES: '1' } as Env;
    const today = new Date().toISOString().slice(0, 10);
    await env.DB.prepare('INSERT INTO daily (day, n) VALUES (?, ?)').bind(today, DAILY_CAP).run();
    const ip = newIp();
    for (let i = 0; i < 7; i++) {
      expect((await votes(post({ voter: uuid(), picks: PICKS }, { ip }), dev)).status).toBe(201);
    }
    // sem a variável (produção), o teto do dia volta a valer
    expect((await votes(post({ voter: uuid(), picks: PICKS }, { ip }), envClosing())).status).toBe(503);
  });

  it('nenhuma coluna guarda o IP', async () => {
    const ip = newIp();
    await votes(post({ voter: uuid(), picks: PICKS }, { ip }), envClosing());
    const row = await env.DB.prepare('SELECT * FROM votes').first();
    expect(JSON.stringify(row)).not.toContain(ip);
  });

  it('o banco recusa voto inválido mesmo se escapar do Worker', async () => {
    const bad = env.DB.prepare('INSERT INTO votes (voter, t1, t2, t3, at) VALUES (?, ?, ?, ?, ?)');
    await expect(bad.bind(uuid(), gremio.id, gremio.id, inter.id, 0).run()).rejects.toThrow();
    await expect(bad.bind('curto', gremio.id, inter.id, vasco.id, 0).run()).rejects.toThrow();
  });

  it('405 para outros métodos', async () => {
    const r = await votes(new Request(URL_, { method: 'DELETE' }), envClosing());
    expect(r.status).toBe(405);
  });
});

describe('GET /api/votes', () => {
  async function seed(n: number): Promise<string> {
    let voter = '';
    for (let i = 0; i < n; i++) {
      voter = uuid();
      await votes(post({ voter, picks: PICKS }), envClosing());
    }
    return voter;
  }

  it('quem não votou vê só o total, sem porcentagens', async () => {
    await seed(12);
    for (const voter of [undefined, uuid(), 'nao-e-uuid']) {
      const r = await votes(get(voter), envClosing());
      expect(r.status).toBe(200);
      expect(r.headers.get('cache-control')).toBe('no-store');
      const s = await r.json<VoteState>();
      expect(s).toEqual({ open: true, closesAt: expect.any(Number) as number, total: 12 });
    }
  });

  it('quem votou vê o resultado e o próprio voto', async () => {
    const voter = await seed(12);
    const s = await (await votes(get(voter), envClosing())).json<VoteState>();
    expect(s.mine).toEqual(PICKS);
    expect(s.rows).toHaveLength(9);
    expect(s.rows?.[0]?.pct).toBe(100);
  });

  it('quem votou, com menos de 10 votos: votação começando', async () => {
    const voter = await seed(3);
    const s = await (await votes(get(voter), envClosing())).json<VoteState>();
    expect(s.warmingUp).toBe(true);
    expect(s.rows).toBeUndefined();
  });

  it('votação fechada: resultado para todos', async () => {
    await seed(12);
    const s = await (await votes(get(), envClosing(Date.now() - 1000))).json<VoteState>();
    expect(s.open).toBe(false);
    expect(s.rows).toHaveLength(9);
    expect(s.mine).toBeUndefined();
  });

  it('banco fora do ar: 503 sem vazar detalhes', async () => {
    const broken = {
      ...envClosing(),
      DB: { prepare: () => ({ all: () => Promise.reject(new Error('D1_ERROR: segredo interno')) }) },
    } as unknown as Env;
    const r = await votes(get(), broken);
    expect(r.status).toBe(503);
    const text = await r.text();
    expect(text).not.toContain('segredo');
    expect(JSON.parse(text)).toMatchObject({ error: 'unavailable' });
  });
});
