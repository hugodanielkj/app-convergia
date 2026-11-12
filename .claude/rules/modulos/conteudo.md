---
paths:
  - "**/conteudo/**"
---
# Módulo: conteúdo (cards, kanban, calendário, fontes)

Seções a ler (Grep pelo título, Read com offset/limit):
- `rules/regra_de_negocio.md`: "### 4.4 Conteúdo (cards, kanban, calendário)"
- `rules/software_design.md`: "### Conteúdo", "### 5.2 Campos que todo item aprovável tem", "## 9. Concorrência e consistência"

Regras: RN-060 a RN-069 e RN-018. Em aberto: nenhuma neste módulo (Q-26, sobre o cliente editar roteiro mexido pela agência, é do módulo de aprovação).

Invariantes:
- A data no calendário só organiza; nunca publica nada (RN-062).
- Mover no kanban, mudar data, anexar ou remover referência ou fonte não é mexida de conteúdo e não incrementa `content_version` (RN-203).
- Fontes: no máximo 5 por card, até 3 PDFs (RN-066). Link de envio de PDF expira em 2 h (RN-067).
- Escrita no roteiro do card passa por `approval.policy.onContentChanged` (ver módulo aprovação).
- Coluna do kanban e aprovação são independentes, exceto: card com `approval_status` diferente de `none` só vai para `published` aprovado (RN-061).
- Excluir manda para a lixeira por 30 dias (RN-069). A agência exclui qualquer card; o cliente, só os que criou (RN-018).
- Card de outra empresa, inexistente ou na lixeira responde "Card não encontrado." (RN-015).
