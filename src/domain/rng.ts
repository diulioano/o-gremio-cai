/** Gerador pseudoaleatório com semente (mulberry32): a mesma semente dá a mesma sequência. */
export function mulberry(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Placar sorteado pelo mesmo modelo da % de queda (Poisson pela força dos times), no máximo 9. */
export function drawGoals(lambda: number, rng: () => number = Math.random): number {
  const e = Math.exp(-lambda);
  let k = 0;
  let p = rng();
  while (p > e && k < 9) {
    k++;
    p *= rng();
  }
  return k;
}
