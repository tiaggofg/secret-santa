# Reveal Modal Positioning Fix, Single-CTA Draw Page & Authenticated Reveal Contract Specification

**Status**: Approved  
**Approved**: 2026-11-16 - user: "perfeito, a spec está aprovada"  
**Created**: 2026-11-16  
**Scope**: Full-Stack (`backend/` + `frontend/`)  
**Base Specs**: `.specs/features/secret-santa/spec.md` (`AD-001`..`AD-005`), `.specs/features/rejoin-redirect-and-auth-security/spec.md` (`AD-009`), `.specs/features/admin-panel-refactor/spec.md`

---

## 1. Problem Statement & Diagnóstico

Três problemas foram identificados no fluxo pós-sorteio (`/g/:groupId` no estado `DRAWN` e endpoint `POST /api/v1/groups/{groupId}/participants/reveal`):

1. **Bug de Posicionamento do Modal de Revelação (`EphemeralRevealModalComponent`) com Muitos Participantes**:
   - **Evidência**: Conforme captura de tela mobile fornecida pelo usuário, quando o grupo possui muitos participantes (lista longa abaixo do cartão principal), ao abrir o resultado do sorteio o modal (`ephemeral-reveal-card`) aparece deslocado para baixo, próximo à borda inferior da tela.
   - **Causa Raiz no Código**:
     - O container [`<main>`](file:///home/tiago.godoy@db1.com.br/workspace/tiaggofg/secret-santa/frontend/src/app/app.component.ts#L33) em `AppComponent` aplica a classe `.animate-fade-slide-up`.
     - Em [`styles.css`](file:///home/tiago.godoy@db1.com.br/workspace/tiaggofg/secret-santa/frontend/src/styles.css#L53-L66), `.animate-fade-slide-up` executa `animation: fadeSlideUp 200ms ease-out both;`, mantendo permanentemente `transform: translateY(0)` no `<main>` por causa de `animation-fill-mode: both` (`forwards`).
     - Pela especificação CSS, qualquer ancestral com `transform != none` cria um novo *containing block* para descendentes com `position: fixed`. Como `<app-ephemeral-reveal-modal>` é renderizado dentro de `<router-outlet>` (filho de `<main>`), seu backdrop `fixed inset-0` passa a medir a altura inteira do `<main>` (que cresce com a lista de participantes) em vez da altura da viewport, fazendo `flex items-center justify-center` empurrar o card para a metade/rodapé da página longa.

2. **Formulário Compartilhado Obsoleto na Página do Grupo Sorteado (`PublicGroupPageComponent`)**:
   - Atualmente, quando o grupo está em `DRAWN`, a página exibe um formulário inline (`reveal-form-section`) com 3 passos para "passar o celular", campo de `nome de usuário`, campo de `senha` e lista de participantes clicável que preenche o `username` de qualquer pessoa.
   - Como cada participante utiliza seu próprio celular e sua própria conta autenticada, o formulário inline e a seleção de outros usuários devem ser removidos da página, deixando apenas o botão **"Ver meu presente"**, com a confirmação de senha feita em um modal dedicado, e atualizando o texto do modal de revelação de "Modo Passar o Celular" para sigilo pessoal (**"Sigilo de Natal"** / botão **"Fechar"**).

3. **Contrato de Revelação no Backend Permite Tentativas Contra Outros Usuários**:
   - Atualmente, [`GroupPublicController.revealMatch`](file:///home/tiago.godoy@db1.com.br/workspace/tiaggofg/secret-santa/backend/src/main/java/com/secretsanta/web/GroupPublicController.java#L100-L111) não exige cookie de autenticação (`ss_access_token`) e recebe `username` + `password` (ou `pin`) no corpo da requisição (`RevealMatchRequest`).
   - Isso permite que um usuário autenticado (ou cliente anônimo) envie o `username` de outro participante tentando descobrir ou atacar a senha de terceiros.

---

## 2. Goals

- [ ] **Corrigir Definitivamente a Ancoragem Viewport dos Modais**: Eliminar o *containing block* indevido em `<main>` e garantir centralização real na viewport (`m-auto` em container `fixed inset-0 ... overflow-y-auto`) para o modal de revelação e o novo modal de senha, independentemente do número de participantes ou da posição de scroll.
- [ ] **Reformular a Página do Grupo Sorteado (`DRAWN`) para Fluxo Individual**: Remover o formulário inline e os cards clicáveis da lista de participantes, exibindo apenas o botão **"Ver meu presente"** para o participante autenticado e inscrito, com linha discreta de identidade + `"Trocar de conta"`, modal de confirmação de senha antes de revelar e selo **"Você"** na lista informativa.
- [ ] **Atualizar Copy do Modal de Revelação**: Substituir o aviso `"Modo Passar o Celular"` e o botão `"Fechar e passar o celular"` por copy voltado ao próprio dispositivo (**"Sigilo de Natal"** e botão **"Fechar"**), preservando 100% da limpeza efêmera em memória.
- [ ] **Restringir o Contrato de Revelação no Backend ao Usuário Autenticado**: Exigir cookie `HttpOnly` (`ss_access_token`) válido em `POST /api/v1/groups/{groupId}/participants/reveal`, simplificar `RevealMatchRequest` exclusivamente para `{ "password": "..." }` (removendo `username` e o alias legado `pin`) e vincular a consulta exclusivamente ao `userId` autenticado no token.
- [ ] **Validar Fluxos Ponta a Ponta via Playwright MCP**: Subir backend + frontend reais e validar os fluxos completos (inclusive com lista longa de participantes em viewport mobile) usando o Playwright MCP.

---

## 3. Out of Scope

| Item | Motivo |
| :--- | :--- |
| Alteração do fluxo de inscrição em grupos `OPEN` (login/cadastro de visitante via `?sig=`) | O fluxo de entrada em grupos abertos permanece inalterado. |
| Remoção da exigência de senha na revelação | A senha continua obrigatória via modal antes de abrir o presente. |
| Alterações no Painel do Organizador (`/g/:groupId/admin`) | Escopo coberto separadamente por `.specs/features/admin-panel-refactor/`. |
| Persistência de resultado sorteado ou senha em `localStorage`/`sessionStorage`/cookies | Mantida a invariante absoluta de sigilo efêmero em memória volátil (`EphemeralRevealModalComponent`). |

---

## 4. Especificação Técnica

### 4.1. Backend — Novo Contrato de Revelação Autenticada

#### 4.1.1. Endpoint `POST /api/v1/groups/{groupId}/participants/reveal`
- **Autenticação obrigatória**: [`GroupPublicController.revealMatch`](file:///home/tiago.godoy@db1.com.br/workspace/tiaggofg/secret-santa/backend/src/main/java/com/secretsanta/web/GroupPublicController.java#L100-L111) deve extrair `AuthenticatedUser` via `cookieManager.requireAuthenticatedUser(httpRequest)`.
  - Ausência de cookie `ss_access_token` ou token inválido/expirado → `401 Unauthorized` (`errorCode: "INVALID_CREDENTIALS"`).
- **Payload de Entrada (`RevealMatchRequest`)**:
  - Simplificar o record para aceitar **exclusivamente** `password` (removendo `username` e o alias legado `pin`):
    ```java
    public record RevealMatchRequest(String password) {}
    ```
  - Campos desconhecidos enviados no JSON (ex.: `"username": "outro.usuario"`) são ignorados pelo Jackson (sem falhar com `400`) e jamais consultados pela camada de aplicação.
- **Regras em `SecretSantaApplicationService.revealMatch(UUID groupId, UUID authenticatedUserId, String rawPassword)`**:
  1. Validar `authenticatedUserId != null` (senão `InvalidCredentialsException` → `401`, `INVALID_CREDENTIALS`).
  2. Validar `rawPassword != null && !rawPassword.isBlank()` (senão `InvalidRevealPasswordException` → `401`, `INVALID_PASSWORD`).
  3. Carregar grupo por `groupId` (`ResourceNotFoundException` → `404`, `RESOURCE_NOT_FOUND` se inexistente).
  4. Verificar que o usuário autenticado é participante inscrito no grupo via novo método de domínio `SecretSantaGroup.requireParticipantByUserId(UUID userId)`. Se não estiver inscrito → lançar `UnauthorizedParticipantAccessException` (`403 Forbidden`, `errorCode: "FORBIDDEN_PARTICIPANT_ACCESS"`).
  5. Verificar `group.status() == GroupStatus.DRAWN`. Caso contrário → `GroupNotDrawnYetException` (`409 Conflict`, `errorCode: "CONFLICT"`).
  6. Carregar `UserAccount` por `authenticatedUserId` e validar `passwordEncoder.matches(rawPassword, userAccount.pinHash().value())`. Se incorreta → `InvalidRevealPasswordException` (`401 Unauthorized`, `errorCode: "INVALID_PASSWORD"`).
  7. Marcar `REVEALED` atomicamente via `group.markRevealedAndGetDrawnName(participant.id(), now)`, salvar com retry otimista (`@Version`) e retornar `RevealMatchView(participantId, username, drawnParticipantName, revealedAt)`.

#### 4.1.2. Exceções de Domínio e Mapeamento HTTP (`GlobalExceptionHandler`)
- Novas exceções em `com.secretsanta.domain.exception` (Java puro, em conformidade com `CleanArchitectureTest`):
  - `InvalidRevealPasswordException` → `401 Unauthorized`, `errorCode = "INVALID_PASSWORD"`.
  - `UnauthorizedParticipantAccessException` → `403 Forbidden`, `errorCode = "FORBIDDEN_PARTICIPANT_ACCESS"`.
- Distinção entre `INVALID_CREDENTIALS` (sessão ausente/expirada) e `INVALID_PASSWORD` (senha digitada errada) permite que o frontend renove automaticamente o `ss_access_token` caso tenha expirado na tela sem confundir com senha incorreta.

---

### 4.2. Frontend — Correção de Centralização de Modais + Nova Página `DRAWN`

#### 4.2.1. Correção Estrutural de Posicionamento `position: fixed`
- Em [`AppComponent`](file:///home/tiago.godoy@db1.com.br/workspace/tiaggofg/secret-santa/frontend/src/app/app.component.ts#L33):
  - Remover `animate-fade-slide-up` de `<main class="flex-1 p-4 sm:p-5">`, evitando que `<main>` crie um *containing block* com `transform` para modais renderizados dentro do `<router-outlet>`.
- Em [`styles.css`](file:///home/tiago.godoy@db1.com.br/workspace/tiaggofg/secret-santa/frontend/src/styles.css#L64-L66):
  - Alterar `.animate-fade-slide-up` para `animation: fadeSlideUp 200ms ease-out backwards;` (sem `forwards`), evitando retenção de `transform: translateY(0)` após os 200ms da animação em qualquer elemento.
- Em [`EphemeralRevealModalComponent`](file:///home/tiago.godoy@db1.com.br/workspace/tiaggofg/secret-santa/frontend/src/app/features/public-group/ephemeral-reveal-modal.component.ts#L22-L28), no novo modal de senha e no modal de criação de grupo (`HomeGroupsPageComponent`):
  - Utilizar `fixed inset-0 z-50 ... flex p-4 overflow-y-auto` no backdrop e `m-auto` no card interno, garantindo centralização vertical e horizontal na viewport visível com rolagem segura caso o conteúdo exceda a altura útil (ex.: teclado virtual aberto).

#### 4.2.2. Reformulação de `PublicGroupPageComponent` no Estado `DRAWN`
1. **Identidade Discreta e Troca de Conta (`authStore.isAuthenticated()`)**:
   - Exibir uma linha discreta (ex.: `Conectado como {Nome} (@{username}) • Trocar de conta`, com `data-testid="public-group-switch-account-btn"`) permitindo encerrar a sessão atual (`POST /api/v1/auth/logout` + `authStore.clear()` + recarregamento do grupo) caso alguém precise trocar de usuário no mesmo aparelho.
2. **Usuário autenticado e participante do grupo (`authStore.isAuthenticated() && g.joined`)**:
   - Exibir apenas o card de ação (`data-testid="reveal-action-section"`) contendo mensagem curta e o botão único **"Ver meu presente"** (`data-testid="open-reveal-password-modal-btn"`).
   - **Remover** completamente o formulário inline (`reveal-form`), os campos `reveal-username` / `reveal-password` na página e o guia de 3 passos de passar o celular.
3. **Modal de Confirmação de Senha (`data-testid="reveal-password-modal"`)**:
   - Aberto ao clicar em **"Ver meu presente"**.
   - Exibe título (`"Confirmar senha"`), indicação de quem está consultando (`{{ currentParticipantDisplayName(g) }}` / `@{{ authStore.username() }}`), campo de senha (`#reveal-modal-password`) com botão olho (mostrar/ocultar), alerta de erro inline (`data-testid="reveal-password-error"`) em caso de senha vazia ou `401 INVALID_PASSWORD`, botão primário **"Ver meu presente"** (`data-testid="reveal-submit-btn"`) e ação de fechar/cancelar (`×` / `"Cancelar"`).
   - Limpa o campo de senha imediatamente ao abrir, fechar, falhar ou concluir a consulta, e em `ngOnDestroy`.
   - Ao obter sucesso de `revealMatch(groupId, { password })`, fecha o modal de senha, aciona `EphemeralRevealModalComponent` com o nome sorteado e recarrega o grupo (`loadPublicGroup()`).
4. **Usuário não autenticado no estado `DRAWN` (`!authStore.isAuthenticated()`)**:
   - Exibir card compacto de login (`data-testid="drawn-login-section"`) com `nome de usuário` e `senha` autenticando via `POST /api/v1/auth/login`. Após autenticar, atualiza `AuthSessionStore` e recarrega `getPublicGroup`, exibindo automaticamente o botão **"Ver meu presente"** (caso seja participante) ou o aviso de não inscrito.
5. **Usuário autenticado mas não inscrito no grupo (`authStore.isAuthenticated() && !g.joined`)**:
   - Exibir aviso (`data-testid="drawn-not-participant-notice"`) informando que o sorteio já foi realizado e que a conta atual não participa do grupo (mantendo o link `Painel do Organizador →` no topo caso `g.organizer`).
6. **Lista de Participantes no Estado `DRAWN` (`g.participantsVisible === true`)**:
   - Renderizar os participantes como cards informativos não clicáveis (`<div>`, igual ao estado `OPEN`) exibindo nome, `@username`, selo discreto **"Você"** (`data-testid="current-user-participant-badge"`) no card correspondente ao usuário autenticado e selo de status (`Já descobriu` / `Ainda não espiou`), removendo o handler `onSelectParticipantFromList`.

#### 4.2.3. Atualização de Copy em `EphemeralRevealModalComponent`
- Substituir o aviso `"Modo Passar o Celular: memorize o nome acima..."` por aviso de sigilo pessoal (ex.: **"Sigilo de Natal: memorize ou anote com cuidado. Ao fechar ou sair desta tela, o nome revelado é apagado imediatamente."**).
- Alterar o rótulo do botão de fechamento (`data-testid="close-and-pass-phone-btn"` ou `data-testid="close-reveal-modal-btn"`) para **"Fechar"**, mantendo a limpeza imediata de `drawnName` e `participantUsername` ao clicar, em `document:visibilitychange` (`hidden`) e em `ngOnDestroy`.

#### 4.2.4. API Service & Interceptor no Frontend
- [`SecretSantaApiService`](file:///home/tiago.godoy@db1.com.br/workspace/tiaggofg/secret-santa/frontend/src/app/core/api/secret-santa-api.service.ts#L78-L83) e [`RevealMatchRequest`](file:///home/tiago.godoy@db1.com.br/workspace/tiaggofg/secret-santa/frontend/src/app/core/api/secret-santa-api.models.ts#L134-L137): atualizar `RevealMatchRequest` para `{ password: string }` (sem `username`).
- [`authCredentialsInterceptor`](file:///home/tiago.godoy@db1.com.br/workspace/tiaggofg/secret-santa/frontend/src/app/core/auth/auth-credentials.interceptor.ts#L48-L66): na rota `/participants/reveal`, disparar refresh automático de sessão quando `401` tiver `errorCode === 'INVALID_CREDENTIALS'` (access token expirado), e ignorar o refresh quando for erro de senha (`INVALID_PASSWORD` ou payload vazio em testes).

---

## 5. Requisitos & Critérios de Aceitação (EARS)

1. WHEN um participante autenticado visualiza o resultado do sorteio em um grupo com muitos participantes (lista longa com scroll vertical) THEN the system SHALL exibir o modal `EphemeralRevealModalComponent` centralizado na viewport visível (`position: fixed` ancorado ao viewport, nunca deslocado para o fundo do `<main>`).
2. WHEN um participante autenticado e inscrito acessa `/g/:groupId` no estado `DRAWN` THEN the system SHALL ocultar qualquer formulário de usuário/senha da página e exibir apenas o botão `"Ver meu presente"` (`data-testid="open-reveal-password-modal-btn"`), indicação discreta da conta conectada com `"Trocar de conta"`, e a lista informativa (não clicável) de participantes com selo `"Você"` no seu próprio card.
3. WHEN o participante clica em `"Ver meu presente"` THEN the system SHALL abrir o modal de confirmação de senha centralizado na viewport; ao informar a senha correta e confirmar, SHALL chamar `POST /api/v1/groups/{groupId}/participants/reveal` apenas com `{ password }`, fechar o modal de senha e abrir o `EphemeralRevealModalComponent` com o amigo secreto sorteado e botão `"Fechar"`.
4. WHEN o participante informa uma senha incorreta no modal de senha THEN the system SHALL exibir erro amigável dentro do próprio modal mantendo-o aberto, limpar o campo de senha e não disparar `/auth/refresh`.
5. WHEN um usuário não autenticado acessa `/g/:groupId` no estado `DRAWN` THEN the system SHALL exibir card compacto de login e exigir autenticação antes de liberar a visualização do botão `"Ver meu presente"`.
6. WHEN qualquer cliente chama `POST /api/v1/groups/{groupId}/participants/reveal` sem cookie `ss_access_token` válido THEN the backend SHALL retornar `401 Unauthorized` (`INVALID_CREDENTIALS`).
7. WHEN um usuário autenticado envia `POST /api/v1/groups/{groupId}/participants/reveal` (mesmo tentando injetar `"username": "<terceiro>"` no JSON) THEN the backend SHALL ignorar o `username` do payload, validar a senha contra a conta autenticada no cookie e revelar exclusivamente o resultado do próprio usuário autenticado (ou retornar `403 FORBIDDEN_PARTICIPANT_ACCESS` se não for participante do grupo, ou `401 INVALID_PASSWORD` se a senha não corresponder ao usuário autenticado).
8. The system SHALL manter sigilo efêmero absoluto: `drawnParticipantName` e `password` nunca podem ser gravados em `localStorage`, `sessionStorage`, cookies ou URL, e o modal de revelação deve apagar o segredo ao fechar, em `visibilitychange` e em `ngOnDestroy`.

---

## 6. Plano de Verificação

1. **Backend (`cd backend && mvn test`)**:
   - `CleanArchitectureTest`, testes unitários de domínio (`SecretSantaGroupTest`), `GlobalExceptionHandlerTest` e testes de integração (`SecretSantaApplicationServiceIT`, `GroupPublicControllerIT`) cobrindo: sem cookie (`401`), tentativa de spoof de `username` (`401`/`200` apenas do próprio usuário), envio apenas de `password` sem `pin`, não-participante (`403`), grupo `OPEN` (`409`), senha errada (`401 INVALID_PASSWORD`) e revelação bem-sucedida (`200`).
2. **Frontend (`cd frontend && npm test && npm run build`)**:
   - Testes unitários de `SecretSantaApiService`, `authCredentialsInterceptor`, `EphemeralRevealModalComponent` e `PublicGroupPageComponent` atualizados para o novo fluxo com botão único + modal de senha + login quando deslogado + remoção de formulário/clique na lista + selo `"Você"` + troca de conta + copy atualizado.
3. **E2E Real com Playwright MCP**:
   - Subir backend (`:8080`) e frontend (`:4200`) locais com MongoDB (`docker compose up -d`).
   - Criar grupo com **12+ participantes**, realizar sorteio, abrir `/g/{groupId}` em viewport mobile (`390x844`).
   - Validar: ausência do formulário inline, presença do botão `"Ver meu presente"`, lista não clicável com selo `"Você"`, abertura do modal de senha centralizado, erro com senha incorreta, abertura do `EphemeralRevealModalComponent` centralizado na viewport (`boundingBox` dentro da área visível da viewport `0..844px`, mesmo com 12+ participantes e com scroll), limpeza ao fechar, troca de conta / login deslogado, e tentativa direta via API/cookie tentando ver resultado de outro participante bloqueada pelo backend.
4. **Documentação (Seção 8 do `AGENTS.md`)**:
   - Atualizar `docs/api-rest.md`, `docs/fluxos-e-sequencias.md` e `docs/seguranca-e-privacidade.md` refletindo o novo contrato autenticado de `/reveal` e o novo fluxo de UI com botão único + modal de senha.
