import { createContents, newContentInput } from "@convergia/core";
import { registerCompanyTool } from "../company-tool";
import type { RegisterContentTool } from "./deps";
import { contentResult } from "./format";

export const registerCreateContent: RegisterContentTool = (
	server,
	user,
	deps,
) =>
	registerCompanyTool(
		server,
		user,
		deps,
		"create_content",
		{
			title: "Criar card",
			description:
				"Cria um card no kanban, na coluna ideia por padrão. Não usa IA e não consome cota (RN-064). Roteiro escrito pela agência precisa da aprovação do cliente.",
			input: { content: newContentInput.describe("Dados do card") },
		},
		async (actor, input) => {
			const [content] = await createContents(deps, actor, [input.content]);
			if (!content) throw new Error("O card não foi criado.");
			return contentResult("Card criado.", content);
		},
	);
