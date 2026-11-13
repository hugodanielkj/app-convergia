import { getContentSource } from "@convergia/core";
import { z } from "zod";
import { registerCompanyTool } from "../company-tool";
import type { RegisterKnowledgeTool } from "./deps";
export const registerGetContentSource: RegisterKnowledgeTool = (
	server,
	user,
	deps,
) =>
	registerCompanyTool(
		server,
		user,
		deps,
		"get_content_source",
		{
			title: "Consultar fonte",
			description:
				"Consulta os dados e o estado de extração de uma fonte do card.",
			input: {
				content_id: z.string().describe("ID do card"),
				source_id: z.string().describe("ID da fonte"),
			},
			readOnly: true,
		},
		async (actor, input) => {
			const result = await getContentSource(
				deps,
				actor,
				input.content_id,
				input.source_id,
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
