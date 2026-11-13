import { loadEnv } from "@convergia/config";
import {
	createAnthropicLlm,
	createApiKeyRepository,
	createCompanyRepository,
	createContentRepository,
	createDb,
	createFakeLlm,
	createLlmGateway,
	createQuotaRepository,
	createScriptAi,
	createScriptRepository,
} from "@convergia/infra";
import { serve } from "@hono/node-server";
import { createApp } from "./app";
import { createAuthenticate } from "./auth/authenticate";

const env = loadEnv();
const db = createDb(env.DATABASE_URL);
// Sem chave, a IA é simulada; o schema de ambiente exige a chave em produção.
if (!env.ANTHROPIC_API_KEY) {
	console.warn(
		"ANTHROPIC_API_KEY ausente: usando IA simulada (só desenvolvimento).",
	);
}
const llm = env.ANTHROPIC_API_KEY
	? createAnthropicLlm(env.ANTHROPIC_API_KEY)
	: createFakeLlm();
const app = createApp({
	authenticate: createAuthenticate({ apiKeys: createApiKeyRepository(db) }),
	companies: createCompanyRepository(db),
	contents: createContentRepository(db),
	scripts: createScriptRepository(db),
	scriptAi: createScriptAi(createLlmGateway(db, llm)),
	quotas: createQuotaRepository(db),
	now: () => new Date(),
});

serve({ fetch: app.fetch, port: env.PORT }, ({ port }) => {
	console.log(`Servidor MCP em http://localhost:${port}/api/mcp`);
});
