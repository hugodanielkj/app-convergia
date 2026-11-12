# Stack — ConvergIA

> Deriva de `regra_de_negocio.md`. Mesma legenda: ✅ confirmado por você · 💡 **recomendação minha, a confirmar** · ❓ em aberto.
> O Dalea não divulga o stack. Da documentação só dá para saber: MCP via Streamable HTTP, OAuth 2.1 com PKCE e registro dinâmico de cliente, e Stripe para pagamento. Todo o resto abaixo é proposta nossa, não cópia.

## 1. Resumo

| Camada | Escolha | Status |
|---|---|---|
| Linguagem | **TypeScript** | ✅ |
| Runtime | Node.js 26 (LTS), fixado em `.nvmrc` | 💡 |
| Protocolo | MCP via **Streamable HTTP** | 💡 (igual ao Dalea; é o que o Claude web/desktop e o ChatGPT aceitam) |
| SDK MCP | `@modelcontextprotocol/sdk` (oficial) | 💡 |
| Servidor HTTP | Hono: um só servidor para o MCP (`/api/mcp`) e a API do app (`/api/app`) | 💡 |
| App web | **PWA mobile first** (RN-005) | ✅ |
| Front-end | React + Vite + TypeScript, app de página única (SPA) | 💡 |
| Interface | Tailwind CSS + componentes acessíveis do shadcn/ui (Radix) | 💡 |
| Rotas e dados no app | TanStack Router + TanStack Query | 💡 |
| Formulários | React Hook Form + Zod (os mesmos schemas do servidor) | 💡 |
| PWA | `vite-plugin-pwa` (manifesto, ícones e service worker) | 💡 |
| API do app | Rotas Hono com cliente tipado (Hono RPC) | 💡 |
| Validação | Zod (o mesmo schema serve para validar e para descrever a ferramenta MCP) | 💡 |
| Banco | PostgreSQL | 💡 |
| ORM e migrações | Drizzle | 💡 |
| Filas e jobs | pg-boss (fila dentro do próprio Postgres) | 💡 |
| Arquivos | Armazenamento compatível com S3 (ex.: Cloudflare R2) | 💡 |
| Autenticação | App web: sessão por cookie, forma de login ❓ Q-32. MCP: OAuth 2.1 **e** chave de API ✅ (RN-023) | Fornecedor ❓ Q-31 |
| IA (texto, análise, PDF, visão) | Claude via `@anthropic-ai/sdk` | 💡 (você não tem preferência; ver seção 4) |
| Geração de imagem (arte do carrossel) | Provedor à parte, a escolher | ❓ |
| Transcrição de áudio (reels) | Provedor à parte, a escolher | ❓ |
| Instagram oficial | Instagram API (Meta) com login do Instagram | 💡 |
| Scraping | Serviço de terceiros (ex.: Apify) | ❓ |
| Render do carrossel | Satori + Resvg (HTML/JSX → SVG → PNG 1080×1350) | 💡 |
| Hospedagem | A escolher | ❓ |
| Observabilidade | Logs estruturados (pino) + Sentry | 💡 |
| Testes | Vitest + Testing Library + Playwright (ponta a ponta em tela de celular) + MCP Inspector | 💡 |
| Monorepo | pnpm workspaces | 💡 |

Fora do stack (removido ou adiado, ver regra de negócio §2.2): FFmpeg e pipeline de edição de vídeo, Stripe e cobrança, app nativo de loja (React Native, Swift, Kotlin) e API de anúncios.

---

## 2. Canais de acesso

O produto tem dois canais com as mesmas regras e os mesmos dados (✅ RN-003): o app web, que é o principal, e o servidor MCP. Os dois chamam os mesmos casos de uso do `core`; nenhuma regra de negócio mora no canal.

### 2.1 App web (mobile first) ✅

Decidido (RN-005 a RN-007): app web **mobile first**, **instalável como PWA**, usado pelo **cliente e pela agência**, com a IA acionada por **telas com botões**.

💡 Tecnologia:

- **React + Vite, app de página única (SPA)** em `apps/web`. Não usamos Next.js porque o app é todo atrás de login (não precisa de SEO nem de renderização no servidor) e o back-end já existe em Hono. Um SPA é só um conjunto de arquivos estáticos: simples de hospedar e de transformar em PWA.
- **Tailwind CSS**, que já é mobile first: o estilo sem prefixo vale para o celular, e `md:` e `lg:` ampliam para tablet e computador. Os componentes vêm do **shadcn/ui** (Radix por baixo), com acessibilidade pronta e o código dentro do repositório, sem tema fechado.
- **TanStack Router** para rotas tipadas e **TanStack Query** para os dados: cache, carregamento, nova busca ao voltar para o app e acompanhamento de jobs lentos.
- **React Hook Form + Zod** nos formulários, com os mesmos schemas que o servidor usa para validar.
- **PWA com `vite-plugin-pwa`**: manifesto, ícones, abertura em tela cheia e service worker que guarda só a "casca" do app, para ele abrir rápido. Os dados vêm sempre do servidor; não há modo offline de dados no protótipo.
- **API do app:** o mesmo servidor Hono expõe `/api/app/*` em JSON, além de `/api/mcp`. Com o Hono RPC, o app conhece os tipos de entrada e de saída de cada rota sem gerar código.
- **Mesmo domínio para o app e a API** (ex.: `app.dominio.com` e `app.dominio.com/api`), para a sessão funcionar com cookie `httpOnly` sem depender de cookies de terceiros, que o Safari do iPhone bloqueia.

💡 Metas de mobile first, conferidas no CI ou na revisão:

| Meta | Valor |
|---|---|
| Largura de referência do layout | 360 a 430 px (celular); depois 768 px (tablet) e 1024 px (computador) |
| Área de toque | Mínimo de 44 × 44 px |
| Fonte nos campos de texto | Mínimo de 16 px (evita o zoom automático do iPhone) |
| JavaScript inicial | Até ~200 KB comprimidos |
| Primeira tela útil (LCP) | Menos de 2,5 s num celular médio em 4G |
| Acessibilidade | Contraste AA, foco visível, leitura por leitor de tela |

### 2.2 Servidor MCP

- **Transporte: Streamable HTTP.** É o transporte remoto atual do MCP. É o que o Claude web/desktop ("conector personalizado") e o ChatGPT (modo desenvolvedor) usam. O Claude Code e o Cursor também aceitam. Não vamos oferecer stdio: o servidor é remoto e multiusuário.
- **URL única**, no formato do Dalea: `https://<dominio>/api/mcp`.
- **Sem estado entre requisições** no servidor (stateless). A sessão MCP não guarda dados de negócio; tudo fica no Postgres. Assim dá para escalar horizontalmente.
- **Ferramentas, prompts e erros** seguem o padrão do Dalea: erro de negócio volta como resultado com `isError: true` e mensagem em português, não como erro HTTP. Só "sem credencial" volta como HTTP 401.
- **Ferramenta de inspeção:** MCP Inspector, para testar as ferramentas manualmente durante o desenvolvimento.

## 3. Autenticação

### App web

O app web usa **sessão por cookie** (`httpOnly`, `Secure`, `SameSite=Lax`). A sessão dá acesso de leitura e escrita; os escopos de leitura e escrita (📎 RN-024) valem para as conexões MCP. A forma de login está em aberto (❓ Q-32: e-mail e senha, link por e-mail, Google...).

Um **fornecedor gerenciado** costuma resolver as duas coisas juntas: a tela de login do app e o OAuth do MCP. Por isso a escolha do fornecedor (❓ Q-31) vale para os dois canais.

### MCP ✅ (RN-023)

O servidor aceita os dois métodos. O cliente MCP determina qual é usado:

| Cliente | O que exige |
|---|---|
| Claude web/desktop, ChatGPT | **OAuth 2.1** com PKCE e descoberta automática (metadados `/.well-known/oauth-protected-resource` e do servidor de autorização). Registro dinâmico de cliente é o caminho mais simples. |
| Claude Code | Aceita OAuth ou cabeçalho com chave de API. |
| Cursor e outros | Chave de API no cabeçalho `Authorization: Bearer`. |

Os **clientes da agência não são técnicos** e usam Claude ou ChatGPT, por isso o OAuth é necessário. A chave de API atende quem usa Claude Code, Cursor e outros clientes técnicos.

Duas formas de ter o login do app e o OAuth do MCP (❓ Q-31):

| Opção | Vantagem | Desvantagem |
|---|---|---|
| **Serviço gerenciado** (ex.: WorkOS AuthKit, Stytch, Clerk, Auth0, que já oferecem fluxos para servidores MCP) | Rápido, seguro, tela de login pronta | Custo mensal; dependência externa |
| **Servidor de autorização próprio** (ex.: Better Auth com plugin MCP, ou `oidc-provider`) | Controle total, sem custo por usuário | Mais código e mais responsabilidade de segurança |

💡 Recomendação para protótipo: **serviço gerenciado**, para não gastar o protótipo construindo autenticação. ❓ Escolha do fornecedor em aberto (Q-31).

Chaves de API: prefixo próprio (ex.: `ag_mcp_...`), guardadas **só como hash** e com limite de chaves ativas (📎 Dalea: 10).

## 4. IA

Você não tem preferência de provedor. 💡 Recomendo **Claude (Anthropic)** para texto e análise, pelos motivos abaixo:

- Gera texto em português com bom controle de tom, útil para ganchos, legendas e CTAs.
- Lê **PDF** direto (fontes do card) e **imagens** (capas e lâminas de posts, frames de reels).
- Tem **busca na web** como ferramenta do próprio servidor da Anthropic (refino com pesquisa, RN-075), com citações.
- Tem **saída estruturada** (JSON validado contra um schema), essencial para gravar roteiro, lâminas e classificações no banco sem parsing frágil.

Modelos (IDs atuais):

| Uso | Modelo | Observação |
|---|---|---|
| Padrão para tudo: roteiro, refino, brainstorm, insights, análise de post e criador, planejamento de carrossel | `claude-opus-5-5` | O mais capaz da linha atual. |
| Alternativas mais baratas, se o custo pesar | `claude-sonnet-5-5`, `claude-haiku-5-5` | ❓ **Decisão sua.** Não recomendo trocar por custo antes de medir a qualidade com exemplos reais dos clientes. |

O Claude **não** gera imagem nem transcreve áudio. São necessários dois provedores à parte:

| Necessidade | Para quê | Status |
|---|---|---|
| **Geração de imagem** | Arte das lâminas do carrossel (RN-100) | ❓ provedor a escolher |
| **Transcrição de áudio** | Transcrever reels para análise de post e de referência | ❓ provedor a escolher |

Princípios de uso da IA:
- Toda chamada de IA passa por um **único gateway** no código (ver `software_design.md`). Trocar de modelo ou de provedor muda um arquivo só.
- Toda chamada que conta cota passa antes pela **verificação de cota da empresa** (RN-301).
- Guardar entrada, saída, modelo e tokens de cada geração, para medir custo por empresa e reproduzir problemas.

## 5. Instagram

| Fonte | Uso | Observações |
|---|---|---|
| **Instagram API (Meta), login do Instagram** | Contas profissionais conectadas por OAuth: perfil, posts, métricas e insights da conta | Exige **app aprovado na Meta** (revisão de permissões) e conta Profissional. 📎 RN-036. **A revisão da Meta leva tempo: comece cedo.** |
| **Scraping** (✅ RN-031) | Contas que não conectam e perfis ou posts de referência | ❓ Fornecedor (ex.: Apify) e regras de consentimento (Q-08). Frágil: o layout muda, há bloqueios. Isolar atrás de uma interface. |

Os tokens OAuth do Instagram de cada empresa ficam **criptografados no banco** e são renovados por job agendado antes de expirar.

## 6. Dados e jobs

- **PostgreSQL**: todos os dados de negócio, e também a fila de jobs (pg-boss), os contadores de cota e o log de auditoria. Uma só peça de infraestrutura no protótipo.
- **Isolamento por empresa**: toda tabela de negócio tem `company_id`. 💡 Usar **Row Level Security** do Postgres como segunda barreira, além da checagem no código (RN-015).
- **Jobs em segundo plano** (pg-boss), para o que é lento ou externo:
  - sincronizar métricas do Instagram;
  - scraping de referência e de perfil;
  - extração de fontes (artigo, PDF);
  - transcrição e análise de post;
  - geração de carrossel (planejamento → texto → arte → render);
  - renovação de tokens do Instagram.
- **Armazenamento S3**: PDFs enviados (links assinados que expiram em 2 h, 📎 RN-067), imagens geradas e PNGs finais do carrossel, mídia baixada de posts para análise.
- Redis só se o limite por minuto ou a fila pedirem no futuro. No protótipo, o Postgres basta.

## 7. Hospedagem ❓

Requisitos: um processo HTTP (servidor MCP e API do app), um processo worker (jobs), os arquivos estáticos do app web (de preferência numa CDN), Postgres gerenciado, armazenamento S3 e HTTPS com domínio próprio. O OAuth e o PWA exigem HTTPS, e o app e a API ficam no mesmo domínio (§2.1).

Opções que atendem sem complicação: Railway, Render, Fly.io, ou AWS/GCP se a agência já usa. ❓ **Decisão sua.**

## 8. Desenvolvimento

| Ferramenta | Uso |
|---|---|
| pnpm workspaces | Monorepo (servidor, worker, app web, pacotes compartilhados) |
| Vite | Servidor de desenvolvimento do app web, com recarga instantânea |
| Playwright | Testes de ponta a ponta do app em tela de celular (iPhone e Android) e de computador |
| Vitest | Testes unitários (regras de domínio) e de integração (Postgres de teste) |
| MCP Inspector | Testar as ferramentas na mão |
| Biome | Lint e formatação |
| GitHub Actions | CI: título do PR, lint, tipos, testes, integração com Postgres, auditoria de dependências (migrações entram com a primeira tabela) |
| Docker Compose | Postgres local (porta 54320) |

## 9. Riscos técnicos

| Risco | Impacto | Mitigação |
|---|---|---|
| Revisão do app na Meta demorar ou negar permissões | Sem métricas oficiais | Começar a revisão no primeiro dia; usar scraping enquanto isso |
| Scraping bloqueado ou quebrado | Referências e contas não conectadas param | Fornecedor gerenciado, atrás de uma interface trocável |
| Custo de IA por empresa | Custo sem cobrança no protótipo | Cotas por empresa (RN-300); log de tokens por geração |
| Vazamento de dados entre empresas | Grave: são clientes diferentes da agência | `company_id` obrigatório + RLS + testes de isolamento |
| App e MCP se comportarem diferente | O cliente vê uma coisa no app e outra no Claude | Regra só no `core`; app e MCP só traduzem; testes de contrato nos dois canais |
| Limites do PWA no iPhone | Notificação só com o app instalado na tela inicial; o sistema pode limpar dados guardados no aparelho | Não depender de dados offline; notificação como extra, nunca como único aviso (Q-20) |
