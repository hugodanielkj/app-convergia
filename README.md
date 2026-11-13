# ConvergIA

App web mobile first (instalável no celular) e servidor MCP que ajudam os clientes da agência a planejar e produzir conteúdo orgânico para o Instagram, com aprovação do cliente sobre o que a agência cria.

Este README explica como pedir trabalho ao Claude Code neste projeto. O Claude trabalha com autonomia: decide sozinho os detalhes técnicos e só pergunta o que é seu de decidir.

## Onde estão as coisas

- **`rules/`**: as regras do produto. São os documentos que você lê e responde.
  - `regra_de_negocio.md`: o que o produto faz (regras `RN-xxx`, perguntas em aberto `Q-xx`).
  - `software_design.md`: arquitetura, catálogo de ferramentas e telas do app.
  - `stack.md`: tecnologias.
- **`.claude/`**: instruções internas do Claude. Você não precisa ler.
- O código (`apps/`, `packages/`) será criado pelo Claude a partir de `rules/`.

## Como pedir uma tarefa

- **Diga o resultado que quer, não o passo a passo.** O Claude encontra as regras e os arquivos sozinho.
  - "Implemente a ferramenta `approve_item`."
  - "Crie o esqueleto do monorepo."
  - "Corrija o erro do teste de cotas."
- **Cite o ID quando souber.** "Implemente a RN-214" ou "a ferramenta `list_pending_approvals`" é mais rápido do que descrever a regra.
- **Uma tarefa por pedido.** Cada tarefa vira uma branch e um Pull Request.
- **Siga a ordem do design.** "Faça o próximo passo da ordem de implementação" usa a lista de `software_design.md` §12.
- **Diga o que não quer**, se houver: "sem mexer no módulo de cotas".

## Como responder perguntas em aberto

- As decisões pendentes são as `Q-xx` em `regra_de_negocio.md` §8.
- Responda citando o ID: "Q-24: exclusão vai para a lixeira, apagada em 30 dias."
- Pode responder várias de uma vez ou só parte de uma pergunta.
- O Claude atualiza os documentos, o código e os testes, e mostra o que mudou.
- Enquanto uma `Q-xx` não for respondida, o Claude não adivinha: deixa o ponto bloqueado no código e segue com o resto.
- Para mudar uma regra já confirmada (✅), diga explicitamente: "Mude a RN-212: o motivo da recusa passa a ser obrigatório."

## O que o Claude faz sozinho

- Escolhe bibliotecas, nomes, organização do código e testes.
- Adiciona dependências e cria migrações no banco local.
- Cria branch, faz commit, push, abre o Pull Request e faz o merge quando o CI passa.
- Corrige problemas que encontrar no caminho.
- No PR, explica as decisões que tomou. Leia a seção "Decisões tomadas" para acompanhar.

## O que o Claude sempre pergunta antes

- Force push, reescrever histórico, commit direto na `main`, apagar branch remota.
- Mexer em `.env`, chaves e qualquer segredo.
- Deploy e qualquer comando fora do ambiente local.
- Apagar dados do banco, mesmo local.
- Chamar APIs pagas de verdade (Claude, scraping, imagem, transcrição).
- Mudar configurações do repositório no GitHub ou do CI.

Quando ele pedir permissão, responda "sim", "não" ou dê outra instrução. A permissão vale só para aquela ação.

## Comandos úteis para falar com o Claude

- **Git:** "suba as alterações" (commit, push e PR), "sincronize com a main", "faça o merge do PR".
- **Verificação:** "verifique antes de subir" ou `/verificar`.
- **Status:** "o que falta para terminar?", "quais Q-xx bloqueiam o módulo de aprovação?".
- **Skills disponíveis:** `/fluxo-git`, `/verificar`, `/dependencias`, `/nova-ferramenta-mcp`, `/regra-de-negocio`.

## Dicas para gastar menos

- Comece uma conversa nova (`/clear`) ao trocar de tarefa ou módulo.
- Peça uma coisa de cada vez; pedidos grandes fazem o Claude ler mais documentos.
- Aponte o arquivo ou o ID quando já souber onde está o problema.

## Primeira configuração (cada colaborador)

1. Instale Git, Docker, Node.js 26, pnpm e o GitHub CLI; rode `gh auth login`.
2. Clone o repositório e, na pasta dele:
   - `pnpm install --frozen-lockfile`
   - `cp .env.example .env`
   - `docker compose up -d --wait` (Postgres local na porta 54320)
   - `pnpm db:migrate` (cria as tabelas)
3. Confira: `pnpm lint && pnpm typecheck && pnpm test && pnpm test:integration`.
4. `pnpm dev` sobe o servidor (MCP em `http://localhost:3000/api/mcp`). Em outro terminal, `pnpm dev:web` sobe o app web em `http://localhost:5173`.
5. `pnpm db:seed` cria uma empresa e dois usuários de exemplo e mostra uma chave de API para cada um. Use a chave na tela de entrada do app web (só em desenvolvimento) ou no cabeçalho `Authorization: Bearer <chave>` do seu cliente MCP. A chave aparece só nessa hora; rodar de novo gera outra.

## Descoberta de vídeos: configurar o provedor

A tela "Descobrir vídeos" (menu **Mais**) e as ferramentas MCP `discover_videos` e `get_discovered_videos` pesquisam vídeos do Instagram Reels e do TikTok pelo [ScrapeCreators](https://scrapecreators.com). Sem a chave, tudo funciona, mas a tela avisa que a integração não está configurada e não mostra vídeo nenhum.

1. Crie uma conta em `app.scrapecreators.com` e copie a chave de API. A conta grátis vem com 100 créditos; depois, os pacotes são pagos (cada chamada custa 1 crédito).
2. No `.env` (nunca no código nem no commit), preencha `SCRAPECREATORS_API_KEY=<sua chave>`.
3. Reinicie `pnpm dev`. O terminal mostra `Descoberta de vídeos: scrapecreators`.

Custo e limites, todos no `.env.example`:

- Uma pesquisa nova gasta no máximo `VIDEO_SEARCH_MAX_CALLS` créditos (padrão 8): buscas nas duas plataformas mais as visualizações de até `VIDEO_SEARCH_METRIC_REFRESH` Reels (padrão 5), que a busca do Instagram não traz.
- Pesquisa repetida dentro de `VIDEO_SEARCH_CACHE_TTL_HOURS` (padrão 6) sai do cache, sem gastar crédito.
- Cada usuário faz até `VIDEO_SEARCH_DAILY_LIMIT_PER_USER` pesquisas novas por dia (padrão 20) e `VIDEO_SEARCH_PER_MINUTE_LIMIT` por minuto (padrão 5).
- `VIDEO_SEARCH_AI_EXPANSION=false` desliga as variações da pesquisa sugeridas pela IA.

Limitações do provedor: a busca do Instagram usa resultados indexados pelo Google, então é parcial e pode trazer menos Reels recentes; as métricas são as públicas no momento da coleta. Cada chamada fica registrada na tabela `video_provider_calls` (latência, erro e créditos) e cada pesquisa em `video_search_requests` (acerto de cache). Para trocar de provedor, implemente a porta `VideoProvider` em `packages/infra/src/scraping/` e troque `createVideoProvider`.

## Instagram da empresa: configurar o app da Meta

O cliente conecta o Instagram da empresa em **Mais › Desempenho e Instagram** (ou pela ferramenta MCP `connect_instagram`), e a IA passa a usar o perfil, as legendas dos posts recentes e as curtidas e comentários de cada um ao gerar roteiros (RN-039). Sem o app da Meta, fora de produção, o app usa um **Instagram simulado**, com dados de exemplo marcados como simulados.

Para conectar de verdade:

1. Em [developers.facebook.com](https://developers.facebook.com), crie um app do tipo **Business** e adicione o produto **Instagram › API com login do Instagram**.
2. Em **Business login settings**, cadastre o endereço de retorno: o endereço do app web seguido de `/api/instagram/callback` (ex.: `https://app.suaempresa.com.br/api/instagram/callback`). Ele precisa abrir o app web, que repassa `/api` para o servidor.
3. Em **App Roles › Roles** (ou em **API setup with Instagram login**), adicione como testadora a conta do Instagram da empresa e aceite o convite no Instagram. Ela precisa ser **Profissional** (comercial ou de criador). Sem a revisão da Meta, só contas testadoras conectam.
4. No `.env`, preencha `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET`, `INSTAGRAM_REDIRECT_URI` (o mesmo endereço do passo 2) e `INSTAGRAM_TOKEN_KEY` (o comando para gerar está no `.env.example`). O servidor mostra no início qual Instagram está usando.

O app pede só a permissão `instagram_business_basic`. Os tokens ficam criptografados no banco e um job diário renova cada um antes dos 60 dias e atualiza os dados que a IA lê. Para clientes que não são testadores do app, a Meta exige a revisão do app e a verificação da empresa.

## CI

- Todo Pull Request roda: título do PR, lint, tipos, testes, integração com Postgres e auditoria de dependências.
- O Claude só faz o merge com o CI verde.
- No GitHub, proteja a `main` exigindo o check **CI** (Settings → Branches).
