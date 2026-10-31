import { describe, expect, it } from 'vitest';
import { games, pctLabel, roundRange, signed, timeAgo, when } from '../../src/domain/format';

describe('pctLabel', () => {
  it.each([
    [0.3, 'salvo', '0%'],
    [0.3, 'reb', '100%'],
    [0.004, null, '<1%'],
    [0.996, null, '>99%'],
    [0.374, null, '37%'],
    [0.375, null, '38%'],
  ] as const)('%s / %s → %s', (p, d, label) => {
    expect(pctLabel(p, d)).toBe(label);
  });
});

describe('formatos', () => {
  it('saldo com sinal (o menos é U+2212)', () => {
    expect([signed(3), signed(-2), signed(0)]).toEqual(['+3', '−2', '0']);
  });

  it('data no horário de Brasília', () => {
    expect(when('2026-11-01T02:30:00Z')).toEqual({ wd: 'Sáb', d: 31, m: 10, hm: '23:30' });
  });

  it('intervalo da rodada', () => {
    const at = (utc: string) => ({ utc });
    expect(roundRange([at('2026-10-31T20:00:00Z'), at('2026-10-31T23:00:00Z')])).toBe('31 out');
    expect(roundRange([at('2026-11-02T20:00:00Z'), at('2026-11-05T20:00:00Z')])).toBe('2–5 nov');
    expect(roundRange([at('2026-11-02T20:00:00Z'), at('2026-10-30T20:00:00Z')])).toBe('30 out – 2 nov');
    expect(roundRange([])).toBe('');
  });

  it('há quanto tempo', () => {
    expect([timeAgo(0), timeAgo(5), timeAgo(90)]).toEqual(['agora', 'há 5 min', 'há 2 h']);
  });

  it('jogos', () => {
    expect([games(1), games(3)]).toEqual(['1 jogo', '3 jogos']);
  });
});
