# Changelog

As mudanças de cada versão do Dota Metrics. O formato segue o [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/), e as versões seguem o [Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [Não lançado]

### Adicionado

- Projeto criado a partir do [nestjs-base-project](https://github.com/baymabruno/nestjs-base-project) v1.0.0.
- PostgreSQL 18 no Docker Compose e no CI, com Prisma 7 e migrations versionadas; o `/health` verifica o banco.
- Cliente da API do OpenDota, com fila de requisições, controle da cota diária e validação das respostas.
- Cadastro de heróis, itens e patches, e gravação das partidas profissionais e públicas de alto rank, com os itens finais e a ordem de compra.
- Worker de coleta em um processo separado do PM2: listas de partidas, detalhes com a cota distribuída ao longo do dia, estatísticas e retenção de 30 dias.
- Estatísticas do patch atual e as rotas `GET /api/v1/meta`, `GET /api/v1/heroes` e `GET /api/v1/heroes/:heroId`.
- Testes de integração com bancos de teste próprios, criados e migrados automaticamente.
- Comando `./setup.sh backfill [dias]` para carregar as partidas passadas (padrão de 1 dia), que continua de onde parou e usa no máximo metade da cota diária.
- O cliente do OpenDota respeita o limite por minuto pelo cabeçalho `x-rate-limit-remaining-minute` e espera um minuto após um 429, sem considerar a cota diária esgotada.
- Referência de todas as variáveis de ambiente (`docs/CONFIGURACAO.md`) e um comentário para cada uma no `.env.example`, que deixa de trazer as variáveis de e-mail, não usadas.
- Site em Next.js 16 (`web/`), com a página de meta: win rate, win rate ajustada pelo intervalo de Wilson, pick rate, win rate por duração e tendência diária, com filtros de fonte, rank, período e amostra mínima. Roda nos ambientes de desenvolvimento e produção, com a própria verificação no CI.
- Rota `GET /api/v1/meta/heroes` e a tabela `hero_daily_stats`, recalculada pelo worker.
- Página do herói no site (`/heroes/<nome>`), com resumo, itens iniciais e finais, win rate pelo tempo de compra de cada item e matchups; rotas `GET /api/v1/heroes/:heroId/matchups` e `GET /api/v1/heroes/:heroId/item-timings`, e as tabelas `hero_matchup_stats` e `hero_item_timing_stats`. A rota `GET /api/v1/heroes/:heroId` passa a informar `itemMatches`, a base do uso de cada item.
- Metabase no ambiente de desenvolvimento (`./setup.sh metabase`), com um usuário somente leitura no banco e o painel Dota Metrics criado automaticamente.
