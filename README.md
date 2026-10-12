<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="200" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">Um framework <a href="http://nodejs.org" target="_blank">Node.js</a> progressivo para construir aplicações server-side eficientes e escaláveis.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://coveralls.io/github/nestjs/nest?branch=master" target="_blank"><img src="https://coveralls.io/repos/github/nestjs/nest/badge.svg?branch=master#9" alt="Coverage" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Descrição

Dota Metrics: estatísticas do meta de Dota 2. O sistema coleta partidas profissionais e públicas de alto rank pela [API do OpenDota](https://docs.opendota.com), guarda os últimos 30 dias em PostgreSQL e calcula, para o patch atual, a taxa de vitória e de escolha de cada herói e os itens mais usados, com o tempo médio de compra.

Construído sobre o [nestjs-base-project](https://github.com/baymabruno/nestjs-base-project): TypeScript com o framework [Nest](https://github.com/nestjs/nest) 12 (ESM), autenticação JWT com RS256 e JWKS, rastreamento de requisições, API versionada, validação com Zod e Docker com PM2. Todo o sistema roda em Docker.

Este documento explica o sistema. A instalação e a operação de cada ambiente estão nos guias abaixo.

## Documentação dos ambientes

- [Desenvolvimento](docs/DESENVOLVIMENTO.md)
- [Produção](docs/PRODUCAO.md)
- [Configuração](docs/CONFIGURACAO.md): todas as variáveis de ambiente

## Criando um novo projeto a partir desta base

1. Crie o repositório do novo projeto com o conteúdo desta base (no GitHub, marque este repositório como *template* e use **Use this template**, ou copie os arquivos para o novo repositório).
2. Renomeie o projeto. O comando troca o nome em todos os arquivos: `package.json`, containers e imagens Docker, emissor e público do JWT, serviço de observabilidade, Dev Container e documentação:

```bash
./setup.sh rename nome-do-projeto
```

3. Revise o que é específico desta base:
   - `package.json`: `description`, `author`, `version` e a URL do repositório;
   - `views/index.hbs`: a página inicial (título, versão e links);
   - `CHANGELOG.md`: o histórico desta base; recomece-o com a primeira versão do novo projeto (e ajuste o `version` do `package.json`);
   - `src/users/users.service.ts`: os usuários de demonstração, a serem trocados por uma persistência (veja [Persistência de usuários](#persistência-de-usuários)).
4. Siga o [guia do ambiente](#documentação-dos-ambientes) para subir o projeto. A instalação gera um `.env` com chaves próprias para o novo projeto.

O nome precisa ter apenas letras minúsculas, números e hífens (por exemplo, `pedidos-service`). Pare o ambiente antes de renomear, porque os nomes dos containers mudam.

## Visão geral

### Tecnologias

| Área | Tecnologia |
|---|---|
| Framework | NestJS 12 com Express 5, em ESM |
| Banco de dados | PostgreSQL 18 com Prisma 7 (driver `pg`, migrations versionadas) |
| Fonte dos dados | API do OpenDota (partidas, heróis, itens e patches) |
| Coleta | Processo worker separado, com `@nestjs/schedule` |
| Site | Next.js 16 (React 19) em `web/`, com renderização no servidor |
| Painéis | Metabase em desenvolvimento (`./setup.sh metabase`) |
| Linguagem | TypeScript 6 (modo strict) |
| Execução | Node.js 26, com PM2 dentro do Docker |
| Autenticação | Passport + JWT RS256, com refresh token e JWKS |
| Validação | Zod (Standard Schema), também usado para gerar o Swagger |
| Documentação da API | Swagger (OpenAPI) |
| Testes | Vitest e Supertest |
| Segurança | helmet, rate limit (`@nestjs/throttler`), CORS configurável |
| Observabilidade | Logs estruturados com ID de requisição e `@nestjs/observe` (opcional) |
| CI | GitHub Actions, Trivy e Dependabot |

### Estrutura do projeto

```
src/
├── main.ts                     inicialização da API (logger, observabilidade)
├── worker.ts                   inicialização do worker de coleta (sem servidor HTTP)
├── worker.module.ts            módulos do worker: configuração, agendamento, banco e coleta
├── app.setup.ts                configuração da aplicação: ID de requisição, log de acesso, helmet, CORS, prefixo /api, versionamento, validação, página inicial e Swagger
├── app.module.ts               módulo principal: configuração, rate limit, filtro de erros e módulos
├── app.controller.ts           página inicial (views/index.hbs)
├── observe.ts                  integração opcional com o @nestjs/observe
├── config/                     validação das variáveis de ambiente (Zod)
├── authorization/              login, refresh token, JWKS, guards, decorators e schemas
├── users/                      usuários, roles e o UsersService (onde entra a persistência)
├── health/                     health check (/health), inclusive do banco
├── prisma/                     PrismaService: conexão com o PostgreSQL
├── opendota/                   cliente da API do OpenDota: fila de requisições, cota diária e schemas das respostas
├── game-data/                  heróis, itens e patches (constantes do OpenDota)
├── matches/                    gravação das partidas, dos jogadores e dos itens
├── ingestion/                  coleta agendada: listas de partidas, detalhes, estatísticas e retenção
├── stats/                      estatísticas do patch atual: recálculo e rotas /meta e /heroes
├── generated/                  cliente do Prisma (gerado, fora do git)
├── common/                     contexto da requisição, logger e propagação do X-Request-Id
├── middleware/                 ID de requisição e log de cada requisição
└── filters/                    formato padrão das respostas de erro
web/                            site em Next.js (páginas de estatísticas), projeto separado com o próprio package.json
prisma/                         schema do banco e migrations
test/                           testes e2e (http, swagger, auth e stats), banco de testes e utilitários (support/)
views/                          página inicial (Handlebars)
docker/                         Dockerfiles e scripts do PM2
docs/                           guias de instalação e operação dos ambientes
```

### Caminho de uma requisição

1. O middleware de ID de requisição define o `X-Request-Id` e abre o contexto da requisição.
2. O rate limit verifica o limite do IP (e, no login, também o do usuário).
3. Nas rotas protegidas, o Passport valida o access token e o guard de roles verifica as permissões.
4. O schema Zod da rota valida o corpo, a query e os parâmetros.
5. O controller e os services executam; todos os logs saem com o ID da requisição.
6. Em caso de erro, o filtro global responde no formato padrão.
7. Ao final, o log da requisição registra método, rota, status e duração.

## Coleta e estatísticas

A coleta roda no processo **worker** (`src/worker.ts`), separado da API. A API pode rodar em várias instâncias (cluster do PM2), mas a coleta precisa rodar em um único processo, para não repetir requisições nem gastar a cota duas vezes.

| Tarefa | Quando | O que faz |
|---|---|---|
| Partidas profissionais | ao iniciar e a cada `PRO_MATCHES_INTERVAL_MINUTES` | `GET /proMatches`: grava as partidas novas de ligas |
| Partidas públicas | ao iniciar e a cada `PUBLIC_MATCHES_INTERVAL_MINUTES` | `GET /publicMatches`: grava as partidas ranqueadas All Pick com rank médio a partir de `PUBLIC_MIN_RANK_TIER`, já com os heróis de cada time |
| Detalhes | a cada minuto | `GET /matches/{id}`: itens finais e ordem de compra de cada jogador; profissionais primeiro, depois as mais recentes |
| Estatísticas | ao iniciar e a cada `STATS_INTERVAL_MINUTES` | recalcula as tabelas do patch atual |
| Dados do jogo | diariamente às 5h | heróis, itens e patches |
| Retenção | diariamente às 4h | apaga as partidas com mais de `MATCH_RETENTION_DAYS` dias |

**Cota do OpenDota.** Sem chave de API, o limite é de 60 requisições por minuto e 3.000 por dia, contados por IP. O cliente faz uma requisição por vez, com intervalo de `OPENDOTA_REQUEST_INTERVAL_MS`, e acompanha os cabeçalhos `x-rate-limit-remaining-minute` e `x-rate-limit-remaining-day`. Quando restam 10 requisições ou menos no minuto, ou quando a API recusa uma requisição (429), ele espera um minuto. Assim o worker e o backfill, que dividem o mesmo limite, freiam juntos. A cada minuto, os detalhes usam a cota restante dividida pelos minutos até a meia-noite (UTC), guardando `OPENDOTA_DAILY_RESERVE` requisições para as listas. A cota fica distribuída ao longo do dia, em vez de acabar nas primeiras horas.

**Partidas processadas.** A ordem de compra (`purchase_log`) só existe nas partidas que o OpenDota processou a partir do replay. As profissionais costumam ser processadas alguns minutos depois do fim; enquanto isso, a partida é consultada de novo (até 5 vezes, com espera crescente). As públicas raramente são processadas e ficam só com os itens finais.

**Carga de partidas passadas (backfill).** O worker só coleta as partidas novas. Para carregar as dos últimos dias, execute com a aplicação no ar:

```bash
./setup.sh backfill        # último dia
./setup.sh backfill 5      # últimos 5 dias (até MATCH_RETENTION_DAYS)
```

O comando volta no tempo página por página (`less_than_match_id`). As partidas profissionais vão da mais recente até o início do período, o que custa poucas requisições, porque cada página cobre alguns dias. As públicas partem da mais antiga já gravada, então uma nova execução continua de onde a anterior parou. Elas são numerosas: cada página de 100 cobre cerca de 2 minutos de jogo, e um dia passa de 800 páginas. Por isso, cada execução usa no máximo metade das requisições que restam no dia, deixando o resto para o worker buscar os detalhes, e avisa quando o período ficou incompleto. Os detalhes (itens) das partidas novas são buscados pelo worker, dentro da cota diária.

**Facetas.** No patch 7.41, todas as facetas estão descontinuadas no OpenDota e as partidas não informam a faceta escolhida, então elas não são coletadas.

**Desempenho.** Os itens ficam em arrays (`smallint[]`) na linha de cada jogador, e o patch e a data da partida são copiados para essa linha, então as estatísticas leem uma única tabela, sem join. O worker agrega as estatísticas no próprio PostgreSQL e grava o resultado em tabelas pequenas (`hero_stats` e `hero_item_stats`), e a API só lê essas tabelas. Cada recálculo apaga as estatísticas anteriores, então só o meta do patch atual fica disponível.

## Site

O site (`web/`) mostra as estatísticas em páginas. É um projeto Next.js separado, que roda no container `dota-metrics-web` (http://localhost:3002, porta `WEB_PORT`) e lê a API pela rede do Docker Compose. Os endereços de cada serviço no navegador estão em [Endereços](docs/DESENVOLVIMENTO.md#endereços), no guia de desenvolvimento. As respostas da API ficam em cache por 15 minutos, o mesmo intervalo do recálculo das estatísticas.

**Página de meta (`/meta`)**, inspirada na página de meta do [Dota2ProTracker](https://dota2protracker.com/meta) e nas tendências do [STRATZ](https://stratz.com/heroes/meta/trends):

| Coluna | Cálculo |
|---|---|
| Partidas, win rate e pick rate | No período e nos filtros escolhidos |
| WR ajustada (ordem padrão) | Limite inferior do intervalo de Wilson (95%) da win rate: a win rate que a amostra garante. Com poucas partidas fica bem abaixo da win rate, então amostras pequenas não chegam ao topo por acaso |
| Win rate por duração | Partidas de até 35 minutos, de 35 a 50 e de 50 ou mais |
| Tendência | Win rate por dia e a diferença entre a segunda e a primeira metade do período |

Os filtros (fonte, rank, período e amostra mínima) ficam na URL, então uma visão pode ser compartilhada por link. A API calcula tudo a partir da tabela `hero_daily_stats` (herói × dia × fonte × rank × duração), recalculada pelo worker.

**Página do herói (`/heroes/<nome>`, por exemplo `/heroes/pudge`)**, aberta pelo nome do herói na página de meta, nos moldes das páginas de herói do Dota2ProTracker e dos matchups do STRATZ. Usa os últimos 30 dias do patch, com o filtro de fonte:

| Seção | Cálculo |
|---|---|
| Resumo, duração e tendência | Os mesmos números da página de meta, com a posição do herói no meta |
| Itens iniciais | Itens comprados antes do início da partida na maioria das vezes |
| Itens finais | Itens a partir de 1.000 de ouro no inventário final: uso (parcela das partidas com os itens conhecidos), win rate e minuto médio da compra |
| Tempo de compra × win rate | Win rate pelo minuto da primeira compra de cada item, em faixas de 5 minutos (tabela `hero_item_timing_stats`). Só usa as partidas com a ordem de compra, então a amostra é menor |
| Bom contra, fraco contra e melhores aliados | Win rate do herói contra cada inimigo e com cada aliado, com no mínimo 30 partidas (tabela `hero_matchup_stats`, de todas as partidas). "Bom contra" e os aliados são ordenados pelo limite inferior de Wilson; "fraco contra", pelo limite superior, ou seja, a win rate é baixa mesmo no melhor caso da amostra |

## Endpoints

As rotas da API ficam sob o prefixo `/api/v1`. A página inicial, o health check, o JWKS e o Swagger ficam fora do prefixo e do versionamento.

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/` | Página inicial, com a versão da aplicação e os links da documentação |
| `POST` | `/api/v1/auth/login` | Login; retorna o access token e o refresh token |
| `POST` | `/api/v1/auth/refresh` | Troca um refresh token por um novo par de tokens |
| `GET` | `/api/v1/auth/profile` | Dados do usuário logado (requer a role `admin`) |
| `GET` | `/api/v1/meta` | Patch das estatísticas, quando foram calculadas e quantas partidas incluem |
| `GET` | `/api/v1/meta/heroes` | Página de meta: heróis num período (`days`, de 1 a 30), com win rate ajustada, pick rate, win rate por duração e tendência diária. Filtros: `source`, `bracket` (`divine` ou `immortal`) e `minMatches` |
| `GET` | `/api/v1/heroes` | Taxa de vitória e de escolha de cada herói. Filtros: `source` (`pro` ou `public`) e `minMatches` |
| `GET` | `/api/v1/heroes/:heroId/matchups` | Página do herói: win rate contra cada inimigo e com cada aliado, com o intervalo de Wilson e a diferença para a win rate geral. Filtros: `source` e `minMatches` |
| `GET` | `/api/v1/heroes/:heroId/item-timings` | Página do herói: itens comprados, com a win rate pelo minuto da primeira compra (faixas de 5 minutos), nas partidas com a ordem de compra. Filtros: `source`, `minMatches` e `minItemCost` |
| `GET` | `/api/v1/heroes/:heroId` | Estatísticas do herói e os itens do inventário final, com a taxa de vitória e o tempo médio de compra. Filtros: `source`, `minMatches` e `minItemCost` |
| `GET` | `/.well-known/jwks.json` | Chave pública para validar os tokens (JWKS) |
| `GET` | `/health` | Health check |
| `GET` | `/doc` | Documentação Swagger (quando `SWAGGER="true"`) |
| `GET` | `/doc-json` | Especificação OpenAPI em JSON (quando `SWAGGER="true"`) |

### Versionamento

O versionamento é pela URL, com a versão `1` como padrão. Para criar uma versão nova de uma rota sem quebrar quem usa a atual, declare a versão no controller ou na rota. A versão 2 fica disponível em `/api/v2/...`, e a versão 1 continua funcionando:

```ts
@Controller({ path: 'auth', version: '2' })
```

## Autenticação e autorização (JWT)

### Como funciona

Este serviço autentica os usuários e emite dois tokens JWT assinados com **RS256**:

| Token | Para que serve | Validade |
|---|---|---|
| **Access token** | Acessar as rotas protegidas, enviado no header `Authorization: Bearer <token>` | Curta: `JWT_EXPIRES_IN` (padrão 15 minutos) |
| **Refresh token** | Obter um novo par de tokens quando o access token expira, sem pedir a senha de novo | Longa: `JWT_REFRESH_EXPIRES_IN` (padrão 7 dias) |

Os tokens são assinados com a chave privada (`JWT_PRIVATE_KEY`), que só este serviço tem, e validados com a chave pública, publicada em `/.well-known/jwks.json`. Assim, qualquer serviço consegue validar os tokens sem precisar de um segredo compartilhado. Um token de um tipo não é aceito no lugar do outro.

### Utilização

1. O cliente faz login em `POST /api/v1/auth/login`, com usuário e senha, e recebe o access token e o refresh token.
2. Em cada requisição a uma rota protegida, envia o access token no header `Authorization`.
3. Quando a API responde `401` porque o access token expirou, o cliente envia o refresh token para `POST /api/v1/auth/refresh`, recebe um novo par de tokens e repete a requisição.
4. Se o refresh também for recusado, a sessão expirou e o usuário precisa fazer login de novo.

A API responde `401` quando o token falta, é inválido ou expirou; `403` quando o usuário não tem a role exigida pela rota; e `429` quando um limite de login é atingido.

O login tem dois limites:

- **Por IP:** 5 tentativas por minuto.
- **Por usuário:** depois de 10 senhas erradas, vindas de qualquer IP, o usuário fica bloqueado por até 15 minutos (contados a partir da primeira falha). Só as falhas contam, e um login correto zera a contagem. Assim, quem faz login com frequência não é bloqueado, e ninguém consegue bloquear a conta de outra pessoa apenas tentando adivinhar a senha dela.

No navegador, evite guardar o refresh token no `localStorage`, porque qualquer script injetado na página (XSS) consegue lê-lo.

### Protegendo rotas

As rotas e os controllers são protegidos com o decorator `@Authorize()`, que exige um access token válido. Sem roles, ele libera qualquer usuário autenticado; com roles, restringe o acesso a elas. Administradores têm acesso a todas as rotas protegidas. Na rota, o usuário logado fica disponível em `req.user`.

As roles ficam em `src/users/enums/role.enum.ts`.

### Validação em outros serviços

Outros serviços (microsserviços, gateways) validam o access token sozinhos, sem chamar este serviço a cada requisição. Para isso, usam a chave pública do JWKS (`/.well-known/jwks.json`) e conferem a assinatura RS256, o emissor (`JWT_ISSUER`), o público (`JWT_AUDIENCE`), a expiração e o tipo do token. A maioria das bibliotecas de JWT com suporte a JWKS faz essa validação a partir da URL.

As roles não vão dentro do token: este serviço as consulta a cada requisição, para que uma mudança de permissão valha na hora. Outros serviços que precisem das roles podem consultar `GET /api/v1/auth/profile` com o mesmo token.

### Limitações

- O refresh token não fica armazenado no servidor. Por isso funciona com várias instâncias, mas não pode ser revogado antes de expirar: não há logout no servidor. Para permitir logout ou revogação, é preciso guardar os tokens em um armazenamento compartilhado (Redis ou banco de dados).
- Os limites de login ficam em memória, por processo. Com várias instâncias, cada uma conta separadamente.

### Persistência de usuários

Os usuários ficam em memória, em `src/users/users.service.ts`: são os usuários de demonstração `bayma` (role `admin`) e `maria` (role `gest`), desativados quando `APP_ENVIRONMENT` é `production`. Para conectar um banco de dados ou outro serviço (por exemplo, um microsserviço de usuários), basta alterar o `UsersService`:

1. Implemente o método `findOne(username)` buscando o usuário na sua fonte de dados. Ele deve retornar um `User` (`src/users/interfaces/user.interface.ts`), com a senha já em hash bcrypt, ou `undefined` quando o usuário não existir.
2. Remova a lista `DEMO_USERS`.

O restante da autenticação (login, JWT, roles) usa apenas o `UsersService` e não precisa mudar.

## Validação

O corpo, a query e os parâmetros das requisições são validados com schemas [Zod](https://zod.dev), a mesma biblioteca que valida o `.env`. O mesmo schema também gera a documentação do Swagger. Exemplo:

```ts
const createUserSchema = z
  .strictObject({
    name: z.string().min(1),
    email: z.email(),
  })
  .meta({ id: 'CreateUser' }); // nome do schema no Swagger

@Post()
create(@Body({ schema: createUserSchema }) body: z.infer<typeof createUserSchema>) {}
```

Para documentar a resposta no Swagger, use `@ApiOkResponse({ standardSchema: schema })`. Os schemas de autenticação estão em `src/authorization/schemas/auth.schemas.ts`.

Com `z.strictObject`, campos que não estão no schema são rejeitados. Uma requisição inválida retorna 400 com a lista de erros em `message`.

## Respostas de erro

Todos os erros da API seguem o mesmo formato:

```json
{
  "statusCode": 404,
  "error": "Not Found",
  "message": "Cannot GET /api/v1/nada",
  "path": "/api/v1/nada",
  "timestamp": "2026-10-11T19:53:46.875Z",
  "requestId": "9e4734da-b071-4f29-93bd-af5dd27caf51"
}
```

Erros inesperados (500) retornam apenas `Internal server error`, e os detalhes, com o stack trace, ficam no log. URLs fora da API (que não começam com `/api`) e inexistentes retornam a página 404 padrão do Express.

## Rastreamento de requisições

Cada requisição recebe um ID, devolvido no cabeçalho `X-Request-Id`. Se o cliente ou o proxy já enviar um `X-Request-Id` válido, ele é reaproveitado. O ID aparece:

- em todos os logs escritos durante a requisição, inclusive os dos services, sem precisar passá-lo como parâmetro;
- nas respostas de erro;
- nas requisições feitas para outros serviços com o `HttpService` (`@nestjs/axios`), no cabeçalho `X-Request-Id`.

Assim, uma requisição pode ser rastreada de ponta a ponta entre os serviços. Para ler o ID no código, use `RequestContext.getRequestId()` (`src/common/request-context.ts`).

## Observabilidade

O projeto vem integrado ao [`@nestjs/observe`](https://observe.nestjs.com), que envia traces, erros, logs e métricas para o serviço observe.nestjs.com (gratuito até 300 mil eventos por mês). A integração fica **desligada** enquanto `OBSERVE_APP_KEY` e `OBSERVE_APP_SECRET` estiverem vazios, e nesse caso nenhum dado sai da aplicação.

Quando ativada:

- os dados das requisições (rotas, status, durações e logs) passam a ser enviados para um serviço externo;
- o envio de trechos do código-fonte junto com os erros (`sourceContext`) está desligado em `src/observe.ts`;
- erros esperados (400, 401, 403, 404 e 429) são enviados sem o detalhamento interno, o que reduz o número de eventos;

## Configuração

As variáveis ficam no `.env`, a partir do modelo `.env.example`, que traz um comentário para cada uma. Elas são validadas na inicialização (`src/config/env.validation.ts`), e a aplicação não sobe se alguma estiver faltando ou for inválida.

A referência completa, com o padrão, a descrição de cada variável e como aplicar uma alteração em cada ambiente, está em [docs/CONFIGURACAO.md](docs/CONFIGURACAO.md). Os grupos são:

| Grupo | Variáveis |
|---|---|
| Aplicação | `APP_ENVIRONMENT`, `PORT`, `SWAGGER`, `LOG_LEVEL`, `CORS_ORIGINS`, `TRUST_PROXY`, `THROTTLE_TTL`, `THROTTLE_LIMIT` |
| Processos e containers | `DEBUG_PORT`, `PM2_INSTANCES`, `CPU_LIMIT`, `MEMORY_LIMIT` |
| Autenticação | `JWT_PRIVATE_KEY`, `JWT_PUBLIC_KEY`, `JWT_ISSUER`, `JWT_AUDIENCE`, `JWT_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN` |
| Observabilidade | `OBSERVE_APP_KEY`, `OBSERVE_APP_SECRET`, `OBSERVE_SERVICE_ID` |
| API do OpenDota | `OPENDOTA_API_URL`, `OPENDOTA_API_KEY`, `OPENDOTA_REQUEST_INTERVAL_MS`, `OPENDOTA_DAILY_RESERVE` |
| Coleta de partidas | `MATCH_RETENTION_DAYS`, `PRO_MATCHES_INTERVAL_MINUTES`, `PUBLIC_MATCHES_INTERVAL_MINUTES`, `PUBLIC_MIN_RANK_TIER`, `DETAILS_PER_MINUTE`, `STATS_INTERVAL_MINUTES` |
| Banco de dados | `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `DATABASE_URL`, `POSTGRES_PORT`, `POSTGRES_CPU_LIMIT`, `POSTGRES_MEMORY_LIMIT` |
| Metabase | `METABASE_PORT`, `METABASE_ADMIN_EMAIL`, `METABASE_ADMIN_PASSWORD`, `METABASE_READER_PASSWORD` |

## Qualidade

O projeto tem testes unitários (`src/**/*.spec.ts`), de integração com o banco (`src/**/*.int-spec.ts`) e e2e (`test/`), com meta mínima de cobertura de 90% (linhas, instruções e funções) e 80% (branches), definida em `vitest.config.ts`.

### CI

A cada push na `main` e em cada pull request, o GitHub Actions (`.github/workflows/ci.yml`) executa:

1. Shellcheck dos scripts, lint, verificação de formatação e build.
2. Migrations e testes unitários, de integração e e2e com a meta de cobertura, usando um PostgreSQL de serviço do GitHub Actions.
3. Auditoria de segurança das dependências usadas pela aplicação (`npm audit --omit=dev`).
4. Build da imagem Docker e scan de vulnerabilidades com o [Trivy](https://trivy.dev). O CI falha se houver vulnerabilidade alta ou crítica com correção disponível.
5. Nos pushes na `main`, publicação da imagem no GitHub Container Registry.

O Dependabot (`.github/dependabot.yml`) abre pull requests semanais com atualizações das dependências npm, das imagens Docker (inclusive a do PostgreSQL nos arquivos do Docker Compose) e das GitHub Actions.

Ele não propõe as atualizações de versão maior que dependem de uma decisão:

- **PostgreSQL:** uma versão maior exige migrar os dados do volume (`pg_dump` e restauração, ou `pg_upgrade`).
- **TypeScript 7:** ainda não é suportado pelo `@nestjs/swagger` e pelo `typescript-eslint`.
- **Node.js e `@types/node`:** o projeto usa o Node.js 26 (LTS a partir de 28/10/2026, com suporte até abril de 2029). Para migrar para uma nova versão maior, atualize juntos o `.nvmrc`, os Dockerfiles (`FROM node:...`), o `engines` e o `@types/node` do `package.json`.

## Contato

- Autor - [Bayma](https://testeemproducao.com.br/)

## Licença

Projeto de uso interno, sem licença de distribuição (`"license": "UNLICENSED"` no `package.json`). O Nest é licenciado sob a [licença MIT](https://github.com/nestjs/nest/blob/master/LICENSE).
