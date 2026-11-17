# Reveal Modal Positioning Fix, Single-CTA Draw Page & Authenticated Reveal Contract — Tasks

**Feature**: `reveal-modal-and-auth-contract`  
**Spec**: `.specs/features/reveal-modal-and-auth-contract/spec.md`  
**Status**: Completed (Verified — Awaiting Approval)

---

## Backend (`backend/`)

- [x] **B1 — Exceções de Domínio e Busca por `userId` em `SecretSantaGroup`**:
  - [x] Criar `InvalidRevealPasswordException` e `UnauthorizedParticipantAccessException` em `com.secretsanta.domain.exception` (Java puro, sem dependências externas).
  - [x] Adicionar `requireParticipantByUserId(UUID userId)` em `SecretSantaGroup` lançando `UnauthorizedParticipantAccessException` quando o usuário não estiver inscrito no grupo.
  - [x] Adicionar testes unitários em `SecretSantaGroupTest` cobrindo `requireParticipantByUserId` (encontrado e não encontrado).

- [x] **B2 — Contrato Autenticado de Revelação (`SecretSantaApplicationService`, `GroupPublicController` e `GlobalExceptionHandler`)**:
  - [x] Atualizar `SecretSantaApplicationService.revealMatch(UUID groupId, UUID authenticatedUserId, String rawPassword)` para validar `authenticatedUserId`, exigir inscrição no grupo (`403`), verificar status `DRAWN` (`409`), validar senha da conta autenticada (`401 INVALID_PASSWORD`), marcar `REVEALED` e retornar `RevealMatchView`.
  - [x] Atualizar `GroupPublicController.revealMatch` para exigir cookie `HttpOnly` via `cookieManager.requireAuthenticatedUser(httpRequest)` e simplificar `RevealMatchRequest` exclusivamente para `record RevealMatchRequest(String password)` (sem `username` e sem `pin`).
  - [x] Mapear `InvalidRevealPasswordException` (`401`, `INVALID_PASSWORD`) e `UnauthorizedParticipantAccessException` (`403`, `FORBIDDEN_PARTICIPANT_ACCESS`) em `GlobalExceptionHandler`.

- [x] **B3 — Testes Backend (`mvn test`)**:
  - [x] Atualizar `GlobalExceptionHandlerTest` cobrindo `INVALID_PASSWORD` (`401`) e `FORBIDDEN_PARTICIPANT_ACCESS` (`403`).
  - [x] Atualizar `SecretSantaApplicationServiceIT` para a nova assinatura `revealMatch(groupId, userId, password)`, cobrindo usuário não autenticado, não participante (`UnauthorizedParticipantAccessException`), senha errada (`InvalidRevealPasswordException`), grupo `OPEN` e sucesso.
  - [x] Atualizar `GroupPublicControllerIT` cobrindo: ausência de cookie (`401 INVALID_CREDENTIALS`), tentativa de spoof enviando `"username": "<outro>"` no JSON (ignorada pelo backend — `401` com senha do outro ou `200` apenas com resultado do próprio usuário logado), senha errada (`401 INVALID_PASSWORD`), não participante (`403 FORBIDDEN_PARTICIPANT_ACCESS`), grupo `OPEN` (`409`) e sucesso (`200`).
  - [x] Executar `cd backend && mvn test` (incluindo `CleanArchitectureTest`) e validar 100% de sucesso.

---

## Frontend (`frontend/`)

- [x] **F1 — Correção Estrutural do Posicionamento `position: fixed` dos Modais**:
  - [x] Remover `animate-fade-slide-up` do `<main>` em `frontend/src/app/app.component.ts` para eliminar o *containing block* de `transform`.
  - [x] Atualizar `.animate-fade-slide-up` em `frontend/src/styles.css` para `animation: fadeSlideUp 200ms ease-out backwards;` (sem `forwards`), evitando retenção de `transform` após a animação.
  - [x] Atualizar os containers dos modais em `EphemeralRevealModalComponent` e `HomeGroupsPageComponent` para `fixed inset-0 z-50 ... flex p-4 overflow-y-auto` com `m-auto` no card interno.

- [x] **F2 — API Model, Service e Interceptor (`core/`)**:
  - [x] Atualizar `RevealMatchRequest` em `secret-santa-api.models.ts` para `{ password: string }`.
  - [x] Atualizar `shouldSkipAutoRefresh` em `auth-credentials.interceptor.ts` para que na rota `/participants/reveal` o refresh automático só seja acionado quando `401` tiver `errorCode === 'INVALID_CREDENTIALS'` (token expirado), ignorando refresh em `INVALID_PASSWORD` ou payload vazio.
  - [x] Atualizar `secret-santa-api.service.spec.ts` e `auth-credentials.interceptor.spec.ts` cobrindo o novo contrato e ambos os cenários de `401` no `/reveal`.

- [x] **F3 — Atualização de Copy em `EphemeralRevealModalComponent`**:
  - [x] Atualizar o texto de proteção de `"Modo Passar o Celular..."` para **"Sigilo de Natal"** e o botão de fechamento para **"Fechar"**, mantendo 100% do comportamento efêmero (limpeza ao fechar, `visibilitychange`, `ngOnDestroy` e zero storage persistente).
  - [x] Atualizar `ephemeral-reveal-modal.component.spec.ts` para o novo copy mantendo todas as asserções de sigilo.

- [x] **F4 — Reformulação da Página `DRAWN` em `PublicGroupPageComponent`**:
  - [x] Remover o formulário inline `revealForm`, campos `reveal-username`/`reveal-password`, o guia de 3 passos e o método `onSelectParticipantFromList`.
  - [x] Quando `authStore.isAuthenticated()`: exibir barra/linha discreta com usuário conectado e botão `"Trocar de conta"` (`logout()` + `authStore.clear()` + recarregar grupo).
  - [x] Quando `DRAWN` + autenticado + inscrito (`g.joined`): exibir card limpo apenas com o botão **"Ver meu presente"** (`data-testid="open-reveal-password-modal-btn"`).
  - [x] Implementar o **Modal de Confirmação de Senha** (`data-testid="reveal-password-modal"`), centralizado na viewport (`flex p-4 overflow-y-auto` + `m-auto`), com toggle de exibição de senha, alerta inline de erro (`reveal-password-error`), limpeza imediata da senha ao abrir/fechar/falhar/concluir/destruir, e disparo do `EphemeralRevealModalComponent` no sucesso.
  - [x] Quando `DRAWN` + não autenticado: exibir card compacto de login (`drawn-login-section`) para autenticar antes de liberar o botão **"Ver meu presente"**.
  - [x] Quando `DRAWN` + autenticado + não inscrito (`!g.joined`): exibir aviso `drawn-not-participant-notice`.
  - [x] Converter itens da lista de participantes no estado `DRAWN` para `<div>` informativos não clicáveis (`Já descobriu` / `Ainda não espiou`), adicionando selo discreto **"Você"** no card do usuário autenticado.
  - [x] Atualizar `public-group-page.component.spec.ts` cobrindo todos os cenários acima.

---

## Verificação Ponta a Ponta & Documentação

- [x] **V1 — Suítes Automatizadas e Build**:
  - [x] `cd backend && mvn test` (100% verde).
  - [x] `cd frontend && npm test` (100% verde) e `cd frontend && npm run build` (sem erros).

- [x] **V2 — Validação Real via Playwright MCP (`390x844` mobile e `1280x800` desktop)**:
  - [x] Subir MongoDB (`docker compose up -d`), backend (`:8080`) e frontend (`:4200`).
  - [x] Criar grupo com **12+ participantes**, realizar sorteio e acessar `/g/{groupId}` no Playwright MCP em `390x844`.
  - [x] Validar ausência do formulário inline, presença do botão `"Ver meu presente"`, troca de conta / login deslogado, lista não clicável com selo `"Você"`, abertura e validação de erro no modal de senha, e centralização real de ambos os modais (`boundingBox` dentro da viewport `0..844px` mesmo com 12+ participantes e página rolada).
  - [x] Validar bloqueio real no backend contra tentativa de revelar resultado de outro usuário (`username` injetado no payload / outro usuário sem cookie / não-membro).

- [x] **V3 — Documentação & Fechamento (Seções 7 e 8 do `AGENTS.md`)**:
  - [x] Atualizar `docs/api-rest.md`, `docs/fluxos-e-sequencias.md`, `docs/seguranca-e-privacidade.md` e `.specs/STATE.md` (`AD-010` + `Handoff`).
  - [x] Marcar tasks concluídas e solicitar aprovação explícita do usuário antes de `git commit` e `git push`.
