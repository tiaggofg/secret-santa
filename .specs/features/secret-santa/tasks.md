# Amigo Secreto Familiar Mobile-First Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, the walk, check_proofs, the Verifier and the screens sub-agent).

**If the skill cannot be activated, STOP and tell the user - do not proceed without it.**

---

**Design**: `.specs/features/secret-santa/design.md`
**Status**: In Progress
**Approved**: 2026-11-13 - user: "Está aprovado"
**Build**: `test ! -f backend/pom.xml || JAVA_HOME=/usr/lib/jvm/jdk-25.0.4.1+1 mvn -f backend/pom.xml test-compile; test ! -f frontend/package.json || npm --prefix frontend run build`
**Run backend**: `JAVA_HOME=/usr/lib/jvm/jdk-25.0.4.1+1 mvn -f backend/pom.xml test`
**Run frontend**: `npm --prefix frontend run test`

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec - confirm before Execute. Guidelines found: `.specs/STATE.md` (`AD-002`..`AD-001`), `.claude/skills/tactical-ddd/SKILL.md`, `.claude/skills/tlc-spec-driven/SKILL.md` (strong defaults applied).

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| Domain Model, Domain Services & Clean Architecture (`UserAccount`, `SecretSantaGroup`, `GeoCoordinates`, `Username`, `PinHash`, `PasswordResetTokenHash`, `HouseholdClusterService`, `DerangementDrawService`, `CleanArchitectureTest`) | unit | All branches; 1:1 to spec ACs; ArchUnit rules enforcing 100% pure domain; all listed edge cases (Haversine 50m, Union-Find transitivity, Hall condition `max_cluster <= N/2`, fallback, duplicate `username`, 4-6 digit numeric PIN, one-time reset token, `organizerUserId` guard, `< 3` participants) | `backend/src/test/java/com/secretsanta/domain/**/*Test.java` | `JAVA_HOME=/usr/lib/jvm/jdk-25.0.4.1+1 mvn -f backend/pom.xml test` |
| MongoDB Persistence & Application Services (`MongoUserAccountAdapter`, `MongoSecretSantaGroupAdapter`, `SecretSantaApplicationService`, `StatelessSessionTokenService`) | integration | Single-document Aggregate mapping (`users` & `secret_santa_groups`) + unique indexes on `username` and `publicSlug` + `@Version` optimistic locking concurrency + BCrypt verification + SHA-256 reset token lifecycle + `myGroups`/`availableGroups` discovery + secrecy invariants (via Testcontainers MongoDB / `mongo-java-server` fallback) | `backend/src/test/java/com/secretsanta/application/**/*IT.java` | `JAVA_HOME=/usr/lib/jvm/jdk-25.0.4.1+1 mvn -f backend/pom.xml test` |
| REST Controllers (`AuthController`, `GroupAdminController`, `GroupPublicController`, `GlobalExceptionHandler`) | integration | All routes in scope: happy path + every listed edge case + HTTP 400/401/403/409/422 error paths | `backend/src/test/java/com/secretsanta/web/**/*IT.java` | `JAVA_HOME=/usr/lib/jvm/jdk-25.0.4.1+1 mvn -f backend/pom.xml test` |
| Frontend Services, Stores & Components (Angular 19+ Standalone, Signals, Reactive Forms, Tailwind CSS, `AuthSessionStore`, Geolocation, Web Share, Home Groups, Ephemeral Reveal Modal, Reset PIN Page) | unit | All spec UI behaviors via Vitest: user registration/login, "Meus Grupos" & "Grupos Disponíveis", direct WhatsApp link entry `/g/:slug`, 8s geolocation timeout + null fallback, in-memory geo reuse when switching family user, `navigator.share` + clipboard fallback, one-time link PIN reset, immediate Signal/DOM wipe on close/destroy/`visibilitychange`, zero Web Storage persistence | `frontend/src/app/**/*.spec.ts` | `npm --prefix frontend run test` |

## Gate Check Commands

> Generated from codebase - confirm before Execute.

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick | After tasks with unit tests only | `JAVA_HOME=/usr/lib/jvm/jdk-25.0.4.1+1 mvn -f backend/pom.xml test` (backend) or `npm --prefix frontend run test` (frontend Vitest) |
| Full | After tasks with integration tests | `JAVA_HOME=/usr/lib/jvm/jdk-25.0.4.1+1 mvn -f backend/pom.xml test` |
| Build | After phase completion or full-stack verification | `JAVA_HOME=/usr/lib/jvm/jdk-25.0.4.1+1 mvn -f backend/pom.xml test && npm --prefix frontend run build && npm --prefix frontend run test` |

---

## Execution Plan

Phases are ordered and run sequentially - each phase completes before the next begins, and tasks within a phase execute in order.

### Phase 1: Backend Foundation, Rich Domain Model & MongoDB Persistence

Configuração do projeto Spring Boot 3.5 / Java 25 com MongoDB, Mongock, ArchUnit e `docker-compose.yml`, Value Objects (`Username`, `PinHash`, `PasswordResetTokenHash`, `GeoCoordinates`), Aggregates `UserAccount` e `SecretSantaGroup`, agrupamento geográfico Haversine (Union-Find), motor de desarranjo com fallback e adaptadores MongoDB (`users` e `secret_santa_groups`) com lock otimista `@Version`.

```
T1 → T2 → T3 → T4 → T5 → T6
```

### Phase 2: Backend Application Use Cases, Stateless Auth & REST API

Serviço de aplicação Clean Architecture com autenticação BCrypt e token stateless HMAC-SHA256, descoberta de grupos (`myGroups` e `availableGroups`), geração/consumo de link único de redefinição de PIN (`/reset/{token}`), retry otimista, tratamento global de erros RFC 7807 e endpoints REST (`/api/v1/auth`, `/api/v1/groups`, `/api/v1/groups/{slug}/admin`).

```
T7 → T8 → T9 → T10
```

### Phase 3: Frontend Angular Mobile-First SPA, Group Discovery, WhatsApp Link & Ephemeral Reveal

Aplicação Angular 19+ mobile-first com Tailwind CSS e Vitest, `AuthSessionStore` em memória, captura de geolocalização e reuso ao trocar de familiar no mesmo aparelho, Home com Cadastro/Login + `"Meus Grupos"` + `"Grupos Disponíveis (Abertos)"`, painel do organizador, entrada direta via WhatsApp (`/g/:slug`), revelação efêmera (`username` + `PIN`) e redefinição de PIN por link único (`/reset/:token`).

```
T11 → T12 → T13 → T14 → T15 → T16 → T17
```

---

## Task Breakdown

### Phase 1: Backend Foundation, Rich Domain Model & MongoDB Persistence

#### T1: Inicializar projeto Backend Java 25 + Spring Boot 3.5 + MongoDB + Docker Compose

**What**: Criar estrutura Maven em `backend/` com Spring Boot 3.5, Java 25, `spring-boot-starter-data-mongodb` (`auto-index-creation: true`), Mongock, Validation, `spring-security-crypto` (BCrypt), ArchUnit, suporte de teste MongoDB (Testcontainers MongoDB com fallback `mongo-java-server` in-memory) e `docker-compose.yml` na raiz.
**Where**: `backend/pom.xml`
**Depends on**: None
**Reuses**: `.specs/STATE.md` (`AD-002`, `AD-005`, `AD-001`)
**Requirement**: PART-01, GRP-01

**Done when**:

- [x] `backend/pom.xml`, `docker-compose.yml`, `SecretSantaApplication` e `MongoTestContainerConfig` criados e configurados
- [x] Teste de contexto e conectividade MongoDB (`BackendMongoSmokeTest`) executa e valida a subida do banco
- [x] Gate check passes: `JAVA_HOME=/usr/lib/jvm/jdk-25.0.4.1+1 mvn -f backend/pom.xml test`
- [x] Test count: 1+ tests pass (no silent deletions)

**Tests**: integration
**Gate**: full
**Commit**: `feat(backend): initialize spring boot java 25 mongodb project and docker-compose`

---

#### T2: Implementar Value Objects de Domínio, Cálculo Haversine e Regras ArchUnit

**What**: Criar Value Objects imutáveis em Java 25 (`GeoCoordinates` com cálculo Haversine em metros, `ParticipantName` com trim/normalização, `Username` validando `^[a-z0-9._-]{3,30}$`, `PinHash` e `PinValidator` para PIN numérico `^\d{4,6}$`, `PasswordResetTokenHash`, `GroupSlug`, `GroupStatus`, `RevealStatus`), exceções de domínio e `CleanArchitectureTest` (ArchUnit).
**Where**: `backend/src/main/java/com/secretsanta/domain/model/GeoCoordinates.java`
**Depends on**: T1
**Reuses**: `.claude/skills/tactical-ddd/SKILL.md` (`AD-005`, `AD-001`)
**Requirement**: PART-01, GRP-01, DRAW-01, REV-01

**Done when**:

- [x] `GeoCoordinates.distanceInMetersTo` calcula a distância Haversine com precisão e valida limites `[-90, 90]` e `[-180, 180]`
- [x] `ParticipantName` (2..60 chars), `Username` (`^[a-z0-9._-]{3,30}$` case-insensitive) e validação de PIN numérico de 4 a 6 dígitos (`^\d{4,6}$`) rejeitam entradas inválidas
- [x] Testes unitários (`ValueObjectsTest` e `CleanArchitectureTest`) cobrem limites válidos/inválidos, distâncias `< 50m`, `= 50m`, `> 50m` e pureza arquitetural do domínio
- [x] Gate check passes: `JAVA_HOME=/usr/lib/jvm/jdk-25.0.4.1+1 mvn -f backend/pom.xml test`
- [x] Test count: 9+ tests pass (no silent deletions)

**Tests**: unit
**Gate**: quick
**Commit**: `feat(domain): implement value objects, username/pin validators, haversine and archunit`

---

#### T3: Implementar Aggregates UserAccount e SecretSantaGroup (+ Participant)

**What**: Implementar `UserAccount` (cadastro básico `name` + `username` + `pinHash` e ciclo de vida do token único de redefinição de PIN) e `SecretSantaGroup` + `Participant` (criação vinculada a `organizerUserId`, validação de permissão do organizador, inscrição única por `userId`/`username`, remoção pré-sorteio, delegação do sorteio e revelação `revealedAt`).
**Where**: `backend/src/main/java/com/secretsanta/domain/model/SecretSantaGroup.java`
**Depends on**: T2
**Reuses**: `.claude/skills/tactical-ddd/SKILL.md` (`AD-001`)
**Requirement**: PART-01, GRP-01, GRP-02, REV-01, SEC-01

**Done when**:

- [x] `UserAccount` gerencia emissão, validação de expiração e invalidação imediata do `PasswordResetTokenHash` no primeiro uso
- [x] `SecretSantaGroup` protege invariantes de estado (`OPEN` vs `DRAWN`), `organizerUserId`, mínimo de 3 participantes e unicidade de usuário no grupo
- [x] `Participant` e `UserAccount` não vazam `drawnParticipantId`, `pinHash` ou `resetTokenHash` em `toString()`
- [x] Testes unitários (`SecretSantaGroupTest` e `UserAccountTest`) cobrem todos os fluxos e invariantes de ambos os Aggregates
- [x] Gate check passes: `JAVA_HOME=/usr/lib/jvm/jdk-25.0.4.1+1 mvn -f backend/pom.xml test`
- [x] Test count: 19+ tests pass (no silent deletions)

**Tests**: unit
**Gate**: quick
**Commit**: `feat(domain): implement UserAccount and SecretSantaGroup aggregates`

---

#### T4: Implementar HouseholdClusterService (Haversine <= 50m + Union-Find)

**What**: Implementar o serviço de domínio `HouseholdClusterService` que agrupa participantes com coordenadas válidas num raio `<= 50.0` metros usando componentes conexos (Union-Find) e isola participantes sem coordenadas (`null`) em núcleos individuais exclusivos.
**Where**: `backend/src/main/java/com/secretsanta/domain/service/HouseholdClusterService.java`
**Depends on**: T3
**Reuses**: `GeoCoordinates`
**Requirement**: DRAW-01, PART-02

**Done when**:

- [x] Participantes a `<= 50.0m` recebem o mesmo `householdClusterId`, aplicando fechamento transitivo (A-B <= 50m e B-C <= 50m → A, B, C no mesmo cluster)
- [x] Participantes com `coordinates == null` recebem `householdClusterId` individual exclusivo
- [x] Testes unitários (`HouseholdClusterServiceTest`) validam transitividade, múltiplas residências e participantes sem GPS
- [x] Gate check passes: `JAVA_HOME=/usr/lib/jvm/jdk-25.0.4.1+1 mvn -f backend/pom.xml test`
- [x] Test count: 24+ tests pass (no silent deletions)

**Tests**: unit
**Gate**: quick
**Commit**: `feat(domain): implement HouseholdClusterService with 50m Haversine union-find`

---

#### T5: Implementar DerangementDrawService com Verificação de Hall e Fallback Automático

**What**: Implementar `DerangementDrawService` que verifica `max_cluster_size <= floor(N / 2)`: quando satisfeito, gera desarranjo aleatório estrito (`giver.id != receiver.id` e `giver.clusterId != receiver.clusterId`, `geographicRestrictionRelaxed = false`); quando violado, executa fallback automático minimizando pares intra-núcleo sem auto-sorteio (`geographicRestrictionRelaxed = true`).
**Where**: `backend/src/main/java/com/secretsanta/domain/service/DerangementDrawService.java`
**Depends on**: T4
**Reuses**: `HouseholdClusterService`, `SecretSantaGroup`
**Requirement**: DRAW-01, DRAW-02

**Done when**:

- [x] Sorteio estrito gera 0 colisões de núcleo familiar em 100% das execuções quando `max_cluster <= floor(N / 2)`
- [x] Fallback resolve cenários onde `max_cluster > floor(N / 2)` (ex: 5 na mesma casa + 1 externo) sem auto-sorteio e marca `geographicRestrictionRelaxed = true`
- [x] Testes unitários (`DerangementDrawServiceTest`) validam ambos os modos, grupos sem GPS e propriedades de permutação bijetiva
- [x] Gate check passes: `JAVA_HOME=/usr/lib/jvm/jdk-25.0.4.1+1 mvn -f backend/pom.xml test`
- [x] Test count: 30+ tests pass (no silent deletions)

**Tests**: unit
**Gate**: quick
**Commit**: `feat(domain): implement DerangementDrawService with Hall check and automatic fallback`

---

#### T6: Implementar Output Ports e Adaptadores MongoDB (MongoUserAccountAdapter e MongoSecretSantaGroupAdapter)

**What**: Implementar os Output Ports `UserAccountRepository` e `SecretSantaGroupRepository` no domínio e seus adaptadores MongoDB na infraestrutura (`UserAccountDocument` na collection `users` com índice único em `username`, e `SecretSantaGroupDocument` na collection `secret_santa_groups` com `ParticipantSubDocument` embutidos, índice único em `publicSlug`, `@Version` para lock otimista e inicializador Mongock).
**Where**: `backend/src/main/java/com/secretsanta/infrastructure/persistence/MongoSecretSantaGroupAdapter.java`
**Depends on**: T5
**Reuses**: `UserAccount`, `SecretSantaGroup`, `Participant` (`AD-005`, `AD-001`)
**Requirement**: PART-01, GRP-01, DRAW-01, REV-01

**Done when**:

- [x] Mapeamento bidirecional preserva todos os campos de `UserAccount` e `SecretSantaGroup` (documento único com `participants` embutidos)
- [x] Índices únicos em `username` e `publicSlug` e controle de concorrência otimista (`@Version`) funcionam e lançam `OptimisticLockingFailureException` em escritas conflitantes sobre a mesma versão
- [x] Testes de integração (`MongoPersistenceAdaptersIT`) verificam persistência de documentos, busca por `resetTokenHash`, listagem de grupos e lock otimista
- [x] Gate check passes: `JAVA_HOME=/usr/lib/jvm/jdk-25.0.4.1+1 mvn -f backend/pom.xml test`
- [x] Test count: 36+ tests pass (no silent deletions)

**Tests**: integration
**Gate**: full
**Commit**: `feat(persistence): implement MongoDB adapters for UserAccount and SecretSantaGroup`

---

### Phase 2: Backend Application Use Cases, Stateless Auth & REST API

#### T7: Implementar SecretSantaApplicationService e StatelessSessionTokenService

**What**: Implementar `StatelessSessionTokenService` (emissão e verificação de token HMAC-SHA256 stateless) e `SecretSantaApplicationService` coordenando cadastro/login de usuário (BCrypt), descoberta de grupos (`myGroups` e `availableGroups`), criação de grupo pelo usuário autenticado (`organizerUserId`), inscrição no grupo com retry otimista (`@Version`), remoção pré-sorteio, geração/consumo de link único de redefinição de PIN (`/reset/{token}`), sorteio atômico e revelação autenticada por `username` + `pin`.
**Where**: `backend/src/main/java/com/secretsanta/application/SecretSantaApplicationService.java`
**Depends on**: T6
**Reuses**: `UserAccountRepository`, `SecretSantaGroupRepository`, `HouseholdClusterService`, `DerangementDrawService` (`AD-005`, `AD-001`)
**Requirement**: PART-01, PART-02, GRP-01, GRP-02, DRAW-01, DRAW-02, REV-01, SEC-01

**Done when**:

- [x] Cadastro/login retorna token de sessão stateless válido e `listGroupsForUser` separa corretamente `myGroups` e `availableGroups` (grupos `OPEN` nos quais o usuário ainda não está inscrito)
- [x] Apenas o `organizerUserId` consegue executar ações administrativas no grupo (lançando HTTP 403 caso outro usuário autenticado tente acessar)
- [x] Geração de token cria link único `/reset/{token}` e a redefinição atualiza o `pinHash` invalidando o token imediatamente
- [x] DTOs nunca contêm `drawnParticipantId`, `pinHash` ou `resetTokenHash`
- [x] Testes de integração (`SecretSantaApplicationServiceIT`) cobrem cadastro, login, descoberta de grupos, inscrição concorrente, sorteio, revelação por PIN, reset por token e sigilo
- [x] Gate check passes: `JAVA_HOME=/usr/lib/jvm/jdk-25.0.4.1+1 mvn -f backend/pom.xml test`
- [x] Test count: 45+ tests pass (no silent deletions)

**Tests**: integration
**Gate**: full
**Commit**: `feat(application): implement SecretSantaApplicationService and stateless auth token service`

---

#### T8: Implementar GlobalExceptionHandler (RFC 7807) e Configuração Web/CORS

**What**: Implementar `@RestControllerAdvice` (`GlobalExceptionHandler`) mapeando validações e exceções de domínio para HTTP 400, 401, 403, 404, 409 e 422 com `ProblemDetail` padronizado e configurar CORS para o frontend Angular.
**Where**: `backend/src/main/java/com/secretsanta/web/GlobalExceptionHandler.java`
**Depends on**: T7
**Reuses**: Exceções de domínio de `com.secretsanta.domain.exception`
**Requirement**: PART-01, GRP-01, GRP-02, DRAW-01, REV-01

**Done when**:

- [x] Exceções de validação e token de reset inválido/expirado retornam HTTP 400, falha de autenticação retorna HTTP 401, acesso admin por não-organizador retorna HTTP 403, conflitos retornam HTTP 409 e sorteio com `< 3` participantes retorna HTTP 422
- [x] Testes unitários (`GlobalExceptionHandlerTest`) validam cada código HTTP e payload de erro
- [x] Gate check passes: `JAVA_HOME=/usr/lib/jvm/jdk-25.0.4.1+1 mvn -f backend/pom.xml test`
- [x] Test count: 52+ tests pass (no silent deletions)

**Tests**: unit
**Gate**: quick
**Commit**: `feat(web): implement GlobalExceptionHandler for HTTP 400/401/403/404/409/422 responses`

---

#### T9: Implementar AuthController e GroupAdminController

**What**: Implementar `AuthController` (`POST /api/v1/auth/register`, `POST /api/v1/auth/login`, `POST /api/v1/auth/reset-pin`) e `GroupAdminController` (`POST /api/v1/groups`, `GET /api/v1/groups/{slug}/admin`, `DELETE /api/v1/groups/{slug}/admin/participants/{participantId}`, `POST /api/v1/groups/{slug}/admin/draw`, `POST /api/v1/groups/{slug}/admin/participants/{participantId}/reset-token`).
**Where**: `backend/src/main/java/com/secretsanta/web/GroupAdminController.java`
**Depends on**: T8
**Reuses**: `SecretSantaApplicationService`, `GlobalExceptionHandler`
**Requirement**: PART-01, GRP-01, GRP-02, DRAW-01, DRAW-02, REV-01, SEC-01

**Done when**:

- [x] Cadastro, login e redefinição de PIN por token único respondem conforme os critérios de aceite
- [x] Endpoints administrativos validam o usuário organizador autenticado (HTTP 401 sem token, HTTP 403 se não for o `organizerUserId`) e nunca vazam `drawnParticipantId` ou `pinHash`
- [x] Testes de integração MockMvc (`GroupAdminAndAuthControllerIT`) cobrem todos os cenários de autenticação, administração, sorteio e reset de PIN
- [x] Gate check passes: `JAVA_HOME=/usr/lib/jvm/jdk-25.0.4.1+1 mvn -f backend/pom.xml test`
- [x] Test count: 63+ tests pass (no silent deletions)

**Tests**: integration
**Gate**: full
**Commit**: `feat(web): implement AuthController and GroupAdminController endpoints`

---

#### T10: Implementar GroupPublicController (Descoberta de Grupos, Link do WhatsApp, Inscrição e Revelação)

**What**: Implementar `GroupPublicController` com `GET /api/v1/groups` (`myGroups` e `availableGroups`), `GET /api/v1/groups/{slug}` (detalhes do grupo pelo link do WhatsApp), `POST /api/v1/groups/{slug}/participants` (inscrição do usuário autenticado com coordenadas opcionais) e `POST /api/v1/groups/{slug}/participants/reveal` (revelação autenticada por `username` + `pin`).
**Where**: `backend/src/main/java/com/secretsanta/web/GroupPublicController.java`
**Depends on**: T9
**Reuses**: `SecretSantaApplicationService`, `GlobalExceptionHandler`
**Requirement**: PART-01, PART-02, REV-01, SEC-01

**Done when**:

- [x] `GET /api/v1/groups` retorna `myGroups` e `availableGroups` para o usuário autenticado
- [x] `POST /api/v1/groups/{slug}/participants` inscreve o usuário autenticado no grupo `OPEN` (HTTP 201) ou retorna HTTP 409 se já inscrito ou se o grupo já estiver `DRAWN`
- [x] `POST /api/v1/groups/{slug}/participants/reveal` valida `{ username, pin }` e retorna `drawnParticipantName` (HTTP 200), ou HTTP 401/409
- [x] Testes de integração MockMvc (`GroupPublicControllerIT`) validam listagem de grupos disponíveis, inscrição, bloqueios 409 e revelação por PIN
- [x] Gate check passes: `JAVA_HOME=/usr/lib/jvm/jdk-25.0.4.1+1 mvn -f backend/pom.xml test`
- [x] Test count: 72+ tests pass (no silent deletions)

**Tests**: integration
**Gate**: full
**Commit**: `feat(web): implement GroupPublicController for group discovery, join and reveal`

---

### Phase 3: Frontend Angular Mobile-First SPA, Group Discovery, WhatsApp Link & Ephemeral Reveal

#### T11: Inicializar Workspace Angular 19+ Standalone com Tailwind CSS, Vitest, AuthSessionStore e SecretSantaApiService

**What**: Criar aplicação Angular 19+ standalone em `frontend/` configurada com Tailwind CSS mobile-first, Vitest headless (`vitest run --reporter=verbose`), ícones SVG leves, rotas (`/`, `/g/:slug`, `/g/:slug/admin`, `/reset/:token`), `AuthSessionStore` (Signal em memória para sessão de usuário e troca rápida de familiar) e `SecretSantaApiService`.
**Where**: `frontend/src/app/core/api/secret-santa-api.service.ts`
**Depends on**: T10
**Reuses**: Contratos REST de `AuthController`, `GroupAdminController` e `GroupPublicController` (`AD-004`, `AD-001`)
**Requirement**: PART-01, GRP-01, REV-01, SEC-01

**Done when**:

- [ ] Projeto Angular 19+ com Tailwind CSS e Vitest compila sem erros (`npm --prefix frontend run build`) e roteamento principal está configurado
- [ ] `AuthSessionStore` mantém o usuário e token em Signal de memória volátil e expõe `switchFamilyUser()` limpando a sessão atual
- [ ] `SecretSantaApiService` encapsula todas as chamadas HTTP tipadas enviando `Authorization: Bearer <token>` quando autenticado
- [ ] Testes unitários Vitest (`secret-santa-api.service.spec.ts`) validam chamadas, `AuthSessionStore` e headers
- [ ] Gate check passes: `npm --prefix frontend run test`
- [ ] Test count: 5+ frontend tests pass (no silent deletions)

**Tests**: unit
**Gate**: quick
**Commit**: `feat(frontend): initialize angular 19 tailwind vitest workspace, AuthSessionStore and API service`

---

#### T12: Implementar BrowserGeolocationService, DeviceSessionGeoStore e ShareLinkService

**What**: Implementar `BrowserGeolocationService` e `DeviceSessionGeoStore` (Signals) para solicitar `navigator.geolocation.getCurrentPosition` com timeout de 8000ms, fallback para `{ latitude: null, longitude: null }` e reuso em memória ao trocar de usuário no mesmo aparelho, além de `ShareLinkService` com Web Share API (`navigator.share`) e fallback `navigator.clipboard.writeText`.
**Where**: `frontend/src/app/core/geolocation/browser-geolocation.service.ts`
**Depends on**: T11
**Reuses**: Angular Signals (`AD-004`, `AD-001`)
**Requirement**: GRP-01, PART-01, PART-02

**Done when**:

- [ ] Captura solicita GPS com timeout de 8 segundos e retorna coordenadas quando concedido, ou `latitude: null, longitude: null` em erro/negação/HTTP inseguro
- [ ] `DeviceSessionGeoStore` mantém as coordenadas recém-capturadas na memória da tela mesmo quando `AuthSessionStore.switchFamilyUser()` é acionado para cadastrar outro familiar no mesmo aparelho
- [ ] `ShareLinkService` invoca `navigator.share` quando disponível ou copia a URL via `navigator.clipboard.writeText` como fallback
- [ ] Testes unitários Vitest (`browser-geolocation.service.spec.ts`) cobrem GPS concedido, negado, timeout de 8s, reuso entre familiares e compartilhamento `navigator.share`/clipboard
- [ ] Gate check passes: `npm --prefix frontend run test`
- [ ] Test count: 11+ frontend tests pass (no silent deletions)

**Tests**: unit
**Gate**: quick
**Commit**: `feat(frontend): implement BrowserGeolocationService, dependent geo store and ShareLinkService`

---

#### T13: Implementar HomeGroupsPageComponent (Cadastro/Login, Grupos Disponíveis, Meus Grupos e Criar Grupo)

**What**: Implementar a página inicial (`HomeGroupsPageComponent` em `/`) com Reactive Forms, Native Control Flow (`@if`, `@for`) e Tailwind CSS: quando não autenticado, exibe Cadastro Básico (`name`, `username` auto-sugerido/editável, `pin` numérico 4-6 dígitos) e Login (`username` + `pin`); quando autenticado, exibe **"Meus Grupos"**, **"Grupos Disponíveis (Abertos)"** com inscrição em 1 toque (capturando GPS), criação rápida de novo grupo e o botão `"Cadastrar outro familiar / Trocar de usuário neste aparelho"`.
**Where**: `frontend/src/app/features/home/home-groups-page.component.ts`
**Depends on**: T12
**Reuses**: `SecretSantaApiService`, `AuthSessionStore`, `BrowserGeolocationService`, `DeviceSessionGeoStore`
**Requirement**: PART-01, PART-02, GRP-01

**Done when**:

- [ ] Usuário se cadastra ou faz login e visualiza imediatamente as seções `"Meus Grupos"` e `"Grupos Disponíveis"`
- [ ] Clicar em `"Participar"` em um grupo disponível captura/reutiliza o GPS e inscreve o usuário no grupo
- [ ] Clicar em `"Cadastrar outro familiar / Trocar de usuário neste aparelho"` limpa a sessão de usuário em memória preservando o GPS no `DeviceSessionGeoStore`
- [ ] Testes unitários Vitest (`home-groups-page.component.spec.ts`) validam cadastro, login, listagem de grupos disponíveis, inscrição com 1 toque, criação de grupo e troca de usuário no aparelho
- [ ] Gate check passes: `npm --prefix frontend run test`
- [ ] Test count: 18+ frontend tests pass (no silent deletions)

**Tests**: unit
**Gate**: quick
**Commit**: `feat(frontend): implement HomeGroupsPageComponent with auth, available groups and family switch`

---

#### T14: Implementar AdminDashboardPageComponent (/g/:slug/admin) com Link de Reset e Sorteio

**What**: Implementar `AdminDashboardPageComponent` para o usuário organizador do grupo com compartilhamento do link `/g/{slug}` para o WhatsApp, lista de inscritos (`name`, `@username`, `hasGeoLocation`, `revealStatus`), geração e compartilhamento de link único de redefinição de PIN (`/reset/{token}`), exclusão pré-sorteio e disparo do sorteio.
**Where**: `frontend/src/app/features/admin/admin-dashboard-page.component.ts`
**Depends on**: T13
**Reuses**: `SecretSantaApiService`, `ShareLinkService`, `AuthSessionStore`
**Requirement**: GRP-01, GRP-02, DRAW-01, DRAW-02

**Done when**:

- [ ] Painel admin exibe inscritos com `@username`, permite compartilhar `/g/{slug}`, gerar/compartilhar link `/reset/{token}` para qualquer inscrito, remover participante enquanto `OPEN` e disparar o sorteio quando há `>= 3` inscritos
- [ ] Testes unitários Vitest (`admin-dashboard-page.component.spec.ts`) validam compartilhamento, geração de link de reset, listagem sigilosa, exclusão e sorteio
- [ ] Gate check passes: `npm --prefix frontend run test`
- [ ] Test count: 24+ frontend tests pass (no silent deletions)

**Tests**: unit
**Gate**: quick
**Commit**: `feat(frontend): implement AdminDashboardPageComponent with WhatsApp share, reset link and draw`

---

#### T15: Implementar EphemeralRevealModalComponent (Fluxo "Passar o Celular")

**What**: Implementar `EphemeralRevealModalComponent` com card Tailwind CSS de alto contraste que exibe o nome sorteado e botão `"Fechar e passar o celular"`, mantendo o valor exclusivamente em Signal local e limpando-o imediatamente ao fechar, em `ngOnDestroy` e em `document:visibilitychange` (`hidden`), sem jamais tocar em `localStorage`, `sessionStorage`, `IndexedDB`, cookies ou URL.
**Where**: `frontend/src/app/features/public-group/ephemeral-reveal-modal.component.ts`
**Depends on**: T14
**Reuses**: Angular Signals (`AD-003`, `AD-004`)
**Requirement**: REV-01, SEC-01

**Done when**:

- [ ] Modal exibe o nome sorteado em card Tailwind CSS de alto contraste e botão `"Fechar e passar o celular"`
- [ ] Ao fechar o modal, destruir o componente ou disparar `visibilitychange` para `hidden`, o Signal é sobrescrito com `null` e o nome sorteado desaparece do DOM
- [ ] `localStorage`, `sessionStorage` e `document.cookie` permanecem com zero bytes do resultado do sorteio ou do PIN
- [ ] Testes unitários Vitest (`ephemeral-reveal-modal.component.spec.ts`) verificam limpeza no clique, `ngOnDestroy`, `visibilitychange` e ausência total em Web Storage
- [ ] Gate check passes: `npm --prefix frontend run test`
- [ ] Test count: 29+ frontend tests pass (no silent deletions)

**Tests**: unit
**Gate**: quick
**Commit**: `feat(frontend): implement EphemeralRevealModalComponent with instant memory wipe`

---

#### T16: Implementar PublicGroupPageComponent (/g/:slug) — Entrada via WhatsApp e Revelação por PIN

**What**: Implementar `PublicGroupPageComponent` (`/g/:slug`): quando `OPEN`, permite que um visitante vindo do link do WhatsApp crie seu cadastro básico (ou faça login) e já seja inscrito automaticamente no grupo com captura de GPS, ou que um usuário já logado se inscreva com 1 toque e use o botão `"Cadastrar outro familiar / Trocar de usuário neste aparelho"`; quando `DRAWN`, exibe o formulário de revelação (`username` + `pin` numérico) e a lista de participantes (`name`, `@username`, status `PENDING_REVEAL`/`REVEALED`), abrindo o `EphemeralRevealModalComponent`.
**Where**: `frontend/src/app/features/public-group/public-group-page.component.ts`
**Depends on**: T15
**Reuses**: `EphemeralRevealModalComponent`, `SecretSantaApiService`, `AuthSessionStore`, `BrowserGeolocationService`, `DeviceSessionGeoStore`
**Requirement**: PART-01, PART-02, REV-01, SEC-01

**Done when**:

- [ ] Visitante não autenticado que abre `/g/{slug}` enquanto `OPEN` consegue se cadastrar/logar na própria tela e é inscrito automaticamente no grupo com captura/fallback de GPS
- [ ] Quando `DRAWN`, permite revelar quem tirou informando `username` + `pin` (ou clicando no nome na lista para preencher `username` e digitando o `pin`), limpando o campo `pin` e abrindo o modal efêmero
- [ ] Testes unitários Vitest (`public-group-page.component.spec.ts`) validam entrada direta via link do WhatsApp, inscrição com fallback de GPS, troca de usuário para dependente e revelação por PIN
- [ ] Gate check passes: `npm --prefix frontend run test`
- [ ] Test count: 35+ frontend tests pass (no silent deletions)

**Tests**: unit
**Gate**: quick
**Commit**: `feat(frontend): implement PublicGroupPageComponent for direct WhatsApp link join and PIN reveal`

---

#### T17: Implementar ResetPinPageComponent (/reset/:token)

**What**: Implementar `ResetPinPageComponent` com Reactive Forms e Tailwind CSS permitindo ao participante que recebeu o link único `/reset/:token` definir seu novo PIN numérico de 4 a 6 dígitos (`POST /api/v1/auth/reset-pin`) e navegar para a tela inicial/grupo.
**Where**: `frontend/src/app/features/public-group/reset-pin-page.component.ts`
**Depends on**: T16
**Reuses**: `SecretSantaApiService` (`AD-001`)
**Requirement**: REV-01, SEC-01

**Done when**:

- [ ] Página valida novo PIN numérico de 4 a 6 dígitos (`inputmode="numeric"`) e submete `{ token, newPin }` para `POST /api/v1/auth/reset-pin`
- [ ] Em caso de sucesso, exibe confirmação e botão para prosseguir; em caso de token inválido/expirado (HTTP 400), exibe mensagem orientando a solicitar novo link ao organizador
- [ ] Testes unitários Vitest (`reset-pin-page.component.spec.ts`) cobrem redefinição com sucesso e tratamento de token expirado/inválido
- [ ] Gate check passes: `npm --prefix frontend run test`
- [ ] Test count: 39+ frontend tests pass (no silent deletions)

**Tests**: unit
**Gate**: build
**Commit**: `feat(frontend): implement ResetPinPageComponent for one-time link PIN reset`

---

## Checks

**C1** - `POST /api/v1/auth/register` com `name` (2..60 chars), `username` único (3..30 chars) e `pin` numérico (4..6 dígitos) cria `UserAccount` com `pinHash` BCrypt e retorna HTTP 201 com token stateless (PART-01, AC 1)
Proof: run backend | GroupAdminAndAuthControllerIT

**C2** - `POST /api/v1/auth/register` com `name`, `username` ou `pin` fora do formato válido retorna HTTP 400 Bad Request (PART-01, AC 2)
Proof: run backend | GroupAdminAndAuthControllerIT

**C3** - `POST /api/v1/auth/register` com `username` já existente (case-insensitive) retorna HTTP 409 Conflict (PART-01, AC 3)
Proof: run backend | GroupAdminAndAuthControllerIT

**C4** - `POST /api/v1/auth/login` com `username` e `pin` válidos retorna HTTP 200 com token de sessão stateless (PART-01, AC 4)
Proof: run backend | GroupAdminAndAuthControllerIT

**C5** - `POST /api/v1/auth/login` com `username` inexistente ou `pin` incorreto retorna HTTP 401 Unauthorized (PART-01, AC 5)
Proof: run backend | GroupAdminAndAuthControllerIT

**C6** - `GET /api/v1/groups` retorna HTTP 200 com `myGroups` (grupos onde o usuário participa ou é organizador) e `availableGroups` (grupos `OPEN` onde ainda não está inscrito) (PART-01, AC 6)
Proof: run backend | GroupPublicControllerIT

**C7** - Ao se inscrever em um grupo aberto (pela Home ou por `/g/{slug}`), o frontend solicita `navigator.geolocation.getCurrentPosition()` com timeout de 8000ms (PART-01, AC 7)
Proof: run frontend | BrowserGeolocationService

**C8** - Quando permissão de GPS é concedida, `latitude` e `longitude` válidas são enviadas para `POST /api/v1/groups/{slug}/participants` retornando HTTP 201 (PART-01, AC 8)
Proof: run backend | GroupPublicControllerIT

**C9** - Quando permissão de GPS é negada ou ocorre timeout/erro, a inscrição no grupo conclui com `latitude = null` e `longitude = null` exibindo aviso não-bloqueante (PART-01, AC 9)
Proof: run frontend | HomeGroupsPageComponent

**C10** - Visitante não autenticado que acessa o link direto `/g/{slug}` enquanto `OPEN` pode criar seu cadastro/fazer login na própria tela e é inscrito automaticamente no grupo (PART-01, AC 10)
Proof: run frontend | PublicGroupPageComponent

**C11** - `POST /api/v1/groups/{slug}/participants` quando o usuário já está inscrito no grupo ou quando o grupo já está `DRAWN` retorna HTTP 409 Conflict (PART-01, AC 11)
Proof: run backend | GroupPublicControllerIT

**C12** - Clicar em `"Cadastrar outro familiar / Trocar de usuário neste aparelho"` limpa a sessão de usuário em memória (`AuthSessionStore`) e preserva o GPS no `DeviceSessionGeoStore` para o próximo familiar (PART-02, AC 12)
Proof: run frontend | HomeGroupsPageComponent

**C13** - `POST /api/v1/groups` por usuário autenticado com nome do evento (3..100 chars) cria grupo `OPEN` definindo `organizerUserId` e retorna HTTP 201 com `/g/{slug}` (GRP-01, AC 1)
Proof: run backend | GroupAdminAndAuthControllerIT

**C14** - `POST /api/v1/groups` com nome do evento `< 3` chars retorna HTTP 400 Bad Request (GRP-01, AC 2)
Proof: run backend | GroupAdminAndAuthControllerIT

**C15** - `GET /api/v1/groups/{slug}/admin` pelo organizador retorna HTTP 200 com `id`, `userId`, `name`, `username`, `hasGeoLocation`, `revealStatus` e `createdAt` dos inscritos (GRP-02, AC 3)
Proof: run backend | GroupAdminAndAuthControllerIT

**C16** - Nenhuma resposta administrativa ou pública contém `drawnParticipantId`, `pinHash`, `resetTokenHash` ou mapeamento de pares sorteados (GRP-02, AC 4)
Proof: run backend | GroupAdminAndAuthControllerIT

**C17** - `DELETE /api/v1/groups/{slug}/admin/participants/{participantId}` enquanto `OPEN` remove o participante e retorna HTTP 204 (GRP-02, AC 5)
Proof: run backend | GroupAdminAndAuthControllerIT

**C18** - `DELETE /api/v1/groups/{slug}/admin/participants/{participantId}` quando o grupo já está `DRAWN` retorna HTTP 409 Conflict (GRP-02, AC 6)
Proof: run backend | GroupAdminAndAuthControllerIT

**C19** - Requisições aos endpoints `/admin` sem autenticação retornam HTTP 401 e por usuário diferente do `organizerUserId` retornam HTTP 403 Forbidden (GRP-01, AC 7)
Proof: run backend | GroupAdminAndAuthControllerIT

**C20** - `POST /api/v1/groups/{slug}/admin/participants/{participantId}/reset-token` pelo organizador gera token de uso único válido por 24h e retorna HTTP 200 com `/reset/{token}` (GRP-02, AC 8)
Proof: run backend | GroupAdminAndAuthControllerIT

**C21** - Ao compartilhar o link do grupo (`/g/{slug}`) ou o link de redefinição (`/reset/{token}`) no painel admin, o sistema aciona `navigator.share` ou copia via `navigator.clipboard.writeText` (GRP-01, AC 9)
Proof: run frontend | BrowserGeolocationService

**C22** - `POST /api/v1/groups/{slug}/admin/draw` pelo organizador com `>= 3` participantes enquanto `OPEN` executa o sorteio atomicamente no documento MongoDB, muda o status para `DRAWN` e retorna HTTP 200 (DRAW-01, AC 1)
Proof: run backend | GroupAdminAndAuthControllerIT

**C23** - `POST /api/v1/groups/{slug}/admin/draw` com menos de 3 participantes retorna HTTP 422 Unprocessable Entity (DRAW-01, AC 2)
Proof: run backend | GroupAdminAndAuthControllerIT

**C24** - `POST /api/v1/groups/{slug}/admin/draw` quando o grupo já está `DRAWN` retorna HTTP 409 Conflict (DRAW-01, AC 3)
Proof: run backend | GroupAdminAndAuthControllerIT

**C25** - `HouseholdClusterService` agrupa no mesmo `householdClusterId` participantes cuja distância de Haversine seja `<= 50.0` metros com fechamento transitivo (DRAW-01, AC 4)
Proof: run backend | HouseholdClusterServiceTest

**C26** - Participantes com `latitude = null` ou `longitude = null` recebem cada um um `householdClusterId` individual exclusivo (DRAW-01, AC 5)
Proof: run backend | HouseholdClusterServiceTest

**C27** - Quando `max_cluster_size <= floor(N / 2)`, `DerangementDrawService` gera desarranjo estrito sem auto-sorteio e sem pares do mesmo `householdClusterId`, com `geographicRestrictionRelaxed = false` (DRAW-02, AC 6)
Proof: run backend | DerangementDrawServiceTest

**C28** - Quando `max_cluster_size > floor(N / 2)`, `DerangementDrawService` aplica fallback automático gerando desarranjo sem auto-sorteio que minimiza colisões intra-núcleo e registra `geographicRestrictionRelaxed = true` (DRAW-02, AC 7)
Proof: run backend | DerangementDrawServiceTest

**C29** - Enquanto `DRAWN`, `/g/{slug}` exibe o formulário de consulta por `username` + `PIN` e a lista de participantes inscritos (`name`, `username` e status `PENDING_REVEAL`/`REVEALED`), permitindo tocar em um item da lista para preencher o `username` (REV-01, AC 1)
Proof: run frontend | PublicGroupPageComponent

**C30** - `POST /api/v1/groups/{slug}/participants/reveal` com `username` e `pin` válidos enquanto `DRAWN` valida o `pinHash` BCrypt do usuário, marca `revealedAt` e retorna HTTP 200 com `drawnParticipantName` (REV-01, AC 2)
Proof: run backend | GroupPublicControllerIT

**C31** - `POST /api/v1/groups/{slug}/participants/reveal` com `username` não pertencente ao grupo ou `pin` incorreto retorna HTTP 401 Unauthorized (REV-01, AC 3)
Proof: run backend | GroupPublicControllerIT

**C32** - `POST /api/v1/groups/{slug}/participants/reveal` enquanto o grupo está `OPEN` retorna HTTP 409 Conflict (REV-01, AC 4)
Proof: run backend | GroupPublicControllerIT

**C33** - Ao receber a resposta de revelação no frontend, o campo `pin` é limpo e o modal exibe `drawnParticipantName` em destaque com botão `"Fechar e passar o celular"` (REV-01, AC 5)
Proof: run frontend | EphemeralRevealModalComponent

**C34** - Ao fechar o modal, trocar de usuário, destruir o componente ou mudar `visibilityState` para `hidden`, o Signal com `drawnParticipantName` é limpo para `null` e o elemento do DOM é removido imediatamente (SEC-01, AC 6)
Proof: run frontend | EphemeralRevealModalComponent

**C35** - `drawnParticipantName` e `pin` nunca são gravados em `localStorage`, `sessionStorage`, `IndexedDB`, cookies ou URL (SEC-01, AC 7)
Proof: run frontend | EphemeralRevealModalComponent

**C36** - `POST /api/v1/auth/reset-pin` com token válido e novo `pin` numérico de 4 a 6 dígitos atualiza o `pinHash` BCrypt do `UserAccount`, invalida imediatamente o token de uso único e retorna HTTP 200 (REV-01, AC 8)
Proof: run backend | GroupAdminAndAuthControllerIT

**C37** - `POST /api/v1/auth/reset-pin` com token inexistente, já utilizado ou expirado retorna HTTP 400 Bad Request (REV-01, AC 9)
Proof: run backend | GroupAdminAndAuthControllerIT

---

## Handoff

The feature's live state, written as it happens - a compaction gives no warning.

**Settled mid-build:** none
**Dispatched:** Batch 1 (Phase 1: T1-T6) at HEAD e767279 (returned at f9de550); Batch 2 (Phase 2: T7-T10) at HEAD f9de550
**Walked:** pending execution

---

## Phase Execution Map

Visual representation of task ordering. Phases run in sequence, and tasks within a phase run in order:

```
Phase 1:  T1 → T2 → T3 → T4 → T5 → T6
Phase 2:  T7 → T8 → T9 → T10
Phase 3:  T11 → T12 → T13 → T14 → T15 → T16 → T17
```

---

## Task Granularity Check

| Task | Scope | Status |
| ---- | ----- | ------ |
| T1: Inicializar projeto Backend MongoDB + Docker Compose | 1 module setup + compose | ✅ Granular |
| T2: Implementar Value Objects, Username/PIN, Haversine e ArchUnit | Value Objects package | ✅ Granular |
| T3: Implementar Aggregates `UserAccount` e `SecretSantaGroup` | Domain Aggregates | ✅ Granular |
| T4: Implementar `HouseholdClusterService` | 1 Domain Service | ✅ Granular |
| T5: Implementar `DerangementDrawService` | 1 Domain Service | ✅ Granular |
| T6: Implementar Adaptadores MongoDB (`users` e `secret_santa_groups`) | Persistence Adapters | ✅ Granular |
| T7: Implementar `SecretSantaApplicationService` e `StatelessSessionTokenService` | Application Layer | ✅ Granular |
| T8: Implementar `GlobalExceptionHandler` | 1 Exception Advice | ✅ Granular |
| T9: Implementar `AuthController` e `GroupAdminController` | Auth & Admin Controllers | ✅ Granular |
| T10: Implementar `GroupPublicController` | 1 REST Controller | ✅ Granular |
| T11: Inicializar Angular + `AuthSessionStore` + `SecretSantaApiService` | Core Auth & API Client | ✅ Granular |
| T12: Implementar `BrowserGeolocationService` + `ShareLinkService` | Geolocation & Share Services | ✅ Granular |
| T13: Implementar `HomeGroupsPageComponent` | 1 Page Component | ✅ Granular |
| T14: Implementar `AdminDashboardPageComponent` | 1 Page Component | ✅ Granular |
| T15: Implementar `EphemeralRevealModalComponent` | 1 UI Component | ✅ Granular |
| T16: Implementar `PublicGroupPageComponent` | 1 Page Component | ✅ Granular |
| T17: Implementar `ResetPinPageComponent` | 1 Page Component | ✅ Granular |

---

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
| ---- | ---------------------- | ------------- | ------ |
| T1 | None | Start of Phase 1 | ✅ Match |
| T2 | T1 | T1 → T2 | ✅ Match |
| T3 | T2 | T2 → T3 | ✅ Match |
| T4 | T3 | T3 → T4 | ✅ Match |
| T5 | T4 | T4 → T5 | ✅ Match |
| T6 | T5 | T5 → T6 | ✅ Match |
| T7 | T6 | Start of Phase 2 (after Phase 1 T6) | ✅ Match |
| T8 | T7 | T7 → T8 | ✅ Match |
| T9 | T8 | T8 → T9 | ✅ Match |
| T10 | T9 | T9 → T10 | ✅ Match |
| T11 | T10 | Start of Phase 3 (after Phase 2 T10) | ✅ Match |
| T12 | T11 | T11 → T12 | ✅ Match |
| T13 | T12 | T12 → T13 | ✅ Match |
| T14 | T13 | T13 → T14 | ✅ Match |
| T15 | T14 | T14 → T15 | ✅ Match |
| T16 | T15 | T15 → T16 | ✅ Match |
| T17 | T16 | T16 → T17 | ✅ Match |

---

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| ---- | --------------------------- | --------------- | --------- | ------ |
| T1 | MongoDB Persistence Setup | integration | integration | ✅ OK |
| T2 | Domain Value Objects & ArchUnit | unit | unit | ✅ OK |
| T3 | Domain Aggregates (`UserAccount`, `SecretSantaGroup`) | unit | unit | ✅ OK |
| T4 | Domain Service (Clustering) | unit | unit | ✅ OK |
| T5 | Domain Service (Derangement Draw) | unit | unit | ✅ OK |
| T6 | MongoDB Persistence Adapters | integration | integration | ✅ OK |
| T7 | Application Service & Stateless Auth | integration | integration | ✅ OK |
| T8 | Web Exception Handling | unit | unit | ✅ OK |
| T9 | REST Controllers (Auth & Admin) | integration | integration | ✅ OK |
| T10 | REST Controller (Public & Discovery) | integration | integration | ✅ OK |
| T11 | Frontend Core API & Auth Store | unit | unit | ✅ OK |
| T12 | Frontend Geolocation & Share Services | unit | unit | ✅ OK |
| T13 | Frontend Home & Group Discovery Page | unit | unit | ✅ OK |
| T14 | Frontend Admin Dashboard Page | unit | unit | ✅ OK |
| T15 | Frontend Ephemeral Reveal Modal | unit | unit | ✅ OK |
| T16 | Frontend Public Group & WhatsApp Link Page | unit | unit | ✅ OK |
| T17 | Frontend Reset PIN Page | unit | unit | ✅ OK |
