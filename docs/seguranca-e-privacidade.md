# 🔒 Segurança, Sigilo Efêmero e Privacidade

O projeto foi desenhado para uso familiar compartilhado (incluindo o modo **"Passar o Celular"**), exigindo garantias rígidas tanto no Backend quanto no Frontend.

---

## 1. Segurança no Backend

### 1.1. Credenciais e Tokens
- **Hash de PIN (`BCrypt`)**: Os PINs numéricos de 4 a 6 dígitos nunca são armazenados em texto puro; utilizam `BCryptPasswordEncoder` via `PinHash`.
- **Token Bearer Stateless (`HMAC-SHA256`)**: [`StatelessSessionTokenService`](file:///home/tiago.godoy@db1.com.br/workspace/tiaggofg/secret-santa/backend/src/main/java/com/secretsanta/application/StatelessSessionTokenService.java) assina payload contendo `userId`, `username` e expiração (`secretsanta.security.token-ttl-hours`, padrão 72h) com `SECRETSANTA_TOKEN_SECRET`, validando assinatura em tempo constante (`MessageDigest.isEqual`).
- **Token de Redefinição de PIN**: Gerado pelo organizador, armazenado apenas como hash SHA-256 (`PasswordResetTokenHash`) com data de expiração e uso único (invalidado imediatamente após o reset).

### 1.2. Privacidade de Grupos e Convites Assinados
- **Identificação por UUID**: Grupos não usam slugs previsíveis; são endereçados por `UUID`.
- **Assinatura de Convite (`InviteSignature`)**: Cada grupo recebe uma assinatura HMAC-SHA256 persistida (`inviteSignature`), exposta **apenas** ao organizador (`AdminGroupView`) e a membros já participantes.
- **Rotação de Link**: O organizador pode rotacionar a assinatura (`POST .../invite-link/rotate`), revogando imediatamente links compartilhados anteriormente.
- **Ocultação de Participantes**: Visitantes sem assinatura válida recebem `participantsVisible: false` e lista vazia em `GET /api/v1/groups/{groupId}`.

### 1.3. Proteção Absoluta do Resultado do Sorteio
- Nenhum endpoint de listagem ou consulta (`GET /api/v1/groups`, `GET /api/v1/groups/{groupId}`, `GET /api/v1/groups/{groupId}/admin`) expõe `drawnParticipantId`, `drawnParticipantName`, `pinHash` ou `resetTokenHash`.
- O nome sorteado só é retornado individualmente em `POST /api/v1/groups/{groupId}/participants/reveal` mediante validação de `username` + `pin`.

---

## 2. Sigilo Efêmero no Frontend

- **Zero Storage Persistente**: É estritamente proibido gravar `drawnParticipantName`, `pin` ou token Bearer em `localStorage`, `sessionStorage`, `IndexedDB`, cookies ou parâmetros de URL.
- **Memória Volátil (Signals)**:
  - [`AuthSessionStore`](file:///home/tiago.godoy@db1.com.br/workspace/tiaggofg/secret-santa/frontend/src/app/core/auth/auth-session.store.ts) mantém a sessão apenas em Signals na memória da aba.
  - [`EphemeralRevealModalComponent`](file:///home/tiago.godoy@db1.com.br/workspace/tiaggofg/secret-santa/frontend/src/app/features/public-group/ephemeral-reveal-modal.component.ts) limpa o resultado sorteado e o PIN imediatamente ao fechar o modal, em `ngOnDestroy` e ao disparar `document.visibilitychange` (quando o usuário minimiza ou troca de aba).
- **Modo "Passar o Celular"**: Ao acionar a troca de usuário, a aplicação limpa `AuthSessionStore`, preservando apenas o cache efêmero de geolocalização do dispositivo ([`DeviceSessionGeoStore`](file:///home/tiago.godoy@db1.com.br/workspace/tiaggofg/secret-santa/frontend/src/app/core/geolocation/device-session-geo.store.ts)) para facilitar a inscrição de familiares na mesma casa.
