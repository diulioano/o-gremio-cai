import type { Outcome } from '../../../domain/predictions';
import { cx } from '../../lib/cx';
import s from './OutcomePicker.module.css';

interface Props {
  home: string;
  away: string;
  value: Outcome | null;
  onPick: (o: Outcome) => void;
}

/** Vitória do mandante, empate ou vitória do visitante: preenche o placar padrão. */
export function OutcomePicker({ home, away, value, onPick }: Props) {
  const options: [Outcome, string, string][] = [
    ['V', home, `Vitória do ${home}`],
    ['E', 'Empate', 'Empate'],
    ['D', away, `Vitória do ${away}`],
  ];
  return (
    <div role="group" aria-label="Resultado para o mandante" class={s.group}>
      {options.map(([o, text, label]) => (
        <button
          key={o}
          aria-label={label}
          aria-pressed={value === o}
          class={cx(s.btn, value === o && s.on)}
          onClick={() => {
            onPick(o);
          }}
        >
          {text}
        </button>
      ))}
    </div>
  );
}
