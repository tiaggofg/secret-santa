---
name: implement-spec-tasks
description: >-
  Implements approved feature tasks from .specs/features/<feature>/tasks.md in the Secret Santa project.
  Use when starting an implementation session from an approved spec/tasks/handoff, loading full context
  from .specs/, docs/, and the backend/frontend codebase, executing tasks, verifying with tests/Playwright,
  and updating documentation before asking for commit/push approval.
---

# Implement Spec Tasks (Secret Santa)

Execute este runbook ao iniciar uma sessão responsável por implementar uma spec aprovada em `.specs/features/<feature>/`.

---

## Etapa 1 — Carregar Contexto Obrigatório (Antes de Editar Código)

Leia **na ordem abaixo** apenas os trechos necessários para a feature:

1. **Estado & Handoff (`.specs/`)**:
   - `.specs/STATE.md`: leia as decisões arquiteturais ativas (`AD-001`..`AD-009`+) e a seção `## Handoff` para identificar a feature ativa.
   - `.specs/features/<feature>/spec.md`: leia integralmente o Problem Statement, Goals, Out of Scope, Decisões, Contratos e Critérios EARS.
   - `.specs/features/<feature>/tasks.md`: mapeie todas as tasks (`B*`, `F*`, `C*`, `V*`) e sua ordem de dependência.

2. **Documentação Técnica (`docs/`) — Leia os arquivos relevantes ao escopo da task**:
   - `docs/README.md` (visão geral e índice).
   - `docs/arquitetura-c4.md` (containers, componentes e Clean Architecture).
   - `docs/modelo-dominio-e-dados.md` (agregados, Value Objects, coleções MongoDB `users`, `secret_santa_groups`, `refresh_tokens`, índices e máquina de estados).
   - `docs/fluxos-e-sequencias.md` (jornadas de UI e diagramas de sequência).
   - `docs/algoritmo-sorteio.md` (Haversine `<= 50m`, Union-Find, desarranjo e relaxamento automático — caso a task toque sorteio).
   - `docs/api-rest.md` (contratos `/api/v1`, cookies `HttpOnly`, códigos de erro e DTOs).
   - `docs/seguranca-e-privacidade.md` (política de senha, cookies `HttpOnly` `ss_access_token`/`ss_refresh_token`, convite `?sig=`, sigilo efêmero em Signals).
   - `docs/deploy-e-ci-cd.md` (Dockerfiles, Compose e GitHub Actions — caso a task toque infra/CI).

3. **Mapa do Código-Fonte**:
   - **Backend (`backend/src/main/java/com/secretsanta/`)**:
     - `domain/model/`, `domain/service/`, `domain/port/`, `domain/exception/` — **100% Java puro** (zero Spring, MongoDB, Jackson ou Jakarta; validado por `CleanArchitectureTest` via ArchUnit).
     - `application/` — `SecretSantaApplicationService`, `StatelessSessionTokenService`, serviços de token/assinatura.
     - `infrastructure/persistence/` — documentos MongoDB (`@Version` em `SecretSantaGroupDocument`), adaptadores e `SecretSantaIndexesChangeUnit` (Mongock).
     - `web/` — controllers REST `/api/v1`, `AuthCookieManager`, `GlobalExceptionHandler`, `WebCorsConfig`.
   - **Frontend (`frontend/src/app/`)**:
     - `app.component.ts`, `app.config.ts` (`provideAppInitializer` `/auth/me`), `app.routes.ts`.
     - `core/api/` (`secret-santa-api.models.ts`, `secret-santa-api.service.ts`), `core/auth/` (`auth-session.store.ts`, `auth-credentials.interceptor.ts`), `core/geolocation/`, `core/share/` (`share-link.service.ts`).
     - `features/home/`, `features/auth/`, `features/public-group/` (inclui `ephemeral-reveal-modal.component.ts` e `reset-pin-page.component.ts`), `features/admin/` (`admin-dashboard-page.component.ts`).
     - `shared/` (`formatters.ts`, `password-policy.ts`, `components/festive-icon.component.ts`, `components/password-criteria-indicator.component.ts`, `toast/`).
     - `frontend/tailwind.config.js` e `frontend/src/styles.css` (paleta `festive-cream`, `festive-night`, `festive-card`, `festive-border`, `pine`, `cranberry`, `gold`, `ink`, fontes `Fraunces` + `Plus Jakarta Sans`).

---

## Etapa 2 — Invariantes Arquiteturais que Nunca Podem Ser Violadas

- **Backend (Clean Architecture / ArchUnit)**: `com.secretsanta.domain..` nunca pode importar `org.springframework..`, `org.mongodb..`, `com.mongodb..`, `io.mongock..`, `com.fasterxml.jackson..` ou `jakarta..`.
- **Privacidade da API**: nenhum endpoint de consulta/listagem (`GET /groups`, `GET /groups/{id}`, `GET /groups/{id}/admin`) pode expor `drawnParticipantId`, `drawnParticipantName`, `pinHash`/`passwordHash` ou `passwordResetTokenHash`. `inviteSignature` só aparece no `AdminGroupView`.
- **Sigilo Efêmero & Modo "Passar o Celular" (`AD-003` + `AD-009`)**:
  - Sessão web usa cookies `HttpOnly` (`withCredentials: true`, sem token em JSON/JS/Web Storage).
  - `drawnParticipantName` e senha digitada na revelação ficam **exclusivamente em memória volátil** (Signals), com limpeza no fechamento do modal, `ngOnDestroy` e `visibilitychange`. Nunca gravar em `localStorage`, `sessionStorage`, `IndexedDB`, cookies de JS ou URL.
- **Idioma & UX Mobile-First**: UI 100% em português humano (sem expor enums como `OPEN`, `DRAWN`, `WAITING_DRAW`, `PENDING_REVEAL`), alvos de toque `>= 44px`, zero overflow horizontal em `390px` e preservação de `data-testid` salvo quando a própria spec determinar alteração.

---

## Etapa 3 — Implementação Orientada às Tasks (`tasks.md`)

1. Execute as tasks na ordem definida em `.specs/features/<feature>/tasks.md` (normalmente Backend `B*` → Frontend `F*`).
2. Antes de editar cada componente/serviço, leia os arquivos existentes e seus respectivos `*.spec.ts` / `*IT.java` para reutilizar padrões e helpers já presentes no repositório.
3. Atualize ou crie testes unitários e de integração junto com cada grupo de tasks (`JUnit 5` / `ArchUnit` no backend, `Vitest` no frontend).
4. Marque cada checkbox `- [x]` em `.specs/features/<feature>/tasks.md` apenas depois que o item e seus testes estiverem implementados e verificados.

---

## Etapa 4 — Verificação Obrigatória Pós-Implementação

Siga estritamente `AGENTS.md` (Seção 6) e `.agents/rules/post-implementation-testing.md`:

1. **Testes Automatizados**:
   - Se alterou Backend: `cd backend && mvn test` (deve passar 100%, incluindo `CleanArchitectureTest`).
   - Se alterou Frontend: `cd frontend && npm test` e `cd frontend && npm run build`.
2. **Validação Prática Real (Obrigatória)**:
   - Suba MongoDB (`docker compose up -d` se necessário; verifique porta `27017`), Backend (`cd backend && mvn spring-boot:run`) e Frontend (`cd frontend && npm start` para mudanças com UI).
   - **Se tocou Frontend ou Full-Stack**: execute validação E2E real via **Playwright** em mobile (`390x844`) e desktop (`1280x800`), cobrindo todos os fluxos e estados da spec, **inspecionando visualmente screenshots**, checando `scrollWidth <= innerWidth` e ausência de erros no console.
   - **Se tocou Somente Backend**: execute requisições HTTP reais (`curl` / script) contra `http://localhost:8080/api/v1/...` validando payloads, cookies `HttpOnly`, status codes (sucesso + erro) e persistência.
   - Remova artefatos/screenshots temporários de validação (ex.: `.playwright-mcp/`) e encerre processos daemons temporários ao finalizar.

---

## Etapa 5 — Documentação, Handoff e Aprovação (Seções 7 e 8 do `AGENTS.md`)

1. **Sincronizar Documentação (`README.md` e `docs/`)**:
   - Revise e atualize os arquivos impactados em `README.md` e `docs/` (`arquitetura-c4.md`, `modelo-dominio-e-dados.md`, `fluxos-e-sequencias.md`, `algoritmo-sorteio.md`, `api-rest.md`, `seguranca-e-privacidade.md`, `deploy-e-ci-cd.md`).
2. **Atualizar Spec & Estado**:
   - Marque todas as tasks concluídas em `.specs/features/<feature>/tasks.md`.
   - Atualize `.specs/STATE.md` (novas `AD-xxx` se houver decisão arquitetural duradoura e `## Handoff` indicando entrega verificada aguardando aprovação).
3. **Solicitar Aprovação (Sem Commit/Push Antes)**:
   - Apresente um resumo objetivo do que foi implementado e dos resultados reais observados nos testes/Playwright/requests.
   - **Pergunte explicitamente ao usuário se as alterações estão aprovadas** para então realizar `git add`, `git commit` (Conventional Commits) e `git push` somente após a confirmação.
