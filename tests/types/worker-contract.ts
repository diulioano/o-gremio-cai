// Contrato de /api/data do lado do Worker (FR-011): checado pelo `npm run typecheck`, sem rodar nada.
// Se src/shared/api.ts mudar e o Worker não acompanhar (ou vice-versa), esta linha deixa de compilar.
import type { DataError, DataPayload } from '../../src/shared/api';
import type { slim } from '../../src/worker/data';

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- truque padrão de igualdade exata de tipos
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Assert<T extends true> = T;

export type SlimIsPayload = Assert<Equal<ReturnType<typeof slim>, DataPayload>>;
// o corpo de /api/data é sempre um destes dois
export type Body = DataPayload | DataError;

// /api/votes: os corpos que o Worker monta são os do contrato (specs/003-votacao-rebaixados/contracts/api-votes.md)
import type { VoteError, VoteState } from '../../src/shared/api';
import type { crowdResult } from '../../src/domain/votes';
// o resultado do domínio cabe direto no VoteState (é espalhado nele em src/worker/votes.ts)
export type CrowdFitsState = Assert<ReturnType<typeof crowdResult> extends Partial<VoteState> ? true : false>;
export type VotesBody = VoteState | VoteError;
