---
paths:
  - "**/ideias/**"
---
# Módulo: ideias (brainstorm)

Seções a ler (Grep pelo título, Read com offset/limit):
- `rules/regra_de_negocio.md`: "### 4.6 Ideias (brainstorm)", "## 5. Aprovação"
- `rules/software_design.md`: "### Ideias"

Regras: RN-080 a RN-084. Em aberto: Q-16.

Invariantes:
- Gerar de novo substitui o conjunto ativo e consome cota (RN-080).
- Aceitar sugestão cria card na coluna `ideia`, sem IA (RN-082).
- Ideia gerada pela agência precisa de aprovação do cliente (RN-083).
- O que acontece quando a ideia é aprovada é ❓ Q-16 → `NotDecidedYet`.
