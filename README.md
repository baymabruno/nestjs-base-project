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

Projeto base em TypeScript com o framework [Nest](https://github.com/nestjs/nest) 12 (ESM), preparado para microsserviços: autenticação JWT com RS256 e JWKS, rastreamento de requisições entre serviços, API versionada, validação com Zod e Docker com PM2.

# Requisitos

- Docker e Docker Compose
- openssl, para o `setup.sh` gerar as chaves do JWT (dispensável ao executar o setup em um container)
- Node.js 24.9+ (apenas para rodar a aplicação ou os testes fora do Docker; veja o `.nvmrc`)

# Início rápido

O `setup.sh` instala e executa a aplicação com Docker:

Desenvolvimento (hot reload, debugger e Swagger):

```bash
./setup.sh install dev
```

Produção:

```bash
./setup.sh install prod
```

O `install` verifica os requisitos, cria o `.env` a partir do `.env.example` (com um par de chaves RSA novo para o JWT) quando ele não existe, gera a imagem, sobe o container e aguarda o `/health` responder. Em desenvolvimento, também copia o `node_modules` do container para a pasta do projeto, para o editor reconhecer as dependências.

| Comando | Descrição |
|---|---|
| `./setup.sh install [dev\|prod]` | Configura, gera a imagem e sobe |
| `./setup.sh start [dev\|prod]` | Sobe sem gerar a imagem novamente |
| `./setup.sh stop [dev\|prod]` | Para e remove o container |
| `./setup.sh restart [dev\|prod]` | Reinicia o container |
| `./setup.sh logs [dev\|prod]` | Acompanha os logs |
| `./setup.sh status [dev\|prod]` | Status do container e do PM2 |

O ambiente padrão é `dev`. Em desenvolvimento, o debugger escuta na porta `9229`; para usar outra porta, defina `DEBUG_PORT` no `.env`.

Se o `.env` já existir sem as chaves do JWT (por exemplo, criado antes da troca para RS256), o `install` gera as chaves e remove a variável antiga `JWT_KEY`.

### Executando o setup em um container

Para não precisar instalar nada além do Docker (sem bash, openssl ou Node.js na máquina), execute o `setup.sh` dentro de um container com o `docker-compose.setup.yml`. Execute a partir da raiz do projeto:

Desenvolvimento:

```bash
docker-compose -f docker-compose.setup.yml run --rm setup install dev
```

Produção:

```bash
docker-compose -f docker-compose.setup.yml run --rm setup install prod
```

Todos os comandos do `setup.sh` funcionam da mesma forma:

Subir sem gerar a imagem novamente:

```bash
docker-compose -f docker-compose.setup.yml run --rm setup start dev
```

Acompanhar os logs:

```bash
docker-compose -f docker-compose.setup.yml run --rm setup logs dev
```

Ver o status:

```bash
docker-compose -f docker-compose.setup.yml run --rm setup status dev
```

Parar:

```bash
docker-compose -f docker-compose.setup.yml run --rm setup stop dev
```

Para encurtar, crie um alias:

```bash
alias setup='docker-compose -f docker-compose.setup.yml run --rm setup'
```

Depois, use o alias no lugar do comando completo:

```bash
setup install dev
```

Como funciona:

- O container de setup tem o Docker CLI e usa o Docker da máquina pelo `/var/run/docker.sock`, então os containers da aplicação rodam na máquina normalmente.
- A pasta do projeto é montada no mesmo caminho da máquina (`${PWD}`), por isso o comando precisa ser executado da raiz do projeto.
- Os arquivos criados pelo setup (`.env`, `node_modules`) ficam com o mesmo dono da pasta do projeto.
- O container já tem o openssl, usado para gerar as chaves do JWT.
- Funciona em Linux e macOS. No Windows, execute pelo WSL.

> Dar a um container acesso ao socket do Docker dá a ele controle total sobre o Docker da máquina. O container de setup apenas executa o `setup.sh` deste projeto e é removido ao fim do comando (`--rm`).

# Configuração

Copie o `.env.example` para `.env` e preencha os valores. As variáveis são validadas na inicialização (`src/config/env.validation.ts`), e a aplicação não sobe se alguma estiver faltando ou for inválida.

| Variável | Descrição |
|---|---|
| `APP_ENVIRONMENT` | `production` ativa os logs em JSON e desativa os usuários de demonstração |
| `PORT` | Porta HTTP (padrão `3000`) |
| `SWAGGER` | `true` disponibiliza a documentação da API em `/doc` |
| `LOG_LEVEL` | `verbose`, `debug`, `log`, `warn`, `error` ou `fatal` |
| `CORS_ORIGINS` | Origens permitidas, separadas por vírgula; vazio permite qualquer origem |
| `TRUST_PROXY` | Proxies reversos confiáveis: `false` (padrão), `true`, o número de proxies na frente da aplicação (ex.: `1`) ou uma lista de endereços |
| `THROTTLE_TTL` / `THROTTLE_LIMIT` | Limite de requisições por IP (padrão 100 por minuto; o login é limitado a 5 por minuto) |
| `JWT_PRIVATE_KEY` / `JWT_PUBLIC_KEY` | Par de chaves RSA (PEM em base64): a privada assina os tokens e a pública os valida. O `setup.sh` gera as duas |
| `JWT_ISSUER` / `JWT_AUDIENCE` | Emissor (`iss`) e público (`aud`) dos tokens (padrão `nestjs-base-project`) |
| `JWT_EXPIRES_IN` | Validade do access token em segundos (padrão `900`, 15 minutos) |
| `JWT_REFRESH_EXPIRES_IN` | Validade do refresh token em segundos (padrão `604800`, 7 dias) |
| `OBSERVE_APP_KEY` / `OBSERVE_APP_SECRET` / `OBSERVE_SERVICE_ID` | Observabilidade com o `@nestjs/observe`; desligada enquanto a chave e o segredo estiverem vazios (veja [Observabilidade](#observabilidade)) |
| `PM2_INSTANCES` | Número de processos do PM2 em produção (padrão `1`, `max` para um por núcleo de CPU) |
| `DEBUG_PORT` | Porta do debugger em desenvolvimento (padrão `9229`) |
| `CPU_LIMIT` / `MEMORY_LIMIT` | Limites de CPU e memória do container em produção (padrão `1` CPU e `1g`) |

# Produção 

### Antes do deploy

Defina estas variáveis no `.env` do servidor:

- `APP_ENVIRONMENT="production"`: ativa os logs em JSON e desativa os usuários de demonstração
- `JWT_PRIVATE_KEY` e `JWT_PUBLIC_KEY`: um par de chaves RSA de pelo menos 2048 bits, exclusivo de cada ambiente. O `setup.sh` gera o par ao criar o `.env`. Para gerar manualmente, crie a chave privada:
  ```bash
  openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out private.pem
  ```
  Extraia a chave pública:
  ```bash
  openssl pkey -in private.pem -pubout -out public.pem
  ```
  Converta a chave privada para base64 e use o resultado em `JWT_PRIVATE_KEY`:
  ```bash
  openssl base64 -A -in private.pem
  ```
  Converta a chave pública para base64 e use o resultado em `JWT_PUBLIC_KEY`:
  ```bash
  openssl base64 -A -in public.pem
  ```
- `CORS_ORIGINS`: as origens do front-end que podem chamar a API, por exemplo `"https://app.example.com,https://admin.example.com"`. Se ficar vazia, qualquer origem é permitida.
- `JWT_EXPIRES_IN`: mantenha o access token curto (padrão de 15 minutos); o front-end renova a sessão com o refresh token.
- `TRUST_PROXY`: se a aplicação fica atrás de um proxy reverso ou load balancer (nginx, Traefik, ALB etc.), informe quantos proxies existem na frente dela, por exemplo `"1"`. Sem isso, todas as requisições parecem vir do IP do proxy, e o limite de requisições (inclusive o de 5 logins por minuto) passa a valer para todos os clientes juntos. Só ative quando houver de fato um proxy, porque o cabeçalho `X-Forwarded-For` pode ser forjado por quem acessa a aplicação diretamente.

### Executando a aplicação

```bash
docker-compose up -d --build
```

O container executa a aplicação com o [PM2](https://pm2.keymetrics.io/) (`ecosystem.config.cjs`), com um usuário sem privilégios de root e um health check em `/health`. Ele também tem limites de CPU e memória (`CPU_LIMIT` e `MEMORY_LIMIT`), roda sem nenhuma capability do Linux e não pode ganhar novos privilégios.

A imagem de produção não inclui o npm (que não é usado em execução), e as imagens base são fixadas por digest; o Dependabot propõe as atualizações.

A cada push na `main`, o CI publica a imagem no GitHub Container Registry (`ghcr.io/baymabruno/nestjs-base-project`), com as tags `latest`, a versão do `package.json` e o commit (`sha-xxxxxxx`).

Os logs são gravados em `logs/api.log` (mantido no volume Docker `logs`) e também na saída padrão:

Logs do container:

```bash
docker-compose logs -f
```

Arquivo de log:

```bash
docker-compose exec node tail -f logs/api.log
```

### PM2

| Arquivo | Usado por | O que executa |
|---|---|---|
| `ecosystem.config.cjs` | `docker/Dockerfile` (`pm2-runtime start ecosystem.config.cjs`) | `dist/main.js` em modo cluster |
| `ecosystem.dev.config.cjs` | `docker/DockerfileDev` (`npm run start:pm2-dev`) | `nest start --debug --watch` |
| `docker/pm2-logrotate-install.sh` | os dois Dockerfiles, na geração da imagem | instala o `pm2-logrotate` e aplica as configurações |
| `docker/pm2-logrotate-settings.sh` | `pm2-logrotate-install.sh` | configurações do `pm2-logrotate` |

O PM2 é uma dependência do projeto (`package.json`), e não uma instalação global. Assim, os `overrides` do `package.json` forçam versões corrigidas das dependências dele, inclusive dentro do `pm2-logrotate`. Os arquivos do PM2 usam a extensão `.cjs` porque o projeto é ESM.

O número de processos é definido pela variável `PM2_INSTANCES` no `.env` (padrão `1`, ou `max` para um por núcleo de CPU).

Ao parar ou reiniciar, o PM2 aguarda até 10 segundos (`kill_timeout`) para a aplicação concluir as requisições em andamento, e o Docker aguarda até 15 segundos (`stop_grace_period`) antes de encerrar o container.

> Com mais de uma instância, cada processo mantém seus próprios contadores de limite de requisições, então o limite efetivo é multiplicado pelo número de instâncias.

Os logs são rotacionados diariamente ou ao atingir 500MB, mantendo 10 arquivos. Para alterar, edite o `docker/pm2-logrotate-settings.sh` e gere a imagem novamente.

Comandos úteis, executados dentro do container:

Listar os processos:

```bash
docker-compose exec node pm2 status
```

Acompanhar os logs:

```bash
docker-compose exec node pm2 logs
```

Painel de CPU e memória:

```bash
docker-compose exec node pm2 monit
```

Reiniciar sem downtime:

```bash
docker-compose exec node pm2 reload node-backend
```

Para publicar uma nova versão, gere a imagem novamente:

```bash
docker-compose up -d --build
```

#### Sem Docker

O mesmo `ecosystem.config.cjs` funciona diretamente em um servidor com Node.js 24.9+. Execute os comandos na pasta do projeto.

1. Instale as dependências (o PM2 vem junto):

```bash
npm ci
```

2. Gere o build:

```bash
npm run build
```

3. Coloque os comandos do projeto (como o `pm2`) no PATH da sessão:

```bash
export PATH="$PWD/node_modules/.bin:$PATH"
```

4. Instale e configure o módulo de rotação de logs:

```bash
./docker/pm2-logrotate-install.sh
```

5. Inicie a aplicação:

```bash
pm2 start ecosystem.config.cjs
```

6. Salve a lista de processos:

```bash
pm2 save
```

7. Configure o PM2 para iniciar junto com o sistema (depois, execute com `sudo` o comando exibido):

```bash
pm2 startup
```

# Desenvolvimento 

### Executando a aplicação

Suba o ambiente:

```bash
docker-compose --file docker-compose.dev.yml up -d --build
```

Copie o `node_modules` do container para a pasta do projeto:

```bash
docker cp nestjs-base-project:/var/www/html/node_modules/ ./
```

A aplicação roda com o PM2 (`ecosystem.dev.config.cjs`), recarrega ao alterar arquivos, e um debugger pode se conectar na porta `9229` (ou na porta definida em `DEBUG_PORT`). Os logs são gravados em `logs/api.log` na pasta do projeto.

Ao adicionar ou atualizar dependências no `package.json`, recrie o container com o `-V`, que descarta o volume antigo do `node_modules`:

```bash
docker-compose --file docker-compose.dev.yml up -d --build -V
```

O `./setup.sh install dev` já faz isso.

### Dev Container (VS Code)

Com a extensão Dev Containers, o VS Code pode rodar dentro do container de desenvolvimento, usando o `node_modules` dele. Assim, não é preciso copiar o `node_modules` para a máquina, e o editor usa exatamente as mesmas dependências da aplicação. Com o projeto aberto, execute o comando **Dev Containers: Reopen in Container**. A configuração está em `.devcontainer/devcontainer.json` e já instala as extensões de ESLint, Prettier e Vitest.

# Endpoints

As rotas da API ficam sob o prefixo `/api/v1`. A página inicial, o health check, o JWKS e o Swagger ficam fora do prefixo e do versionamento.

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/` | Página inicial |
| `GET` | `/api/v1/status` | Exemplo de rota pública |
| `GET` | `/api/v1/axios` | Exemplo de requisição HTTP para outro serviço com o `HttpModule` |
| `POST` | `/api/v1/auth/login` | Login; retorna o access token e o refresh token |
| `POST` | `/api/v1/auth/refresh` | Troca um refresh token por um novo par de tokens |
| `GET` | `/api/v1/auth/profile` | Dados do usuário logado (requer a role `admin`) |
| `GET` | `/.well-known/jwks.json` | Chave pública para validar os tokens (JWKS) |
| `GET` | `/health` | Health check |
| `GET` | `/doc` | Documentação Swagger (quando `SWAGGER="true"`) |
| `GET` | `/doc-json` | Especificação OpenAPI em JSON (quando `SWAGGER="true"`) |

### Versionamento

O versionamento é pela URL, com a versão `1` como padrão. Para criar uma versão nova de uma rota sem quebrar quem usa a atual, declare a versão no controller ou na rota. A versão 2 fica disponível em `/api/v2/...`, e a versão 1 continua funcionando:

```ts
@Controller({ path: 'auth', version: '2' })
```

# Autorização

O login retorna dois tokens:

```json
{
  "access_token": "...",
  "refresh_token": "...",
  "token_type": "Bearer",
  "expires_in": 900
}
```

- **Access token:** enviado no header `Authorization: Bearer <token>` para acessar as rotas protegidas. Tem validade curta (`JWT_EXPIRES_IN`).
- **Refresh token:** enviado em `POST /api/v1/auth/refresh` como `{ "refresh_token": "..." }` para obter um novo par de tokens quando o access token expira. Não é aceito como access token, e vice-versa.

Os tokens são assinados com RS256, com as claims `sub` (id do usuário), `iss`, `aud` e `token_use` (`access` ou `refresh`), e o header traz o `kid` da chave.

> O refresh token não fica armazenado no servidor. Por isso funciona com várias instâncias, mas não pode ser revogado antes de expirar. Para permitir logout ou revogação, é preciso guardar os tokens em um armazenamento compartilhado (Redis ou banco de dados).

Proteja uma rota (ou um controller inteiro) com `@Authorize()`. Ao informar roles, o acesso fica restrito a elas, e administradores têm acesso a tudo:

```ts
@Get('/profile')
@Authorize(Role.Admin)
getProfile() {}
```

O login tem dois limites: 5 tentativas por minuto por IP e 10 tentativas a cada 15 minutos por nome de usuário, vindas de qualquer IP.

Fora de produção, os usuários de demonstração `bayma` (admin) e `maria` (gest) estão disponíveis com a senha `teste`.

### Validando os tokens em outros serviços

Só este serviço tem a chave privada. Os outros serviços validam os tokens com a chave pública, publicada em `/.well-known/jwks.json`, sem precisar de nenhum segredo compartilhado. Para validar um token, o serviço deve:

1. Buscar a chave em `/.well-known/jwks.json` (pode guardar em cache por 1 hora) e escolher a que tem o mesmo `kid` do header do token.
2. Verificar a assinatura com o algoritmo `RS256`.
3. Conferir `iss` e `aud` (os valores de `JWT_ISSUER` e `JWT_AUDIENCE`), a expiração (`exp`) e se `token_use` é `access`.

A maioria das bibliotecas de JWT faz isso a partir da URL do JWKS, por exemplo o `jwks-rsa` com o `passport-jwt` em Node.js.

### Persistência de usuários

Os usuários ficam em memória, em `src/users/users.service.ts`, e em produção a lista fica vazia, então nenhum login funciona até existir uma persistência. Para conectar um banco de dados ou outro serviço (por exemplo, um microsserviço de usuários), basta alterar o `UsersService`:

1. Implemente o método `findOne(username)` buscando o usuário na sua fonte de dados. Ele deve retornar um `User` (`src/users/interfaces/user.interface.ts`), com a senha já em hash bcrypt, ou `undefined` quando o usuário não existir.
2. Remova a lista `DEMO_USERS`.

O restante da autenticação (login, JWT, roles) usa apenas o `UsersService` e não precisa mudar. Para gerar o hash bcrypt de uma senha (com o ambiente de desenvolvimento rodando):

```bash
docker-compose --file docker-compose.dev.yml exec node node -e "console.log(require('bcrypt').hashSync('senha', 10))"
```

# Validação

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

# Respostas de erro

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

# Rastreamento de requisições

Cada requisição recebe um ID, devolvido no cabeçalho `X-Request-Id`. Se o cliente ou o proxy já enviar um `X-Request-Id` válido, ele é reaproveitado. O ID aparece:

- em todos os logs escritos durante a requisição, inclusive os dos services, sem precisar passá-lo como parâmetro;
- nas respostas de erro;
- nas requisições feitas para outros serviços com o `HttpService` (`@nestjs/axios`), no cabeçalho `X-Request-Id`.

Assim, uma requisição pode ser rastreada de ponta a ponta entre os serviços. Para ler o ID no código, use `RequestContext.getRequestId()` (`src/common/request-context.ts`).

# Observabilidade

O projeto vem integrado ao [`@nestjs/observe`](https://observe.nestjs.com), que envia traces, erros, logs e métricas para o serviço observe.nestjs.com (gratuito até 300 mil eventos por mês). A integração fica **desligada** enquanto `OBSERVE_APP_KEY` e `OBSERVE_APP_SECRET` estiverem vazios, e nesse caso nenhum dado sai da aplicação.

Para ativar:

1. Crie uma conta e um serviço em observe.nestjs.com.
2. Defina no `.env` o `OBSERVE_APP_KEY` e o `OBSERVE_APP_SECRET` gerados no painel, e o `OBSERVE_SERVICE_ID`.
3. Reinicie a aplicação.

Ao ativar, considere que:

- os dados das requisições (rotas, status, durações e logs) passam a ser enviados para um serviço externo;
- o envio de trechos do código-fonte junto com os erros (`sourceContext`) está desligado em `src/observe.ts`;
- erros esperados (400, 401, 403, 404 e 429) são enviados sem o detalhamento interno, o que reduz o número de eventos;
- no Docker, o commit da imagem (`GIT_SHA`) identifica a versão em produção.

# Testes e qualidade

Os testes usam o [Vitest](https://vitest.dev). Os comandos abaixo precisam do Node.js 24.9+ na máquina. Sem Node, rode-os dentro do container de desenvolvimento, por exemplo:

```bash
docker-compose --file docker-compose.dev.yml exec node npm run test
```

Testes unitários:

```bash
npm run test
```

Testes e2e:

```bash
npm run test:e2e
```

Testes unitários e e2e com cobertura:

```bash
npm run test:cov
```

O `test:cov` falha se a cobertura ficar abaixo de 90% (linhas, instruções e funções) ou de 80% (branches). As metas estão em `vitest.config.ts`, e o relatório fica na pasta `coverage`.

Lint (corrige automaticamente o que for possível):

```bash
npm run lint
```

Formatação com o Prettier:

```bash
npm run format
```

### CI

A cada push na `main` e em cada pull request, o GitHub Actions (`.github/workflows/ci.yml`) executa:

1. Shellcheck dos scripts, lint, verificação de formatação e build.
2. Testes unitários e e2e com a meta de cobertura.
3. Auditoria de segurança das dependências de produção.
4. Build da imagem Docker e scan de vulnerabilidades com o [Trivy](https://trivy.dev). O CI falha se houver vulnerabilidade alta ou crítica com correção disponível.
5. Nos pushes na `main`, publicação da imagem no GitHub Container Registry.

O Dependabot (`.github/dependabot.yml`) abre pull requests semanais com atualizações das dependências npm, das imagens Docker e das GitHub Actions.

## Contato

- Autor - [Bayma](https://testeemproducao.com.br/)

## Licença

Este projeto usa a licença ISC (veja o `package.json`). O Nest é licenciado sob a [licença MIT](https://github.com/nestjs/nest/blob/master/LICENSE).
