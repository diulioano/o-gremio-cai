import { TEAMS, TEAM_SLUGS } from '../../../shared/teams';
import type { Vote } from '../../hooks/useVote';
import { cx } from '../../lib/cx';
import { Icon } from './Icon';
import { TeamCrest, fmt } from './VoteCrest';
import s from './VoteSheet.module.css';

// já rebaixada, fora da votação: escudo da football-data pelo nosso proxy (/crest)
const CHAPECOENSE_CREST = '/crest/png/1772';

/** Gaveta, estados A (formulário), B (enviando), C (erro) e G (fechada por hoje). */
export function VoteForm({ vote }: { vote: Vote }) {
  const { phase, state, picked, missing, problem, toggle, submit } = vote;
  const sending = phase === 'sending';
  const today = problem?.kind === 'today';
  const lockAll = sending || today;

  return (
    <>
      <div class={s.body}>
        <div class={s.out} aria-label="Chapecoense: já caiu, fora da votação">
          <span class={s.outCrest}>
            <TeamCrest src={CHAPECOENSE_CREST} size={22} />
          </span>
          <span class={s.outName}>Chapecoense</span>
          <span class={s.outTag}>JÁ CAIU · FORA DA VOTAÇÃO</span>
        </div>
        <div class={s.list} role="group" aria-label="Times da briga">
          {TEAM_SLUGS.map((slug) => {
            const t = TEAMS[slug];
            const on = picked.includes(t.id);
            const blocked = !on && (missing === 0 || lockAll);
            return (
              <button
                key={slug}
                class={cx(s.pick, on && s.on)}
                aria-pressed={on}
                disabled={blocked || sending}
                style={{ opacity: blocked ? (lockAll ? 0.55 : 0.38) : 1 }}
                onClick={() => {
                  toggle(t.id);
                }}
              >
                <TeamCrest slug={slug} size={28} />
                <span class={s.name}>{t.name}</span>
                <span class={s.box} aria-hidden="true">
                  {on && <Icon name="check" size="16px" strokeWidth={3.2} />}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <div class={s.foot}>
        <div class={s.counterRow}>
          <span class={cx(s.counter, missing === 0 && s.ready)} aria-live="polite">
            {missing === 0 ? 'Pronto!' : missing === 1 ? 'Falta 1' : `Faltam ${missing}`}
          </span>
          {state && (
            <span class={s.muted}>
              {state.total
                ? `${fmt(state.total)} ${state.total === 1 ? 'pessoa já votou' : 'pessoas já votaram'}`
                : 'Seja o primeiro a votar'}
            </span>
          )}
        </div>
        {problem?.kind === 'error' && (
          <div class={s.error} role="alert">
            <span class={s.bang} aria-hidden="true">
              <Icon name="bang" size="14px" strokeWidth={3.4} />
            </span>
            <span>{problem.text}</span>
          </div>
        )}
        {today && (
          <div class={s.today} role="alert">
            <span aria-hidden="true" class={s.moon}>
              <Icon name="moon" size="18px" strokeWidth={2.2} />
            </span>
            <span>{problem.text}</span>
          </div>
        )}
        {!today && <span class={s.note}>Voto definitivo: depois de confirmar, não dá para trocar.</span>}
        <button
          class={cx(s.confirm, sending && s.sending)}
          disabled={missing !== 0 || lockAll}
          onClick={() => void submit()}
        >
          {sending && <span class={s.spinner} aria-hidden="true"></span>}
          {sending ? 'Enviando…' : 'Confirmar voto'}
        </button>
      </div>
    </>
  );
}
