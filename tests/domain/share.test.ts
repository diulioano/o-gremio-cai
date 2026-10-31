import { describe, expect, it } from 'vitest';
import type { SimulationResult } from '../../src/domain/simulate';
import { shareCard } from '../../src/domain/share';
import { row } from './helpers';

/** 20 times; pontos de cima para baixo; o id é a posição. */
function result(dec: SimulationResult['dec'] = {}, final = false): SimulationResult {
  const table = Array.from({ length: 20 }, (_, i) => row(i + 1, { pts: 60 - i * 2 }));
  return { table, pct: Object.fromEntries(table.map((t) => [t.id, t.id / 20])), dec, final };
}

describe('shareCard', () => {
  it('time no Z4: SIM, destacado na lista dos 4, % vermelha', () => {
    const c = shareCard(result(), 18, true);
    expect(c?.yes).toBe(true);
    expect(c?.sim).toBe(true);
    expect(c?.z4.map((r) => r.pos)).toEqual([17, 18, 19, 20]);
    expect(c?.z4.filter((r) => r.me).map((r) => r.id)).toEqual([18]);
    expect(c?.prob).toBe('90%');
    expect(c?.probHigh).toBe(true);
  });

  it('time fora do Z4: NÃO, ninguém destacado', () => {
    const c = shareCard(result(), 5, false);
    expect(c?.yes).toBe(false);
    expect(c?.pos).toBe(5);
    expect(c?.pts).toBe(52);
    expect(c?.probHigh).toBe(false);
    expect(c?.z4.some((r) => r.me)).toBe(false);
  });

  it('leva o selo de decisão', () => {
    expect(shareCard(result({ 3: 'salvo' }), 3, false)?.decision).toBe('SALVO MATEMATICAMENTE');
    expect(shareCard(result({ 20: 'reb' }), 20, false)?.decision).toBe('REBAIXADO');
  });

  it('tabela final (tudo sorteado): ESCAPOU ou CAIU', () => {
    expect(shareCard(result({ 3: 'salvo' }, true), 3, true)?.decision).toBe('ESCAPOU');
    expect(shareCard(result({ 20: 'reb' }, true), 20, true)?.decision).toBe('CAIU');
  });

  it('time fora dos dados: null', () => {
    expect(shareCard(result(), 99, false)).toBeNull();
  });
});
