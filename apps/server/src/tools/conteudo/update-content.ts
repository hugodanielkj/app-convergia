import { contentUpdateInput, updateContent } from "@convergia/core";
import { registerCompanyTool } from "../company-tool";
import type { RegisterContentTool } from "./deps";
import { contentIdInput, contentResult } from "./format";

export const registerUpdateContent: RegisterContentTool = (
	server,
	user,
	deps,
) =>
	registerCompanyTool(
		server,
		user,
		deps,
		"update_content",
		{
			title: "Editar card",
			description:
				"Edita os campos de um card. Envie só o que muda; null apaga o campo. Se a agência mudar o roteiro, ele passa a precisar da aprovação do cliente (RN-203). Coluna e data têm ferramentas próprias.",
			input: {
				...contentIdInput,
				changes: contentUpdateInput.describe("Campos a mudar"),
			},
		},
		async (actor, input) =>
			contentResult(
				"Card atualizado.",
				await updateContent(deps, actor, input.content_id, input.changes),
			),
	);
