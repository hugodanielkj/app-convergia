import { detachContentReference } from "@convergia/core";
import { z } from "zod";
import { registerCompanyTool } from "../company-tool";
import type { RegisterKnowledgeTool } from "./deps";
export const registerDetachContentReference: RegisterKnowledgeTool = (
	server,
	user,
	deps,
) =>
	registerCompanyTool(
		server,
		user,
		deps,
		"detach_content_reference",
		{
			title: "Remover referência do card",
			description: "Remove o vínculo com o card sem alterar a aprovação.",
			input: {
				content_id: z.string().describe("ID do card"),
				reference_id: z.string().describe("ID do vínculo"),
			},
			readOnly: false,
		},
		async (actor, input) => {
			const result = await detachContentReference(
				deps,
				actor,
				input.content_id,
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
