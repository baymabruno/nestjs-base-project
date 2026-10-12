# Configuração

Referência de todas as variáveis de ambiente do Dota Metrics. Elas ficam no `.env`, criado a partir do `.env.example` pelo `./setup.sh install`, que também gera as chaves do JWT e a senha do banco. Os comentários do `.env.example` resumem cada variável.

Para a instalação e a operação de cada ambiente, veja os guias de [desenvolvimento](DESENVOLVIMENTO.md) e de [produção](PRODUCAO.md).

## Quem lê cada variável

| Leitor | Quando | Variáveis |
|---|---|---|
| Aplicação (API, worker e backfill) | Ao iniciar cada processo | A maioria. São validadas em `src/config/env.validation.ts`: com um valor inválido ou faltando, o processo não sobe e o log mostra qual variável está errada |
| Docker Compose | Ao criar os containers | Portas, limites de recursos e credenciais do PostgreSQL |
| PM2 | Ao iniciar o container | `PM2_INSTANCES` |
| `setup.sh` | Ao executar os comandos | Lê e gera as credenciais (chaves do JWT, senhas do banco e do Metabase) |

### Aplicando uma alteração

| Ambiente | Variáveis da aplicação e do PM2 | Variáveis do Docker Compose |
|---|---|---|
| Desenvolvimento | `./setup.sh restart dev`. A aplicação lê o `.env` da pasta do projeto a cada início | `./setup.sh start dev`, que recria os containers alterados |
| Produção | `./setup.sh start prod`. O container recebe o `.env` só quando é criado, então o `restart` não aplica a mudança | `./setup.sh start prod` |

Para as variáveis do worker, em desenvolvimento, basta reiniciar o worker:

```bash
docker exec dota-metrics pm2 restart worker
```

## Aplicação

| Variável | Padrão | Descrição |
|---|---|---|
| `APP_ENVIRONMENT` | `develop` | Nome do ambiente. `production` ativa os logs em JSON e desativa os usuários de demonstração; qualquer outro valor (`develop`, `staging`...) os mantém. O `./setup.sh install prod` grava `production` |
| `PORT` | `3000` | Porta HTTP da API, dentro do container e na máquina. Também é a porta do health check do container de produção |
| `SWAGGER` | `false` | `true` publica a documentação da API em `/doc` e a especificação OpenAPI em `/doc-json`. O `.env.example` traz `true` para o desenvolvimento; em produção, mantenha `false` |
| `LOG_LEVEL` | `log` | Nível mínimo dos logs: `verbose`, `debug`, `log`, `warn`, `error` ou `fatal`. Cada nível inclui os mais graves. O `.env.example` traz `debug` para o desenvolvimento; `debug` e `verbose` geram muito volume em produção |
| `CORS_ORIGINS` | vazio | Origens que podem chamar a API pelo navegador (CORS), separadas por vírgula, por exemplo `https://app.example.com,https://admin.example.com`. Vazio permite qualquer origem |
| `TRUST_PROXY` | `false` | Proxies reversos autorizados a informar o IP do cliente (`X-Forwarded-For`): `false` (nenhum), `true` (qualquer um), o número de proxies na frente da aplicação (por exemplo `1` atrás de um nginx ou load balancer) ou uma lista de endereços e sub-redes. Sem ele, atrás de um proxy, todas as requisições parecem vir do proxy e dividem o mesmo limite. Só ative com um proxy de fato, porque o cabeçalho pode ser forjado por quem acessa a aplicação diretamente |
| `THROTTLE_TTL` | `60000` | Janela do limite de requisições por IP, em milissegundos |
| `THROTTLE_LIMIT` | `100` | Requisições permitidas por IP dentro da janela. O login tem um limite próprio, de 5 por minuto. Com mais de um processo no PM2, cada um conta separadamente, então o limite efetivo é multiplicado pelo número de processos |

## Processos e containers

| Variável | Padrão | Descrição |
|---|---|---|
| `DEBUG_PORT` | `9229` | Desenvolvimento: porta do debugger do Node.js na máquina |
| `PM2_INSTANCES` | `1` | Produção: número de processos da API no cluster do PM2, um número ou `max` (um por núcleo de CPU). O worker sempre roda em um único processo |
| `CPU_LIMIT` | `1` | Produção: limite de CPU do container da aplicação |
| `MEMORY_LIMIT` | `1g` | Produção: limite de memória do container da aplicação. Cada processo do PM2 é reiniciado ao passar de 512MB |

## Autenticação (JWT RS256)

| Variável | Padrão | Descrição |
|---|---|---|
| `JWT_PRIVATE_KEY` | obrigatória | Chave privada RSA (no mínimo 2048 bits), em PEM codificado em base64 numa única linha. Assina os tokens. O `setup.sh` gera o par; para gerar manualmente, veja o [guia de produção](PRODUCAO.md#antes-do-deploy) |
| `JWT_PUBLIC_KEY` | obrigatória | Chave pública do mesmo par, no mesmo formato. Valida os tokens e é publicada em `/.well-known/jwks.json` para outros serviços. A aplicação não sobe se ela não corresponder à chave privada. Trocar o par invalida todos os tokens emitidos |
| `JWT_ISSUER` | `dota-metrics` | Emissor (`iss`) gravado nos tokens e exigido na validação. Trocar invalida os tokens emitidos |
| `JWT_AUDIENCE` | `dota-metrics` | Público (`aud`) gravado nos tokens e exigido na validação. Trocar invalida os tokens emitidos |
| `JWT_EXPIRES_IN` | `900` | Validade do access token, em segundos (15 minutos). Mantenha curta: o cliente renova a sessão com o refresh token |
| `JWT_REFRESH_EXPIRES_IN` | `604800` | Validade do refresh token, em segundos (7 dias) |

## Observabilidade

| Variável | Padrão | Descrição |
|---|---|---|
| `OBSERVE_APP_KEY` | vazio | Chave do [@nestjs/observe](https://observe.nestjs.com), que envia traces, erros e logs. A observabilidade só é ativada com a chave e o segredo preenchidos; enquanto estiverem vazios, nenhum dado sai da aplicação |
| `OBSERVE_APP_SECRET` | vazio | Segredo do @nestjs/observe |
| `OBSERVE_SERVICE_ID` | `dota-metrics` | Nome deste serviço no painel do @nestjs/observe |

## API do OpenDota

Sem chave de API, o OpenDota permite 60 requisições por minuto e 3.000 por dia, contadas por IP e divididas entre o worker e o backfill. Veja [Coleta e estatísticas](../README.md#coleta-e-estatísticas) no README.

| Variável | Padrão | Descrição |
|---|---|---|
| `OPENDOTA_API_URL` | `https://api.opendota.com/api` | Endereço da API |
| `OPENDOTA_API_KEY` | vazio | Chave de API (plano pago do OpenDota), com limites maiores. Opcional |
| `OPENDOTA_REQUEST_INTERVAL_MS` | `1100` | Intervalo mínimo entre duas requisições do mesmo processo, em milissegundos; `1100` fica um pouco abaixo de 60 por minuto. Além disso, o cliente espera um minuto quando a API informa 10 requisições ou menos restantes no minuto, ou recusa uma requisição (429) |
| `OPENDOTA_DAILY_RESERVE` | `150` | Requisições do dia guardadas para as listas de partidas. A busca de detalhes para quando as requisições restantes chegam a esse valor, e o backfill usa no máximo metade do que sobra acima dele |

## Coleta de partidas (worker)

| Variável | Padrão | Descrição |
|---|---|---|
| `MATCH_RETENTION_DAYS` | `30` | Dias de partidas mantidos no banco. As mais antigas são apagadas diariamente às 4h. Também é o período máximo do `./setup.sh backfill` |
| `PRO_MATCHES_INTERVAL_MINUTES` | `15` | Minutos entre as consultas das partidas profissionais mais recentes. Cada consulta custa uma requisição e traz até 100 partidas |
| `PUBLIC_MATCHES_INTERVAL_MINUTES` | `5` | Minutos entre as consultas das partidas públicas mais recentes. Cada consulta custa uma requisição e traz até 100 partidas; com `5`, são 288 requisições por dia |
| `PUBLIC_MIN_RANK_TIER` | `70` | Rank médio mínimo das partidas públicas, de `10` a `80`. A dezena é a medalha (1 Herald, 2 Guardian, 3 Crusader, 4 Archon, 5 Legend, 6 Ancient, 7 Divine, 8 Immortal) e a unidade, as estrelas. Valores menores trazem mais partidas, mas menos representativas do meta de alto nível. Vale também para o backfill |
| `DETAILS_PER_MINUTE` | `30` | Máximo de detalhes de partidas (itens e ordem de compra) buscados por minuto, uma requisição cada. O worker distribui a cota do dia até a meia-noite (UTC) e nunca passa desse valor |
| `STATS_INTERVAL_MINUTES` | `15` | Minutos entre os recálculos das estatísticas do patch atual, as que a API e o Metabase mostram |

## Banco de dados (PostgreSQL)

| Variável | Padrão | Descrição |
|---|---|---|
| `POSTGRES_USER` | `dota` | Usuário do container do PostgreSQL, com acesso total ao banco. É usado pela aplicação e pelo Metabase para guardar os próprios dados |
| `POSTGRES_PASSWORD` | gerada | Senha do usuário. O `setup.sh` gera uma senha aleatória ao criar o `.env` |
| `POSTGRES_DB` | `dota_metrics` | Nome do banco da aplicação. Os testes usam bancos próprios, com este nome mais o projeto de testes (por exemplo `dota_metrics_e2e`) |
| `DATABASE_URL` | gerada | Conexão usada pela aplicação e pelo Prisma: `postgresql://usuario:senha@postgres:5432/banco`, com o mesmo usuário, senha e banco acima (`postgres` é o serviço do Docker Compose). Gerada pelo `setup.sh` |
| `POSTGRES_PORT` | `5432` | Desenvolvimento: porta do PostgreSQL na máquina, para clientes de banco como DBeaver ou psql. Em produção, o banco não fica exposto |
| `POSTGRES_CPU_LIMIT` | `1` | Produção: limite de CPU do container do PostgreSQL |
| `POSTGRES_MEMORY_LIMIT` | `1g` | Produção: limite de memória do container do PostgreSQL |

> **As credenciais valem a partir da criação do banco.** O PostgreSQL é criado com `POSTGRES_USER`, `POSTGRES_PASSWORD` e `POSTGRES_DB` na primeira vez que sobe, e os dados ficam no volume `postgres-data`. Alterar essas variáveis depois não muda o usuário existente: para trocar a senha, execute `ALTER USER` no banco e atualize `POSTGRES_PASSWORD` e `DATABASE_URL` juntas.

## Metabase (desenvolvimento)

Usadas pelo `./setup.sh metabase`. Veja [Metabase](DESENVOLVIMENTO.md#metabase) no guia de desenvolvimento.

| Variável | Padrão | Descrição |
|---|---|---|
| `METABASE_PORT` | `3001` | Porta do Metabase na máquina |
| `METABASE_ADMIN_EMAIL` | gerado | E-mail do administrador do Metabase, criado na primeira execução (`admin@dota-metrics.local`) |
| `METABASE_ADMIN_PASSWORD` | gerada | Senha do administrador. Nas execuções seguintes, o comando entra no Metabase com esse e-mail e essa senha; para trocar a senha, altere no Metabase e aqui |
| `METABASE_READER_PASSWORD` | gerada | Senha do `metabase_reader`, o usuário somente leitura que o Metabase usa para consultar o banco. Ao executar o comando de novo, um valor novo é aplicado ao usuário e à conexão do Metabase |

## Variáveis definidas fora do `.env`

Não precisam ser configuradas: as imagens e o PM2 as definem.

| Variável | Onde | Descrição |
|---|---|---|
| `NODE_ENV` | `docker/Dockerfile` e `ecosystem.config.cjs` | `production` na imagem de produção |
| `TZ` | Dockerfiles e ecosystems do PM2 | Fuso horário `America/Sao_Paulo`, usado nos logs e nos horários das tarefas diárias |
| `OBSERVE_SERVICE_VERSION` | `docker/Dockerfile` | Commit da imagem, informado como versão ao @nestjs/observe |
| `PRISMA_HIDE_UPDATE_MESSAGE` | Dockerfiles | Esconde o aviso de atualização do Prisma |
