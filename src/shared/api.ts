// Contrato de GET /api/data: o Worker produz (src/worker/data.ts), o cliente consome.
// Ver specs/001-migracao-framework-web/contracts/api-data.md.

export type ApiStatus =
  | 'FINISHED'
  | 'AWARDED'
  | 'IN_PLAY'
  | 'PAUSED'
  | 'LIVE'
  | 'SCHEDULED'
  | 'TIMED'
  | 'POSTPONED'
  | 'SUSPENDED'
  | (string & {});

export interface SlimTeam {
  id: number | null;
  name: string;
  tla: string | null;
  crest: string | null;
}

export interface SlimMatch {
  id: number;
  /** rodada */
  md: number;
  status: ApiStatus;
  /** ISO 8601 */
  utc: string;
  /** mandante */
  h: SlimTeam;
  /** visitante */
  a: SlimTeam;
  /** gols do mandante (fullTime) */
  hs: number | null;
  /** gols do visitante */
  as: number | null;
}

export interface DataPayload {
  /** epoch ms */
  fetchedAt: number;
  matches: SlimMatch[];
  /** sem FOOTBALL_DATA_TOKEN */
  demo?: true;
  /** a API falhou: cópia vencida do KV */
  stale?: true;
}

export interface DataError {
  error: string;
}
