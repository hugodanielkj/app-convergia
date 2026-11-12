---
paths:
  - "**/cotas/**"
  - "**/quota.policy.ts"
---
# Módulo: cotas e limites

Seções a ler (Grep pelo título, Read com offset/limit):
- `rules/regra_de_negocio.md`: "## 6. Cotas e limites"
- `rules/software_design.md`: "### 5.4 Cotas", "### 8.3 Job em segundo plano"

Regras: RN-300 a RN-307. Em aberto: Q-21 (valores, horário de reset, fuso, falha consome ou não, limite por minuto, cota total da agência).

Invariantes:
- Cota é por empresa; uso da agência dentro do cliente conta na mesma linha (RN-301).
- Reserva atômica com `UPDATE ... WHERE used < limit`; nenhuma linha alterada → cota esgotada.
- Valores, fuso e devolução em caso de falha são ❓ Q-21 → `NotDecidedYet`. Os números do Dalea são só referência.
