---
paths:
  - "**/package.json"
  - "pnpm-lock.yaml"
  - "pnpm-workspace.yaml"
  - ".nvmrc"
  - ".npmrc"
  - "docker-compose.yml"
  - ".env.example"
  - ".github/**"
---
# Dependências, ambiente e CI

Use a skill `dependencias` antes de alterar estes arquivos.

- Só pnpm. `package.json` e `pnpm-lock.yaml` mudam juntos; o lockfile nunca é editado à mão.
- Versões do Node e do pnpm ficam fixadas e iguais em `.nvmrc`, `engines`, `packageManager` e no CI.
- Imagem Docker com versão explícita, nunca `latest`.
- Variável nova entra em `.env.example` e no schema de `packages/config`. O `.env` real exige permissão.
- Workflow de CI não é alterado para fazer uma verificação passar.
