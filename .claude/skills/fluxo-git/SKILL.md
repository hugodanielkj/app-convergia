---
name: fluxo-git
description: Fluxo de Git e GitHub do ConvergIA — sincronizar com a main, criar branch, fazer commit no padrão, push, abrir Pull Request, fazer merge com CI verde e resolver conflitos. Use ao começar uma tarefa, ao fazer commit, push, PR ou merge, e quando o usuário pedir para "subir", "enviar" ou "sincronizar" o código.
---

# Fluxo Git

Todo trabalho entra na `main` por Pull Request. Nunca faça commit nem push direto na `main`.

## 1. Antes de começar

```bash
git status                      # a árvore precisa estar limpa
git switch main
git pull --ff-only
git switch -c <tipo>/<descricao-curta>
```

- Se `git status` mostrar alterações que você não fez, não as descarte nem as guarde em stash: pergunte ao usuário.
- Se `git pull --ff-only` falhar, a `main` local divergiu da remota. Não force: mostre a divergência ao usuário.
- Nome da branch: tipo do Conventional Commits, barra, descrição em minúsculas com hífens e sem acento. Exemplo: `feat/aprovacao-cancelar-envio`.

## 2. Commits

- Um commit por mudança coerente, com o projeto funcionando depois dele.
- Adicione arquivos pelo nome (`git add caminho/arquivo`). Evite `git add -A` e `git add .`, que levam junto arquivos que não são da tarefa.
- Revise com `git diff --staged` antes de cada commit.
- Mensagem em português, no formato:

```text
<tipo>(<escopo>): <verbo no presente> <o quê>

<por que a mudança foi feita, quando não for óbvio. Cite RN-xxx ou Q-xx.>
```

Tipos: `feat`, `fix`, `docs`, `test`, `refactor`, `chore`, `ci`, `build`, `perf`.
Escopos: `acesso`, `desempenho`, `conteudo`, `roteiros`, `ideias`, `referencias`, `carrossel`, `aprovacao`, `cotas`, `busca`, `infra`, `deps`.

A primeira linha tem até 72 caracteres, sem ponto final. Use `!` depois do escopo para mudança incompatível (`feat(acesso)!: ...`).

## 3. Push

Rode a skill `verificar` antes. Depois:

```bash
git push -u origin <branch>     # primeiro push
git push                        # os seguintes
```

Se o push for rejeitado porque a branch remota tem commits novos, faça `git pull --rebase` na **sua** branch e envie de novo. Nunca use `--force`; se parecer necessário, pare e peça permissão.

## 4. Pull Request

```bash
gh pr create --base main --title "<tipo>(<escopo>): <descrição>" --body "<corpo>"
```

O título segue o padrão de commit, porque o merge é squash e o título vira a mensagem na `main`. Corpo:

```markdown
## O que muda
<duas ou três frases>

## Por quê
<regra RN-xxx atendida ou problema corrigido>

## Decisões tomadas
<escolhas que você fez sozinho e o motivo; dependências novas>

## Como verificar
<comandos executados e resultado>

## Pendências
<Q-xx que ficaram como NotDecidedYet, ou "nenhuma">
```

Sem o `gh` instalado ou autenticado: faça o push da branch e entregue ao usuário o link `https://github.com/<dono>/<repo>/compare/<branch>?expand=1`.

## 5. Merge

Você pode fazer o merge do próprio PR **somente com o CI verde**:

```bash
gh pr checks --watch            # espera o CI terminar
gh pr merge --squash
git switch main
git pull --ff-only
git branch -d <branch>          # apaga só a branch local já integrada
```

- CI vermelho: leia o log (`gh run view --log-failed`), corrija na branch e envie de novo. Não altere o workflow nem desative verificação para passar.
- Sem CI configurado no repositório: não faça o merge. Avise o usuário; criar o workflow de CI faz parte do esqueleto do projeto.
- PR com pedido de mudança de um revisor humano: atenda antes do merge.
- Não apague a branch remota por comando. O repositório deve ter a opção "Automatically delete head branches" ativada.

## 6. Conflitos

```bash
git fetch origin
git rebase origin/main          # só em branch sua e que ninguém mais usa
```

- Resolva entendendo os dois lados. Nunca escolha um lado inteiro só para o conflito sumir.
- Depois de resolver, rode a skill `verificar` de novo.
- Rebase reescreve histórico: se a branch já foi enviada, o push seguinte pediria `--force`. Nesse caso prefira `git merge origin/main`, que não reescreve nada.
- Conflito em `pnpm-lock.yaml`: não edite à mão. Aceite a versão da `main` e rode `pnpm install`.

## 7. O que exige permissão

Force push, reescrita de histórico já enviado, commit direto na `main`, apagar branch remota ou tag, `git reset --hard`, `git clean`, descartar alterações que não são suas e `--no-verify`. Explique o motivo e espere a resposta.

## 8. Repositório ainda sem remote

Se `git remote -v` vier vazio, o repositório do GitHub ainda não foi ligado. Trabalhe em branch e faça commits normalmente, e avise o usuário de que push e PR ficam pendentes até ele rodar:

```bash
git remote add origin <url-do-repositorio>
```
