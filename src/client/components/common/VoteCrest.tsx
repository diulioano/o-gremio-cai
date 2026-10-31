import { TEAMS, TEAM_SLUGS, type TeamSlug } from '../../../shared/teams';
import { hideImg } from '../../lib/hideImg';
import s from './VoteSheet.module.css';

/** id da football-data → slug (a votação trabalha com ids; os escudos locais, com slugs) */
export const BY_ID = new Map<number, TeamSlug>(TEAM_SLUGS.map((slug) => [TEAMS[slug].id, slug] as const));
export const fmt = (n: number) => n.toLocaleString('pt-BR');

/** Escudo em caixa fixa: local (public/<slug>.svg) para os times da votação, ou `src` para outro. */
export function TeamCrest({ slug, src, size }: { slug?: TeamSlug; src?: string; size: number }) {
  return (
    <span class={s.crest} style={{ width: size, height: size }}>
      <img src={src ?? `/${slug ?? ''}.svg`} alt="" width={size} height={size} onError={hideImg} />
    </span>
  );
}
