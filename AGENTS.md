# AGENTS.md — Secret Santa (Amigo Secreto Familiar Mobile-First)

Este documento define o contexto arquitetural, convenções de código, comandos essenciais e regras de verificação obrigatórias para agentes de IA trabalhando neste repositório.

---

## 1. Visão Geral do Projeto

Aplicação web **Mobile-First** para organização e sorteio de **Amigo Secreto Familiar**, projetada para uso rápido pelo WhatsApp e suporte nativo ao fluxo **"Passar o Celular"** (múltiplos familiares utilizando o mesmo dispositivo sem vazamento de sessão ou de quem tirou quem).

### Principais Capacidades de Domínio
- **Identidade Simples (`UserAccount`)**: Cadastro único com `name`, `username` (normalizado em lowercase) e `pin` numérico de 4 a 6 dígitos (armazenado como hash BCrypt).
- **Descoberta e Inscrição Rápida**: Usuários autenticados visualizam **"Meus Grupos"** e **"Grupos Disponíveis (Abertos)"** na Home (`/`) ou ingressam diretamente pelo link público compartilhado (`/g/{slug}`). Visitantes também podem se cadastrar e entrar no grupo em uma única ação.
- **Organizador sem Senha Extra**: O criador do grupo torna-se automaticamente seu organizador (`organizerUserId`), podendo gerenciar participantes, executar o sorteio e gerar links únicos de redefinição de PIN (`/reset/{token}`).
- **Restrição Geográfica de Núcleos Familiares (`<= 50m`)**: Agrupamento automático de participantes por componentes conexos via fórmula de Haversine (`<= 50 metros`). Garante que moradores da mesma residência não tirem uns aos outros sempre que matematicamente possível (`tamanho_max_nucleo <= floor(N / 2)`), aplicando relaxamento automático da restrição geográfica (`geographicRestrictionRelaxed = true`) caso uma mesma casa concentre mais da metade dos participantes.
- **Revelação Efêmera e Modo "Passar o Celular"**: O nome sorteado (`drawnParticipantName`), o `PIN` e a sessão ficam exclusivamente em memória volátil (Angular Signals), nunca em storage persistente do navegador.

---

## 2. Stack Tecnológica e Estrutura do Repositório

```text
secret-santa/
├── backend/                # API REST em Java 25 + Spring Boot 3.5 + MongoDB
├── frontend/               # SPA em Angular 19 + Tailwind CSS + Vitest
├── .specs/                 # Documentação Spec-Driven (STATE.md, spec, design, tasks, proofs)
├── .agents/                # Customizações e regras de agentes (.agents/rules/)
└── docker-compose.yml      # MongoDB 7.0 local (porta 27017, banco secret_santa)
```

### Backend (`backend/`)
- **Linguagem & Runtime**: Java 25 (`Records`, `Pattern Matching`, `Sealed Interfaces`), Spring Boot `3.5.16` (Maven).
- **Persistência**: MongoDB (`spring-boot-starter-data-mongodb`) + migrações de índices com **Mongock 5.5** (`SecretSantaIndexesChangeUnit`).
- **Segurança**: Hash de PIN com `BCrypt` (`spring-security-crypto`) e token Bearer stateless assinado via HMAC-SHA256 (`StatelessSessionTokenService`).
- **Testes**: JUnit 5, Spring Boot Test, **ArchUnit 1.4.2** (`CleanArchitectureTest`) e **Testcontainers MongoDB** com fallback automático para `mongo-java-server` in-memory (`MongoTestContainerConfig`) quando o daemon Docker não está disponível.

### Frontend (`frontend/`)
- **Framework**: Angular 19.2+ (`Standalone Components`, `Signals`, Native Control Flow `@if`/`@for`, `Reactive Forms`).
- **Estilização**: Tailwind CSS 3.4 com componentes mobile-first de alto contraste e alvos de toque amplos.
- **Compartilhamento**: Web Share API nativa (`navigator.share`) com fallback para `navigator.clipboard.writeText`.
- **Testes Unitários**: Vitest 3.0 + JSDOM (`npm test`).
- **Proxy de Desenvolvimento**: `/api` redireciona para `http://localhost:8080` (`proxy.conf.json`).

---

## 3. Diretrizes de Arquitetura e Invariantes Críticas

### 3.1. Clean Architecture & DDD Tático no Backend (Validado por ArchUnit)
- **Isolamento Estrito do Domínio (`com.secretsanta.domain..`)**:
  - A classe `CleanArchitectureTest` falha o build caso qualquer classe em `com.secretsanta.domain..` dependa de `org.springframework..`, `org.mongodb..`, `com.mongodb..`, `io.mongock..`, `com.fasterxml.jackson..`, `jakarta..`, ou das camadas `application`, `infrastructure` e `web`.
  - Mantenha entidades, agregados (`SecretSantaGroup`, `UserAccount`), Value Objects (`GroupSlug`, `Username`, `PinHash`, `GeoCoordinates`, `DrawResult`, etc.), portas de repositório e serviços de domínio (`HouseholdClusterService`, `DerangementDrawService`) **100% Java puro**.
- **Atomicidade e Concorrência no MongoDB**:
  - `SecretSantaGroupDocument` armazena a lista de `participants` embutida no mesmo documento na collection `secret_santa_groups` e utiliza `@Version` para controle de concorrência otimista, garantindo atomicidade nativa na gravação do sorteio.
  - `UserAccountDocument` reside na collection `users` com índice único em `username`.

### 3.2. Sigilo Efêmero e Privacidade no Frontend
- **Proibição de Storage Persistente**:
  - **NUNCA** armazene `drawnParticipantName`, `pin` ou token de sessão em `localStorage`, `sessionStorage`, `IndexedDB`, cookies ou parâmetros de URL.
- **Limpeza de Estado**:
  - `EphemeralRevealModalComponent` deve limpar o resultado sorteado imediatamente ao fechar o modal, em `ngOnDestroy` e ao ocultar a aba/tela (`document.visibilitychange`).
  - `AuthSessionStore` mantém o token Bearer apenas em memória volátil (Signals). Ao acionar **"Cadastrar outro familiar / Trocar de usuário neste aparelho"**, limpe a sessão de usuário mantendo apenas o cache efêmero de geolocalização do aparelho (`DeviceSessionGeoStore`) para facilitar a inscrição de familiares na mesma residência.
- **Proteção de Payload na API**:
  - Nenhum endpoint de listagem ou consulta de grupo (`GET /api/v1/groups/{slug}` ou `GET /api/v1/groups/{slug}/admin`) pode expor `drawnParticipantId`, `drawnParticipantName`, `pinHash` ou `passwordResetTokenHash`. O par sorteado só é retornado individualmente em `POST /api/v1/groups/{slug}/participants/reveal` mediante validação de `username` + `pin`.

---

## 4. Resumo de Endpoints REST (`/api/v1`)

| Método | Endpoint | Autenticação | Descrição |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/auth/register` | Pública | Cadastra usuário (`name`, `username`, `pin` 4-6 dígitos) e retorna sessão Bearer. |
| `POST` | `/api/v1/auth/login` | Pública | Autentica usuário (`username`, `pin`) e retorna sessão Bearer. |
| `POST` | `/api/v1/auth/reset-pin` | Pública (Token) | Redefine o PIN do usuário consumindo o token único (`token`, `newPin`). |
| `GET` | `/api/v1/groups` | Bearer Token | Retorna `myGroups` e `availableOpenGroups` para a Home. |
| `POST` | `/api/v1/groups` | Bearer Token | Cria um novo grupo (`eventName`) tendo o usuário logado como organizador. |
| `GET` | `/api/v1/groups/{slug}` | Opcional | Consulta dados públicos do grupo, status (`OPEN` / `DRAWN`) e lista de participantes. |
| `POST` | `/api/v1/groups/{slug}/participants` | Bearer ou Visitante | Inscreve usuário logado ou cadastra visitante + inscreve no grupo com coordenadas GPS. |
| `POST` | `/api/v1/groups/{slug}/participants/reveal` | `username` + `pin` | Revela de forma efêmera quem o participante tirou e marca `REVEALED`. |
| `GET` | `/api/v1/groups/{slug}/admin` | Bearer (Organizador) | Visão administrativa do grupo para o organizador. |
| `DELETE` | `/api/v1/groups/{slug}/admin/participants/{participantId}` | Bearer (Organizador) | Remove participante enquanto o grupo está `OPEN`. |
| `POST` | `/api/v1/groups/{slug}/admin/draw` | Bearer (Organizador) | Executa o sorteio com desarranjo e restrição geográfica (`<= 50m`). |
| `POST` | `/api/v1/groups/{slug}/admin/participants/{participantId}/reset-token` | Bearer (Organizador) | Gera token/link único (`/reset/{token}`) para redefinição de PIN de um participante. |

---

## 5. Comandos de Desenvolvimento e Testes

```bash
# Subir MongoDB local via Docker Compose (porta 27017)
docker compose up -d

# Backend — Executar suíte completa de testes (Unitários, ArchUnit e Integração)
cd backend && mvn test

# Backend — Iniciar servidor local (http://localhost:8080)
cd backend && mvn spring-boot:run

# Frontend — Executar testes unitários headless (Vitest)
cd frontend && npm test

# Frontend — Build de produção
cd frontend && npm run build

# Frontend — Servidor de desenvolvimento (http://localhost:4200 com proxy para :8080)
cd frontend && npm start
```

---

## 6. Regra Obrigatória de Verificação Pós-Implementação

Após concluir qualquer implementação ou correção no projeto, além de garantir que os testes automatizados existentes passem (`mvn test` e/ou `npm test`), você **DEVE** executar a validação prática correspondente ao escopo alterado:

1. **Implementações com Frontend ou Full-Stack (Frontend + Backend)**:
   - Realize um **teste prático de ponta a ponta via Playwright** (ou subagente de navegador / script Playwright headless) interagindo com a interface real da aplicação para validar o comportamento visual, fluxos de formulário, estados reativos e integração com o backend.
2. **Implementações Exclusivamente no Backend (Somente Backend)**:
   - Realize **requisições HTTP reais (requests)** diretamente contra os endpoints da API do backend em execução (via `curl`, scripts de request ou cliente HTTP equivalente), validando contratos de entrada/saída, códigos de status HTTP, persistência e cenários de erro.
   - Não é necessário abrir o navegador/Playwright quando a alteração for estritamente de backend sem impacto em fluxos de UI.

---

## 7. Regra Obrigatória de Aprovação, Commit e Push Pós-Ciclo

Ao finalizar qualquer ciclo completo de implementação e verificação:

1. **Solicitação de Aprovação**: Você **DEVE** perguntar explicitamente ao usuário se as alterações estão aprovadas.
2. **Commit e Push após Aprovação**: Caso o usuário confirme a aprovação, você **DEVE** realizar o `git add`, `git commit` (com mensagem descritiva seguindo Conventional Commits) e `git push` para o repositório remoto.
3. **Sem Push Antes da Aprovação**: Nunca execute `git commit` ou `git push` antes de receber a aprovação explícita do usuário para o ciclo concluído.
