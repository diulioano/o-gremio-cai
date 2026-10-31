import { pctLabel } from '../../../domain/format';
import type { SimulationResult } from '../../../domain/simulate';
import { cx } from '../../lib/cx';
import ty from '../../styles/type.module.css';
import { Skeleton } from '../common/Skeleton';
import rs from './StandingsRow.module.css';
import { StandingsRow, type RowView } from './StandingsRow';
import s from './StandingsTable.module.css';

interface Props {
  /** tabela exibida (com palpites, se houver); null enquanto carrega */
  res: SimulationResult | null;
  /** tabela real, para as setas de quanto cada time subiu ou caiu */
  real: SimulationResult | null;
  gid: number | null;
  isSim: boolean;
  failed: boolean;
  mobile: boolean;
}

const PRE_LIBERTADORES = 'color-mix(in srgb, var(--accent) 45%, #06223a)';

function rows(
  res: SimulationResult,
  real: SimulationResult | null,
  gid: number | null,
  isSim: boolean,
): RowView[] {
  const realPos: Record<number, number> = {};
  real?.table.forEach((t, i) => (realPos[t.id] = i + 1));
  const n = res.table.length;
  return res.table.map((t, i) => {
    const pos = i + 1,
      z4 = pos > n - 4,
      p = res.pct[t.id] ?? 0;
    const dlt = (realPos[t.id] ?? pos) - pos;
    const self = t.id === gid;
    return {
      t,
      pos,
      self,
      z4Label: pos === n - 3,
      delta: isSim && dlt ? dlt : null,
      zone: pos <= 4 ? 'var(--accent)' : pos <= 6 ? PRE_LIBERTADORES : z4 ? 'var(--danger)' : 'transparent',
      bg: self
        ? 'color-mix(in srgb, var(--accent) 12%, var(--surface))'
        : z4
          ? 'color-mix(in srgb, var(--danger) 8%, var(--surface))'
          : i % 2
            ? 'color-mix(in srgb, var(--surface-2) 55%, var(--surface))'
            : 'var(--surface)',
      borderTop:
        pos === n - 3
          ? '2px dashed var(--danger)'
          : i
            ? '1px solid color-mix(in srgb, var(--line) 60%, transparent)'
            : 'none',
      pct: pctLabel(p, res.dec[t.id] ?? null),
      pctWidth: `${Math.round(p * 100)}%`,
      pctColor: p >= 0.5 ? 'var(--danger)' : p >= 0.15 ? 'var(--text)' : 'var(--text-muted)',
    };
  });
}

/** Classificação completa, com a faixa da zona, a % de queda e as setas do modo simulação. */
export function StandingsTable({ res, real, gid, isSim, failed, mobile }: Props) {
  return (
    <section id="classificacao" class={cx(s.section, mobile && s.mobile)}>
      <div class={ty.sectionHeader}>
        <h2 class={cx(ty.h2, mobile && ty.h2Mobile)}>Classificação</h2>
        <span class={ty.note}>{isSim ? 'Tabela simulada' : 'Tabela atual'}</span>
      </div>
      <div role="table" aria-label="Classificação do campeonato" class={s.table}>
        <div role="row" class={cx(rs.grid, mobile && rs.mobile, s.head)}>
          <span class={s.headPos}>Pos</span>
          <span>Clube</span>
          <span class={s.c}>P</span>
          {!mobile && (
            <>
              <span class={s.c}>J</span>
              <span class={s.c}>V</span>
              <span class={s.c}>E</span>
              <span class={s.c}>D</span>
            </>
          )}
          <span class={s.c}>SG</span>
          <span class={s.r}>% queda</span>
        </div>
        {!res ? (
          <div class={s.skeletons}>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((k) => (
              <Skeleton
                key={k}
                height="36px"
                margin="4px 0"
                radius="6px"
                background="var(--surface-2)"
                still={failed}
              />
            ))}
          </div>
        ) : (
          rows(res, real, gid, isSim).map((r) => <StandingsRow key={r.t.id} r={r} mobile={mobile} />)
        )}
      </div>
      <div class={s.legend}>
        <span class={s.key}>
          <span class={s.swatch} style={{ background: 'var(--accent)' }}></span>Libertadores
        </span>
        <span class={s.key}>
          <span class={s.swatch} style={{ background: PRE_LIBERTADORES }}></span>Pré-Libertadores
        </span>
        <span class={s.key}>
          <span class={s.swatch} style={{ background: 'var(--danger)' }}></span>Z4 · rebaixamento
        </span>
      </div>
    </section>
  );
}
