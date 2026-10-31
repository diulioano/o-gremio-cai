import { cx } from '../../lib/cx';
import s from './ScoreInput.module.css';

interface Props {
  /** nome do time, para os rótulos de acessibilidade */
  name: string;
  /** placar do palpite, ou '' sem palpite */
  value: string;
  picked: boolean;
  /** botões − e + (no celular) */
  steppers: boolean;
  onStep: (delta: number) => void;
  onInput: (text: string) => void;
}

/** Placar exato de um lado do jogo: campo de 0 a 9 e, no celular, botões − e +. */
export function ScoreInput({ name, value, picked, steppers, onStep, onInput }: Props) {
  return (
    <div class={s.wrap}>
      {steppers && (
        <button
          aria-label={`Menos um gol para ${name}`}
          class={s.step}
          onClick={() => {
            onStep(-1);
          }}
        >
          −
        </button>
      )}
      <input
        type="number"
        min="0"
        max="9"
        inputMode="numeric"
        placeholder="–"
        aria-label={`Gols de ${name}`}
        value={value}
        onInput={(e) => {
          onInput(e.currentTarget.value);
        }}
        class={cx(s.input, picked && s.picked)}
      />
      {steppers && (
        <button
          aria-label={`Mais um gol para ${name}`}
          class={s.step}
          onClick={() => {
            onStep(1);
          }}
        >
          +
        </button>
      )}
    </div>
  );
}
