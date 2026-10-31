import type { Verdict } from '../../../domain/verdict';
import type { Team } from '../../../shared/teams';
import { Icon } from '../common/Icon';
import { LoadFailed } from '../common/LoadFailed';
import { Skeleton } from '../common/Skeleton';
import s from './VerdictDetails.module.css';

interface Props {
  team: Team;
  v: Verdict | null;
  isSim: boolean;
  /** sem dados nenhum */
  failed: boolean;
  /** os dados chegaram, mas o time não está neles */
  notFound: boolean;
  /** abre a prévia do card de compartilhar */
  onShare: () => void;
}

/** Embaixo do SIM/NÃO: selo (salvo/rebaixado), a % e a posição, ou o aviso de erro. */
export function VerdictDetails({ team, v, isSim, failed, notFound, onShare }: Props) {
  const color = v?.yes ? 'var(--danger)' : 'var(--safe)';
  return (
    <>
      {v?.badge && (
        <div
          class={s.badge}
          style={{
            '--badge': v.badge === 'REBAIXADO' || v.badge === 'CAIU' ? 'var(--danger)' : 'var(--safe)',
          }}
        >
          {v.badge}
        </div>
      )}

      <p class="sr" aria-live="polite">
        {v
          ? `${v.yes ? 'Sim' : 'Não'}. ${v.pctLabel} ${v.ctxRest}.${isSim ? ' Resposta baseada nos seus palpites.' : ''}`
          : ''}
      </p>

      {notFound ? (
        <LoadFailed
          msg={`Não achamos ${team.art.toLowerCase()} ${team.name} nos dados do campeonato.`}
          detail="A API pode estar atualizando. Tente de novo em alguns minutos."
        />
      ) : failed ? (
        <LoadFailed msg="Não deu para carregar a tabela." />
      ) : !v ? (
        <div class={s.skeletons}>
          <Skeleton width="min(420px,80vw)" height="1.4rem" radius="6px" background="var(--surface-2)" />
          <Skeleton
            width="min(220px,50vw)"
            height=".9rem"
            radius="6px"
            background="var(--surface-2)"
            delay=".2s"
          />
        </div>
      ) : (
        <p class={s.ctx}>
          <span style={{ color }}>{v.pctLabel}</span> {v.ctxRest}
        </p>
      )}

      {!failed && !notFound && (
        <div class={s.actions}>
          {v && (
            <button class={s.share} onClick={onShare}>
              <Icon name="share" size="20px" />
              Compartilhar
            </button>
          )}
          <a href="#classificacao" class={s.down}>
            ver tabela
            <span aria-hidden="true" class={s.arrow}>
              ↓
            </span>
          </a>
        </div>
      )}
    </>
  );
}
