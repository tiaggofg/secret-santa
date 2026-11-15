# Private Groups & UX Corrections Patch — Tasks

**Feature**: `private-groups-ux-patch`
**Spec**: `.specs/features/private-groups-ux-patch/spec.md`
**Status**: Done

---

## Backend (`backend/`)

- [x] **B1 — Domínio (`com.secretsanta.domain..`)**:
  - [x] Criar `InvalidGroupPinException` em `com.secretsanta.domain.exception`.
  - [x] Atualizar `SecretSantaGroup` para remover `GroupSlug` (usando `UUID id` como único identificador), adicionar `PinHash groupPinHash`, atualizar `create(...)` e `reconstitute(...)`, e adicionar `updateGroupPinHash(PinHash newGroupPinHash)`.
  - [x] Atualizar `SecretSantaGroupRepository` removendo `findByPublicSlug`/`existsByPublicSlug` e substituindo `findAllOrderByCreatedAtDesc()` por `findByUserParticipationOrOrganizationOrderByCreatedAtDesc(UUID userId)`.
  - [x] Remover `GroupSlug` (se não mais utilizado) e atualizar testes unitários de domínio (`SecretSantaGroupTest`, `ValueObjectsTest`).
- [x] **B2 — Persistência MongoDB (`infrastructure.persistence`)**:
  - [x] Atualizar `SecretSantaGroupDocument` adicionando `groupPinHash` e removendo `publicSlug`.
  - [x] Atualizar `SecretSantaIndexesChangeUnit` removendo índice único de `publicSlug` (com drop condicional caso exista) e criando índices em `organizerUserId` e `participants.userId`.
  - [x] Atualizar `SpringDataSecretSantaGroupMongoRepository` e `MongoSecretSantaGroupAdapter` com a query dedicada `@Query("{ '$or': [ { 'organizerUserId': ?0 }, { 'participants.userId': ?0 } ] }")`.
  - [x] Atualizar `MongoPersistenceAdaptersIT`.
- [x] **B3 — Aplicação (`SecretSantaApplicationService`)**:
  - [x] Atualizar `createGroup` para exigir `groupPin` (`^\d{4,6}$`), gerar hash BCrypt e retornar `AdminGroupView` com `id` e `sharePath: "/g/" + id`.
  - [x] Atualizar `listGroupsForUser` para retornar apenas `myGroups` (removendo `availableOpenGroups`).
  - [x] Atualizar `getPublicGroup(UUID groupId, UUID currentUserId)` para ocultar `participants` (`participantsVisible = false`, `participants = []`) quando `currentUserId` não for organizador nem participante inscrito.
  - [x] Atualizar `registerParticipant` para rotear por `UUID groupId`, dispensar `groupPin` se `group.isOrganizer(userId)`, exigir `groupPin` válido (`InvalidGroupPinException` -> `403 INVALID_GROUP_PIN`) caso contrário, e validar existência do grupo + `groupPin` antes de criar conta de visitante (evitando contas órfãs).
  - [x] Adicionar `updateGroupPin(UUID groupId, UUID requesterUserId, String newGroupPin)` validando organizador e formato `^\d{4,6}$`.
  - [x] Atualizar demais métodos (`revealDrawnParticipant`, `getAdminGroup`, `removeParticipant`, `draw`, `generateResetToken`) para rotear por `UUID groupId` e atualizar `GroupSummaryView`, `PublicGroupView`, `AdminGroupView`, `ParticipantRegistrationView` (`id` + `sharePath`, sem `slug`/`groupSlug`).
  - [x] Atualizar `SecretSantaApplicationServiceIT`.
- [x] **B4 — Web & Exceções (`com.secretsanta.web`)**:
  - [x] Mapear `InvalidGroupPinException` para `403 Forbidden` (`INVALID_GROUP_PIN`) no `GlobalExceptionHandler` e atualizar `GlobalExceptionHandlerTest`.
  - [x] Atualizar `GroupPublicController` e `GroupAdminController` para usar `{groupId}` (`UUID`, retornando `404` se UUID inválido), adicionar `PUT /api/v1/groups/{groupId}/admin/pin` e atualizar `CreateGroupRequest`, `JoinGroupRequest`, `UpdateGroupPinRequest`.
  - [x] Atualizar `GroupPublicControllerIT` e `GroupAdminAndAuthControllerIT`.
  - [x] Garantir 100% de aprovação em `cd backend && mvn test` (incluindo `CleanArchitectureTest`).

## Frontend (`frontend/`)

- [x] **F1 — Modelos, API e Rotas**:
  - [x] Atualizar `secret-santa-api.models.ts` e `secret-santa-api.service.ts` (rotas por `groupId`, remoção de `availableOpenGroups` e `slug`/`groupSlug`, adição de `participantsVisible`, `groupPin` em create/join e `updateGroupPin`).
  - [x] Atualizar `app.routes.ts` com `/cadastro`, `/g/:groupId`, `/g/:groupId/admin`.
  - [x] Atualizar `secret-santa-api.service.spec.ts`.
- [x] **F2 — Login Direto (`/`) e Cadastro Dedicado (`/cadastro`)**:
  - [x] Criar `RegisterPageComponent` (`/cadastro`) sem Hero, com campos Nome, Nome de usuário, PIN Numérico (4 a 6 dígitos), botão `"Concluir cadastro"` (`data-testid="register-submit"`) e link `"Já tem uma conta? Entrar"`.
  - [x] Atualizar `HomeGroupsPageComponent` (não autenticado): remover *tablist* de Login/Cadastro, remover as 3 tags do Hero mantendo a mensagem convidativa `"Entre para criar seu Amigo Secreto ou participar dos sorteios com a família e amigos!"`, e adicionar link `"Não tem uma conta? Clique aqui"` (`data-testid="go-to-register-link"`) apontando para `/cadastro`.
- [x] **F3 — Home Autenticada & Modal `"Novo Amigo Secreto"`**:
  - [x] Atualizar `HomeGroupsPageComponent` (autenticado): remover `availableOpenGroups`, atualizar botões para `"+ Novo Amigo Secreto"`, atualizar modal para `"Novo Amigo Secreto"` sem chips de dicas de nome, adicionar campo obrigatório `"PIN de Entrada do Grupo (4 a 6 dígitos)"` (`data-testid="group-pin-input"`) e botão `"Criar Amigo Secreto"` (`data-testid="create-group-submit"`).
  - [x] Atualizar links dos cards para `/g/:groupId` e `/g/:groupId/admin`.
  - [x] Atualizar `home-groups-page.component.spec.ts`.
- [x] **F4 — Página do Grupo (`/g/:groupId`)**:
  - [x] Atualizar `PublicGroupPageComponent`: roteamento por `:groupId`, contagem via `participantCount`, ocultação da lista quando `!participantsVisible`.
  - [x] Remover *tablist* para visitantes não autenticados: abrir no login com `PIN do grupo` (`data-testid="visitor-group-pin-input"`) e link `"Não tem uma conta? Clique aqui"` alternando inline para cadastro rápido com botão `"Continuar"` (`data-testid="visitor-register-join-btn"`).
  - [x] Para usuário autenticado `!joined`: saudação `"Olá, {{ authStore.name() }}. Toque abaixo para confirmar sua participação neste grupo:"` (sem `(@username)`), exigindo `PIN do grupo` (`data-testid="authenticated-group-pin-input"`) apenas quando `!g.organizer`.
  - [x] Remover botão `"Cadastrar outro familiar / Trocar de usuário neste aparelho"` e sua menção pós-inscrição.
  - [x] Manter formulário `"Consultar Quem Eu Tirei"` acessível no estado `DRAWN` mesmo com lista oculta.
  - [x] Atualizar `public-group-page.component.spec.ts`.
- [x] **F5 — Painel do Organizador (`/g/:groupId/admin`) e Revisão Global de Textos**:
  - [x] Atualizar `AdminDashboardPageComponent`: roteamento por `:groupId`, botão `"Convidar pelo WhatsApp"` (`data-testid="share-group-link-btn"`) com texto lembrando do PIN sem incluí-lo, exibição de `/g/${g.id}`, e seção `"Alterar PIN do Grupo"` com botão `"Salvar Novo PIN do Grupo"` (`data-testid="update-group-pin-btn"`).
  - [x] Varredura global em todos os componentes (`HomeGroupsPageComponent`, `RegisterPageComponent`, `PublicGroupPageComponent`, `AdminDashboardPageComponent`, `ResetPinPageComponent`, `EphemeralRevealModalComponent`) substituindo qualquer `"username"` / `"Username"` visível por `"nome de usuário"` / `"Nome de usuário"`.
  - [x] Atualizar `admin-dashboard-page.component.spec.ts` e `reset-pin-page.component.spec.ts`.
  - [x] Garantir 100% de aprovação em `cd frontend && npm test` e `cd frontend && npm run build`.

## Verificação Ponta a Ponta & Finalização

- [x] **V1 — Testes Automatizados**:
  - [x] `cd backend && mvn test` (100% pass).
  - [x] `cd frontend && npm test` (100% pass).
  - [x] `cd frontend && npm run build` (100% pass).
- [x] **V2 — E2E Real via Playwright (Desktop e Mobile)**:
  - [x] Subir MongoDB (`docker compose up -d` ou verificar se já está rodando), Backend (`mvn spring-boot:run`) e Frontend (`npm start`).
  - [x] Executar script Playwright cobrindo todos os fluxos críticos da spec em desktop e mobile, validando console e rede sem erros inesperados.
- [x] **V3 — Documentação**:
  - [x] Atualizar `.specs/STATE.md` e `.specs/features/private-groups-ux-patch/tasks.md`.
  - [x] Solicitar aprovação explícita do usuário antes de `git commit` e `git push`.
