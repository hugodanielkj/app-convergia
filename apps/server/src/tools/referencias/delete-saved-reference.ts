import { deleteSavedReference } from "@convergia/core";
import { z } from "zod";
import { registerCompanyTool } from "../company-tool";
import type { RegisterKnowledgeTool } from "./deps";
export const registerDeleteSavedReference: RegisterKnowledgeTool = (
	server,
	user,
	deps,
) =>
	registerCompanyTool(
		server,
		user,
		deps,
		"delete_saved_reference",
		{
			title: "Excluir referência",
			description: "Exclui definitivamente uma referência salva nesta empresa.",
			input: { reference_id: z.string().describe("ID da referência") },
			readOnly: false,
		},
		async (actor, input) => {
			const result = await deleteSavedReference(
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
