import { dismissBrainstormSuggestion } from "@convergia/core";
import { z } from "zod";
import { registerCompanyTool } from "../company-tool";
import type { RegisterIdeaTool } from "./deps";
export const registerDismissBrainstormSuggestion: RegisterIdeaTool = (
	server,
	user,
	deps,
) =>
	registerCompanyTool(
		server,
		user,
		deps,
		"dismiss_brainstorm_suggestion",
		{
			title: "Descartar ideia",
			description:
				"Descarta uma sugestão ativa, cancelando um envio pendente. Não consome cota.",
			input: { suggestion_id: z.string().describe("ID da sugestão") },
			readOnly: false,
		},
		async (actor, input) => {
			const result = await dismissBrainstormSuggestion(
				deps,
				actor,
				input.suggestion_id,
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
