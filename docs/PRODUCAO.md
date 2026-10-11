# Ambiente de produção

Guia para instalar e operar o sistema em produção. Para entender a arquitetura, a autenticação e as demais partes do sistema, veja o [README](../README.md). Para o ambiente local, veja o [guia de desenvolvimento](DESENVOLVIMENTO.md).

## Requisitos

- Docker e Docker Compose no servidor
- openssl, para o `setup.sh` gerar as chaves do JWT (dispensável ao executar o setup em um container)

## Antes do deploy

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

Revise também:

- `SWAGGER`: mantenha `"false"`, para não expor a documentação da API.
- `LOG_LEVEL`: `log` é o recomendado; `debug` e `verbose` geram muito volume.
- `PM2_INSTANCES`, `CPU_LIMIT` e `MEMORY_LIMIT`: dimensione conforme o servidor (veja [PM2](#pm2)).

Variáveis específicas da produção:

| Variável | Descrição |
|---|---|
| `PM2_INSTANCES` | Número de processos do PM2 (padrão `1`, `max` para um por núcleo de CPU) |
| `CPU_LIMIT` / `MEMORY_LIMIT` | Limites de CPU e memória do container (padrão `1` CPU e `1g`) |

A descrição das variáveis comuns aos ambientes está na seção [Configuração](../README.md#configuração) do README.

> **Usuários:** em produção, os usuários de demonstração ficam desativados e a lista de usuários fica vazia, então nenhum login funciona até o `UsersService` ser conectado a uma persistência (banco de dados ou outro serviço). Veja [Persistência de usuários](../README.md#persistência-de-usuários) no README.

## Instalação

```bash
./setup.sh install prod
```

Quando o `.env` não existe, o `install` o cria com um par de chaves RSA novo, `APP_ENVIRONMENT="production"`, `SWAGGER="false"` e `LOG_LEVEL="log"`. Em seguida, gera a imagem, sobe o container e aguarda o `/health` responder. Ele também avisa se `APP_ENVIRONMENT` não for `production` ou se `CORS_ORIGINS` estiver vazio. Revise o `.env` gerado com a seção [Antes do deploy](#antes-do-deploy).

Sem bash ou openssl no servidor, execute o setup em um container (a partir da raiz do projeto):

```bash
docker-compose -f docker-compose.setup.yml run --rm setup install prod
```

Para subir sem o `setup.sh`, com o `.env` já preenchido:

```bash
docker-compose up -d --build
```

## Segurança do container

O container executa a aplicação com o [PM2](https://pm2.keymetrics.io/) (`ecosystem.config.cjs`), com um usuário sem privilégios de root e um health check em `/health`. Ele também tem limites de CPU e memória (`CPU_LIMIT` e `MEMORY_LIMIT`), roda sem nenhuma capability do Linux e não pode ganhar novos privilégios.

A imagem de produção não inclui o npm (que não é usado em execução), e as imagens base são fixadas por digest; o Dependabot propõe as atualizações.

A cada push na `main`, o CI publica a imagem no GitHub Container Registry (`ghcr.io/baymabruno/nestjs-base-project`), com as tags `latest`, a versão do `package.json` e o commit (`sha-xxxxxxx`).

## Logs

Os logs são gravados em `logs/api.log` (mantido no volume Docker `logs`) e também na saída padrão:

Logs do container:

```bash
docker-compose logs -f
```

Arquivo de log:

```bash
docker-compose exec node tail -f logs/api.log
```

## PM2

| Arquivo | Usado por | O que executa |
|---|---|---|
| `ecosystem.config.cjs` | `docker/Dockerfile` (`pm2-runtime start ecosystem.config.cjs`) | `dist/main.js` em modo cluster |
| `docker/pm2-logrotate-install.sh` | `docker/Dockerfile`, na geração da imagem | instala o `pm2-logrotate` e aplica as configurações |
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

## Atualizando para uma nova versão

1. Atualize o código no servidor:

```bash
git pull
```

2. Gere a imagem nova e recrie o container:

```bash
./setup.sh install prod
```

O container é recriado, então a aplicação fica alguns segundos fora do ar durante a troca. O `pm2 reload` (veja [PM2](#pm2)) reinicia sem downtime, mas só recarrega o código que já está na imagem; uma versão nova sempre exige gerar a imagem de novo.

## Troca das chaves do JWT

Para trocar as chaves (por exemplo, se a chave privada vazar):

1. Gere um par novo (veja [Antes do deploy](#antes-do-deploy)) e substitua `JWT_PRIVATE_KEY` e `JWT_PUBLIC_KEY` no `.env`.
2. Reinicie a aplicação.

O JWKS publica apenas a chave atual. Por isso, ao trocar as chaves, todos os tokens emitidos com a chave anterior deixam de valer, e os usuários precisam fazer login de novo. Os outros serviços passam a usar a chave nova quando o cache do JWKS expira (até 1 hora) ou assim que encontram um `kid` desconhecido, se a biblioteca buscar o JWKS novamente nesse caso (o `jwks-rsa` e o `jose` buscam).

## Observabilidade

A integração com o `@nestjs/observe` vem desligada. Antes de ativar, veja na seção [Observabilidade](../README.md#observabilidade) do README quais dados passam a ser enviados.

Para ativar:

1. Crie uma conta e um serviço em observe.nestjs.com.
2. Defina no `.env` o `OBSERVE_APP_KEY` e o `OBSERVE_APP_SECRET` gerados no painel, e o `OBSERVE_SERVICE_ID`.
3. Reinicie a aplicação.

Ao ativar, considere que:

- os dados das requisições (rotas, status, durações e logs) passam a ser enviados para um serviço externo;
- o envio de trechos do código-fonte junto com os erros (`sourceContext`) está desligado em `src/observe.ts`;
- erros esperados (400, 401, 403, 404 e 429) são enviados sem o detalhamento interno, o que reduz o número de eventos;
- o commit da imagem (`GIT_SHA`, preenchido pelo CI ao gerar a imagem) identifica a versão em produção.

## Monitoramento

O container tem um health check que chama `/health` a cada 30 segundos. Para ver o estado atual (`starting`, `healthy` ou `unhealthy`):

```bash
docker inspect --format '{{.State.Health.Status}}' nestjs-base-project
```

O endpoint `/health` também pode ser usado por um load balancer ou por um monitoramento externo.

## Comandos úteis

Status do container e dos processos do PM2:

```bash
./setup.sh status prod
```

Logs:

```bash
./setup.sh logs prod
```

Reiniciar o container:

```bash
./setup.sh restart prod
```

Parar e remover o container:

```bash
./setup.sh stop prod
```
