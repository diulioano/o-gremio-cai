import { TEAMS, type Team, type TeamSlug } from '../shared/teams';
import { pctLabel } from './format';
import { findId, type Prepared } from './prepare';
import type { SimulationResult } from './simulate';
import type { StandingRow } from './standings';

/** Decidido pela matemática com jogos em aberto, ou pela tabela final (ESCAPOU/CAIU). */
export type Badge = 'SALVO MATEMATICAMENTE' | 'REBAIXADO' | 'ESCAPOU' | 'CAIU';

export interface Verdict {
  /** SIM: o time está no Z4 da tabela exibida */
  yes: boolean;
  pos: number;
  row: StandingRow;
  pct: number;
  pctLabel: string;
  /** "de chance de cair · 17º lugar · 2 pts para sair do Z4" */
  ctxRest: string;
  badge: Badge | null;
}

const pts = (n: number) => `${n} pt${n > 1 ? 's' : ''}`;

export function verdict(res: SimulationResult, gid: number): Verdict | null {
  const { table, pct, dec, final } = res;
  const n = table.length,
    z = n - 4;
  const i = table.findIndex((t) => t.id === gid);
  const row = table[i];
  if (!row) return null;
  const pos = i + 1,
    yes = pos > z;
  let ctxRest: string;
  if (yes) {
    const gap = (table[z - 1]?.pts ?? row.pts) - row.pts;
    ctxRest = `de chance de cair · ${pos}º lugar · ${gap > 0 ? `${pts(gap)} para sair do Z4` : 'fora do Z4 só no desempate'}`;
  } else {
    const gap = row.pts - (table[z]?.pts ?? row.pts);
    ctxRest = `de chance de cair · ${pos}º lugar · ${gap > 0 ? `${pts(gap)} acima do Z4` : 'à frente do Z4 no desempate'}`;
  }
  const d = dec[gid] ?? null;
  const p = pct[gid] ?? 0;
  return {
    yes,
    pos,
    row,
    pct: p,
    pctLabel: pctLabel(p, d),
    ctxRest,
    badge:
      d === 'salvo'
        ? final
          ? 'ESCAPOU'
          : 'SALVO MATEMATICAMENTE'
        : d === 'reb'
          ? final
            ? 'CAIU'
            : 'REBAIXADO'
          : null,
  };
}

export interface HomeCard {
  slug: TeamSlug;
  t: Team;
  pos: number;
  pts: number;
  yes: boolean;
  p: number;
  label: string;
}

/** Cartões da página inicial, do mais ameaçado para o menos (sempre pela tabela real). */
export function homeCards(P: Prepared, res: SimulationResult): HomeCard[] {
  const n = res.table.length;
  const cards: HomeCard[] = [];
  for (const [slug, t] of Object.entries(TEAMS) as [TeamSlug, Team][]) {
    const gid = findId(P.ids, P.teams, t);
    if (!gid) continue;
    const pos = res.table.findIndex((x) => x.id === gid) + 1;
    const p = res.pct[gid] ?? 0;
    cards.push({
      slug,
      t,
      pos,
      pts: res.table[pos - 1]?.pts ?? 0,
      yes: pos > n - 4,
      p,
      label: pctLabel(p, res.dec[gid] ?? null),
    });
  }
  return cards.sort((a, b) => b.p - a.p || b.pos - a.pos);
}
