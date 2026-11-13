import {
	type AuthenticatedUser,
	DEFAULT_DISCOVERY_SETTINGS,
	issueApiKey,
	runVideoQuery,
} from "@convergia/core";
import {
	FakeDiscoveryQueue,
	FakeScriptAi,
	FakeVideoProvider,
	InMemoryApiKeyRepository,
	InMemoryCompanyRepository,
	InMemoryContentRepository,
	InMemoryDiscoveryRepository,
	InMemoryQuotaRepository,
	InMemoryScriptRepository,
	testVideo,
} from "@convergia/core/testing";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app";
import { createAuthenticate } from "../auth/authenticate";

const clientA: AuthenticatedUser = {
	kind: "client_user",
	userId: "user-client-a",
	agencyId: "agency-1",
	companyId: "company-a",
	scopes: [],
};
const clientB: AuthenticatedUser = {
	...clientA,
	userId: "user-client-b",
	companyId: "company-b",
};

type View = {
	requestId: string | null;
	status: string;
	total: number;
	nextOffset: number | null;
	results: { externalId: string; platform: string }[];
	error?: string;
	message?: string;
};

describe("API do app: descoberta de vídeos (RN-110 a RN-119)", () => {
	let app: ReturnType<typeof createApp>;
	let queue: FakeDiscoveryQueue;
	let provider: FakeVideoProvider;
	let discovery: InMemoryDiscoveryRepository;
	let apiKeys: InMemoryApiKeyRepository;
	let deps: Parameters<typeof runVideoQuery>[0];
	const tokens = new Map<string, string>();

	async function call(
		as: AuthenticatedUser,
		method: string,
		path: string,
		body?: unknown,
	) {
		let token = tokens.get(as.userId);
		if (!token) {
			({ token } = await issueApiKey(
				{ apiKeys },
				{ userId: as.userId, name: "teste", scopes: ["read", "write"] },
			));
			tokens.set(as.userId, token);
		}
		const response = await app.request(`/api/app${path}`, {
			method,
			headers: {
				authorization: `Bearer ${token}`,
				"content-type": "application/json",
			},
			...(body === undefined ? {} : { body: JSON.stringify(body) }),
		});
		return { status: response.status, body: (await response.json()) as View };
	}

	beforeEach(() => {
		tokens.clear();
		apiKeys = new InMemoryApiKeyRepository(
			new Map([clientA, clientB].map((u) => [u.userId, u])),
		);
		queue = new FakeDiscoveryQueue();
		provider = new FakeVideoProvider();
		provider.pages = {
			tiktok: [
				{
					videos: [1, 2, 3].map((n) =>
						testVideo({
							platform: "tiktok",
							externalId: `tt${n}`,
							caption: `Receita de bolo fácil ${n}`,
							publishedAt: new Date(Date.now() - n * 3_600_000),
							metrics: { views: n * 100 },
						}),
					),
					nextCursor: null,
				},
			],
		};
		discovery = new InMemoryDiscoveryRepository();
		const base = {
			companies: new InMemoryCompanyRepository([
				{ id: "company-a", agencyId: "agency-1", name: "A" },
				{ id: "company-b", agencyId: "agency-1", name: "B" },
			]),
			quotas: new InMemoryQuotaRepository(),
			now: () => new Date(),
			discovery,
			videoProvider: provider,
			discoveryQueue: queue,
			queryExpander: null,
			discoverySettings: { ...DEFAULT_DISCOVERY_SETTINGS, pageSize: 2 },
		};
		deps = base;
		app = createApp({
			authenticate: createAuthenticate({ apiKeys }),
			contents: new InMemoryContentRepository(),
			scripts: new InMemoryScriptRepository(),
			scriptAi: new FakeScriptAi(),
			...base,
		});
	});

	const path = "/companies/company-a/videos/searches";

	it("pesquisa, acompanha e pagina os resultados", async () => {
		const started = await call(clientA, "POST", path, {
			query: "receita de bolo fácil",
			platform: "tiktok",
			period: "7d",
		});
		expect(started.status).toBe(200);
		expect(started.body.status).toBe("collecting");

		for (const id of queue.enqueued.splice(0)) await runVideoQuery(deps, id);
		const first = await call(
			clientA,
			"GET",
			`${path}/${started.body.requestId}?sort=recent`,
		);
		expect(first.body).toMatchObject({
			status: "ready",
			total: 3,
			nextOffset: 2,
		});
		expect(first.body.results.map((v) => v.externalId)).toEqual(["tt1", "tt2"]);
		const more = await call(
			clientA,
			"GET",
			`${path}/${started.body.requestId}?sort=recent&offset=2`,
		);
		expect(more.body.results.map((v) => v.externalId)).toEqual(["tt3"]);
	});

	it("valida a pesquisa e os filtros", async () => {
		expect((await call(clientA, "POST", path, { query: "a" })).status).toBe(
			422,
		);
		expect(
			(
				await call(clientA, "POST", path, {
					query: "receitas",
					platform: "youtube",
				})
			).status,
		).toBe(422);
		expect((await call(clientA, "GET", `${path}/x?offset=-1`)).status).toBe(
			422,
		);
		expect(queue.enqueued).toHaveLength(0);
	});

	it("RN-015: a empresa B não vê a pesquisa da A", async () => {
		const started = await call(clientA, "POST", path, {
			query: "receita de bolo fácil",
		});
		const other = await call(
			clientB,
			"GET",
			`/companies/company-b/videos/searches/${started.body.requestId}`,
		);
		expect(other.status).toBe(404);
		expect(other.body.message).toBe("Pesquisa não encontrada.");
		expect(
			(await call(clientB, "GET", `${path}/${started.body.requestId}`)).status,
		).toBe(403);
	});

	it("RN-118: limite diário devolve 429 com a mensagem do §7", async () => {
		deps.discoverySettings.dailySearchesPerUser = 1;
		await call(clientA, "POST", path, { query: "assunto um" });
		const blocked = await call(clientA, "POST", path, {
			query: "assunto dois",
		});
		expect(blocked.status).toBe(429);
		expect(blocked.body.message).toBe(
			"Você chegou ao limite de 1 pesquisas de vídeos por dia. Tente amanhã.",
		);
	});
});
