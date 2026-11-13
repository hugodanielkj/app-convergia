import { getCreatorAnalysis } from "@convergia/core";
import { z } from "zod";
import { registerCompanyTool } from "../company-tool";
import type { RegisterKnowledgeTool } from "./deps";
export const registerGetCreatorAnalysis: RegisterKnowledgeTool = (
	server,
	user,
	deps,
) =>
	registerCompanyTool(
		server,
		user,
		deps,
		"get_creator_analysis",
		{
			title: "Consultar análise",
			description: "Devolve a análise salva de um criador, sem IA nem cota.",
			input: { reference_id: z.string().describe("ID do criador salvo") },
			readOnly: true,
		},
		async (actor, input) => {
			const result = await getCreatorAnalysis(deps, actor, input.reference_id);
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
