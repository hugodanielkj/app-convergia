import { getApprovalItem } from "@convergia/core";
import { registerCompanyTool } from "../company-tool";
import { contentIdInput } from "../conteudo/format";
import type { RegisterApprovalTool } from "./deps";
import { approvalDetailResult } from "./format";

export const registerGetApprovalItem: RegisterApprovalTool = (
	server,
	user,
	deps,
) =>
	registerCompanyTool(
		server,
		user,
		deps,
		"get_approval_item",
		{
			title: "Ver roteiro em aprovação",
			description:
				"Mostra o roteiro atual de um card, a versão, o estado da aprovação, se a agência mudou o roteiro depois de enviar (RN-216) e o histórico.",
			input: contentIdInput,
			readOnly: true,
		},
		async (actor, input) =>
			approvalDetailResult(
				await getApprovalItem(deps, actor, input.content_id),
			),
	);
