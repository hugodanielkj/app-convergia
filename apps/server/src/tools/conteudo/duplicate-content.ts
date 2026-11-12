import { duplicateContent } from "@convergia/core";
import { registerCompanyTool } from "../company-tool";
import type { RegisterContentTool } from "./deps";
import { contentIdInput, contentResult } from "./format";

export const registerDuplicateContent: RegisterContentTool = (
	server,
	user,
	deps,
) =>
	registerCompanyTool(
		server,
		user,
		deps,
		"duplicate_content",
		{
			title: "Duplicar card",
			description:
				"Copia o conteúdo de um card para um card novo no fim da coluna ideia, sem data planejada (RN-065).",
			input: contentIdInput,
		},
		async (actor, input) =>
			contentResult(
				"Cópia criada.",
				await duplicateContent(deps, actor, input.content_id),
			),
	);
