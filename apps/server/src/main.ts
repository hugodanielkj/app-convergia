import { loadEnv } from "@convergia/config";
import {
	type DiscoveryDeps,
	type ReferenceProcessingDeps,
	recoverReferenceJobs,
	runReferenceJob,
	runVideoQuery,
} from "@convergia/core";
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
	createReferenceAi,
	createReferenceProvider,
	createReferenceQueue,
	createScriptAi,
	createScriptRepository,
	createSourceRepository,
	createVideoProvider,
	discoverySettingsFromEnv,
	startJobs,
	workDiscoveryQueue,
	workReferenceQueue,
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
const referenceDeps: ReferenceProcessingDeps = {
	knowledge: createKnowledgeRepository(db),
	referenceProvider: createReferenceProvider(env.SCRAPECREATORS_API_KEY),
	referenceAi: createReferenceAi(gateway),
	referenceQueue: createReferenceQueue(boss),
	now: () => new Date(),
};
const stopReferenceRecovery = await workReferenceQueue(
	boss,
	(companyId, id) => runReferenceJob(referenceDeps, companyId, id),
	() => recoverReferenceJobs(referenceDeps),
);
const app = createApp({
	...referenceDeps,
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
		stopReferenceRecovery();
		await boss.stop();
		process.exit(0);
	});
}
