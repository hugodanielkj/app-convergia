import { listApprovalItems } from "@convergia/core";
import { registerCompanyTool } from "../company-tool";
import type { RegisterApprovalTool } from "./deps";
import { approvalListResult } from "./format";

export const registerListItemsToSubmit: RegisterApprovalTool = (
	server,
	user,
	deps,
) =>
	registerCompanyTool(
		server,
		user,
		deps,
		"list_items_to_submit",
		{
			title: "Listar roteiros para enviar",
			description:
				"Agência: roteiros em preparo, prontos para enviar ao cliente (novos, cancelados, ajustados depois de recusa ou que perderam a aprovação). Os recusados aparecem com o motivo em list_rejected_items.",
			input: {},
			readOnly: true,
		},
		async (actor) =>
			approvalListResult(
				"Nenhum roteiro em preparo.",
				await listApprovalItems(deps, actor, "to_submit"),
			),
	);
