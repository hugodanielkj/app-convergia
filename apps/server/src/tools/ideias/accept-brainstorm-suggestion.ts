import { acceptBrainstormSuggestion } from "@convergia/core";
import { z } from "zod";
import { registerCompanyTool } from "../company-tool";
import type { RegisterIdeaTool } from "./deps";
export const registerAcceptBrainstormSuggestion: RegisterIdeaTool = (
	server,
	user,
	deps,
) =>
	registerCompanyTool(
		server,
		user,
		deps,
		"accept_brainstorm_suggestion",
		{
			title: "Transformar ideia em card",
			description:
				"Cria um único card na coluna ideia, sem IA e sem cota. Ideias da agência exigem aprovação prévia.",
			input: { suggestion_id: z.string().describe("ID da sugestão") },
			readOnly: false,
		},
		async (actor, input) => {
			const result = await acceptBrainstormSuggestion(
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
