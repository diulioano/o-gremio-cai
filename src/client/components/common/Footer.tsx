import { N_SIM } from '../../../domain/simulate';
import { TEAM_SLUGS, TEAMS, ask, type TeamSlug } from '../../../shared/teams';
import s from './Footer.module.css';

interface Props {
  /** time da página atual; null na página inicial */
  currentSlug: TeamSlug | null;
}

export function Footer({ currentSlug }: Props) {
  return (
    <footer class={s.footer}>
      <nav aria-label="Times" class={s.nav}>
        {currentSlug ? (
          <a href="/" class={s.all}>
            Todos os times
          </a>
        ) : (
          <span aria-current="page" class={s.current}>
            Todos os times
          </span>
        )}
        {TEAM_SLUGS.map((slug) =>
          slug === currentSlug ? (
            <span key={slug} aria-current="page" class={s.current}>
              {ask(TEAMS[slug])}
            </span>
          ) : (
            <a key={slug} href={'/' + slug} class={s.team}>
              {ask(TEAMS[slug])}
            </a>
          ),
        )}
      </nav>
      <strong class={s.disclaimer}>Site não oficial, feito por torcedor.</strong>
      <span>
        Dados:{' '}
        <a href="https://www.football-data.org" target="_blank" rel="noopener">
          football-data.org
        </a>
        . Sem vínculo com clubes, CBF ou patrocinadores.
      </span>
      <span class={s.method}>
        A % de queda vem de {N_SIM.toLocaleString('pt-BR')} simulações dos jogos restantes. Cada placar é
        sorteado pela força de ataque e defesa dos times no campeonato, com vantagem para o mandante,
        respeitando seus palpites.
      </span>
    </footer>
  );
}
