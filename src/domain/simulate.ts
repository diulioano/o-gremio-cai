import type { Predictions } from './predictions';
import type { Match, Prepared } from './prepare';
import { mulberry } from './rng';
import { compareStandings, play, type StandingRow } from './standings';

export const N_SIM = 5000;

const add = (arr: Int32Array | Float64Array, i: number, d: number) => {
  arr[i] = (arr[i] ?? 0) + d;
};

export type Decision = 'salvo' | 'reb' | null;

export interface LiveScore {
  /** gols do time no jogo em andamento */
  gf: number;
  /** gols do adversário no jogo em andamento */
  ga: number;
}

export interface SimulationResult {
  table: StandingRow[];
  /** chance de cair, de 0 a 1 */
  pct: Record<number, number>;
  /** decidido matematicamente: salvo, rebaixado ou ainda em aberto */
  dec: Record<number, Decision>;
  /** sem jogos para sortear nem jogos ao vivo (fim do campeonato ou tudo palpitado): a tabela exibida é a final */
  final: boolean;
  /** placar ao vivo sob a perspectiva de cada time que está em campo com placar válido */
  live: Record<number, LiveScore>;
}

/**
 * Tabela exibida (encerrados + jogos ao vivo com placar válido + palpites em jogos futuros)
 * separada da base consolidada (encerrados + palpites), usada para decisão matemática (decide/final).
 */
export function computeTable(P: Prepared, pal: Predictions) {
  const st: Record<number, StandingRow> = {};
  const mathSt: Record<number, StandingRow> = {};
  for (const id of P.ids) {
    st[id] = { ...(P.base[id] as StandingRow) };
    mathSt[id] = { ...(P.base[id] as StandingRow) };
  }
  const row = (id: number) => st[id] as StandingRow;
  const mathRow = (id: number) => mathSt[id] as StandingRow;
  const rem: Match[] = [];
  const mathRem: Match[] = [];
  const live: Record<number, LiveScore> = {};
  for (const g of P.matches) {
    if (g.status === 'fin') continue;
    if (g.status === 'live') {
      // jogo em andamento segue em aberto para a decisão matemática (nunca dispara SALVO/REBAIXADO/CAIU antes do apito final)
      mathRem.push(g);
      if (g.homeGoals != null && g.awayGoals != null) {
        play(row(g.home), row(g.away), g.homeGoals, g.awayGoals);
        live[g.home] = { gf: g.homeGoals, ga: g.awayGoals };
        live[g.away] = { gf: g.awayGoals, ga: g.homeGoals };
      } else {
        rem.push(g);
      }
      continue;
    }
    const p = pal[String(g.id)];
    if (p) {
      play(row(g.home), row(g.away), p.h, p.a);
      play(mathRow(g.home), mathRow(g.away), p.h, p.a);
    } else {
      rem.push(g);
      mathRem.push(g);
    }
  }
  const table = P.ids.map(row).sort(compareStandings);
  return { row, mathRow, table, rem, mathRem, live };
}

/** Salvo se não há times suficientes capazes de alcançá-lo; rebaixado se já há times suficientes
 * acima do máximo que ele ainda pode fazer (empate em pontos fica em aberto pelo desempate). */
export function decide(i: number, pts0: Int32Array, left: Int32Array, cut: number): Decision {
  const at = (arr: Int32Array, k: number) => arr[k] as number;
  const max = at(pts0, i) + 3 * at(left, i);
  let canReach = 0,
    above = 0;
  for (let j = 0; j < pts0.length; j++) {
    if (j === i) continue;
    if (at(pts0, j) + 3 * at(left, j) >= at(pts0, i)) canReach++;
    if (at(pts0, j) > max) above++;
  }
  return canReach < cut ? 'salvo' : above >= cut ? 'reb' : null;
}

/**
 * Monte Carlo dos jogos restantes. A ordem de consumo do rng (gols de cada jogo, mandante e visitante,
 * depois um desempate por time) é a mesma da versão antiga, para as % saírem idênticas.
 */
export function simulate(P: Prepared, pal: Predictions, rng: () => number = mulberry(42)): SimulationResult {
  const { ids } = P;
  const { row, mathRow, table, rem, mathRem, live } = computeTable(P, pal);
  const n = ids.length;
  const idx = new Map(ids.map((id, i) => [id, i]));
  const at = (id: number) => idx.get(id) ?? 0;
  const pts0 = Int32Array.from(ids, (id) => row(id).pts),
    v0 = Int32Array.from(ids, (id) => row(id).v);
  const sg0 = Int32Array.from(ids, (id) => row(id).sg),
    gp0 = Int32Array.from(ids, (id) => row(id).gp);
  const mathPts0 = Int32Array.from(ids, (id) => mathRow(id).pts);
  const mathLeft = new Int32Array(n);
  for (const g of mathRem) {
    add(mathLeft, at(g.home), 1);
    add(mathLeft, at(g.away), 1);
  }
  const games = rem.map((g) => {
    const h = at(g.home),
      a = at(g.away);
    const [lh, la] = P.lambda(g.home, g.away);
    return [h, a, Math.exp(-lh), Math.exp(-la)] as const;
  });
  const cut = Math.max(0, n - 4);
  const pct: Record<number, number> = {},
    dec: Record<number, Decision> = {};

  // sem jogos restantes para sortear: se não há jogos ao vivo, a posição final decide; com jogo ao vivo, dec usa só a base consolidada
  if (!rem.length) {
    const isFinal = !mathRem.length;
    table.forEach((t, k) => {
      const out = k >= cut;
      pct[t.id] = out ? 1 : 0;
      if (isFinal) dec[t.id] = out ? 'reb' : 'salvo';
    });
    if (!isFinal) {
      ids.forEach((id, i) => {
        dec[id] = decide(i, mathPts0, mathLeft, cut);
      });
    }
    return { table, pct, dec, final: isFinal, live };
  }

  const rel = new Float64Array(n);
  const pts = new Int32Array(n),
    v = new Int32Array(n),
    sg = new Int32Array(n),
    gp = new Int32Array(n);
  const tie = new Float64Array(n);
  const ord = ids.map((_, i) => i);
  const pois = (L: number) => {
    let k = 0,
      p = rng();
    while (p > L) {
      k++;
      p *= rng();
    }
    return k;
  };
  const d = (arr: Int32Array | Float64Array, x: number, y: number) => (arr[y] as number) - (arr[x] as number);
  const cmp = (x: number, y: number) =>
    d(pts, x, y) || d(v, x, y) || d(sg, x, y) || d(gp, x, y) || d(tie, x, y);
  for (let s = 0; s < N_SIM; s++) {
    pts.set(pts0);
    v.set(v0);
    sg.set(sg0);
    gp.set(gp0);
    for (const [h, a, Lh, La] of games) {
      const x = pois(Lh),
        y = pois(La);
      add(gp, h, x);
      add(gp, a, y);
      add(sg, h, x - y);
      add(sg, a, y - x);
      if (x > y) {
        add(pts, h, 3);
        add(v, h, 1);
      } else if (x < y) {
        add(pts, a, 3);
        add(v, a, 1);
      } else {
        add(pts, h, 1);
        add(pts, a, 1);
      }
    }
    for (let i = 0; i < n; i++) tie[i] = rng();
    ord.sort(cmp);
    for (let k = cut; k < n; k++) add(rel, ord[k] ?? 0, 1);
  }

  ids.forEach((id, i) => {
    pct[id] = (rel[i] as number) / N_SIM;
    dec[id] = decide(i, mathPts0, mathLeft, cut);
  });
  return { table, pct, dec, final: false, live };
}
