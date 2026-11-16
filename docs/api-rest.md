# 🌐 Referência da API REST (`/api/v1`)

Todos os endpoints são servidos pelo backend Spring Boot sob o prefixo `/api/v1` (exceto `/health`, também disponível como alias de `/api/v1/health`).

A autenticação web utiliza exclusivamente **cookies `HttpOnly`** (`ss_access_token` com validade de 15 min em `/api/v1` e `ss_refresh_token` com validade deslizante de 1h em `/api/v1/auth`), sem expor tokens em corpos JSON ou `Authorization: Bearer`.

---

## 1. Autenticação e Usuários ([`AuthController`](file:///home/tiago.godoy@db1.com.br/workspace/tiaggofg/secret-santa/backend/src/main/java/com/secretsanta/web/AuthController.java))

| Método | Endpoint | Auth | Status | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/auth/register` | Pública | `201` | Cadastra usuário (`name`, `username`, `password` forte 6-64 chars), grava cookies `HttpOnly` e retorna `AuthUserView`. |
| `POST` | `/api/v1/auth/login` | Pública | `200` | Autentica usuário (`username`, `password` — compatível com hashes legados), grava cookies `HttpOnly` e retorna `AuthUserView`. |
| `POST` | `/api/v1/auth/refresh` | Cookie Refresh | `200` | Rotaciona `ss_refresh_token` na mesma família (+1h deslizante), emite novo `ss_access_token` e retorna `AuthUserView`. Detecta reuso revogando toda a família (`401`). |
| `POST` | `/api/v1/auth/logout` | Cookie Refresh | `204` | Revoga o refresh token no MongoDB e expira ambos os cookies (`Max-Age=0`). |
| `GET` | `/api/v1/auth/me` | Cookie Access | `200` | Valida `ss_access_token` e retorna `AuthUserView` do usuário autenticado (ou `401`). |
| `POST` | `/api/v1/auth/reset-password` (alias `/reset-pin`) | Pública (Token) | `200` | Consome o token único (`token`, `newPassword`), atualiza a senha, revoga todos os refresh tokens do usuário e limpa cookies. |

---

## 2. Grupos Públicos e Participação ([`GroupPublicController`](file:///home/tiago.godoy@db1.com.br/workspace/tiaggofg/secret-santa/backend/src/main/java/com/secretsanta/web/GroupPublicController.java))

| Método | Endpoint | Auth | Status | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/groups` | Cookie Access | `200` | Retorna `GroupDiscoveryView` com `myGroups` (grupos onde o usuário é organizador ou participante). |
| `GET` | `/api/v1/groups/{groupId}?sig={sig}` | Opcional | `200` / `401` | Retorna `PublicGroupView`. Se houver cookie `ss_access_token` inválido/expirado, retorna `401` para acionar refresh automático. Só expõe `participants` (`participantsVisible: true`) a membros/organizadores. |
| `POST` | `/api/v1/groups/{groupId}/participants` | Cookie ou Visitante | `201` / `409` | Inscreve usuário autenticado ou cadastra/autentica visitante (`inviteSignature`, `latitude`, `longitude`). Em login de visitante já inscrito, emite cookies `HttpOnly` e retorna `409` (`errorCode: "ALREADY_PARTICIPANT"` + `redirectPath`). |
| `POST` | `/api/v1/groups/{groupId}/participants/reveal` | `username` + `password` | `200` | Valida credenciais no corpo da requisição, marca `REVEALED` na 1ª consulta e retorna `RevealMatchView` com `drawnParticipantName`. |

---

## 3. Administração do Grupo ([`GroupAdminController`](file:///home/tiago.godoy@db1.com.br/workspace/tiaggofg/secret-santa/backend/src/main/java/com/secretsanta/web/GroupAdminController.java))

| Método | Endpoint | Auth | Status | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/groups` | Cookie Access | `201` | Cria um novo grupo (`eventName`), definindo o usuário autenticado como organizador. Retorna `AdminGroupView`. |
| `GET` | `/api/v1/groups/{groupId}/admin` | Cookie (Organizador) | `200` | Retorna `AdminGroupView` completo, incluindo `sharePath` com `sig` e status de revelação dos participantes. |
| `POST` | `/api/v1/groups/{groupId}/admin/invite-link/rotate` | Cookie (Organizador) | `200` | Gera nova `inviteSignature`, invalidando links antigos. Retorna `AdminGroupView`. |
| `DELETE` | `/api/v1/groups/{groupId}/admin/participants/{participantId}` | Cookie (Organizador) | `204` | Remove participante enquanto o grupo está `OPEN`. |
| `POST` | `/api/v1/groups/{groupId}/admin/draw` | Cookie (Organizador) | `200` | Executa o sorteio com desarranjo e restrição geográfica (`<= 50m`). Retorna `AdminGroupView`. |
| `POST` | `/api/v1/groups/{groupId}/admin/participants/{participantId}/reset-token` | Cookie (Organizador) | `200` | Gera link único (`/reset/{token}`) com expiração para o participante redefinir sua senha (`PasswordResetLinkView`). |

---

## 4. Saúde da Aplicação ([`HealthController`](file:///home/tiago.godoy@db1.com.br/workspace/tiaggofg/secret-santa/backend/src/main/java/com/secretsanta/web/HealthController.java))

| Método | Endpoint | Auth | Status | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/health` (ou `/health`) | Pública | `200` | Retorna `{"status": "UP"}` para healthcheck do Docker/Portainer. |

---

## 5. Mapeamento de Erros ([`GlobalExceptionHandler`](file:///home/tiago.godoy@db1.com.br/workspace/tiaggofg/secret-santa/backend/src/main/java/com/secretsanta/web/GlobalExceptionHandler.java))

- `400 Bad Request`: Validações de domínio (`DomainValidationException` — incluindo política de senha forte), JSON inválido (`MALFORMED_REQUEST`), token de reset inválido (`INVALID_RESET_TOKEN`).
- `401 Unauthorized`: Credenciais inválidas, cookie ausente/expirado ou refresh token revogado (`INVALID_CREDENTIALS`).
- `403 Forbidden`: Acesso administrativo por não-organizador (`FORBIDDEN_ORGANIZER_ACCESS`) ou assinatura de convite inválida (`INVALID_INVITE_SIGNATURE`).
- `404 Not Found`: Grupo, usuário ou participante não encontrado (`RESOURCE_NOT_FOUND`).
- `409 Conflict`: Participante já inscrito (`errorCode: "ALREADY_PARTICIPANT"` — com emissão de cookies `HttpOnly` no fluxo de login de visitante), usuário duplicado (`CONFLICT`), grupo já sorteado ou conflito de concorrência otimista.
- `422 Unprocessable Entity`: Menos de 3 participantes no sorteio (`INSUFFICIENT_PARTICIPANTS`).
