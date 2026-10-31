import type { Predictions } from './predictions';
import type { Match, Prepared } from './prepare';
import { mulberry } from './rng';
import { compareStandings, play, type StandingRow } from './standings';

export const N_SIM = 5000;

const add = (arr: Int32Array | Float64Array, i: number, d: number) => {
  arr[i] = (arr[i] ?? 0) + d;
};

export type Decision = 'salvo' | 'reb' | null;

export interface SimulationResult {
  table: StandingRow[];
  /** chance de cair, de 0 a 1 */
  pct: Record<number, number>;
  /** decidido matematicamente: salvo, rebaixado ou ainda em aberto */
  dec: Record<number, Decision>;
  /** sem jogos para sortear (fim do campeonato ou tudo palpitado): a tabela exibida é a final */
  final: boolean;
}

/** Tabela com os palpites aplicados (só em jogos futuros) e os jogos que sobram para sortear. */
export function computeTable(P: Prepared, pal: Predictions) {
  const st: Record<number, StandingRow> = {};
  for (const id of P.ids) st[id] = { ...(P.base[id] as StandingRow) };
  const row = (id: number) => st[id] as StandingRow;
  const rem: Match[] = [];
  for (const g of P.matches) {
    if (g.status === 'fin') continue;
    const p = g.status === 'fut' ? pal[String(g.id)] : undefined;
    if (p) play(row(g.home), row(g.away), p.h, p.a);
    else rem.push(g);
  }
  const table = P.ids.map(row).sort(compareStandings);
  return { row, table, rem };
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
  const { row, table, rem } = computeTable(P, pal);
  const n = ids.length;
  const idx = new Map(ids.map((id, i) => [id, i]));
  const at = (id: number) => idx.get(id) ?? 0;
  const pts0 = Int32Array.from(ids, (id) => row(id).pts),
    v0 = Int32Array.from(ids, (id) => row(id).v);
  const sg0 = Int32Array.from(ids, (id) => row(id).sg),
    gp0 = Int32Array.from(ids, (id) => row(id).gp);
  const left = new Int32Array(n);
  const games = rem.map((g) => {
    const h = at(g.home),
      a = at(g.away);
    add(left, h, 1);
    add(left, a, 1);
    const [lh, la] = P.lambda(g.home, g.away);
    return [h, a, Math.exp(-lh), Math.exp(-la)] as const;
  });
  const cut = Math.max(0, n - 4);
  const pct: Record<number, number> = {},
    dec: Record<number, Decision> = {};

  // sem jogos restantes (fim do campeonato ou tudo palpitado), a posição final decide, inclusive no desempate
  if (!rem.length) {
    table.forEach((t, k) => {
      const out = k >= cut;
      pct[t.id] = out ? 1 : 0;
      dec[t.id] = out ? 'reb' : 'salvo';
    });
    return { table, pct, dec, final: true };
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
    dec[id] = decide(i, pts0, left, cut);
  });
  return { table, pct, dec, final: false };
}
