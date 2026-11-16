# Rejoin Redirect Fix, Strong Password Policy & HttpOnly Session Refresh — Tasks

**Feature**: `rejoin-redirect-and-auth-security`  
**Spec**: `.specs/features/rejoin-redirect-and-auth-security/spec.md`  
**Status**: Approved (Ready for Implementation)

---

## Backend (`backend/`)

- [x] **B1 — Domínio (`com.secretsanta.domain..`)**:
  - [x] Criar `PasswordValidator` (Java puro) validando senha de 6 a 64 caracteres, sem whitespace, com >= 1 maiúscula, >= 1 minúscula, >= 1 dígito e >= 1 caractere especial.
  - [x] Criar entidade/Value Object `RefreshToken` e porta `RefreshTokenRepository` (`save`, `findByTokenHash`, `revokeFamily`, `revokeAllByUserId`).
  - [x] Criar exceção de aplicação/domínio adequada para distinguir `ALREADY_PARTICIPANT` (com suporte a carregar sessão autenticada no fluxo de login visitante) de `DuplicateUsernameException`.
  - [x] Adicionar testes unitários de domínio para `PasswordValidator` e `RefreshToken`.
- [x] **B2 — Persistência MongoDB (`infrastructure.persistence`)**:
  - [x] Criar `RefreshTokenDocument` (`refresh_tokens`), `SpringDataRefreshTokenMongoRepository` e `MongoRefreshTokenAdapter`.
  - [x] Atualizar `SecretSantaIndexesChangeUnit` com índices em `tokenHash` (único), `userId`, `familyId` e índice TTL em `expiresAt`.
  - [x] Garantir compatibilidade de leitura/escrita em `UserAccountDocument` com hashes BCrypt legados (`pinHash`).
  - [x] Atualizar/adicionar testes em `MongoPersistenceAdaptersIT`.
  - [x] **B3 — Aplicação (`com.secretsanta.application`)**:
  - [x] Atualizar `StatelessSessionTokenService` com TTL configurável para Access Token (`15 minutos` padrão).
  - [x] Implementar geração, validação, rotação em família, detecção de reuso e revogação de Refresh Token (`1 hora` padrão, hash SHA-256 + `SecureRandom` 32 bytes).
  - [x] Atualizar `SecretSantaApplicationService`:
    - [x] `registerUser` e `resetPasswordWithToken` (revogando refresh tokens ativos do usuário) usando `PasswordValidator`.
    - [x] `loginUser` e `revealMatch` validando `passwordEncoder.matches` (retrocompatível com hashes BCrypt legados).
    - [x] `getCurrentUser(UUID userId)` para `/api/v1/auth/me`.
    - [x] `registerVisitorAndJoinGroup`: quando login visitante autenticar com sucesso e `group.hasParticipantWithUserId(userId)` for `true`, emitir tokens de sessão junto à resposta `409 ALREADY_PARTICIPANT`.
  - [x] Atualizar `SecretSantaApplicationServiceIT`.
- [x] **B4 — Web, Cookies `HttpOnly`, CORS & Exceções (`com.secretsanta.web`)**:
  - [x] Criar `AuthCookieManager` (`ss_access_token` em `/api/v1`, `ss_refresh_token` em `/api/v1/auth`, `HttpOnly`, `SameSite`, `Secure` configuráveis em `application.yml`).
  - [x] Atualizar `AuthController`:
    - [x] `POST /api/v1/auth/register` e `POST /api/v1/auth/login` gravando cookies `HttpOnly` e retornando `AuthUserView` sem token no JSON.
    - [x] `POST /api/v1/auth/refresh`, `POST /api/v1/auth/logout` e `GET /api/v1/auth/me`.
    - [x] `POST /api/v1/auth/reset-password` (com alias `/api/v1/auth/reset-pin`) aceitando `newPassword` (com fallback `newPin`/`pin`).
  - [x] Atualizar `GroupPublicController` e `GroupAdminController` para ler `ss_access_token` exclusivamente do cookie `HttpOnly` (sem header `Authorization: Bearer`), tratando token expirado em `GET /groups/{groupId}` com `401`, aceitando `password` (com fallback `pin`) em `JoinGroupRequest` e `RevealMatchRequest`, e gravando cookies `HttpOnly` na resposta `409 ALREADY_PARTICIPANT` quando login visitante acertar a senha.
  - [x] Atualizar `GlobalExceptionHandler` para retornar `errorCode = "ALREADY_PARTICIPANT"` + metadados seguros do usuário em `409` quando aplicável, e atualizar `GlobalExceptionHandlerTest`.
  - [x] Atualizar `application.yml` (`server.forward-headers-strategy: native`, TTLs e propriedades opcionais de cookie) e `WebCorsConfig` com `allowCredentials(true)`.
  - [x] Atualizar `GroupAdminAndAuthControllerIT` e `GroupPublicControllerIT`, garantindo 100% de aprovação em `cd backend && mvn test` (incluindo `CleanArchitectureTest`).

## Frontend (`frontend/`)

- [x] **F1 — Sessão via Cookies `HttpOnly`, Refresh Interceptor & Bootstrap**:
  - [x] Atualizar `secret-santa-api.models.ts` e `secret-santa-api.service.ts` (`AuthUserView` sem `token`, métodos `me()`, `refresh()`, `logout()`, payloads com `password`/`newPassword` e `resetPassword`).
  - [x] Criar `AuthCredentialsInterceptor` (`withCredentials: true` + single-flight `401` → `/auth/refresh` → retry).
  - [x] Configurar `provideAppInitializer` em `app.config.ts` chamando `/auth/me` na inicialização para restaurar a sessão em `AuthSessionStore`.
  - [x] Atualizar `AuthSessionStore` (removendo `token` do estado em memória) e `HomeGroupsPageComponent.onSwitchFamilyUser()` para chamar `POST /api/v1/auth/logout`.
  - [x] Atualizar/adicionar testes unitários (`secret-santa-api.service.spec.ts`, spec do interceptor).
- [x] **F2 — Política de Senha Forte, Indicador Visual de Critérios e Substituição de "PIN" por "Senha" na UI**:
  - [x] Criar validador/helper compartilhado `password-policy.ts` (6–64 caracteres, sem espaços, >= 1 maiúscula, >= 1 minúscula, >= 1 número, >= 1 caractere especial) e componente reutilizável `PasswordCriteriaIndicatorComponent` com feedback visual em tempo real para cada requisito.
  - [x] Atualizar `HomeGroupsPageComponent` (login com senha sem restrição numérica + dica de redefinição via organizador).
  - [x] Atualizar `RegisterPageComponent` (`/cadastro`) com campo de senha forte + `PasswordCriteriaIndicatorComponent`.
  - [x] Atualizar `ResetPinPageComponent` (`/reset/:token`) para `"Criar Nova Senha"` com `PasswordCriteriaIndicatorComponent`.
  - [x] Atualizar `AdminDashboardPageComponent` (botão/mensagens `"Redefinir Senha"`).
  - [x] Atualizar specs (`home-groups-page.component.spec.ts`, `register-page.component.spec.ts`, `reset-pin-page.component.spec.ts`, `admin-dashboard-page.component.spec.ts` e spec do `PasswordCriteriaIndicatorComponent`).
- [x] **F3 — Correção do Re-ingresso no Grupo (`PublicGroupPageComponent`)**:
  - [x] Atualizar formulários (`visitorLoginForm`, `visitorRegisterForm`, `revealForm`) para usar `password` (login e revelação aceitando senha/PIN legado; cadastro rápido exigindo senha forte + `PasswordCriteriaIndicatorComponent`).
  - [x] Em `submitVisitorLoginAndJoin()`, ao receber `409` (`ALREADY_PARTICIPANT`), atualizar `AuthSessionStore`, limpar formulário, exibir `"Você já está inscrito neste grupo!"`, navegar para `/g/:groupId` sem `?sig=` (`replaceUrl: true`) e recarregar `loadPublicGroup()`.
  - [x] Em `joinWithCurrentAuthenticatedUser()`, tratar `409` limpando `?sig=` e recarregando `loadPublicGroup()`.
  - [x] Atualizar `public-group-page.component.spec.ts` e garantir 100% em `cd frontend && npm test` e `cd frontend && npm run build`.

## Verificação Ponta a Ponta & Documentação

- [x] **V1 — Testes Automatizados**:
  - [x] `cd backend && mvn test` (100% pass).
  - [x] `cd frontend && npm test` e `cd frontend && npm run build` (100% pass).
- [x] **V2 — E2E Real via Playwright (Desktop e Mobile)**:
  - [x] Cadastro com senha forte, reload mantendo sessão via cookie `HttpOnly` (sem tokens em `localStorage`/`sessionStorage`), expiração/refresh automático, logout via `"Trocar / Sair"`.
  - [x] Re-ingresso de usuário já participante pelo link `/g/{groupId}?sig=...` deslogado → `409` com cookies → redirect automático para `/g/{groupId}` já autenticado e inscrito.
  - [x] Sorteio, redefinição de senha via `/reset/:token` e revelação efêmera usando senha forte.
- [x] **V3 — Documentação**:
  - [x] Atualizar `README.md`, `docs/` (`api-rest.md`, `seguranca-e-privacidade.md`, `modelo-dominio-e-dados.md`, `fluxos-e-sequencias.md`, `arquitetura-c4.md`, `deploy-e-ci-cd.md`) e `.specs/STATE.md` antes do commit/push final.
