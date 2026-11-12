---
name: nova-ferramenta-mcp
description: Passo a passo para criar ou alterar uma ferramenta MCP do ConvergIA — caso de uso no core, portas, adaptadores, arquivo da ferramenta, registro e testes de política, isolamento e contrato. Use ao implementar qualquer ferramenta do catálogo de software_design.md §6 ou ao mudar entrada, saída ou comportamento de uma existente.
---

# Nova ferramenta MCP

Uma ferramenta = um arquivo = um caso de uso. A regra de negócio fica no `core`; o arquivo da ferramenta só traduz.

## 1. Antes de escrever

1. Ache a ferramenta no catálogo (`rules/software_design.md` §6): módulo, se é escrita (E), se consome cota (C), se cria job (J).
2. Liste as regras `RN-xxx` que ela aplica (`rules/regra_de_negocio.md`).
3. Regra ❓ no caminho: isole em uma política que lança `NotDecidedYet("Q-xx")` e continue. Não deduza.
4. A ferramenta não está no catálogo: é funcionalidade nova. Confirme com o usuário antes de criar.

## 2. Ordem de implementação

Escreva de dentro para fora.

**a) Domínio e caso de uso** — `packages/core/src/<modulo>/use-cases/<nome>.ts`

- Assinatura: `execute(actor: ActorContext, input)`.
- Sequência: permissão (`permission.policy`) → reserva de cota, se C (`quota.policy`) → carrega dados filtrando por `actor.companyId` → regra de domínio → grava → se mudou conteúdo, `approval.policy.onContentChanged` na mesma transação → devolve o resultado.
- Falha de negócio é um `DomainError` tipado, não uma exceção genérica.
- Nada de import de `infra`, Drizzle, SDK MCP ou SDK de fornecedor.

**b) Portas** — `packages/core/src/<modulo>/ports/`

Interface para cada coisa externa de que o caso de uso precisa (repositório, fila, IA, scraping, armazenamento). Reaproveite as que já existem.

**c) Adaptadores** — `packages/infra/src/...`

- Repositório: toda consulta recebe e filtra por `companyId`. Tabela nova tem `company_id`, migração e política de RLS.
- IA: só pelo `llm-gateway`, com saída estruturada validada por schema e registro em `ai_call_log`.
- Job (J): a ferramenta cria o registro como `queued`, enfileira e devolve o ID com a instrução "consulte com `get_...`". O job tem chave de idempotência.

**d) Ferramenta** — `apps/mcp-server/src/tools/<modulo>/<nome_da_ferramenta>.ts`

- Nome em inglês `snake_case`; descrição em português, dizendo o que faz, quando usar e se consome cota.
- Schema de entrada em Zod, com `describe` em português nos campos.
- Corpo: validar, chamar o caso de uso, formatar a saída (texto + dados estruturados). Cerca de 30 linhas.
- Erros passam por `errors/to-mcp-result.ts` e saem com `isError: true` e a mensagem da tabela de `regra_de_negocio.md` §7.
- Ferramenta de escrita exige o escopo `write`.

**e) Registro** — adicione em `apps/mcp-server/src/registry.ts`.

## 3. Testes obrigatórios

| Teste | Onde | Cobre |
|---|---|---|
| Unitário de política | `packages/core`, ao lado do código | Um teste por RN ✅ aplicada, com o ID no nome. Regras ❓ esperam `NotDecidedYet`. |
| Isolamento | integração | Usuário da empresa A não lê nem altera dado da empresa B por esta ferramenta. Agência sem empresa informada recebe o erro correto. |
| Integração | Postgres local | Caminho feliz, cota esgotada e, se houver, concorrência por `version`. |
| Contrato MCP | `apps/mcp-server` | Schema e descrição válidos; erro de negócio sai como `isError`. |

IA, scraping, imagem e transcrição entram nos testes como dublês das portas. Chamada real a API paga exige permissão do usuário.

## 4. Fechamento

Rode a skill `verificar`. Se a implementação divergiu do catálogo (parâmetro, nome, comportamento), atualize `rules/software_design.md` no mesmo PR.
