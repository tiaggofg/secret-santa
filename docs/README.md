# 📚 Documentação Técnica — Amigo Secreto

Bem-vindo à documentação técnica do projeto **Amigo Secreto Familiar Mobile-First**. Aqui estão consolidados a arquitetura, o modelo de domínio, os fluxos de negócio, os contratos da API REST, as garantias de segurança e o pipeline de deploy.

---

## 🗺️ Mapa de Documentos

| Documento | Descrição |
| :--- | :--- |
| [Arquitetura e Diagramas C4](file:///home/tiago.godoy@db1.com.br/workspace/tiaggofg/secret-santa/docs/arquitetura-c4.md) | Diagramas C4 (Contexto, Containers, Componentes) e regras de Clean Architecture validadas por ArchUnit |
| [Modelo de Domínio e Dados](file:///home/tiago.godoy@db1.com.br/workspace/tiaggofg/secret-santa/docs/modelo-dominio-e-dados.md) | Diagrama de Classes do domínio, Diagrama ER / Documentos MongoDB, índices e máquina de estados |
| [Fluxos e Diagramas de Sequência](file:///home/tiago.godoy@db1.com.br/workspace/tiaggofg/secret-santa/docs/fluxos-e-sequencias.md) | Fluxograma completo da jornada e diagramas de sequência (Convite, Sorteio, Revelação Efêmera, Reset PIN) |
| [Algoritmo de Sorteio](file:///home/tiago.godoy@db1.com.br/workspace/tiaggofg/secret-santa/docs/algoritmo-sorteio.md) | Cálculo de distância Haversine (`<= 50m`), Union-Find e desarranjo bipartido com relaxamento automático |
| [Referência da API REST](file:///home/tiago.godoy@db1.com.br/workspace/tiaggofg/secret-santa/docs/api-rest.md) | Todos os endpoints `/api/v1`, headers de autenticação, DTOs e tratamento de erros |
| [Segurança e Privacidade](file:///home/tiago.godoy@db1.com.br/workspace/tiaggofg/secret-santa/docs/seguranca-e-privacidade.md) | Hash BCrypt, tokens HMAC-SHA256, convites assinados, ocultação de dados e sigilo efêmero em Signals |
| [Deploy e CI/CD](file:///home/tiago.godoy@db1.com.br/workspace/tiaggofg/secret-santa/docs/deploy-e-ci-cd.md) | Dockerfile multi-stage, GitHub Actions, GHCR, Portainer CE e Vercel |

---

## 🎯 Princípios Arquiteturais Fundamentais

1. **Domínio 100% Java Puro**: A camada `com.secretsanta.domain` não possui dependências de Spring, MongoDB, Jackson ou Jakarta, garantido em tempo de teste por [`CleanArchitectureTest`](file:///home/tiago.godoy@db1.com.br/workspace/tiaggofg/secret-santa/backend/src/test/java/com/secretsanta/domain/CleanArchitectureTest.java).
2. **Atomicidade de Agregado no MongoDB**: O agregado `SecretSantaGroup` e sua lista de `Participant` são persistidos em um único documento na collection `secret_santa_groups` com controle de concorrência otimista (`@Version`).
3. **Privacidade por Padrão**: Grupos são acessíveis apenas via link assinado (`?sig=...`) e a revelação do amigo sorteado é retornada sob demanda mediante validação de `username` + `pin`, nunca persistida no navegador.
4. **Mobile-First e Modo "Passar o Celular"**: O estado de sessão e revelação vive exclusivamente em memória volátil (`Signals`), permitindo que vários familiares usem o mesmo aparelho em sequência com segurança.
