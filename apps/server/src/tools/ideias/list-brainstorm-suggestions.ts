import { listBrainstormSuggestions } from "@convergia/core";
import { registerCompanyTool } from "../company-tool";
import type { RegisterIdeaTool } from "./deps";
export const registerListBrainstormSuggestions: RegisterIdeaTool = (
	server,
	user,
	deps,
) =>
	registerCompanyTool(
		server,
		user,
		deps,
		"list_brainstorm_suggestions",
		{
			title: "Listar ideias",
			description:
				"Lista as sugestões ativas com motivo e situação de aprovação. Não consome cota.",
			input: {},
			readOnly: true,
		},
		async (actor) => {
			const result = await listBrainstormSuggestions(deps, actor);
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
