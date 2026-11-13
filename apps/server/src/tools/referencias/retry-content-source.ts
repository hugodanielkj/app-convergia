import { retryContentSource } from "@convergia/core";
import { z } from "zod";
import { registerCompanyTool } from "../company-tool";
import type { RegisterKnowledgeTool } from "./deps";
export const registerRetryContentSource: RegisterKnowledgeTool = (
	server,
	user,
	deps,
) =>
	registerCompanyTool(
		server,
		user,
		deps,
		"retry_content_source",
		{
			title: "Repetir extração",
			description:
				"Repetir extração. Depende da definição da cota diária (Q-21); nenhuma extração nem upload ocorre enquanto ela estiver em aberto.",
			input: {
				content_id: z.string().describe("ID do card"),
				source_id: z.string().describe("ID da fonte"),
			},
		},
		async (actor, input) => {
			await retryContentSource(deps, actor, input.content_id, input.source_id);
			return { content: [{ type: "text", text: "Concluído." }] };
		},
	);
