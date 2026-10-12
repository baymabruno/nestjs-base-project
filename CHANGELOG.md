# Changelog

As mudanças de cada versão do Dota Metrics. O formato segue o [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/), e as versões seguem o [Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [Não lançado]

### Adicionado

- Projeto criado a partir do [nestjs-base-project](https://github.com/baymabruno/nestjs-base-project) v1.0.0.
- PostgreSQL 18 no Docker Compose e no CI, com Prisma 7 e migrations versionadas; o `/health` verifica o banco.
- Cliente da API do OpenDota, com fila de requisições, controle da cota diária e validação das respostas.
- Cadastro de heróis, itens e patches, e gravação das partidas profissionais e públicas de alto rank, com os itens finais e a ordem de compra.
- Worker de coleta em um processo separado do PM2: listas de partidas, detalhes com a cota distribuída ao longo do dia, estatísticas e limpeza a cada hora: as partidas públicas contam nas últimas 24 horas (`PUBLIC_WINDOW_HOURS`) e as profissionais, no patch atual inteiro; as demais são apagadas.
- Estatísticas do patch atual e as rotas `GET /api/v1/meta`, `GET /api/v1/heroes` e `GET /api/v1/heroes/:heroId`.
- Testes de integração com bancos de teste próprios, criados e migrados automaticamente.
- Comando `./setup.sh backfill` para carregar as partidas que faltam no período das estatísticas (públicas das últimas 24 horas e profissionais do patch atual), que continua de onde parou e usa no máximo metade da cota diária. A busca de detalhes divide as requisições entre profissionais e públicas.
- O cliente do OpenDota respeita o limite por minuto pelo cabeçalho `x-rate-limit-remaining-minute` e espera um minuto após um 429, sem considerar a cota diária esgotada.
- Referência de todas as variáveis de ambiente (`docs/CONFIGURACAO.md`) e um comentário para cada uma no `.env.example`, que deixa de trazer as variáveis de e-mail, não usadas.
- Site em Next.js 16 (`web/`), com a página de meta: win rate, win rate ajustada pelo intervalo de Wilson, pick rate e win rate por duração, com filtros de fonte, rank e amostra mínima. Roda nos ambientes de desenvolvimento e produção, com a própria verificação no CI.
- Rota `GET /api/v1/meta/heroes` e a tabela `hero_daily_stats`, recalculada pelo worker.
- Página do herói no site (`/heroes/<nome>`), com resumo, itens iniciais e finais, win rate pelo tempo de compra de cada item e matchups; rotas `GET /api/v1/heroes/:heroId/matchups` e `GET /api/v1/heroes/:heroId/item-timings`, e as tabelas `hero_matchup_stats` e `hero_item_timing_stats`. A rota `GET /api/v1/heroes/:heroId` passa a informar `itemMatches`, a base do uso de cada item.
- Heróis por função na página de meta (abas Carry, Mid, Offlane, Support e Hard Support), com nota de 0 a 100 e tier, a partir dos dados de posição da API do STRATZ (`STRATZ_API_TOKEN`) do último dia completo; rota `GET /api/v1/meta/roles` e tabela `hero_position_daily_stats`. Ao escolher uma função, a tabela de heróis passa a ser a da função, e os cartões mostram os 6 de maior nota, do maior para o menor win rate.
- Ordenação por várias colunas na tabela de heróis da página de meta (maior para menor, menor para maior e sem ordenação, desempatando na ordem dos cliques), com testes do site (Vitest) no CI; o `@types/node` do site passa a acompanhar o Node.js 26.
- Habilidades e talentos na página do herói: as sequências mais comuns dos 10 primeiros níveis (partidas com detalhes) e a árvore de talentos com a escolha e a win rate de cada opção (STRATZ); rota `GET /api/v1/heroes/:heroId/abilities`. A sincronização dos dados do jogo passa a incluir as habilidades e as árvores de talentos, sem bloquear a coleta quando falham.
- Funções do herói no topo da página do herói (todas e as posições 1 a 5, com win rate, partidas, nota, tier, parcela das partidas e a função mais jogada); rota `GET /api/v1/heroes/:heroId/roles`. Cada função é clicável e mostra o resumo, os talentos, os itens iniciais e o tempo de compra do herói na função (STRATZ); rota `GET /api/v1/heroes/:heroId/role-items` e as tabelas `hero_role_item_timings` e `hero_role_starting_items`.
- Filtros de fonte, rank e amostra mínima também na página do herói, num componente compartilhado com a página de meta; a amostra mínima começa em "Todas".
- Nota e tier também na tabela de todos os heróis (rota `GET /api/v1/meta/heroes`), que passa a ser a ordem padrão; com uma função escolhida, a tabela mantém as mesmas colunas.
- Metabase no ambiente de desenvolvimento (`./setup.sh metabase`), com um usuário somente leitura no banco e o painel Dota Metrics criado automaticamente.
