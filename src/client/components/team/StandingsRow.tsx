import { signed } from '../../../domain/format';
import type { StandingRow as Row } from '../../../domain/standings';
import { cx } from '../../lib/cx';
import { Crest } from '../common/Crest';
import s from './StandingsRow.module.css';

export interface RowView {
  t: Row;
  pos: number;
  /** o time da página */
  self: boolean;
  /** primeira linha do Z4 (leva o rótulo) */
  z4Label: boolean;
  /** posições ganhas (+) ou perdidas (−) em relação à tabela real; só aparece no modo simulação */
  delta: number | null;
  zone: string;
  bg: string;
  borderTop: string;
  pct: string;
  pctWidth: string;
  pctColor: string;
}

interface Props {
  r: RowView;
  mobile: boolean;
}

export function StandingsRow({ r, mobile }: Props) {
  const { t } = r;
  return (
    <div
      role="row"
      data-team={t.id}
      class={cx(s.grid, s.row, mobile && s.mobile, r.self && s.self)}
      style={{
        zIndex: r.self ? 2 : r.z4Label ? 1 : 0,
        background: r.bg,
        borderTop: r.borderTop,
        boxShadow: r.self ? 'inset 0 0 0 2px var(--accent)' : 'none',
      }}
    >
      <div class={s.posCell}>
        <span class={s.zone} style={{ background: r.zone }}></span>
        <span class={s.pos}>{r.pos}</span>
      </div>
      <div class={s.club}>
        <Crest team={t} size={mobile ? '22px' : '28px'} />
        <span class={s.name}>{t.name}</span>
        {r.delta ? (
          <span
            aria-label={r.delta > 0 ? `subiu ${r.delta}` : `caiu ${-r.delta}`}
            class={s.arrow}
            style={{ color: r.delta > 0 ? 'var(--safe)' : 'var(--danger)' }}
          >
            {r.delta > 0 ? `▲${r.delta}` : `▼${-r.delta}`}
          </span>
        ) : null}
      </div>
      <span class={s.pts}>{t.pts}</span>
      {!mobile && (
        <>
          <span class={s.num}>{t.j}</span>
          <span class={s.num}>{t.v}</span>
          <span class={s.num}>{t.e}</span>
          <span class={s.num}>{t.d}</span>
        </>
      )}
      <span class={s.num}>{signed(t.sg)}</span>
      <div class={s.pctCell}>
        <span class={s.pct} style={{ color: r.pctColor }}>
          {r.pct}
        </span>
        <span class={s.bar}>
          <span class={s.fill} style={{ width: r.pctWidth }}></span>
        </span>
      </div>
      {r.z4Label && <span class={s.z4}>Z4</span>}
    </div>
  );
}
