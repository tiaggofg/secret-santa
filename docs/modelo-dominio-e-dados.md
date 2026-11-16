# 🧩 Modelo de Domínio, Diagrama de Classes e Dados

Este documento descreve os agregados, entidades, value objects, documentos MongoDB e transições de estado do sistema.

---

## 1. Diagrama de Classes do Domínio (`com.secretsanta.domain`)

```mermaid
classDiagram
    class UserAccount {
        -UUID id
        -ParticipantName name
        -Username username
        -PinHash pinHash
        -PasswordResetTokenHash resetTokenHash
        -Instant resetTokenExpiresAt
        -Instant createdAt
        -Long version
        +register(name, username, pinHash, now)$ UserAccount
        +issuePasswordResetToken(tokenHash, expiresAt) void
        +resetPinWithToken(tokenHash, newPinHash, now) void
    }

    class SecretSantaGroup {
        +int MIN_PARTICIPANTS_FOR_DRAW = 3
        -UUID id
        -String eventName
        -InviteSignature inviteSignature
        -UUID organizerUserId
        -GroupStatus status
        -boolean geographicRestrictionRelaxed
        -Instant createdAt
        -Instant drawnAt
        -Long version
        -List~Participant~ participants
        +create(eventName, inviteSignature, organizerUserId, now)$ SecretSantaGroup
        +assertOrganizer(requesterUserId) void
        +registerParticipant(userId, name, username, coordinates, now) Participant
        +removeParticipant(participantId) void
        +executeDraw(clusterService, drawService, now) DrawResult
        +markRevealedAndGetDrawnName(participantId, now) String
        +rotateInviteSignature(newInviteSignature) void
    }

    class Participant {
        -UUID id
        -UUID userId
        -ParticipantName name
        -Username username
        -GeoCoordinates coordinates
        -UUID householdClusterId
        -UUID drawnParticipantId
        -Instant revealedAt
        -Instant createdAt
        +createNew(userId, name, username, coordinates, now)$ Participant
        +revealStatus(groupStatus) RevealStatus
        ~assignDrawOutcome(householdClusterId, drawnParticipantId) void
        ~markRevealed(now) void
    }

    class GeoCoordinates {
        +double latitude
        +double longitude
        +distanceInMetersTo(other) double
    }

    class DrawResult {
        +Map~UUID, UUID~ householdClusters
        +Map~UUID, UUID~ assignments
        +boolean geographicRestrictionRelaxed
    }

    class HouseholdClusterService {
        +double HOUSEHOLD_RADIUS_METERS = 50.0
        +assignHouseholdClusters(participants) Map~UUID, UUID~
    }

    class DerangementDrawService {
        +computeDraw(participants, clusterService) DrawResult
    }

    class GroupStatus {
        <<enumeration>>
        OPEN
        DRAWN
    }

    class RevealStatus {
        <<enumeration>>
        WAITING_DRAW
        PENDING_REVEAL
        REVEALED
    }

    class RefreshToken {
        -UUID id
        -UUID userId
        -UUID familyId
        -String tokenHash
        -Instant expiresAt
        -Instant revokedAt
        -Instant createdAt
        +issue(userId, familyId, tokenHash, expiresAt, now)$ RefreshToken
        +isExpired(now) boolean
        +isRevoked() boolean
        +revoke(now) RefreshToken
    }

    class PasswordValidator {
        +int MIN_LENGTH = 6
        +int MAX_LENGTH = 64
        +validateRawPassword(rawPassword)$ void
    }

    SecretSantaGroup "1" *-- "0..*" Participant : contém
    SecretSantaGroup --> GroupStatus
    Participant --> RevealStatus
    Participant o-- "0..1" GeoCoordinates
    SecretSantaGroup ..> HouseholdClusterService : usa no sorteio
    SecretSantaGroup ..> DerangementDrawService : usa no sorteio
    DerangementDrawService ..> DrawResult : produz
```

---

## 2. Diagrama Entidade-Relacionamento / Documentos MongoDB

No MongoDB (`secret_santa`), o modelo relacional é mapeado para três collections principais (`users`, `secret_santa_groups` e `refresh_tokens`), preservando a fronteira dos agregados do DDD:

```mermaid
erDiagram
    USERS {
        string id PK "UUID string"
        string name "Nome de exibição"
        string normalizedName "Nome normalizado"
        string username UK "Índice único lowercase"
        string pinHash "Hash BCrypt da senha/PIN legado"
        string resetTokenHash "Índice não-único (SHA-256)"
        instant resetTokenExpiresAt "Expiração do token de reset"
        instant createdAt
        long version "@Version controle otimista"
    }

    REFRESH_TOKENS {
        string id PK "UUID string"
        string userId "Índice (userId)"
        string familyId "Índice (familyId)"
        string tokenHash UK "Índice único (SHA-256 hex)"
        instant expiresAt "Índice TTL (expireAfter=0)"
        instant revokedAt "Timestamp de revogação"
        instant createdAt "Timestamp de emissão"
    }

    SECRET_SANTA_GROUPS {
        string id PK "UUID string"
        string eventName "3 a 100 caracteres"
        string inviteSignature "Assinatura HMAC-SHA256"
        string organizerUserId FK "Índice organizerUserId"
        string status "OPEN | DRAWN"
        boolean geographicRestrictionRelaxed
        instant createdAt
        instant drawnAt
        long version "@Version atomicidade do sorteio"
    }

    PARTICIPANT_SUBDOCUMENT {
        string id "UUID string"
        string userId FK "Índice participants_userId"
        string name
        string username
        double latitude "Opcional"
        double longitude "Opcional"
        string householdClusterId "UUID do núcleo <= 50m"
        string drawnParticipantId "UUID do amigo sorteado"
        instant revealedAt "Data da 1a revelação"
        instant createdAt
    }

    USERS ||--o{ SECRET_SANTA_GROUPS : "organiza (organizerUserId)"
    USERS ||--o{ PARTICIPANT_SUBDOCUMENT : "participa (userId)"
    SECRET_SANTA_GROUPS ||--|{ PARTICIPANT_SUBDOCUMENT : "embutido em participants[]"
```

### Índices Gerenciados pelo Mongock

A classe [`SecretSantaIndexesChangeUnit`](file:///home/tiago.godoy@db1.com.br/workspace/tiaggofg/secret-santa/backend/src/main/java/com/secretsanta/infrastructure/persistence/SecretSantaIndexesChangeUnit.java) garante de forma idempotente os seguintes índices:
- Collection `users`:
  - `username` (único, ascendente)
  - `resetTokenHash` (ascendente)
- Collection `secret_santa_groups`:
  - `organizerUserId` (ascendente)
  - `participants_userId` (ascendente em `participants.userId`)

---

## 3. Máquina de Estados

### 3.1. Ciclo de Vida do Grupo (`GroupStatus`)

```mermaid
stateDiagram-v2
    [*] --> OPEN : createGroup()
    OPEN --> OPEN : registerParticipant() / removeParticipant() / rotateInviteSignature()
    OPEN --> DRAWN : executeDraw() [>= 3 participantes]
    DRAWN --> DRAWN : markRevealedAndGetDrawnName() / rotateInviteSignature()
    DRAWN --> [*]
```

### 3.2. Status de Revelação do Participante (`RevealStatus`)

```mermaid
stateDiagram-v2
    [*] --> WAITING_DRAW : Grupo em estado OPEN
    WAITING_DRAW --> PENDING_REVEAL : Grupo muda para DRAWN
    PENDING_REVEAL --> REVEALED : 1a chamada a POST /participants/reveal
    REVEALED --> REVEALED : Reconsultas futuras mantêm revealedAt
```
