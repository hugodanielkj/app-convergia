import { loadEnv } from "@convergia/config";
import {
	type DiscoveryDeps,
	type InstagramDeps,
	refreshInstagramConnections,
	runVideoQuery,
} from "@convergia/core";
import {
	chooseInstagram,
	chooseLlm,
	createApiKeyRepository,
	createApprovalRepository,
	createCompanyRepository,
	createContentRepository,
	createDb,
	createDiscoveryQueue,
	createDiscoveryRepository,
	createInstagramRepository,
	createLlmGateway,
	createProviderCallLog,
	createQueryExpander,
	createQuotaRepository,
	createScriptAi,
	createScriptRepository,
	createVideoProvider,
	discoverySettingsFromEnv,
	scheduleInstagramRefresh,
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

// Instagram da empresa (RN-034 a RN-039): o da Meta, ou o simulado fora de produção.
const instagram = chooseInstagram(env);
console.log(`Instagram: ${instagram.label}`);
const instagramDeps: InstagramDeps = {
	instagram: createInstagramRepository(db, instagram.cipher),
	instagramGateway: instagram.gateway,
	now: () => new Date(),
};
if (instagram.gateway.configured) {
	await scheduleInstagramRefresh(boss, () =>
		refreshInstagramConnections(instagramDeps),
	);
}

const app = createApp({
	authenticate: createAuthenticate({ apiKeys: createApiKeyRepository(db) }),
	companies: createCompanyRepository(db),
	contents: createContentRepository(db),
	approvals: createApprovalRepository(db),
	scripts: createScriptRepository(db),
	scriptAi: createScriptAi(gateway),
	...instagramDeps,
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
