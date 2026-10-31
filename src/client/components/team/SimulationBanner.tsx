import { games } from '../../../domain/format';
import { Icon } from '../common/Icon';
import s from './SimulationBanner.module.css';

interface Props {
  onBack: () => void;
  /** [rodada, jogos sem palpite] das rodadas incompletas */
  incomplete: [number, number][];
  onGoRound: (round: number) => void;
}

/** Faixa amarela no topo do banner quando há palpites: o SIM/NÃO é da tabela simulada. */
export function SimulationBanner({ onBack, incomplete, onGoRound }: Props) {
  const first = incomplete[0];
  return (
    <div class={s.band}>
      <span class={s.title}>MODO SIMULAÇÃO</span>
      <span class={s.sub}>resposta baseada nos seus palpites</span>
      <button class={s.back} onClick={onBack}>
        Voltar ao real
      </button>
      {first && (
        <div role="alert" class={s.alert}>
          <span class={s.alertText}>
            <Icon name="warn" />
            {incomplete.length === 1
              ? `Rodada ${first[0]} com ${games(first[1])} sem palpite`
              : `${incomplete.length} rodadas com jogos sem palpite`}
          </span>
          <button
            class={s.goRound}
            onClick={() => {
              onGoRound(first[0]);
            }}
          >
            Ver rodada {first[0]}
          </button>
        </div>
      )}
    </div>
  );
}

/** O selo compacto que vai para a barra de status quando a faixa sai da tela. */
export function SimulationBadge({ onBack }: { onBack: () => void }) {
  return (
    <div class={s.badge}>
      <span class={s.tag}>MODO SIMULAÇÃO</span>
      <button class={s.link} onClick={onBack}>
        Voltar ao real
      </button>
    </div>
  );
}
