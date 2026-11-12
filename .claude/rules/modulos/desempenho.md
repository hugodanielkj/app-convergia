---
paths:
  - "**/desempenho/**"
  - "packages/infra/src/instagram/**"
  - "packages/infra/src/transcription/**"
---
# Módulo: desempenho e insights (Instagram)

Conexão do Instagram, sincronização de métricas, análise de posts e insights.

Seções a ler (Grep pelo título, Read com offset/limit):
- `rules/regra_de_negocio.md`: "### 4.2 Instagram e contexto da IA", "### 4.3 Desempenho e insights"
- `rules/software_design.md`: "### Desempenho e insights (Instagram)", "### 8.3 Job em segundo plano"
- `rules/stack.md`: "## 5. Instagram", "## 4. IA" (transcrição)

Regras: RN-030 a RN-051. Em aberto: Q-05, Q-07, Q-08, Q-09, Q-25. Provedor de transcrição: ❓.

Invariantes:
- Ausência de snapshot é "sem dados", nunca zero (RN-040).
- Ler insights nunca os regenera; regenerar consome cota (RN-046).
- Classificação manual de post nunca é sobrescrita pela IA (RN-049).
- Análise de post já salva não consome cota (RN-050).
- Tokens do Instagram ficam criptografados no banco.
