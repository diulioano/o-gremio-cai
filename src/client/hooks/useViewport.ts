import { useEffect, useState } from 'preact/hooks';

/** Largura da janela e os dois cortes do layout: celular (< 768) e largo (>= 1100). */
export function useViewport() {
  const [width, setWidth] = useState(window.innerWidth);
  useEffect(() => {
    const onResize = () => {
      setWidth(window.innerWidth);
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
    };
  }, []);
  return { width, mobile: width < 768, wide: width >= 1100 };
}
