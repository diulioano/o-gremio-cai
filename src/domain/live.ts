// "Tem jogo ao vivo?" e os prazos de frescor dos dados. O cron do Worker e a página usam a mesma regra.
// Ver specs/002-atualizacao-por-minuto/data-model.md.
import type { DataPayload, SlimMatch } from '../shared/api';

const MIN = 60_000;
/** a janela ao vivo abre 15 min antes do horário marcado */
export const LIVE_LEAD_MS = 15 * MIN;
/** e fecha 3 h depois, se a fonte não marcar o jogo como encerrado antes */
export const LIVE_TAIL_MS = 3 * 60 * MIN;
/** com dados iguais, grava no KV mesmo assim a cada 5 min (ao vivo) ou 60 min (fora), para provar que a fonte foi conferida */
export const HEARTBEAT_LIVE_MS = 5 * MIN;
export const HEARTBEAT_IDLE_MS = 60 * MIN;
/** idade a partir da qual os dados são marcados como desatualizados */
export const STALE_LIVE_MS = 15 * MIN;
export const STALE_IDLE_MS = 3 * 60 * MIN;
/** de quanto em quanto tempo a página aberta busca dados durante um jogo */
export const POLL_MS = MIN;

const PLAYING = new Set(['IN_PLAY', 'PAUSED', 'LIVE']);
const OVER = new Set(['FINISHED', 'AWARDED', 'POSTPONED', 'CANCELLED', 'SUSPENDED']);

export function isLiveWindow(matches: readonly SlimMatch[], now: number): boolean {
  return matches.some((m) => {
    if (PLAYING.has(m.status)) return true;
    if (OVER.has(m.status)) return false;
    const t = Date.parse(m.utc);
    return t - LIVE_LEAD_MS <= now && now <= t + LIVE_TAIL_MS;
  });
}

/** Retorna os ids dos times que marcaram gol em jogos ao vivo entre dois payloads consecutivos. */
export function detectGoalTeams(prev: DataPayload | null, next: DataPayload | null): number[] {
  if (!prev || !next) return [];
  const before = new Map(prev.matches.map((m) => [m.id, m]));
  const scorers: number[] = [];
  for (const m of next.matches) {
    if (!PLAYING.has(m.status) || m.hs == null || m.as == null) continue;
    const old = before.get(m.id);
    if (old?.hs == null || old.as == null) continue;
    if (m.hs > old.hs && m.h.id != null) scorers.push(m.h.id);
    if (m.as > old.as && m.a.id != null) scorers.push(m.a.id);
  }
  return scorers;
}
