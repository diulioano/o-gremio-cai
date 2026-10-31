import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import type { CardData } from '../../domain/share';
import { ask, type Team, type TeamSlug } from '../../shared/teams';
import { renderCard } from '../lib/card';

export type ShareState = 'closed' | 'loading' | 'ready' | 'error';

/**
 * Botão compartilhar: gera o card na hora de abrir a prévia (com a tabela exibida naquele momento)
 * e entrega pelo menu nativo, por download ou pelo link. O link é o da página do time, sem os palpites.
 */
export function useShare(team: Team, slug: TeamSlug, card: CardData | null) {
  const [state, setState] = useState<ShareState>('closed');
  const [img, setImg] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [copied, setCopied] = useState(false);
  const runRef = useRef(0);
  const link = `${location.origin}/${slug}`;

  const reset = useCallback(() => {
    runRef.current++;
    setImg((u) => {
      if (u) URL.revokeObjectURL(u);
      return null;
    });
    setFile(null);
    setCopied(false);
  }, []);

  const open = () => {
    if (!card) return;
    reset();
    const id = runRef.current;
    setState('loading');
    renderCard(team, slug, card).then(
      (blob) => {
        if (id !== runRef.current) return;
        setFile(new File([blob], `vaicair-${slug}.png`, { type: 'image/png' }));
        setImg(URL.createObjectURL(blob));
        setState('ready');
      },
      () => {
        if (id === runRef.current) setState('error');
      },
    );
  };

  const close = () => {
    reset();
    setState('closed');
  };

  useEffect(() => reset, [reset]);

  const canShareFiles =
    !!file && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });

  const download = () => {
    if (!img || !file) return;
    const a = document.createElement('a');
    a.href = img;
    a.download = file.name;
    a.click();
  };

  const share = async () => {
    if (!file) return;
    try {
      await navigator.share({ files: [file], text: `${ask(team)} ${card?.yes ? 'SIM' : 'NÃO'}.\n${link}` });
    } catch (e) {
      // fechar o menu nativo não é erro; qualquer outra falha cai no download
      if ((e as Error).name !== 'AbortError') download();
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
      }, 2400);
    } catch {
      prompt('Copie o link:', link);
    }
  };

  return { state, img, link, copied, canShareFiles, open, close, share, download, copy };
}

export type Share = ReturnType<typeof useShare>;
