import type { ComponentChildren } from 'preact';
import s from './StatusBar.module.css';

interface Props {
  dot: string;
  /** false esconde o texto (no celular, quando o selo de simulação ocupa a barra) */
  text: string | false;
  right?: ComponentChildren;
}

/** Barra fina no topo: de onde vêm os dados, há quanto tempo e a rodada. */
export function StatusBar({ dot, text, right }: Props) {
  return (
    <div class={s.bar}>
      <div class={s.left}>
        <span class={s.dot} style={{ background: dot }}></span>
        {text && <span class={s.text}>{text}</span>}
      </div>
      {right}
    </div>
  );
}
