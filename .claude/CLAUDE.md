# ConvergIA — guia do repositório para o Claude Code

App web **mobile first** (PWA) e servidor MCP remoto que ajudam os clientes de uma agência de marketing a planejar e produzir conteúdo orgânico para o Instagram. Os dois canais usam as mesmas regras e os mesmos dados (RN-003); o app é o canal principal. O conteúdo que a agência cria para um cliente passa pela aprovação desse cliente.

Este arquivo diz como o repositório está organizado, o que você pode decidir sozinho, o que exige permissão e como o trabalho chega à `main`. O projeto é compartilhado com outros colaboradores: tudo o que você fizer precisa funcionar em qualquer máquina, não só nesta.

## 1. Fontes da verdade

| Arquivo | Responde |
|---|---|
| `rules/regra_de_negocio.md` | O que o produto faz. Regras com ID `RN-xxx` e perguntas em aberto `Q-xx`. É o documento principal. |
| `rules/software_design.md` | Arquitetura, pastas, modelo de domínio, catálogo de ferramentas MCP, testes e ordem de implementação. |
| `rules/stack.md` | Tecnologias de cada camada e riscos técnicos. |

Onde `software_design.md` menciona a pasta `docs/`, entenda `rules/`.

### Como tratar as marcações

| Marca | Significado | O que fazer |
|---|---|---|
| ✅ | Confirmado pelo dono do produto | Implemente. |
| 💡 | Recomendação de stack ou design | Implemente como padrão. Não precisa perguntar. |
| 📎 | Regra copiada do Dalea | Implemente como padrão. Não precisa perguntar. |
| ❓ | Em aberto (`Q-xx`) | **Não deduza.** Isole em `packages/core/src/policies/` lançando `NotDecidedYet("Q-xx")`, com um teste que espera esse erro, e siga com o restante. Pergunte só quando a tarefa não puder avançar sem a resposta. |

Essa tabela substitui a frase "regras 📎 e ❓ não devem ser implementadas sem confirmação" de `regra_de_negocio.md`.

## 2. Como carregar contexto

Os documentos de `rules/` são longos. **Não os leia inteiros.** Leia só as seções da tarefa:

1. Identifique o módulo da tarefa e leia o mapa dele em `.claude/rules/modulos/<modulo>.md`: `acesso`, `desempenho`, `conteudo`, `roteiros`, `ideias`, `referencias`, `carrossel`, `aprovacao`, `cotas`, `busca`.
2. O mapa lista os títulos das seções relevantes. Ache a linha com Grep (`-n`) e leia com Read usando `offset` e `limit`, até o próximo título do mesmo nível.
3. Para uma pergunta pontual, procure o ID direto: Grep por `RN-214` ou `Q-21` em `rules/`.
4. Leia um documento inteiro só quando a tarefa for sobre o próprio documento.

Os arquivos de `.claude/rules/` também carregam sozinhos quando você lê ou escreve um arquivo que casa com o `paths` deles:

- `modulos/`: mapa e invariantes de cada módulo.
- `camadas/`: convenções de `core`, `server`, `web`, `infra` e worker, testes, dependências e documentos.

Tarefa que atravessa módulos (ex.: gerar roteiro dispara aprovação e cota): leia o mapa de cada módulo envolvido.

Tarefa com tela: leia também `rules/software_design.md` "## 13. App web: telas e padrões mobile first" e `rules/stack.md` "### 2.1 App web (mobile first) ✅". Uma funcionalidade só está pronta quando funciona no celular.

## 3. Estado atual e estrutura

O esqueleto do monorepo existe: `packages/core`, `packages/config`, `packages/infra` (Drizzle, migrações e as tabelas de acesso: agências, empresas, usuários e chaves de API) e `apps/server`, com as ferramentas MCP `whoami` e `list_companies` e a API do app (`/api/app`). A autenticação por chave de API funciona (RN-023); o OAuth espera o fornecedor (`Q-31`). O membro da agência informa a empresa no parâmetro `company_id` de cada chamada (RN-022) e lista as empresas com `list_companies`. O `apps/web` tem o esqueleto do app: PWA, navegação, entrada de desenvolvimento por chave de API, escolha de empresa e telas vazias. Ainda não existe o `apps/worker`. A estrutura alvo está em `software_design.md` "## 3. Estrutura de pastas" e a ordem de construção em "## 12. Ordem sugerida de implementação".

```text
apps/web/          app web mobile first (PWA): React + Vite + Tailwind + TanStack Router
apps/server/       servidor HTTP: MCP (/api/mcp) e API do app (/api/app)
apps/worker/       jobs em segundo plano
packages/core/     domínio, casos de uso, políticas, portas (sem infraestrutura)
packages/infra/    Postgres, fila, Instagram, IA, imagem, armazenamento
packages/config/   tsconfig, lint, variáveis de ambiente validadas
rules/             documentos de regra, stack e design (lidos também pelo usuário)
.github/           CI (workflows/ci.yml), ação de setup e Dependabot
.claude/           este guia, regras por caminho e skills (só para o Claude)
README.md          como o usuário conversa com o Claude neste projeto
```

Comandos (scripts no `package.json` da raiz):

| Comando | Faz |
|---|---|
| `pnpm install --frozen-lockfile` | Instala exatamente o que está no lockfile |
| `pnpm lint` / `pnpm format` | Confere / corrige lint e formatação (Biome; Markdown fica de fora) |
| `pnpm typecheck` | Tipos em todos os pacotes |
| `pnpm test` | Testes unitários e de contrato (`*.test.ts`), sem banco |
| `pnpm test:integration` | Testes de integração (`*.int.test.ts`); exige `docker compose up -d --wait` e `DATABASE_URL` |
| `pnpm dev` | Servidor (MCP e API do app) local com recarga, na porta 3000 |
| `pnpm dev:web` | App web local em `http://localhost:5173`, com `/api` apontando para a porta 3000 |
| `pnpm build` | Build de produção do app web (também roda no CI) |
| `pnpm db:generate` | Gera a migração a partir do schema em `packages/infra/src/db/schema/` |
| `pnpm db:migrate` | Aplica as migrações no banco local (os testes de integração também aplicam) |
| `pnpm db:seed` | Cria dados de exemplo e imprime uma chave de API nova para cada usuário de exemplo; só roda no banco local |

O Postgres local fica na porta **54320**. Sem `.env`, passe a variável na linha de comando: `DATABASE_URL=postgres://convergia:convergia@localhost:54320/convergia pnpm test:integration` (é a credencial de desenvolvimento de `.env.example`, não um segredo).

O CI (`.github/workflows/ci.yml`) roda em todo PR e na `main`: título do PR, lint, tipos, testes, integração com Postgres e auditoria de dependências. O job `CI` resume todos e é o check obrigatório. Ao criar um script de verificação novo, adicione-o ao CI no mesmo PR.

A `main` é protegida no GitHub pelo ruleset `proteger-main`, sem exceções (nem para administradores): só entra por PR, só merge squash, histórico linear, sem force push nem exclusão, e os checks `CI` e `Auditoria de dependências` precisam passar. Se um push ou merge for recusado por essa regra, corrija a causa; nunca peça para desativá-la.

Nunca relate uma verificação como aprovada sem tê-la executado.

## 4. Autonomia

O padrão é **decidir e seguir**. Faça a escolha mais simples que respeite `rules/`, registre o porquê no PR e continue. Não pare para confirmar nome de arquivo, organização interna, escolha de biblioteca, texto de mensagem ou abordagem de teste.

### Pode fazer sem perguntar

- Criar, editar, mover e apagar arquivos **dentro do escopo da tarefa**.
- Adicionar, atualizar e remover dependências (skill `dependencias`).
- Criar e alterar schema e migrações, e aplicá-las no **banco local**.
- Atualizar `rules/` para registrar uma decisão que o usuário tomou. Nunca crie uma regra por conta própria.
- Criar branch, commit, pull, push da branch, abrir PR e fazer o merge com CI verde (§6).
- Instalar pacotes do projeto com `pnpm` e subir serviços locais com Docker Compose.
- Refatorar o código que a tarefa toca, corrigir bugs encontrados no caminho e escrever testes.

### Exige permissão do usuário, sempre

Pare, explique o que pretende fazer e por quê, e espere a resposta. Uma permissão vale para aquela ação, não para as próximas.

| Ação | Por quê |
|---|---|
| `git push --force` (qualquer forma) e reescrita de histórico já enviado (`rebase`, `commit --amend`, `reset` em commits publicados) | Destrói trabalho de colaboradores |
| Commit ou push direto na `main` | Todo trabalho entra por PR |
| Apagar branch remota ou tag | Irreversível para os outros |
| `git reset --hard`, `git clean`, `git checkout -- .` e `git stash drop` com alterações que não são suas | Perda de trabalho não commitado |
| Ler, criar, alterar ou commitar segredos: `.env`, chaves, tokens, credenciais | Vazamento |
| Deploy e qualquer comando contra banco, fila ou armazenamento **que não seja local** | Produção e dados reais de clientes |
| Comando destrutivo no banco (`DROP`, `TRUNCATE`, `DELETE` sem `WHERE`, apagar volume do Docker), mesmo local | Perda de dados |
| Apagar arquivos ou pastas **fora** do escopo da tarefa | Pode ser trabalho de outra pessoa |
| Chamada real a API paga (Claude API, scraping, geração de imagem, transcrição) | Custa dinheiro. Testes usam dublês das portas. |
| Alterar configuração do repositório no GitHub (proteção de branch, secrets, colaboradores, visibilidade) ou os workflows de CI para fazê-los passar | Afeta todos |
| Desativar uma verificação: `--no-verify`, pular teste, `@ts-ignore` ou regra de lint desligada para passar | Esconde o problema |
| Instalar software global na máquina (`brew`, `npm -g`) | Fora do projeto |

Essa lista vale mesmo quando a ferramenta não bloqueia o comando tecnicamente.

### Nunca

- Implementar uma regra ❓ por dedução.
- Devolver, em qualquer ferramenta, dados de uma empresa para um usuário de outra (RN-015).
- Escrever um segredo em código, teste, log, commit ou PR.
- Dizer que algo funciona sem ter verificado.

## 5. Engenharia

As convenções de cada camada estão em `.claude/rules/camadas/`. Valem para todo o código:

- **Dependência só em uma direção:** `apps → core ← infra`.
- **Regra de negócio mora no `core`**; a ferramenta MCP e a rota da API do app só traduzem.
- **Mobile first:** toda tela nasce para a largura do celular (360 a 430 px) e depois ganha `md:` e `lg:`.
- **Todo caso de uso recebe o `ActorContext`** e toda consulta filtra por `company_id`.
- **Toda escrita de conteúdo passa por `approval.policy.onContentChanged`** na mesma transação.
- **Código em inglês; mensagens ao usuário e descrições de ferramenta em português.**
- Mudanças pequenas e focadas: um PR resolve uma coisa. Refatoração sem relação com a tarefa vai em outro PR.
- Teste junto com o código. Corrigiu um bug: primeiro um teste que falha, depois a correção.
- Não crie abstração, configuração ou tratamento de erro para um caso que ainda não existe.
- Valide dados só nas bordas (entrada da ferramenta, resposta externa, variáveis de ambiente).
- Sem `any`, sem `@ts-ignore`. Comentário só para explicar um porquê que o código não mostra.

## 6. Fluxo de trabalho

Detalhes e comandos na skill `fluxo-git`. Resumo:

1. **Sincronizar:** `git switch main && git pull --ff-only`.
2. **Branch por tarefa:** `<tipo>/<descricao-curta>`, ex.: `feat/aprovacao-cancelar-envio`.
3. **Implementar** em commits pequenos, cada um deixando o projeto funcionando.
4. **Verificar** com a skill `verificar` antes de cada push.
5. **Push** da branch: `git push -u origin <branch>`.
6. **Pull Request** para a `main` com `gh pr create`.
7. **Merge** pelo próprio Claude com CI verde: `gh pr merge --squash`. Sem CI ou com CI vermelho, não faça o merge.
8. **Voltar** para a `main` e `git pull --ff-only`.

Commits, branches e PRs seguem **Conventional Commits em português**: `feat(aprovacao): adiciona cancelamento de envio pendente`. Tipos: `feat`, `fix`, `docs`, `test`, `refactor`, `chore`, `ci`, `build`, `perf`. Escopo: o módulo, `infra`, `deps` ou `regras`.

Pré-requisitos de cada colaborador: Git, Node.js na versão de `.nvmrc`, pnpm, Docker e o GitHub CLI autenticado (`gh auth login`). Sem o `gh`, faça o push da branch e entregue ao usuário o link para abrir o PR; não faça o merge por outro caminho.

## 7. Quando perguntar

Pergunte apenas quando:

- a ação está na lista "exige permissão";
- a tarefa depende de uma `Q-xx` e não dá para isolá-la com `NotDecidedYet`;
- o pedido admite duas leituras que levam a resultados diferentes e caros de desfazer.

Fora disso, decida. Ao perguntar, faça uma pergunta objetiva com as opções e a sua recomendação, e continue com o que não depende da resposta.

## 8. Skills

| Skill | Quando usar |
|---|---|
| `fluxo-git` | Começar uma tarefa, commit, push, PR, merge, conflito |
| `verificar` | Antes de todo push e de abrir PR |
| `dependencias` | Pacotes, versões de Node, pnpm ou Docker, variável de ambiente nova |
| `nova-ferramenta-mcp` | Criar ou alterar uma ferramenta MCP |
| `regra-de-negocio` | O usuário decidiu uma `Q-xx` ou mudou uma regra |
