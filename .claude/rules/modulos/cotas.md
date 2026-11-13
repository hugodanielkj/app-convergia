---
paths:
  - "**/cotas/**"
  - "**/quota.policy.ts"
---
# Módulo: cotas e limites

Seções a ler (Grep pelo título, Read com offset/limit):
- `rules/regra_de_negocio.md`: "## 6. Cotas e limites"
- `rules/software_design.md`: "### 5.4 Cotas", "### 8.3 Job em segundo plano"

Regras: RN-300 a RN-307. Em aberto: Q-21 (valores das ferramentas que não sejam gerar e refinar roteiro, limite por minuto, cota total da agência, cliente ver o próprio consumo).

Invariantes:
- Cota é por empresa; uso da agência dentro do cliente conta na mesma linha (RN-301).
- Reserva atômica com `UPDATE ... WHERE used < limit`; nenhuma linha alterada → cota esgotada.
- Padrão por dia: gerar roteiro 10, refinar 30, brainstorm 5 (RN-303). Zera à meia-noite de `America/Sao_Paulo` (RN-304). Falha devolve a reserva (RN-305).
- Ferramenta sem valor padrão decidido → ❓ Q-21 → `NotDecidedYet`. Os números do Dalea são só referência.
