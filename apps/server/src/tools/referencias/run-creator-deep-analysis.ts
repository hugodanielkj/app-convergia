import { runCreatorDeepAnalysis } from "@convergia/core";
import { z } from "zod";
import { registerCompanyTool } from "../company-tool";
import type { RegisterKnowledgeTool } from "./deps";
export const registerRunCreatorDeepAnalysis: RegisterKnowledgeTool = (
	server,
	user,
	deps,
) =>
	registerCompanyTool(
		server,
		user,
		deps,
		"run_creator_deep_analysis",
		{
			title: "Analisar criador",
			description:
				"Devolve a análise salva sem consumir cota. Se ainda não existe, inicia uma análise em segundo plano, até 3 por empresa/dia. Consulte o progresso com get_creator_analysis.",
			input: { reference_id: z.string().describe("ID do criador salvo") },
			readOnly: false,
		},
		async (actor, input) => {
			const result = await runCreatorDeepAnalysis(
				deps,
				actor,
				input.reference_id,
			);
			return {
				content: [
					{ type: "text", text: JSON.stringify(result ?? { ok: true }) },
				],
				structuredContent: {
					result: JSON.parse(JSON.stringify(result ?? { ok: true })),
				},
			};
		},
	);
