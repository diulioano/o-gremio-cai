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
  /** epoch ms: última vez que a fonte foi conferida e o KV gravado (mudança ou pulso de 5/60 min) */
  fetchedAt: number;
  matches: SlimMatch[];
  /** sem FOOTBALL_DATA_TOKEN */
  demo?: true;
  /** a cópia passou de 15 min (ao vivo) ou 3 h (fora de jogo) sem ser conferida: a fonte deve estar falhando */
  stale?: true;
}

export interface DataError {
  error: string;
}

// Contrato de /api/votes: o Worker produz (src/worker/votes.ts), o cliente consome.
// Ver specs/003-votacao-rebaixados/contracts/api-votes.md.

export interface VoteRow {
  /** id do time na football-data */
  id: number;
  votes: number;
  /** % dos votantes que escolheu o time (arredondada) */
  pct: number;
}

export interface VoteState {
  /** a votação ainda aceita votos */
  open: boolean;
  /** epoch ms do primeiro jogo da última rodada; null sem dados de jogos */
  closesAt: number | null;
  /** votantes até agora */
  total: number;
  /** só para quem já votou ou com a votação fechada; ausente com total < 10 */
  rows?: VoteRow[];
  /** total < 10: mostrar "votação começando" (só para quem pode ver o resultado) */
  warmingUp?: true;
  /** os 3 do visitante, quando ele já votou */
  mine?: [number, number, number];
}

export interface VoteRequest {
  voter: string;
  picks: [number, number, number];
}

export interface VoteError {
  error: 'invalid' | 'forbidden' | 'closed' | 'rate-limited' | 'daily-cap' | 'unavailable';
  /** pt-BR, pronto para a tela */
  message: string;
  /** só no 410: o resultado final */
  state?: VoteState;
}
