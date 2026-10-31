import { useEffect, useMemo, useState } from 'preact/hooks';
import { prepare } from '../../domain/prepare';
import type { DataError, DataPayload } from '../../shared/api';
import type { Team } from '../../shared/teams';
import { loadCachedData, saveCachedData } from '../lib/storage';

/** Dados da API (com cópia no localStorage para quando cair a conexão) e um relógio de minuto em minuto. */
export function useMatchData(team: Team | null) {
  const [raw, setRaw] = useState<DataPayload | null>(null);
  const [err, setErr] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    fetch('/api/data')
      .then((r) => r.json() as Promise<DataPayload | DataError>)
      .then((d) => {
        if (!('matches' in d)) throw new Error('error' in d ? d.error : 'sem dados');
        setRaw(d);
        setErr(!!d.stale);
        saveCachedData(d);
      })
      .catch(() => {
        setErr(true);
        const d = loadCachedData();
        if (d) setRaw(d);
      });
    const t = setInterval(() => {
      setNow(Date.now());
    }, 60000);
    return () => {
      clearInterval(t);
    };
  }, []);
  const P = useMemo(() => (raw ? prepare(raw, team) : null), [raw, team]);
  return { raw, err, now, P };
}
