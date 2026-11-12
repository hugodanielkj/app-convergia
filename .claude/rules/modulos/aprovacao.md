---
paths:
  - "**/aprovacao/**"
  - "**/approval.policy.ts"
  - "**/authorship.policy.ts"
---
# Módulo: aprovação

O diferencial do produto. Leia as seções inteiras antes de mexer aqui.

Seções a ler (Grep pelo título, Read com offset/limit):
- `rules/regra_de_negocio.md`: "### 3.3 Matriz de permissões", "## 5. Aprovação", "## 7. Erros de negócio"
- `rules/software_design.md`: "### 5.2 Campos que todo item aprovável tem", "### 5.3 Solicitação de aprovação", "### Aprovação ⭐", "### 8.2 Aprovação", "## 9. Concorrência e consistência"

Regras: RN-200 a RN-231. Em aberto: Q-15, Q-16, Q-19, Q-20, Q-22, Q-23, Q-26.

Invariantes:
- Toda escrita de conteúdo chama `onContentChanged` na mesma transação da alteração (RN-203, RN-215, RN-216).
- Só o cliente recusa. A agência aprova em nome dele só com motivo obrigatório (RN-212, RN-214).
- Cliente não edita item enviado pela agência (RN-217); os demais casos de edição pelo cliente são ❓ Q-26.
- `approve_item` e `reject_item` recebem a versão que o cliente viu; versão diferente → recusa.
- Toda transição gera `ApprovalEvent` (RN-230).
