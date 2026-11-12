# ConvergIA

Servidor MCP que ajuda os clientes da agência a planejar e produzir conteúdo orgânico para o Instagram, com aprovação do cliente sobre o que a agência cria.

Este README explica como pedir trabalho ao Claude Code neste projeto. O Claude trabalha com autonomia: decide sozinho os detalhes técnicos e só pergunta o que é seu de decidir.

## Onde estão as coisas

- **`rules/`**: as regras do produto. São os documentos que você lê e responde.
  - `regra_de_negocio.md`: o que o produto faz (regras `RN-xxx`, perguntas em aberto `Q-xx`).
  - `software_design.md`: arquitetura e catálogo de ferramentas.
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
3. Confira: `pnpm lint && pnpm typecheck && pnpm test && pnpm test:integration`.
4. `pnpm dev` sobe o servidor MCP em `http://localhost:3000/api/mcp`.

## CI

- Todo Pull Request roda: título do PR, lint, tipos, testes, integração com Postgres e auditoria de dependências.
- O Claude só faz o merge com o CI verde.
- No GitHub, proteja a `main` exigindo o check **CI** (Settings → Branches).
