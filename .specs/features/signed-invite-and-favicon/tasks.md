# Signed Invite URL, Group PIN Removal, Favicon & Portainer CE Deploy — Tasks

**Feature**: `signed-invite-and-favicon`
**Spec**: `.specs/features/signed-invite-and-favicon/spec.md`
**Status**: Completed

---

## Backend (`backend/`)

- [x] **B1 — Domínio (`com.secretsanta.domain..`)**:
  - [x] Criar Value Object `InviteSignature` (Java puro, validação não-vazio/formato seguro e `matchesConstantTime(String candidate)` via `MessageDigest.isEqual`).
  - [x] Criar `InvalidInviteSignatureException` em `com.secretsanta.domain.exception` e remover `InvalidGroupPinException` (se não mais utilizada).
  - [x] Atualizar `SecretSantaGroup` removendo `PinHash groupPinHash` e `updateGroupPinHash(...)`, adicionando `InviteSignature inviteSignature`, atualizando `create(...)` / `reconstitute(...)` e adicionando `rotateInviteSignature(InviteSignature newSignature)`.
  - [x] Atualizar testes unitários de domínio (`SecretSantaGroupTest`, `ValueObjectsTest`).
- [x] **B2 — Persistência MongoDB (`infrastructure.persistence`)**:
  - [x] Atualizar `SecretSantaGroupDocument` removendo `groupPinHash` e adicionando `inviteSignature`.
  - [x] Atualizar `MongoSecretSantaGroupAdapter` (`toDocument` e `toDomain`) e `MongoPersistenceAdaptersIT`.
- [x] **B3 — Aplicação (`com.secretsanta.application`)**:
  - [x] Criar `InviteSignatureService` (ou método dedicado em `StatelessSessionTokenService`) gerando HMAC-SHA256 com nonce aleatório (`SecureRandom`) em Base64 URL-safe sem padding.
  - [x] Atualizar `SecretSantaApplicationService`:
    - [x] `createGroup(UUID organizerUserId, String eventName)` sem `rawGroupPin`, gerando `UUID` + `InviteSignature` e retornando `AdminGroupView` com `sharePath: "/g/" + id + "?sig=" + inviteSignature`.
    - [x] `getPublicGroup(UUID groupId, UUID currentUserId, String inviteSignature)` retornando `inviteValid` (`true` se `isOrganizer`, `joined` ou assinatura válida; `false` caso contrário), sem expor `inviteSignature` nem alterar `participantsVisible`.
    - [x] `registerParticipant` / `registerVisitorAndJoinGroup` exigindo `inviteSignature` compatível com o persistido no banco (`403 INVALID_INVITE_SIGNATURE`) para não-organizadores, validando grupo + assinatura **antes** de criar nova conta de visitante.
    - [x] Adicionar `rotateInviteSignature(UUID groupId, UUID requesterUserId)` validando organizador e retornando `AdminGroupView` atualizado.
    - [x] Remover `updateGroupPin(...)`.
  - [x] Atualizar `SecretSantaApplicationServiceIT`.
- [x] **B4 — Web & Exceções (`com.secretsanta.web`)**:
  - [x] Mapear `InvalidInviteSignatureException` para `403 Forbidden` (`INVALID_INVITE_SIGNATURE`) no `GlobalExceptionHandler` e atualizar `GlobalExceptionHandlerTest`.
  - [x] Atualizar `GroupPublicController` (`GET /api/v1/groups/{groupId}` aceitando `@RequestParam(value = "sig", required = false)` e `JoinGroupRequest` com `inviteSignature` no lugar de `groupPin`).
  - [x] Atualizar `GroupAdminController`: remover `groupPin` de `CreateGroupRequest`, remover `PUT /api/v1/groups/{groupId}/admin/pin` e adicionar `POST /api/v1/groups/{groupId}/admin/invite-link/rotate`.
  - [x] Atualizar `GroupPublicControllerIT` e `GroupAdminAndAuthControllerIT`.
  - [x] Garantir 100% de aprovação em `cd backend && mvn test` (incluindo `CleanArchitectureTest` ArchUnit).

## Frontend (`frontend/`)

- [x] **F1 — Favicon Natalino (`frontend/`)**:
  - [x] Gerar `frontend/src/favicon.ico` (multi-resolução 16x16 / 32x32) e `frontend/src/favicon.svg` alinhados à paleta festiva do aplicativo (`#14532D`, `#991B1B`, `#D97706`).
  - [x] Registrar `"src/favicon.ico"` e `"src/favicon.svg"` em `assets` no `frontend/angular.json`.
  - [x] Adicionar `<link rel="icon" type="image/x-icon" href="favicon.ico">` e `<link rel="icon" type="image/svg+xml" href="favicon.svg">` em `frontend/src/index.html`.
- [x] **F2 — Modelos, API e Serviço de Compartilhamento**:
  - [x] Atualizar `secret-santa-api.models.ts` e `secret-santa-api.service.ts`: remover `groupPin` e `UpdateGroupPinRequest`, adicionar `inviteValid` em `PublicGroupView`, `inviteSignature` em `JoinGroupRequest`, query param `sig` em `getPublicGroup(groupId, sig)` e método `rotateInviteLink(groupId)`.
  - [x] Atualizar `ShareLinkService`:
    - [x] `shareLink(...)`: no mobile (`navigator.share`) compartilha `{ title, text, url }`; no desktop/fallback copia `${text}\n${fullUrl}` para a área de transferência e abre `https://wa.me/?text=${encodeURIComponent(fullMessage)}` em nova aba (`_blank`, `noopener,noreferrer`).
    - [x] `copyUrl(pathOrUrl)`: copia apenas `fullUrl` para a área de transferência.
  - [x] Atualizar `secret-santa-api.service.spec.ts` (e criar/atualizar spec do `ShareLinkService`).
- [x] **F3 — Modal `"Novo Amigo Secreto"` (`HomeGroupsPageComponent`)**:
  - [x] Remover campo `groupPin`, sinal `showGroupPin` e validações de PIN do grupo em `HomeGroupsPageComponent`.
  - [x] Atualizar `home-groups-page.component.spec.ts`.
- [x] **F4 — Página do Grupo (`/g/:groupId`) (`PublicGroupPageComponent`)**:
  - [x] Ler query param `sig` da rota e enviá-lo em `getPublicGroup` e `joinGroup` (`inviteSignature`).
  - [x] Remover todos os campos e validações de `groupPin` (`visitorLoginForm`, `visitorRegisterForm`, `authenticatedGroupPinControl`).
  - [x] Quando `status === 'OPEN'`, `!g.joined`, `!g.organizer` e `!g.inviteValid`: ocultar formulários de entrada e exibir aviso claro (`data-testid="invalid-invite-notice"`).
  - [x] Manter `"Consultar Quem Eu Tirei"` acessível normalmente quando `status === 'DRAWN'`.
  - [x] Atualizar `public-group-page.component.spec.ts`.
- [x] **F5 — Painel do Organizador (`/g/:groupId/admin`) (`AdminDashboardPageComponent`)**:
  - [x] Remover a seção `"Alterar PIN do Grupo"` e `updateGroupPinForm`.
  - [x] Atualizar botão `"Convidar pelo WhatsApp"` para enviar `text: 'Participe do grupo de amigo secreto "' + g.eventName + '" clicando no link abaixo:'` com `g.sharePath` (`/g/${g.id}?sig=...`).
  - [x] Atualizar botão `"Copiar"` para chamar `shareService.copyUrl(...)` copiando apenas a URL assinada completa.
  - [x] Adicionar botão `"Gerar Novo Link de Convite"` (`data-testid="rotate-invite-link-btn"`) chamando `rotateInviteLink(groupId)` com feedback claro de invalidação do link anterior.
  - [x] Atualizar `admin-dashboard-page.component.spec.ts` e garantir 100% em `cd frontend && npm test` e `cd frontend && npm run build`.

## CI/CD Portainer CE (`.github/workflows/`)

- [x] **C1 — Workflow GitHub Actions para Portainer CE**:
  - [x] Criar `.github/workflows/deploy-backend.yml` com trigger em `push` para `main` (`backend/**`, `docker-compose.prod.yml`) e `workflow_dispatch`.
  - [x] Executar `mvn test` em `backend/` (Java 25).
  - [x] Consultar `GET ${PORTAINER_URL}/api/stacks/${PORTAINER_STACK_ID}` com `X-API-Key`, preservar `Env` existente e disparar `PUT ${PORTAINER_URL}/api/stacks/${PORTAINER_STACK_ID}/git/redeploy?endpointId=${PORTAINER_ENDPOINT_ID}` (SSL válido, `pullImage: true`, `prune: true`, `refs/heads/main`, suporte opcional a credenciais Git se privado).

## Verificação Ponta a Ponta & Finalização

- [x] **V1 — Testes Automatizados**:
  - [x] `cd backend && mvn test` (100% pass).
  - [x] `cd frontend && npm test` (100% pass).
  - [x] `cd frontend && npm run build` (100% pass + verificar `favicon.ico` na pasta `dist/`).
- [x] **V2 — E2E Real via Playwright (Desktop e Mobile)**:
  - [x] Subir MongoDB (`docker compose up -d`), Backend (`mvn spring-boot:run`) e Frontend (`npm start`).
  - [x] Validar via Playwright: carregamento do `favicon.ico` (HTTP 200), criação de grupo sem PIN, bloqueio de entrada sem `?sig=` válido (`invalid-invite-notice`), entrada via URL assinada `/g/{id}?sig=...`, texto exato de compartilhamento/cópia no Admin, rotação de link invalidando assinatura antiga, sorteio e revelação efêmera.
- [x] **V3 — Documentação**:
  - [x] Atualizar `.specs/STATE.md` (`AD-008` + Handoff) e marcar todas as tasks em `.specs/features/signed-invite-and-favicon/tasks.md`.
  - [ ] Solicitar aprovação explícita do usuário antes de `git commit` e `git push`.
