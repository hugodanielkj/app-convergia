import { addContentSource, sourceInput } from "@convergia/core";
import { z } from "zod";
import { registerCompanyTool } from "../company-tool";
import type { RegisterKnowledgeTool } from "./deps";
export const registerAddContentSource: RegisterKnowledgeTool = (
	server,
	user,
	deps,
) =>
	registerCompanyTool(
		server,
		user,
		deps,
		"add_content_source",
		{
			title: "Adicionar fonte",
			description:
				"Adicionar fonte. Depende da definição da cota diária (Q-21); nenhuma extração nem upload ocorre enquanto ela estiver em aberto.",
			input: {
				content_id: z.string().describe("ID do card"),
				source: sourceInput,
			},
		},
		async (actor, input) => {
			await addContentSource(deps, actor, input.content_id);
			return { content: [{ type: "text", text: "Concluído." }] };
		},
	);
