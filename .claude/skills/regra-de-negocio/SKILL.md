---
name: regra-de-negocio
description: Como registrar uma decisão de negócio no ConvergIA — transformar uma pergunta Q-xx em regra RN confirmada, atualizar os documentos de rules/, a política correspondente e os testes NotDecidedYet. Use quando o usuário responder uma pergunta em aberto, mudar uma regra existente, confirmar ou rejeitar uma regra de referência do Dalea, ou quando uma tarefa esbarrar em uma regra ❓.
---

# Registrar uma regra de negócio

`rules/regra_de_negocio.md` é o documento principal; `stack.md` e `software_design.md` derivam dele. Uma regra só muda quando **o usuário decide**. Você registra a decisão; não a toma.

## 1. Quando uma tarefa esbarra em uma regra ❓

1. Não deduza a resposta nem escolha "a mais provável".
2. Coloque o ponto de decisão em `packages/core/src/policies/`, lançando `NotDecidedYet("Q-xx")`.
3. Escreva um teste que espera esse erro.
4. Continue o restante da tarefa e liste a `Q-xx` em "Pendências" no PR.
5. Só interrompa para perguntar se a tarefa inteira depende da resposta. Nesse caso, faça a pergunta com as opções e as consequências de cada uma.

Dúvida que não tem `Q-xx`: crie a pergunta na seção 8 de `regra_de_negocio.md` com o próximo número livre e trate do mesmo jeito.

## 2. Quando o usuário decide

Use as palavras do usuário. Se a resposta cobrir só parte da pergunta, registre a parte respondida e mantenha o resto em aberto.

**a) `rules/regra_de_negocio.md`**

- Troque a marca da regra de ❓ (ou 📎) para ✅ e reescreva o texto como regra afirmativa. Mantenha o ID `RN-xxx`; IDs nunca são reaproveitados nem renumerados.
- Decisão que cria regra nova: use o próximo ID livre da faixa do módulo.
- Na seção 8, risque a pergunta e anote a data e as regras resultantes, como já é feito em `~~Q-10...~~`.
- Atualize o que depende dela: matriz de permissões (§3.3), diagrama de estados (§5.4), tabela de mensagens de erro (§7).

**b) `rules/software_design.md` e `rules/stack.md`**

Atualize todo trecho que cita a `Q-xx` ou a regra: políticas (§5.3), catálogo de ferramentas (§6), fluxos (§8), tabela da stack. Procure pelo ID nos três arquivos para não deixar referência antiga.

**b2) `.claude/rules/modulos/<modulo>.md`**

Atualize a lista de perguntas em aberto e as invariantes do módulo. Se uma seção de `rules/` foi criada, renomeada ou movida, corrija o título no mapa.

**c) Código** (quando já existir)

- Substitua o `NotDecidedYet("Q-xx")` pela regra, na política.
- Reescreva o teste que esperava `NotDecidedYet`: agora ele testa a regra e cita a `RN-xxx`.
- Procure outros pontos que dependiam da pergunta: `grep -rn "Q-xx"`.

**d) Commit**

Documentos e código no mesmo PR: `feat(<modulo>): define <regra> (RN-xxx, responde Q-xx)`. Só documentos: `docs(regras): ...`.

## 3. Mudança de uma regra ✅ existente

Regra confirmada só muda por pedido explícito do usuário. Antes de alterar, mostre a ele o que mais muda junto: outras regras que a citam, ferramentas afetadas e dados já gravados que ficariam inconsistentes. Depois siga a seção 2.

## 4. Contradição entre documentos

Se os documentos se contradizem, ou o código contradiz uma regra ✅, vale `regra_de_negocio.md`. Corrija o que deriva dele. Se a contradição está dentro do próprio `regra_de_negocio.md`, pergunte ao usuário.
