---
paths:
  - "**/carrossel/**"
  - "packages/infra/src/render/**"
  - "packages/infra/src/image/**"
---
# Módulo: carrossel

Seções a ler (Grep pelo título, Read com offset/limit):
- `rules/regra_de_negocio.md`: "### 4.8 Carrossel"
- `rules/software_design.md`: "### Carrossel", "### 8.3 Job em segundo plano"
- `rules/stack.md`: "## 1. Resumo" (render e geração de imagem)

Regras: RN-100 a RN-105. Em aberto: Q-18. Provedor de geração de imagem: ❓.

Invariantes:
- Criação assíncrona: `gerando` → `pronto` ou `falhou`, com progresso por lâmina (RN-101).
- Render final em PNG 1080×1350 (RN-102), via Satori + Resvg.
- Agendar e publicar estão fora do protótipo (RN-103).
- Gerar ou editar lâminas pela agência é mexida de conteúdo → `onContentChanged` (RN-203).
