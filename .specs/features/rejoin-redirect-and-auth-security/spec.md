# Rejoin Redirect Fix, Strong Password Policy & HttpOnly Session Refresh Specification

**Status**: Approved  
**Approved**: 2026-11-16 - user: "Sim, confirmo a aprovação."  
**Created**: 2026-11-16  
**Scope**: Full-Stack (`backend/` + `frontend/`)  
**Base Specs**: `.specs/features/secret-santa/spec.md` (`AD-001`..`AD-005`), `.specs/features/festive-ui-ux/spec.md` (`AD-006`), `.specs/features/private-groups-ux-patch/spec.md` (`AD-007`), `.specs/features/signed-invite-and-favicon/spec.md` (`AD-008`)

---

## 1. Problem Statement

Três problemas foram identificados no fluxo atual de autenticação, entrada em grupos e segurança de sessão:

1. **Bug no Re-ingresso de Usuário já Cadastrado no Grupo (`409 Conflict` sem Autenticação/Redirecionamento)**:
   - Quando um usuário já cadastrado e já inscrito em um grupo acessa o link do grupo (`/g/{groupId}?sig=...`) sem estar logado no navegador e preenche o formulário de entrada (`username` + credencial) chamando `POST /api/v1/groups/{groupId}/participants`, o backend valida as credenciais em `loginUser(...)` com sucesso, mas em seguida `registerParticipantWithOptimisticRetry(...)` lança `DuplicateParticipantException` (`HTTP 409 Conflict`).
   - Como a exceção aborta a resposta antes de retornar a sessão autenticada, o usuário não recebe sessão e o frontend (`PublicGroupPageComponent.submitVisitorLoginAndJoin()`) apenas recarrega o grupo de forma anônima, mantendo o usuário preso no formulário de login com `joined = false` e `participantsVisible = false`, mesmo tendo acertado suas credenciais.

2. **Credencial Numérica Fraca (PIN de 4 a 6 Dígitos)**:
   - O sistema utiliza um PIN exclusivamente numérico de 4 a 6 dígitos para login, cadastro, revelação do amigo secreto e redefinição de senha, oferecendo baixa entropia contra ataques de força bruta.

3. **Ausência de Refresh Token e Armazenamento de Token no Cliente JS**:
   - O token de sessão atual possui validade fixa de 72h, não possui mecanismo de renovação (`refresh`) nem revogação explícita (`logout`), e é trafegado no JSON da API e mantido em memória JavaScript (`AuthSessionStore`) para envio via header `Authorization: Bearer ...`.

---

## 2. Goals

- [ ] **Correção do Bug de Re-ingresso no Grupo (`409 Conflict` → Autenticar e Redirecionar)**: Quando um usuário já participante tentar entrar novamente pelo formulário de login da página do grupo acertando suas credenciais, o backend deve emitir os cookies `HttpOnly` de sessão autenticada mesmo retornando `HTTP 409 Conflict` (`errorCode: "ALREADY_PARTICIPANT"`), e o frontend deve hidratar o estado autenticado, limpar `?sig=` da URL e redirecionar/exibir a página pública do grupo como membro inscrito.
- [ ] **Substituição do PIN por Senha Forte (Mínimo 6 Caracteres)**: Exigir no cadastro, redefinição de acesso e entrada de visitantes uma senha real de **6 a 64 caracteres** contendo pelo menos **1 letra maiúscula**, **1 letra minúscula**, **1 número** e **1 caractere especial** (sem espaços em branco), unificando login, revelação (`"Consultar Quem Eu Tirei"`) e redefinição (`/reset/:token`), mantendo retrocompatibilidade na validação de hashes BCrypt já gravados para usuários legados.
- [ ] **Sessão em Cookies `HttpOnly` com Access Token Curto + Refresh Token Persistido no MongoDB**: Emitir Access Token stateless curto (`15 minutos`) e Refresh Token opaco (`1 hora`) em cookies `HttpOnly` (com rotação e detecção de reuso no MongoDB, endpoint `GET /api/v1/auth/me` para hidratação no reload, `POST /api/v1/auth/refresh` automático no frontend e `POST /api/v1/auth/logout` com limpeza real dos cookies).

---

## 3. Out of Scope

| Item | Motivo |
| :--- | :--- |
| Unificação visual das rotas `/g/:groupId` e `/g/:groupId/admin` | Apenas analisada nesta etapa; sua eventual implementação ficará em uma spec dedicada posterior |
| Alteração na assinatura de convite (`?sig=`) ou remoção do `inviteSignature` | Modelo de convite assinado (`AD-008`) permanece inalterado |
| Alteração na regra de núcleo familiar (`<= 50m`) ou sorteio | Lógica de `HouseholdClusterService` e `DerangementDrawService` permanece inalterada |
| Exposição de quem tirou quem na sessão sem digitar a senha na revelação | `AD-003` permanece preservado: o modal de revelação continua exigindo `nome de usuário` + `senha` e limpando o resultado em memória |

---

## 4. Assumptions & Resolved Decisions

| Tópico | Decisão Fechada |
| :--- | :--- |
| **Regra da Senha Forte** | Comprimento de **6 a 64 caracteres** (mínimo 6, evitando fricção de 8+ caracteres no uso familiar), sem espaços em branco, com pelo menos: 1 maiúscula (`[A-Z]`), 1 minúscula (`[a-z]`), 1 dígito (`[0-9]`) e 1 caractere especial (`[^A-Za-z0-9\s]`). |
| **Unificação Senha ↔ Revelação ↔ Reset** | Login, cadastro, revelação (`POST /api/v1/groups/{groupId}/participants/reveal`) e redefinição por link (`/reset/:token`) passam a usar a mesma senha real do usuário. |
| **Retrocompatibilidade de Usuários Legados** | `loginUser` e `revealMatch` continuam comparando `passwordEncoder.matches(rawPassword, storedHash)` contra o hash BCrypt já salvo no MongoDB (usuários antigos com PIN de 4–6 dígitos ainda conseguem logar e revelar). Novos cadastros e redefinições exigem a nova política forte. |
| **Estratégia de Cookies `HttpOnly`** | Dois cookies `HttpOnly`: `ss_access_token` (JWT/HMAC curto, padrão `15 min`, `Path=/api/v1`) e `ss_refresh_token` (opaco aleatório 32 bytes com hash SHA-256 salvo no MongoDB, TTL **deslizante** de `1 hora` — renova +1h a cada rotação ativa —, `Path=/api/v1/auth`). Atributo `SameSite=Lax` (compatível com subdomínios `amigosecreto.tiagogodoy.site` ↔ `api-amigosecreto.tiagogodoy.site`) e `Secure` auto-detectado via `X-Forwarded-Proto` (`server.forward-headers-strategy: native`, com override opcional `SECRETSANTA_COOKIE_SECURE`), sem exigir novas variáveis obrigatórias no `docker-compose.prod.yml`. |
| **Autenticação Exclusiva por Cookies & CSRF** | Remover completamente o campo `token` das respostas JSON e não utilizar header `Authorization: Bearer` na camada web (autenticação exclusivamente via cookie `ss_access_token`). Proteção CSRF combinando `SameSite=Lax`, payloads `application/json` e `CORS_ALLOWED_ORIGINS` explícito em produção (`allowCredentials: true`, sem exigir header customizado que quebre testes via `curl`). |
| **Rotação, Reuso e Revogação de Refresh Token** | `POST /api/v1/auth/refresh` rotaciona o refresh token em família (`familyId`) estendendo a validade em `+1 hora` a partir da rotação. Caso um token já revogado seja reutilizado, toda a família é revogada imediatamente (`401`). `POST /api/v1/auth/logout` e redefinição de senha revogam os tokens ativos no banco e expiram os cookies (`Max-Age=0`). |
| **Bug do `409 Conflict` no Re-ingresso** | Em `POST /api/v1/groups/{groupId}/participants` (fluxo login de visitante sem `name`): após `loginUser` validar a senha com sucesso, verificar `group.hasParticipantWithUserId(user.id())` **antes** de checar `inviteSignature` (garantindo acesso mesmo se o link `?sig=` tiver sido rotacionado após a entrada do membro). Se já for participante, o backend **emite os cookies `HttpOnly` de sessão** na própria resposta `HTTP 409 Conflict` com `errorCode = "ALREADY_PARTICIPANT"` e metadados seguros do usuário (`userId`, `name`, `username`, `groupId`, `redirectPath: "/g/" + groupId`). No frontend, ao receber `409 ALREADY_PARTICIPANT`, atualiza `AuthSessionStore`, exibe `"Você já está inscrito neste grupo!"`, navega para `/g/:groupId` (removendo `?sig=`) e recarrega `getPublicGroup`. |
| **Segurança no Cadastro Duplicado (`name` preenchido)** | Se um visitante preencher `name` (tentativa de **novo cadastro** no grupo) com um `username` que já existe, lança `DuplicateUsernameException` (`409 CONFLICT`) **sem** emitir cookies nem redirecionar, mantendo proteção contra enumeração/tomada de conta. |
| **Manutenção do Fluxo "Passar o Celular" (`AD-003`)** | Como os tokens agora ficam em cookies `HttpOnly` (sobrevivendo a reloads), o botão `"Trocar / Sair"` passa a chamar `POST /api/v1/auth/logout` para limpar os cookies no servidor antes de limpar `AuthSessionStore` (preservando apenas `DeviceSessionGeoStore`). O resultado do sorteio (`drawnParticipantName`) continua exclusivamente em memória volátil de Signals e a revelação continua exigindo `nome de usuário` + `senha`. |

---

## 5. Especificação Detalhada — Backend (`backend/`)

### 5.1. Domínio (`com.secretsanta.domain..`) — 100% Java Puro (ArchUnit)

1. **`PasswordValidator`** (substitui ou evolui `PinValidator`, mantendo compatibilidade interna se necessário):
   - Método `validateRawPassword(String rawPassword)`:
     - Rejeita `null`, branco, comprimento `< 6` ou `> 64`, ou presença de qualquer whitespace (`\s`).
     - Exige ao menos 1 letra maiúscula (`Character.isUpperCase`), 1 letra minúscula (`Character.isLowerCase`), 1 dígito (`Character.isDigit`) e 1 caractere especial (não letra, não dígito, não espaço).
     - Lança `DomainValidationException` com mensagem clara em caso de falha.
2. **`UserAccount` e `PinHash` / `PasswordHash`**:
   - Renomear ou criar `PasswordHash` (mantendo compatibilidade de leitura com campo `pinHash` em `UserAccountDocument` no MongoDB para não quebrar documentos existentes).
3. **`RefreshToken` & `RefreshTokenRepository` (Port)** (`com.secretsanta.domain.model` / `com.secretsanta.domain.port`):
   - Entidade/Record de domínio `RefreshToken`: `UUID id`, `UUID userId`, `UUID familyId`, `String tokenHash` (SHA-256 hex), `Instant expiresAt`, `Instant revokedAt`, `Instant createdAt`.
   - Métodos puros: `isExpired(Instant now)`, `isRevoked()`, `revoke(Instant now)`.
   - Porta `RefreshTokenRepository`:
     - `RefreshToken save(RefreshToken token)`
     - `Optional<RefreshToken> findByTokenHash(String tokenHash)`
     - `void revokeFamily(UUID familyId, Instant revokedAt)`
     - `void revokeAllByUserId(UUID userId, Instant revokedAt)`
4. **`AlreadyGroupParticipantException`** (ou reutilizar `DuplicateParticipantException` distinguindo no `GlobalExceptionHandler`):
   - Mapear `DuplicateParticipantException` para `HTTP 409 Conflict` com `errorCode = "ALREADY_PARTICIPANT"` (separado de `DuplicateUsernameException` que permanece `errorCode = "CONFLICT"`).
   - Para o caso específico em que `registerVisitorAndJoinGroup` autenticou o usuário com sucesso antes de detectar participação duplicada, encapsular a sessão emitida junto à exceção (ex.: `AlreadyParticipantAuthenticatedException(AuthSessionResult session, UUID groupId)`) para que o controller possa gravar os cookies `HttpOnly` na resposta `409` sem vazar lógica HTTP para a camada de domínio/aplicação.

### 5.2. Aplicação (`com.secretsanta.application`)

1. **`StatelessSessionTokenService`**:
   - Atualizar TTL padrão do Access Token para `15 minutos` (`secretsanta.security.access-token-ttl-minutes: 15`).
   - Emitir e validar Access Token (`issueAccessToken` / `parseAndValidateAccessToken`).
   - Manter `generateInviteSignature(UUID groupId)` inalterado.
2. **`RefreshTokenService`** (ou métodos em `SecretSantaApplicationService`):
   - TTL padrão do Refresh Token: `1 hora` (`secretsanta.security.refresh-token-ttl-minutes: 60`).
   - Gera token opaco de 32 bytes via `SecureRandom` + Base64 URL-safe sem padding; persiste hash SHA-256 em `RefreshTokenRepository`.
   - `refreshSession(String rawRefreshToken)`:
     - Busca por `tokenHash`. Se não existir → `InvalidCredentialsException` (`401`).
     - Se `isRevoked()` → **revoga toda a família** (`revokeFamily`) e lança `InvalidCredentialsException` (`401`).
     - Se `isExpired(now)` → lança `InvalidCredentialsException` (`401`).
     - Revoga o token atual e cria novo `RefreshToken` na mesma `familyId` + emite novo Access Token.
   - `logoutSession(String rawRefreshToken)`:
     - Se `rawRefreshToken` válido/encontrado, marca como revogado no repositório.
3. **`SecretSantaApplicationService`**:
   - `registerUser(name, username, rawPassword)`: valida com `PasswordValidator.validateRawPassword`, salva `UserAccount` e emite par `(accessToken, refreshToken)`.
   - `loginUser(username, rawPassword)`: valida `passwordEncoder.matches` (suportando hashes novos e legados) e emite par `(accessToken, refreshToken)`.
   - `getCurrentUser(UUID userId)`: retorna `AuthUserView(userId, name, username)` (para `GET /api/v1/auth/me`).
   - `resetPasswordWithToken(rawToken, newRawPassword)`: valida com `PasswordValidator.validateRawPassword`, atualiza hash em `UserAccount` e chama `refreshTokenRepository.revokeAllByUserId(userId, now)`.
   - `registerVisitorAndJoinGroup(...)`:
     - No fluxo **login visitante** (`name == null || name.isBlank()`):
       1. Executa `loginUser(username, rawPassword)` → obtém `AuthSessionTokens`.
       2. Carrega `SecretSantaGroup`: se `group.hasParticipantWithUserId(user.id())` já for `true`, lança `AlreadyParticipantAuthenticatedException(session, groupId)` **sem** tentar inscrever novamente e **preservando** os tokens para o controller setar os cookies `HttpOnly` na resposta `409`.
       3. Se ainda não for participante: valida `inviteSignature` (exceto organizador) e conclui a inscrição (`201 Created`) + retorna tokens para cookies.
     - No fluxo **cadastro visitante** (`name` preenchido): mantém validação de grupo e `inviteSignature` **antes** de criar usuário (`403` se assinatura inválida; `409 CONFLICT` se username já existir).
   - `revealMatch(groupId, username, rawPassword)`: valida `passwordEncoder.matches` contra a senha do usuário (aceitando hashes novos e legados).

### 5.3. Persistência MongoDB (`infrastructure.persistence`)

1. **`RefreshTokenDocument`** (collection `refresh_tokens`):
   - Campos: `id` (`UUID`), `userId` (`UUID`), `familyId` (`UUID`), `tokenHash` (`String`), `expiresAt` (`Instant`), `revokedAt` (`Instant`), `createdAt` (`Instant`).
   - Índices em `SecretSantaIndexesChangeUnit`:
     - Índice único em `tokenHash`.
     - Índice em `userId` e `familyId`.
     - Índice TTL em `expiresAt` (`expireAfter(Duration.ZERO)`) para remoção automática pelo MongoDB após expiração.
2. **`UserAccountDocument`**:
   - Manter o campo `pinHash` no documento BSON (ou ler `passwordHash` com fallback para `pinHash`) para preservar 100% de compatibilidade com usuários já existentes na base sem migração destrutiva.

### 5.4. Camada Web, Cookies & CORS (`com.secretsanta.web`)

1. **`AuthCookieManager` (componente web)**:
   - Propriedades configuráveis (`application.yml`):
     - `server.forward-headers-strategy: native` (para detectar `X-Forwarded-Proto: https` atrás do proxy reverso em produção sem exigir nova env obrigatória no `docker-compose.prod.yml`).
     - `secretsanta.security.cookie.secure`: `${SECRETSANTA_COOKIE_SECURE:}` (vazio = auto-detectar via `request.isSecure()`, setando `Secure=true` em HTTPS e `false` em HTTP `localhost`; ou booleano explícito se configurado).
     - `secretsanta.security.cookie.same-site`: `${SECRETSANTA_COOKIE_SAME_SITE:Lax}`
     - `secretsanta.security.cookie.domain`: `${SECRETSANTA_COOKIE_DOMAIN:}` (vazio por padrão — cookie host-only para `api-amigosecreto.tiagogodoy.site`).
   - Nomes dos cookies:
     - `ss_access_token` (`HttpOnly`, `Path=/api/v1`, `Max-Age=accessTtlSeconds`)
     - `ss_refresh_token` (`HttpOnly`, `Path=/api/v1/auth`, `Max-Age=refreshTtlSeconds`)
   - Método `clearAuthCookies(HttpServletResponse, HttpServletRequest)` emitindo `Max-Age=0` para ambos os cookies (com os mesmos `Path`, `SameSite`, `Secure`).
2. **Resolução de Autenticação (`AuthRequestResolver`)**:
   - Extrai o Access Token **exclusivamente** do cookie `ss_access_token` (removendo `Authorization: Bearer` e o campo `token` dos JSONs).
   - **Atenção especial ao `GET /api/v1/groups/{groupId}`**: se não houver cookie `ss_access_token`, processa como anônimo; se houver um token inválido/expirado no cookie, retorna `401 Unauthorized` para disparar o fluxo de refresh automático no interceptor Angular.
3. **Endpoints REST (`/api/v1/auth` e `/api/v1/groups`)**:
   - `POST /api/v1/auth/register`: aceita `{ name, username, password }` (com fallback transitório para `pin` caso `password` venha nulo), seta cookies `HttpOnly` (`ss_access_token`, `ss_refresh_token`) e retorna `AuthUserView { userId, name, username }` (sem expor tokens no JSON).
   - `POST /api/v1/auth/login`: aceita `{ username, password }`, seta cookies `HttpOnly` e retorna `AuthUserView { userId, name, username }`.
   - `POST /api/v1/auth/refresh`: lê cookie `ss_refresh_token`, rotaciona tokens, seta novos cookies `HttpOnly` e retorna `AuthUserView { userId, name, username }` (ou `401` limpando cookies se inválido/expirado/revogado).
   - `POST /api/v1/auth/logout`: lê cookie `ss_refresh_token`, revoga no MongoDB, limpa ambos os cookies (`Max-Age=0`) e retorna `204 No Content`.
   - `GET /api/v1/auth/me`: valida cookie `ss_access_token`, retorna `AuthUserView { userId, name, username }` (ou `401`).
   - `POST /api/v1/auth/reset-password` (e alias `@PostMapping({"/reset-password", "/reset-pin"})`): aceita `{ token, newPassword }` (com fallback para `newPin`/`pin`), atualiza a senha, revoga refresh tokens do usuário e limpa cookies se houver.
   - `POST /api/v1/groups/{groupId}/participants`:
     - Aceita `{ name?, username?, password?, inviteSignature?, latitude?, longitude? }`.
     - Em sucesso (`201 Created`) no fluxo visitante: seta cookies `HttpOnly` e retorna `ParticipantRegistrationView` (sem `token` no corpo JSON).
     - No erro `AlreadyParticipantAuthenticatedException`: **seta os cookies `HttpOnly` na resposta** e retorna `HTTP 409 Conflict` (`ProblemDetail` com `errorCode = "ALREADY_PARTICIPANT"`, `userId`, `name`, `username`, `groupId`, `redirectPath = "/g/" + groupId`).
   - `POST /api/v1/groups/{groupId}/participants/reveal`: aceita `{ username, password }`.
4. **CORS (`WebCorsConfig`)**:
   - Habilitar `allowCredentials(true)` na configuração `/api/**`.
   - Expor `Set-Cookie` implicitamente tratado pelo browser; manter `Location` em `exposedHeaders`.
   - Em `application.yml` / `docker-compose.prod.yml`, garantir que `CORS_ALLOWED_ORIGINS` em produção contenha explicitamente `https://amigosecreto.tiagogodoy.site` (e local `http://localhost:4200`).

---

## 6. Especificação Detalhada — Frontend (`frontend/`)

### 6.1. Interceptor HTTP, Bootstrap de Sessão e `AuthSessionStore`

1. **`AuthCredentialsInterceptor` (`app.config.ts`)**:
   - Clona todas as requisições para `environment.apiUrl` (ou `/api/...`) com `withCredentials: true`.
   - Ao receber `401 Unauthorized` em endpoints que **não** sejam `/auth/login`, `/auth/register`, `/auth/refresh`, `/auth/logout`, `/participants/reveal` e `/participants` (visitante):
     - Aciona `POST /api/v1/auth/refresh` usando um mecanismo *single-flight* (`shareReplay` / sujeito compartilhado para evitar múltiplas chamadas simultâneas de refresh).
     - Se o refresh tiver sucesso: atualiza `AuthSessionStore` com o `AuthUserView` retornado e repete a requisição original.
     - Se o refresh falhar (`401`): limpa `AuthSessionStore` e propaga o erro.
2. **Bootstrap da Sessão (`provideAppInitializer`)**:
   - Na inicialização da aplicação, chama `GET /api/v1/auth/me` (que, caso o access cookie tenha expirado mas o refresh cookie esteja válido, passa automaticamente pelo fluxo de refresh no interceptor ou tenta `/auth/refresh` em fallback).
   - Se autenticado, preenche `AuthSessionStore` com `{ userId, name, username }`; caso contrário, mantém `null` (anônimo) sem exibir erro ao usuário.
3. **`AuthSessionStore`**:
   - Remover `token` do modelo `AuthSessionView` (`{ userId, name, username }`).
   - Nenhuma escrita em `localStorage`, `sessionStorage`, `IndexedDB`, cookies via JS ou URL.
4. **Logout real ("Trocar / Sair")**:
   - Em `HomeGroupsPageComponent.onSwitchFamilyUser()`, chamar `apiService.logout().subscribe(...)` (ou `finalize`) para invalidar os cookies `HttpOnly` no servidor, limpar `AuthSessionStore` e redirecionar/exibir a tela de login mantendo `DeviceSessionGeoStore`.

### 6.2. Política de Senha Forte na UI

1. Criar helper/validador compartilhado em `frontend/src/app/shared/` (ex.: `password-policy.ts`) e componente visual reutilizável **`PasswordCriteriaIndicatorComponent`** (`frontend/src/app/shared/components/password-criteria-indicator.component.ts`):
   - `PASSWORD_MIN_LENGTH = 6`, `PASSWORD_MAX_LENGTH = 64`.
   - Verifica: comprimento `6..64`, sem espaços (`!/\s/.test(value)`), pelo menos 1 maiúscula (`/[A-Z]/`), 1 minúscula (`/[a-z]/`), 1 número (`/[0-9]/`) e 1 caractere especial (`/[^A-Za-z0-9\s]/` — qualquer caractere especial imprimível).
   - `PasswordCriteriaIndicatorComponent` recebe o valor atual da senha em tempo real e renderiza um checklist acessível (`data-testid="password-criteria-indicator"`) indicando visualmente (ex.: ícone de check verde vs pendente neutro, além de alerta caso contenha espaços em branco) quais critérios mínimos já foram atingidos:
     - Mínimo de 6 caracteres (6 a 64)
     - Pelo menos 1 letra maiúscula (`A-Z`)
     - Pelo menos 1 letra minúscula (`a-z`)
     - Pelo menos 1 número (`0-9`)
     - Pelo menos 1 caractere especial (ex.: `! @ # $ % & *`)
     - Sem espaços em branco (exibido como alerta quando houver espaço)
2. Atualizar componentes e formulários:
   - **`HomeGroupsPageComponent` (Login `/`)**:
     - Campo `"Sua senha"` (`type="password"`, sem `inputmode="numeric"`, sem `maxlength="6"`, toggle mostrar/ocultar senha).
     - Validação mínima de não vazio no login (para aceitar também usuários legados que ainda tenham PIN antigo de 4–6 dígitos) e dica discreta orientando a solicitar o link de redefinição ao organizador caso esqueça a senha.
   - **`RegisterPageComponent` (`/cadastro`)**:
     - Campo `"Crie sua senha"` com `<app-password-criteria-indicator [password]="..." />` exibindo em tempo real os critérios atingidos e botão mostrar/ocultar senha.
   - **`PublicGroupPageComponent` (`/g/:groupId`)**:
     - `visitorLoginForm`: campo `password` (sem restrição numérica na entrada, aceitando legados e novas senhas) + dica de recuperação via organizador.
     - `visitorRegisterForm`: campo `password` com validação forte completa e `<app-password-criteria-indicator [password]="..." />` em tempo real.
     - `revealForm` (`"Consultar Quem Eu Tirei"`): campo `"Sua senha"` (sem `inputmode="numeric"` nem `maxlength="6"`, guia passo 2 atualizado para `"2. Digite sua senha"` e dica de recuperação via organizador).
   - **`ResetPinPageComponent` (`/reset/:token`)**:
     - Atualizar textos de `"PIN"` para `"Senha"` (`"Criar Nova Senha"`, `"Nova senha"`, `"Salvar Nova Senha"`), aplicar o validador de senha forte + `<app-password-criteria-indicator [password]="..." />` em tempo real e enviar para `POST /api/v1/auth/reset-password`.
   - **`AdminDashboardPageComponent` (`/g/:groupId/admin`)**:
     - Atualizar texto do botão `"Redefinir PIN"` → `"Redefinir Senha"` e mensagem de compartilhamento no WhatsApp para mencionar redefinição de **senha**.

### 6.3. Correção do Fluxo de Re-ingresso na Página do Grupo (`/g/:groupId`)

1. Em `PublicGroupPageComponent.submitVisitorLoginAndJoin()`:
   - Quando `err.status === 409` e `err.error?.errorCode === 'ALREADY_PARTICIPANT'` (ou `err.error?.userId`):
     - Se `err.error` contiver `{ userId, name, username }`, atualiza imediatamente `AuthSessionStore.setSession(...)`; como segurança adicional, confirma/hidrata via `GET /api/v1/auth/me` se necessário.
     - Limpa o formulário de login (`visitorLoginForm.reset()`, `showVisitorLoginPassword.set(false)`).
     - Define `statusMessage` (`"Você já está inscrito neste grupo!"`).
     - Limpa `?sig=` da URL via `router.navigate(['/g', this.groupId], { replaceUrl: true })` (e zera `this.inviteSignature = ''` local, já que agora está autenticado como membro).
     - Chama `loadPublicGroup()` (agora autenticado com o cookie `HttpOnly` emitido na resposta `409`), exibindo imediatamente o card de membro inscrito (`joined: true`) e a lista de participantes (`participantsVisible: true`).
2. Em `joinWithCurrentAuthenticatedUser()`:
   - Se retornar `409 ALREADY_PARTICIPANT`, limpa `?sig=` da URL, exibe `"Você já está inscrito neste grupo!"` e recarrega `loadPublicGroup()`.

---

## 7. Critérios de Aceitação (EARS)

1. WHEN um usuário já cadastrado e já participante de um grupo envia o formulário de login na página `/g/{groupId}?sig=...` (`POST /api/v1/groups/{groupId}/participants`) com credenciais válidas THEN the system SHALL autenticar a sessão via cookies `HttpOnly`, retornar `HTTP 409 Conflict` (`errorCode: "ALREADY_PARTICIPANT"`), autenticar o estado na UI, remover `?sig=` da URL e exibir a página pública `/g/{groupId}` como participante inscrito (`joined: true`, `participantsVisible: true`).
2. WHEN um visitante tenta criar uma **nova conta** (`name` preenchido) no grupo usando um `nome de usuário` já existente THEN the system SHALL retornar `HTTP 409 Conflict` (`CONFLICT`) sem emitir cookies nem autenticar a sessão.
3. WHEN um usuário se cadastra (`/cadastro` ou cadastro rápido no grupo) ou redefine sua senha (`/reset/:token`) com uma senha que não atende aos critérios (mínimo 6 caracteres, 1 maiúscula, 1 minúscula, 1 número, 1 caractere especial, sem espaços) THEN the system SHALL rejeitar no frontend e no backend (`HTTP 400 VALIDATION_ERROR`).
4. WHEN um usuário legado cadastrado anteriormente com PIN numérico realiza login ou revela seu amigo secreto THEN the system SHALL validar normalmente o hash BCrypt armazenado mantendo acesso funcional.
5. WHEN um usuário realiza login ou cadastro com sucesso THEN the system SHALL armazenar os tokens exclusivamente em cookies `HttpOnly` (`ss_access_token` de 15 min e `ss_refresh_token` de 1 hora com hash no MongoDB) sem expor tokens no payload JSON ou storage do navegador.
6. WHEN o usuário recarrega a página ou seu Access Token de 15 min expira enquanto o Refresh Token é válido THEN the system SHALL renovar a sessão automaticamente via `POST /api/v1/auth/refresh` (rotacionando o refresh token no MongoDB) e manter o usuário autenticado.
7. WHEN um Refresh Token já revogado é reutilizado em `POST /api/v1/auth/refresh` THEN the system SHALL revogar toda a família de tokens no MongoDB, limpar os cookies e retornar `HTTP 401`.
8. WHEN o usuário clica em `"Trocar / Sair"` THEN the system SHALL chamar `POST /api/v1/auth/logout`, revogar o refresh token no banco, expirar os cookies `HttpOnly` no navegador e limpar o estado de usuário mantendo apenas o cache de GPS do aparelho.
9. WHEN um usuário consulta quem tirou em um grupo sorteado (`DRAWN`) THEN the system SHALL exigir `nome de usuário` e `senha` individual no modal/formulário, mantendo o nome sorteado estritamente em memória volátil de Signals (`AD-003`).

---

## 8. Verificação Prevista (Pós-Implementação)

1. **Backend**: `cd backend && mvn test` (Domínio `PasswordValidator` / `RefreshToken`, `CleanArchitectureTest` ArchUnit, testes de integração de persistência `refresh_tokens`, rotação/reuso/logout, cookies `HttpOnly` e `409 ALREADY_PARTICIPANT` com `Set-Cookie`).
2. **Frontend**: `cd frontend && npm test` (Vitest: validador de senha forte, interceptor de refresh + `withCredentials`, `AuthSessionStore`, fluxo `409 ALREADY_PARTICIPANT` com redirect `/g/:groupId` e remoção de `?sig=`) e `cd frontend && npm run build`.
3. **Playwright E2E**:
   - Cadastro com validação de senha forte (rejeição de senha fraca e sucesso com senha válida).
   - Persistência de sessão via cookie `HttpOnly` após `page.reload()` + verificação de que `localStorage` e `sessionStorage` permanecem vazios de tokens/segredos.
   - Reprodução exata do bug: usuário já inscrito acessa `/g/{id}?sig=...` deslogado, faz login pelo formulário de convite, recebe `409` com cookies válidos e é redirecionado/atualizado automaticamente para `/g/{id}` exibindo `"Você já está inscrito neste grupo!"` e a lista de participantes.
   - Botão `"Trocar / Sair"` limpando cookies via `/auth/logout` após reload.
   - Sorteio, redefinição de senha via `/reset/:token` e revelação efêmera usando a senha forte.
