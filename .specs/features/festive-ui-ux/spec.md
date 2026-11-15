# Festive Christmas UI/UX Overhaul Specification

**Status**: Approved
**Created**: 2026-11-15
**Scope**: Frontend (`frontend/`) — Sem alterações de contrato de API ou regras de negócio no Backend.
**Base Spec**: `.specs/features/secret-santa/spec.md` (`AD-001`..`AD-005`)

---

## 1. Problem Statement & Diagnóstico Real (Auditoria Playwright MCP)

Embora o MVP funcional atenda às regras de domínio e sigilo, a auditoria visual e interativa realizada em todas as rotas da aplicação via **Playwright MCP** (`390x844` mobile e `1280x800` desktop) identificou oportunidades críticas para elevar a interface a um padrão profissional, acolhedor e verdadeiramente comemorativo de **Natal em Família**:

| Rota / Componente Auditado | Evidência Observada no MVP Atual | Impacto na Experiência Familiar |
| :--- | :--- | :--- |
| **Shell Global & Desktop (`1280x800`)** | Header plano `bg-emerald-700`, fundo frio `bg-slate-50`, container `max-w-md` branco isolado no desktop sem ambientação festiva. | Passa sensação de formulário administrativo genérico em vez de celebração natalina de fim de ano. |
| **Home (`/`) — Não Autenticado** | Card direto com abas, sem hero de boas-vindas natalino, sem toggle de visualizar PIN numérico e sem feedback inline antes do submit. | Visitantes (especialmente idosos) não recebem contexto visual imediato de simplicidade ("Sem e-mail, só Nome + PIN"). |
| **Home (`/`) — Autenticado & GPS** | Ao clicar em `Participar`, todos os botões ficam desabilitados por até `8s` aguardando GPS **sem spinner ou mensagem de progresso**. Grupo criado sem inscrição aparece duplicado em *Disponíveis* e *Meus Grupos*. Textos usam `"0 participante(s)"`. | Usuário acredita que a tela travou durante os 8 segundos do GPS; gramática robótica e confusão sobre o próprio grupo recém-criado. |
| **Página Pública (`/g/:slug`)** | Lista de participantes no estado `OPEN` usa `<button>` clicável sem ação; no estado `DRAWN` exibe jargão técnico `PENDING_REVEAL (Falta ver)` e `REVEALED (Já viu)`. | Crianças e avós leem termos técnicos em inglês na tela; elementos parecem clicáveis quando não são. |
| **Modal de Revelação (`app-ephemeral-reveal-modal`)** | Cartão branco simples com borda verde e caixa escura; em páginas mais longas, o fundo não trava rolagem e o conteúdo inferior pode aparecer em capturas `fullPage`. | O clímax emocional do produto ("quem eu tirei!") carece de emoção, brilho natalino e clareza tátil para o modo "Passar o Celular". |
| **Painel Admin (`/g/:slug/admin`)** | **Bug visual de overflow**: o alerta `Link de redefinição copiado: http://...` estoura horizontalmente fora do card em `390px`. Badges exibem `OPEN (Inscrições Abertas)`, `DRAWN (Sorteado)` e `WAITING_DRAW`. Botão de sorteio dispara ação irreversível sem confirmação. | Quebra de layout no celular; texto técnico exposto; risco de organizador disparar o sorteio acidentalmente com 1 toque. |
| **Redefinição de PIN (`/reset/:token`)** | Tela funcional porém visualmente árida, sem toggle de visualizar o PIN digitado e sem acolhimento visual natalino. | Experiência impessoal para quem já está frustrado por ter esquecido o PIN. |

---

## 2. Goals (Objetivos de UI/UX)

- [ ] **Identidade Natalina Sofisticada ("Noite de Natal Acolhedora")**: Transformar toda a aplicação em uma experiência festiva de alto nível profissional — calorosa, celebratória e elegante (sem clichês pesados ou poluição visual).
- [ ] **Inclusão Multigeracional (Idosos, Pais e Crianças)**: Alvos de toque amplos (`>= 48px`), contraste elevado (WCAG AA/AAA), linguagem 100% humana em português (zero códigos de enum expostos), toggle para conferir o PIN digitado e instruções passo-a-passo claras.
- [ ] **Clímax Memorável na Revelação do Amigo Secreto**: Transformar o `EphemeralRevealModalComponent` em um momento mágico de "desembrulhar o presente", preservando integralmente o sigilo efêmero (`AD-003`).
- [ ] **Respostas Visuais Claras & Zero Quebras de Layout**: Corrigir overflow horizontal em URLs longas, adicionar estado explícito de carregamento durante captura de GPS (até 8s) e incluir confirmação segura antes do sorteio irreversível.
- [ ] **Preservação Integral das Invariantes Arquiteturais**: Manter `AuthSessionStore` e `drawnParticipantName` exclusivamente em memória volátil (zero `localStorage`/`sessionStorage`/cookies/URL), manter `data-testid` estáveis e 100% compatível com a API REST atual.

---

## 3. Out of Scope

| Item | Motivo |
| :--- | :--- |
| Alterações no Backend Java, endpoints REST ou banco MongoDB | A API existente já suporta todos os dados necessários; a melhoria é estritamente de UI/UX no Frontend. |
| Sons/áudio automático ou animações pesadas (Canvas/WebGL/Lottie externo) | Mantém o bundle leve para redes móveis familiares e evita distrações/bloqueios de autoplay. |
| Wishlist, chat anônimo ou upload de foto de perfil | Respeita o escopo de simplicidade máxima sem cadastro complexo (`AD-001`). |
| Armazenamento persistente de sessão ou resultado sorteado | Proibido por `AD-003` (segurança do modo "Passar o Celular"). |

---

## 4. Direção Criativa & Design System Natalino

### 4.1. Conceito Estético: *Noite de Natal Acolhedora (Cozy Festive Editorial)*
Em vez de verde-clínico sobre branco frio, o aplicativo passa a evocar um **cartão-convite natalino contemporâneo**: papel pergaminho quente ao toque, verde pinheiro profundo, detalhes em vermelho cranberry e toques refinados de dourado champanhe.

### 4.2. Paleta de Cores & Tokens Semânticos

Configurados em `frontend/tailwind.config.js` e `frontend/src/styles.css`:

| Token / Papel | Cor Hex | Uso Principal |
| :--- | :--- | :--- |
| `festive-cream` (Fundo Mobile / Superfície Base) | `#FAF7F2` | Fundo principal da área de conteúdo, substituindo `bg-slate-50`/`bg-white` frio. |
| `festive-night` (Fundo Desktop Externo) | `#0B2E23` | Ambiente externo em telas `>= 768px`, com brilho radial suave e pontos sutis de neve estática. |
| `festive-card` (Superfície de Cartões) | `#FFFFFF` com borda `#E8DFD1` | Cartões com cantos `rounded-2xl`/`rounded-3xl`, borda quente e sombra difusa `shadow-sm`. |
| `pine-800` / `pine-900` (Primária Pinheiro) | `#0F4C3A` / `#0A3629` | Header festivo, CTAs principais, links de navegação e destaques positivos. |
| `pine-50` / `pine-100` (Superfície Pinheiro Suave) | `#ECFDF5` / `#D1FAE5` | Cartão de usuário conectado, confirmações de sucesso e badges de participante revelado. |
| `cranberry-700` / `cranberry-800` (Acento Natalino) | `#B91C1C` / `#991B1B` | Laço do presente, destaque da revelação do Amigo Secreto, alertas e ações destrutivas/irreversíveis. |
| `gold-600` / `gold-100` / `gold-50` (Dourado Estrela) | `#B45309` / `#FEF3C7` / `#FFFBEB` | Selo de Organizador, filetes decorativos, estrelas/luzes de Natal, card de Reset de PIN e status "Inscrições Abertas". |
| `ink-900` / `ink-600` (Tipografia Alto Contraste) | `#1C1917` / `#57534E` | Textos principais e secundários em tom carvão quente (contraste >= 4.5:1 em todas as combinações). |

### 4.3. Tipografia
- **Display / Títulos Festivos (`font-display`)**: `Fraunces` (pesos `600, 700, 800`, carregada via Google Fonts no `index.html` com `display=swap` e fallback `'Georgia', serif`) aplicada em títulos principais (`h1`), nome do evento e no nome revelado no modal.
- **UI & Formulários (`font-sans`)**: `Plus Jakarta Sans` (pesos `400, 500, 600, 700, 800`, fallback system-ui) com `tabular-nums` para contadores e PINs.

### 4.4. Iconografia, Texturas & Movimento
- **Ícones SVG Inline Leves**: Conjunto coeso (`stroke-width="1.8"`) incluindo presente com laço, pinheiro estilizado, floco de neve/estrela de 4 pontas, ícone de WhatsApp/compartilhar, cadeado/chave dourada, GPS/casa e troca de familiar.
- **Guirlanda / Filete Luminoso Sutil**: Linha decorativa fina no topo abaixo do header ou nos cards-convite com pequenas luzinhas/estrelas estáticas em dourado e cranberry (sem piscar agressivo).
- **Motion Responsável**: Animações CSS leves de entrada (`fade-slide-up` 200ms) e brilho comemorativo no modal de revelação, obrigatoriamente desativadas sob `@media (prefers-reduced-motion: reduce)`.

---

## 5. Requisitos & Critérios de Aceitação por Página (EARS)

### 5.1. Global Shell, Responsividade & Feedbacks (`AppComponent` & Transversal)

1. WHEN a aplicação é renderizada em viewports desktop (`>= 768px`) THEN the system SHALL apresentar um fundo natalino noturno (`#0B2E23`) com iluminação radial sutil emoldurando o container principal centralizado (`max-w-lg`) em superfície `#FAF7F2` com borda dourada discreta e sombra elevada.
2. WHEN a aplicação é renderizada em viewports mobile (`< 768px`) THEN the system SHALL preencher toda a largura sem bordas desperdiçadas, com cabeçalho fixo ou superior em verde pinheiro profundo, título **"Amigo Secreto"**, emblema natalino de presente/estrela, subtítulo sutil `"Edição de Natal"` e zero barra de rolagem horizontal (`overflow-x-hidden`).
3. WHEN qualquer mensagem de feedback ou link longo (`/g/...`, `/reset/...`) é exibida em banners de status, erro ou cards THEN the system SHALL aplicar quebra automática de linha (`break-words` / `break-all`) garantindo que nenhum texto ultrapasse a largura do cartão em telas de `360px` ou `390px`.
4. WHEN qualquer ação assíncrona está em andamento (login, cadastro, criação de grupo, sorteio ou captura de GPS de até `8s`) THEN the system SHALL exibir indicador visual explícito de carregamento (spinner SVG animado + rótulo contextual, ex: `"Localizando residência..."`) no botão ou banner ativo, diferenciando-o de um travamento.
5. The system SHALL exibir contagens de participantes com pluralização natural em português (`"Nenhum participante ainda"`, `"1 participante"`, `"N participantes"`) em todas as páginas.

---

### 5.2. Página Inicial — Visitante Não Autenticado (`/`)

1. WHEN o usuário não autenticado acessa `/` THEN the system SHALL exibir um **Hero Natalino Compacto** acima do formulário com título acolhedor (`"Amigo Secreto"`), descrição curta e 3 pílulas de valor (`"Sem e-mail"`, `"PIN de 4-6 dígitos"`, `"Evita mesma casa"`).
2. WHEN o usuário preenche um campo de PIN numérico (`reg-pin` ou `login-pin`) THEN the system SHALL oferecer um botão tátil (`min-w-11 min-h-11`, `aria-label="Mostrar ou ocultar PIN"`) para alternar entre `type="password"` e `type="text"` permitindo conferência fácil por idosos e pais.
3. WHEN o usuário toca ou digita nos campos de cadastro (`name`, `username`, `pin`) com valores inválidos após interação (`touched`/`dirty`) THEN the system SHALL exibir mensagens de validação inline claras abaixo do campo antes mesmo da submissão, mantendo a submissão por `Enter` e os `data-testid` (`tab-register`, `tab-login`, `register-form`, `login-form`, `register-submit`, `login-submit`, `auth-error`).

---

### 5.3. Página Inicial — Usuário Autenticado (`/`)

1. WHEN o usuário está autenticado na Home THEN the system SHALL exibir uma barra compacta de identidade festiva com avatar de iniciais do usuário, nome, `@username`, e um botão discreto **"Trocar / Sair"** (`data-testid="switch-family-user-btn"`) que limpa a sessão em memória mantendo o GPS da sessão (`DeviceSessionGeoStore`).
2. The system SHALL exibir na Home **exclusivamente** a seção **"Meus Grupos"** (`data-testid="my-groups-section"`) — omitindo listagens abertas de terceiros para preparar o fluxo de grupos privados acessíveis apenas via link de convite.
3. WHEN o usuário visualiza **"Meus Grupos"** (`data-testid="my-groups-section"`) THEN the system SHALL diferenciar claramente grupos `OPEN` (selo dourado `"Aberto • Aguardando sorteio"`) de grupos `DRAWN` (selo festivo pinheiro/cranberry `"Sorteio realizado!"` com CTA primário destacado `"Descobrir Meu Amigo"`).
4. WHEN o usuário aciona o botão **"+ Criar Grupo"** (`data-testid="open-create-group-modal-btn"`) na Home THEN the system SHALL abrir um **modal** (`data-testid="create-group-modal"`) contendo 3 sugestões rápidas clicáveis (chips opcionais como `"Natal da Família 2026"`, `"Amigo Secreto dos Primos"`, `"Ceia de Natal em Casa"`), o formulário `create-group-form` (`#event-name`, `create-group-submit`) e opção de cancelar/fechar, fechando o modal automaticamente ao criar o grupo com sucesso.

---

### 5.4. Página Pública do Grupo (`/g/:slug`)

1. WHEN qualquer pessoa acessa `/g/:slug` THEN the system SHALL exibir um **Cartão-Convite Natalino** com o nome do evento em tipografia display, selo festivo de status (`"Inscrições Abertas"` ou `"Sorteio Realizado"`), contador natural de inscritos e, quando `OPEN` com `< 3` inscritos, um indicador visual amigável de quantas pessoas faltam para liberar o sorteio (`"Faltam X pessoa(s) para o sorteio"`).
2. WHILE o grupo estiver `OPEN` e o visitante não estiver autenticado THEN the system SHALL apresentar cabeçalho de convite acolhedor (`"Você foi convidado para este Amigo Secreto!"`) com toggle de visualização do PIN no cadastro/login rápido (`visitor-register-form`, `visitor-login-form`) e explicação amigável de 1 linha sobre a permissão de GPS (`"Usamos sua localização só para evitar tirar quem mora na mesma casa"`).
3. WHILE o grupo estiver `OPEN` THEN the system SHALL renderizar os itens da lista de participantes como cartões informativos não-interativos (sem `cursor-pointer` nem aparência de botão), exibindo avatar com iniciais em tons natalinos, nome, `@username` e selo `"Confirmado"`.
4. WHILE o grupo estiver `DRAWN` THEN the system SHALL renderizar a seção **"Consultar Quem Eu Tirei"** com guia visual simples em 3 passos (`1. Toque no seu nome` → `2. Digite seu PIN` → `3. Abra seu presente`), botão de destaque comemorativo `"Abrir Meu Presente"` (`data-testid="reveal-submit-btn"`) e toggle para mostrar/ocultar o PIN.
5. WHILE o grupo estiver `DRAWN` THEN the system SHALL renderizar cada participante da lista como botão interativo (`data-testid="participant-list-item"`) que destaca o item selecionado (borda pinheiro/dourada), preenche o campo `username`, exibe linguagem humana (`"Já descobriu"` vs `"Ainda não espiou"` com ícone de presente aberto/fechado) e preserva o atributo `data-reveal-status` para automação sem expor texto técnico ao usuário final.

---

### 5.5. Modal de Revelação Efêmera (`EphemeralRevealModalComponent`)

1. WHEN o participante revela com sucesso seu Amigo Secreto THEN the system SHALL travar a rolagem da página subjacente e cobrir 100% da viewport (`fixed inset-0 z-50`) com backdrop escuro translúcido em tom noturno natalino (`#061A14/92`) e `backdrop-blur-sm`.
2. WHEN o modal está aberto THEN the system SHALL exibir um **Cartão-Presente Celebratório** (`data-testid="ephemeral-reveal-card"`) contendo:
   - Faixa/laço superior decorativo em vermelho cranberry e dourado com ícone de presente aberto / estrela;
   - Contexto exclusivo (`"Consulta exclusiva de @username"`);
   - Caixa central de altíssimo contraste (`#0A3629` com borda dourada `#F59E0B` e texto branco `font-display text-3xl sm:text-4xl`) exibindo `drawnParticipantName` (`data-testid="drawn-participant-name"`);
   - Aviso de privacidade claro do modo **"Passar o Celular"** (ícone de olho protegido / escudo);
   - Botão amplo (`min-h-[52px]`) de alto contraste `"Fechar e passar o celular"` (`data-testid="close-and-pass-phone-btn"`).
3. The system SHALL manter integralmente todas as garantias de sigilo efêmero de `AD-003`: nenhum dado do sorteio ou PIN em `localStorage`, `sessionStorage`, `IndexedDB`, cookies ou URL, com limpeza imediata do Signal e destruição do DOM ao clicar em fechar, em `ngOnDestroy` e em `document:visibilitychange` (`hidden`).

---

### 5.6. Painel do Organizador (`/g/:slug/admin`)

1. WHEN o organizador acessa `/g/:slug/admin` THEN the system SHALL exibir métricas resumidas em pílulas visuais: total de inscritos, quantos possuem proteção residencial (`GPS 50m`) e, quando `DRAWN`, progresso de revelação (`"X de Y já descobriram"`).
2. WHEN o organizador visualiza as ações do grupo THEN the system SHALL apresentar o botão primário `"Convidar Família no WhatsApp"` (`data-testid="share-group-link-btn"`) com visual limpo (sem URL gigante dentro do botão) e um bloco compacto logo abaixo exibindo o caminho `/g/{slug}` com `break-all` e ação rápida de copiar.
3. WHILE o grupo estiver `OPEN` e possuir `>= 3` inscritos, WHEN o organizador clica em `"Realizar Sorteio Agora"` (`data-testid="execute-draw-btn"`) THEN the system SHALL exibir uma **confirmação inline expansível** no próprio cartão (sem `window.confirm`) alertando que o sorteio é definitivo e impede futuras remoções, oferecendo `"Sim, Sortear Agora!"` (`data-testid="confirm-draw-btn"`) e `"Cancelar"`, mantendo a execução segura da API apenas após a confirmação explícita. *(Nota: os testes automatizados que clicam no fluxo de sorteio deverão contemplar este passo de confirmação seguro).*
4. WHEN o organizador visualiza cada participante na lista administrativa THEN the system SHALL exibir apenas rótulos humanos em português (`"Inscrições Abertas"`, `"Sorteio Realizado"`, `"Aguardando sorteio"`, `"Ainda não espiou"`, `"Já descobriu"` — sem siglas como `OPEN`, `DRAWN`, `WAITING_DRAW`, `PENDING_REVEAL` visíveis no texto), mantendo `data-group-status` e `data-reveal-status` nos elementos para rastreabilidade.
5. WHEN o organizador gera um link de redefinição de PIN THEN the system SHALL exibir o cartão dourado (`data-testid="generated-reset-link-card"`) com indicação clara de validade (`"Uso único • Válido por 24h"`), URL com `break-all`, botão `"Enviar no WhatsApp"` (`data-testid="share-reset-link-btn"`) e feedback toast responsivo sem overflow horizontal.

---

### 5.7. Página de Redefinição de PIN (`/reset/:token`)

1. WHEN o familiar acessa `/reset/:token` THEN the system SHALL exibir cartão acolhedor com ícone de chave dourada, título `"Criar Novo PIN"`, explicação simples de uso único e campo de PIN com botão mostrar/ocultar (`aria-label="Mostrar ou ocultar PIN"`) e validação inline para 4 a 6 dígitos.
2. WHEN a redefinição é concluída com sucesso THEN the system SHALL exibir cartão comemorativo (`data-testid="reset-pin-success"`) com confirmação clara para `@username` e CTA destacado `"Ir para Meus Grupos"` (`data-testid="proceed-home-link"`).
3. IF o token for inválido, expirado ou já utilizado THEN the system SHALL exibir alerta claro (`data-testid="reset-pin-error"`) orientando o usuário a pedir um novo link ao organizador no WhatsApp.

---

## 6. Critérios de Qualidade, Acessibilidade & Verificação

### 6.1. Padrão de Qualidade & Acessibilidade
- **Alvos de toque**: Todos os botões, abas, chips e toggles interativos com altura mínima `>= 44px` (`min-h-12` = `48px` para ações primárias).
- **Contraste WCAG**: Mínimo `4.5:1` para textos normais e `3:1` para textos grandes/elementos gráficos; modal de revelação com contraste `>= 7:1`.
- **Semântica & Leitores de Tela**: `role="tablist"`/`aria-selected` nas abas, `role="alert"` em erros, `role="status"` em avisos, `role="dialog"` + `aria-modal="true"` no modal de revelação, foco visível (`focus-visible:ring-2 focus-visible:ring-amber-500`).
- **Bundle Leve**: Zero novas dependências JavaScript pesadas; apenas CSS/Tailwind + SVG inline + fontes web com `display=swap`.

### 6.2. Plano de Verificação Obrigatório Pós-Implementação
Conforme `.agents/rules/post-implementation-testing.md`:
1. **Testes Unitários Frontend**: `cd frontend && npm test` (todos os specs Vitest passando, incluindo preservação das invariantes de sigilo efêmero `C33`–`C35` e seleção por `data-testid`).
2. **Build de Produção**: `cd frontend && npm run build` sem erros ou warnings críticos de orçamento.
3. **Validação Ponta a Ponta via Playwright (Mobile `390x844` + Desktop `1280x800`)**:
   - Capturar e inspecionar visualmente todas as telas (`/`, `/g/:slug` OPEN visitante e autenticado, `/g/:slug/admin` OPEN com confirmação de sorteio + link de reset + DRAWN, `/g/:slug` DRAWN + `EphemeralRevealModalComponent`, `/reset/:token` formulário + sucesso + erro).
   - Confirmar `scrollWidth <= innerWidth` (zero overflow horizontal em `390px`) e ausência de erros no console.
