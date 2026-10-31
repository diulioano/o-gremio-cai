import type { Team } from '../../../shared/teams';
import type { Vote } from '../../hooks/useVote';
import { Icon } from '../common/Icon';
import s from './CrowdLine.module.css';

/**
 * Linha da torcida, abaixo do veredito: o que quem votou acha deste time.
 * Discreta de propósito: nunca usa o vermelho/verde nem o tamanho da % calculada (é opinião, não chance).
 */
export function CrowdLine({ team, vote }: { team: Team; vote: Vote }) {
  const { phase, state, open } = vote;
  if (!state || phase === 'loading' || phase === 'hidden') return null;
  const row = state.rows?.find((r) => r.id === team.id);
  const voted = phase === 'voted' || phase === 'closed';

  return (
    <div class={s.line}>
      <span class={s.ico}>
        <Icon name="bars" size="16px" strokeWidth={2.6} />
      </span>
      {row ? (
        <>
          <span>
            {row.pct}% da torcida acha que {team.art.toLowerCase()} {team.name} cai
          </span>
          <button class={s.link} onClick={open}>
            ver votação
          </button>
        </>
      ) : voted && state.warmingUp ? (
        <span>A votação está começando</span>
      ) : (
        <button class={s.link} onClick={open}>
          Vote para ver o que a torcida acha
          <Icon name="next" size="14px" strokeWidth={3} />
        </button>
      )}
    </div>
  );
}
