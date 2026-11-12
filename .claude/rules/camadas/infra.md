---
paths:
  - "packages/infra/**"
  - "apps/worker/**"
---
# Camada: infraestrutura e worker

Referência: `rules/software_design.md` "### 8.3 Job em segundo plano", "## 9. Concorrência e consistência", "## 10. Auditoria e observabilidade"; `rules/stack.md` "## 4. IA", "## 6. Dados e jobs".

- Repositório recebe e filtra por `companyId` em toda consulta. Tabela de negócio nova tem `company_id`, migração e política de RLS.
- Migração gerada pelo Drizzle e commitada. Aplicar só no banco local; outros ambientes exigem permissão.
- IA só pelo `llm-gateway`, com saída estruturada validada e registro em `ai_call_log`.
- Job tem chave de idempotência e termina em `ready` ou `failed` com mensagem.
- Cada fornecedor externo tem um adaptador que implementa uma porta do core.
- Tokens do Instagram ficam criptografados. Segredos vêm de `packages/config`, nunca de `process.env` direto.
- Escritas registram `audit_log`. Logs estruturados com `requestId`, `userId`, `companyId`, sem segredos.
