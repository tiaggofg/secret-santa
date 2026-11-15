---
trigger: always_on
---

# Regra de Verificação Pós-Implementação (Playwright & Backend Requests)

Após finalizar qualquer implementação, refatoração funcional ou correção de bug neste projeto, você **DEVE** validar a entrega executando testes reais de acordo com o escopo da alteração:

## 1. Alterações com Frontend ou Full-Stack (UI + API)
- Sempre que uma implementação envolver o **Frontend** (ou **Frontend + Backend**), após rodar os testes unitários (`npm test` / `mvn test`), execute um **teste fim a fim via Playwright** (utilizando script Playwright ou o agente de navegador) sobre a aplicação em execução.
- Verifique na prática a renderização dos componentes, interações de clique/preenchimento, navegação entre rotas (`/`, `/g/:slug`, `/g/:slug/admin`, `/reset/:token`), regras de sigilo efêmero e respostas reais da API.

## 2. Alterações Exclusivamente no Backend (Somente Backend)
- Quando a implementação for **somente no Backend** (sem mudanças de interface ou comportamento visual no Frontend), após rodar a suíte de testes (`cd backend && mvn test`), valide a alteração executando **requests HTTP reais** (via `curl`, script de requests ou cliente HTTP) diretamente contra o servidor backend (`http://localhost:8080/api/v1/...`).
- Verifique os payloads JSON de request/response, headers de autenticação (`Authorization: Bearer ...`), status codes HTTP esperados (sucesso e casos de erro) e efeitos colaterais no banco de dados.

## 3. Critério de Conclusão
- Nenhuma tarefa de implementação deve ser dada como concluída sem a evidência da execução do teste via **Playwright** (para mudanças que tocam frontend/full-stack) ou dos **requests HTTP para o backend** (quando for somente backend).
