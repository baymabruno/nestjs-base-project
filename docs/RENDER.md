# Ambiente no Render

Guia para subir o sistema completo no [Render](https://render.com) a partir do Blueprint `render.yaml`, na raiz do repositório. Para um servidor próprio com Docker Compose, veja o [guia de produção](PRODUCAO.md).

## O que é criado

| Recurso | Tipo e plano | O que faz |
|---|---|---|
| `dota-metrics-api` | Web service (Docker), `0.5c-512mb` | A API (`node dist/main.js`). Aplica as migrations antes de cada deploy (`prisma migrate deploy`) e responde ao health check em `/health` |
| `dota-metrics-worker` | Background worker (Docker), `0.5c-512mb` | A coleta (`node dist/worker.js`): partidas, detalhes, estatísticas, STRATZ e limpeza. Sempre um único processo, para não repetir requisições |
| `dota-metrics-web` | Web service (Docker), `free` | O site (Next.js). Chama a API pela rede privada do Render |
| `dota-metrics-db` | Postgres 18, `0.1c-256mb`, 5 GB | O banco, acessível só pelos serviços (rede privada) |

Todos ficam na região `virginia`, a mais próxima do Brasil entre as do Render.

**Por que esses planos.** No Render, um web service gratuito não recebe requisições da rede privada: a API precisa ser paga para o site conseguir chamá-la. Background workers não têm plano gratuito. O Postgres gratuito expira em 30 dias. O site pode ficar no gratuito, com uma ressalva: ele dorme depois de 15 minutos sem visitas e leva cerca de um minuto para acordar. Para não dormir, mude o `plan` do `dota-metrics-web` para `0.5c-512mb`. Os preços de cada plano estão em https://render.com/pricing.

**Sem PM2.** No Render, cada processo roda direto com o Node (o `dockerCommand` do Blueprint substitui o `CMD` da imagem, que usa o PM2 no Docker Compose). O Render reinicia o processo se ele cair, e os logs vão para o painel, em JSON.

## Antes de criar

1. **Gere o par de chaves RSA do JWT**, exclusivo deste ambiente (em qualquer máquina com openssl):
   ```bash
   openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out private.pem
   openssl pkey -in private.pem -pubout -out public.pem
   openssl base64 -A -in private.pem; echo   # valor de JWT_PRIVATE_KEY
   openssl base64 -A -in public.pem; echo    # valor de JWT_PUBLIC_KEY
   ```
   Guarde os dois valores e apague os arquivos `.pem` depois.
2. **Tenha um token do STRATZ** para este ambiente (gratuito em https://stratz.com/api, com login pela Steam). Sem ele, os dados por função, talentos e itens por função ficam indisponíveis.
3. **Confira o CI.** Os serviços só fazem deploy depois que os checks do GitHub passam no commit (`autoDeployTrigger: checksPass`).

## Criando o ambiente

1. No painel do Render, clique em **New > Blueprint** e conecte o repositório `baymabruno/nestjs-base-project`.
2. Escolha a branch do ambiente de teste (por exemplo, `feature/dota-metrics`). O Render lê o `render.yaml` dessa branch e faz o deploy a cada commit nela.
3. Preencha as variáveis que o Render pede (as marcadas com `sync: false` no Blueprint):
   - `dota-metrics-api`: `JWT_PRIVATE_KEY` e `JWT_PUBLIC_KEY`, gerados no passo anterior;
   - `dota-metrics-worker`: `STRATZ_API_TOKEN`.
4. Confirme. O Render cria o banco, o grupo de variáveis `dota-metrics-settings` e os três serviços. O primeiro build leva alguns minutos.

Quando os serviços ficarem verdes:

- o site fica em `https://dota-metrics-web.onrender.com/meta` (o Render pode acrescentar um sufixo ao nome se ele já existir; o endereço certo aparece no painel do serviço);
- a API fica em `https://dota-metrics-api.onrender.com`, com o health check em `/health`. O Swagger fica desligado (`SWAGGER="false"`).

Com o banco vazio, o worker carrega os heróis, itens e patches, depois as estatísticas do STRATZ, e começa a coletar as partidas. A página de meta mostra dados a partir do primeiro recálculo das estatísticas, alguns minutos depois.

## Carga de partidas passadas

O worker coleta só as partidas novas. Para carregar as públicas das últimas 24 horas e as profissionais do patch atual, abra o **Shell** do `dota-metrics-worker` no painel do Render (disponível nos planos pagos) e execute:

```bash
node dist/backfill.js
```

O comando usa no máximo metade da cota diária do OpenDota e avisa se o período ficou incompleto; nesse caso, execute de novo no dia seguinte. Os detalhes das partidas carregadas são buscados aos poucos pelo worker. Veja como ele funciona em [Coleta e estatísticas](../README.md#coleta-e-estatísticas) no README.

## Variáveis

As configurações compartilhadas pela API e pelo worker ficam no grupo `dota-metrics-settings` (`APP_ENVIRONMENT="production"`, `LOG_LEVEL` e `PUBLIC_WINDOW_HOURS`). As demais têm o padrão descrito em [Configuração](CONFIGURACAO.md) e podem ser acrescentadas no painel de cada serviço (por exemplo, `OPENDOTA_API_KEY` no worker).

Particularidades do Render:

- **`DATABASE_URL`** vem do banco (`fromDatabase`), pelo endereço interno.
- **`API_URL`** do site vem da API (`fromService`, no formato `host:porta`, sem `http://`); o site acrescenta o esquema.
- **`THROTTLE_LIMIT="1000"`** na API: todas as páginas do site chegam pelo mesmo cliente (o servidor do site), então o limite por IP precisa cobrir todas elas. O limite de 5 logins por minuto não muda.
- **As chaves JWT ficam só na API.** O worker e o backfill não emitem tokens e não exigem as chaves.
- **`APP_ENVIRONMENT="production"`** desativa os usuários de demonstração, cujas senhas estão no código, e deixa os logs em JSON. Mantenha assim mesmo num ambiente de teste, porque a API é pública.

Ao mudar uma variável no painel, o Render faz um novo deploy do serviço com o valor novo.

## Operação

- **Logs:** no painel de cada serviço, em **Logs**.
- **Migrations:** aplicadas pelo `preDeployCommand` da API e do worker antes de cada deploy (o `migrate deploy` usa um lock, então rodar nos dois é seguro). Se uma migration falhar, o deploy é cancelado e a versão anterior continua no ar.
- **Acesso ao banco:** o banco não aceita conexões de fora do Render (`ipAllowList: []`). Para consultar com um cliente (DBeaver, psql ou Metabase), acrescente o seu IP em **Access Control** no painel do banco e use a **External Database URL**; remova o IP depois.
- **Backups:** as opções de backup e recuperação dependem do plano do banco; veja em **Recovery** no painel dele. Os dados também podem ser coletados de novo do OpenDota e do STRATZ.
- **Deploy de uma parte só:** a API e o worker não fazem deploy por mudanças só em `web/` ou na documentação, e o site só faz deploy por mudanças em `web/` (`buildFilter`).

## O que não pode mudar depois

A região, o nome do banco, o usuário e a versão do PostgreSQL ficam fixos depois do primeiro deploy (`databases` no Blueprint). O tamanho do disco do banco só pode aumentar.
