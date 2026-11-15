# STATE

## Decisions

### AD-001
- **Decision**: Modelar o cadastro básico (`name`, `username` único e `pin` numérico de 4 a 6 dígitos com hash BCrypt) como uma identidade de usuário da plataforma (`UserAccount`), permitindo que após o cadastro ou login o usuário visualize **"Meus Grupos"** e **"Grupos Disponíveis (Abertos)"** para se inscrever com 1 toque ou ingressar diretamente pelo link do WhatsApp (`/g/{slug}`). O usuário logado que cria um grupo torna-se automaticamente seu **Organizador (`organizerUserId`)** (sem necessidade de senha de admin separada), pode gerar links únicos de redefinição de PIN (`/reset/{token}`) para membros do seu grupo e a UI oferece o botão **"Cadastrar outro familiar / Trocar de usuário neste aparelho"** que limpa a sessão em memória mantendo apenas o GPS do dispositivo para inscrição rápida de dependentes.
- **Reason**: Permite que o familiar se cadastre uma única vez e veja imediatamente os grupos abertos da família para entrar (ou entre direto pelo link do WhatsApp), elimina a necessidade do organizador decorar uma segunda senha administrativa por grupo, garante privacidade na redefinição de senha por link único e preserva o fluxo familiar compartilhado no mesmo celular.
- **Trade-off**: Introduz a collection `users` no MongoDB ao lado de `secret_santa_groups`, mantendo os subdocumentos `participants` dentro do documento do grupo para preservar a atomicidade nativa do sorteio.
- **Scope**: Domínio (`UserAccount`, `SecretSantaGroup`), Persistência MongoDB (`users` e `secret_santa_groups`), Autenticação Bearer stateless em memória e fluxos de Home/Grupo/Reset no Angular.
- **Date**: 2026-11-13
- **Status**: active

### AD-002
- **Decision**: Agrupar núcleos familiares por componentes conexos de proximidade geográfica (`<= 50m` via fórmula de Haversine) e validar a condição de existência de desarranjo multipartido (`tamanho_max_nucleo <= floor(N / 2)`) antes do sorteio, aplicando relaxamento automático da restrição geográfica caso seja matematicamente impossível.
- **Reason**: Garante que pessoas da mesma residência não tirem umas às outras sempre que houver solução matemática válida, sem nunca travar o evento caso uma única casa concentre mais da metade dos participantes.
- **Trade-off**: Em eventos onde mais de 50% dos participantes estão na mesma casa, algum participante desse núcleo inevitavelmente tirará alguém da mesma residência, sendo o relaxamento registrado em flag de metadado do sorteio (`geographicRestrictionRelaxed`) sem expor pares.
- **Scope**: Domínio de sorteio (`HouseholdClusterService`, `DerangementDrawService` e `SecretSantaGroup` Aggregate).
- **Date**: 2026-11-12
- **Status**: active

### AD-003
- **Decision**: Manter o resultado da revelação do Amigo Secreto (`drawnParticipantName`), o `PIN` digitado e a sessão do aparelho exclusivamente em memória volátil de Signals no Angular (com limpeza imediata no fechamento do modal, ao trocar de usuário, em `ngOnDestroy` e em `visibilitychange`), proibindo armazenamento em `localStorage`, `sessionStorage`, `IndexedDB`, cookies ou parâmetros de URL.
- **Reason**: Permite o fluxo "Passar o Celular" e o cadastro/consulta de vários familiares no mesmo dispositivo sem risco de vazamento visual para a próxima pessoa.
- **Trade-off**: O participante informa seu `username` + `PIN` (4 a 6 dígitos) sempre que desejar reconsultar quem tirou ou após passar o celular para outro familiar.
- **Scope**: Arquitetura do Frontend Angular (`EphemeralRevealModalComponent` e `AuthSessionStore`).
- **Date**: 2026-11-13
- **Status**: active

### AD-004
- **Decision**: Adotar no Frontend a stack **Angular 19+ (Standalone Components, Signals, Native Control Flow `@if`/`@for` e Reactive Forms)** estilizado com **Tailwind CSS** (componentes próprios mobile-first de alto contraste e alvos de toque amplos), **Vitest** como test runner unitário headless, **ícones SVG leves** (Lucide/SVG inline) e **Web Share API nativa (`navigator.share`)** com fallback para `navigator.clipboard.writeText` no compartilhamento do link do grupo (`/g/{slug}`) e do link de redefinição (`/reset/{token}`).
- **Reason**: Garante bundle leve e carregamento instantâneo em redes móveis, acessibilidade visual para crianças e idosos, compartilhamento direto no WhatsApp da família com 1 toque e execução rápida/determinística de testes unitários com Vitest sem depender de binário do Chrome no ambiente.
- **Trade-off**: Componentes de UI (cards, modais, botões) são construídos sob medida com utilitários Tailwind CSS em vez de usar uma biblioteca pesada de componentes prontos.
- **Scope**: Toda a aplicação Frontend (`frontend/`).
- **Date**: 2026-11-13
- **Status**: active

### AD-005
- **Decision**: Adotar **MongoDB** como banco de dados do Backend dentro de uma **Clean Architecture estrita validada por ArchUnit**, modelando `UserAccount` na collection `users` (índice único em `username`) e o Aggregate Root `SecretSantaGroup` como um **documento único** na collection `secret_santa_groups` (com a lista de `participants` embutida, índice único em `publicSlug` via `auto-index-creation: true` / Mongock e `@Version` para controle de concorrência otimista e atomicidade nativa de documento), utilizando **Java 25** (Records, Pattern Matching, Sealed Interfaces), **Spring Boot 3.5+ (Maven)**, `docker-compose.yml` na raiz para ambiente local e **Testcontainers MongoDB com fallback automático para `mongo-java-server` in-memory** nos testes de integração quando o daemon Docker não estiver acessível.
- **Reason**: O modelo de documento único do MongoDB alinha-se 1:1 ao Aggregate Root `SecretSantaGroup` do DDD Tático, garantindo atomicidade nativa na gravação dos pares do sorteio sem joins ou tabelas relacionais extras, enquanto a Clean Architecture + ArchUnit mantém o domínio 100% puro e desacoplado de frameworks.
- **Trade-off**: Concorrência em inscrições simultâneas usa controle otimista (`@Version` + retry na aplicação em inscrições ou HTTP 409 se o status mudou para `DRAWN`) em vez de lock pessimista SQL.
- **Scope**: Camada de infraestrutura/persistência do Backend (`backend/`), testes de arquitetura e `docker-compose.yml`.
- **Date**: 2026-11-13
- **Status**: active

### AD-006
- **Decision**: Renomear a aplicação para **"Amigo Secreto"**, restringir a Home (`/`) a exibir exclusivamente **"Meus Grupos"** (removendo `"Grupos Disponíveis (Abertos)"`), mover a criação de novos grupos para um **modal** acionado por botão (`+ Criar Grupo`) e tornar o botão de troca de usuário/saída (`Trocar / Sair`) discreto na barra de identidade.
- **Reason**: Prepara o fluxo de grupos privados acessíveis por link/senha onde o usuário visualiza apenas os grupos de que participa ou que organiza, reduz o ruído visual na Home mobile e mantém a troca de familiar acessível sem competir com a ação principal.
- **Trade-off**: Usuários não descobrem grupos abertos pela Home; o ingresso em novos grupos passa a ocorrer exclusivamente pelo link compartilhado (`/g/{slug}`).
- **Scope**: Frontend Angular (`index.html`, `AppComponent`, `HomeGroupsPageComponent`, `AdminDashboardPageComponent`) e spec `festive-ui-ux`.
- **Date**: 2026-11-15
- **Status**: active

### AD-007
- **Decision**: Substituir `publicSlug` por `UUID` como identificador único dos grupos (`/g/{uuid}` e `/g/{uuid}/admin`), exigir **PIN numérico de 4 a 6 dígitos (`groupPinHash` BCrypt)** na criação e no ingresso de participantes (dispensado apenas para o próprio organizador ao entrar no seu grupo, com redefinição pelo organizador via `PUT /api/v1/groups/{groupId}/admin/pin`), ocultar a lista de participantes para não-membros (`participantsVisible: false`), remover `availableOpenGroups` da API/Home, adotar login direto em `/` + página dedicada `/cadastro` e substituir todas as referências visíveis de `username` por `nome de usuário`.
- **Reason**: Torna os grupos privados por padrão, elimina enumeração por slug ou exposição de participantes a terceiros, evita criação de contas órfãs ao validar o grupo e o PIN antes de cadastrar visitantes e simplifica a UX mobile-first de entrada e cadastro.
- **Trade-off**: O organizador precisa informar o PIN do grupo separadamente aos convidados ao compartilhar o link `/g/{uuid}`.
- **Scope**: Domínio, Persistência MongoDB (índices em `organizerUserId` e `participants.userId`, remoção do índice de `publicSlug`), API REST `/api/v1/groups` e Frontend Angular.
- **Date**: 2026-11-15
- **Status**: active

## Handoff

- **Feature**: private-groups-ux-patch (`.specs/features/private-groups-ux-patch`)
- **Phase / Task**: Done — Implementação integral da spec concluída e validada (`mvn test`: 82 pass; `npm test`: 38 pass; `ng build`: ok; Playwright E2E desktop + mobile: pass)
- **Completed**: `B1`..`B4`, `F1`..`F5`, `V1`..`V3`, `.specs/features/private-groups-ux-patch/tasks.md`
- **In-progress** (file:line): none
- **Next step**: Pronto (alterações aprovadas e commitadas na branch `main`)
- **Blockers**: none
- **Uncommitted files**: none
- **Branch**: main
