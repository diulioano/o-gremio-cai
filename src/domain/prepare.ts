import type { DataPayload } from '../shared/api';
import type { Team } from '../shared/teams';
import { play, type StandingRow, type TeamInfo } from './standings';

export type MatchStatus = 'fin' | 'live' | 'fut';

export interface Match {
  id: number;
  round: number;
  home: number;
  away: number;
  status: MatchStatus;
  postponed: boolean;
  homeGoals: number | null;
  awayGoals: number | null;
  utc: string;
}

export interface Prepared {
  teams: Record<number, TeamInfo>;
  matches: Match[];
  /** ids dos times em ordem numérica crescente (a ordem do Object.keys); a simulação depende dela */
  ids: number[];
  /** campanha só com os jogos encerrados */
  base: Record<number, StandingRow>;
  rounds: Record<number, Match[]>;
  first: number;
  last: number;
  current: number;
  /** gols esperados de mandante e visitante */
  lambda: (home: number, away: number) => [number, number];
  /** id do time da página, ou null na página inicial (ou se ele não estiver nos dados) */
  gid: number | null;
}

const STATUS: Partial<Record<string, MatchStatus>> = {
  FINISHED: 'fin',
  AWARDED: 'fin',
  IN_PLAY: 'live',
  PAUSED: 'live',
  LIVE: 'live',
  SCHEDULED: 'fut',
  TIMED: 'fut',
  POSTPONED: 'fut',
  SUSPENDED: 'fut',
};

/** Acha o time pelo id da API; a sigla só serve para os dados de demonstração. */
export const findId = (
  ids: readonly number[],
  teams: Record<number, TeamInfo>,
  t: Pick<Team, 'id' | 'code'>,
): number | null => (ids.find((id) => id === t.id) ?? ids.find((id) => teams[id]?.code === t.code)) ?? null;

const K = 5;

export function prepare(d: DataPayload, team: Pick<Team, 'id' | 'code'> | null): Prepared {
  const teams: Record<number, TeamInfo> = {};
  const matches: Match[] = [];
  for (const m of d.matches) {
    for (const t of [m.h, m.a]) {
      if (t.id && !teams[t.id]) {
        teams[t.id] = {
          id: t.id,
          name: t.name,
          code: t.tla || t.name.slice(0, 3).toUpperCase(),
          crest: t.crest || null,
        };
      }
    }
    const status = STATUS[m.status];
    if (!status || !m.h.id || !m.a.id) continue;
    matches.push({
      id: m.id,
      round: m.md,
      home: m.h.id,
      away: m.a.id,
      status: status === 'fin' && (m.hs == null || m.as == null) ? 'fut' : status,
      postponed: m.status === 'POSTPONED',
      homeGoals: m.hs,
      awayGoals: m.as,
      utc: m.utc,
    });
  }
  const ids = Object.keys(teams).map(Number);
  const base: Record<number, StandingRow> = {};
  for (const id of ids) {
    base[id] = { ...(teams[id] as TeamInfo), pts: 0, j: 0, v: 0, e: 0, d: 0, gp: 0, gc: 0, sg: 0 };
  }
  const row = (id: number) => base[id] as StandingRow;
  let hg = 0,
    ag = 0,
    nf = 0;
  for (const g of matches) {
    if (g.status !== 'fin' || g.homeGoals == null || g.awayGoals == null) continue;
    play(row(g.home), row(g.away), g.homeGoals, g.awayGoals);
    hg += g.homeGoals;
    ag += g.awayGoals;
    nf++;
  }

  // força pela campanha: ataque e defesa relativos à média, puxados para 1 nos primeiros jogos
  const avgH = nf ? hg / nf : 1.4,
    avgA = nf ? ag / nf : 1.0,
    avg = (avgH + avgA) / 2;
  const att: Record<number, number> = {},
    def: Record<number, number> = {};
  for (const id of ids) {
    const t = row(id);
    att[id] = (t.gp + K * avg) / (t.j + K) / avg;
    def[id] = (t.gc + K * avg) / (t.j + K) / avg;
  }
  const s = (m: Record<number, number>, id: number) => m[id] ?? 1;

  const rounds: Record<number, Match[]> = {};
  for (const g of matches) (rounds[g.round] ??= []).push(g);
  const nums = Object.keys(rounds)
    .map(Number)
    .sort((a, b) => a - b);
  // jogo adiado de rodada antiga não deve prender a "rodada atual" lá atrás
  const pending = nums.filter((r) => rounds[r]?.some((g) => g.status !== 'fin' && !g.postponed));
  const last = nums[nums.length - 1] ?? 0;
  return {
    teams,
    matches,
    ids,
    base,
    rounds,
    first: nums[0] ?? 0,
    last,
    current: pending[0] ?? last,
    lambda: (h, a) => [avgH * s(att, h) * s(def, a), avgA * s(att, a) * s(def, h)],
    gid: team ? findId(ids, teams, team) : null,
  };
}
