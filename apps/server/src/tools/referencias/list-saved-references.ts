import { listSavedReferences } from "@convergia/core";

import { registerCompanyTool } from "../company-tool";
import type { RegisterKnowledgeTool } from "./deps";
export const registerListSavedReferences: RegisterKnowledgeTool = (
	server,
	user,
	deps,
) =>
	registerCompanyTool(
		server,
		user,
		deps,
		"list_saved_references",
		{
			title: "Listar referências",
			description:
				"Lista os posts e criadores salvos nesta empresa. Não consome cota.",
			input: {},
			readOnly: true,
		},
		async (actor) => {
			const result = await listSavedReferences(deps, actor);
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
