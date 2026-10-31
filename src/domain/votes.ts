// Votação "quem você acha que cai?": regras puras, usadas pelo Worker (aceitar/recusar) e pela página.
// O resultado é opinião da torcida e nunca entra no simulador nem no veredito.
// Ver specs/003-votacao-rebaixados/data-model.md.
import type { SlimMatch, VoteRow } from '../shared/api';
import { TEAMS, TEAM_SLUGS } from '../shared/teams';

/** vagas que sobram no Z4: a Chapecoense já caiu */
export const PICKS = 3;
/** abaixo disso, a votação está "começando" e não mostra porcentagens */
export const MIN_VOTES = 10;
/** votos por dia (UTC): 6 linhas gravadas por voto = 60 mil, 60% do limite grátis do D1 */
export const DAILY_CAP = 10_000;

const TEAM_IDS = new Set<number>(TEAM_SLUGS.map((s) => TEAMS[s].id));
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export type Picks = [number, number, number];

/** null se for um voto válido (3 ids distintos da lista de times); senão, o motivo em pt-BR */
export function ballotError(picks: unknown): string | null {
  if (!Array.isArray(picks) || picks.length !== PICKS) return `Escolha ${PICKS} times.`;
  if (!picks.every((id) => Number.isSafeInteger(id) && TEAM_IDS.has(id as number)))
    return 'Time fora da lista.';
  if (new Set(picks).size !== PICKS) return 'Times repetidos.';
  return null;
}

export const isBallot = (picks: unknown): picks is Picks => ballotError(picks) === null;

/** o id anônimo do aparelho: UUID em minúsculas, como o crypto.randomUUID() gera */
export const isVoterId = (v: unknown): v is string => typeof v === 'string' && UUID.test(v);

/** A votação fecha quando começa o primeiro jogo da última rodada. null sem jogos. */
export function votingClosesAt(matches: readonly SlimMatch[]): number | null {
  if (!matches.length) return null;
  const last = Math.max(...matches.map((m) => m.md));
  // uma data ilegível num jogo não pode anular o horário dos outros
  const kicks = matches
    .filter((m) => m.md === last)
    .map((m) => Date.parse(m.utc))
    .filter(Number.isFinite);
  return kicks.length ? Math.min(...kicks) : null;
}

export type CrowdResult = { total: number; warmingUp: true } | { total: number; rows: VoteRow[] };

/**
 * Porcentagem de votantes que acha que cada time cai (cada um escolhe 3, então a soma dá ~300%).
 * Os 9 times sempre aparecem; ordem: mais votado primeiro, empate pelo nome.
 */
export function crowdResult(counts: Readonly<Record<number, number>>, total: number): CrowdResult {
  if (total < MIN_VOTES) return { total, warmingUp: true };
  const rows = TEAM_SLUGS.map((s) => {
    const { id, name } = TEAMS[s];
    const votes = counts[id] ?? 0;
    return { id, name, votes, pct: Math.round((100 * votes) / total) };
  })
    .sort((a, b) => b.votes - a.votes || a.name.localeCompare(b.name, 'pt-BR'))
    .map(({ id, votes, pct }) => ({ id, votes, pct }));
  return { total, rows };
}
