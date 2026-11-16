# 🔒 Segurança, Sigilo Efêmero e Privacidade

O projeto foi desenhado para uso familiar compartilhado (incluindo o modo **"Passar o Celular"**), exigindo garantias rígidas tanto no Backend quanto no Frontend.

---

## 1. Segurança no Backend

### 1.1. Credenciais e Política de Senha Forte
- **Política de Senha Forte ([`PasswordValidator`](file:///home/tiago.godoy@db1.com.br/workspace/tiaggofg/secret-santa/backend/src/main/java/com/secretsanta/domain/model/PasswordValidator.java))**: Novos cadastros e redefinições exigem de **6 a 64 caracteres**, sem espaços em branco, com pelo menos **1 letra maiúscula**, **1 letra minúscula**, **1 número** e **1 caractere especial**.
- **Hash `BCrypt` com Retrocompatibilidade**: Senhas nunca são armazenadas em texto puro (`PinHash`). O login e a revelação validam via `BCryptPasswordEncoder.matches`, mantendo compatibilidade transparente com contas legadas.
- **Token de Redefinição de Senha**: Gerado pelo organizador, armazenado apenas como hash SHA-256 (`PasswordResetTokenHash`) com data de expiração (24h) e uso único. Ao redefinir a senha, todos os refresh tokens ativos do usuário são revogados imediatamente.

### 1.2. Cookies `HttpOnly` e Rotação de Refresh Token
- **Access Token (`ss_access_token`)**: Token stateless assinado com **HMAC-SHA256** ([`StatelessSessionTokenService`](file:///home/tiago.godoy@db1.com.br/workspace/tiaggofg/secret-santa/backend/src/main/java/com/secretsanta/application/StatelessSessionTokenService.java)), TTL curto de **15 minutos**, trafegado exclusivamente em cookie `HttpOnly` (`Path=/api/v1`, `SameSite=Lax`, `Secure` auto-detectado via `X-Forwarded-Proto`).
- **Refresh Token (`ss_refresh_token`)**: Token opaco de 32 bytes (`SecureRandom`), armazenado como hash SHA-256 na collection `refresh_tokens` do MongoDB (com índice TTL em `expiresAt`), validade **deslizante de 1 hora** (`Path=/api/v1/auth`).
- **Rotação e Detecção de Reuso**: `POST /api/v1/auth/refresh` rotaciona o token na mesma família (`familyId`). Se um token já revogado for reutilizado, toda a família é revogada imediatamente (`401`). `POST /api/v1/auth/logout` revoga o token e expira os cookies (`Max-Age=0`).

### 1.3. Privacidade de Grupos e Convites Assinados
- **Identificação por UUID**: Grupos são endereçados por `UUID`.
- **Assinatura de Convite (`InviteSignature`)**: Assinatura HMAC-SHA256 persistida (`inviteSignature`), exposta **apenas** ao organizador (`AdminGroupView`), com suporte a rotação (`POST .../invite-link/rotate`).
- **Ocultação de Participantes**: Visitantes não inscritos recebem `participantsVisible: false` e lista vazia em `GET /api/v1/groups/{groupId}`.

### 1.4. Proteção Absoluta do Resultado do Sorteio
- Nenhum endpoint de listagem ou consulta (`GET /api/v1/groups`, `GET /api/v1/groups/{groupId}`, `GET /api/v1/groups/{groupId}/admin`) expõe `drawnParticipantId`, `drawnParticipantName`, `pinHash` ou `resetTokenHash`.
- O nome sorteado só é retornado individualmente em `POST /api/v1/groups/{groupId}/participants/reveal` mediante validação de `username` + `password`.

---

## 2. Sigilo Efêmero no Frontend

- **Zero Web Storage**: É estritamente proibido gravar `drawnParticipantName`, senhas ou tokens em `localStorage`, `sessionStorage`, `IndexedDB` ou parâmetros de URL.
- **Memória Volátil (Signals)**:
  - [`AuthSessionStore`](file:///home/tiago.godoy@db1.com.br/workspace/tiaggofg/secret-santa/frontend/src/app/core/auth/auth-session.store.ts) mantém apenas `{ userId, name, username }` em Signals na memória da aba (hidratado via `GET /api/v1/auth/me` no bootstrap).
  - [`EphemeralRevealModalComponent`](file:///home/tiago.godoy@db1.com.br/workspace/tiaggofg/secret-santa/frontend/src/app/features/public-group/ephemeral-reveal-modal.component.ts) limpa o resultado sorteado imediatamente ao fechar o modal, em `ngOnDestroy` e ao disparar `document.visibilitychange`.
- **Modo "Passar o Celular"**: Ao acionar `"Trocar / Sair"`, a aplicação chama `POST /api/v1/auth/logout` para expirar os cookies `HttpOnly` no servidor e limpa `AuthSessionStore`, preservando apenas o cache efêmero de geolocalização do dispositivo ([`DeviceSessionGeoStore`](file:///home/tiago.godoy@db1.com.br/workspace/tiaggofg/secret-santa/frontend/src/app/core/geolocation/device-session-geo.store.ts)).
