# 🌐 Referência da API REST (`/api/v1`)

Todos os endpoints são servidos pelo backend Spring Boot sob o prefixo `/api/v1` (exceto `/health`, também disponível como alias de `/api/v1/health`).

---

## 1. Autenticação e Usuários ([`AuthController`](file:///home/tiago.godoy@db1.com.br/workspace/tiaggofg/secret-santa/backend/src/main/java/com/secretsanta/web/AuthController.java))

| Método | Endpoint | Auth | Status | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/auth/register` | Pública | `201` | Cadastra usuário (`name`, `username`, `pin` 4-6 dígitos) e retorna `AuthSessionView` com token Bearer. |
| `POST` | `/api/v1/auth/login` | Pública | `200` | Autentica usuário (`username`, `pin`) e retorna `AuthSessionView`. |
| `POST` | `/api/v1/auth/reset-pin` | Pública (Token) | `200` | Consome o token único (`token`, `newPin` ou `pin`) e redefine o PIN do usuário (`PinResetResultView`). |

---

## 2. Grupos Públicos e Participação ([`GroupPublicController`](file:///home/tiago.godoy@db1.com.br/workspace/tiaggofg/secret-santa/backend/src/main/java/com/secretsanta/web/GroupPublicController.java))

| Método | Endpoint | Auth | Status | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/groups` | Bearer Token | `200` | Retorna `GroupDiscoveryView` com `myGroups` (grupos onde o usuário é organizador ou participante). |
| `GET` | `/api/v1/groups/{groupId}?sig={sig}` | Opcional | `200` | Retorna `PublicGroupView`. Só expõe a lista de participantes (`participantsVisible: true`) se o usuário for membro/organizador ou se `sig` for válida. |
| `POST` | `/api/v1/groups/{groupId}/participants` | Bearer ou Visitante | `201` | Inscreve usuário autenticado ou cadastra visitante + inscreve no grupo (`inviteSignature`, `latitude`, `longitude`). Retorna `ParticipantRegistrationView`. |
| `POST` | `/api/v1/groups/{groupId}/participants/reveal` | `username` + `pin` | `200` | Valida credenciais no corpo da requisição, marca `REVEALED` na 1ª consulta e retorna `RevealMatchView` com `drawnParticipantName`. |

---

## 3. Administração do Grupo ([`GroupAdminController`](file:///home/tiago.godoy@db1.com.br/workspace/tiaggofg/secret-santa/backend/src/main/java/com/secretsanta/web/GroupAdminController.java))

| Método | Endpoint | Auth | Status | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/groups` | Bearer Token | `201` | Cria um novo grupo (`eventName`), definindo o usuário autenticado como organizador. Retorna `AdminGroupView`. |
| `GET` | `/api/v1/groups/{groupId}/admin` | Bearer (Organizador) | `200` | Retorna `AdminGroupView` completo, incluindo `sharePath` com `sig` e status de revelação dos participantes. |
| `POST` | `/api/v1/groups/{groupId}/admin/invite-link/rotate` | Bearer (Organizador) | `200` | Gera nova `inviteSignature`, invalidando links antigos. Retorna `AdminGroupView`. |
| `DELETE` | `/api/v1/groups/{groupId}/admin/participants/{participantId}` | Bearer (Organizador) | `204` | Remove participante enquanto o grupo está `OPEN`. |
| `POST` | `/api/v1/groups/{groupId}/admin/draw` | Bearer (Organizador) | `200` | Executa o sorteio com desarranjo e restrição geográfica (`<= 50m`). Retorna `AdminGroupView`. |
| `POST` | `/api/v1/groups/{groupId}/admin/participants/{participantId}/reset-token` | Bearer (Organizador) | `200` | Gera link único (`/reset/{token}`) com expiração para o participante redefinir seu PIN (`PasswordResetLinkView`). |

---

## 4. Saúde da Aplicação ([`HealthController`](file:///home/tiago.godoy@db1.com.br/workspace/tiaggofg/secret-santa/backend/src/main/java/com/secretsanta/web/HealthController.java))

| Método | Endpoint | Auth | Status | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/health` (ou `/health`) | Pública | `200` | Retorna `{"status": "UP"}` para healthcheck do Docker/Portainer. |

---

## 5. Mapeamento de Erros ([`GlobalExceptionHandler`](file:///home/tiago.godoy@db1.com.br/workspace/tiaggofg/secret-santa/backend/src/main/java/com/secretsanta/web/GlobalExceptionHandler.java))

- `400 Bad Request`: Validações de domínio (`DomainValidationException`), JSON inválido.
- `401 Unauthorized`: Credenciais inválidas ou token Bearer ausente/expirado (`InvalidCredentialsException`), token de reset inválido (`InvalidPasswordResetTokenException`).
- `403 Forbidden`: Acesso administrativo por não-organizador (`UnauthorizedOrganizerAccessException`) ou assinatura de convite inválida (`InvalidInviteSignatureException`).
- `404 Not Found`: Grupo, usuário ou participante não encontrado (`ResourceNotFoundException`).
- `409 Conflict`: Usuário ou participante duplicado (`DuplicateUsernameException`, `DuplicateParticipantException`), grupo já sorteado (`GroupAlreadyDrawnException`) ou conflito de concorrência otimista (`OptimisticLockingFailureException`).
- `422 Unprocessable Entity`: Menos de 3 participantes no sorteio (`InsufficientParticipantsForDrawException`) ou grupo ainda não sorteado (`GroupNotDrawnYetException`).
