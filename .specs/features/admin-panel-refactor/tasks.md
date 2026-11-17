# Visual Refactoring of Admin Panel — Tasks

**Feature**: `admin-panel-refactor`  
**Spec**: `.specs/features/admin-panel-refactor/spec.md`  
**Status**: Approved (Ready for Implementation)

---

## Frontend (`frontend/src/app/features/admin/`)

- [x] **F1 — Cabeçalho & Card Principal de Resumo / Estado (`AdminDashboardPageComponent`)**:
  - [x] Reorganizar o cabeçalho do card superior com `"Painel do Organizador"` à esquerda e `group-status-badge` (`OPEN` / `DRAWN`) à direita, deixando o `<h1>` do evento em largura total logo abaixo (sem quebra em 3–4 linhas em `390px`).
  - [x] No estado `OPEN`: exibir métricas compactas (inscritos + proteção GPS 50m), dica de participantes faltantes quando `< 3` e botão/confirmação inline do sorteio (`execute-draw-btn` → `confirm-draw-btn`) com hierarquia clara.
  - [x] No estado `DRAWN`: exibir progresso de revelação (`"X de Y já descobriram"`) com barra visual de progresso, aviso de relaxamento geográfico (`geo-relaxed-badge`) quando aplicável, e atalho direto para abrir a página de revelação (`/g/:groupId`).

- [x] **F2 — Card de Convite Dedicado (`OPEN` apenas) & Remoção da URL Técnica**:
  - [x] Renderizar o card/bloco de convite exclusivamente quando `status === 'OPEN'` (ocultar no estado `DRAWN`).
  - [x] Remover completamente a caixa de texto exibindo `/g/{groupId}?sig={inviteSignature}` (`signed-share-path`).
  - [x] Dispor os botões `"Convidar pelo WhatsApp"` (`data-testid="share-group-link-btn"`) e `"Copiar Link"` (`data-testid="copy-group-link-btn"`) de forma limpa e responsiva.
  - [x] Atualizar mensagens de toast de `shareGroupInviteLink` e `copyGroupPath` para texto conciso em português sem concatenar a URL assinada completa.
  - [x] Adicionar confirmação inline leve em `"Gerar Novo Link de Convite"` (`data-testid="rotate-invite-link-btn"` → `data-testid="confirm-rotate-invite-btn"` + `"Cancelar"`) antes de chamar `rotateInviteLink`.

- [x] **F3 — Card de Redefinição de Senha (`generated-reset-link-card`)**:
  - [x] Deixar o título `"Link de Redefinição para @username"` em largura total abaixo da linha com selo `"Uso único • Válido por 24h"` e botão discreto de fechar (`×`) para limpar `activeResetLink`.
  - [x] Remover a caixa mono com `/reset/{token}`, oferecendo ações diretas `"Enviar no WhatsApp"` (`data-testid="share-reset-link-btn"`) e `"Copiar Link"` (`data-testid="copy-reset-link-btn"`), com toast conciso sem expor a URL.

- [x] **F4 — Lista de Participantes (`admin-participant-row`)**:
  - [x] Exibir avatar + nome completo sem truncamento causado por badges laterais e `@username` logo abaixo.
  - [x] Mover os selos (`GPS 50m` / `Sem GPS` e `participant-reveal-badge`) para uma faixa horizontal compacta de metadados abaixo do nome/`@username`.
  - [x] Compactar botões `"Redefinir Senha"` (`generate-reset-token-btn`) e `"Remover"` (`remove-participant-btn`, apenas `OPEN`) preservando altura acessível (`>= 44px`).
  - [x] Adicionar confirmação inline compacta no item antes de remover participante (`data-testid="confirm-remove-participant-btn"` + `"Cancelar"`).

- [x] **F5 — Testes Unitários (`admin-dashboard-page.component.spec.ts`)**:
  - [x] Atualizar testes para refletir a remoção da URL técnica visível (`signed-share-path` e toasts sem URL completa) e a validação do novo botão `"Copiar Link"`.
  - [x] Adicionar testes para: ocultação do bloco de convite no estado `DRAWN`, confirmação inline antes de rotacionar link de convite, confirmação inline antes de remover participante, e fechamento/cópia no card de redefinição de senha.

---

## Verificação Ponta a Ponta & Documentação

- [x] **V1 — Testes Automatizados & Build**:
  - [x] `cd frontend && npm test` (100% pass).
  - [x] `cd frontend && npm run build` (sem erros).
- [x] **V2 — E2E Real via Playwright (Mobile `390x844` e Desktop `1280x800`)**:
  - [x] Validar visualmente (captura e inspeção de screenshots) os estados `OPEN` (`< 3` e `>= 3` participantes), confirmações inline (rotacionar link, remover participante, sortear), card de redefinição de senha e estado `DRAWN`.
  - [x] Confirmar `scrollWidth <= innerWidth` (zero overflow horizontal), ausência de truncamento de nomes e ausência de erros no console.
- [ ] **V3 — Documentação & Fechamento (Seções 7 e 8 do `AGENTS.md`)**:
  - [x] Revisar `README.md` e `docs/` (`docs/fluxos-e-sequencias.md` ou outros arquivos impactados, se houver) e atualizar `.specs/STATE.md` + `tasks.md`.
  - [ ] Solicitar aprovação explícita do usuário antes de `git commit` e `git push`.
