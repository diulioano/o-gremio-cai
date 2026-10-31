import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { isLiveWindow, POLL_MS } from '../../domain/live';
import { prepare } from '../../domain/prepare';
import type { DataError, DataPayload } from '../../shared/api';
import type { Team } from '../../shared/teams';
import { loadCachedData, saveCachedData } from '../lib/storage';

/** Busca de novo só com jogo ao vivo e a aba visível: aba parada ou dia sem jogo não gasta requisição. */
const shouldPoll = (d: DataPayload | null) =>
  !!d && document.visibilityState === 'visible' && isLiveWindow(d.matches, Date.now());

/** Dados da API (com cópia no localStorage para quando cair a conexão) e um relógio de minuto em minuto. */
export function useMatchData(team: Team | null) {
  const [raw, setRaw] = useState<DataPayload | null>(null);
  const [err, setErr] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  // o intervalo e o listener leem os dados mais recentes por aqui, sem recriar o efeito
  const rawRef = useRef<DataPayload | null>(null);

  useEffect(() => {
    const show = (d: DataPayload) => {
      rawRef.current = d;
      setRaw(d);
    };
    const load = () => {
      fetch('/api/data')
        .then((r) => r.json() as Promise<DataPayload | DataError>)
        .then((d) => {
          if (!('matches' in d)) throw new Error('error' in d ? d.error : 'sem dados');
          show(d);
          setErr(!!d.stale);
          saveCachedData(d);
        })
        .catch(() => {
          setErr(true);
          // numa busca de atualização que falhou, segue com o que já está na tela
          if (rawRef.current) return;
          const d = loadCachedData();
          if (d) show(d);
        });
    };
    load();
    const t = setInterval(() => {
      setNow(Date.now());
      if (shouldPoll(rawRef.current)) load();
    }, POLL_MS);
    const onVisible = () => {
      if (shouldPoll(rawRef.current)) load();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);
  const P = useMemo(() => (raw ? prepare(raw, team) : null), [raw, team]);
  return { raw, err, now, P };
}
