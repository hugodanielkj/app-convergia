---
name: verificar
description: Verificação antes de commit, push e Pull Request no ConvergIA — lint, tipos, testes, revisão do diff, busca por segredos e checagem das regras de arquitetura e isolamento por empresa. Use antes de todo push, antes de abrir PR e sempre que for afirmar que uma mudança está pronta.
---

# Verificar antes de enviar

Execute tudo. Só diga que passou o que você rodou e viu passar. Se uma etapa não pôde ser executada (script ainda não existe, Docker parado), diga qual e por quê.

## 1. Verificações automáticas

```bash
pnpm install --frozen-lockfile  # falha se package.json e lockfile divergem
pnpm lint
pnpm typecheck
pnpm test
```

Uma falha se corrige na causa. Não pule teste, não use `@ts-ignore`, não desligue regra de lint e não use `--no-verify`; qualquer um desses exige permissão do usuário.

Teste que já falhava antes da sua mudança: confirme na `main`, corrija se for simples e, se não for, relate no PR em vez de esconder.

## 2. Revisão do diff

```bash
git status
git diff main...HEAD
```

Leia o diff inteiro e confirme:

- Só há arquivos da tarefa. Nada de arquivo temporário, saída de build, log ou código de depuração.
- Nenhum segredo: chave de API, token, senha, URL de banco com credencial, arquivo `.env`. Procure por `sk-`, `ag_mcp_`, `Bearer `, `postgres://` com usuário e senha, e `BEGIN PRIVATE KEY`.
- Nenhum dado real de cliente em teste ou fixture.
- `package.json` mudou → `pnpm-lock.yaml` mudou junto, e o inverso.
- Variável de ambiente nova → está em `.env.example` e no schema de `packages/config`.

## 3. Regras do projeto

Para o código alterado:

| Verifique | Regra |
|---|---|
| `packages/core` não importa `packages/infra`, o SDK MCP nem biblioteca de infraestrutura | `software_design.md` §2 |
| Ferramenta MCP só valida, chama um caso de uso e formata | §3 |
| Todo caso de uso recebe `ActorContext`; toda consulta filtra por `company_id` | §4, RN-015 |
| Ferramenta nova ou alterada tem teste de isolamento entre empresas | §11 |
| Escrita de conteúdo chama `approval.policy.onContentChanged` na mesma transação | §9, RN-215 |
| Chamada de IA ou scraping reserva cota antes e passa pelo gateway ou adaptador | §5.4, RN-301 |
| Erro de negócio sai com `isError: true` e mensagem em português | `regra_de_negocio.md` §7 |
| Regra ❓ não foi deduzida: lança `NotDecidedYet("Q-xx")` e tem teste | `CLAUDE.md` §1 |
| Cada RN ✅ implementada tem teste que cita o ID | §11 |
| Nenhum teste faz chamada real a API paga | `CLAUDE.md` §3 |

## 4. Migrações

Se o schema mudou: a migração foi gerada, está no commit, aplica em um banco local vazio e não apaga dados sem que isso tenha sido pedido. Tabela de negócio nova tem `company_id` e política de RLS.

## 5. Resultado

Relate em poucas linhas: o que rodou, o que passou, o que falhou (com a saída) e o que não foi verificado.
