import { describe, expect, it } from 'vitest';
import { detectGoalTeams } from '../../src/domain/live';
import { pctLabel } from '../../src/domain/format';
import { prepare } from '../../src/domain/prepare';
import { computeTable, simulate } from '../../src/domain/simulate';
import { verdict } from '../../src/domain/verdict';
import type { SlimMatch } from '../../src/shared/api';
import { match, payload } from './helpers';

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

describe('pontuação ao vivo — invariantes do domínio', () => {
  it('contabilidade exata (P = 3V+E, ΣSG = 0, ΣJ = 2*(fin + live válidos)) e ignora jogo ao vivo com placar null', () => {
    const games: SlimMatch[] = [
      match(1, 1, 2, [2, 1], 'FINISHED'),
      match(1, 3, 4, [0, 0], 'FINISHED'),
      match(1, 5, 6, [1, 3], 'FINISHED'),
      // 2 jogos ao vivo válidos + 1 ao vivo com placar null
      match(2, 1, 3, [1, 0], 'IN_PLAY'),
      match(2, 2, 4, [2, 2], 'PAUSED'),
      match(2, 5, 6, undefined, 'IN_PLAY'),
      // jogo futuro
      match(3, 1, 6, undefined, 'TIMED'),
    ];
    const P = prepare(payload(games), null);
    const res = simulate(P, {});

    for (const r of res.table) {
      expect(r.pts).toBe(3 * r.v + r.e);
      expect(r.j).toBe(r.v + r.e + r.d);
      expect(r.sg).toBe(r.gp - r.gc);
    }
    expect(sum(res.table.map((r) => r.sg))).toBe(0);
    // 3 encerrados + 2 ao vivo com placar válido = 5 jogos contabilizados → ΣJ = 10
    expect(sum(res.table.map((r) => r.j))).toBe(10);
    // times 5 e 6 têm jogo ao vivo com placar null → não entram em res.live nem somam J extra
    expect(res.table.find((r) => r.id === 5)?.j).toBe(1);
    expect(res.table.find((r) => r.id === 6)?.j).toBe(1);
    expect(res.live).toEqual({
      1: { gf: 1, ga: 0 },
      3: { gf: 0, ga: 1 },
      2: { gf: 2, ga: 2 },
      4: { gf: 2, ga: 2 },
    });
  });

  it('jogos ao vivo não contaminam P.base nem a força de ataque/defesa (lambda)', () => {
    const fin = [match(1, 1, 2, [2, 0], 'FINISHED'), match(1, 3, 4, [1, 1], 'FINISHED')];
    const pWithout = prepare(payload([...fin, match(2, 1, 3, undefined, 'TIMED')]), null);
    const pWith0x0 = prepare(payload([...fin, match(2, 1, 3, [0, 0], 'IN_PLAY')]), null);
    const pWith5x0 = prepare(payload([...fin, match(2, 1, 3, [5, 0], 'IN_PLAY')]), null);

    expect(pWith0x0.base).toEqual(pWithout.base);
    expect(pWith5x0.base).toEqual(pWithout.base);
    expect(pWith0x0.lambda(1, 3)).toEqual(pWithout.lambda(1, 3));
    expect(pWith5x0.lambda(1, 3)).toEqual(pWithout.lambda(1, 3));
    expect(pWith5x0.lambda(2, 4)).toEqual(pWithout.lambda(2, 4));
  });

  it('sem dupla contagem no Monte Carlo e sem veredito prematuro (última rodada toda ao vivo)', () => {
    // 6 times (corte em 2; 4 últimos caem).
    // Rodada 1 encerrada: 1(3pts), 2(3pts), 3(1pt), 4(1pt), 5(0pts), 6(0pts).
    // Última rodada (2) toda IN_PLAY: ninguém ainda está matematicamente salvo ou rebaixado!
    const games = [
      match(1, 1, 5, [1, 0], 'FINISHED'),
      match(1, 2, 6, [1, 0], 'FINISHED'),
      match(1, 3, 4, [0, 0], 'FINISHED'),
      match(2, 1, 2, [0, 1], 'IN_PLAY'),
      match(2, 3, 5, [0, 2], 'IN_PLAY'),
      match(2, 4, 6, [0, 2], 'IN_PLAY'),
    ];
    const P = prepare(payload(games), null);
    const ct = computeTable(P, {});
    expect(ct.rem).toHaveLength(0);
    expect(ct.mathRem).toHaveLength(3);

    const res = simulate(P, {});
    expect(res.final).toBe(false);
    // Todos ainda têm jogo em andamento e podem mudar de zona → nenhum badge prematuro!
    for (const id of [1, 2, 3, 4, 5, 6]) {
      expect(res.dec[id]).toBeNull();
      const v = verdict(res, id);
      expect(v?.badge).toBeNull();
      // Sem decisão matemática, 0/1 vira '<1%' / '>99%' e nunca '0%' / '100%'
      expect(['<1%', '>99%']).toContain(pctLabel(res.pct[id] ?? 0, res.dec[id] ?? null));
    }
    expect(sum(Object.values(res.pct))).toBeCloseTo(4, 6);
  });

  it('time já rebaixado matematicamente antes do jogo ao vivo mantém dec="reb"', () => {
    // 6 times (corte = 2). Times 1..5 têm 6 pts; time 6 tem 0 pts com só 1 jogo ao vivo restante (máx 3 pts < 6).
    const games = [
      match(1, 1, 6, [1, 0], 'FINISHED'),
      match(1, 2, 6, [1, 0], 'FINISHED'),
      match(1, 3, 6, [1, 0], 'FINISHED'),
      match(1, 4, 6, [1, 0], 'FINISHED'),
      match(1, 5, 6, [1, 0], 'FINISHED'),
      match(2, 1, 2, [1, 0], 'FINISHED'),
      match(2, 3, 4, [1, 0], 'FINISHED'),
      match(2, 5, 6, [0, 1], 'IN_PLAY'), // time 6 está vencendo, mas já está matematicamente rebaixado!
    ];
    const P = prepare(payload(games), null);
    const res = simulate(P, {});
    expect(res.final).toBe(false);
    expect(res.dec[6]).toBe('reb');
    expect(verdict(res, 6)?.badge).toBe('REBAIXADO');
  });

  it('ciclo de vida completo (TIMED → IN_PLAY null → 0x0 → 1x0 → PAUSED → virada 1x2 → FINISHED) + palpites futuros', () => {
    const base = [
      match(1, 1, 2, [1, 0], 'FINISHED'),
      match(1, 3, 4, [1, 0], 'FINISHED'),
      match(1, 5, 6, [1, 0], 'FINISHED'),
    ];
    const fut = match(3, 5, 6, undefined, 'TIMED');
    const liveId = 999;
    const mkLive = (status: string, score?: [number, number]): SlimMatch => ({
      ...match(2, 2, 4, score, status),
      id: liveId,
    });

    const run = (m: SlimMatch, pal: Record<string, { h: number; a: number }> = {}) =>
      simulate(prepare(payload([...base, m, fut]), null), pal);

    // 1. TIMED
    const s1 = run(mkLive('TIMED'));
    expect(s1.table.find((r) => r.id === 2)?.pts).toBe(0);
    expect(s1.live).toEqual({});

    // 2. IN_PLAY com placar null → ignorado na tabela
    const s2 = run(mkLive('IN_PLAY'));
    expect(s2.table.find((r) => r.id === 2)?.pts).toBe(0);
    expect(s2.live).toEqual({});

    // 3. IN_PLAY 0x0 → +1 pt para cada
    const s3 = run(mkLive('IN_PLAY', [0, 0]));
    expect(s3.table.find((r) => r.id === 2)).toMatchObject({ pts: 1, j: 2, e: 1, sg: -1 });
    expect(s3.live[2]).toEqual({ gf: 0, ga: 0 });

    // 4. Gol do mandante (1x0) e intervalo (PAUSED)
    const s4 = run(mkLive('PAUSED', [1, 0]));
    expect(s4.table.find((r) => r.id === 2)).toMatchObject({ pts: 3, j: 2, v: 1, sg: 0 });
    expect(s4.table.find((r) => r.id === 4)).toMatchObject({ pts: 0, j: 2, d: 2, sg: -2 });
    expect(s4.live[2]).toEqual({ gf: 1, ga: 0 });
    expect(s4.live[4]).toEqual({ gf: 0, ga: 1 });

    // 5. Virada (1x2) + palpite do usuário no jogo futuro (e palpite velho no jogo ao vivo é ignorado)
    const pal = { [String(fut.id)]: { h: 0, a: 2 }, [String(liveId)]: { h: 9, a: 0 } };
    const s5Real = run(mkLive('IN_PLAY', [1, 2]));
    const s5Sim = run(mkLive('IN_PLAY', [1, 2]), pal);
    expect(s5Real.table.find((r) => r.id === 2)).toMatchObject({ pts: 0, j: 2, d: 2 });
    expect(s5Real.table.find((r) => r.id === 4)).toMatchObject({ pts: 3, j: 2, v: 1 });
    expect(s5Sim.table.find((r) => r.id === 6)).toMatchObject({ pts: 3, j: 2, v: 1 });
    // palpite antigo no jogo liveId foi ignorado
    expect(s5Sim.table.find((r) => r.id === 2)?.pts).toBe(0);

    // 6. Encerrado (FINISHED 1x2) → sai de res.live, mantém os mesmos pontos
    const s6 = run(mkLive('FINISHED', [1, 2]));
    expect(s6.live).toEqual({});
    expect(s6.table.find((r) => r.id === 4)).toMatchObject({ pts: 3, j: 2, v: 1 });
    expect(s6.table.find((r) => r.id === 2)).toMatchObject({ pts: 0, j: 2, d: 2 });
  });
});

describe('detectGoalTeams', () => {
  it('detecta apenas gols novos em jogos ao vivo entre payloads consecutivos', () => {
    const m0: SlimMatch = { ...match(1, 10, 20, [0, 0], 'IN_PLAY'), id: 50 };
    const m1: SlimMatch = { ...m0, hs: 1, as: 0 };
    const m2: SlimMatch = { ...m0, hs: 1, as: 1 };
    const mFin: SlimMatch = { ...m0, status: 'FINISHED', hs: 2, as: 1 };

    expect(detectGoalTeams(null, payload([m1]))).toEqual([]);
    expect(detectGoalTeams(payload([m0]), payload([m0]))).toEqual([]);
    expect(detectGoalTeams(payload([m0]), payload([m1]))).toEqual([10]);
    expect(detectGoalTeams(payload([m1]), payload([m2]))).toEqual([20]);
    expect(detectGoalTeams(payload([m2]), payload([mFin]))).toEqual([]);
  });
});
