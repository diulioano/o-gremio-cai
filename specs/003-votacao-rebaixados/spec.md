# Feature Specification: Votação "Quem você acha que cai?"

**Feature Branch**: `003-votacao-rebaixados`

**Created**: 2026-10-30

**Status**: Draft (clarificações respondidas em 2026-10-30)

**Input**: User description: "agora, gostaria de pensar um negócio o usuário poderá votar em quais times que ele acha q vai cair e isso fica salvo dps de ele confirmar o envio do formulário. Mostra oq os outros acham, também ele seleciona só 3 pois a chapecoense já está rebaixada."

## Contexto

O site responde "O [time] cai?" com base na tabela e no simulador. Falta a voz da torcida: o que as pessoas *acham* que vai acontecer. A ideia é uma votação simples em que o visitante escolhe os times que ele acha que vão cair, confirma, e passa a ver o resultado de todo mundo.

São 4 vagas de rebaixamento (17º ao 20º). A Chapecoense já está rebaixada, então sobram 3 vagas, e o visitante escolhe exatamente 3 times entre os 9 da briga (Grêmio, Inter, Corinthians, Vasco, Botafogo, Coritiba, Vitória, Mirassol e Remo).

O resultado da votação é opinião da torcida, não previsão. Ele nunca se mistura com o veredito SIM/NÃO nem com a % de queda calculada pelo simulador (Princípio II: rigor nos números).

## Clarifications

### Session 2026-10-30

- Q: O voto pode ser trocado depois de confirmado? → A: Não, é definitivo.
- Q: Quem ainda não votou pode ver o resultado? → A: Não, só depois de votar (enquanto a votação está aberta).
- Q: Quando a votação fecha? → A: Quando começa o primeiro jogo da última rodada.

### Session 2026-10-31

- Q: Onde a votação aparece? → A: Num botão flutuante no canto inferior direito, em todas as páginas (home e times). Ao tocar, sobe uma gaveta de baixo para cima com a lista dos times para escolher. Depois de votar, o botão vira "O que a torcida acha" e a gaveta mostra o resultado no lugar da lista. A linha da torcida na página do time continua.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Votar nos 3 que vão cair (Priority: P1)

Um torcedor, em qualquer página do site, toca no botão flutuante "Quem você acha que cai?" no canto inferior direito. Sobe uma gaveta com a lista dos times; ele marca 3 times entre os 9 da lista, confere a escolha e confirma o envio. O voto fica salvo e o site mostra que ele já votou, com os 3 times que escolheu.

**Why this priority**: sem o voto salvo não existe resultado para mostrar. É a base da funcionalidade.

**Independent Test**: abrir o site num aparelho que nunca votou, escolher 3 times, confirmar, fechar e abrir de novo: o site lembra que ele votou e quais times escolheu, e o voto foi contado no total.

**Acceptance Scenarios**:

1. **Given** um visitante que ainda não votou, **When** ele marca 3 times, **Then** o botão de confirmar fica disponível e os outros times ficam bloqueados para seleção até ele desmarcar algum.
2. **Given** um visitante com menos de 3 times marcados, **When** ele tenta confirmar, **Then** o envio não acontece e o site diz quantos times ainda faltam escolher.
3. **Given** um visitante com 3 times marcados, **When** ele confirma o envio, **Then** o voto é salvo, contado no resultado geral e o site mostra "Seu palpite: A, B e C".
4. **Given** um visitante que já votou, **When** ele volta ao site depois (mesmo dias depois, no mesmo aparelho e navegador), **Then** ele vê o próprio voto e o resultado, e não o formulário vazio.
5. **Given** um visitante que marcou times mas não confirmou, **When** ele sai da página, **Then** nada é contado.

---

### User Story 2 - Ver o que os outros acham (Priority: P1)

Depois de votar, o visitante vê o resultado da torcida: para cada um dos 9 times, a porcentagem de votantes que acha que ele cai, em ordem do mais votado para o menos votado, e o total de votos.

**Why this priority**: é o que dá graça ao voto e o que vira print no grupo ("78% acham que o Grêmio cai"). Sem isso o voto não tem retorno para quem votou.

**Independent Test**: com votos já registrados, votar e abrir o resultado e conferir que as porcentagens batem com a contagem (votos no time ÷ total de votantes) e que o total de votos aparece.

**Acceptance Scenarios**:

1. **Given** um visitante que ainda não votou e a votação aberta, **When** ele abre a votação, **Then** vê só o formulário (e o total de votos), sem as porcentagens.
2. **Given** 200 votantes, dos quais 150 escolheram o Grêmio, **When** o resultado é exibido, **Then** o Grêmio aparece com 75% e o total "200 votos" aparece junto.
3. **Given** o resultado exibido, **When** o visitante olha a lista, **Then** os times estão ordenados do mais votado para o menos votado, e os 3 que ele escolheu estão destacados.
4. **Given** o resultado exibido, **When** ele é comparado com o veredito do simulador, **Then** fica claro, pelo título e pelo texto, que é opinião da torcida e não a chance calculada.
5. **Given** ainda não há votos suficientes (menos de 10), **When** o resultado seria exibido, **Then** o site mostra que a votação está começando, sem porcentagens que pareçam conclusivas.

---

### User Story 3 - Opinião da torcida na página do time (Priority: P2)

Na página de cada time (`/<time>`), quem já votou vê uma linha curta com o que a torcida acha daquele time ("62% da torcida acha que o Vasco cai"), abaixo da prova numérica, com acesso à votação.

**Why this priority**: aproveita quem chega pelo link de um time específico, mas não é necessário para a votação funcionar.

**Independent Test**: abrir a página de um time com votos registrados e conferir que a porcentagem daquele time é a mesma do resultado geral e que o link leva à votação.

**Acceptance Scenarios**:

1. **Given** a página de um time, **When** ela carrega, **Then** o SIM/NÃO continua sendo a primeira coisa que se entende, e a linha da torcida aparece abaixo, menor.
2. **Given** um visitante que não votou e a votação aberta, **When** ele abre a página do time, **Then** a linha diz "Vote para ver o que a torcida acha" sem revelar a porcentagem e, ao tocar, abre a gaveta de votação.

---

### Edge Cases

- **Voto repetido**: o mesmo aparelho e navegador não consegue votar duas vezes nem trocar o voto. Se tentar (por exemplo, com duas abas abertas), só o primeiro envio conta.
- **Falha no envio**: sem internet ou com erro no servidor, o site avisa que o voto não foi salvo, mantém os 3 times marcados e deixa tentar de novo. Nunca mostra "voto salvo" sem o voto ter sido gravado.
- **Abuso**: alguém limpando os dados do navegador ou usando aba anônima consegue votar de novo. Isso é aceito (não há login), mas o site deve limitar envios em massa vindos da mesma origem num curto espaço de tempo.
- **Envio adulterado**: votos com menos ou mais de 3 times, com times repetidos, com a Chapecoense ou com times fora da lista dos 9 são recusados pelo servidor, não só pela tela.
- **Muitos votos de uma vez** (rodada decisiva, link viralizando): a votação continua aceitando votos dentro dos limites gratuitos da hospedagem; se o limite diário de gravação estiver perto do fim, o site avisa que a votação está temporariamente fechada em vez de perder votos em silêncio.
- **Outro time rebaixado matematicamente antes do fim**: a votação continua igual (3 escolhas entre os 9), para não invalidar os votos já dados.
- **Fim da votação**: a votação fecha quando começa o primeiro jogo da última rodada (38ª). Depois disso, o formulário some, quem não votou vê o resultado final com o aviso "votação encerrada", e o servidor recusa novos votos.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Todas as páginas do site (home e times) MUST ter um botão flutuante no canto inferior direito que abre, de baixo para cima, uma gaveta de votação com os 9 times da briga (nome e escudo pequeno), e a Chapecoense fora da lista com a explicação de que ela já está rebaixada.
- **FR-001a**: O botão flutuante MUST NOT cobrir a barra fixa do veredito nem o SIM/NÃO: quando a barra fixa aparece embaixo, o botão sobe acima dela. Depois de votar (ou com a votação encerrada), o botão vira "O que a torcida acha" e a gaveta mostra o resultado. A gaveta fecha pelo botão de fechar, pelo fundo e pela tecla Esc, e prende o foco do teclado enquanto está aberta.
- **FR-002**: O visitante MUST escolher exatamente 3 times; não pode confirmar com menos e não pode marcar mais (ao chegar a 3, os demais ficam bloqueados até ele desmarcar um).
- **FR-003**: O voto MUST ser salvo e contado somente depois que o visitante confirma o envio.
- **FR-004**: O site MUST mostrar uma confirmação clara de que o voto foi salvo, com os 3 times escolhidos, ou um erro claro se não foi.
- **FR-005**: O site MUST lembrar, no mesmo aparelho e navegador, que o visitante já votou e em quem, e mostrar o resultado em vez do formulário vazio.
- **FR-006**: Cada aparelho e navegador MUST ter no máximo um voto contado.
- **FR-007**: Depois de confirmado, o voto MUST ser definitivo: não pode ser trocado nem apagado pelo visitante. Antes de confirmar, o site MUST deixar claro que o voto não pode ser mudado depois.
- **FR-008**: O servidor MUST recusar qualquer voto que não tenha exatamente 3 times distintos da lista dos 9.
- **FR-009**: O servidor MUST limitar envios em massa da mesma origem em curto intervalo, sem exigir login.
- **FR-010**: O resultado MUST mostrar, para cada um dos 9 times, a porcentagem de votantes que escolheu o time (votos no time ÷ total de votantes, arredondada para inteiro), ordenado do maior para o menor, com o total de votos.
- **FR-011**: O resultado MUST destacar os 3 times escolhidos pelo visitante.
- **FR-012**: O resultado MUST ser apresentado como opinião da torcida, com título e texto que o diferenciem da % de queda do simulador, e nunca alterar o veredito SIM/NÃO nem a % de queda.
- **FR-013**: Com menos de 10 votos no total, o site MUST mostrar que a votação está começando em vez de porcentagens.
- **FR-014**: Enquanto a votação está aberta, o resultado (porcentagens e ordem) MUST ser visto só por quem já votou; quem não votou vê o formulário e, no máximo, o total de votos. Depois que a votação fecha, o resultado final fica visível para todos.
- **FR-015**: A página de cada time MUST mostrar, abaixo do veredito e da prova numérica, a porcentagem da torcida que acha que aquele time cai (para quem já votou ou depois do encerramento) ou um convite para votar (para quem ainda não votou).
- **FR-016**: O resultado exibido MUST ficar atualizado em no máximo alguns minutos após novos votos, sem precisar que o visitante recarregue para ver o próprio voto contado.
- **FR-017**: Os times MUST ser identificados pelo id da fonte de dados, nunca pela sigla, e a lista de times votáveis MUST vir da lista única de times do site.
- **FR-018**: Todo o texto MUST estar em português do Brasil, a votação MUST funcionar bem no celular e respeitar "reduzir movimento".
- **FR-019**: A votação MUST fechar quando começa o primeiro jogo da última rodada; a partir daí o servidor recusa novos votos e o site mostra o resultado final como encerrado.

### Key Entities

- **Voto**: a escolha de um visitante. Tem os 3 times escolhidos (pelo id), o momento do envio e uma marca anônima do aparelho/navegador usada só para impedir voto duplo. Não guarda nome, e-mail nem qualquer dado pessoal.
- **Resultado da votação**: a contagem agregada. Tem o total de votantes e, para cada um dos 9 times, quantos votos recebeu. É o que os visitantes veem.
- **Time votável**: um dos 9 times da lista única do site. A Chapecoense não é votável.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Um visitante consegue votar (abrir, escolher 3, confirmar) em menos de 30 segundos no celular.
- **SC-002**: 100% dos votos confirmados com sucesso aparecem contados no resultado em até 5 minutos.
- **SC-003**: 0 votos inválidos (quantidade errada, times repetidos ou fora da lista) entram na contagem, inclusive quando enviados direto ao servidor sem passar pela tela.
- **SC-004**: Em todo resultado exibido, a soma das porcentagens dos 9 times fica em 300% ± o erro de arredondamento (cada votante escolhe 3).
- **SC-005**: Na página de cada time, o SIM/NÃO continua sendo a primeira coisa lida; a linha da torcida não ocupa a primeira tela antes do veredito e da % de queda.
- **SC-006**: A votação inteira funciona dentro dos limites gratuitos da hospedagem com até 5.000 votos num único dia.
- **SC-007**: Nenhuma informação pessoal identificável do visitante é guardada.

## Assumptions

- Não há login: o "um voto por pessoa" é na prática "um voto por aparelho e navegador". Quem limpa os dados ou usa aba anônima consegue votar de novo; isso é aceito para um projeto de zoeira de uma temporada.
- A votação é uma só, geral do site (não uma por rodada).
- A votação fica numa gaveta aberta por um botão flutuante, em todas as páginas. O link `/#votacao` abre a gaveta direto (usado para compartilhar).
- O número de escolhas (3) é fixo durante a temporada, mesmo que outro time seja rebaixado matematicamente antes do fim.
- O resultado é mostrado em porcentagem de votantes, não de votos (cada votante dá 3 votos), porque "75% acham que o Grêmio cai" é a frase que a torcida entende.
- Os votos só existem para a temporada 2026 e podem ser apagados quando o projeto terminar.
- Hoje a gravação de dados no plano grátis já é usada pela atualização de minuto em minuto (spec 002); guardar votos não pode competir com ela a ponto de quebrar a atualização dos placares. O planejamento deve escolher onde guardar os votos levando isso em conta.
