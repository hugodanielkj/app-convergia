---
paths:
  - "apps/web/**"
---
# Camada: app web (mobile first)

Referência: `rules/software_design.md` "## 13. App web: telas e padrões mobile first"; `rules/stack.md` "### 2.1 App web (mobile first) ✅". Regras: RN-003, RN-005 a RN-007.

- **Mobile first:** escreva o estilo base para o celular (360 a 430 px) e amplie com `md:` e `lg:`. Nunca o contrário.
- Área de toque de no mínimo 44 × 44 px; campos de texto com fonte de no mínimo 16 px; `inputMode` e `autoComplete` certos em cada campo.
- Ação principal ao alcance do polegar; no celular, folhas que sobem do rodapé (bottom sheets) no lugar de janelas no meio da tela.
- Nenhuma regra de negócio no app: ele chama a API do app (`/api/app`), e quem decide é o `core`. Validação no formulário é só conveniência; a validação que vale é a do servidor.
- Erro de negócio aparece com a mensagem que o servidor devolveu (regra de negócio §7). Não reescreva a mensagem no app.
- A empresa em que se opera está na URL (`/empresas/$companyId/...`), nunca num estado global ou no `localStorage` (RN-022).
- Toda tela tem os estados de carregamento (esqueleto), vazio (com o próximo passo) e erro.
- Textos da interface em português; código em inglês.
- Acessibilidade: contraste AA, foco visível, rótulo em todo botão de ícone.
- Tela nova tem teste de componente e, se for um fluxo principal, teste ponta a ponta no Playwright em tela de celular.
