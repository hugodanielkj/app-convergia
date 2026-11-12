---
paths:
  - "apps/mcp-server/**"
---
# Camada: servidor MCP

Referência: `rules/software_design.md` "## 6. Catálogo de ferramentas MCP do protótipo", "## 7. Prompts MCP"; `rules/stack.md` "## 2. Servidor MCP". Para criar ou alterar ferramenta, use a skill `nova-ferramenta-mcp`.

- Uma ferramenta = um arquivo = um caso de uso, com cerca de 30 linhas: valida (Zod), chama o caso de uso, formata a saída.
- Nome em inglês `snake_case`; descrição e `describe` dos campos em português.
- Erro de negócio sai por `errors/to-mcp-result.ts` com `isError: true` e a mensagem de `regra_de_negocio.md` §7. Só falta de credencial vira HTTP 401.
- Ferramenta de escrita exige o escopo `write`.
- Servidor sem estado entre requisições: nada de negócio em memória ou na sessão MCP.
- Toda ferramenta é registrada em `src/registry.ts`.
