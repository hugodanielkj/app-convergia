import { cancelApprovalRequest } from "@convergia/core";
import { registerCompanyTool } from "../company-tool";
import { contentIdInput } from "../conteudo/format";
import type { RegisterApprovalTool } from "./deps";
import { approvalItemResult } from "./format";

export const registerCancelApprovalRequest: RegisterApprovalTool = (
	server,
	user,
	deps,
) =>
	registerCompanyTool(
		server,
		user,
		deps,
		"cancel_approval_request",
		{
			title: "Cancelar envio para aprovação",
			description:
				"Agência: cancela o envio pendente; o roteiro volta para em preparo como se não tivesse sido enviado (RN-218).",
			input: contentIdInput,
		},
		async (actor, input) =>
			approvalItemResult(
				"Envio cancelado. O roteiro voltou para em preparo.",
				await cancelApprovalRequest(deps, actor, input.content_id),
			),
	);
