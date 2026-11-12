---
paths:
  - "packages/core/**"
---
# Camada: core (domínio)

Referência: `rules/software_design.md` "## 1. Princípios", "## 2. Arquitetura".

- Não importa `packages/infra`, Drizzle, o SDK MCP, Hono nem SDK de fornecedor. Só tipos, Zod e código próprio.
- Caso de uso: `execute(actor: ActorContext, input)`. Ordem: permissão → reserva de cota (se consome) → carrega filtrando por `actor.companyId` → regra → grava → `onContentChanged` (se mudou conteúdo) → resultado.
- Falha de negócio é `DomainError` tipado. Regra ❓ lança `NotDecidedYet("Q-xx")`.
- Regras em aberto e decisões de permissão, aprovação, autoria e cota ficam em `src/policies/`, com um ponto único de decisão.
- Dependência externa entra por interface em `ports/` do módulo.
- Cite o `RN-xxx` no código que implementa a regra.
