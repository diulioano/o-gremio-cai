// Cron de minuto em minuto: o único que consulta a football-data.org.
// Com jogo ao vivo consulta todo minuto; fora de jogo, só no minuto 0 de cada hora.
// Grava no KV só se os jogos mudaram ou se venceu o pulso (o limite grátis é 1.000 gravações/dia).
// Ver specs/002-atualizacao-por-minuto/contracts/scheduled.md.
import { HEARTBEAT_IDLE_MS, HEARTBEAT_LIVE_MS, isLiveWindow } from '../domain/live';
import type { DataPayload } from '../shared/api';
import { CACHE_KEY, fetchSource } from './data';

export async function refresh(env: Env, t: number): Promise<void> {
  if (!env.FOOTBALL_DATA_TOKEN) return;

  const snap = await env.CACHE.get<DataPayload>(CACHE_KEY, 'json');
  const live = snap ? isLiveWindow(snap.matches, t) : true;
  if (!live && new Date(t).getUTCMinutes() !== 0) return;

  let next: DataPayload;
  try {
    next = await fetchSource(env.FOOTBALL_DATA_TOKEN);
  } catch (e) {
    // sem gravar: o dado guardado envelhece e /api/data passa a marcá-lo como desatualizado
    console.warn('refresh:', e instanceof Error ? e.message : e);
    return;
  }
  next.fetchedAt = t;

  const changed = !snap || JSON.stringify(snap.matches) !== JSON.stringify(next.matches);
  const beat = isLiveWindow(next.matches, t) ? HEARTBEAT_LIVE_MS : HEARTBEAT_IDLE_MS;
  if (changed || t - snap.fetchedAt >= beat) await env.CACHE.put(CACHE_KEY, JSON.stringify(next));
}
