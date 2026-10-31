import { TEAMS } from '../../../shared/teams';
import type { Vote } from '../../hooks/useVote';
import { cx } from '../../lib/cx';
import { BY_ID, TeamCrest, fmt } from './VoteCrest';
import s from './VoteSheet.module.css';

/** Gaveta, estados D (votou), E (votação começando) e F (encerrada). Só quem votou ou depois do fim. */
export function VoteResult({ vote }: { vote: Vote }) {
  const { phase, state } = vote;
  const closed = phase === 'closed';
  const mine: readonly number[] = state?.mine ?? [];

  return (
    <>
      <div class={s.body}>
        {mine.length > 0 && (
          <div class={s.mine}>
            <span class={s.kicker}>SEU PALPITE</span>
            <div class={s.chips}>
              {mine.map((id) => {
                const slug = BY_ID.get(id);
                return (
                  slug && (
                    <span key={id} class={s.chip}>
                      <TeamCrest slug={slug} size={22} />
                      {TEAMS[slug].name}
                    </span>
                  )
                );
              })}
            </div>
          </div>
        )}
        {state?.rows && (
          <ol class={s.results}>
            {state.rows.map((r) => {
              const slug = BY_ID.get(r.id);
              if (!slug) return null;
              const my = mine.includes(r.id);
              return (
                <li key={r.id} class={cx(s.row, my && s.myRow)}>
                  <TeamCrest slug={slug} size={24} />
                  <div class={s.rowMid}>
                    <span class={s.rowName}>
                      {TEAMS[slug].name}
                      {my && <span class={s.myTag}>SEU VOTO</span>}
                    </span>
                    <span class={s.track} aria-hidden="true">
                      <span class={s.fill} style={{ width: `${String(r.pct)}%` }}></span>
                    </span>
                  </div>
                  <span class={s.pct}>{r.pct}%</span>
                </li>
              );
            })}
          </ol>
        )}
        {state?.warmingUp && (
          <div class={s.starting}>
            <span class={s.startBars} aria-hidden="true">
              <span style={{ height: '18px' }}></span>
              <span style={{ height: '34px' }}></span>
              <span style={{ height: '26px' }}></span>
            </span>
            <strong class={s.startTitle}>
              {closed ? 'Poucos votos para mostrar porcentagens' : 'A votação está começando'}
            </strong>
            <span class={s.muted}>
              {closed
                ? 'A votação fechou com menos de 10 votos.'
                : 'Volte daqui a pouco para ver o que a torcida acha. Mostramos as porcentagens a partir de 10 votos.'}
            </span>
          </div>
        )}
      </div>
      <div class={cx(s.foot, s.resultFoot)}>
        {state?.rows && <strong>{fmt(state.total)} votos</strong>}
        <span class={s.muted}>Opinião de quem votou, não é a chance de cair. A chance vem da simulação.</span>
        {/* import.meta.env.DEV: o build de produção apaga este botão */}
        {import.meta.env.DEV && vote.voteAgain && !closed && (
          <button class={s.devAgain} onClick={vote.voteAgain}>
            Votar de novo (só no local)
          </button>
        )}
      </div>
    </>
  );
}
