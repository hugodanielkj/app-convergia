import {
	type AuthenticatedUser,
	DEFAULT_DISCOVERY_SETTINGS,
	runVideoQuery,
	VideoProviderError,
} from "@convergia/core";
import {
	FakeDiscoveryQueue,
	FakeScriptAi,
	FakeVideoProvider,
	InMemoryCompanyRepository,
	InMemoryDiscoveryRepository,
	InMemoryQuotaRepository,
	InMemoryScriptRepository,
	inMemoryContentDeps,
	testVideo,
} from "@convergia/core/testing";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { beforeEach, describe, expect, it } from "vitest";
import { buildMcpServer, type ToolDeps } from "../../registry";

const clientA: AuthenticatedUser = {
	kind: "client_user",
	userId: "user-a",
	agencyId: "agency-1",
	companyId: "company-a",
	scopes: ["read", "write"],
};
const clientB: AuthenticatedUser = {
	...clientA,
	userId: "user-b",
	companyId: "company-b",
};
const readOnlyA: AuthenticatedUser = { ...clientA, scopes: ["read"] };

type Structured = {
	search?: {
		requestId: string | null;
		status: string;
		results: { externalId: string; metrics: Record<string, number | null> }[];
	};
};

describe("contrato MCP: descoberta de vídeos (RN-110 a RN-119)", () => {
	let deps: ToolDeps & {
		videoProvider: FakeVideoProvider;
		discoveryQueue: FakeDiscoveryQueue;
	};

	async function connect(as: AuthenticatedUser) {
		const [clientTransport, serverTransport] =
			InMemoryTransport.createLinkedPair();
		const client = new Client({ name: "contract-test", version: "0.0.0" });
		await Promise.all([
			buildMcpServer(as, deps).connect(serverTransport),
			client.connect(clientTransport),
		]);
		return async (name: string, args: Record<string, unknown>) => {
			const result = await client.callTool({ name, arguments: args });
			const content = result.content as { text: string }[];
			return {
				isError: result.isError === true,
				text: content.map((c) => c.text).join("\n"),
				data: result.structuredContent as Structured,
			};
		};
	}

	const runQueued = async () => {
		for (const id of deps.discoveryQueue.enqueued.splice(0))
			await runVideoQuery(deps, id);
	};

	beforeEach(() => {
		const videoProvider = new FakeVideoProvider();
		videoProvider.pages = {
			tiktok: [
				{
					videos: [
						testVideo({
							platform: "tiktok",
							externalId: "tt1",
							caption: "Como criar vídeos com IA #ia",
							creatorHandle: "criador_teste",
							publishedAt: new Date(Date.now() - 86_400_000),
							metrics: { views: 1_500, likes: 80 },
						}),
					],
					nextCursor: null,
				},
			],
		};
		videoProvider.failures = {
			instagram: new VideoProviderError("blocked", "bloqueado"),
		};
		deps = {
			companies: new InMemoryCompanyRepository([
				{ id: "company-a", agencyId: "agency-1", name: "A" },
				{ id: "company-b", agencyId: "agency-1", name: "B" },
			]),
			...inMemoryContentDeps(),
			scripts: new InMemoryScriptRepository(),
			scriptAi: new FakeScriptAi(),
			quotas: new InMemoryQuotaRepository(),
			now: () => new Date(),
			discovery: new InMemoryDiscoveryRepository(),
			videoProvider,
			discoveryQueue: new FakeDiscoveryQueue(),
			queryExpander: null,
			discoverySettings: DEFAULT_DISCOVERY_SETTINGS,
		};
	});

	it("pesquisa, acompanha pelo ID e mostra só dados reais do provedor", async () => {
		const call = await connect(clientA);
		const started = await call("discover_videos", {
			query: "como criar vídeos com AI",
		});
		expect(started.isError).toBe(false);
		expect(started.data.search?.status).toBe("collecting");
		const requestId = started.data.search?.requestId ?? "";
		expect(started.text).toContain(`ID: ${requestId}`);
		expect(started.text).toContain("get_discovered_videos");

		await runQueued();
		const done = await call("get_discovered_videos", { request_id: requestId });
		expect(done.data.search?.status).toBe("ready");
		expect(done.data.search?.results.map((v) => v.externalId)).toEqual(["tt1"]);
		expect(done.text).toContain("Populares sobre este assunto");
		expect(done.text).toContain("@criador_teste");
		expect(done.text).toContain("1.500 visualizações, 80 curtidas");
		// Métrica ausente não aparece como zero.
		expect(done.text).not.toContain("0 comentários");
		expect(done.text).toContain("Não foi possível buscar no Instagram");
	});

	it("RN-015: outra empresa não vê a pesquisa, e o erro sai como isError", async () => {
		const started = await (await connect(clientA))("discover_videos", {
			query: "receitas fáceis",
		});
		const other = await (await connect(clientB))("get_discovered_videos", {
			request_id: started.data.search?.requestId ?? "",
		});
		expect(other.isError).toBe(true);
		expect(other.text).toContain("Pesquisa não encontrada.");
	});

	it("RN-024: conexão só de leitura não pesquisa", async () => {
		const result = await (await connect(readOnlyA))("discover_videos", {
			query: "receitas fáceis",
		});
		expect(result.isError).toBe(true);
	});

	it("sem provedor configurado, avisa e não mostra vídeo nenhum", async () => {
		deps.videoProvider.configured = false;
		const result = await (await connect(clientA))("discover_videos", {
			query: "receitas fáceis",
		});
		expect(result.isError).toBe(false);
		expect(result.data.search).toMatchObject({
			status: "not_configured",
			results: [],
		});
		expect(result.text).toContain("não foi configurada");
	});
});
