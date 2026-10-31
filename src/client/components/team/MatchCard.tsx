import { when } from '../../../domain/format';
import { outcome, predictionFor, type Predictions, type Side } from '../../../domain/predictions';
import type { Match } from '../../../domain/prepare';
import type { TeamInfo } from '../../../domain/standings';
import type { PredictionActions } from '../../hooks/usePredictions';
import { cx } from '../../lib/cx';
import { Crest } from '../common/Crest';
import { Icon } from '../common/Icon';
import s from './MatchCard.module.css';
import { OutcomePicker } from './OutcomePicker';
import { ScoreInput } from './ScoreInput';

interface Props {
  g: Match;
  home: TeamInfo;
  away: TeamInfo;
  gid: number | null;
  predictions: Predictions;
  actions: PredictionActions;
  /** a rodada tem jogos com e sem palpite */
  roundMissing: boolean;
  mobile: boolean;
}

function metaText(g: Match): string {
  const w = when(g.utc);
  if (g.status === 'fin') return `Encerrado · ${w.wd} ${w.d}/${w.m}`;
  if (g.status === 'live') return 'Em andamento';
  if (g.postponed) return 'Adiado';
  return `${w.wd} ${w.d}/${w.m} · ${w.hm}`;
}

/** Um jogo da rodada: placar (passado) ou palpite (futuro). */
export function MatchCard({ g, home, away, gid, predictions, actions, roundMissing, mobile }: Props) {
  const p = predictionFor(predictions, g);
  const isFut = g.status === 'fut';
  const self = g.home === gid || g.away === gid;

  const line = (t: TeamInfo, side: Side) => (
    <div class={s.line}>
      <Crest team={t} size="24px" />
      <span class={cx(s.name, t.id === gid && s.bold)}>{t.name}</span>
      {!isFut && <span class={s.score}>{side === 'h' ? g.homeGoals : g.awayGoals}</span>}
      {isFut && (
        <ScoreInput
          name={t.name}
          value={p ? String(p[side]) : ''}
          picked={!!p}
          steppers={mobile}
          onStep={(d) => {
            actions.step(g.id, side, d);
          }}
          onInput={(text) => {
            actions.setValue(g.id, side, text);
          }}
        />
      )}
    </div>
  );

  return (
    <div
      class={cx(
        s.card,
        mobile && s.mobile,
        self && s.self,
        (!!p || (isFut && roundMissing)) && s.warn,
        isFut && !p && roundMissing && s.dashed,
      )}
    >
      <div class={s.meta}>
        <div class={s.metaLeft}>
          {g.status === 'live' && (
            <>
              <span class={s.liveDot} style={{ animation: 'livedot 1.2s ease-in-out infinite' }}></span>
              <span class={s.live}>AO VIVO</span>
            </>
          )}
          <span>{metaText(g)}</span>
        </div>
        {p && (
          <div class={s.pickTag}>
            <span class={s.pickLabel}>{p.auto ? 'Sorteado' : 'Palpite'}</span>
            <button
              aria-label="Apagar palpite"
              class={s.remove}
              onClick={() => {
                actions.clear(g.id);
              }}
            >
              <Icon name="close" size="15px" strokeWidth={2.6} />
            </button>
          </div>
        )}
      </div>
      {line(home, 'h')}
      {line(away, 'a')}
      {isFut && (
        <OutcomePicker
          home={home.name}
          away={away.name}
          value={p ? outcome(p) : null}
          onPick={(o) => {
            actions.pick(g.id, o);
          }}
        />
      )}
    </div>
  );
}
