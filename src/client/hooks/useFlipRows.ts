import type { RefObject } from 'preact';
import { useCallback, useLayoutEffect, useRef } from 'preact/hooks';

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const rows = (root: HTMLElement) => root.querySelectorAll<HTMLElement>('[data-team]');

/** FLIP: as linhas da tabela deslizam até a nova posição. capture() grava as posições antes da mudança. */
export function useFlipRows(rootRef: RefObject<HTMLElement>) {
  const posRef = useRef<Record<string, number> | null>(null);

  useLayoutEffect(() => {
    const old = posRef.current;
    posRef.current = null;
    const root = rootRef.current;
    if (!old || !root || reduced()) return;
    rows(root).forEach((el) => {
      const o = old[el.dataset.team ?? ''];
      if (o == null) return;
      const dy = o - el.getBoundingClientRect().top;
      if (Math.abs(dy) > 1) {
        el.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], {
          duration: 320,
          easing: 'cubic-bezier(.2,.8,.2,1)',
        });
      }
    });
  });

  return useCallback(() => {
    const root = rootRef.current;
    if (!root) return;
    const m: Record<string, number> = {};
    rows(root).forEach((el) => (m[el.dataset.team ?? ''] = el.getBoundingClientRect().top));
    posRef.current = m;
  }, [rootRef]);
}
