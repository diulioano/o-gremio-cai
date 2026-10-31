import type { Verdict } from '../../../domain/verdict';
import { ask, type Team } from '../../../shared/teams';
import type { Pin } from '../../hooks/usePinnedBar';
import { cx } from '../../lib/cx';
import s from './PinnedVerdictBar.module.css';

interface Props {
  pin: Exclude<Pin, null>;
  team: Team;
  v: Verdict;
  crest: string;
  /** cor do SIM/NÃO */
  color: string;
  width: number;
  mobile: boolean;
}

/** Barra fixa com o veredito quando o banner sai da tela; toca para voltar ao topo. */
export function PinnedVerdictBar({ pin, team, v, crest, color, width, mobile }: Props) {
  const word = v.yes ? 'SIM' : 'NÃO';
  return (
    <div
      role="group"
      aria-label={`${ask(team)} ${v.yes ? 'Sim' : 'Não'}. ${v.pos}º lugar, ${v.row.pts} pontos, ${v.pctLabel} de chance de cair`}
      class={cx(s.bar, mobile && s.mobile, pin === 'top' ? s.top : s.bottom, v.yes && s.yes)}
    >
      <span aria-hidden="true" class={s.b7}>
        {v.pos}º
      </span>
      <img src={crest} alt="" class={s.crest} />
      <span aria-hidden="true" class={s.name}>
        {width >= 360 ? team.name : ''}
      </span>
      <span aria-hidden="true" class={s.pts}>
        {v.row.pts} pts
      </span>
      <span
        aria-hidden="true"
        class={s.b7}
        style={{ color: v.pct >= 0.5 ? 'var(--danger)' : 'var(--text-muted)' }}
      >
        {v.pctLabel}
      </span>
      <a
        href="#"
        aria-hidden="true"
        tabIndex={-1}
        class={s.link}
        style={{ '--col': color }}
        onClick={(e) => {
          e.preventDefault();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      >
        <span class={s.cai}>Cai?</span>
        <span class={s.word}>{word}</span>
      </a>
    </div>
  );
}
