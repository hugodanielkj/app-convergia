import { loadEnv } from "@convergia/config";
import { type DiscoveryDeps, runVideoQuery } from "@convergia/core";
import {
	chooseLlm,
	createApiKeyRepository,
	createApprovalRepository,
	createApprovalSubjects,
	createBrainstormAi,
	createCompanyRepository,
	createContentRepository,
	createDb,
	createDiscoveryQueue,
	createDiscoveryRepository,
	createIdeaRepository,
	createKnowledgeRepository,
	createLlmGateway,
	createProviderCallLog,
	createQueryExpander,
	createQuotaRepository,
	createScriptAi,
	createScriptRepository,
	createSourceRepository,
	createVideoProvider,
	discoverySettingsFromEnv,
	startJobs,
	workDiscoveryQueue,
} from "@convergia/infra";
import { serve } from "@hono/node-server";
import { createApp } from "./app";
import { createAuthenticate } from "./auth/authenticate";

const env = loadEnv();
const db = createDb(env.DATABASE_URL);
const llm = chooseLlm(env);
const gateway = createLlmGateway(db, llm);
console.log(`IA de texto: ${llm.model}`);

// Fila de jobs no próprio Postgres (stack §6). No protótipo, o worker roda neste processo.
const boss = await startJobs(env.DATABASE_URL);
const videoProvider = createVideoProvider(env, createProviderCallLog(db));
console.log(
	`Descoberta de vídeos: ${videoProvider.configured ? videoProvider.name : "não configurada (falta SCRAPECREATORS_API_KEY)"}`,
);
const discoveryDeps: DiscoveryDeps = {
	discovery: createDiscoveryRepository(db),
	videoProvider,
	discoveryQueue: createDiscoveryQueue(boss),
	queryExpander: env.VIDEO_SEARCH_AI_EXPANSION
		? createQueryExpander(gateway)
		: null,
	quotas: createQuotaRepository(db),
	discoverySettings: discoverySettingsFromEnv(env),
	now: () => new Date(),
};
await workDiscoveryQueue(boss, (queryId) =>
	runVideoQuery(discoveryDeps, queryId),
);

const contents = createContentRepository(db);
const ideas = createIdeaRepository(db);
const app = createApp({
	knowledge: createKnowledgeRepository(db),
	sources: createSourceRepository(db),
	ideas,
	brainstormAi: createBrainstormAi(gateway),
	approvalSubjects: createApprovalSubjects(contents, ideas),
	authenticate: createAuthenticate({ apiKeys: createApiKeyRepository(db) }),
	companies: createCompanyRepository(db),
	contents,
	approvals: createApprovalRepository(db),
	scripts: createScriptRepository(db),
	scriptAi: createScriptAi(gateway),
	...discoveryDeps,
});

const server = serve({ fetch: app.fetch, port: env.PORT }, ({ port }) => {
	console.log(`Servidor MCP em http://localhost:${port}/api/mcp`);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
	process.once(signal, async () => {
		server.close();
		await boss.stop();
		process.exit(0);
	});
}
