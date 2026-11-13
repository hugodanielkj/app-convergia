import { createContentSourceUpload } from "@convergia/core";
import { z } from "zod";
import { registerCompanyTool } from "../company-tool";
import type { RegisterKnowledgeTool } from "./deps";
export const registerCreateContentSourceUpload: RegisterKnowledgeTool = (
	server,
	user,
	deps,
) =>
	registerCompanyTool(
		server,
		user,
		deps,
		"create_content_source_upload",
		{
			title: "Enviar PDF",
			description:
				"Enviar PDF. Depende da definição da cota diária (Q-21); nenhuma extração nem upload ocorre enquanto ela estiver em aberto.",
			input: {
				content_id: z.string().describe("ID do card"),
				size: z
					.number()
					.int()
					.positive()
					.max(10485760)
					.describe("Tamanho do PDF em bytes"),
				name: z.string().trim().min(1).max(200).describe("Nome do PDF"),
			},
		},
		async (actor, input) => {
			await createContentSourceUpload(deps, actor, input.content_id);
			return { content: [{ type: "text", text: "Concluído." }] };
		},
	);
