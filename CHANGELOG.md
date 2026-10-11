# Changelog

As mudanças de cada versão deste projeto base. O formato segue o [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/), e as versões seguem o [Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [1.0.0] - 2026-10-11

Primeira versão estável do projeto base, pronta para iniciar novos projetos.

### Plataforma

- NestJS 12 com Express 5, em ESM, e TypeScript 6 em modo strict.
- Node.js 26, com as imagens Docker fixadas por digest.
- Testes com Vitest 5 e Supertest.

### Autenticação e autorização

- JWT assinado com RS256 (chave privada só neste serviço), com as claims `sub`, `iss`, `aud` e `token_use`.
- Refresh token e rota de renovação (`POST /api/v1/auth/refresh`).
- Chave pública publicada em `/.well-known/jwks.json` (JWKS), para outros serviços validarem os tokens sem segredo compartilhado.
- Decorator `@Authorize()` para proteger rotas e controllers, com controle por roles.
- Limites de login: 5 tentativas por minuto por IP e bloqueio do usuário após 10 senhas erradas (só as falhas contam).

### API

- Rotas versionadas em `/api/v1`.
- Validação de corpo, query e parâmetros com schemas Zod, que também geram a documentação do Swagger.
- Formato padrão para todas as respostas de erro.
- Swagger em `/doc`, com a autenticação bearer documentada.
- Health check em `/health`.
- Página inicial com a versão da aplicação.

### Segurança

- Cabeçalhos de segurança com o helmet, CORS configurável e limite de requisições por IP.
- Variáveis de ambiente validadas na inicialização; a aplicação não sobe com configuração inválida.
- Usuários de demonstração desativados em produção.
- Container de produção sem root, sem capabilities, com limites de CPU e memória, e sem o npm.

### Observabilidade

- Logs com nível configurável, em JSON em produção.
- ID de requisição (`X-Request-Id`) em todos os logs e repassado nas chamadas a outros serviços.
- Integração opcional com o `@nestjs/observe`, desligada por padrão.

### Infraestrutura

- Docker com PM2 (cluster em produção), rotação de logs e encerramento gracioso.
- `setup.sh` para instalar e operar os ambientes, também executável em container.
- `./setup.sh rename` para criar um projeto novo a partir desta base.
- Dev Container para o VS Code.
- CI no GitHub Actions: lint, formatação, shellcheck, build, testes com meta de cobertura, auditoria, scan da imagem com o Trivy e publicação no GitHub Container Registry.
- Dependabot com regras para as atualizações que exigem decisão (TypeScript e Node.js).

### Documentação

- README com a explicação do sistema e guias separados para desenvolvimento e produção.

[1.0.0]: https://github.com/baymabruno/nestjs-base-project/releases/tag/v1.0.0
