# Signed Invite URL, Group PIN Removal & Favicon Specification

**Status**: Approved  
**Approved**: 2026-11-15 - user: "perfeito, pode aprovar"  
**Created**: 2026-11-15  
**Scope**: Full-Stack (`backend/` + `frontend/` + `.github/workflows/`)  
**Base Specs**: `.specs/features/secret-santa/spec.md` (`AD-001`..`AD-005`), `.specs/features/festive-ui-ux/spec.md` (`AD-006`), `.specs/features/private-groups-ux-patch/spec.md` (`AD-007`)

---

## 1. Problem Statement

Após a introdução de grupos privados identificados por `UUID` e protegidos por `groupPin` (`AD-007`), identificou-se que exigir do organizador a criação e distribuição manual de um PIN numérico do grupo adiciona fricção desnecessária ao convite familiar pelo WhatsApp, além de exigir que o convidado digite duas credenciais distintas (PIN pessoal + PIN do grupo). Além disso, o frontend ainda não possui um `favicon.ico` próprio, exibindo o ícone padrão genérico do navegador.

Esta especificação propõe:

1. **Identidade na Aba do Navegador (`favicon.ico`)**: Definir um favicon natalino dedicado para o frontend Angular.
2. **Remoção do PIN de Grupo sem Perder a Privacidade**: Eliminar a definição e digitação de `groupPin` pelo organizador e pelos participantes, mantendo o grupo 100% privado.
3. **Convite Privado via URL Assinada Persistida no Banco**: Gerar e persistir no MongoDB uma assinatura criptográfica por grupo (`inviteSignature`), exigindo que o ingresso no grupo ocorra exclusivamente através da URL assinada (`/g/{groupId}?sig={inviteSignature}`).
4. **Nova Mensagem de Compartilhamento no WhatsApp**: Atualizar o texto de convite para o formato direto e acolhedor solicitado, garantindo que o fallback para área de transferência também copie a mensagem completa com o link assinado.

---

## 2. Goals

- [ ] **Favicon Natalino (`favicon.ico` + `favicon.svg`)**: Adicionar `favicon.ico` (e `favicon.svg` complementar) ao build do Angular e referenciá-lo em `frontend/src/index.html`.
- [ ] **Eliminação do PIN do Grupo**: Remover `groupPin` da criação de grupo, da alteração no painel admin, do modelo de domínio/persistência e dos formulários de entrada na página do grupo.
- [ ] **URL de Convite Assinada e Persistida**: Gerar assinatura criptográfica (HMAC-SHA256 com nonce aleatório) na criação do grupo, persistir `inviteSignature` no documento do grupo no MongoDB (`secret_santa_groups`) e validar em tempo constante (`MessageDigest.isEqual`) no `GET` e no `POST /participants`, impedindo entrada sem o link assinado válido (exceto para o próprio organizador).
- [ ] **Rotação/Regeneração de Convite pelo Organizador**: Permitir ao organizador gerar um novo link assinado no Painel Admin caso queira revogar um convite compartilhado indevidamente, invalidando imediatamente a assinatura anterior no banco.
- [ ] **Mensagem de Convite no WhatsApp Atualizada**: Compartilhar (e copiar no fallback desktop) a mensagem `"Participe do grupo de amigo secreto \"<Nome do Grupo>\" clicando no link abaixo:"` seguida do link assinado completo.
- [ ] **CI/CD no Portainer CE via API REST (`X-API-Key`)**: Criar workflow GitHub Actions (`.github/workflows/deploy-backend.yml`) para validar o backend (`mvn test`) e acionar o redeploy da stack Git no Portainer CE (`PUT /api/stacks/{id}/git/redeploy`) preservando as variáveis de ambiente da stack.

---

## 3. Out of Scope

| Item | Motivo |
| :--- | :--- |
| Migração de documentos legados com `groupPinHash` sem `inviteSignature` | Conforme alinhado, o banco será limpo/zerado antes do deploy, dispensando migração de registros antigos |
| Alteração na regra de núcleo familiar (`<= 50m`) ou algoritmo de sorteio | Lógica de `HouseholdClusterService` e `DerangementDrawService` permanece inalterada |
| Alteração no PIN pessoal do usuário (`UserAccount.pinHash`) | O PIN pessoal de 4 a 6 dígitos continua obrigatório para login e revelação efêmera ("Passar o Celular") |
| Expiração automática por tempo do link de convite | O convite permanece válido enquanto o grupo estiver `OPEN` ou até que o organizador gere uma nova assinatura |

---

## 4. Assumptions & Resolved Decisions

| Tópico | Decisão Proposta |
| :--- | :--- |
| **Formato do Favicon** | Criar `frontend/src/favicon.ico` (multi-resolução 16x16 / 32x32) e `frontend/src/favicon.svg` com ícone de presente/estrela natalina nas cores do tema (`#14532D` pinheiro, `#991B1B` cranberry e `#D97706` dourado), registrados em `angular.json` (`assets`) e `index.html`. |
| **Geração da Assinatura de Convite** | Ao criar um grupo, o backend gera `inviteSignature` assinando `groupId + ":" + randomNonce` via **HMAC-SHA256** (com a chave secreta da aplicação) codificada em Base64 URL-safe sem padding (`32` bytes / ~43 caracteres), persistindo o valor no campo `inviteSignature` do `SecretSantaGroupDocument`. |
| **Formato da URL Assinada** | `/g/{groupId}?sig={inviteSignature}`. O parâmetro `sig` é exclusivamente uma credencial de convite do grupo (não contém dados pessoais, PIN ou token de sessão, preservando `AD-003`). |
| **Exposição da Assinatura na API** | `inviteSignature` e `sharePath` assinado (`/g/{groupId}?sig={inviteSignature}`) são retornados **exclusivamente** no `AdminGroupView` (para o organizador autenticado). `PublicGroupView`, `GroupSummaryView` e `ParticipantRegistrationView` **jamais** expõem `inviteSignature`. |
| **Acesso do Organizador e Membros já Inscritos** | Ao acessar `/g/{groupId}` (por exemplo, via "Meus Grupos" na Home ou "Página Pública →" no Admin) sem `?sig=` na URL, usuários já autenticados que são **organizador** ou **já participantes** continuam visualizando normalmente o grupo (`participantsVisible: true`, `inviteValid: true`). O organizador também pode se inscrever no próprio grupo sem precisar informar `inviteSignature`. |
| **Acesso de Visitantes / Não-Membros sem Assinatura Válida (`OPEN`)** | Se alguém acessar `GET /api/v1/groups/{groupId}` (sem `?sig=` ou com `?sig=` inválido) e não for organizador nem membro, o backend retorna `inviteValid: false` e `participantsVisible: false` (`participants: []`), e o frontend bloqueia o formulário de inscrição exibindo aviso de que a entrada só é permitida pelo link de convite oficial do organizador. |
| **Proteção no Endpoint de Inscrição (`POST /participants`)** | Mesmo que alguém envie um request direto para `POST /api/v1/groups/{groupId}/participants`, o backend exige `inviteSignature` igual ao valor persistido no MongoDB (comparação constant-time) para qualquer usuário que não seja o organizador. Se ausente ou inválido, retorna HTTP `403 Forbidden` (`INVALID_INVITE_SIGNATURE`) **antes** de criar qualquer conta de usuário visitante (evitando contas órfãs). |
| **Estado `DRAWN` ("Passar o Celular")** | Quando `status == DRAWN`, o formulário `"Consultar Quem Eu Tirei"` em `/g/{groupId}` permanece acessível mesmo sem `?sig=` na URL, pois exige autenticação individual (`nome de usuário` + `PIN pessoal` de quem já está inscrito). |
| **Rotação do Link de Convite** | O Painel do Organizador oferece botão discreto `"Gerar Novo Link de Convite"` (`POST /api/v1/groups/{groupId}/admin/invite-link/rotate`) para invalidar a assinatura anterior no banco e emitir uma nova imediatamente. |
| **Mensagem de Compartilhamento WhatsApp** | Botão `"Convidar pelo WhatsApp"` usa a mensagem exata:<br>`Participe do grupo de amigo secreto "${g.eventName}" clicando no link abaixo:\n${fullSignedUrl}`.<br>No celular (`navigator.share` disponível), abre o compartilhamento nativo; no desktop (ou quando `navigator.share` não está disponível), copia a mensagem completa para a área de transferência **e** abre `https://wa.me/?text=<encodedMessage>` em nova aba (`noopener,noreferrer`). O botão secundário `"Copiar"` ao lado do link copia apenas a URL assinada completa. |

---

## 5. Especificação Detalhada — Backend (`backend/`)

### 5.1. Modelo de Domínio (`com.secretsanta.domain..`)

1. **`InviteSignature` (Value Object, Java puro)** (`com.secretsanta.domain.model`):
   - Encapsula `String value` não nulo e não vazio (validando formato URL-safe Base64 / comprimento mínimo seguro).
   - Método `matchesConstantTime(String candidate)` utilizando `MessageDigest.isEqual` (Java padrão `java.security.MessageDigest`, permitido no domínio).
2. **`SecretSantaGroup` (Aggregate Root)**:
   - Remover `PinHash groupPinHash` e o método `updateGroupPinHash(PinHash)`.
   - Adicionar `InviteSignature inviteSignature`.
   - Atualizar `SecretSantaGroup.create(String eventName, InviteSignature inviteSignature, UUID organizerUserId, Instant now)` (ou `create(UUID id, String eventName, InviteSignature inviteSignature, UUID organizerUserId, Instant now)` para que `id` possa ser usado na assinatura HMAC antes de construir o agregado) e `reconstitute(...)`.
   - Adicionar método `rotateInviteSignature(InviteSignature newSignature)` para rotação de convite pelo organizador.
3. **`InvalidInviteSignatureException`** (`com.secretsanta.domain.exception`):
   - Substitui `InvalidGroupPinException`.
   - Mapeada no `GlobalExceptionHandler` para HTTP `403 Forbidden` com `errorCode = "INVALID_INVITE_SIGNATURE"`.

### 5.2. Geração de Assinatura (`com.secretsanta.application`)

1. **`InviteSignatureService`** (ou método em `StatelessSessionTokenService`):
   - Gera `nonce` aleatório de 16 bytes via `SecureRandom` e calcula `HMAC-SHA256(secret, groupId + ":" + nonceBase64Url)` retornando string Base64 URL-safe sem padding.
   - Mantém segredo HMAC fora da camada `domain` (respeitando `CleanArchitectureTest` ArchUnit).

### 5.3. Persistência MongoDB (`infrastructure.persistence`)

1. **`SecretSantaGroupDocument`**:
   - Remover `groupPinHash`.
   - Adicionar campo `inviteSignature` (`String`, obrigatório).
2. **`MongoSecretSantaGroupAdapter`**:
   - Atualizar `toDocument` e `toDomain` para mapear `inviteSignature` <-> `InviteSignature`.

### 5.4. Contratos REST (`/api/v1`)

| Método | Endpoint | Auth | Request / Response & Regras |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/groups` | Bearer Token | Request: `{ "eventName": "..." }` (sem `groupPin`). Gera `UUID` e `InviteSignature`, persiste no MongoDB e retorna `AdminGroupView` (`201 Created`) com `sharePath: "/g/" + id + "?sig=" + inviteSignature`. |
| `GET` | `/api/v1/groups/{groupId}` | Bearer Opcional | Aceita query param opcional `?sig=...`. Retorna `PublicGroupView` com novo campo booleano `inviteValid` (`true` se `isOrganizer`, `joined` ou `sig` válido; `false` caso contrário). **Nunca** expõe `inviteSignature` nem altera `participantsVisible` (continua `false` para não-membros). |
| `POST` | `/api/v1/groups/{groupId}/participants` | Bearer ou Visitante | Request: `{ "name"?, "username"?, "pin"?, "inviteSignature"?, "latitude"?, "longitude"? }` (sem `groupPin`). Se autenticado e `group.isOrganizer(userId)`, `inviteSignature` é dispensado; caso contrário, exige `inviteSignature` idêntico ao persistido no banco (`403 INVALID_INVITE_SIGNATURE`). No fluxo visitante, valida existência do grupo e `inviteSignature` **antes** de criar nova `UserAccount`. |
| `GET` | `/api/v1/groups/{groupId}/admin` | Bearer (Organizador) | Retorna `AdminGroupView` com `sharePath: "/g/" + id + "?sig=" + inviteSignature`. |
| `POST` | `/api/v1/groups/{groupId}/admin/invite-link/rotate` | Bearer (Organizador) | Gera nova `InviteSignature`, persiste no grupo (invalidando o link anterior) e retorna `AdminGroupView` atualizado (`200 OK`). |
| `PUT` | `/api/v1/groups/{groupId}/admin/pin` | — | **Removido**. |

---

## 6. Especificação Detalhada — Frontend (`frontend/`)

### 6.1. Favicon (`frontend/`)

1. Criar `frontend/src/favicon.ico` e `frontend/src/favicon.svg` com identidade natalina (caixa de presente/estrela nas cores do app).
2. Configurar `assets` em `frontend/angular.json` (`"src/favicon.ico"`, `"src/favicon.svg"`) para inclusão no build de produção (`dist/`).
3. Adicionar `<link rel="icon" type="image/x-icon" href="favicon.ico">` e `<link rel="icon" type="image/svg+xml" href="favicon.svg">` no `<head>` de `frontend/src/index.html`.

### 6.2. Home & Modal `"Novo Amigo Secreto"` (`HomeGroupsPageComponent`)

1. Remover o campo `groupPin` (`PIN de Entrada do Grupo`) e toggle de visualização do modal `"Novo Amigo Secreto"`.
2. Manter apenas `"Nome do Evento (3 a 100 caracteres)"` e botão `"Criar Amigo Secreto"`.
3. `CreateGroupRequest` passa a enviar apenas `{ eventName }`.

### 6.3. Painel do Organizador (`AdminDashboardPageComponent`)

1. **Remover** completamente a seção `"Alterar PIN do Grupo"` (`updateGroupPinForm`, feedback e chamadas relacionadas).
2. **Exibir Link Assinado**:
   - Caixa do link exibe o link assinado completo (ou `g.sharePath`, `/g/{id}?sig=...`).
   - Botão **"Copiar"** ao lado do link copia diretamente a URL assinada completa (`navigator.clipboard.writeText(fullUrl)`), sem disparar o menu do WhatsApp/Web Share.
   - Botão **"Convidar pelo WhatsApp"** chama `ShareLinkService.shareLink(...)` com:
     - `title`: `Amigo Secreto: ${g.eventName}`
     - `text`: `Participe do grupo de amigo secreto "${g.eventName}" clicando no link abaixo:`
     - `pathOrUrl`: `g.sharePath` (`/g/${g.id}?sig=...`)
   - Em `ShareLinkService`:
     - Quando `navigator.share` estiver disponível, envia `{ title, text, url: fullUrl }`.
     - Quando `navigator.share` não estiver disponível (ex.: desktop) ou falhar, copia a mensagem completa formatada (`Participe do grupo de amigo secreto "${g.eventName}" clicando no link abaixo:\n${fullUrl}`) para a área de transferência e abre `https://wa.me/?text=${encodeURIComponent(fullMessage)}` em nova aba (`_blank`, `noopener,noreferrer`) caso `openWhatsAppFallback` esteja habilitado (sem bloquear se popup/window.open não existir em testes).
     - Método `copyUrl(pathOrUrl)` separado copia apenas `fullUrl` para o botão `"Copiar"`.
3. **Regenerar Link de Convite**:
   - Adicionar botão secundário discreto (`"Gerar Novo Link de Convite"`, `data-testid="rotate-invite-link-btn"`) que confirma/executa a rotação da assinatura via API e atualiza `g.sharePath` imediatamente, exibindo feedback de que o link anterior foi invalidado.

### 6.4. Página do Grupo (`/g/:groupId`) (`PublicGroupPageComponent`)

1. Ler o query param `sig` da rota (`this.route.snapshot.queryParamMap.get('sig') ?? ''`).
2. Passar `sig` para `GET /api/v1/groups/{groupId}?sig=...` e armazená-lo em memória no componente para envio no `POST /api/v1/groups/{groupId}/participants` (`inviteSignature`).
3. **Remover** os campos `PIN do grupo` de:
   - `visitorLoginForm`
   - `visitorRegisterForm`
   - `authenticatedGroupPinControl`
4. **Controle de Exibição quando `status === 'OPEN'` e `!g.joined`**:
   - Se `g.inviteValid || g.organizer`: exibe normalmente o card de entrada (login/cadastro rápido para visitante, ou botão `"Participar deste Grupo"` para usuário logado).
   - Se `!g.inviteValid && !g.organizer`: **não** exibe os formulários de inscrição; exibe cartão informativo claro (`data-testid="invalid-invite-notice"`):  
     `"Este grupo é privado. Para participar, acesse através do link de convite oficial enviado pelo organizador."`
5. **Estado `DRAWN` ("Passar o Celular")**:
   - Mantém o formulário `"Consultar Quem Eu Tirei"` normalmente acessível mesmo quando acessado sem `?sig=`.

---

## 7. Especificação Detalhada — Deploy Portainer CE (`.github/workflows/deploy-backend.yml`)

1. **Gatilho**:
   - `push` na branch `main` alterando `backend/**` ou `docker-compose.prod.yml`, além de `workflow_dispatch` para disparo manual.
2. **Etapas do Workflow**:
   - **Testes antes do deploy**: executa `mvn test` em `backend/` (Java 25) para impedir redeploy com regressões.
   - **Consulta prévia da stack (`GET /api/stacks/{PORTAINER_STACK_ID}`)**: usando header `X-API-Key: ${{ secrets.PORTAINER_API_KEY }}`, obtém o objeto `Env` atual da stack para não sobrescrever nem perder variáveis configuradas no Portainer (`MONGODB_URI`, `SECRETSANTA_TOKEN_SECRET`, `CORS_ALLOWED_ORIGINS`).
   - **Redeploy da stack Git (`PUT /api/stacks/{PORTAINER_STACK_ID}/git/redeploy?endpointId={PORTAINER_ENDPOINT_ID}`)**: stack criada via Git / Repository em instância HTTPS com certificado SSL válido (sem `-k`); envia payload JSON preservando `env` obtido, com `pullImage: true`, `prune: true`, `repositoryReferenceName: "refs/heads/main"` (e credenciais Git opcionais se o repositório for privado).
3. **Configuração via GitHub Secrets / Variables (zero segredos no código)**:
   - `PORTAINER_URL` (ex.: `https://seu-portainer.dominio.com` — acessível externamente pelos runners do GitHub)
   - `PORTAINER_API_KEY` (Access Token `ptr_...` gerado no perfil do Portainer CE)
   - `PORTAINER_STACK_ID` (ID numérico da stack no Portainer)
   - `PORTAINER_ENDPOINT_ID` (ID numérico do environment/endpoint no Portainer, geralmente `1` ou `2`)
   - Opcionais (somente se o repositório Git for privado): `PORTAINER_GIT_USERNAME` e `PORTAINER_GIT_PASSWORD` (PAT).

---

## 8. Critérios de Aceitação (EARS)

1. WHEN o frontend é compilado e servido THEN the system SHALL disponibilizar `/favicon.ico` (HTTP 200) e referenciá-lo no `<head>` de `index.html`.
2. WHEN o usuário autenticado abre o modal `"Novo Amigo Secreto"` THEN the system SHALL solicitar apenas o nome do evento (sem campo de PIN do grupo) e criar o grupo gerando e persistindo `inviteSignature` no MongoDB.
3. WHEN um grupo é consultado no Painel Admin (`GET /api/v1/groups/{groupId}/admin`) THEN the system SHALL retornar `sharePath` no formato `/g/{groupId}?sig={inviteSignature}` e não exibir a seção `"Alterar PIN do Grupo"`.
4. WHEN o organizador clica em `"Convidar pelo WhatsApp"` THEN the system SHALL compartilhar via `navigator.share` (no mobile) ou copiar a mensagem `Participe do grupo de amigo secreto "<Nome do Grupo>" clicando no link abaixo:` + URL assinada completa e abrir `https://wa.me/?text=...` em nova aba (no desktop).
5. WHEN um usuário não-organizador e não-membro acessa `/g/{groupId}` sem `?sig=` ou com assinatura inválida enquanto o grupo está `OPEN` THEN the system SHALL retornar `inviteValid: false` (sem expor `participants` nem `inviteSignature`) e bloquear a inscrição na UI e na API (`403 INVALID_INVITE_SIGNATURE`), sem criar usuário órfão.
6. WHEN um usuário (visitante ou autenticado) acessa `/g/{groupId}?sig={inviteSignature}` com a assinatura válida persistida no banco THEN the system SHALL permitir o cadastro/login e inscrição no grupo sem pedir nenhum PIN de grupo.
7. WHEN o organizador tenta se inscrever no próprio grupo (`/g/{groupId}`) THEN the system SHALL permitir a inscrição mesmo sem `?sig=` na URL.
8. WHEN o organizador aciona `"Gerar Novo Link de Convite"` THEN the system SHALL persistir uma nova `inviteSignature` no banco de dados, atualizando o link compartilhado e invalidando imediatamente o link assinado anterior.
9. WHEN ocorrer um `push` em `main` alterando `backend/**` ou `docker-compose.prod.yml` THEN the CI workflow SHALL rodar `mvn test` e, se passar, disparar o redeploy no Portainer CE via `PUT /api/stacks/{id}/git/redeploy` autenticado com `X-API-Key` preservando as variáveis `Env` existentes da stack.

---

## 9. Verificação Prevista (Pós-Implementação)

1. **Backend**: `cd backend && mvn test` (Domínio, `CleanArchitectureTest` ArchUnit, testes de integração de persistência e controllers).
2. **Frontend**: `cd frontend && npm test` (Vitest) e `cd frontend && npm run build` (verificando emissão de `favicon.ico` no bundle).
3. **Playwright E2E**: Fluxo completo em desktop e mobile validando carregamento do `favicon.ico`, criação de grupo sem PIN, bloqueio de acesso em `/g/{id}` sem assinatura válida, entrada com sucesso via `/g/{id}?sig=...`, texto/cópia do convite no Admin, rotação de link invalidando o antigo, sorteio e revelação efêmera.
