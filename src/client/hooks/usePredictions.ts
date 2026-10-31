import { useCallback, useMemo, useState } from 'preact/hooks';
import * as pred from '../../domain/predictions';
import type { Match, Prepared } from '../../domain/prepare';
import { loadPredictions, savePredictions, type Predictions } from '../lib/storage';

/** Palpites do visitante, salvos no localStorage a cada mudança. beforeChange roda antes (FLIP da tabela). */
export function usePredictions(beforeChange?: () => void) {
  const [predictions, setPredictions] = useState<Predictions>(loadPredictions);

  const update = useCallback(
    (fn: (p: Predictions) => Predictions) => {
      beforeChange?.();
      setPredictions((s) => {
        const p = fn(s);
        savePredictions(p);
        return p;
      });
    },
    [beforeChange],
  );

  const actions = useMemo(
    () => ({
      pick: (id: number, o: pred.Outcome) => {
        update((p) => pred.pick(p, id, o));
      },
      step: (id: number, side: pred.Side, d: number) => {
        update((p) => pred.step(p, id, side, d));
      },
      setValue: (id: number, side: pred.Side, text: string) => {
        update((p) => pred.setValue(p, id, side, text));
      },
      fill: (games: readonly Match[], lambda: Prepared['lambda']) => {
        update((p) => pred.fill(p, games, lambda));
      },
      clear: (id: number) => {
        update((p) => pred.clear(p, id));
      },
      clearRound: (games: readonly Match[]) => {
        update((p) => pred.clearRound(p, games));
      },
      clearAll: () => {
        update(() => ({}));
      },
    }),
    [update],
  );

  return { predictions, isSim: Object.keys(predictions).length > 0, actions };
}

export type PredictionActions = ReturnType<typeof usePredictions>['actions'];
