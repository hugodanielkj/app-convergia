---
paths:
  - "**/ideias/**"
---
# Módulo: ideias (brainstorm)

Seções a ler (Grep pelo título, Read com offset/limit):
- `rules/regra_de_negocio.md`: "### 4.6 Ideias (brainstorm)", "## 5. Aprovação"
- `rules/software_design.md`: "### Ideias"

Regras: RN-080 a RN-084. Q-16 respondida em 13/11/2026 (RN-084).

Invariantes:
- Gerar de novo substitui o conjunto ativo e consome cota (RN-080).
- Aceitar sugestão cria card na coluna `ideia`, sem IA (RN-082).
- Ideia gerada pela agência precisa de aprovação do cliente (RN-083).
- Aprovar só marca a ideia como aprovada; Virar card é explícito, sem IA (RN-084).
- Cota do brainstorm: 5 gerações por empresa por dia (RN-303).
