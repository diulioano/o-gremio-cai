# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Três públicos, todos brasileiros e quase sempre no celular, que chegam por um link compartilhado ou durante e depois de uma rodada:

- **Torcedor aflito:** torce para um dos times da briga contra a queda. Abre o site depois da rodada para ver se o time ainda escapa e testa palpites para os jogos que faltam.
- **Rival secador:** torcedor rival que abre para zoar (por exemplo, o colorado vendo se o Grêmio cai) e manda o link ou o print no grupo.
- **Curioso de futebol:** quer o panorama da briga contra a queda sem ter time do coração nela.

## Product Purpose

Responder com um SIM ou um NÃO gigante à pergunta "O [time] cai?" na reta final do Brasileirão Série A 2026. Deixa o visitante simular os jogos que faltam e ver na hora a tabela e a chance de queda mudarem. Funciona quando o visitante entende a situação do time em um segundo e quer mexer nos palpites ou compartilhar o link.

## Positioning

A resposta vem em um veredito binário e provocador (SIM/NÃO) baseado na tabela exibida, com a probabilidade de Monte Carlo como prova logo abaixo. Os palpites do visitante alteram o veredito na hora. O site junta a resenha de torcida com números sérios.

## Operating Context

- Uso durante e logo depois das rodadas, em geral no celular, muitas vezes chegando por um link compartilhado em grupo.
- `/` lista os times da briga com escudo, % de queda e SIM/NÃO. `/<time>` mostra a página de cada time.
- Times (9): Grêmio, Inter, Corinthians, Vasco, Botafogo, Coritiba, Vitória, Mirassol e Remo. A Chapecoense ficou de fora por já estar praticamente rebaixada.
- Os subdomínios antigos (`o-gremio-cai.`, `o-inter-cai.`, `o-corinthians-cai.`, `o-vasco-cai.diuliano.com`) redirecionam com 301 para `vaicair.diuliano.com/<time>`.

## Capabilities and Constraints

- Cloudflare Worker (`src/worker/`) serve a página e faz proxy da football-data.org (competição `BSA`). O token fica como secret e o cache em KV dura 1 hora. Sem o token, o site usa dados de demonstração (`src/worker/demo.ts`).
- Front-end em Preact + TypeScript, componentizado (`src/client/`), com build pelo Vite. A lógica de tabela, simulação e veredito fica em `src/domain/`, separada da interface e testada.
- Banner: SIM se o time está no Z4 (17º–20º) da tabela exibida (real ou simulada), NÃO se está fora. Abaixo, menor: % de queda e posição.
- Simulador: Monte Carlo (5000 rodadas) com força de ataque e defesa tirada dos gols do campeonato, mais mando de campo e placares por Poisson. Calcula a % de queda de todos os times.
- Palpites: botões V/E/D que preenchem um placar padrão (1x0, 1x1, 0x1) e campos de placar exato editáveis, salvos em localStorage e compartilhados entre as páginas dos times. Quando há palpites, aparece o selo "MODO SIMULAÇÃO" e um botão para voltar ao real.
- Jogos navegáveis por rodada (os passados com placar, os futuros com palpite). Não há histórico da classificação por rodada.
- Os times são identificados pelo id da API, nunca pela sigla (Coritiba e Corinthians são ambos COR; o Grêmio é FBP). A lista de times é única, em `src/shared/teams.ts`, usada pelo Worker e pela página.
- Vida útil: só a temporada 2026. Projeto pontual que termina com o campeonato, sem planos de virar produto recorrente.

## Brand Commitments

- Nome e domínio: "Quem vai cair?" em `vaicair.diuliano.com`. Pergunta por time no formato "O [time] cai?", com o artigo de cada time no campo `art`.
- Voz: drama e zoeira. A pergunta gigante é provocação de resenha e os números são sérios e confiáveis. A zoeira fica no enquadramento e nunca distorce os dados.
- **SIM é sempre vermelho e NÃO é sempre verde, em todos os times.** A cor de destaque de cada time nunca pode ser vermelha nem verde.
- Idioma: português do Brasil.

## Evidence on Hand

- Escudos SVG dos 9 times em `public/*.svg`.
- Dados reais da football-data.org em produção.
- Não há depoimentos, números de uso nem imprensa. Não inventar nada disso.

## Product Principles

1. **Veredito primeiro.** O SIM ou NÃO tem que se entender antes de qualquer outra coisa. Todo o resto é prova ou ferramenta.
2. **Zoeira no enquadramento, rigor nos números.** A provocação nunca pode comprometer a credibilidade da probabilidade nem da tabela.
3. **Simular tem que ser imediato.** Cada palpite atualiza a tabela, o veredito e as chances na hora, sem atrito.
4. **Feito para compartilhar.** Cada página de time precisa fazer sentido sozinha, para quem chega por um link no grupo sem contexto nenhum.
5. **Justo com todos os times.** As regras de cor e a lógica valem igual para os 9. Nenhum time fica com tratamento especial que quebre o código SIM/NÃO.
