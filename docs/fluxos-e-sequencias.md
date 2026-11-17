# 🔄 Fluxos de Usuário e Diagramas de Sequência

Este documento detalha a jornada completa do usuário no Frontend Angular e os diagramas de sequência das principais operações ponta a ponta.

---

## 1. Fluxograma Geral da Aplicação

```mermaid
flowchart TD
    Start(["Acesso à Aplicação"]) --> Route{"Rota acessada"}

    Route -->|"/"| CheckAuth{"Sessão ativa<br/>em memória?"}
    CheckAuth -->|"Não"| LoginForm["Formulário de Login<br/>(nome de usuário + PIN)"]
    LoginForm -->|"Link Criar conta"| RegPage["/cadastro"]
    LoginForm -->|"Login OK"| MyGroups["Meus Grupos +<br/>Botão Criar Grupo"]
    CheckAuth -->|"Sim"| MyGroups
    MyGroups -->|"Clique Criar Grupo"| CreateModal["Modal Criar Grupo<br/>(eventName)"]
    CreateModal -->|"Criado"| AdminPage["/g/groupId/admin"]
    MyGroups -->|"Clique Gerenciar"| AdminPage
    MyGroups -->|"Clique Abrir"| PubPage["/g/groupId?sig=..."]

    Route -->|"/g/:groupId?sig=..."| PubPage
    PubPage --> GroupState{"Status do grupo?"}
    GroupState -->|"OPEN e sig válida"| JoinFlow{"Usuário logado<br/>ou visitante?"}
    JoinFlow -->|"Logado"| JoinAuth["Entrar com 1 toque + GPS"]
    JoinFlow -->|"Visitante"| JoinVisitor["Cadastrar + Entrar + GPS"]
    PubPage -->|"Botão Passar o Celular"| ClearSession["Limpa AuthSessionStore<br/>mantém GPS do aparelho"]
    GroupState -->|"DRAWN"| RevealBtn["Botão Revelar meu Amigo"]
    RevealBtn --> RevealModal["Modal Efêmero<br/>(nome de usuário + PIN)"]

    Route -->|"/g/:groupId/admin"| AdminPage
    AdminPage --> AdminState{"Status do grupo<br/>no Painel Admin?"}
    AdminState -->|"OPEN"| AdminOpen["Convidar WhatsApp / Copiar Link<br/>Rotacionar Convite (confirmação)<br/>Remover Participante (confirmação)<br/>Executar Sorteio"]
    AdminState -->|"DRAWN"| AdminDrawn["Barra de Progresso de Revelação<br/>Atalho Página de Revelação<br/>(Convite oculto)"]
    AdminOpen --> AdminReset["Gerar / Enviar / Copiar<br/>Link Reset Senha"]
    AdminDrawn --> AdminReset

    Route -->|"/reset/:token"| ResetPage["Formulário Novo PIN<br/>(4 a 6 dígitos)"]
```

---

## 2. Sequência 1 — Criação de Grupo e Ingresso por Convite Assinado

```mermaid
sequenceDiagram
    actor Org as Organizador
    actor Guest as Familiar (Visitante)
    participant SPA as Frontend Angular
    participant API as Backend REST
    participant DB as MongoDB

    Org->>SPA: Clica em "+ Criar Grupo" e informa eventName
    SPA->>API: POST /api/v1/groups (Bearer token)
    API->>API: Gera UUID + inviteSignature HMAC-SHA256
    API->>DB: Salva SecretSantaGroup (status=OPEN)
    DB-->>API: Documento salvo
    API-->>SPA: 201 Created (AdminGroupView com sharePath)

    Org->>SPA: Clica em "Compartilhar no WhatsApp"
    Note over Org,Guest: Envia /g/{groupId}?sig={inviteSignature}

    Guest->>SPA: Abre link de convite
    SPA->>API: GET /api/v1/groups/{groupId}?sig={inviteSignature}
    API-->>SPA: 200 OK (inviteValid=true, participantsVisible=true)

    Guest->>SPA: Preenche nome, nome de usuário, PIN e permite GPS
    SPA->>API: POST /api/v1/groups/{groupId}/participants (com inviteSignature + lat/lng)
    API->>API: Valida inviteSignature em tempo constante
    API->>DB: Cria UserAccount (BCrypt PIN) e adiciona Participant no grupo
    DB-->>API: Persistido com @Version
    API-->>SPA: 201 Created (ParticipantRegistrationView + Bearer token)
```

---

## 3. Sequência 2 — Execução do Sorteio com Restrição Geográfica

```mermaid
sequenceDiagram
    actor Org as Organizador
    participant SPA as AdminDashboardPageComponent
    participant API as GroupAdminController
    participant App as SecretSantaApplicationService
    participant Domain as SecretSantaGroup + Domain Services
    participant DB as MongoDB

    Org->>SPA: Clica em "Executar Sorteio"
    SPA->>API: POST /api/v1/groups/{groupId}/admin/draw (Bearer token)
    API->>App: executeDraw(groupId, requesterUserId)
    App->>DB: findById(groupId)
    DB-->>App: SecretSantaGroup
    App->>Domain: assertOrganizer(requesterUserId)
    App->>Domain: executeDraw(clusterService, drawService, now)
    Domain->>Domain: HouseholdClusterService (Haversine <= 50m + Union-Find)
    Domain->>Domain: DerangementDrawService (desarranjo inter-residencial)
    Domain-->>App: DrawResult (clusters, assignments, geographicRestrictionRelaxed)
    App->>DB: save(group) com @Version (gravação atômica)
    DB-->>App: Grupo atualizado (status=DRAWN)
    App-->>API: AdminGroupView (sem expor drawnParticipantId)
    API-->>SPA: 200 OK
```

---

## 4. Sequência 3 — Revelação Efêmera Autenticada (`DRAWN`)

```mermaid
sequenceDiagram
    actor P1 as Participante Autenticado
    participant SPA as PublicGroupPageComponent
    participant Modal as EphemeralRevealModalComponent
    participant API as GroupPublicController
    participant DB as MongoDB

    P1->>SPA: Clica em "Ver meu presente"
    SPA->>SPA: Abre modal de confirmação de senha (centralizado na viewport)
    P1->>SPA: Digita sua senha e confirma
    SPA->>API: POST /api/v1/groups/{groupId}/participants/reveal ({ password } + Cookie ss_access_token)
    API->>DB: Valida participação (403 se não inscrito), senha BCrypt do usuário autenticado (401 INVALID_PASSWORD) e marca revealedAt
    DB-->>API: Atualizado
    API-->>SPA: 200 OK (drawnParticipantName)
    SPA->>Modal: Fecha modal de senha e abre EphemeralRevealModalComponent
    Modal-->>P1: Exibe nome sorteado apenas em Signal de memória ("Sigilo de Natal")

    P1->>Modal: Clica em "Fechar" (ou troca de aba / visibilitychange)
    Modal->>Modal: Limpa drawnName e senha imediatamente
    Note over SPA,Modal: Caso precise trocar de usuário no aparelho, aciona "Trocar de conta" (POST /auth/logout)
```

---

## 5. Sequência 4 — Redefinição de PIN via Token Único

```mermaid
sequenceDiagram
    actor Org as Organizador
    actor User as Participante (Esqueceu o PIN)
    participant SPA as Frontend Angular
    participant API as Backend REST
    participant DB as MongoDB

    Org->>SPA: No Admin, clica em "Resetar PIN" para o participante
    SPA->>API: POST /api/v1/groups/{groupId}/admin/participants/{participantId}/reset-token
    API->>API: Gera token aleatório + hash SHA-256 (expira em 24h)
    API->>DB: Atualiza UserAccount (resetTokenHash, resetTokenExpiresAt)
    API-->>SPA: 200 OK (resetPath: /reset/{token})

    Org->>User: Envia link /reset/{token} pelo WhatsApp
    User->>SPA: Acessa /reset/{token} e informa novo PIN
    SPA->>API: POST /api/v1/auth/reset-pin (token, newPin)
    API->>DB: Valida hash + expiração, atualiza pinHash (BCrypt) e limpa token
    API-->>SPA: 200 OK (PinResetResultView)
```
