import { describe, expect, it } from 'vitest';
import { prepare } from '../../src/domain/prepare';
import { decide, simulate } from '../../src/domain/simulate';
import { mulberry } from '../../src/domain/rng';
import type { DataPayload } from '../../src/shared/api';
import demo from './fixtures/demo-payload.json';
import { match, payload } from './helpers';

const P = prepare(demo as DataPayload, null);

describe('simulate', () => {
  it('mesma semente, mesmo resultado', () => {
    expect(simulate(P, {}, mulberry(42))).toEqual(simulate(P, {}, mulberry(42)));
  });

  it('% entre 0 e 1 e somando 4 rebaixados por simulação', () => {
    const { pct } = simulate(P, {});
    const values = Object.values(pct);
    expect(values.every((p) => p >= 0 && p <= 1)).toBe(true);
    expect(values.reduce((a, b) => a + b, 0)).toBeCloseTo(4, 6);
  });

  it('sem jogos restantes, a posição final decide', () => {
    // 6 times, turno completo: corte em 2 (os 4 últimos caem)
    const ids = [1, 2, 3, 4, 5, 6];
    const games = ids.flatMap((h, i) => ids.slice(i + 1).map((a) => match(1, h, a, [h < a ? 1 : 0, 0])));
    const r = simulate(prepare(payload(games), null), {});
    expect(r.table.map((t) => t.id)).toEqual(ids);
    expect(ids.map((id) => r.pct[id])).toEqual([0, 0, 1, 1, 1, 1]);
    expect(ids.map((id) => r.dec[id])).toEqual(['salvo', 'salvo', 'reb', 'reb', 'reb', 'reb']);
  });

  it('palpite só vale em jogo futuro', () => {
    const fin = match(1, 1, 2, [0, 3]);
    const fut = match(2, 1, 2);
    const Pm = prepare(payload([fin, fut]), null);
    const r = simulate(Pm, { [fin.id]: { h: 9, a: 0 }, [fut.id]: { h: 2, a: 0 } });
    expect(r.table.find((t) => t.id === 1)).toMatchObject({ pts: 3, gp: 2, gc: 3 });
  });
});

describe('decide (com corte em 4)', () => {
  const ints = (xs: number[]) => Int32Array.from(xs);
  it('salvo: menos de 4 times ainda o alcançam', () => {
    expect(decide(0, ints([30, 10, 10, 10, 10, 10, 10, 10]), ints([1, 1, 1, 1, 1, 1, 1, 1]), 4)).toBe(
      'salvo',
    );
  });
  it('rebaixado: 4 ou mais times já passaram do máximo dele', () => {
    expect(decide(7, ints([10, 10, 10, 10, 10, 10, 10, 0]), ints([1, 1, 1, 1, 1, 1, 1, 1]), 4)).toBe('reb');
  });
  it('em aberto, inclusive empate em pontos no máximo possível', () => {
    expect(decide(7, ints([10, 10, 10, 10, 10, 10, 10, 7]), ints([1, 1, 1, 1, 1, 1, 1, 1]), 4)).toBeNull();
  });
});
