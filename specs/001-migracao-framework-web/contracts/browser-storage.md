# Contract: armazenamento no navegador

Chaves **mantidas** da versão atual (FR-003, SC-002). Fonte em código: `src/client/lib/storage.ts`.

| Chave | Conteúdo | Escrita | Leitura |
|-------|----------|---------|---------|
| `gremiocai-palpites-v1` | `Record<string /* matchId */, { h: number; a: number; auto?: 1 }>` (JSON) | a cada mudança de palpite | ao abrir qualquer página. Na home, só para saber se existe algum |
| `gremiocai-dados-v1` | `DataPayload` (JSON, ver [api-data.md](./api-data.md)) | a cada `/api/data` bem-sucedido | só quando `/api/data` falha |

## Regras de leitura (defensivas)

- JSON inválido ou valor que não é objeto: trata como vazio (`{}` ou `null`), sem lançar erro.
- Palpite com `h`/`a` que não é inteiro entre 0 e 9: descarta **só aquela entrada**.
- `auto` diferente de `1`: ignora o campo.
- Dados sem `matches` em array: tratados como ausentes.
- `localStorage` indisponível (modo privado, cota cheia): a leitura devolve vazio e a escrita falha em silêncio, como hoje.
