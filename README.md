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

Projeto base em TypeScript com o framework [Nest](https://github.com/nestjs/nest).

# Requisitos

- Docker e Docker Compose
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

O `install` verifica os requisitos, cria o `.env` a partir do `.env.example` (com um `JWT_KEY` aleatório) quando ele não existe, gera a imagem, sobe o container e aguarda o `/health` responder. Em desenvolvimento, também copia o `node_modules` do container para a pasta do projeto, para o editor reconhecer as dependências.

| Comando | Descrição |
|---|---|
| `./setup.sh install [dev\|prod]` | Configura, gera a imagem e sobe |
| `./setup.sh start [dev\|prod]` | Sobe sem gerar a imagem novamente |
| `./setup.sh stop [dev\|prod]` | Para e remove o container |
| `./setup.sh restart [dev\|prod]` | Reinicia o container |
| `./setup.sh logs [dev\|prod]` | Acompanha os logs |
| `./setup.sh status [dev\|prod]` | Status do container e do PM2 |

O ambiente padrão é `dev`. Em desenvolvimento, o debugger escuta na porta `9229`; para usar outra porta, defina `DEBUG_PORT` no `.env`.

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
- Funciona em Linux e macOS. No Windows, execute pelo WSL.

> Dar a um container acesso ao socket do Docker dá a ele controle total sobre o Docker da máquina. O container de setup apenas executa o `setup.sh` deste projeto e é removido ao fim do comando (`--rm`).

# Configuração

Copie o `.env.example` para `.env` e preencha os valores. As variáveis são validadas na inicialização (`src/config/env.validation.ts`), e a aplicação não sobe se alguma estiver faltando ou for inválida.

| Variável | Descrição |
|---|---|
| `APP_ENVIRONMENT` | `production` ativa os logs em JSON, exige um `JWT_KEY` com pelo menos 32 caracteres e desativa os usuários de demonstração |
| `PORT` | Porta HTTP (padrão `3000`) |
| `SWAGGER` | `true` disponibiliza a documentação da API em `/doc` |
| `LOG_LEVEL` | `verbose`, `debug`, `log`, `warn`, `error` ou `fatal` |
| `CORS_ORIGINS` | Origens permitidas, separadas por vírgula; vazio permite qualquer origem |
| `TRUST_PROXY` | Proxies reversos confiáveis: `false` (padrão), `true`, o número de proxies na frente da aplicação (ex.: `1`) ou uma lista de endereços |
| `THROTTLE_TTL` / `THROTTLE_LIMIT` | Limite de requisições por IP (padrão 100 por minuto; o login é limitado a 5 por minuto) |
| `JWT_KEY` / `JWT_EXPIRES_IN` | Chave de assinatura do token e validade em segundos |
| `PM2_INSTANCES` | Número de processos do PM2 em produção (padrão `1`, `max` para um por núcleo de CPU) |
| `DEBUG_PORT` | Porta do debugger em desenvolvimento (padrão `9229`) |

# Produção 

### Antes do deploy

Defina estas variáveis no `.env` do servidor:

- `APP_ENVIRONMENT="production"`: ativa os logs em JSON e desativa os usuários de demonstração
- `JWT_KEY`: uma chave aleatória forte com pelo menos 32 caracteres; caso contrário, a aplicação não sobe. O `setup.sh` gera uma automaticamente ao criar o `.env`. Para gerar manualmente:
  ```bash
  openssl rand -base64 48
  ```
- `CORS_ORIGINS`: as origens do front-end que podem chamar a API, por exemplo `"https://app.example.com,https://admin.example.com"`. Se ficar vazia, qualquer origem é permitida.
- `TRUST_PROXY`: se a aplicação fica atrás de um proxy reverso ou load balancer (nginx, Traefik, ALB etc.), informe quantos proxies existem na frente dela, por exemplo `"1"`. Sem isso, todas as requisições parecem vir do IP do proxy, e o limite de requisições (inclusive o de 5 logins por minuto) passa a valer para todos os clientes juntos. Só ative quando houver de fato um proxy, porque o cabeçalho `X-Forwarded-For` pode ser forjado por quem acessa a aplicação diretamente.

### Executando a aplicação

```bash
docker-compose up -d --build
```

O container executa a aplicação com o [PM2](https://pm2.keymetrics.io/) (`ecosystem.config.js`), com um usuário sem privilégios de root e um health check em `/health`.

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
| `ecosystem.config.js` | `docker/Dockerfile` (`npm run start:pm2`) | `dist/main.js` em modo cluster |
| `ecosystem.dev.config.js` | `docker/DockerfileDev` (`npm run start:pm2-dev`) | `nest start --debug --watch` |
| `docker/pm2-logrotate-settings.sh` | os dois Dockerfiles, na geração da imagem | configurações do `pm2-logrotate` |

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

O mesmo `ecosystem.config.js` funciona diretamente em um servidor com Node.js 24.9+.

1. Instale o PM2:

```bash
npm install -g pm2
```

2. Instale o módulo de rotação de logs:

```bash
pm2 install pm2-logrotate
```

3. Aplique as configurações de rotação de logs:

```bash
./docker/pm2-logrotate-settings.sh
```

4. Instale as dependências:

```bash
npm ci
```

5. Gere o build:

```bash
npm run build
```

6. Inicie a aplicação:

```bash
pm2 start ecosystem.config.js
```

7. Salve a lista de processos:

```bash
pm2 save
```

8. Configure o PM2 para iniciar junto com o sistema (depois, execute com `sudo` o comando exibido):

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

A aplicação roda com o PM2 (`ecosystem.dev.config.js`), recarrega ao alterar arquivos, e um debugger pode se conectar na porta `9229` (ou na porta definida em `DEBUG_PORT`). Os logs são gravados em `logs/api.log` na pasta do projeto.

Ao adicionar ou atualizar dependências no `package.json`, recrie o container com o `-V`, que descarta o volume antigo do `node_modules`:

```bash
docker-compose --file docker-compose.dev.yml up -d --build -V
```

O `./setup.sh install dev` já faz isso.

# Endpoints

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/` | Página inicial |
| `GET` | `/api` | Exemplo de rota pública |
| `GET` | `/api/axios` | Exemplo de requisição HTTP externa com o `HttpModule` |
| `POST` | `/api/auth/login` | Login; retorna o token de acesso |
| `GET` | `/api/auth/profile` | Dados do usuário logado (requer a role `admin`) |
| `GET` | `/health` | Health check |
| `GET` | `/doc` | Documentação Swagger (quando `SWAGGER="true"`) |
| `GET` | `/doc-json` | Especificação OpenAPI em JSON (quando `SWAGGER="true"`) |

# Autorização

`POST /api/auth/login` retorna `{ "access_token": "..." }`. Envie o token no header `Authorization: Bearer <token>`.

Proteja uma rota (ou um controller inteiro) com `@Authorize()`. Ao informar roles, o acesso fica restrito a elas, e administradores têm acesso a tudo:

```ts
@Get('/profile')
@Authorize(Role.Admin)
getProfile() {}
```

Fora de produção, os usuários de demonstração `bayma` (admin) e `maria` (gest) estão disponíveis com a senha `teste`.

### Persistência de usuários

Os usuários ficam em memória, em `src/users/users.service.ts`, e em produção a lista fica vazia, então nenhum login funciona até existir uma persistência. Para conectar um banco de dados ou outro serviço (por exemplo, um microsserviço de usuários), basta alterar o `UsersService`:

1. Implemente o método `findOne(username)` buscando o usuário na sua fonte de dados. Ele deve retornar um `User` (`src/users/interfaces/user.interface.ts`), com a senha já em hash bcrypt, ou `undefined` quando o usuário não existir.
2. Remova a lista `DEMO_USERS`.

O restante da autenticação (login, JWT, roles) usa apenas o `UsersService` e não precisa mudar. Para gerar o hash bcrypt de uma senha (com o ambiente de desenvolvimento rodando):

```bash
docker-compose --file docker-compose.dev.yml exec node node -e "console.log(require('bcrypt').hashSync('senha', 10))"
```

# Respostas de erro

Todos os erros da API seguem o mesmo formato:

```json
{
  "statusCode": 404,
  "error": "Not Found",
  "message": "Cannot GET /nada",
  "path": "/nada",
  "timestamp": "2026-10-11T19:53:46.875Z",
  "requestId": "9e4734da-b071-4f29-93bd-af5dd27caf51"
}
```

Erros inesperados (500) retornam apenas `Internal server error`, e os detalhes, com o stack trace, ficam no log.

Cada requisição recebe um ID, devolvido no cabeçalho `X-Request-Id` e incluído nos logs e nas respostas de erro. Se o cliente ou o proxy já enviar um `X-Request-Id` válido, ele é reaproveitado, o que permite rastrear uma requisição entre serviços.

# Testes e qualidade

Os comandos abaixo precisam do Node.js 24.9+ na máquina. Sem Node, rode-os dentro do container de desenvolvimento, por exemplo:

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

Cobertura de testes:

```bash
npm run test:cov
```

Lint (corrige automaticamente o que for possível):

```bash
npm run lint
```

Formatação com o Prettier:

```bash
npm run format
```

### CI

A cada push na `main` e em cada pull request, o GitHub Actions (`.github/workflows/ci.yml`) executa: lint, verificação de formatação, shellcheck dos scripts, build, testes unitários e e2e, auditoria de segurança das dependências de produção e build da imagem Docker.

O Dependabot (`.github/dependabot.yml`) abre pull requests semanais com atualizações das dependências npm, das imagens Docker e das GitHub Actions.

## Contato

- Autor - [Bayma](https://testeemproducao.com.br/)

## Licença

Este projeto usa a licença ISC (veja o `package.json`). O Nest é licenciado sob a [licença MIT](https://github.com/nestjs/nest/blob/master/LICENSE).
