# Contrato: localStorage (delta)

As chaves existentes (`gremiocai-palpites-v1`, `gremiocai-dados-v1`) não mudam.

| Chave | Conteúdo | Quem grava | Quando |
|-------|----------|------------|--------|
| `vaicair-voto-v1` | `{ voter: string, picks?: [n, n, n], at?: number }` | `src/client/lib/storage.ts` (`loadVote`/`saveVote`) | `voter`: na primeira vez que a votação aparece. `picks`/`at`: só depois de 201 ou 409 |

- Leitura tolerante, como nos palpites: um JSON inválido, um `voter` fora do formato UUID ou `picks` que não passem em `ballotError` são descartados. Se o `voter` for inválido, gera-se um novo.
- Em modo privado ou com a cota cheia, a gravação falha em silêncio. O visitante consegue votar, mas ao voltar verá o formulário de novo; um novo envio recebe 409 só se o mesmo `voter` tiver sobrevivido. Esse caso foi aceito na spec (sem login).
