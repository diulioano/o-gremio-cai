import { describe, expect, it } from 'vitest';
import { compareStandings, play } from '../../src/domain/standings';
import { row } from './helpers';

describe('play', () => {
  it('vitória do mandante', () => {
    const h = row(1),
      a = row(2);
    play(h, a, 3, 1);
    expect(h).toMatchObject({ pts: 3, j: 1, v: 1, e: 0, d: 0, gp: 3, gc: 1, sg: 2 });
    expect(a).toMatchObject({ pts: 0, j: 1, v: 0, e: 0, d: 1, gp: 1, gc: 3, sg: -2 });
  });

  it('vitória do visitante', () => {
    const h = row(1),
      a = row(2);
    play(h, a, 0, 2);
    expect(h).toMatchObject({ pts: 0, d: 1, sg: -2 });
    expect(a).toMatchObject({ pts: 3, v: 1, sg: 2 });
  });

  it('empate', () => {
    const h = row(1),
      a = row(2);
    play(h, a, 1, 1);
    expect(h).toMatchObject({ pts: 1, e: 1, sg: 0 });
    expect(a).toMatchObject({ pts: 1, e: 1, sg: 0 });
  });
});

describe('compareStandings: pontos, vitórias, saldo, gols pró, nome', () => {
  const order = (...rows: ReturnType<typeof row>[]) => rows.sort(compareStandings).map((r) => r.id);

  it('pontos', () => {
    expect(order(row(1, { pts: 10 }), row(2, { pts: 12 }))).toEqual([2, 1]);
  });
  it('vitórias no empate em pontos', () => {
    expect(order(row(1, { pts: 10, v: 2 }), row(2, { pts: 10, v: 3 }))).toEqual([2, 1]);
  });
  it('saldo no empate em vitórias', () => {
    expect(order(row(1, { pts: 10, v: 3, sg: 1 }), row(2, { pts: 10, v: 3, sg: 4 }))).toEqual([2, 1]);
  });
  it('gols pró no empate em saldo', () => {
    expect(order(row(1, { pts: 10, v: 3, sg: 4, gp: 8 }), row(2, { pts: 10, v: 3, sg: 4, gp: 9 }))).toEqual([
      2, 1,
    ]);
  });
  it('nome quando empata em tudo', () => {
    const b = row(1, { name: 'Bahia' }),
      a = row(2, { name: 'Atlético-MG' });
    expect(order(b, a)).toEqual([2, 1]);
  });
});
