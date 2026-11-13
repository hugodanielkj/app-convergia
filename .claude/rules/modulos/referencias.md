---
paths:
  - "**/referencias/**"
  - "packages/infra/src/scraping/**"
---
# Módulo: referências e scraping

Seções a ler (Grep pelo título, Read com offset/limit):
- `rules/regra_de_negocio.md`: "### 4.7 Referências", "### 4.2 Instagram e contexto da IA" (scraping)
- `rules/software_design.md`: "### Referências", "### 8.3 Job em segundo plano"
- `rules/stack.md`: "## 5. Instagram"

Regras: RN-090 a RN-094, RN-031, RN-035. Em aberto: Q-08 (scraping de terceiros), Q-17. Fornecedor de scraping: ❓.

Invariantes:
- Excluir referência é definitivo (RN-091).
- Análise de criador já salva é devolvida sem gerar de novo (RN-092).
- Ocultar criadores e salvar vídeos do catálogo estão fora do protótipo (RN-094). A pesquisa de vídeos por assunto é do módulo `descoberta`.
- Scraping fica atrás de uma porta; o fornecedor é trocável.
