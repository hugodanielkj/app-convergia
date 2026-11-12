---
name: dependencias
description: Gestão de dependências e ambiente reprodutível do ConvergIA — adicionar, atualizar ou remover pacotes com pnpm, lockfile, versão de Node e pnpm, imagens Docker e variáveis de ambiente. Use ao mexer em package.json, pnpm-lock.yaml, .nvmrc, docker-compose.yml ou .env.example, ao montar o esqueleto do monorepo e quando algo "funciona na minha máquina" mas falha em outra.
---

# Dependências e ambiente

O projeto roda nas máquinas de vários colaboradores e no CI. O objetivo é que `git clone` seguido dos comandos do README produza o mesmo ambiente em todas elas.

## 1. O que precisa estar fixado no repositório

| Item | Onde | Regra |
|---|---|---|
| Gerenciador de pacotes | `packageManager` no `package.json` da raiz (ex.: `pnpm@x.y.z`) | Versão exata. O Corepack usa esse campo. Só pnpm: nunca `npm install` nem `yarn`. |
| Versão do Node | `.nvmrc` e `engines.node` no `package.json` da raiz | A mesma nos dois e no CI. Use a LTS vigente na criação do esqueleto. |
| Recusar Node errado | `engine-strict=true` no `.npmrc` | A instalação falha em vez de gerar um ambiente diferente. |
| Versões dos pacotes | `pnpm-lock.yaml` | Sempre commitado. Nunca editado à mão. Nunca no `.gitignore`. |
| Serviços locais | `docker-compose.yml` | Imagem com versão explícita (`postgres:<major>.<minor>`), nunca `latest`. |
| Variáveis de ambiente | `.env.example` + schema Zod em `packages/config` | Toda variável existe nos dois. `.env` nunca é commitado. |
| Pacotes internos | `workspace:*` | Um pacote do monorepo depende do outro pelo protocolo de workspace. |

Instalação em máquina nova e no CI: `pnpm install --frozen-lockfile`.

## 2. Adicionar um pacote

Você decide sozinho, sem pedir permissão. Antes de adicionar:

1. **Precisa mesmo?** Se a plataforma ou um pacote já instalado resolve em poucas linhas, não adicione.
2. **Está na stack?** `rules/stack.md` já define a biblioteca de cada camada. Não traga uma segunda para a mesma função.
3. **É confiável?** Mantido, com licença permissiva (MIT, Apache-2.0, BSD, ISC), com tipos TypeScript e sem vulnerabilidade conhecida. Confira o nome exato do pacote para não instalar um homônimo malicioso.

Depois:

```bash
pnpm add <pacote> --filter <workspace>       # dependência de execução
pnpm add -D <pacote> --filter <workspace>    # só desenvolvimento e testes
pnpm add -D -w <pacote>                      # ferramenta da raiz (lint, tipos)
```

- Instale no workspace que usa o pacote, não na raiz.
- `packages/core` não recebe dependência de infraestrutura (banco, HTTP, SDK de fornecedor, SDK MCP).
- Separe corretamente `dependencies` de `devDependencies`.
- Commit com `package.json` e `pnpm-lock.yaml` juntos: `build(deps): adiciona <pacote> em <workspace>`.
- No PR, em "Decisões tomadas", diga o que o pacote faz e por que foi escolhido.

## 3. Atualizar e remover

```bash
pnpm outdated -r
pnpm update <pacote> --filter <workspace>    # dentro do intervalo declarado
pnpm add <pacote>@<versao> --filter <workspace>   # nova major
pnpm remove <pacote> --filter <workspace>
pnpm audit
```

- Atualização vai em PR próprio, separado de mudança de funcionalidade.
- Nova major: leia as notas de versão, ajuste o código e rode a skill `verificar`.
- Ao deixar de usar um pacote, remova-o no mesmo PR.
- Mudança da versão do Node ou do pnpm altera `.nvmrc`, `engines`, `packageManager` e o workflow de CI no mesmo commit.

## 4. Variáveis de ambiente

1. Declare no schema Zod de `packages/config` (tipo, obrigatória ou não, valor padrão quando for seguro).
2. Adicione em `.env.example` com um valor de exemplo falso e um comentário de uma linha.
3. Leia a variável só por `packages/config`. Nada de `process.env` espalhado.

Você não lê nem escreve o `.env` real: isso exige permissão do usuário.

## 5. Ao criar o esqueleto do monorepo

Entregue no mesmo PR: `package.json` da raiz com `packageManager`, `engines` e os scripts `lint`, `typecheck` e `test`; `pnpm-workspace.yaml`; `.nvmrc`; `.npmrc`; `pnpm-lock.yaml`; `docker-compose.yml`; `.env.example`; workflow de CI que roda `pnpm install --frozen-lockfile`, lint, tipos e testes; e um `README.md` com o passo a passo de instalação para um colaborador novo.

## 6. Diagnóstico de "funciona só na minha máquina"

Confira, nesta ordem: versão do Node contra `.nvmrc`; versão do pnpm contra `packageManager`; `pnpm install --frozen-lockfile` passa; variável presente no `.env` local e ausente de `.env.example`; serviço ou ferramenta instalada globalmente que o projeto usa sem declarar; caminho absoluto ou diferença de maiúsculas em nome de arquivo (macOS não diferencia, Linux e o CI diferenciam).
