import { brainstormInput, regenerateBrainstorm } from "@convergia/core";
import { registerCompanyTool } from "../company-tool";
import type { RegisterIdeaTool } from "./deps";
export const registerRegenerateBrainstorm: RegisterIdeaTool = (
	server,
	user,
	deps,
) =>
	registerCompanyTool(
		server,
		user,
		deps,
		"regenerate_brainstorm",
		{
			title: "Gerar ideias",
			description:
				"Gera novas sugestões com justificativa e substitui as ativas. Consome uma das 5 gerações diárias da empresa. Ideias da agência precisam ser enviadas para aprovação.",
			input: brainstormInput.shape,
			readOnly: false,
		},
		async (actor, input) => {
			const result = await regenerateBrainstorm(deps, actor, input);
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
