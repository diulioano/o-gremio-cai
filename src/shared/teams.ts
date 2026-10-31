// Fonte única dos times da briga contra a queda: o Worker usa para rotas e títulos, o cliente para o visual.
// Os times são os que ainda brigavam contra a queda na 33ª rodada de 2026 (do Botafogo, 11º, para baixo).
// O time é achado pelo id da API (as siglas mudam e se repetem: Coritiba e Corinthians são COR); code só para os dados de demonstração.
// Escudos em public/<slug>.svg: o PNG da API tem só 70px. Grêmio, Inter, Vitória, Mirassol e Remo vêm do Wikimedia Commons;
// os outros são o SVG da API, sem o quadrado branco de fundo.
// accent nunca é vermelho nem verde: essas cores são do SIM/NÃO e do Z4. A cor do clube vai no halo e nas listras.

export interface Team {
  id: number;
  code: string;
  art: 'O' | 'A';
  name: string;
  accent: string;
  halo: string;
  bg: string;
}

const W = '#E6EAF0';

export const TEAMS = {
  gremio: {
    art: 'O',
    name: 'Grêmio',
    code: 'GRE',
    id: 1767,
    accent: '#1A9BE0',
    halo: '#1A9BE0',
    bg: 'repeating-linear-gradient(90deg,#1A9BE0 0 26px,#000 26px 52px,#fff 52px 55px,#000 55px 81px)',
  },
  inter: {
    art: 'O',
    name: 'Inter',
    code: 'INT',
    id: 6684,
    accent: W,
    halo: '#E5050F',
    bg: 'repeating-linear-gradient(90deg,#E5050F 0 40px,#fff 40px 46px)',
  },
  corinthians: {
    art: 'O',
    name: 'Corinthians',
    code: 'COR',
    id: 1779,
    accent: W,
    halo: W,
    bg: 'repeating-linear-gradient(90deg,#fff 0 26px,#000 26px 52px)',
  },
  vasco: {
    art: 'O',
    name: 'Vasco',
    code: 'VAS',
    id: 1780,
    accent: W,
    halo: W,
    bg: 'linear-gradient(125deg,transparent 0 38%,#fff 38% 52%,transparent 52%)',
  },
  botafogo: {
    art: 'O',
    name: 'Botafogo',
    code: 'BOT',
    id: 1770,
    accent: W,
    halo: W,
    bg: 'repeating-linear-gradient(90deg,#fff 0 30px,#000 30px 60px)',
  },
  coritiba: {
    art: 'O',
    name: 'Coritiba',
    code: 'CFC',
    id: 4241,
    accent: W,
    halo: W,
    bg: 'repeating-linear-gradient(180deg,#00544D 0 30px,#fff 30px 36px)',
  },
  vitoria: {
    art: 'O',
    name: 'Vitória',
    code: 'VIT',
    id: 1782,
    accent: W,
    halo: '#E30613',
    bg: 'repeating-linear-gradient(180deg,#E30613 0 40px,#000 40px 80px)',
  },
  mirassol: {
    art: 'O',
    name: 'Mirassol',
    code: 'MIR',
    id: 4364,
    accent: W,
    halo: '#FFE000',
    bg: 'repeating-linear-gradient(90deg,#FFE000 0 30px,#000 30px 60px)',
  },
  remo: {
    art: 'O',
    name: 'Remo',
    code: 'REM',
    id: 4287,
    accent: '#7FA6FF',
    halo: '#4F7DFF',
    bg: 'repeating-linear-gradient(90deg,#1F3E8C 0 30px,#000 30px 60px)',
  },
} as const satisfies Record<string, Team>;

export type TeamSlug = keyof typeof TEAMS;

export const TEAM_SLUGS = Object.keys(TEAMS) as TeamSlug[];

export const isTeamSlug = (s: string | undefined | null): s is TeamSlug =>
  s != null && Object.prototype.hasOwnProperty.call(TEAMS, s);

export const ask = (t: Pick<Team, 'art' | 'name'>): string => `${t.art} ${t.name} cai?`;
