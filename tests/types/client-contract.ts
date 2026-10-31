// Contrato de /api/data do lado do cliente (FR-011): checado pelo `npm run typecheck`, sem rodar nada.
import type { useMatchData } from '../../src/client/hooks/useMatchData';
import type { loadCachedData } from '../../src/client/lib/storage';
import type { DataPayload } from '../../src/shared/api';

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- truque padrão de igualdade exata de tipos
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Assert<T extends true> = T;

export type RawIsPayload = Assert<Equal<ReturnType<typeof useMatchData>['raw'], DataPayload | null>>;
export type CacheIsPayload = Assert<Equal<ReturnType<typeof loadCachedData>, DataPayload | null>>;

// /api/votes (specs/003-votacao-rebaixados/contracts/api-votes.md): o estado que a tela recebe é o do contrato
import type { useVote } from '../../src/client/hooks/useVote';
import type { VoteState } from '../../src/shared/api';
export type VoteStateIsContract = Assert<Equal<ReturnType<typeof useVote>['state'], VoteState | null>>;
