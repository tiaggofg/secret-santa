# 🏗️ Arquitetura e Diagramas C4

Este documento apresenta a arquitetura do sistema seguindo o modelo **C4** (Contexto, Containers e Componentes) e detalha os limites arquiteturais impostos pela **Clean Architecture**.

---

## 1. C4 Nível 1 — Diagrama de Contexto

Mostra como os usuários e sistemas externos interagem com a plataforma **Amigo Secreto**.

```mermaid
flowchart TB
    Org["Organizador<br/>(Cria grupos, gerencia participantes,<br/>executa sorteio e gera reset de PIN)"]
    Part["Participante / Familiar<br/>(Cadastra-se, entra via convite,<br/>revela seu amigo no celular)"]

    App["Sistema Amigo Secreto<br/>(SPA Angular + API Spring Boot + MongoDB)"]

    WA["WhatsApp<br/>(Canal externo de compartilhamento<br/>de links de convite e reset)"]
    GPS["API de Geolocalização do Navegador<br/>(navigator.geolocation)"]

    Org -->|"Gerencia grupo e sorteio (HTTPS)"| App
    Part -->|"Inscreve-se e revela par (HTTPS)"| App
    App -->|"Abre compartilhamento / wa.me"| WA
    App -->|"Solicita latitude/longitude (opcional)"| GPS
```

---

## 2. C4 Nível 2 — Diagrama de Containers

Detalha os processos executáveis, armazenamentos de dados e protocolos de comunicação.

```mermaid
flowchart TB
    User["Usuário<br/>(Navegador Mobile / Desktop)"]

    subgraph Vercel["Vercel (CDN / Hosting)"]
        SPA["Frontend SPA<br/>(Angular 19 + Tailwind CSS + Signals)<br/>Porta 4200 em dev / HTTPS em prod"]
    end

    subgraph Portainer["Servidor Docker / Portainer CE"]
        API["Backend REST API<br/>(Java 25 + Spring Boot 3.5.16)<br/>Porta 8080"]
        DB[("MongoDB 7.0<br/>Banco: secret_santa<br/>Collections: users, secret_santa_groups")]
    end

    User -->|"HTTPS (HTML/JS/CSS)"| SPA
    SPA -->|"REST/JSON (/api/v1/*)<br/>Authorization: Bearer <HMAC-SHA256>"| API
    API -->|"Spring Data MongoDB + Mongock 5.5"| DB
```

---

## 3. C4 Nível 3 — Diagrama de Componentes

### 3.1. Backend (`com.secretsanta`) — Clean Architecture

```mermaid
flowchart TB
    subgraph Web["Camada Web (REST Adapters)"]
        AuthC["AuthController<br/>(/api/v1/auth)"]
        PubC["GroupPublicController<br/>(/api/v1/groups)"]
        AdmC["GroupAdminController<br/>(/api/v1/groups/.../admin)"]
        HealthC["HealthController<br/>(/api/v1/health)"]
        ExH["GlobalExceptionHandler"]
    end

    subgraph App["Camada Application"]
        AppSvc["SecretSantaApplicationService<br/>(Casos de uso e orquestração)"]
        TokSvc["StatelessSessionTokenService<br/>(Tokens Bearer e InviteSignature HMAC-SHA256)"]
    end

    subgraph Domain["Camada Domain (100% Java Puro)"]
        Models["Agregados e Value Objects<br/>(SecretSantaGroup, UserAccount, Participant,<br/>GeoCoordinates, InviteSignature, PinHash, ...)"]
        DomSvc["Serviços de Domínio<br/>(HouseholdClusterService, DerangementDrawService)"]
        Ports["Portas de Repositório<br/>(SecretSantaGroupRepository, UserAccountRepository)"]
    end

    subgraph Infra["Camada Infrastructure"]
        GrpRepo["MongoSecretSantaGroupAdapter<br/>(+ SpringDataSecretSantaGroupMongoRepository)"]
        UsrRepo["MongoUserAccountAdapter<br/>(+ SpringDataUserAccountMongoRepository)"]
        Mongock["SecretSantaIndexesChangeUnit<br/>(Índices Mongock)"]
    end

    AuthC & PubC & AdmC --> AppSvc
    PubC & AdmC --> TokSvc
    AppSvc --> TokSvc
    AppSvc --> Models & DomSvc & Ports
    GrpRepo & UsrRepo -.->|"implementam"| Ports
```

### Regra de Dependência (ArchUnit)

A suíte [`CleanArchitectureTest`](file:///home/tiago.godoy@db1.com.br/workspace/tiaggofg/secret-santa/backend/src/test/java/com/secretsanta/domain/CleanArchitectureTest.java) valida automaticamente no `mvn test` que nenhuma classe em `com.secretsanta.domain..` possua dependência de:
- `org.springframework..`
- `org.mongodb..` / `com.mongodb..`
- `io.mongock..`
- `com.fasterxml.jackson..`
- `jakarta..`
- Camadas externas (`application`, `infrastructure`, `web`).

---

### 3.2. Frontend (`frontend/src/app`) — Angular Standalone + Signals

```mermaid
flowchart LR
    subgraph Routes["Páginas (Features)"]
        Home["HomeGroupsPageComponent<br/>(/)"]
        Reg["RegisterPageComponent<br/>(/cadastro)"]
        Pub["PublicGroupPageComponent<br/>(/g/:groupId)"]
        Modal["EphemeralRevealModalComponent<br/>(Modal de Revelação)"]
        Adm["AdminDashboardPageComponent<br/>(/g/:groupId/admin)"]
        Reset["ResetPinPageComponent<br/>(/reset/:token)"]
    end

    subgraph Core["Core (Serviços e Estado em Memória)"]
        ApiSvc["SecretSantaApiService<br/>(HttpClient /api/v1)"]
        AuthStore["AuthSessionStore<br/>(Signals em memória volátil)"]
        GeoSvc["BrowserGeolocationService"]
        GeoStore["DeviceSessionGeoStore<br/>(Cache efêmero de GPS do aparelho)"]
        ShareSvc["ShareLinkService<br/>(Web Share API / WhatsApp / Clipboard)"]
    end

    Pub --> Modal
    Home & Reg & Pub & Adm & Reset --> ApiSvc
    Home & Reg & Pub & Adm --> AuthStore
    Pub --> GeoSvc & GeoStore
    Home & Pub & Adm --> ShareSvc
```
