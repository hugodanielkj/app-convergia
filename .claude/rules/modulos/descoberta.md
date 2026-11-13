---
paths:
  - "**/descoberta/**"
  - "packages/infra/src/scraping/**"
  - "packages/infra/src/jobs/**"
---
# Módulo: descoberta de vídeos

Pesquisa em linguagem natural de vídeos populares do Instagram Reels e do TikTok.

Seções a ler (Grep pelo título, Read com offset/limit):
- `rules/regra_de_negocio.md`: "### 4.9 Descoberta de vídeos"
- `rules/software_design.md`: "### Descoberta de vídeos", "### 8.3 Job em segundo plano"
- `rules/stack.md`: "## 5. Instagram" (linha de scraping), "## 6. Dados e jobs"

Regras: RN-110 a RN-119.

Invariantes:
- Nunca mostrar vídeo, link ou métrica que o provedor não devolveu. A IA só sugere termos de busca (RN-111).
- Métrica ausente fica `null`, nunca zero; o upsert não apaga o que já se sabia (RN-112).
- Popularidade por plataforma; "Em crescimento" só com duas leituras espaçadas (RN-116, RN-117).
- Catálogo e cache são compartilhados (dados públicos); `video_search_requests` é por empresa, com RLS.
- Reserva de cota por usuário antes de coletar; coleta que falha devolve a cota (RN-118, RN-305). As reservas pendentes ficam em `video_queries.pending_reservations`, porque o job roda sem empresa no contexto do RLS.
- Mudou a forma de coletar ou filtrar: suba `STRATEGY_VERSION` para invalidar o cache.
