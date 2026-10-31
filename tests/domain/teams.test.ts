// Lista única de times (src/shared/teams.ts) e a regra de cor da constituição (princípio I).
import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { TEAMS, TEAM_SLUGS, ask, isTeamSlug } from '../../src/shared/teams';

function hsl(hex: string): { h: number; s: number } {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((x) => x / 255) as [
    number,
    number,
    number,
  ];
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    d = max - min,
    l = (max + min) / 2;
  if (!d) return { h: 0, s: 0 };
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s };
}

const teams = TEAM_SLUGS.map((slug) => [slug, TEAMS[slug]] as const);

describe('TEAMS', () => {
  it('slugs, ids e siglas únicos', () => {
    const uniq = (xs: unknown[]) => new Set(xs).size === xs.length;
    expect(uniq(teams.map(([s]) => s))).toBe(true);
    expect(uniq(teams.map(([, t]) => t.id))).toBe(true);
    expect(uniq(teams.map(([, t]) => t.code))).toBe(true);
  });

  it('artigo O/A e a pergunta', () => {
    for (const [, t] of teams) expect(['O', 'A']).toContain(t.art);
    expect(ask(TEAMS.gremio)).toBe('O Grêmio cai?');
  });

  it.each(teams)('%s: accent nunca é vermelho nem verde (são do SIM/NÃO)', (_, t) => {
    const { h, s } = hsl(t.accent);
    const red = h >= 345 || h <= 15,
      green = h >= 90 && h <= 160;
    expect(s > 0.35 && (red || green)).toBe(false);
  });

  it.each(teams)('%s: tem escudo em public/', (slug) => {
    expect(existsSync(`public/${slug}.svg`)).toBe(true);
  });

  it('isTeamSlug só aceita os 9 times', () => {
    expect(isTeamSlug('inter')).toBe(true);
    expect(isTeamSlug('flamengo')).toBe(false);
    expect(isTeamSlug('toString')).toBe(false);
    expect(isTeamSlug(undefined)).toBe(false);
  });
});
