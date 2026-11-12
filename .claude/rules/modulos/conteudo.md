---
paths:
  - "**/conteudo/**"
---
# Módulo: conteúdo (cards, kanban, calendário, fontes)

Seções a ler (Grep pelo título, Read com offset/limit):
- `rules/regra_de_negocio.md`: "### 4.4 Conteúdo (cards, kanban, calendário)"
- `rules/software_design.md`: "### Conteúdo", "### 5.2 Campos que todo item aprovável tem", "## 9. Concorrência e consistência"

Regras: RN-060 a RN-069. Em aberto: Q-14, Q-15, Q-24.

Invariantes:
- A data no calendário só organiza; nunca publica nada (RN-062).
- Mover no kanban, mudar data, anexar ou remover referência ou fonte não é mexida de conteúdo e não incrementa `content_version` (RN-203).
- Fontes: no máximo 5 por card, até 3 PDFs (RN-066). Link de envio de PDF expira em 2 h (RN-067).
- Escrita no roteiro do card passa por `approval.policy.onContentChanged` (ver módulo aprovação).
