import { hm, timeAgo } from '../../domain/format';
import type { Prepared } from '../../domain/prepare';
import type { DataPayload } from '../../shared/api';

export interface Status {
  text: string;
  dot: string;
}

/** Texto e cor do ponto da barra de status (fonte dos dados, idade e rodada). */
export function status(raw: DataPayload | null, err: boolean, now: number, P: Prepared | null): Status {
  const mins = raw ? Math.max(0, Math.round((now - raw.fetchedAt) / 60000)) : 0;
  const roundTxt = P ? ` · Rodada ${P.current} de ${P.last}` : '';
  const text = raw?.demo
    ? 'Dados de demonstração' + roundTxt
    : err
      ? (raw ? `Sem conexão · dados de ${hm(raw.fetchedAt)}` : 'Sem conexão com a API') + roundTxt
      : !raw
        ? 'Carregando dados…'
        : `Atualizado ${timeAgo(mins)}` + roundTxt;
  const dot = err || raw?.demo ? 'var(--warn)' : !raw ? 'var(--text-muted)' : 'var(--safe)';
  return { text, dot };
}
