---
paths:
  - "**/*.test.ts"
  - "**/*.spec.ts"
---
# Testes

Referência: `rules/software_design.md` "## 11. Testes".

- Um teste por RN ✅ nas políticas, com o ID no nome: `it("RN-214: agência aprova em nome do cliente só com motivo", ...)`.
- Regra ❓ tem teste que espera `NotDecidedYet("Q-xx")`. Quando a pergunta for respondida, o teste é reescrito.
- Toda ferramenta tem teste de isolamento: empresa A não lê nem altera dados da empresa B.
- Integração usa Postgres real local (Docker), não mock de banco.
- IA, scraping, imagem e transcrição entram como dublês das portas. Chamada real a API paga exige permissão.
- Sem dados reais de clientes em fixtures.
