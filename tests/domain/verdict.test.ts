import { describe, expect, it } from 'vitest';
import { prepare } from '../../src/domain/prepare';
import { simulate, type SimulationResult } from '../../src/domain/simulate';
import { homeCards, verdict } from '../../src/domain/verdict';
import type { DataPayload } from '../../src/shared/api';
import demo from './fixtures/demo-payload.json';
import { row } from './helpers';

/** 20 times; pontos de cima para baixo; o id é a posição. */
function result(pts: number[], dec: SimulationResult['dec'] = {}, final = false): SimulationResult {
  const table = pts.map((p, i) => row(i + 1, { pts: p }));
  return { table, pct: Object.fromEntries(table.map((t) => [t.id, t.id / 40])), dec, final };
}
const pts = (over: Record<number, number>) => Array.from({ length: 20 }, (_, i) => over[i + 1] ?? 60 - i * 2);

describe('verdict', () => {
  it('17º é SIM, com a distância para sair do Z4', () => {
    const v = verdict(result(pts({ 16: 30, 17: 28 })), 17);
    expect(v?.yes).toBe(true);
    expect(v?.ctxRest).toBe('de chance de cair · 17º lugar · 2 pts para sair do Z4');
  });

  it('singular e empate em pontos', () => {
    expect(verdict(result(pts({ 16: 29, 17: 28 })), 17)?.ctxRest).toContain('1 pt para sair do Z4');
    expect(verdict(result(pts({ 16: 28, 17: 28 })), 17)?.ctxRest).toContain('fora do Z4 só no desempate');
  });

  it('16º é NÃO, com a folga sobre o Z4', () => {
    const v = verdict(result(pts({ 16: 33, 17: 30 })), 16);
    expect(v?.yes).toBe(false);
    expect(v?.ctxRest).toBe('de chance de cair · 16º lugar · 3 pts acima do Z4');
    expect(verdict(result(pts({ 16: 30, 17: 30 })), 16)?.ctxRest).toContain('à frente do Z4 no desempate');
  });

  it('selos', () => {
    expect(verdict(result(pts({}), { 1: 'salvo' }), 1)?.badge).toBe('SALVO MATEMATICAMENTE');
    expect(verdict(result(pts({}), { 20: 'reb' }), 20)).toMatchObject({
      badge: 'REBAIXADO',
      pctLabel: '100%',
    });
    expect(verdict(result(pts({})), 10)?.badge).toBeNull();
  });

  it('selos da tabela final: ESCAPOU e CAIU', () => {
    expect(verdict(result(pts({}), { 1: 'salvo' }, true), 1)?.badge).toBe('ESCAPOU');
    expect(verdict(result(pts({}), { 20: 'reb' }, true), 20)?.badge).toBe('CAIU');
  });

  it('time fora da tabela', () => {
    expect(verdict(result(pts({})), 99)).toBeNull();
  });
});

describe('homeCards', () => {
  it('os 9 times, do mais ameaçado para o menos', () => {
    const P = prepare(demo as DataPayload, null);
    const cards = homeCards(P, simulate(P, {}));
    expect(cards).toHaveLength(9);
    expect(cards).toEqual([...cards].sort((x, y) => y.p - x.p || y.pos - x.pos));
    for (const c of cards) expect(c.yes).toBe(c.pos > 16);
  });
});
