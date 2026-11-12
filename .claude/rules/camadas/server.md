---
paths:
  - "apps/server/**"
---
# Camada: servidor (MCP e API do app)

Referência: `rules/software_design.md` "## 6. Catálogo de ferramentas MCP do protótipo", "## 7. Prompts MCP"; `rules/stack.md` "### 2.2 Servidor MCP", "### 2.1 App web (mobile first) ✅". Para criar ou alterar ferramenta, use a skill `nova-ferramenta-mcp`.

O servidor tem duas portas de entrada para os mesmos casos de uso do `core` (RN-003): `/api/mcp` (ferramentas MCP, em `src/tools/`) e `/api/app` (API JSON do app web, em `src/app-api/`).

MCP:
- Uma ferramenta = um arquivo = um caso de uso, com cerca de 30 linhas: valida (Zod), chama o caso de uso, formata a saída.
- Nome em inglês `snake_case`; descrição e `describe` dos campos em português.
- Erro de negócio sai por `errors/to-mcp-result.ts` com `isError: true` e a mensagem de `regra_de_negocio.md` §7. Só falta de credencial vira HTTP 401.
- Ferramenta de escrita exige o escopo `write`.
- Toda ferramenta é registrada em `src/registry.ts`.

API do app:
- Uma rota = um caso de uso. Valida a entrada com Zod e devolve JSON.
- Erro de negócio sai por `app-api/errors.ts`: `{ error: <código>, message: <mensagem do §7> }` com o status HTTP do código. O app mostra a mensagem como veio.
- Rota dentro de uma empresa fica em `/companies/:companyId/...` e monta o contexto com `resolveActorContext` (RN-022).
- O tipo `AppApi` é exportado para o cliente tipado do app (Hono RPC). Mudou uma rota, o app quebra na checagem de tipos: corrija os dois no mesmo PR.

Os dois:
- Servidor sem estado entre requisições: nada de negócio em memória ou na sessão.
