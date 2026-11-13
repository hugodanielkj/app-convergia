import { listApprovalItems } from "@convergia/core";
import { registerCompanyTool } from "../company-tool";
import type { RegisterApprovalTool } from "./deps";
import { approvalListResult } from "./format";

export const registerListPendingApprovals: RegisterApprovalTool = (
	server,
	user,
	deps,
) =>
	registerCompanyTool(
		server,
		user,
		deps,
		"list_pending_approvals",
		{
			title: "Listar aprovações pendentes",
			description:
				user.kind === "agency_member"
					? "Roteiros desta empresa enviados e aguardando o cliente, do mais antigo para o mais novo."
					: "Roteiros que a agência enviou e esperam a sua aprovação, do mais antigo para o mais novo.",
			input: {},
			readOnly: true,
		},
		async (actor) =>
			approvalListResult(
				"Nenhum roteiro aguardando aprovação.",
				await listApprovalItems(deps, actor, "pending"),
			),
	);
