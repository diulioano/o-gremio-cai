import type { ComponentChildren, RefObject } from 'preact';
import type { Team, TeamSlug } from '../../../shared/teams';
import { ask } from '../../../shared/teams';
import { cx } from '../../lib/cx';
import { hideImg } from '../../lib/hideImg';
import ty from '../../styles/type.module.css';
import s from './VerdictHero.module.css';

export type VerdictState = 'loading' | 'failed' | 'yes' | 'no';

interface Props {
  heroRef: RefObject<HTMLElement>;
  team: Team;
  slug: TeamSlug;
  state: VerdictState;
  mobile: boolean;
  /** faixa do modo simulação, no topo do banner */
  banner?: ComponentChildren;
  /** selo, contexto (% e posição) e o link para a tabela */
  children: ComponentChildren;
}

const STAMP = 'stamp .55s cubic-bezier(.16,1,.3,1) both';

/** Banner gigante: escudo, "O X cai?" e o SIM/NÃO. */
export function VerdictHero({ heroRef, team, slug, state, mobile, banner, children }: Props) {
  const yes = state === 'yes';
  const word = state === 'yes' ? 'SIM' : state === 'no' ? 'NÃO' : '?';
  const color =
    state === 'failed'
      ? 'var(--line)'
      : state === 'loading'
        ? 'var(--text-muted)'
        : yes
          ? 'var(--danger)'
          : 'var(--safe)';

  const crest = (
    <div class={s.crest} style={{ '--halo': team.halo }}>
      <span class={cx(ty.head, s.code)} style={{ textTransform: 'none' }}>
        {team.code}
      </span>
      <div aria-hidden="true" class={s.halo}></div>
      <img
        class={s.img}
        src={`/${slug}.svg`}
        alt={`Escudo d${team.art.toLowerCase()} ${team.name}`}
        onError={hideImg}
      />
    </div>
  );
  const question = <h1 class={cx(ty.head, s.q)}>{ask(team)}</h1>;
  const answer = (
    <div class={s.ansBox}>
      <div
        key={word}
        aria-hidden="true"
        class={cx(ty.head, s.ans)}
        style={{ color, animation: yes ? `${STAMP}, glowpulse 2.8s ease-in-out .7s infinite` : STAMP }}
      >
        {word}
      </div>
    </div>
  );

  return (
    <section ref={heroRef} class={cx(s.hero, mobile && s.mobile)}>
      <div aria-hidden="true" class={cx(s.layer, s.stripes)} style={{ background: team.bg }}></div>
      <div aria-hidden="true" class={cx(s.layer, s.glow, s.glowDanger, state === 'yes' && s.on)}></div>
      <div aria-hidden="true" class={cx(s.layer, s.glow, s.glowSafe, state === 'no' && s.on)}></div>
      <div aria-hidden="true" class={s.fade}></div>

      {banner}

      {mobile ? (
        <div class={s.stack}>
          <div class={s.line}>
            {crest}
            {question}
          </div>
          {answer}
        </div>
      ) : (
        <div class={s.row}>
          {crest}
          <div class={s.col}>
            {question}
            {answer}
          </div>
        </div>
      )}

      {children}
    </section>
  );
}
