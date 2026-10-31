# Quem vai cair? — Constituição

Constituição inicial, montada a partir das decisões já tomadas (PRODUCT.md) e das specs. Cresce conforme novas specs trouxerem princípios.

## Core Principles

### I. Veredito primeiro, SIM vermelho / NÃO verde
O SIM ou NÃO tem que ser entendido antes de qualquer outra coisa. SIM é sempre vermelho e NÃO é sempre verde, em todos os times. A cor de destaque de um time nunca pode ser vermelha nem verde.

### II. Rigor nos números
A zoeira fica no enquadramento e nunca distorce os dados. A lógica de domínio (classificação, palpites, simulação, veredito) fica separada da interface e tem testes automatizados. Times são identificados pelo id da fonte de dados, nunca pela sigla.

### III. Componentizado e com fonte única
Cada peça visual com responsabilidade própria é um componente próprio. Dados compartilhados (como a lista de times) existem em um único lugar. O formato dos dados entre servidor e página é declarado e verificado no build.

### IV. Boas práticas da linguagem
Código tipado, com linter e formatador configurados e passando. Segue as convenções do framework escolhido em vez de inventar padrões próprios.

### V. Justo, leve e para celular
As mesmas regras valem para todos os times. O site é usado principalmente no celular, chegando por link compartilhado: cada página faz sentido sozinha e o veredito aparece rápido. Respeitar "reduzir movimento". Idioma: português do Brasil.

## Restrições

- Hospedagem: Cloudflare Workers, no plano grátis. Os dados da football-data.org (competição `BSA`) são conferidos a cada ~1 minuto durante jogos e a cada 1 hora fora deles (spec 002), sempre dentro dos limites gratuitos da fonte e da hospedagem.
- Vida útil: temporada 2026. Preferir simplicidade a infraestrutura para o longo prazo.
- Não inventar números de uso, depoimentos nem imprensa.

## Governance

Esta constituição prevalece sobre preferências pontuais. Mudanças são feitas junto com as specs que as motivam, com aumento de versão (MAJOR: remove/redefine princípio; MINOR: adiciona princípio; PATCH: redação).

**Version**: 0.1.1 | **Ratified**: 2026-10-30 | **Last Amended**: 2026-10-30
