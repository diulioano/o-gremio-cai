import type { RefObject } from 'preact';
import { useEffect, useState } from 'preact/hooks';

export type Pin = 'top' | 'bottom' | null;

/**
 * Com o banner fora da tela, a barra do time (com o SIM/NÃO) gruda no rodapé; no celular, vai para o topo
 * quando a linha dele na tabela já passou. bandOut: a faixa do modo simulação já saiu da tela.
 */
export function usePinnedBar(
  heroRef: RefObject<HTMLElement>,
  rootRef: RefObject<HTMLElement>,
  gid: number | null,
  mobile: boolean,
) {
  const [pin, setPin] = useState<Pin>(null);
  const [bandOut, setBandOut] = useState(false);
  useEffect(() => {
    const update = () => {
      let p: Pin = null;
      const hero = heroRef.current,
        root = rootRef.current;
      if (hero && root && hero.getBoundingClientRect().bottom < 80) {
        const g = root.querySelector(`[data-team="${String(gid)}"]`);
        p = mobile && g && g.getBoundingClientRect().bottom < 36 ? 'top' : 'bottom';
      }
      setPin(p);
      setBandOut(!!hero && hero.getBoundingClientRect().top < -48);
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [heroRef, rootRef, gid, mobile]);
  return { pin, bandOut };
}
