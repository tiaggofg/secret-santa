# Amigo Secreto Familiar Mobile-First Specification

**Status**: Approved
**Approved**: 2026-11-13 - user: "Quero prosseguir com a spec inicial do projeto"

## Problem Statement

Organizar um Amigo Secreto em família frequentemente esbarra na fricção de apps que exigem e-mail, download na loja ou cadastros burocráticos — barreiras que excluem crianças sem celular próprio e idosos. Além disso, sorteios tradicionais não evitam que pessoas da mesma casa tirem umas às outras automaticamente sem intervenção manual propensa a vazamentos, nem oferecem um fluxo simples onde o familiar faz um cadastro rápido (`Nome + Username + PIN`), vê imediatamente os grupos disponíveis para entrar (ou entra direto pelo link do WhatsApp) e revela quem tirou com segurança no mesmo celular compartilhado.

## Goals

- [ ] Permitir que cada familiar faça um cadastro básico rápido (**Nome**, **Username** único e **PIN numérico de 4 a 6 dígitos**) e visualize imediatamente os **Grupos Disponíveis (Abertos)** para se inscrever com 1 toque e a lista **Meus Grupos**, além de poder ingressar diretamente pelo link enviado no WhatsApp (`/g/{slug}`).
- [ ] Permitir que qualquer usuário logado crie um grupo de Amigo Secreto informando apenas o nome do evento (tornando-se automaticamente o **Organizador** do grupo, sem precisar de outra senha separada) e permitir o cadastro sequencial de familiares/dependentes no mesmo aparelho reutilizando o GPS em memória.
- [ ] Garantir sorteio justo por desarranjo matemático (*derangement*) com restrição automática de núcleo familiar num raio de 50 metros via Haversine e fallback automático caso a distribuição torne a restrição matematicamente impossível.
- [ ] Garantir sigilo absoluto dos pares sorteados (ocultos inclusive para o organizador), revelação protegida por `username` + `PIN`, redefinição de PIN via link de uso único (`/reset/{token}`) gerado pelo organizador e limpeza imediata de estado na revelação ("Passar o Celular").

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
| ------- | ------ |
| Cadastro com e-mail obrigatório, SMS ou OAuth externo | Fere o princípio de simplicidade familiar e impede o fluxo de crianças sem celular ou e-mail próprio |
| Envio de link de redefinição via servidor SMTP / SMS | O link único de redefinição (`/reset/{token}`) é gerado pelo Organizador e enviado diretamente no WhatsApp da família |
| Senha de administração separada por grupo | O usuário logado que cria o grupo já é o Organizador autenticado (`organizerUserId`) |
| Lista de desejos (Wishlist) ou chat anônimo | Fora do escopo de simplicidade máxima do MVP familiar |
| Edição manual de restrições pelo organizador | A restrição de núcleo familiar é derivada exclusivamente da geolocalização de até 50m |

---

## Assumptions & Open Questions

Every ambiguity is resolved or recorded here - nothing is left silently unclear.

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --------------------- | -------------- | --------- | ---------- |
| Quantidade mínima de participantes para permitir o sorteio | Mínimo de 3 participantes inscritos no grupo | Com 2 participantes o sorteio é determinístico (A tira B e B tira A, sem segredo); a partir de 3 há desarranjo com sigilo real | y |
| Comportamento de geolocalização no fluxo "Cadastrar outro familiar / Trocar de usuário neste aparelho" | Limpar a sessão do usuário anterior em memória e reutilizar no `DeviceSessionGeoStore` as coordenadas recém-capturadas no mesmo aparelho | Pais cadastrando filhos no mesmo sofá pertencem ao mesmo núcleo residencial; evita múltiplos popups repetitivos do navegador | y |
| Agrupamento de núcleo familiar quando GPS é negado ou indisponível | Participante com GPS negado (`latitude = null, longitude = null`) forma um núcleo unitário isolado (sem restrição geográfica contra outros, exceto não tirar a si mesmo) | Sem coordenadas não é possível inferir residência; o fallback seguro permite a inscrição normalmente sem bloquear o usuário | y |
| Regra de transitividade para o raio de 50m (Haversine) | Componentes conexos (Union-Find): se A está a <= 50m de B e B está a <= 50m de C, A, B e C pertencem ao mesmo núcleo familiar | Evita inconsistências de grafos não-transitivos em residências amplas ou com oscilação de GPS mobile | y |
| Critério matemático de impossibilidade de restrição geográfica e estratégia de fallback | Se `max_cluster_size > floor(N / 2)` (violação do Teorema de Hall para desarranjo multipartido), relaxar a restrição geográfica penalizando o mínimo possível de pares intra-núcleo ou caindo para desarranjo simples uniforme | Garante que o sorteio nunca falhe para a família mesmo quando mais de 50% dos participantes estão na mesma casa | y |
| Cadastro básico de usuário, descoberta de grupos e vínculo de Organizador (`AD-001`) | Usuário cadastra `name` (2..60 chars), `username` único (3..30 chars `[a-z0-9._-]+`, case-insensitive) e `pin` numérico de 4 a 6 dígitos (`^\d{4,6}$`, hash BCrypt); após login/cadastro vê "Meus Grupos" e "Grupos Disponíveis (Abertos)" para se inscrever ou entra direto por `/g/{slug}`; quem cria um grupo é seu `organizerUserId` | Elimina senha de admin separada e permite entrar nos grupos tanto pela lista pós-cadastro quanto pelo link direto do WhatsApp | y |
| Redefinição de senha/PIN esquecida (`AD-001`) | No painel Admin do grupo, o Organizador gera um link de uso único (`/reset/{token}`, válido por 24h) e envia no WhatsApp para o participante definir seu próprio novo PIN sem que o organizador veja o PIN ou o amigo secreto | Permite recuperar acesso sem servidor de e-mail e sem quebrar o sigilo perante o organizador | y |
| Visibilidade do status de relaxamento geográfico | A API retorna no evento de sorteio um booleano `geographicRestrictionRelaxed` indicando se o fallback precisou ser acionado, sem jamais revelar quem tirou quem | Dá transparência técnica sem comprometer o sigilo do sorteio | y |
| Stack de UI, formulários, ícones e testes do Frontend (`AD-004`) | Angular 19+ Standalone + Signals + Native Control Flow (`@if`, `@for`) + Reactive Forms, Tailwind CSS mobile-first (componentes próprios de alto contraste), ícones SVG leves e Vitest para testes unitários | Garante bundle leve em redes móveis, alvos de toque amplos para crianças/idosos e testes rápidos headless sem depender de Chrome | y |
| Compartilhamento de links pelo organizador (`AD-004`) | Web Share API nativa (`navigator.share`) com fallback automático para cópia na área de transferência (`navigator.clipboard.writeText`) tanto para o link do grupo (`/g/{slug}`) quanto para o link de redefinição de PIN (`/reset/{token}`) | Permite enviar links diretamente no WhatsApp com 1 toque no celular | y |
| Persistência e arquitetura do Backend (`AD-005`, `AD-001`) | Clean Architecture validada por ArchUnit (domínio Java 25 puro) + Spring Boot 3.5 (Maven) + MongoDB com collections `users` (`UserAccount`) e `secret_santa_groups` (`SecretSantaGroup` com `participants` embutidos e `@Version` para lock otimista) | Mantém o Aggregate `SecretSantaGroup` com todos os seus participantes em um único documento para atomicidade nativa no sorteio e `UserAccount` para identidade reutilizável entre grupos | y |

**Open questions:** none - all resolved or logged above (required before the spec is confirmed).

---

## User Stories

### P1: Cadastro Básico de Usuário (`username` + `PIN`), Lista de Grupos Disponíveis e Inscrição via Home ou Link do WhatsApp (PART-01, PART-02) ⭐ MVP

**User Story**: Como Participante (ou pai/mãe cadastrando filhos no mesmo celular), quero fazer meu cadastro básico informando Nome, Username e um PIN numérico de 4 a 6 dígitos (ou fazer login), ver imediatamente os grupos disponíveis abertos para me inscrever com 1 toque — ou entrar diretamente pelo link enviado no WhatsApp (`/g/{slug}`) — com captura transparente da minha geolocalização e opção de trocar de usuário no mesmo aparelho para cadastrar dependentes.

**Why P1**: É a porta de entrada de todos os familiares na plataforma, suportando tanto a descoberta de grupos pós-cadastro quanto o ingresso direto pelo link do WhatsApp.

**Acceptance Criteria** (each line is one EARS pattern):

1. WHEN um novo usuário envia `name` (2 a 60 caracteres), `username` único (3 a 30 caracteres `[a-z0-9._-]+`, case-insensitive) e `pin` numérico de 4 a 6 dígitos (`^\d{4,6}$`) para `POST /api/v1/auth/register` THEN the system SHALL persistir a conta `UserAccount` com o hash BCrypt do PIN (`pinHash`) e retornar HTTP 201 com o token de sessão stateless e os dados públicos do usuário (`userId`, `name`, `username`).
2. IF o usuário enviar `name` fora de 2 a 60 caracteres, `username` fora do padrão `^[a-z0-9._-]{3,30}$` ou `pin` que não contenha exclusivamente de 4 a 6 dígitos numéricos THEN the system SHALL rejeitar a requisição com HTTP 400 Bad Request.
3. IF já existir um usuário cadastrado com o mesmo `username` (case-insensitive e após `trim`) em `POST /api/v1/auth/register` THEN the system SHALL rejeitar o cadastro com HTTP 409 Conflict.
4. WHEN um usuário cadastrado envia `username` e `pin` válidos para `POST /api/v1/auth/login` THEN the system SHALL validar o `pin` contra o `pinHash` BCrypt e retornar HTTP 200 com o token de sessão stateless e os dados do usuário.
5. IF o usuário enviar `username` inexistente ou `pin` incorreto para `POST /api/v1/auth/login` THEN the system SHALL rejeitar o login com HTTP 401 Unauthorized.
6. WHEN o usuário autenticado conclui o cadastro/login ou consulta `GET /api/v1/groups` THEN the system SHALL retornar HTTP 200 contendo as listas `myGroups` (grupos onde o usuário já está inscrito ou é organizador) e `availableGroups` (grupos com status `OPEN` nos quais o usuário ainda não está inscrito).
7. WHEN o usuário aciona a inscrição em um grupo aberto (seja clicando em `"Participar"` na lista de Grupos Disponíveis ou acessando o link direto do WhatsApp `/g/{slug}`) THEN the system SHALL solicitar a posição geográfica no navegador via `navigator.geolocation.getCurrentPosition()` com timeout de até 8 segundos e submeter `POST /api/v1/groups/{slug}/participants`.
8. WHERE o usuário concede permissão de geolocalização no navegador, the system SHALL enviar `latitude` (entre -90 e 90) e `longitude` (entre -180 e 180) para `POST /api/v1/groups/{slug}/participants`, inscrevendo o usuário autenticado no grupo e retornando HTTP 201.
9. IF o usuário negar a permissão de geolocalização ou a API de GPS retornar timeout/erro THEN the system SHALL concluir a inscrição no grupo enviando `latitude = null` e `longitude = null` e exibir um aviso não-bloqueante de que a restrição residencial automática não será aplicada àquele cadastro.
10. WHILE um grupo estiver com status `OPEN`, WHEN um visitante ainda não autenticado acessa o link direto `/g/{slug}` enviado pelo WhatsApp THEN the system SHALL permitir criar seu cadastro básico (ou fazer login) na própria tela do grupo e inscrevê-lo automaticamente em `/g/{slug}` logo após a autenticação.
11. IF um usuário tentar se inscrever novamente em um grupo onde já está inscrito ou em um grupo que já esteja com status `DRAWN` THEN the system SHALL rejeitar a requisição `POST /api/v1/groups/{slug}/participants` com HTTP 409 Conflict.
12. WHEN o usuário clica em `"Cadastrar outro familiar / Trocar de usuário neste aparelho"` no frontend THEN the system SHALL limpar imediatamente a sessão de usuário em memória (`AuthStore`) e manter no `DeviceSessionGeoStore` as coordenadas geográficas capturadas na sessão de tela atual para reutilização no cadastro/inscrição do próximo familiar (ex: filho/dependente).

**Independent Test**: Criar um usuário com Nome, Username e PIN de 4 dígitos, ver os grupos disponíveis na Home, inscrever-se em um grupo aberto aceitando o GPS, clicar em "Cadastrar outro familiar / Trocar de usuário neste aparelho", cadastrar uma criança pelo link direto `/g/{slug}` reutilizando o GPS em memória e confirmar que ambos constam inscritos no grupo.

---

### P1: Criação, Administração e Geração de Link de Redefinição pelo Organizador (GRP-01, GRP-02) ⭐ MVP

**User Story**: Como Organizador da família (qualquer usuário autenticado que cria um grupo), quero criar um grupo de Amigo Secreto informando apenas o nome do evento, compartilhar o link direto `/g/{slug}` no WhatsApp, visualizar os inscritos em tempo real, remover cadastros indevidos antes do sorteio, disparar o sorteio com um clique e gerar links únicos de redefinição de PIN (`/reset/{token}`) para familiares que esquecerem a senha, tudo sem jamais ver os pares sorteados nem os PINs dos participantes.

**Why P1**: Governa a criação do evento vinculada ao usuário organizador, o gerenciamento pré-sorteio e a recuperação de acesso dos familiares.

**Acceptance Criteria** (each line is one EARS pattern):

1. WHEN um usuário autenticado envia o nome do evento (entre 3 e 100 caracteres) para `POST /api/v1/groups` THEN the system SHALL criar o grupo com status `OPEN`, definir o usuário autenticado como `organizerUserId`, inscrevê-lo opcionalmente ou disponibilizar o grupo, gerar um `publicSlug` único URL-safe e retornar HTTP 201 com os dados do grupo e o link `/g/{slug}`.
2. IF o usuário enviar nome do evento vazio ou com menos de 3 caracteres para `POST /api/v1/groups` THEN the system SHALL rejeitar a requisição com HTTP 400 Bad Request.
3. WHEN o organizador autenticado consulta `GET /api/v1/groups/{slug}/admin` THEN the system SHALL retornar HTTP 200 com os dados do grupo e a lista de inscritos contendo exclusivamente `id`, `userId`, `name`, `username`, `hasGeoLocation`, `revealStatus` (`WAITING_DRAW`, `PENDING_REVEAL` ou `REVEALED`) e `createdAt`.
4. The system SHALL omitir de todas as respostas administrativas, públicas e logs qualquer referência a `drawnParticipantId`, `pinHash`, `resetTokenHash` ou ao mapeamento `quem_tirou_quem`.
5. WHILE o grupo estiver com status `OPEN`, WHEN o organizador solicita a exclusão de um participante via `DELETE /api/v1/groups/{slug}/admin/participants/{participantId}` THEN the system SHALL remover o participante do grupo e retornar HTTP 204.
6. IF o organizador tentar remover um participante quando o grupo já estiver com status `DRAWN` THEN the system SHALL bloquear a operação e retornar HTTP 409 Conflict.
7. IF uma requisição aos endpoints `/admin` de um grupo não contiver token de sessão válido ou pertencer a um usuário diferente do `organizerUserId` daquele grupo THEN the system SHALL rejeitar a chamada com HTTP 401 Unauthorized (se não autenticado) ou HTTP 403 Forbidden (se autenticado como outro usuário).
8. WHEN o organizador solicita a geração de link de redefinição de PIN para um participante do seu grupo via `POST /api/v1/groups/{slug}/admin/participants/{participantId}/reset-token` THEN the system SHALL gerar um token criptográfico de uso único válido por 24 horas na conta `UserAccount` daquele participante, armazenar apenas seu hash e retornar HTTP 200 com a rota `/reset/{token}` para compartilhamento.
9. WHEN o organizador aciona o botão de compartilhar o link público do grupo (`/g/{slug}`) ou o link de redefinição de PIN (`/reset/{token}`) no painel administrativo THEN the system SHALL invocar a Web Share API nativa (`navigator.share`) quando suportada pelo navegador ou copiar a URL via `navigator.clipboard.writeText` como fallback exibindo confirmação visual.

**Independent Test**: Fazer login como usuário A, criar um grupo, acessar o painel admin, compartilhar o link, gerar um link `/reset/{token}` para o participante B e verificar que o usuário B recebe HTTP 403 se tentar acessar `/admin` do grupo criado por A.

---

### P1: Algoritmo de Sorteio com Desarranjo e Restrição Geográfica Haversine (DRAW-01, DRAW-02) ⭐ MVP

**User Story**: Como Organizador, quero disparar o sorteio com um clique para que o sistema distribua os pares garantindo que ninguém tire a si mesmo e evitando que pessoas cadastradas num raio de 50 metros tirem umas às outras sempre que matematicamente possível, persistindo tudo de forma atômica no documento do grupo.

**Why P1**: É a regra de negócio central da aplicação que resolve o problema de moradores da mesma casa se tirarem.

**Acceptance Criteria** (each line is one EARS pattern):

1. WHILE o grupo estiver com status `OPEN` e possuir pelo menos 3 participantes inscritos, WHEN o organizador autenticado aciona `POST /api/v1/groups/{slug}/admin/draw` THEN the system SHALL calcular os núcleos familiares, executar o algoritmo de sorteio, persistir todos os pares atomicamente no documento MongoDB do grupo, alterar o status do grupo para `DRAWN` e retornar HTTP 200.
2. IF o organizador acionar `POST /api/v1/groups/{slug}/admin/draw` quando o grupo possuir menos de 3 participantes inscritos THEN the system SHALL rejeitar o sorteio com HTTP 422 Unprocessable Entity informando que são necessários no mínimo 3 participantes.
3. IF o organizador acionar `POST /api/v1/groups/{slug}/admin/draw` quando o grupo já estiver com status `DRAWN` THEN the system SHALL rejeitar a requisição com HTTP 409 Conflict.
4. The system SHALL agrupar no mesmo núcleo familiar (`householdClusterId`) todos os participantes com coordenadas válidas cuja distância geodésica calculada pela fórmula de Haversine seja menor ou igual a 50,0 metros, aplicando fechamento transitivo (componentes conexos).
5. The system SHALL atribuir cada participante sem coordenadas geográficas (`latitude = null` ou `longitude = null`) a um núcleo familiar individual exclusivo.
6. WHERE o maior núcleo familiar possuir tamanho menor ou igual a `floor(N / 2)` (onde `N` é o total de participantes do grupo), the system SHALL gerar um desarranjo aleatório estrito em que nenhum participante tire a si mesmo (`giver.id != receiver.id`) e nenhum participante tire alguém do mesmo `householdClusterId` (`giver.clusterId != receiver.clusterId`), registrando `geographicRestrictionRelaxed = false`.
7. IF o maior núcleo familiar possuir tamanho estritamente maior que `floor(N / 2)` tornando impossível um desarranjo estrito entre núcleos distintos THEN the system SHALL aplicar fallback automático gerando um desarranjo válido (`giver.id != receiver.id`) que minimize colisões intra-núcleo e registrar `geographicRestrictionRelaxed = true` no grupo.

**Independent Test**: Executar testes de unidade e integração com cenários de: (a) 2 casas de 3 pessoas cada (50m intra-casa, 5km entre casas) verificando zero pares da mesma casa; (b) 1 casa com 5 pessoas e 1 pessoa externa (6 total, `5 > 6/2`) verificando que o fallback executa sem erro, ninguém tira a si mesmo e `geographicRestrictionRelaxed = true`.

---

### P1: Revelação Efêmera Autenticada por Username + PIN e Redefinição por Link — Fluxo "Passar o Celular" (REV-01, SEC-01) ⭐ MVP

**User Story**: Como Participante (adulto ou criança usando o celular dos pais), quero consultar quem eu tirei em um grupo sorteado informando meu `username` e meu `PIN` numérico (ou tocando no meu nome na lista do grupo para preencher o `username` e digitando meu `PIN`), poder redefinir meu `PIN` através de um link único (`/reset/{token}`) caso eu tenha esquecido e ter certeza de que, ao fechar o card de revelação ou bloquear a tela, meu resultado e meu PIN desaparecem imediatamente da memória para que eu possa passar o celular para a próxima pessoa com segurança.

**Why P1**: Garante proteção individual com `username` + `PIN` e recuperação de senha sem quebrar o sigilo no compartilhamento do mesmo aparelho.

**Acceptance Criteria** (each line is one EARS pattern):

1. WHILE o grupo estiver com status `DRAWN`, WHEN qualquer usuário acessa a página do grupo `/g/{slug}` (pela Home ou pelo link do WhatsApp) THEN the system SHALL exibir o formulário de revelação por `username` + `PIN` (pré-preenchendo o `username` se houver usuário logado ou ao tocar em um participante da lista) e a lista de participantes inscritos (`name`, `username` e status `PENDING_REVEAL` ou `REVEALED`).
2. WHEN o participante submete `username` e `pin` válidos para `POST /api/v1/groups/{slug}/participants/reveal` enquanto o grupo está `DRAWN` THEN the system SHALL validar o `pin` contra o `pinHash` BCrypt da conta `UserAccount` correspondente, marcar `revealedAt` no participante do grupo caso ainda não revelado e retornar HTTP 200 contendo `drawnParticipantName`.
3. IF o participante submeter um `username` que não pertença ao grupo ou um `pin` incorreto para `POST /api/v1/groups/{slug}/participants/reveal` THEN the system SHALL rejeitar a requisição com HTTP 401 Unauthorized informando que o usuário ou PIN está incorreto.
4. IF o participante acionar `POST /api/v1/groups/{slug}/participants/reveal` enquanto o grupo ainda estiver com status `OPEN` THEN the system SHALL rejeitar a chamada com HTTP 409 Conflict informando que o sorteio ainda não foi realizado.
5. WHEN a resposta de revelação chega ao frontend Angular THEN the system SHALL limpar o campo `pin` do formulário e exibir o nome sorteado em um modal/card de alto contraste com botão `"Fechar e passar o celular"`.
6. WHEN o usuário fecha o modal de revelação, clica em trocar de usuário, navega para outra rota ou o documento dispara `visibilitychange` para `hidden` THEN the system SHALL sobrescrever/limpar imediatamente o Signal em memória que contém `drawnParticipantName` e destruir o elemento do DOM correspondente.
7. The system SHALL nunca persistir `drawnParticipantName` nem o `pin` do participante em `localStorage`, `sessionStorage`, `IndexedDB`, cookies, Cache API ou histórico de URL do navegador.
8. WHEN o participante acessa o link único `/reset/{token}` e submete um novo `pin` numérico de 4 a 6 dígitos para `POST /api/v1/auth/reset-pin` com um token válido e não expirado THEN the system SHALL atualizar o `pinHash` BCrypt daquele `UserAccount`, invalidar imediatamente o token de redefinição (uso único) e retornar HTTP 200.
9. IF o participante submeter um token de redefinição inexistente, já utilizado ou expirado para `POST /api/v1/auth/reset-pin` THEN the system SHALL rejeitar a requisição com HTTP 400 Bad Request informando que o link de redefinição é inválido ou expirou.

**Independent Test**: Realizar o sorteio de um grupo, abrir `/g/{slug}`, tentar revelar com PIN errado (recebendo 401), revelar com `username` + PIN corretos, visualizar o amigo secreto no modal, clicar em "Fechar e passar o celular" verificando limpeza total do DOM/memória, e testar a geração e uso do link `/reset/{token}` para definir um novo PIN e consultar novamente.

---

## Edge Cases

- IF o usuário acessar o navegador via HTTP puro em ambiente sem TLS (onde `navigator.geolocation` é bloqueado pelo navegador) THEN the system SHALL capturar o erro de contexto inseguro/indisponibilidade da Geolocation API e prosseguir com o fallback `latitude = null, longitude = null` sem quebrar o fluxo de inscrição no grupo.
- IF duas pessoas da mesma família tentarem cadastrar exatamente o mesmo `username` THEN the system SHALL rejeitar o segundo cadastro com HTTP 409 e sugerir adicionar um sufixo ou sobrenome ao `username`.
- IF todos os participantes do grupo negarem a permissão de GPS THEN the system SHALL executar o sorteio normalmente como um desarranjo clássico uniforme (`geographicRestrictionRelaxed = false`, pois cada participante sem GPS é tratado como núcleo individual).
- WHEN dois usuários concorrentes submeterem inscrição no mesmo grupo simultaneamente no exato instante em que o organizador dispara o sorteio THEN the system SHALL garantir consistência atômica no documento MongoDB do grupo via controle de concorrência otimista (`@Version`) com retry automático para inscrições concorrentes enquanto `OPEN` ou rejeição com HTTP 409 após a transição para `DRAWN`.
- IF um participante tentar reutilizar o mesmo link `/reset/{token}` uma segunda vez após já ter redefinido seu PIN THEN the system SHALL rejeitar com HTTP 400 pois o token é consumido e invalidado imediatamente no primeiro uso.

---

## Requirement Traceability

Each requirement gets a unique ID for tracking across design, tasks, and validation.

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| PART-01 | P1: Cadastro Básico de Usuário (`username` + `PIN`), Lista de Grupos Disponíveis e Inscrição via Home ou Link do WhatsApp | Execute | Implementing |
| PART-02 | P1: Cadastro Básico de Usuário (`username` + `PIN`), Lista de Grupos Disponíveis e Inscrição via Home ou Link do WhatsApp | Execute | Implementing |
| GRP-01 | P1: Criação, Administração e Geração de Link de Redefinição pelo Organizador | Execute | Implementing |
| GRP-02 | P1: Criação, Administração e Geração de Link de Redefinição pelo Organizador | Execute | Implementing |
| DRAW-01 | P1: Algoritmo de Sorteio com Desarranjo e Restrição Geográfica Haversine | Execute | Implementing |
| DRAW-02 | P1: Algoritmo de Sorteio com Desarranjo e Restrição Geográfica Haversine | Tasks | In Tasks |
| REV-01 | P1: Revelação Efêmera Autenticada por Username + PIN e Redefinição por Link — Fluxo "Passar o Celular" | Execute | Implementing |
| SEC-01 | P1: Revelação Efêmera Autenticada por Username + PIN e Redefinição por Link — Fluxo "Passar o Celular" | Execute | Implementing |

**ID format:** `[CATEGORY]-[NUMBER]`

**Status values:** Pending → In Design → In Tasks → Implementing → Verified

**Coverage:** 8 total, 8 mapped to tasks, 0 unmapped

---

## Sources

- Solicitação e refinamentos do usuário na conversa — definem stack Backend (**Java 25 + Spring Boot 3.5 + Maven + MongoDB com Clean Architecture validada por ArchUnit + Docker Compose**), stack Frontend (**Angular 19+ Standalone + Signals + Tailwind CSS + Vitest + Web Share API**), cadastro básico de usuário (**Nome + Username + PIN numérico de 4 a 6 dígitos**), visualização de **Grupos Disponíveis** pós-cadastro ou entrada direta via link do WhatsApp (`/g/{slug}`), criador do grupo como Organizador e redefinição de PIN via link único (`/reset/{token}`).

---

## Success Criteria

How we know the feature is successful:

- [ ] Cadastro básico de um usuário em navegador mobile (Nome, Username sugerido/editável e PIN numérico de 4-6 dígitos) e inscrição em um grupo disponível ou via link direto concluídos em menos de 15 segundos.
- [ ] Cadastro sequencial de familiar/dependente ("Cadastrar outro familiar / Trocar de usuário neste aparelho") concluído sem exigir nova permissão de GPS.
- [ ] 100% dos sorteios em cenários matematicamente possíveis (`max_cluster <= N/2`) geram zero pares dentro do mesmo raio de 50 metros.
- [ ] 100% dos sorteios em cenários matematicamente impossíveis (`max_cluster > N/2`) completam com sucesso via fallback automático em menos de 500ms sem lançar erro ao usuário.
- [ ] Redefinição de PIN via link único `/reset/{token}` permite ao participante trocar seu PIN em 1 passo sem expor a nova senha nem o amigo secreto ao organizador.
- [ ] Zero bytes de dados sensíveis (`drawnParticipantName` ou `pin`) persistidos em `localStorage`, `sessionStorage` ou DOM após fechamento do modal de revelação.
