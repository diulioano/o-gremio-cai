# Feature Specification: Migração para framework web componentizado

**Feature Branch**: `001-migracao-framework-web`

**Created**: 2026-10-30

**Status**: Draft

**Input**: User description: "a primeira é migrar para algum framework web, deixar componentizado e seguir as boas práticas da linguagem."

## Contexto

Hoje o site "Quem vai cair?" (`vaicair.diuliano.com`) funciona, mas toda a interface vive em um único arquivo de script de ~660 linhas carregado direto do navegador, sem etapa de build, sem tipagem e sem testes. A lista de times está duplicada entre o servidor e a página. Esta feature reorganiza o projeto sem mudar o que o visitante vê, para que as próximas features (como o votador de "quem vai cair") possam ser feitas com segurança.

Esta é uma migração **sem mudança de comportamento**: o visitante não deve notar diferença.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Visitante usa o site exatamente como antes (Priority: P1)

O torcedor abre `vaicair.diuliano.com/gremio` (ou qualquer outro time) pelo link do grupo, vê o SIM/NÃO gigante, a % de queda, a tabela, navega pelas rodadas, faz palpites e volta ao real. Na raiz `/` vê a lista dos 9 times. Tudo funciona igual à versão atual.

**Why this priority**: o site está no ar no meio da reta final do campeonato. Uma migração que quebre algo para o visitante não vale a pena.

**Independent Test**: abrir a versão antiga e a nova lado a lado, com os mesmos dados e os mesmos palpites, e comparar as telas da raiz e de cada um dos 9 times, no celular e no desktop.

**Acceptance Scenarios**:

1. **Given** os mesmos dados do campeonato, **When** o visitante abre `/` na versão nova, **Then** vê os mesmos 9 times, na mesma ordem, com escudo, % de queda e SIM/NÃO iguais aos da versão antiga (a % pode variar dentro da margem normal da simulação).
2. **Given** a página de um time, **When** o visitante marca um palpite V/E/D ou digita um placar, **Then** a tabela, o veredito, a % de queda e o selo "MODO SIMULAÇÃO" atualizam na hora, como hoje.
3. **Given** um visitante que já tinha palpites salvos no navegador pela versão antiga, **When** ele abre a versão nova, **Then** os palpites continuam lá.
4. **Given** um link antigo (`o-gremio-cai.diuliano.com`, etc.), **When** é aberto, **Then** continua redirecionando permanentemente para `vaicair.diuliano.com/<time>`.
5. **Given** que a fonte de dados está fora do ar ou sem credencial, **When** o visitante abre o site, **Then** o comportamento de reserva de hoje (última cópia salva no navegador ou dados de demonstração) continua igual.

---

### User Story 2 - Desenvolvedor altera uma parte sem mexer no resto (Priority: P2)

O dono do projeto quer mudar uma peça da tela (por exemplo, o banner SIM/NÃO ou a linha da tabela) ou adicionar uma nova (o futuro votador no canto da tela). Ele encontra essa peça em um arquivo próprio, com nome claro, entende o que ela recebe e mostra, e altera sem precisar ler o resto do código.

**Why this priority**: é a razão de ser da migração. Sem isso, cada feature nova fica mais arriscada.

**Independent Test**: pedir para alguém que não conhece o código localizar e alterar o texto do selo "MODO SIMULAÇÃO" e adicionar um componente vazio no canto da tela; medir o tempo e quantos arquivos foram tocados.

**Acceptance Scenarios**:

1. **Given** o código migrado, **When** se procura uma peça visual (banner, cartão de time, tabela, lista de jogos, palpite), **Then** ela está em um componente próprio, com um nome que diz o que ela é.
2. **Given** a lista dos times da briga, **When** é preciso adicionar ou remover um time, **Then** a mudança é feita em **um único lugar** e vale para o servidor e para a página.
3. **Given** uma mudança que quebra o contrato de dados entre servidor e página, **When** o projeto é verificado antes de publicar, **Then** a verificação aponta o erro antes de ir para produção.

---

### User Story 3 - A lógica de simulação tem testes automatizados (Priority: P3)

O cálculo da tabela, a aplicação dos palpites e a simulação de chances de queda ficam separados da interface e têm testes que rodam com um comando.

**Why this priority**: os números são o que dá credibilidade ao site (princípio "rigor nos números"). Testes protegem isso nas próximas mudanças, mas o site funciona sem eles.

**Independent Test**: rodar a suíte de testes e ver passarem casos de classificação, desempate, palpites e veredito SIM/NÃO.

**Acceptance Scenarios**:

1. **Given** um conjunto fixo de resultados, **When** a classificação é calculada, **Then** pontos, saldo, gols e ordem batem com o esperado, incluindo critérios de desempate.
2. **Given** um time em 17º após os palpites, **When** o veredito é calculado, **Then** é SIM; em 16º, NÃO.
3. **Given** uma simulação com semente fixa, **When** é rodada duas vezes, **Then** dá o mesmo resultado.

---

### Edge Cases

- Visitante com palpites salvos num formato antigo ou corrompido: o site ignora o que não entender e abre normalmente, sem tela em branco.
- Rotas de time inexistentes (`/flamengo`): mesmo comportamento de hoje.
- Visitante com JavaScript lento ou celular fraco: o primeiro veredito não pode demorar mais do que hoje.
- Visitante com "reduzir movimento" ligado: animações continuam desligadas.
- Compartilhamento do link: o título da prévia do link (por time) continua correto.
- Publicação no meio de uma rodada: a troca de versão não pode deixar o site fora do ar.

## Requirements *(mandatory)*

### Functional Requirements

**Paridade (nada muda para o visitante)**

- **FR-001**: O sistema MUST manter todas as funcionalidades visíveis atuais: lista de times na raiz, página por time, banner SIM/NÃO, % de queda e posição, tabela com escudos, jogos navegáveis por rodada, palpites V/E/D e placar exato, selo "MODO SIMULAÇÃO" e botão de voltar ao real.
- **FR-002**: O sistema MUST manter as mesmas URLs (`/`, `/<time>`, endpoint de dados) e os redirecionamentos permanentes dos subdomínios antigos.
- **FR-003**: O sistema MUST ler os palpites e a cópia de dados já salvos no navegador pela versão anterior, sem que o visitante perca nada.
- **FR-004**: O sistema MUST manter a mesma aparência (cores, fontes, tamanhos, animações e respeito a "reduzir movimento"), com SIM sempre vermelho e NÃO sempre verde.
- **FR-005**: O sistema MUST manter o mesmo comportamento de cache de 1 hora dos dados e o mesmo modo de reserva (cópia local / dados de demonstração).
- **FR-006**: O sistema MUST manter o título da página, o título de prévia de link (`og:title`) e o ícone da aba específicos de cada time. A descrição da prévia continua a mesma para todos, como hoje.

**Organização do código**

- **FR-007**: A interface MUST ser construída com um framework web de componentes, com etapa de build, no lugar do script único atual.
- **FR-008**: Cada peça visual com responsabilidade própria MUST ficar em seu próprio componente (no mínimo: lista de times, cartão de time, banner do veredito, tabela de classificação, lista de jogos por rodada, controle de palpite, selo de simulação).
- **FR-009**: A lógica de domínio (classificação, aplicação de palpites, simulação de chances, veredito) MUST ficar separada dos componentes visuais, sem depender deles.
- **FR-010**: A lista dos times da briga (id da API, nome, artigo "O"/"A", cores, escudo) MUST existir em uma única fonte, usada pelo servidor e pela página.
- **FR-011**: Os dados trocados entre servidor e página MUST ter um formato declarado e verificado na etapa de build.
- **FR-012**: O projeto MUST seguir as convenções e boas práticas da linguagem e do framework escolhidos (tipagem estática, linter e formatador configurados e passando sem erros).
- **FR-013**: O projeto MUST ter testes automatizados da lógica de domínio, rodando com um único comando.
- **FR-014**: O projeto MUST continuar sendo publicado na mesma hospedagem de hoje, com os comandos de desenvolvimento local e de publicação documentados.

### Key Entities

- **Time da briga**: um dos 9 times monitorados. Identificado pelo id da fonte de dados (nunca pela sigla). Tem nome, slug da URL, artigo, cores de destaque (nunca vermelho nem verde) e escudo.
- **Jogo**: partida do campeonato com rodada, mandante, visitante, data e placar (se já jogado).
- **Palpite**: placar escolhido pelo visitante para um jogo futuro, salvo só no navegador dele.
- **Classificação**: tabela calculada a partir dos jogos reais mais os palpites.
- **Veredito**: SIM (time no Z4, 17º–20º, da tabela exibida) ou NÃO, mais a % de queda simulada.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% das telas (raiz + 9 times, em celular e desktop) ficam visualmente iguais à versão anterior na comparação lado a lado.
- **SC-002**: 100% dos palpites salvos antes da migração continuam aparecendo depois dela.
- **SC-003**: O veredito SIM/NÃO aparece na tela em tempo igual ou menor que na versão atual, num celular intermediário em rede 4G.
- **SC-004**: Nenhum arquivo de componente passa de 200 linhas (verificado por teste). A responsabilidade única de cada componente é conferida em revisão.
- **SC-005**: Adicionar ou remover um time da briga exige editar exatamente 1 lugar (mais o escudo).
- **SC-006**: A lógica de domínio tem testes cobrindo classificação, desempate, palpites, veredito e simulação com semente fixa, todos passando.
- **SC-007**: Zero indisponibilidade do site durante a troca de versão.

## Assumptions

- A escolha do framework, da linguagem tipada e das ferramentas fica para o plano técnico (`/speckit-plan`). Preferência por algo leve, que rode bem na hospedagem atual e tenha boa experiência em celular.
- A migração não traz features novas. O votador de "quem vai cair" (até 3 times, já que a Chapecoense já caiu) será especificado separadamente, como próxima feature, em cima desta base.
- A comparação visual aceita diferenças de 1–2 px vindas de troca de ferramenta, desde que não mudem hierarquia, cor ou texto.
- As chaves de armazenamento no navegador podem ser mantidas ou migradas, desde que sem perda para o visitante.
- O projeto vive só durante a temporada 2026; não há exigência de suporte de longo prazo além disso.
- O projeto ainda não está sob controle de versão; o plano deve incluir iniciar um repositório antes da migração para permitir comparar e voltar atrás.
