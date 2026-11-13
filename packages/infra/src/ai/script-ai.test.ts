import type { ScriptBrief } from "@convergia/core";
import { describe, expect, it } from "vitest";
import type { LlmGateway, LlmRequest } from "./llm-gateway";
import { createScriptAi } from "./script-ai";

const meta = { companyId: "empresa-a", tool: "refine_content" as const };
const brief: ScriptBrief = {
	companyName: "Móveis A",
	instagram: null,
	content: {
		title: "Sofá",
		idea: null,
		mediaType: "reel",
		format: null,
		category: null,
		funnelStage: null,
		targetDurationSeconds: null,
		script: { hook: "Gancho", body: null, cta: null, caption: null },
		citations: [{ title: "Antiga", url: "https://example.com/antiga" }],
	},
};
const script = { hook: "h", body: "b", cta: "c", caption: "l" };

/** Gateway falso: devolve a saída e as páginas pedidas e guarda as requisições. */
function stubGateway(
	output: unknown,
	webResults: { title: string; url: string }[],
) {
	const requests: LlmRequest<unknown>[] = [];
	const gateway = (async (_meta, request) => {
		requests.push(request);
		return { output, webResults };
	}) as LlmGateway;
	return { gateway, requests };
}

describe("refino com pesquisa na web (RN-075)", () => {
	it("só aceita fontes que a busca devolveu, com o título da busca e sem repetir", async () => {
		const { gateway, requests } = stubGateway(
			{
				reply: "ok",
				script,
				sources: [
					{ title: "Inventada", url: "https://inventada.example/x" },
					{ title: "Do modelo", url: "https://example.com/a/" },
					{ title: "De novo", url: "https://example.com/a#trecho" },
				],
			},
			[{ title: "Página A", url: "https://example.com/a" }],
		);
		const result = await createScriptAi(gateway).refineScript(
			meta,
			brief,
			[],
			"com dados",
			{ webSearch: true },
		);

		expect(result.sources).toEqual([
			{ title: "Página A", url: "https://example.com/a" },
		]);
		expect(requests[0]?.webSearch).toBe(true);
	});

	it("sem pedir a pesquisa, não liga a busca e não devolve fontes", async () => {
		const { gateway, requests } = stubGateway(
			{
				reply: "ok",
				script,
				sources: [{ title: "A", url: "https://example.com/a" }],
			},
			[{ title: "A", url: "https://example.com/a" }],
		);
		const result = await createScriptAi(gateway).refineScript(
			meta,
			brief,
			[],
			"pedido",
			{ webSearch: false },
		);

		expect(result.sources).toEqual([]);
		expect(requests[0]?.webSearch).toBe(false);
	});

	it("a IA recebe as citações do card e as fontes das respostas anteriores", async () => {
		const { gateway, requests } = stubGateway(
			{ reply: "ok", script, sources: [] },
			[],
		);
		await createScriptAi(gateway).refineScript(
			meta,
			brief,
			[
				{ role: "user", text: "primeiro", preview: null, sources: [] },
				{
					role: "assistant",
					text: "feito",
					preview: script,
					sources: [{ title: "Nova", url: "https://example.com/nova" }],
				},
			],
			"segundo",
			{ webSearch: false },
		);

		const text = requests[0]?.messages.map((m) => m.content).join("\n") ?? "";
		expect(text).toContain("Antiga (https://example.com/antiga)");
		expect(text).toContain("Nova (https://example.com/nova)");
	});
});

describe("contexto do Instagram no roteiro (RN-032, RN-039, RN-076)", () => {
	const snapshot = {
		profile: {
			username: "moveis_a",
			name: "Móveis A",
			biography: "Sofás sob medida em Viçosa",
			website: null,
			accountType: "business" as const,
			followersCount: 12_300,
			followsCount: 200,
			mediaCount: 210,
			profilePictureUrl: null,
		},
		posts: [
			{
				id: "1",
				caption: "Post fraco",
				mediaType: "image" as const,
				permalink: null,
				publishedAt: null,
				likeCount: 3,
				commentsCount: 0,
			},
			{
				id: "2",
				caption: `Bastidores da marcenaria\n\n${"muito texto ".repeat(60)}`,
				mediaType: "video" as const,
				permalink: null,
				publishedAt: null,
				likeCount: 500,
				commentsCount: 40,
			},
		],
		collectedAt: new Date("2026-11-13T12:00:00Z"),
	};

	it("manda o perfil e os posts, dos que mais engajaram para os que menos, com legendas curtas", async () => {
		const { gateway, requests } = stubGateway(script, []);
		await createScriptAi(gateway).writeScript(meta, {
			...brief,
			instagram: snapshot,
		});

		const prompt = String(requests[0]?.messages[0]?.content);
		expect(prompt).toContain(
			"Instagram da empresa: @moveis_a, conta comercial, 12.300 seguidores, 210 posts",
		);
		expect(prompt).toContain("Bio: Sofás sob medida em Viçosa");
		expect(prompt.indexOf("Bastidores da marcenaria")).toBeLessThan(
			prompt.indexOf("Post fraco"),
		);
		expect(prompt).toContain("(vídeo, 500 curtidas, 40 comentários)");
		expect(prompt).not.toContain("muito texto ".repeat(40));
	});

	it("sem Instagram conectado, o prompt não fala dele", async () => {
		const { gateway, requests } = stubGateway(script, []);
		await createScriptAi(gateway).writeScript(meta, brief);
		expect(String(requests[0]?.messages[0]?.content)).not.toContain(
			"Instagram da empresa",
		);
	});
});
