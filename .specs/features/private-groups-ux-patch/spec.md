# Private Groups & UX Corrections Patch Specification

**Status**: Approved
**Approved**: 2026-11-15 - user: "aprovo"
**Created**: 2026-11-15  
**Scope**: Full-Stack (`backend/` + `frontend/`)  
**Base Specs**: `.specs/features/secret-santa/spec.md` (`AD-001`..`AD-005`) e `.specs/features/festive-ui-ux/spec.md` (`AD-006`)

---

## 1. Problem Statement

Após a revisão funcional e visual do MVP natalino, foram identificados ajustes essenciais de experiência do usuário e de privacidade/segurança para tornar o aplicativo pronto para uso real entre famílias e amigos:

1. **Fluxo de Autenticação com Fricção**: A tela inicial hoje abre com um *switch* entre "Criar Cadastro" e "Já tenho conta", além de 3 pílulas técnicas no Hero (`Sem e-mail`, `PIN de 4-6 dígitos`, `Evita mesma casa`) e termos em inglês (`username`, `Seu Username`) pouco amigáveis para o público brasileiro.
2. **Nomenclatura e Textos Inconsistentes**: Botões e textos na Home e na página do grupo ainda exibem `"Criar Grupo"`, dicas de nomes no modal, botão `"Cadastrar outro familiar"`, exibição desnecessária de `(@username)` na saudação pessoal e `"Convidar Família no WhatsApp"`.
3. **Grupos Expostos por Slug Previsível e Sem Senha**: Atualmente os grupos são identificados por `slug` derivado do nome do evento (`/g/natal-da-familia-a1b2c3`), não exigem PIN/senha para ingresso, expõem a lista de participantes para qualquer visitante não autenticado e o serviço de listagem (`GET /api/v1/groups`) ainda consulta todos os grupos do banco e devolve `availableOpenGroups`.

---

## 2. Goals

- [ ] **Entrada Direta pelo Login + Rota Dedicada de Cadastro (`/cadastro`)**: Remover o *switch* de abas na tela de login (`/` e convite `/g/:groupId`), exibir o link `"Não tem uma conta? Clique aqui"` levando para `/cadastro` (com botão `"Concluir cadastro"`), simplificar o Hero do login removendo as 3 tags e adotando uma mensagem convidativa.
- [ ] **Padronização de Linguagem em Português**: Substituir todas as referências visíveis ao usuário de `"username"` por `"nome de usuário"`, atualizar `"Criar Grupo"` para `"Novo Amigo Secreto"` (e `"Criar Amigo Secreto"` no modal, sem dicas de nomes), `"Convidar pelo WhatsApp"` no Painel Admin, remover o botão de cadastrar outro familiar na página do grupo e omitir `(@username)` na saudação `"Olá, {Nome}"`.
- [ ] **Grupos 100% Privados Identificados por UUID Único**: Substituir `publicSlug` pelo `UUID` único do grupo em todas as URLs (`/g/{uuid}`, `/g/{uuid}/admin`) e endpoints REST (`/api/v1/groups/{groupId}...`), impedindo enumeração ou adivinhação de grupos.
- [ ] **Proteção por PIN de Entrada do Grupo (4 a 6 dígitos, BCrypt)**: Exigir PIN numérico do grupo na criação (`"Novo Amigo Secreto"`), ocultando a lista de participantes para quem não é membro nem organizador até entrar com o PIN válido, permitindo que o organizador entre no próprio grupo sem redigitar o PIN e redefina o PIN do grupo no Painel Admin se esquecer.
- [ ] **Listagem Restrita Exclusivamente aos Grupos do Usuário**: Remover `availableOpenGroups` da API e do Frontend, consultando no MongoDB exclusivamente os grupos em que o usuário autenticado é organizador ou participante.

---

## 3. Out of Scope

| Item | Motivo |
| :--- | :--- |
| Exibição em texto claro da senha/PIN do grupo após criação | O PIN do grupo é armazenado com hash BCrypt para proteção criptográfica; o organizador pode redefini-lo no Painel Admin caso esqueça |
| Migração de dados legados sem PIN ou com `publicSlug` antigo | Ambiente de desenvolvimento será limpo/resetado conforme alinhamento |
| Alteração na regra de núcleo familiar (`<= 50m`) ou sorteio | Lógica de `HouseholdClusterService` e `DerangementDrawService` permanece inalterada |

---

## 4. Assumptions & Resolved Decisions

| Tópico | Decisão Fechada |
| :--- | :--- |
| **Navegação Login → Cadastro** | Tela inicial (`/`) exibe apenas o formulário de login + Hero convidativo + link `"Não tem uma conta? Clique aqui"`, navegando para a rota dedicada `/cadastro` (sem Hero, com link `"Já tem uma conta? Entrar"`). |
| **Visitante não autenticado no convite (`/g/:groupId`)** | Aplica o mesmo padrão: abre direto no login com o link `"Não tem uma conta? Clique aqui"` que alterna inline para o formulário de cadastro rápido (sem switch/tablist), permitindo concluir inscrição no grupo na mesma página e retornando ao login via `"Já tem uma conta? Entrar"`. |
| **Mensagem convidativa do Hero (Login)** | Remover as 3 pílulas (`Sem e-mail`, `PIN de 4-6 dígitos`, `Evita mesma casa`) e exibir apenas a mensagem convidativa: `"Entre para criar seu Amigo Secreto ou participar dos sorteios com a família e amigos!"`. |
| **Botão de submit no Cadastro** | `"Concluir cadastro"` na rota dedicada `/cadastro`; `"Continuar"` no cadastro rápido dentro da página do grupo (`/g/:groupId`). |
| **Botão e Modal de Criação na Home** | Botões `+ Novo Amigo Secreto` (cabeçalho de `Meus Grupos` e estado vazio); título do modal `"Novo Amigo Secreto"`; remover chips de dicas de nomes; adicionar campo obrigatório de PIN do grupo (4 a 6 dígitos); botão de submit `"Criar Amigo Secreto"`. |
| **Página do Grupo: remoção de "cadastrar outro familiar" e `@username`** | Remover o botão `"Cadastrar outro familiar / Trocar de usuário neste aparelho"` e a menção na mensagem pós-inscrição (`"Aguarde o organizador realizar o sorteio."`). Na saudação pré-inscrição exibir `"Olá, {Nome}. Toque abaixo para confirmar sua participação neste grupo:"` (sem `(@username)`). Manter `@username` apenas nas listas de participantes, barra da Home, modal de revelação e Painel Admin para desambiguar nomes iguais. |
| **Substituição de `"username"`** | Trocar todas as ocorrências visíveis de `"username"` / `"Username"` por `"nome de usuário"` / `"Nome de usuário"` em rótulos, validações e mensagens de erro da UI (preservando a chave técnica `username` no JSON da API). |
| **Identificador único por UUID** | Substituir `publicSlug` pelo `UUID` do grupo em todas as URLs e rotas REST (`/g/{uuid}`, `/g/{uuid}/admin`, `/api/v1/groups/{groupId}...`). |
| **PIN do Grupo Privado** | Numérico de `4 a 6 dígitos` (`^\d{4,6}$`), definido pelo organizador na criação do grupo e armazenado como hash `BCrypt` (`PinHash`). O organizador pode entrar como participante no próprio grupo sem precisar informar o PIN do grupo, e pode redefinir o PIN do grupo no Painel Admin. |
| **Proteção de Dados em `/g/:groupId`** | Para não-membros/não-organizadores (ou visitantes anônimos), `GET /api/v1/groups/{groupId}` retorna apenas `id`, `eventName`, `status`, `participantCount` e `participantsVisible: false` (com `participants: []`). Apenas organizador ou participante inscrito recebe a lista completa de `participants`. |
| **Revelação no Estado `DRAWN` ("Passar o Celular")** | Quando `status == DRAWN`, mesmo que a lista de participantes esteja oculta para não-membros/deslogados, o formulário `"Consultar Quem Eu Tirei"` permanece acessível exigindo `Nome de usuário` + `PIN pessoal` do participante. Quando um membro/organizador está logado no aparelho, a lista aparece clicável normalmente. |
| **Compartilhamento no WhatsApp** | Botão no Painel Admin passa a se chamar `"Convidar pelo WhatsApp"`, com texto lembrando o convidado de pedir o PIN de entrada ao organizador (sem incluir o PIN no link). |
| **Listagem de Grupos (`GET /api/v1/groups`)** | Remove `availableOpenGroups` do backend e do frontend, retornando apenas `{ myGroups: [...] }` consultado diretamente no MongoDB por `organizerUserId` ou `participants.userId`. |

---

## 5. Especificação Detalhada — Backend (`backend/`)

### 5.1. Modelo de Domínio (`com.secretsanta.domain..`)

1. **`SecretSantaGroup` (Aggregate Root)**:
   - Remover a dependência de `GroupSlug` como identificador externo público (o `UUID id` passa a ser o único identificador de rota e link compartilhável do grupo).
   - Adicionar atributo obrigatório `PinHash groupPinHash` (armazenando hash BCrypt do PIN de 4 a 6 dígitos).
   - Atualizar `SecretSantaGroup.create(String eventName, PinHash groupPinHash, UUID organizerUserId, Instant now)` e `reconstitute(...)`.
   - Adicionar método `updateGroupPinHash(PinHash newGroupPinHash)` (exige validação via `assertOrganizer` na camada de domínio/aplicação).
   - Expor `groupPinHash()` apenas para persistência e verificação interna (jamais em DTOs/respostas REST).
2. **`InvalidGroupPinException`** (`com.secretsanta.domain.exception`):
   - Nova exceção de domínio lançada quando um usuário não-organizador tenta ingressar no grupo sem informar o PIN do grupo válido.
   - Mapeada no `GlobalExceptionHandler` para HTTP `403 Forbidden` (código `"INVALID_GROUP_PIN"`), distinguindo claramente erro de PIN do grupo de erro de login pessoal (`401 Unauthorized`).
3. **`SecretSantaGroupRepository` (Port)**:
   - Remover/substituir `findByPublicSlug` e `existsByPublicSlug` por `findById(UUID id)` (já existente ou padronizado).
   - Adicionar `List<SecretSantaGroup> findByUserParticipationOrOrganizationOrderByCreatedAtDesc(UUID userId)` (substituindo `findAllOrderByCreatedAtDesc()` para consultas de usuário).

### 5.2. Persistência MongoDB (`infrastructure.persistence`)

1. **`SecretSantaGroupDocument`**:
   - Adicionar campo `groupPinHash` (String, obrigatório).
   - Remover campo/índice `publicSlug` (ou descontinuar seu uso e remover o índice único de `publicSlug` em `SecretSantaIndexesChangeUnit`).
   - Adicionar índice em `organizerUserId` e `participants.userId` para acelerar a busca de `Meus Grupos`.
2. **`SpringDataSecretSantaGroupMongoRepository`**:
   - Query MongoDB dedicada:
     `@Query("{ '$or': [ { 'organizerUserId': ?0 }, { 'participants.userId': ?0 } ] }")`
     `List<SecretSantaGroupDocument> findByOrganizerOrParticipantOrderByCreatedAtDesc(UUID userId, Sort sort);`

### 5.3. Contratos REST (`/api/v1`)

| Método | Endpoint | Auth | Request / Response & Regras |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/groups` | Bearer Token | Retorna apenas `{ "myGroups": [ GroupSummaryView... ] }`, onde `GroupSummaryView` usa `id` (UUID) sem `slug` (ou mantendo `id` como identificador principal). Nenhum grupo de terceiros é retornado. |
| `POST` | `/api/v1/groups` | Bearer Token | Request: `{ "eventName": "...", "groupPin": "1234" }`. Valida `eventName` (3..100 chars) e `groupPin` (`^\d{4,6}$`). Retorna `AdminGroupView` (`201 Created`) com `id` e `sharePath: "/g/" + id`. |
| `GET` | `/api/v1/groups/{groupId}` | Bearer Opcional | Valida `groupId` como `UUID` (UUID inválido → `404`). Se `currentUserId` for organizador ou participante inscrito: retorna `participantsVisible = true` e lista `participants`. Caso contrário: retorna `participantsVisible = false`, `participants = []`, preservando `id`, `eventName`, `status`, `participantCount`, `organizer = false`, `joined = false`. |
| `POST` | `/api/v1/groups/{groupId}/participants` | Bearer ou Visitante | Request: `{ "name"?, "username"?, "pin"?, "groupPin"?, "latitude"?, "longitude"? }`. **Regra de PIN do grupo**: se autenticado e `group.isOrganizer(userId)`, `groupPin` é dispensado; caso contrário, exige `groupPin` válido compatível com `groupPinHash` (se inválido/ausente → `403 INVALID_GROUP_PIN`). **Importante**: no fluxo visitante (`register`/`login` + join), validar a existência do grupo e o `groupPin` **antes** de criar uma nova conta de usuário para evitar contas órfãs em caso de PIN do grupo errado. |
| `POST` | `/api/v1/groups/{groupId}/participants/reveal` | `username` + `pin` | Inalterado funcionalmente, apenas roteado por `{groupId}` (`UUID`). |
| `GET` | `/api/v1/groups/{groupId}/admin` | Bearer (Organizador) | Roteado por `{groupId}` (`UUID`). Retorna `AdminGroupView` com `id` e `sharePath: "/g/" + id`. |
| `PUT` | `/api/v1/groups/{groupId}/admin/pin` | Bearer (Organizador) | Request: `{ "groupPin": "5678" }`. Valida `^\d{4,6}$`, verifica organizador, atualiza `groupPinHash` e retorna `204 No Content` (ou `200 OK`). |
| `DELETE` | `/api/v1/groups/{groupId}/admin/participants/{participantId}` | Bearer (Organizador) | Roteado por `{groupId}` (`UUID`). |
| `POST` | `/api/v1/groups/{groupId}/admin/draw` | Bearer (Organizador) | Roteado por `{groupId}` (`UUID`). |
| `POST` | `/api/v1/groups/{groupId}/admin/participants/{participantId}/reset-token` | Bearer (Organizador) | Roteado por `{groupId}` (`UUID`). |

> **Nota sobre campos de View**: `GroupSummaryView`, `PublicGroupView`, `AdminGroupView` e `ParticipantRegistrationView` passam a expor `id` (`UUID`) e `sharePath` (`/g/{uuid}`), removendo `slug` / `groupSlug` (ou mantendo apenas `id` como identificador canônico). Nenhuma resposta REST jamais expõe `groupPinHash`, `pinHash`, `drawnParticipantId` ou `drawnParticipantName` fora do endpoint `/reveal`.

---

## 6. Especificação Detalhada — Frontend (`frontend/`)

### 6.1. Rotas (`app.routes.ts`)

- `/` → `HomeGroupsPageComponent` (Login quando deslogado; Meus Grupos quando logado).
- `/cadastro` → `RegisterPageComponent` (novo componente standalone dedicado para cadastro de usuário; se já estiver autenticado, redireciona para `/`).
- `/g/:groupId` → `PublicGroupPageComponent` (substitui `:slug` por `:groupId`).
- `/g/:groupId/admin` → `AdminDashboardPageComponent` (substitui `:slug` por `:groupId`).
- `/reset/:token` → `ResetPinPageComponent`.

### 6.2. Tela de Login (`/`) e Tela de Cadastro (`/cadastro`)

1. **Login em `/` (Não Autenticado)**:
   - Hero compacto `"Amigo Secreto"` com `"Edição de Natal"` e **apenas** a mensagem convidativa:  
     `"Entre para criar seu Amigo Secreto ou participar dos sorteios com a família e amigos!"`  
     (removidas as 3 tags `Sem e-mail`, `PIN de 4-6 dígitos`, `Evita mesma casa`).
   - Formulário direto de login (sem *switch*/`role="tablist"`):
     - Campo `"Seu nome de usuário"` (`login-username`).
     - Campo `"Seu PIN (4 a 6 dígitos)"` (`login-pin`) com botão de mostrar/ocultar PIN.
     - Botão submit `"Entrar"`.
   - Abaixo do formulário, link claro: `"Não tem uma conta? Clique aqui"` (`routerLink="/cadastro"`, `data-testid="go-to-register-link"`).

2. **Cadastro em `/cadastro` (`RegisterPageComponent`)**:
   - Sem Hero de marketing; cartão limpo com título `"Criar Conta"` e instruções claras.
   - Campos:
     - `"Seu Nome"` (`reg-name`)
     - `"Nome de usuário"` (`reg-username`, com sugestão automática ao digitar o nome e dica de caracteres válidos)
     - `"PIN Numérico (4 a 6 dígitos)"` (`reg-pin`) com toggle de mostrar/ocultar.
   - Botão submit com texto **"Concluir cadastro"** (`data-testid="register-submit"`).
   - Ao concluir, salva sessão em `AuthSessionStore` (memória volátil) e navega para `/`.
   - Link abaixo: `"Já tem uma conta? Entrar"` (`routerLink="/"`).

### 6.3. Home Autenticada & Modal `"Novo Amigo Secreto"` (`/`)

1. **Barra de Identidade**:
   - Exibe nome, `@username` (para diferenciação de conta) e botão discreto `"Trocar / Sair"`.
2. **Seção `"Meus Grupos"`**:
   - Botão no cabeçalho: `"+ Novo Amigo Secreto"` (`data-testid="open-create-group-modal-btn"`).
   - No estado vazio (`myGroups().length === 0`), botão também exibe `"+ Novo Amigo Secreto"`.
   - Cards exibem apenas os grupos vinculados ao usuário (`myGroups`); nenhuma seção de grupos disponíveis/públicos existe.
   - Links apontam para `['/g', group.id]` e `['/g', group.id, 'admin']`.
3. **Modal `"Novo Amigo Secreto"`**:
   - Título: `"Novo Amigo Secreto"`.
   - **Removidos** os chips de sugestões de nomes de evento.
   - Campo `"Nome do Evento (3 a 100 caracteres)"`.
   - Novo campo obrigatório: `"PIN de Entrada do Grupo (4 a 6 dígitos)"` (`data-testid="group-pin-input"`, `inputmode="numeric"`, `maxlength="6"`, toggle mostrar/ocultar PIN, validação inline `^\d{4,6}$`) com texto auxiliar explicando que o participante precisará desse PIN para entrar no grupo.
   - Botão submit: `"Criar Amigo Secreto"` (`data-testid="create-group-submit"`).

### 6.4. Página do Grupo (`/g/:groupId`)

1. **Navegação superior**:
   - Link `"← Voltar para Meus Grupos"` (`routerLink="/"`).
   - Link `"Painel do Organizador →"` quando `g.organizer === true`.
2. **Cartão do Evento**:
   - Exibe `eventName`, status (`Inscrições Abertas` / `Sorteio Realizado`), e contagem de participantes usando `g.participantCount` (já que `g.participants` vem vazio para não-membros).
3. **Estado `OPEN` — Usuário Não Autenticado**:
   - Card de convite abre **direto no formulário de login + PIN do grupo** (sem *switch*/`tablist`):
     - `"Seu nome de usuário"`
     - `"Seu PIN pessoal (4 a 6 dígitos)"`
     - `"PIN do grupo (4 a 6 dígitos)"` (`data-testid="visitor-group-pin-input"`)
     - Botão `"Entrar e Participar do Grupo"`
     - Link abaixo: `"Não tem uma conta? Clique aqui"` (alterna para o modo cadastro rápido inline).
   - No modo cadastro rápido inline:
     - `"Nome"`, `"Nome de usuário"`, `"Seu PIN pessoal (4 a 6 dígitos)"`, `"PIN do grupo (4 a 6 dígitos)"`.
     - Botão submit com texto **"Continuar"** (`data-testid="visitor-register-join-btn"`).
     - Link abaixo: `"Já tem uma conta? Entrar"` (retorna ao login inline).
4. **Estado `OPEN` — Usuário Autenticado**:
   - Se `!g.joined`:
     - Saudação **sem** `(@username)`: `"Olá, {{ authStore.name() }}. Toque abaixo para confirmar sua participação neste grupo:"`.
     - Se `!g.organizer`: exibe campo obrigatório `"PIN do grupo (4 a 6 dígitos)"` (`data-testid="authenticated-group-pin-input"`) acima do botão `"Participar deste Grupo"`.
     - Se `g.organizer`: exibe diretamente o botão `"Participar deste Grupo"` sem pedir o PIN do grupo.
   - Se `g.joined`:
     - Exibe confirmação `"Você já está inscrito neste grupo, {{ authStore.name() }}!"` e texto `"Aguarde o organizador realizar o sorteio."`.
   - **Removido completamente** o botão `"Cadastrar outro familiar / Trocar de usuário neste aparelho"`.
5. **Estado `DRAWN` — Revelação ("Passar o Celular")**:
   - Mantém a seção `"Consultar Quem Eu Tirei"` com guia em 3 passos (ou instrução clara caso a lista esteja oculta para visitantes não logados), campos `"Seu nome de usuário"` e `"Seu PIN (4 a 6 dígitos)"`, e botão `"Abrir Meu Presente"`.
6. **Lista de Participantes**:
   - Se `g.participantsVisible === true` (membro ou organizador logado): exibe a lista de participantes normalmente (informativa quando `OPEN`; clicável para pré-preencher o nome de usuário quando `DRAWN`).
   - Se `g.participantsVisible === false`: exibe aviso discreto de grupo privado informando que a lista de participantes é visível apenas para membros inscritos neste grupo.

### 6.5. Painel do Organizador (`/g/:groupId/admin`)

1. Botão de compartilhamento: **"Convidar pelo WhatsApp"** (`data-testid="share-group-link-btn"`), com texto compartilhado lembrando o convidado de solicitar o PIN do grupo ao organizador (ex: `Participe do grupo "${g.eventName}" no Amigo Secreto! Peça o PIN de entrada ao organizador.`).
2. Seção de link copiável exibindo `/g/${g.id}`.
3. Nova seção discreta **"Alterar PIN do Grupo"** (exibida enquanto `OPEN` ou sempre disponível ao organizador) permitindo informar um novo PIN de 4 a 6 dígitos + botão `"Salvar Novo PIN do Grupo"` (`data-testid="update-group-pin-btn"`), com feedback inline de sucesso/erro.

### 6.6. Substituição Global de `"username"` na UI

Varredura completa em todos os componentes (`HomeGroupsPageComponent`, `RegisterPageComponent`, `PublicGroupPageComponent`, `AdminDashboardPageComponent`, `ResetPinPageComponent`, `EphemeralRevealModalComponent`) para garantir que nenhuma label, placeholder, mensagem de validação ou mensagem de erro exibida ao usuário contenha a palavra `"username"` / `"Username"`.

---

## 7. Critérios de Aceitação (EARS)

1. WHEN um usuário não autenticado acessa `/` THEN the system SHALL abrir diretamente o formulário de login sem *tablist*, exibindo no Hero apenas a mensagem convidativa (sem as 3 tags) e o link `"Não tem uma conta? Clique aqui"` apontando para `/cadastro`.
2. WHEN o usuário acessa `/cadastro` e preenche nome, nome de usuário e PIN (4-6 dígitos) THEN the system SHALL exibir o botão `"Concluir cadastro"`, criar a conta via `POST /api/v1/auth/register` e redirecionar para `/`.
3. WHEN o usuário autenticado acessa `/` THEN the system SHALL exibir apenas seus grupos (`GET /api/v1/groups` sem `availableOpenGroups`), o botão `"+ Novo Amigo Secreto"` e o modal `"Novo Amigo Secreto"` (sem dicas de nomes) exigindo nome do evento e PIN numérico de 4-6 dígitos, com botão `"Criar Amigo Secreto"`.
4. WHEN um grupo é criado THEN the system SHALL gerar um `UUID` único como identificador público (`/g/{uuid}` e `/g/{uuid}/admin`) e armazenar o PIN do grupo com hash BCrypt sem jamais retorná-lo em texto claro na API.
5. WHEN um usuário não-membro e não-organizador acessa `GET /api/v1/groups/{groupId}` THEN the system SHALL retornar apenas metadados básicos (`id`, `eventName`, `status`, `participantCount`, `participantsVisible: false`) com `participants: []`.
6. WHEN um participante (não-organizador) tenta entrar em um grupo (`POST /api/v1/groups/{groupId}/participants`) THEN the system SHALL validar o `groupPin` informado contra o hash do grupo, retornando `403 Forbidden` (`INVALID_GROUP_PIN`) se incorreto ou ausente, sem criar usuário órfão em caso de cadastro simultâneo.
7. WHEN o organizador do grupo tenta se inscrever como participante do próprio grupo THEN the system SHALL permitir a inscrição sem exigir a digitação do `groupPin`.
8. WHEN o organizador acessa `/g/{uuid}/admin` THEN the system SHALL exibir o botão `"Convidar pelo WhatsApp"` e permitir redefinir o PIN de entrada do grupo via `PUT /api/v1/groups/{groupId}/admin/pin`.
9. WHEN um usuário autenticado acessa `/g/{uuid}` THEN the system SHALL não exibir o botão `"Cadastrar outro familiar / Trocar de usuário neste aparelho"` e exibir a saudação `"Olá, {Nome}. Toque abaixo para confirmar sua participação neste grupo:"` sem `(@username)`.
10. WHEN o grupo está no estado `DRAWN` THEN the system SHALL permitir que qualquer participante revele quem tirou informando `Nome de usuário` + `PIN pessoal` no formulário `"Consultar Quem Eu Tirei"`, mesmo quando a lista de participantes estiver oculta por não haver usuário logado.
11. The system SHALL não conter o termo `"username"` em nenhum texto visível da interface de usuário no Frontend.

---

## 8. Verificação Prevista (Pós-Implementação)

1. **Backend**: `cd backend && mvn test` (Testes de Domínio, `CleanArchitectureTest` ArchUnit, `SecretSantaApplicationServiceIT`, `MongoPersistenceAdaptersIT`, `GroupPublicControllerIT`, `GroupAdminAndAuthControllerIT`).
2. **Frontend**: `cd frontend && npm test` (Vitest) e `cd frontend && npm run build`.
3. **Playwright E2E**: Validação real ponta a ponta em desktop e mobile cobrindo login direto, navegação para `/cadastro` (`"Concluir cadastro"`), criação via modal `"Novo Amigo Secreto"` com PIN do grupo, proteção da lista para não-membros, entrada via convite `/g/{uuid}` com PIN do grupo (login e cadastro com `"Continuar"`), entrada direta do organizador, alteração de PIN do grupo no Admin, `"Convidar pelo WhatsApp"`, sorteio e revelação efêmera.
