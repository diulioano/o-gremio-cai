import { describe, expect, it } from 'vitest';
import * as pred from '../../src/domain/predictions';
import { prepare } from '../../src/domain/prepare';
import { mulberry } from '../../src/domain/rng';
import { match, payload } from './helpers';

const P = prepare(
  payload([match(1, 1, 2, [1, 0]), match(2, 1, 3), match(2, 2, 4), match(3, 3, 1), match(3, 4, 2)]),
  null,
);
const [fin, a, b, c, d] = P.matches.map((g) => g.id) as [number, number, number, number, number];

describe('palpites', () => {
  it('V/E/D preenchem o placar padrão', () => {
    expect(pred.pick({}, a, 'V')[a]).toEqual({ h: 1, a: 0 });
    expect(pred.pick({}, a, 'E')[a]).toEqual({ h: 1, a: 1 });
    expect(pred.pick({}, a, 'D')[a]).toEqual({ h: 0, a: 1 });
  });

  it('step fica entre 0 e 9 e vira palpite manual', () => {
    expect(pred.step({}, a, 'h', -1)[a]).toEqual({ h: 0, a: 0 });
    expect(pred.step({ [a]: { h: 9, a: 2, auto: 1 } }, a, 'h', 1)[a]).toEqual({ h: 9, a: 2 });
  });

  it('setValue usa o último dígito; vazio é 0', () => {
    expect(pred.setValue({ [a]: { h: 1, a: 1 } }, a, 'a', '13')[a]).toEqual({ h: 1, a: 3 });
    expect(pred.setValue({ [a]: { h: 1, a: 1 } }, a, 'h', '')[a]).toEqual({ h: 0, a: 1 });
    expect(pred.setValue({}, a, 'h', 'x7')[a]).toEqual({ h: 7, a: 0 });
  });

  it('fill sorteia vazios, refaz sorteados e mantém os manuais', () => {
    const before: pred.Predictions = { [a]: { h: 4, a: 4 }, [b]: { h: 0, a: 0, auto: 1 } };
    const out = pred.fill(before, P.matches, P.lambda, mulberry(1));
    expect(out[a]).toEqual({ h: 4, a: 4 });
    expect(out[b]?.auto).toBe(1);
    expect(out[c]?.auto).toBe(1);
    expect(out[d]?.auto).toBe(1);
    expect(out[fin]).toBeUndefined();
  });

  it('não mexe na entrada', () => {
    const p: pred.Predictions = { [a]: { h: 1, a: 0 } };
    const copy = structuredClone(p);
    pred.pick(p, b, 'E');
    pred.step(p, a, 'h', 1);
    pred.clear(p, a);
    pred.fill(p, P.matches, P.lambda, mulberry(1));
    expect(p).toEqual(copy);
  });

  it('clear e clearRound', () => {
    const p: pred.Predictions = { [a]: { h: 1, a: 0 }, [b]: { h: 1, a: 1 }, [c]: { h: 0, a: 1 } };
    expect(Object.keys(pred.clear(p, a))).toEqual([String(b), String(c)]);
    expect(Object.keys(pred.clearRound(p, P.rounds[2] ?? []))).toEqual([String(c)]);
  });

  it('outcome', () => {
    expect([
      pred.outcome({ h: 2, a: 1 }),
      pred.outcome({ h: 0, a: 0 }),
      pred.outcome({ h: 0, a: 3 }),
    ]).toEqual(['V', 'E', 'D']);
  });

  it('rodadas incompletas: só conta rodada começada', () => {
    expect(pred.missingIn(P.rounds[2] ?? [], {})).toBe(0);
    expect(pred.missingIn(P.rounds[2] ?? [], { [a]: { h: 1, a: 0 } })).toBe(1);
    expect(pred.incompleteRounds(P, { [a]: { h: 1, a: 0 }, [c]: { h: 1, a: 0 } })).toEqual([
      [2, 1],
      [3, 1],
    ]);
  });
});
