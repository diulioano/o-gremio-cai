import { cx } from '../../lib/cx';
import s from './Z4Divider.module.css';

/** Linha tracejada entre quem cairia hoje (acima) e quem escapa (abaixo). */
export function Z4Divider({ mobile }: { mobile: boolean }) {
  return (
    <div role="separator" class={cx(s.divider, mobile && s.mobile)}>
      <span class={s.line}></span>
      <span class={s.label}>
        <span class={s.z4}>Z4</span>Linha da queda
      </span>
      <span class={s.line}></span>
    </div>
  );
}
