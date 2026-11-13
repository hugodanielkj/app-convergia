import { getApprovalItem } from "@convergia/core";
import { registerCompanyTool } from "../company-tool";
import { contentIdInput } from "../conteudo/format";
import type { RegisterApprovalTool } from "./deps";
import { historyLines } from "./format";

export const registerGetApprovalHistory: RegisterApprovalTool = (
	server,
	user,
	deps,
) =>
	registerCompanyTool(
		server,
		user,
		deps,
		"get_approval_history",
		{
			title: "Histórico de aprovação",
			description:
				"Envios, edições durante a pendência, cancelamentos, decisões (com quem decidiu e o motivo) e perdas de aprovação do roteiro de um card (RN-230).",
			input: contentIdInput,
			readOnly: true,
		},
		async (actor, input) => {
			const { history } = await getApprovalItem(deps, actor, input.content_id);
			return {
				content: [{ type: "text", text: historyLines(history) }],
				structuredContent: { history: JSON.parse(JSON.stringify(history)) },
			};
		},
	);
