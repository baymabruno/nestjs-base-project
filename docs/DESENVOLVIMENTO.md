# Ambiente de desenvolvimento

Guia para subir e usar o ambiente de desenvolvimento. Para entender a arquitetura, a autenticação e as demais partes do sistema, veja o [README](../README.md). Para o ambiente de produção, veja o [guia de produção](PRODUCAO.md).

## Requisitos

- Docker e Docker Compose
- openssl, para o `setup.sh` gerar as chaves do JWT (dispensável ao executar o setup em um container)

## Subindo o ambiente

```bash
./setup.sh install dev
```

O `install` verifica os requisitos, cria o `.env` a partir do `.env.example` (com um par de chaves RSA novo para o JWT) quando ele não existe, gera a imagem, sobe o container e aguarda o `/health` responder. Também copia o `node_modules` do container para a pasta do projeto, para o editor reconhecer as dependências.

Se o `.env` já existir sem as chaves do JWT (por exemplo, criado antes da troca para RS256), o `install` gera as chaves e remove a variável antiga `JWT_KEY`.

| Comando | Descrição |
|---|---|
| `./setup.sh install [dev\|prod]` | Configura, gera a imagem e sobe |
| `./setup.sh start [dev\|prod]` | Sobe sem gerar a imagem novamente |
| `./setup.sh stop [dev\|prod]` | Para e remove o container |
| `./setup.sh restart [dev\|prod]` | Reinicia o container |
| `./setup.sh logs [dev\|prod]` | Acompanha os logs |
| `./setup.sh status [dev\|prod]` | Status do container e do PM2 |

O ambiente padrão é `dev`, então `./setup.sh install` equivale a `./setup.sh install dev`.

### Sem bash ou openssl: setup em container

Para não precisar instalar nada além do Docker (sem bash ou openssl na máquina), execute o `setup.sh` dentro de um container com o `docker-compose.setup.yml`. Execute a partir da raiz do projeto:

```bash
docker-compose -f docker-compose.setup.yml run --rm setup install dev
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

### Subindo manualmente com o Docker Compose

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

## Endereços

| Endereço | Descrição |
|---|---|
| http://localhost:3000/doc | Swagger (com `SWAGGER="true"`, o padrão em desenvolvimento) |
| http://localhost:3000/health | Health check |
| `localhost:9229` | Debugger do Node.js (porta definida em `DEBUG_PORT`) |

A porta da aplicação é a do `PORT` no `.env`. A descrição das variáveis comuns aos ambientes está na seção [Configuração](../README.md#configuração) do README. Variável específica do desenvolvimento:

| Variável | Descrição |
|---|---|
| `DEBUG_PORT` | Porta do debugger na máquina (padrão `9229`) |

Em desenvolvimento, o `.env` de exemplo já vem com `SWAGGER="true"` e `LOG_LEVEL="debug"`, e os usuários de demonstração ficam disponíveis (veja [Usuários de demonstração e senhas](#usuários-de-demonstração-e-senhas)).

## Dev Container (VS Code)

Com a extensão Dev Containers, o VS Code pode rodar dentro do container de desenvolvimento, usando o `node_modules` dele. Assim, não é preciso copiar o `node_modules` para a máquina, e o editor usa exatamente as mesmas dependências da aplicação. Com o projeto aberto, execute o comando **Dev Containers: Reopen in Container**. A configuração está em `.devcontainer/devcontainer.json` e já instala as extensões de ESLint, Prettier e Vitest.

## Debugger

A aplicação sobe com o debugger do Node.js aberto na porta `9229` (ou `DEBUG_PORT`). No VS Code, crie o arquivo `.vscode/launch.json` com uma configuração para se conectar a ele:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "attach",
      "name": "Docker: attach",
      "address": "localhost",
      "port": 9229,
      "localRoot": "${workspaceFolder}",
      "remoteRoot": "/var/www/html",
      "restart": true
    }
  ]
}
```

Depois, inicie o debug com **Docker: attach**. O `restart: true` reconecta o debugger a cada reload da aplicação.

## Logs

Logs da aplicação:

```bash
./setup.sh logs dev
```

Os logs também são gravados em `logs/api.log`, na pasta do projeto. Em desenvolvimento, eles saem em texto colorido e no nível definido em `LOG_LEVEL` (`debug` no `.env` de exemplo).

## Testando a autenticação


Os exemplos usam o ambiente de desenvolvimento em `http://localhost:3000` e o usuário de demonstração `bayma` (senha `teste`), disponível fora de produção. O usuário `maria` (role `gest`) também existe, para testar o acesso negado.

1. Faça login:

```bash
curl -X POST http://localhost:3000/api/v1/auth/login -H 'Content-Type: application/json' -d '{"username":"bayma","password":"teste"}'
```

A resposta traz os dois tokens:

```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIs...",
  "refresh_token": "eyJhbGciOiJSUzI1NiIs...",
  "token_type": "Bearer",
  "expires_in": 900
}
```

2. Acesse uma rota protegida enviando o `access_token` (substitua `<access_token>` pelo valor recebido):

```bash
curl http://localhost:3000/api/v1/auth/profile -H 'Authorization: Bearer <access_token>'
```

3. Quando o access token expirar, troque o `refresh_token` por um novo par de tokens:

```bash
curl -X POST http://localhost:3000/api/v1/auth/refresh -H 'Content-Type: application/json' -d '{"refresh_token":"<refresh_token>"}'
```

A resposta tem o mesmo formato do login. Use os tokens novos dali em diante.

4. Para conferir a chave pública que valida os tokens:

```bash
curl http://localhost:3000/.well-known/jwks.json
```

Respostas de erro:

| Status | Quando acontece |
|---|---|
| `400` | Corpo inválido (campo faltando ou campo a mais) |
| `401` | Usuário ou senha inválidos; token ausente, inválido ou expirado; refresh token usado como access token, ou o contrário |
| `403` | Token válido, mas o usuário não tem a role exigida pela rota |
| `429` | Limite de login atingido: 5 tentativas por minuto do mesmo IP, ou 10 senhas erradas para o mesmo usuário (bloqueio de até 15 minutos; um login correto zera a contagem) |

## Usuários de demonstração e senhas

Fora de produção, os usuários `bayma` (role `admin`) e `maria` (role `gest`) estão disponíveis com a senha `teste`. Eles ficam em `src/users/users.service.ts`.

Para gerar o hash bcrypt de uma senha (com o ambiente rodando):

```bash
docker-compose --file docker-compose.dev.yml exec node node -e "console.log(require('bcrypt').hashSync('senha', 10))"
```

## Criando um novo módulo

Os módulos são gerados com a CLI do Nest, dentro do container. Gere o módulo:

```bash
docker-compose --file docker-compose.dev.yml exec node npx nest g module products
```

Gere o controller:

```bash
docker-compose --file docker-compose.dev.yml exec node npx nest g controller products
```

Gere o service:

```bash
docker-compose --file docker-compose.dev.yml exec node npx nest g service products
```

A CLI cria os arquivos em `src/products/` (com os testes `.spec.ts`), usa os imports com `.js` exigidos pelo ESM e registra o módulo no `AppModule`. As rotas do controller ficam automaticamente em `/api/v1/products`.

> O `nest g resource` também funciona, mas gera DTOs em classes sem validação. Como este projeto valida com schemas Zod, um corpo declarado com essas classes **não é validado**. Troque os DTOs por schemas, como abaixo.

Em seguida, siga o padrão do projeto (o módulo `src/authorization` serve de referência):

1. **Schemas:** crie `src/products/schemas/products.schemas.ts` com os schemas Zod do corpo e da resposta. Use `z.strictObject` para rejeitar campos a mais e `.meta({ id: 'Nome' })` para nomear o schema no Swagger.
2. **Validação:** no controller, informe o schema no parâmetro, por exemplo `@Body({ schema: createProductSchema })`. Para documentar a resposta, use `@ApiOkResponse({ standardSchema: productSchema })`.
3. **Proteção:** use `@Authorize()` para exigir login, ou `@Authorize(Role.Admin)` para exigir uma role (veja [Autenticação e autorização](../README.md#autenticação-e-autorização-jwt) no README).
4. **Logs:** use `new Logger(NomeDaClasse.name)`; o ID da requisição entra automaticamente em cada log.
5. **Testes:** complete os `.spec.ts` gerados (o Vitest já está configurado, com `describe`, `it`, `expect` e `vi` globais) e crie os testes de rota em `test/products.e2e-spec.ts`. Use o `createTestApp()` de `test/support/app.ts`, que monta a aplicação igual ao `main.ts` (veja `test/auth.e2e-spec.ts` como exemplo).

Exemplo de schema e rota:

```ts
export const createProductSchema = z
  .strictObject({
    name: z.string().min(1).max(100),
    price: z.number().positive(),
  })
  .meta({ id: 'CreateProduct' });

@Post()
@Authorize(Role.Admin)
create(@Body({ schema: createProductSchema }) body: z.infer<typeof createProductSchema>) {
  return this.productsService.create(body);
}
```

Em Linux, os arquivos criados pelo container ficam com o dono `root`. Para evitar isso, gere os arquivos pelo terminal do [Dev Container](#dev-container-vs-code), ou ajuste o dono depois com `sudo chown -R $USER src`.

## Testes e qualidade

Os testes usam o [Vitest](https://vitest.dev). Todos os comandos rodam dentro do container de desenvolvimento, que precisa estar no ar (`./setup.sh install dev` ou `./setup.sh start dev`).

Testes unitários:

```bash
docker-compose --file docker-compose.dev.yml exec node npm run test
```

Testes e2e:

```bash
docker-compose --file docker-compose.dev.yml exec node npm run test:e2e
```

Testes unitários e e2e com cobertura:

```bash
docker-compose --file docker-compose.dev.yml exec node npm run test:cov
```

O `test:cov` falha se a cobertura ficar abaixo de 90% (linhas, instruções e funções) ou de 80% (branches). As metas estão em `vitest.config.ts`, e o relatório fica na pasta `coverage`.

Lint (corrige automaticamente o que for possível):

```bash
docker-compose --file docker-compose.dev.yml exec node npm run lint
```

Formatação com o Prettier:

```bash
docker-compose --file docker-compose.dev.yml exec node npm run format
```

## Solução de problemas

**O VS Code mostra erros como "Cannot find type definition file for 'vitest/globals'" ou "Cannot find module".** O `node_modules` da pasta do projeto está desatualizado. Atualize com:

```bash
./setup.sh install dev
```

Depois, no VS Code, execute **TypeScript: Restart TS Server** (Cmd+Shift+P). Se o erro continuar, execute **TypeScript: Select TypeScript Version** e escolha **Use Workspace Version**. O Dev Container evita esse problema.

**Uma dependência nova não é encontrada pela aplicação.** O container ainda usa o `node_modules` antigo. Recrie com o `-V`:

```bash
docker-compose --file docker-compose.dev.yml up -d --build -V
```

**"port is already allocated" ao subir o ambiente.** Outra aplicação já usa a porta. Altere `PORT` ou `DEBUG_PORT` no `.env` e suba de novo.

**A aplicação não sobe e o log mostra "Config validation error".** Alguma variável do `.env` está faltando ou é inválida; a mensagem indica qual. Compare com o `.env.example`.
