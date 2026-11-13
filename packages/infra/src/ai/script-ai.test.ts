import type { ScriptBrief } from "@convergia/core";
import { describe, expect, it } from "vitest";
import type { LlmGateway, LlmRequest } from "./llm-gateway";
import { createScriptAi } from "./script-ai";

const meta = { companyId: "empresa-a", tool: "refine_content" as const };
const brief: ScriptBrief = {
	companyName: "Móveis A",
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
