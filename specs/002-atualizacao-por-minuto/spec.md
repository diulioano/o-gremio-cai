# Feature Specification: Atualização de minuto em minuto durante os jogos

**Feature Branch**: `002-atualizacao-por-minuto`

**Created**: 2026-10-30

**Status**: Aprovada (2026-10-30)

**Input**: User description: "eu poderia atualizar o site com os dados de 1 em 1 minuto ou mataria o plano free da api?"

## Contexto

Hoje o site busca dados novos na fonte no máximo 1 vez por hora. A página aberta não busca de novo sozinha: o placar só muda se a pessoa recarregar. Num domingo de rodada, um gol do Grêmio pode levar até 1 hora para virar SIM/NÃO na tela.

Os limites gratuitos (conferidos em 2026-10-30):

- **Fonte de dados (plano grátis)**: 10 consultas por minuto, com placares "atrasados" (a página de preços não diz quanto). Buscar 1 vez por minuto usa 10% do limite. **Isso não estoura a fonte**, porque é o servidor que busca e todos os visitantes recebem a mesma cópia. O número de visitantes não muda o número de consultas.
- **Armazenamento do cache (plano grátis da hospedagem)**: 1.000 gravações por dia. Gravar a cada minuto, 24 horas por dia, dá 1.440 gravações. **É isso que estoura**, e não a fonte.
- **Requisições à hospedagem**: 100.000 por dia. Se cada página aberta perguntar a cada minuto, 70 pessoas com o site aberto o dia inteiro já chegam perto disso. Então a página só deve perguntar quando faz sentido.

Conclusão: dá para atualizar de minuto em minuto **enquanto tem jogo rolando**. Fora dos jogos, a atualização de hora em hora continua bastando.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Placar e veredito novos durante o jogo (Priority: P1)

Um torcedor deixa a página do time aberta no celular durante a rodada. Sai um gol, e em poucos minutos a tabela, o SIM/NÃO e a % de queda mudam sozinhos, sem precisar recarregar.

**Why this priority**: é o motivo do pedido. O site é mais visitado justo durante os jogos, e um veredito com 1 hora de atraso perde a graça.

**Independent Test**: com um jogo em andamento, abrir a página e não tocar em nada. Quando a fonte registrar um gol, a página deve mostrar o placar novo dentro do prazo do SC-001.

**Acceptance Scenarios**:

1. **Given** um jogo do Brasileirão em andamento e a página aberta, **When** a fonte registra um gol, **Then** a página mostra o placar novo e recalcula classificação, veredito e % de queda sem a pessoa recarregar.
2. **Given** um jogo em andamento, **When** alguém abre a página pela primeira vez, **Then** recebe dados com no máximo ~1 minuto de diferença em relação à fonte.
3. **Given** a pessoa com palpites (modo simulação), **When** chegam dados novos, **Then** os palpites dela continuam lá e jogos que já terminaram de verdade passam a usar o placar real, como já acontece hoje ao recarregar.

---

### User Story 2 - Ficar dentro do plano grátis (Priority: P1)

O dono do site quer a atualização rápida sem passar a pagar e sem o site cair por estourar algum limite no meio da rodada.

**Why this priority**: se estourar um limite, o site para de atualizar (ou mostra erro) exatamente na hora em que mais gente olha.

**Independent Test**: simular um dia de rodada cheio (vários jogos em horários diferentes) e contar consultas à fonte, gravações no cache e requisições recebidas. Todos devem ficar abaixo dos limites com folga.

**Acceptance Scenarios**:

1. **Given** um dia sem jogos, **When** o dia passa, **Then** o site busca dados no máximo 1 vez por hora, como hoje.
2. **Given** um dia com jogos espalhados da tarde até a noite, **When** o dia passa, **Then** as gravações no cache ficam abaixo de 1.000 e as consultas à fonte ficam abaixo de 10 por minuto em qualquer minuto.
3. **Given** uma busca que trouxe exatamente os mesmos dados da anterior, **When** o servidor a processa, **Then** não gasta uma gravação nova só para guardar a mesma coisa.

---

### User Story 3 - Página parada não gasta à toa (Priority: P2)

Alguém deixa a aba aberta e vai fazer outra coisa, ou abre o site numa terça sem jogo. A página não fica perguntando por dados a cada minuto.

**Why this priority**: protege o limite diário de requisições sem afetar quem está olhando de verdade.

**Independent Test**: abrir a página fora do horário de jogo, ou com a aba em segundo plano, e conferir que ela não busca dados a cada minuto.

**Acceptance Scenarios**:

1. **Given** nenhum jogo em andamento ou prestes a começar, **When** a página fica aberta, **Then** ela não busca dados a cada minuto.
2. **Given** um jogo em andamento e a aba em segundo plano, **When** a pessoa volta para a aba, **Then** a página busca dados na hora e retoma a atualização.

---

### Edge Cases

- **Fonte fora do ar ou devolvendo erro durante o jogo**: a página continua mostrando os últimos dados bons, com o aviso de dados desatualizados que já existe, e tenta de novo no ciclo seguinte.
- **Fonte avisando que estourou o limite**: o servidor para de consultar por um tempo e continua servindo o último dado bom, sem martelar a fonte.
- **Jogo adiado ou atrasado**: o horário marcado já passou, mas o jogo não começou. A janela de jogo continua aberta até um limite razoável depois do horário marcado e depois fecha.
- **Placar atrasado no plano grátis**: a fonte pode atrasar o placar alguns minutos. O site nunca fica mais adiantado que a fonte, e isso é aceito (ver Assumptions).
- **Muitos visitantes ao mesmo tempo no minuto em que o dado venceu**: só uma consulta à fonte (ou poucas) deve sair. Uma consulta por visitante não pode acontecer.
- **Rodada com jogos em vários horários no mesmo dia**: cada janela de jogo conta separado, e o total de gravações do dia ainda fica abaixo de 1.000.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema MUST considerar que há "jogo ao vivo" quando algum jogo do Brasileirão estiver em andamento ou com início marcado a poucos minutos (de 15 minutos antes do horário marcado até a fonte dar o jogo como encerrado, com um teto de ~3 horas depois do início).
- **FR-002**: Com jogo ao vivo, os dados servidos aos visitantes MUST ter no máximo ~1 minuto de diferença em relação à última busca possível na fonte.
- **FR-003**: Sem jogo ao vivo, o sistema MUST manter a atualização de no máximo 1 vez por hora.
- **FR-004**: As consultas à fonte MUST ser feitas pelo servidor e compartilhadas por todos os visitantes. O número de consultas não pode crescer com o número de visitantes.
- **FR-005**: O sistema MUST NOT gravar no cache quando os dados buscados forem iguais aos já guardados, a não ser para marcar quando foi a última busca. Nesse caso, o jeito de marcar MUST NOT gastar o limite diário de gravações.
- **FR-006**: Com jogo ao vivo, a página aberta e visível MUST buscar dados novos sozinha a cada ~1 minuto e atualizar placar, classificação, veredito e % de queda sem recarregar.
- **FR-007**: A página MUST parar de buscar sozinha quando estiver em segundo plano ou quando não houver jogo ao vivo. Ao voltar a ficar visível, MUST buscar uma vez na hora.
- **FR-008**: Atualizações automáticas MUST preservar os palpites e o modo simulação da pessoa.
- **FR-009**: Se a fonte falhar ou recusar por excesso de consultas, o sistema MUST continuar servindo o último dado bom marcado como desatualizado e MUST esperar antes de tentar de novo.
- **FR-010**: A página MAY mostrar discretamente quando os dados foram atualizados ("atualizado há 1 min"). Isso não pode competir com o veredito (Constituição, princípio I).

### Key Entities

- **Retrato dos dados**: a cópia dos jogos e placares guardada no servidor, com o horário da busca. Dela saem a classificação, o veredito e a simulação.
- **Janela de jogo ao vivo**: o período em que vale a atualização de minuto em minuto. Começa pouco antes do primeiro jogo em andamento ou marcado e termina quando todos encerram (ou no teto de tempo).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Durante um jogo, um gol registrado pela fonte aparece na página aberta (placar e veredito) em média em até 2 minutos e no máximo em 3 minutos, sem recarregar. O atraso da própria fonte grátis não entra nessa conta. (Ajustado no plano: research.md D8.)
- **SC-002**: Num dia de rodada cheio, as gravações no cache ficam abaixo de 700 (70% do limite diário de 1.000).
- **SC-003**: Em nenhum minuto o servidor faz mais de 5 consultas à fonte (50% do limite de 10).
- **SC-004**: Fora das janelas de jogo, o número de consultas à fonte e de requisições ao servidor fica igual ao de hoje (até 24 consultas à fonte por dia).
- **SC-005**: Uma aba em segundo plano ou aberta fora de jogo não faz nenhuma busca periódica de minuto em minuto.
- **SC-006**: O site continua 100% dentro do plano grátis, tanto da fonte quanto da hospedagem, sem custo novo.

## Assumptions

- O atraso de placar do plano grátis (alguns minutos, sem número publicado) é aceito. "Minuto em minuto" quer dizer "tão novo quanto a fonte grátis permite", não tempo real de verdade. Pagar um plano com placar ao vivo está fora do escopo.
- Os horários marcados dos jogos, que já vêm da fonte, bastam para saber quando abrir a janela de jogo ao vivo. Não precisa de uma agenda à parte.
- O público continua do tamanho atual (compartilhamento entre torcedores). Se o tráfego passar de dezenas de milhares de visitas por dia, o limite de requisições da hospedagem precisa ser revisto.
- Esta spec altera a restrição da Constituição "cache de 1 hora dos dados" para "1 hora fora de jogo, ~1 minuto durante jogo". A Constituição deve ganhar um aumento de versão PATCH/MINOR junto com esta mudança.
- A atualização automática só busca dados e recalcula. Não recarrega a página nem refaz o visual inteiro.
