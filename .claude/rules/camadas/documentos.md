---
paths:
  - "rules/**"
---
# Documentos de regra (rules/)

Use a skill `regra-de-negocio` antes de alterar estes arquivos.

- `regra_de_negocio.md` é a fonte; `stack.md` e `software_design.md` derivam dele.
- Só registre o que o usuário decidiu. Nunca crie nem mude regra por dedução.
- IDs `RN-xxx` e `Q-xx` nunca são renumerados nem reaproveitados.
- Os mapas em `.claude/rules/modulos/` apontam para os títulos das seções. Ao renomear, criar ou mover uma seção, atualize o mapa do módulo no mesmo commit.
