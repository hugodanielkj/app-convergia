import { readFileSync } from "node:fs";
import { VideoProviderError } from "@convergia/core";
import { describe, expect, it } from "vitest";
import {
	createScrapeCreatorsProvider,
	type ProviderCall,
} from "./scrapecreators-provider";

/** Respostas sintéticas no formato documentado pelo provedor; não são vídeos reais. */
const fixture = (name: string): unknown =>
	JSON.parse(
		readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), "utf8"),
	);

type Reply =
	| { status?: number; body?: unknown; headers?: Record<string, string> }
	| Error;

function stub(replies: Reply[]) {
	const requests: { url: URL; apiKey: string | null }[] = [];
	const waits: number[] = [];
	const calls: ProviderCall[] = [];
	const fetchStub = (async (
		input: string | URL | Request,
		init?: RequestInit,
	) => {
		const url = new URL(String(input));
		requests.push({ url, apiKey: new Headers(init?.headers).get("x-api-key") });
		const reply = replies.shift() ?? { body: {} };
		if (reply instanceof Error) throw reply;
		return Response.json(reply.body ?? {}, {
			status: reply.status ?? 200,
			...(reply.headers ? { headers: reply.headers } : {}),
		});
	}) as typeof fetch;
	const provider = createScrapeCreatorsProvider({
		apiKey: "chave-de-teste",
		retries: 2,
		fetch: fetchStub,
		sleep: async (ms) => {
			waits.push(ms);
		},
		onCall: (call) => calls.push(call),
	});
	return { provider, requests, waits, calls };
}

const tiktokRequest = {
	platform: "tiktok" as const,
	term: "como criar vídeos com AI",
	period: "30d" as const,
	cursor: null,
	language: "pt" as const,
};

describe("ScrapeCreators (RN-111, RN-112, RN-118)", () => {
	it("TikTok: busca pela palavra-chave e normaliza os campos", async () => {
		const { provider, requests, calls } = stub([
			{ body: fixture("tiktok-search") },
		]);
		const page = await provider.search(tiktokRequest);

		const url = requests[0]?.url;
		expect(url?.pathname).toBe("/v1/tiktok/search/keyword");
		expect(Object.fromEntries(url?.searchParams ?? [])).toEqual({
			query: "como criar vídeos com AI",
			date_posted: "this-month",
			sort_by: "relevance",
			region: "BR",
		});
		expect(requests[0]?.apiKey).toBe("chave-de-teste");
		expect(page.nextCursor).toBe("20");
		expect(page.videos).toHaveLength(2);
		expect(page.videos[0]).toEqual({
			platform: "tiktok",
			externalId: "7300000000000000001",
			url: "https://www.tiktok.com/@criador_exemplo/video/7300000000000000001",
			caption: "Como criar vídeos com IA em 3 passos #ia #video",
			creatorHandle: "criador_exemplo",
			creatorName: "Criador Exemplo",
			thumbnailUrl: "https://p16-sign.tiktokcdn-us.com/exemplo-capa.jpeg",
			publishedAt: new Date(1762800000 * 1000),
			durationSeconds: 22.874,
			language: "pt",
			metrics: { views: 125000, likes: 8400, comments: 312, shares: 950 },
		});
		expect(calls).toEqual([
			expect.objectContaining({
				platform: "tiktok",
				operation: "search",
				success: true,
				attempts: 1,
				credits: 1,
			}),
		]);
	});

	it("RN-112: campo que não veio fica vazio, nunca zero, e o link é montado pelo ID", async () => {
		const { provider } = stub([{ body: fixture("tiktok-search") }]);
		const [, second] = (await provider.search(tiktokRequest)).videos;
		expect(second).toMatchObject({
			url: "https://www.tiktok.com/@outro_exemplo/video/7300000000000000002",
			caption: null,
			thumbnailUrl: null,
			durationSeconds: null,
			metrics: { views: null, likes: 10, comments: null, shares: null },
		});
	});

	it("Instagram: busca Reels por página e para na página 11", async () => {
		const { provider, requests } = stub([
			{ body: fixture("instagram-reels-search") },
			{ body: fixture("instagram-reels-search") },
		]);
		const first = await provider.search({
			...tiktokRequest,
			platform: "instagram",
			period: "7d",
		});
		expect(requests[0]?.url.pathname).toBe("/v2/instagram/reels/search");
		expect(Object.fromEntries(requests[0]?.url.searchParams ?? [])).toEqual({
			query: "como criar vídeos com AI",
			date_posted: "last-week",
			page: "1",
		});
		expect(first.nextCursor).toBe("2");
		expect(first.videos[0]).toEqual({
			platform: "instagram",
			externalId: "DExemplo001",
			url: "https://www.instagram.com/reel/DExemplo001/",
			caption: "Vídeo com inteligência artificial: do roteiro à edição #ia",
			creatorHandle: "perfil_exemplo",
			creatorName: "Perfil Exemplo",
			thumbnailUrl: "https://scontent.cdninstagram.com/exemplo-thumb.jpg",
			publishedAt: new Date("2026-11-05T16:56:45.000Z"),
			durationSeconds: 45.2,
			language: null,
			metrics: { views: null, likes: 3487, comments: 90, shares: null },
		});
		expect(first.videos[1]).toMatchObject({
			url: "https://www.instagram.com/reel/DExemplo002/",
			creatorHandle: null,
			publishedAt: null,
		});

		const last = await provider.search({
			...tiktokRequest,
			platform: "instagram",
			period: "any",
			cursor: "11",
		});
		expect(requests[1]?.url.searchParams.has("date_posted")).toBe(false);
		expect(last.nextCursor).toBeNull();
	});

	it("métricas de um vídeo: Instagram com visualizações e TikTok pelo link", async () => {
		const { provider, requests } = stub([
			{ body: fixture("instagram-post") },
			{ body: fixture("tiktok-video") },
		]);
		await expect(
			provider.fetchMetrics("instagram", {
				externalId: "DExemplo001",
				url: "https://www.instagram.com/reel/DExemplo001/",
			}),
		).resolves.toEqual({
			views: 98000,
			likes: 3500,
			comments: 91,
			shares: null,
		});
		await expect(
			provider.fetchMetrics("tiktok", {
				externalId: "7300000000000000001",
				url: "https://www.tiktok.com/@criador_exemplo/video/7300000000000000001",
			}),
		).resolves.toEqual({
			views: 130000,
			likes: 8600,
			comments: 320,
			shares: 990,
		});
		expect(requests.map((r) => r.url.pathname)).toEqual([
			"/v1/instagram/post",
			"/v2/tiktok/video",
		]);
	});

	it("tenta de novo falhas passageiras, respeitando o Retry-After", async () => {
		const { provider, waits, calls } = stub([
			{ status: 429, headers: { "retry-after": "3" } },
			new TypeError("fetch failed"),
			{ body: fixture("tiktok-search") },
		]);
		await expect(provider.search(tiktokRequest)).resolves.toMatchObject({
			nextCursor: "20",
		});
		expect(waits).toEqual([3000, 1000]);
		expect(calls).toEqual([
			expect.objectContaining({ success: true, attempts: 3 }),
		]);
	});

	it("desiste depois do limite de tentativas e não repete erros definitivos", async () => {
		const failing = stub([
			{ status: 503 },
			{ status: 503 },
			{ status: 503 },
			{ status: 503 },
		]);
		await expect(failing.provider.search(tiktokRequest)).rejects.toMatchObject({
			kind: "unavailable",
		});
		expect(failing.requests).toHaveLength(3);

		for (const [status, kind] of [
			[401, "unauthorized"],
			[402, "out_of_credits"],
			[403, "blocked"],
			[400, "invalid_request"],
		] as const) {
			const once = stub([{ status }]);
			await expect(once.provider.search(tiktokRequest)).rejects.toMatchObject({
				kind,
			});
			expect(once.requests).toHaveLength(1);
			expect(once.calls).toEqual([
				expect.objectContaining({ success: false, errorKind: kind }),
			]);
		}
	});

	it("resposta fora do formato vira erro do provedor, não dado inventado", async () => {
		const { provider } = stub([{ body: { search_item_list: "quebrado" } }]);
		await expect(provider.search(tiktokRequest)).rejects.toBeInstanceOf(
			VideoProviderError,
		);
	});

	it("sem chave, não chama o provedor e avisa que falta configurar", async () => {
		const provider = createScrapeCreatorsProvider({ apiKey: undefined });
		expect(provider.configured).toBe(false);
		await expect(provider.search(tiktokRequest)).rejects.toMatchObject({
			kind: "not_configured",
		});
	});
});
