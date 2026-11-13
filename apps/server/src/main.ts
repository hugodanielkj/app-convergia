import { loadEnv } from "@convergia/config";
import {
	chooseLlm,
	createApiKeyRepository,
	createCompanyRepository,
	createContentRepository,
	createDb,
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
const llm = chooseLlm(env);
console.log(`IA de texto: ${llm.model}`);
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
