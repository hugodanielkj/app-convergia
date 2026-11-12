---
paths:
  - "**/acesso/**"
  - "apps/mcp-server/src/auth/**"
  - "**/permission.policy.ts"
  - "**/actor-context.ts"
---
# Módulo: acesso e multiempresa

Agência, empresas clientes, usuários, papéis, autenticação e isolamento por empresa.

Seções a ler (Grep pelo título, Read com offset/limit):
- `rules/regra_de_negocio.md`: "### 3.2 Regras de papéis", "### 3.3 Matriz de permissões", "### 4.1 Acesso, autenticação e isolamento"
- `rules/software_design.md`: "## 4. Contexto do ator e multiempresa", "### Acesso e administração"
- `rules/stack.md`: "## 3. Autenticação"

Regras: RN-010 a RN-026. Em aberto: Q-01, Q-02, Q-03, Q-06, Q-31.

Invariantes:
- Usuário do cliente opera sempre na própria empresa; pedir outra empresa → "Você não tem acesso a esta empresa." (RN-015).
- Membro da agência sem empresa informada → "Informe em qual empresa cliente você quer trabalhar." (RN-021).
- Autenticação por OAuth 2.1 e por chave de API, as duas aceitas (RN-023). Fornecedor do OAuth é ❓ Q-31.
- Todo membro da agência vê todos os clientes (RN-010). Diferença entre admin e membro comum é ❓ Q-02.
