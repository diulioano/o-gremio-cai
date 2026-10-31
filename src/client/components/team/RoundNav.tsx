import { cx } from '../../lib/cx';
import ty from '../../styles/type.module.css';
import { Icon } from '../common/Icon';
import s from './RoundNav.module.css';

interface Props {
  /** rodada exibida; null enquanto os dados não chegam */
  round: number | null;
  /** "31 out – 2 nov" */
  range: string;
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
}

export function RoundNav({ round, range, canPrev, canNext, onPrev, onNext }: Props) {
  return (
    <div class={s.nav}>
      <button aria-label="Rodada anterior" class={s.btn} onClick={onPrev} disabled={!canPrev}>
        <Icon name="prev" size="20px" />
      </button>
      <div class={s.center}>
        <span class={cx(ty.head, s.title)}>{round == null ? 'Rodada' : `Rodada ${round}`}</span>
        <span class={s.range}>{range}</span>
      </div>
      <button aria-label="Próxima rodada" class={s.btn} onClick={onNext} disabled={!canNext}>
        <Icon name="next" size="20px" />
      </button>
    </div>
  );
}
