# Visual Refactoring of Admin Panel Specification

**Status**: Approved  
**Approved**: 2026-11-16 - user: "o plano esta aprovado."  
**Created**: 2026-11-16  
**Scope**: Frontend (`frontend/src/app/features/admin/`) — Sem alterações de contrato de API ou regras de negócio no Backend.  
**Base Specs**: `.specs/features/secret-santa/spec.md` (`AD-001`..`AD-005`), `.specs/features/festive-ui-ux/spec.md` (`AD-006`), `.specs/features/signed-invite-and-favicon/spec.md` (`AD-008`), `.specs/features/rejoin-redirect-and-auth-security/spec.md` (`AD-009`)

---

## 1. Problem Statement & Diagnóstico Real (Auditoria Playwright)

A auditoria visual e interativa realizada via **Playwright** sobre `/g/{groupId}/admin` (`390x844` mobile e `1280x800` desktop, nos estados `OPEN`, confirmação de sorteio, card de redefinição de senha e `DRAWN`) revelou que o Painel do Organizador está visualmente sobrecarregado e expõe ruído técnico desnecessário:

| Área Auditada | Evidência Observada no Playwright | Impacto na Experiência do Organizador |
| :--- | :--- | :--- |
| **Card Principal (`OPEN`) — Densidade e Altura** | O card único (`section.bg-festive-card`) atinge **`483px` de altura** em `390px` ao empilhar cabeçalho comprimido, pílulas de métricas, botão `"Convidar pelo WhatsApp"`, caixa de 4 linhas com o path assinado, botão `"Gerar Novo Link de Convite"`, divisor e botão `"Realizar Sorteio Agora (4 inscritos)"`. O primeiro participante só aparece em `y = 791px` (quase fora da primeira dobra de `844px`). | Sensação de painel pesado e confuso; ações de compartilhamento, manutenção de convite e ação irreversível de sorteio competem pelo mesmo espaço visual. |
| **Exposição do Link Técnico no Bloco de Cópia** | A caixa cinza/creme exibe a string técnica `/g/{uuid}?sig={hmac}` (~90 caracteres) quebrada em 4 linhas ao lado do botão `"Copiar"`, além de o toast de cópia/compartilhamento repetir a URL inteira. | Assusta usuários leigos, consome ~90px verticais sem utilidade real (o link não é memorizável nem digitável manualmente) e polui o toast de confirmação. |
| **Título `h1` Comprimido pelo Selo de Status** | O cabeçalho usa `flex items-start justify-between` dividindo a linha entre `PAINEL DO ORGANIZADOR` + `<h1>` e o selo `"Inscrições Abertas"`. Em `390px`, `"Natal da Família Godoy 2026"` quebra em **4 linhas**. | Prejudica a leitura do nome do evento e desperdiça altura vertical. |
| **Controles de Convite Visíveis no Estado `DRAWN`** | Mesmo após `"Sorteio Realizado"` (quando novas inscrições já são bloqueadas no backend), `"Convidar pelo WhatsApp"`, a caixa com `?sig=` + `"Copiar"` e `"Gerar Novo Link de Convite"` continuam ocupando o topo do card. | Confunde o organizador com ações de convite que não têm mais efeito após o sorteio, em vez de priorizar o acompanhamento de quem já revelou e o atalho para abrir a página do sorteio. |
| **Card de Redefinição de Senha (`generated-reset-link-card`)** | Título `"Link de Redefinição para @..."` quebra em 3 linhas ao lado de `"Uso único • Válido por 24h"`, exibe o path técnico `/reset/...` em caixa mono e não possui botão para dispensar/fechar o card nem botão dedicado de `"Copiar Link"`. | Ruído técnico semelhante ao do convite e permanência indefinida do card na tela até recarregar a página. |
| **Ações Sensíveis sem Confirmação (`Gerar Novo Link` e `Remover`)** | Tocar em `"Gerar Novo Link de Convite"` invalida imediatamente o link já enviado no WhatsApp da família, e `"Remover"` exclui o participante sem confirmação prévia. | Alto risco de toque acidental no celular quebrar o link da família ou remover alguém sem querer. |
| **Cards de Participantes (`admin-participant-row`)** | Em `390px`, duas pílulas empilhadas na direita (`"GPS Ativo (50m)"` + `"Aguardando sorteio"`) comprimem o nome do participante, causando truncamento (`"Tiago Organiz..."`, `"Maria Apareci..."`, `"Carlos Eduard..."`, `"Ana Clara Ferr..."`). Além disso, cada linha tem 2 botões largos empilhando ~155px de altura por pessoa. | Nomes da família ficam cortados e listas com 8–15 pessoas geram rolagem excessiva no celular. |

---

## 2. Goals (Objetivos da Refatoração)

- [ ] **Remover a Exibição da URL Técnica do Fluxo de Cópia/Convite**: Eliminar a caixa com o path `/g/{uuid}?sig={hmac}` e transformar a ação em um botão direto `"Copiar Link"`, mantendo o visual limpo tanto no convite do grupo quanto no card de redefinição de senha (`/reset/{token}`).
- [ ] **Desafogar e Reorganizar a Hierarquia do Painel do Organizador**: Separar claramente o **Resumo do Grupo & Ação Principal de Estado** (Sortear no estado `OPEN` / Acompanhar Revelações no estado `DRAWN`) das **Ações de Convite** (exibidas apenas enquanto `OPEN`), reduzindo significativamente a altura acima da dobra no mobile.
- [ ] **Corrigir Tipografia do Cabeçalho**: Dar largura total ao título do evento (`h1`) para evitar quebras em 3–4 linhas em `390px`.
- [ ] **Proteger Ações Sensíveis com Confirmação Inline Leve**: Adicionar confirmação rápida inline antes de rotacionar o link de convite (`"Gerar Novo Link"`) e antes de remover um participante.
- [ ] **Melhorar Legibilidade dos Cards de Participantes**: Impedir o truncamento prematuro dos nomes completos no mobile reposicionando os selos (`GPS` e status de revelação) para uma faixa de metadados própria e tornando os controles por participante mais compactos e escaneáveis.
- [ ] **Manter 100% das Invariantes e Integrações Existentes**: Zero alteração no backend, zero exposição de `drawnParticipantId`/`pinHash` e preservação dos fluxos reais de compartilhamento (`ShareLinkService`), rotação de convite, remoção, sorteio e reset de senha.

---

## 3. Out of Scope

| Item | Motivo |
| :--- | :--- |
| Alterações em endpoints REST do backend (`GroupAdminController`, DTOs) | Todos os dados necessários (`AdminGroupView`, `sharePath`, `resetPath`) já são fornecidos pela API atual. |
| Unificação das rotas `/g/:groupId` e `/g/:groupId/admin` | Escopo distinto; esta spec trata exclusivamente da refatoração visual e ergonômica de `AdminDashboardPageComponent`. |
| Alterações no componente global `ToastContainerComponent` | Será avaliado à parte caso seja necessário reposicionar toasts globais fora do header. |
| Edição de nome do evento ou configurações avançadas de sorteio | Não faz parte desta refatoração visual. |

---

## 4. Diretrizes de Design & Proposta Estrutural

### 4.1. Bloco Superior: Cabeçalho & Resumo do Grupo (Card 1 — Enxuto)

1. **Linha Superior de Contexto**:
   - Esquerda: Eyebrow `"Painel do Organizador"` com ícone de estrela (`gold-600`).
   - Direita: Badge de status (`data-testid="group-status-badge"`, `data-group-status="OPEN" | "DRAWN"`) com `"Inscrições Abertas"` ou `"Sorteio Realizado"`.
2. **Título do Evento em Largura Total**:
   - `<h1>` (`font-display text-2xl font-bold text-ink-900`) ocupando 100% da largura disponível abaixo da linha de contexto, eliminando a compressão lateral.
3. **Resumo Compacto de Estado & Métricas**:
   - **No estado `OPEN`**:
     - Linha limpa de indicadores: total de inscritos (`formatParticipantCount`) + contagem com proteção GPS (`"X com proteção GPS 50m"`).
     - Se `< 3` participantes: nota amigável informando quantos faltam (`"Faltam X participante(s) para liberar o sorteio"`).
     - **Ação Principal de Sorteio** (`data-testid="execute-draw-btn"`): botão `"Realizar Sorteio Agora"` (ou `"Realizar Sorteio"` com contagem discreta) com a confirmação inline expansível já existente (`data-testid="confirm-draw-btn"` + `"Cancelar"`).
   - **No estado `DRAWN`**:
     - Indicador claro de progresso de revelação (`"X de Y já descobriram"`) acompanhado de uma **barra de progresso visual** (`pine-700` sobre `festive-cream`) e resumo de proteção GPS aplicada (ou nota de relaxamento geográfico `data-testid="geo-relaxed-badge"` se `geographicRestrictionRelaxed === true`).
     - CTA secundário/atalho direto para a página do sorteio (`"Abrir Página de Revelação"` / link para `/g/:groupId`) facilitando o fluxo do próprio organizador.

### 4.2. Bloco de Convite da Família (Card 2 — Exclusivo do Estado `OPEN`)

Em vez de misturar o link técnico com o botão de sorteio no mesmo card:
1. **Exibição Condicional (`@if (g.status === 'OPEN')`)**:
   - Quando o grupo já foi sorteado (`DRAWN`), o bloco de convite não é exibido (ou fica oculto), evitando confusão já que novas entradas não são permitidas.
2. **Hierarquia Limpa sem URL Exposta**:
   - Título curto e humano: `"Convidar Participantes"` (com subtítulo discreto de 1 linha, ex.: `"Envie o convite privado pelo WhatsApp ou copie o link."`).
   - **Sem caixa de texto exibindo `/g/{uuid}?sig=...`**!
   - Linha de ações principais lado a lado (em `flex` responsivo):
     - Primário (`bg-pine-800`): **"Convidar pelo WhatsApp"** (`data-testid="share-group-link-btn"`).
     - Secundário (`bg-festive-cream border`): **"Copiar Link"** (`data-testid="copy-group-link-btn"`, ícone `copy` + texto `"Copiar Link"`, mudando brevemente para `"Copiado!"` ou disparando toast limpo `"Link de convite copiado!"` sem imprimir a URL gigante).
   - **Ação Discreta de Segurança ("Novo Link de Convite")**:
     - Link/botão discreto abaixo ou no rodapé do bloco: **"Gerar Novo Link de Convite"** (`data-testid="rotate-invite-link-btn"`).
     - Ao clicar, exibe confirmação inline compacta no próprio bloco (`"Isso invalidará o link anterior. Gerar novo link?"` com `"Confirmar"` (`data-testid="confirm-rotate-invite-btn"`) e `"Cancelar"`), protegendo contra toques acidentais.

### 4.3. Card de Redefinição de Senha (`generated-reset-link-card`)

1. **Cabeçalho em Largura Total**:
   - Linha superior: badge `"Uso único • Válido por 24h"` + botão discreto fechar (`×`, `aria-label="Fechar aviso de redefinição"`).
   - Título abaixo em largura total: `"Link de Redefinição para @username"` (sem quebrar em 3 linhas).
2. **Sem Exibição de Token Técnico na Tela**:
   - Remover o bloco `<p class="font-mono">`/reset/...`</p>`.
   - Manter texto curto orientativo (`"Envie este link único para o participante criar uma nova senha."`) + 2 botões lado a lado:
     - **"Enviar no WhatsApp"** (`data-testid="share-reset-link-btn"`)
     - **"Copiar Link"** (`data-testid="copy-reset-link-btn"`), disparando toast limpo (`"Link de redefinição copiado para @username!"` sem expor a URL longa).

### 4.4. Lista de Participantes (`participants-section` / `admin-participant-row`)

1. **Nome Completo Sem Truncamento**:
   - Linha superior do card do participante dedicada exclusivamente a **Avatar + Nome Completo (`break-words` / sem `truncate` agressivo competindo com badges) + `@username`**.
2. **Faixa de Metadados Compacta**:
   - Logo abaixo do `@username` (ou em linha horizontal dedicada `flex flex-wrap gap-1.5`), exibir as pílulas compactas:
     - GPS (`"GPS 50m"` / `"Sem GPS"` com ícone `gps`)
     - Status de revelação (`data-testid="participant-reveal-badge"`, `data-reveal-status`): `"Aguardando sorteio"`, `"Ainda não espiou"`, `"Já descobriu"`.
3. **Ações Compactas e Seguras**:
   - Botões `"Redefinir Senha"` (`data-testid="generate-reset-token-btn"`) e `"Remover"` (`data-testid="remove-participant-btn"`, apenas quando `OPEN`) em altura acessível (`min-h-11` = `44px`) com menor peso visual para não transformar cada card em um bloco de botões pesados.
   - Ao tocar em `"Remover"`, exibir confirmação inline compacta no próprio item (`"Remover {Nome}?"` + `"Sim, remover"` (`data-testid="confirm-remove-participant-btn"`) + `"Cancelar"`), evitando remoção acidental com um único toque.

---

## 5. Requisitos & Critérios de Aceitação (EARS)

1. WHEN o organizador visualiza o Painel Admin (`/g/:groupId/admin`) em estado `OPEN` THEN the system SHALL exibir o título do evento em largura total abaixo da linha `"Painel do Organizador"` + badge de status, evitando que o título seja espremido ao lado do badge em `390px`.
2. WHEN o organizador visualiza a seção de convite no estado `OPEN` THEN the system SHALL **omitir** a URL técnica (`/g/{groupId}?sig=...`) da interface, oferecendo o botão `"Convidar pelo WhatsApp"` (`data-testid="share-group-link-btn"`) e o botão `"Copiar Link"` (`data-testid="copy-group-link-btn"`) que copia a URL assinada completa e exibe toast conciso sem expor a URL no texto do aviso.
3. WHEN o organizador aciona `"Gerar Novo Link de Convite"` (`data-testid="rotate-invite-link-btn"`) THEN the system SHALL solicitar confirmação inline antes de chamar `rotateInviteLink`, invalidando o link anterior apenas após confirmação explícita.
4. WHEN o grupo está no estado `DRAWN` THEN the system SHALL ocultar a seção de convite/rotação de link de entrada e exibir no card principal o progresso de revelação (`"X de Y já descobriram"`) com barra de progresso visual e atalho para a página do grupo.
5. WHEN o organizador gera um link de redefinição de senha (`data-testid="generated-reset-link-card"`) THEN the system SHALL ocultar o path técnico `/reset/{token}`, exibir os botões `"Enviar no WhatsApp"` e `"Copiar Link"`, permitir fechar o card e exibir toasts concisos sem expor a URL do token.
6. WHEN o organizador visualiza a lista de participantes em viewport mobile (`390px`) THEN the system SHALL exibir os nomes dos participantes sem truncamento causado por badges laterais, posicionando os selos de GPS e revelação em linha própria e solicitando confirmação inline antes de remover um participante (`OPEN`).
7. The system SHALL manter zero overflow horizontal (`scrollWidth <= innerWidth`) em `390x844` e `1280x800`, preservar alvos de toque `>= 44px` e não expor nenhum dado sensível (`drawnParticipantId`, `drawnParticipantName`, `pinHash`).

---

## 6. Impacto em Testes & Plano de Verificação

### 6.1. Testes Unitários (`frontend/src/app/features/admin/admin-dashboard-page.component.spec.ts`)
- Atualizar expectativas que verificavam a presença visível de `signedSharePath` no DOM (`[data-testid="signed-share-path"]`) e no texto do toast, passando a validar o novo botão `"Copiar Link"`, ausência de exposição da URL técnica no card e toasts concisos.
- Cobrir os novos fluxos de confirmação inline (rotação de link e remoção de participante), fechamento/cópia no card de reset, e ocultação do bloco de convite quando `status === 'DRAWN'`.

### 6.2. Verificação Obrigatória Pós-Implementação
1. `cd frontend && npm test` (Vitest 100% verde).
2. `cd frontend && npm run build` (build de produção limpo).
3. **Validação E2E via Playwright** (`390x844` mobile e `1280x800` desktop) inspecionando visualmente os estados `OPEN` (`< 3` e `>= 3` participantes), confirmações inline (rotacionar link, remover participante, sortear), card de redefinição de senha e estado `DRAWN`, confirmando `scrollWidth <= innerWidth` e ausência de erros no console.
