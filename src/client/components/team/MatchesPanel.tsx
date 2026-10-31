import { games, roundRange } from '../../../domain/format';
import { missingIn, type Predictions } from '../../../domain/predictions';
import type { Prepared } from '../../../domain/prepare';
import type { PredictionActions } from '../../hooks/usePredictions';
import { cx } from '../../lib/cx';
import ty from '../../styles/type.module.css';
import { Icon } from '../common/Icon';
import { MatchCard } from './MatchCard';
import s from './MatchesPanel.module.css';
import { RoundNav } from './RoundNav';

interface Props {
  P: Prepared | null;
  /** rodada exibida */
  round: number | null;
  onRound: (r: number) => void;
  predictions: Predictions;
  actions: PredictionActions;
  mobile: boolean;
  wide: boolean;
}

/** Jogos por rodada, com os palpites e os atalhos de sorteio. */
export function MatchesPanel({ P, round, onRound, predictions, actions, mobile, wide }: Props) {
  const gid = P?.gid ?? null;
  const isSelf = (g: { home: number; away: number }) => Number(g.home === gid || g.away === gid);
  // jogos do time da página primeiro, depois por horário
  const roundGames =
    P && round != null
      ? (P.rounds[round] ?? []).slice().sort((x, y) => isSelf(y) - isSelf(x) || x.utc.localeCompare(y.utc))
      : [];
  const futAll = P ? P.matches.filter((g) => g.status === 'fut') : [];
  const hasAuto = futAll.some((g) => predictions[String(g.id)]?.auto);
  const roundMissing = missingIn(roundGames, predictions);
  const roundHasPicks = roundGames.some((g) => predictions[String(g.id)]);

  return (
    <section
      id="jogos"
      aria-label="Jogos por rodada"
      class={cx(s.section, mobile && s.mobile, wide && s.wide)}
    >
      <div class={ty.sectionHeader}>
        <h2 class={cx(ty.h2, mobile && ty.h2Mobile)}>Jogos</h2>
        <span class={ty.note}>Palpite = simule o resultado</span>
      </div>
      <div class={s.box}>
        <RoundNav
          round={P ? round : null}
          range={P ? roundRange(roundGames) : ''}
          canPrev={!!P && round != null && round > P.first}
          canNext={!!P && round != null && round < P.last}
          onPrev={() => {
            if (P && round != null) onRound(Math.max(P.first, round - 1));
          }}
          onNext={() => {
            if (P && round != null) onRound(Math.min(P.last, round + 1));
          }}
        />
        {P && futAll.length > 0 && (
          <div class={s.fillBox}>
            <button
              class={s.fill}
              onClick={() => {
                actions.fill(futAll, P.lambda);
              }}
            >
              <Icon name="dice" size="18px" strokeWidth={2} />
              {hasAuto ? 'Sortear de novo' : 'Simular até o fim'}
            </button>
            <span class={s.help}>
              Sorteia placares para os jogos sem palpite até a rodada {P.last}. Os seus palpites ficam.
            </span>
          </div>
        )}
        {P && roundMissing > 0 && (
          <div role="alert" class={s.missing}>
            <span class={s.missingText}>
              <strong class={s.warn}>
                <Icon name="warn" /> {roundMissing > 1 ? 'Faltam' : 'Falta'} {games(roundMissing)} nesta
                rodada.
              </strong>{' '}
              <span class={s.muted}>
                A tabela só conta os jogos com palpite, então ela fica desequilibrada.
              </span>
            </span>
            <button
              class={s.drawMissing}
              onClick={() => {
                actions.fill(roundGames, P.lambda);
              }}
            >
              Sortear os que faltam
            </button>
          </div>
        )}
        {roundHasPicks && (
          <div class={s.clearBox}>
            <button
              class={s.clear}
              onClick={() => {
                actions.clearRound(roundGames);
              }}
            >
              Limpar palpites desta rodada
            </button>
          </div>
        )}
        <div class={s.list}>
          {P &&
            roundGames.map((g) => (
              <MatchCard
                key={g.id}
                g={g}
                home={P.teams[g.home] ?? { id: g.home, name: '', code: '', crest: null }}
                away={P.teams[g.away] ?? { id: g.away, name: '', code: '', crest: null }}
                gid={gid}
                predictions={predictions}
                actions={actions}
                roundMissing={roundMissing > 0}
                mobile={mobile}
              />
            ))}
        </div>
      </div>
    </section>
  );
}
