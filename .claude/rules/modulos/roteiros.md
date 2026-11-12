---
paths:
  - "**/roteiros/**"
  - "packages/infra/src/ai/**"
---
# Módulo: roteiros e IA de texto

Geração de roteiro e opções avulsas, refino por chat, histórico, gateway de IA.

Seções a ler (Grep pelo título, Read com offset/limit):
- `rules/regra_de_negocio.md`: "### 4.5 Roteiros"
- `rules/software_design.md`: "### Roteiros", "### 8.1 Chamada típica de ferramenta com IA", "## 10. Auditoria e observabilidade"
- `rules/stack.md`: "## 4. IA"

Regras: RN-070 a RN-076, RN-203.

Invariantes:
- Refino gera prévia e não altera o roteiro; aplicar ou descartar não chama IA (RN-073).
- Aplicar prévia com versão desatualizada é recusado (RN-074).
- Gerar roteiro ou aplicar prévia pela agência é mexida de conteúdo → `onContentChanged` (RN-203).
- Toda chamada de IA: reserva de cota antes, `llm-gateway`, saída estruturada, registro em `ai_call_log`.
