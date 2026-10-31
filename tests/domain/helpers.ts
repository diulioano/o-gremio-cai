// Monta campeonatos pequenos para os testes do domínio.
import type { DataPayload, SlimMatch } from '../../src/shared/api';
import type { StandingRow } from '../../src/domain/standings';

let nextId = 1;

/** Jogo no formato da API enxuta. Sem placar = futuro (TIMED). */
export function match(
  md: number,
  h: number,
  a: number,
  score?: [number, number],
  status?: string,
): SlimMatch {
  return {
    id: nextId++,
    md,
    status: status ?? (score ? 'FINISHED' : 'TIMED'),
    utc: `2026-11-${String(md).padStart(2, '0')}T19:00:00Z`,
    h: { id: h, name: `T${h}`, tla: `T${h}`, crest: null },
    a: { id: a, name: `T${a}`, tla: `T${a}`, crest: null },
    hs: score ? score[0] : null,
    as: score ? score[1] : null,
  };
}

export const payload = (matches: SlimMatch[]): DataPayload => ({ fetchedAt: 0, matches });

export function row(id: number, over: Partial<StandingRow> = {}): StandingRow {
  return {
    id,
    name: `T${id}`,
    code: `T${id}`,
    crest: null,
    pts: 0,
    j: 0,
    v: 0,
    e: 0,
    d: 0,
    gp: 0,
    gc: 0,
    sg: 0,
    ...over,
  };
}
