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

Regras: RN-030 a RN-051 (RN-039: o que a IA lê do Instagram). Em aberto: Q-08 (scraping de terceiros), Q-09 (demais regras do Dalea), Q-25. Provedor de transcrição: ❓.

Invariantes:
- Ausência de snapshot é "sem dados", nunca zero (RN-040).
- Ler insights nunca os regenera; regenerar consome cota (RN-046).
- Classificação manual de post nunca é sobrescrita pela IA (RN-049).
- Análise de post já salva não consome cota (RN-050).
- Tokens do Instagram ficam criptografados no banco (`INSTAGRAM_TOKEN_KEY`, AES-256-GCM) e só saem do repositório para chamar a Meta; nunca aparecem em resposta, log ou URL registrada.
- O retorno do OAuth não tem usuário logado: o `state` (só o hash fica no banco, uso único, 15 minutos) diz de quem é o pedido, e `instagram_connect_requests` fica fora do RLS por isso.
- ✅ RN-039: a IA lê só o perfil, as legendas e as curtidas e comentários dos posts recentes (`instagramText` em `packages/infra/src/ai/script-ai.ts`).
- Fora de produção, sem o app da Meta, o Instagram é simulado e a conexão fica marcada como `simulated`.
- Só o usuário do cliente conecta o Instagram, sempre pela autenticação da Meta; o perfil da empresa nunca vem de scraping (RN-034, RN-035).
- Insights exigem pelo menos 5 vídeos (RN-045).
