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
- `rules/software_design.md`: "## 4. Contexto do ator e multiempresa", "### Acesso e administração", "### 13.1 Navegação"
- `rules/stack.md`: "## 3. Autenticação"

Regras: RN-010 a RN-026. Em aberto: Q-01, Q-02, Q-31, Q-32.

Invariantes:
- Usuário do cliente opera sempre na própria empresa; pedir outra empresa → "Você não tem acesso a esta empresa." (RN-015).
- Membro da agência informa a empresa no parâmetro `company_id` de cada chamada; não existe empresa ativa (RN-022). Sem o parâmetro → "Informe em qual empresa cliente você quer trabalhar." (RN-021). Empresa de outra agência ou inexistente → "Você não tem acesso a esta empresa."
- No MCP, autenticação por OAuth 2.1 e por chave de API, as duas aceitas (RN-023). No app web, sessão por cookie; forma de login é ❓ Q-32. Fornecedor da autenticação é ❓ Q-31.
- No app web, a empresa do membro da agência fica na URL (`/empresas/:companyId/...`), nunca guardada no servidor (RN-022).
- A agência cadastra empresas e usuários pelo app web (RN-026).
- Todo membro da agência vê todos os clientes (RN-010). Diferença entre admin e membro comum é ❓ Q-02.
