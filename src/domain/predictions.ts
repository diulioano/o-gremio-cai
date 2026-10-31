// Palpites do visitante: funções puras que recebem os palpites e devolvem uma cópia nova.
import type { Match, Prepared } from './prepare';
import { drawGoals } from './rng';

export interface Prediction {
  h: number;
  a: number;
  /** sorteado por "Simular até o fim" (pode ser refeito); sem auto = feito à mão */
  auto?: 1;
}
export type Predictions = Record<string, Prediction>;
export type Outcome = 'V' | 'E' | 'D';
export type Side = 'h' | 'a';

const clamp = (n: number) => Math.max(0, Math.min(9, n));
const key = (id: number) => String(id);
const manual = (p: Predictions, id: number): Prediction => {
  const c = p[key(id)];
  return { h: c?.h ?? 0, a: c?.a ?? 0 };
};

/** V/E/D preenchem o placar padrão 1x0, 1x1, 0x1. */
export function pick(p: Predictions, id: number, o: Outcome): Predictions {
  return { ...p, [key(id)]: o === 'V' ? { h: 1, a: 0 } : o === 'E' ? { h: 1, a: 1 } : { h: 0, a: 1 } };
}

export function step(p: Predictions, id: number, side: Side, delta: number): Predictions {
  const c = manual(p, id);
  c[side] = clamp(c[side] + delta);
  return { ...p, [key(id)]: c };
}

/** Valor digitado no campo de placar: vale o último dígito; vazio é 0. */
export function setValue(p: Predictions, id: number, side: Side, text: string): Predictions {
  const v = text.replace(/\D/g, '').slice(-1);
  const c = manual(p, id);
  c[side] = v === '' ? 0 : Math.min(9, Number(v));
  return { ...p, [key(id)]: c };
}

/** Sorteia os jogos futuros sem palpite (e refaz os já sorteados); palpites feitos à mão ficam. */
export function fill(
  p: Predictions,
  games: readonly Match[],
  lambda: Prepared['lambda'],
  rng: () => number = Math.random,
): Predictions {
  const out = { ...p };
  for (const g of games) {
    const cur = out[key(g.id)];
    if (g.status !== 'fut' || (cur && !cur.auto)) continue;
    const [lh, la] = lambda(g.home, g.away);
    out[key(g.id)] = { h: drawGoals(lh, rng), a: drawGoals(la, rng), auto: 1 };
  }
  return out;
}

const without = (p: Predictions, ids: readonly number[]): Predictions => {
  const drop = new Set(ids.map(key));
  return Object.fromEntries(Object.entries(p).filter(([k]) => !drop.has(k)));
};

export const clear = (p: Predictions, id: number): Predictions => without(p, [id]);

export const clearRound = (p: Predictions, games: readonly Match[]): Predictions =>
  without(
    p,
    games.map((g) => g.id),
  );

export const predictionFor = (p: Predictions, g: Match): Prediction | undefined =>
  g.status === 'fut' ? p[key(g.id)] : undefined;

export const outcome = (x: Prediction): Outcome => (x.h > x.a ? 'V' : x.h < x.a ? 'D' : 'E');

/** Rodada começada mas não terminada: quantos jogos futuros ainda estão sem palpite (0 se nenhum tem). */
export function missingIn(games: readonly Match[], p: Predictions): number {
  const fut = games.filter((g) => g.status === 'fut');
  const n = fut.filter((g) => !p[key(g.id)]).length;
  return n < fut.length ? n : 0;
}

/** Rodadas com palpites incompletos, em ordem: [rodada, jogos sem palpite]. */
export function incompleteRounds(P: Prepared, p: Predictions): [number, number][] {
  return Object.keys(P.rounds)
    .map(Number)
    .sort((a, b) => a - b)
    .map((r): [number, number] => [r, missingIn(P.rounds[r] ?? [], p)])
    .filter(([, n]) => n > 0);
}
