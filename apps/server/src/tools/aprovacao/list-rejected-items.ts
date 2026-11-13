import { listApprovalItems } from "@convergia/core";
import { registerCompanyTool } from "../company-tool";
import type { RegisterApprovalTool } from "./deps";
import { approvalListResult } from "./format";

export const registerListRejectedItems: RegisterApprovalTool = (
	server,
	user,
	deps,
) =>
	registerCompanyTool(
		server,
		user,
		deps,
		"list_rejected_items",
		{
			title: "Listar roteiros recusados",
			description:
				"Agência: roteiros que o cliente recusou, com o motivo. Ajuste o roteiro com update_content ou refine_content e envie de novo (RN-213).",
			input: {},
			readOnly: true,
		},
		async (actor) =>
			approvalListResult(
				"Nenhum roteiro recusado.",
				await listApprovalItems(deps, actor, "rejected"),
			),
	);
