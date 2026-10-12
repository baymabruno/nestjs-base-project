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
- Metabase no ambiente de desenvolvimento (`./setup.sh metabase`), com um usuário somente leitura no banco e o painel Dota Metrics criado automaticamente.
