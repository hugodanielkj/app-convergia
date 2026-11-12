import { getContent } from "@convergia/core";
import { registerCompanyTool } from "../company-tool";
import type { RegisterContentTool } from "./deps";
import { contentIdInput, contentResult } from "./format";

export const registerGetContent: RegisterContentTool = (server, user, deps) =>
	registerCompanyTool(
		server,
		user,
		deps,
		"get_content",
		{
			title: "Ver card",
			description:
				"Mostra um card completo: ideia, roteiro (gancho, corpo, CTA, legenda), formato, data planejada e estado de aprovação. Não consome cota.",
			input: contentIdInput,
			readOnly: true,
		},
		async (actor, input) =>
			contentResult("Card:", await getContent(deps, actor, input.content_id)),
	);
