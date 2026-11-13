import { createContentFromSource, sourceInput } from "@convergia/core";
import { registerCompanyTool } from "../company-tool";
import type { RegisterKnowledgeTool } from "./deps";
export const registerCreateContentFromSource: RegisterKnowledgeTool = (
	server,
	user,
	deps,
) =>
	registerCompanyTool(
		server,
		user,
		deps,
		"create_content_from_source",
		{
			title: "Criar card de fonte",
			description:
				"Criar card de fonte. Depende da definição da cota diária (Q-21); nenhuma extração nem upload ocorre enquanto ela estiver em aberto.",
			input: { source: sourceInput },
		},
		async (actor) => {
			await createContentFromSource(deps, actor);
			return { content: [{ type: "text", text: "Concluído." }] };
		},
	);
