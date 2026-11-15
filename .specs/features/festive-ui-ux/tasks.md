# Tasks — Festive UI/UX Overhaul (`festive-ui-ux`)

**Spec**: `.specs/features/festive-ui-ux/spec.md`
**Status**: Done
**Updated**: 2026-11-15

---

## Task Breakdown

- [x] **F1 — Design System Natalino & Shell Global (`AppComponent`)**
  - Configurados tokens semânticos (`festive-cream`, `festive-night`, `festive-card`, `festive-border`, `pine`, `cranberry`, `gold`, `ink`) e fontes `Fraunces` + `Plus Jakarta Sans` em `tailwind.config.js`, `index.html` e `styles.css`.
  - Nome da aplicação padronizado para **"Amigo Secreto"** (`<title>`, header global e textos de compartilhamento).
  - Shell responsivo com backdrop noturno em desktop (`>= 768px`), filete decorativo natalino e `overflow-x-hidden`.
  - Criados utilitários compartilhados (`shared/formatters.ts` e `shared/components/festive-icon.component.ts`).

- [x] **F2 — Home Não Autenticada (`/`)**
  - Hero compacto **"Amigo Secreto"** com 3 pílulas de valor (`Sem e-mail`, `PIN de 4-6 dígitos`, `Evita mesma casa`).
  - Toggle de visualização de PIN (`aria-label="Mostrar ou ocultar PIN"`) nos formulários de cadastro e login, além de validação inline antes do submit.

- [x] **F3 — Home Autenticada: Somente "Meus Grupos", Modal de Criação e Troca Discreta (`/`)**
  - Removida a listagem pública de `"Grupos Disponíveis (Abertos)"` da Home, exibindo exclusivamente **"Meus Grupos"** (`data-testid="my-groups-section"`).
  - Botão de troca de usuário substituído pela ação discreta **"Trocar / Sair"** (`data-testid="switch-family-user-btn"`), preservando `DeviceSessionGeoStore`.
  - Formulário de criação de grupo movido para modal (`data-testid="create-group-modal"`) acionado pelo botão **"+ Criar Grupo"** (`data-testid="open-create-group-modal-btn"`), com chips de sugestão rápida e fechamento automático após criação.

- [x] **F4 — Página Pública do Grupo (`/g/:slug`)**
  - Cartão-convite natalino com contagem natural em português e indicador de quantas pessoas faltam para o sorteio.
  - Cartões de participantes não-interativos no estado `OPEN`; seleção interativa com guia em 3 passos, `"Abrir Meu Presente"` e rótulos humanos (`"Já descobriu"` / `"Ainda não espiou"`) no estado `DRAWN`, preservando `data-reveal-status`.

- [x] **F5 — Modal de Revelação Efêmera (`EphemeralRevealModalComponent`)**
  - Cartão-presente celebratório em cranberry/dourado com caixa de altíssimo contraste em `Fraunces`, trava de rolagem do `body` enquanto aberto e preservação integral de `AD-003` (`wipeAndClose()`, `ngOnDestroy()`, `document:visibilitychange`, zero Web Storage/cookies/URL).

- [x] **F6 — Painel do Organizador (`/g/:slug/admin`)**
  - Métricas resumidas, compartilhamento limpo com `/g/:slug` copiável (`break-all`), cartão de reset de PIN sem overflow horizontal em `390px`, rótulos 100% em português (sem enums expostos) e confirmação inline expansível (`execute-draw-btn` → `confirm-draw-btn`) antes do sorteio.

- [x] **F7 — Página de Redefinição de PIN (`/reset/:token`)**
  - Cartão acolhedor com ícone de chave dourada, toggle de visualização do PIN, validação inline e estados claros de sucesso/erro.

- [x] **F8 — Verificação Automatizada & Ponta a Ponta (Vitest + Build + Playwright)**
  - `cd frontend && npm test`: `7` arquivos, `37` testes passando.
  - `cd frontend && npm run build`: build de produção sem erros (`411.55 kB` initial total).
  - Playwright E2E real (MongoDB + Backend `:8080` + Frontend `:4200`) em mobile `390x844` e desktop `1280x800` com inspeção visual de capturas de tela, zero overflow horizontal e zero erros de página.
