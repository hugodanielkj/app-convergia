import { listContentReferences } from "@convergia/core";
import { z } from "zod";
import { registerCompanyTool } from "../company-tool";
import type { RegisterKnowledgeTool } from "./deps";
export const registerListContentReferences: RegisterKnowledgeTool = (
	server,
	user,
	deps,
) =>
	registerCompanyTool(
		server,
		user,
		deps,
		"list_content_references",
		{
			title: "Referências do card",
			description: "Lista referências anexadas ao card, sem gerar análise.",
			input: { content_id: z.string().describe("ID do card") },
			readOnly: true,
		},
		async (actor, input) => {
			const result = await listContentReferences(deps, actor, input.content_id);
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
