import { rejectInput, rejectItem } from "@convergia/core";
import { registerCompanyTool } from "../company-tool";
import { contentIdInput } from "../conteudo/format";
import type { RegisterApprovalTool } from "./deps";
import { approvalItemResult } from "./format";

export const registerRejectItem: RegisterApprovalTool = (server, user, deps) =>
	registerCompanyTool(
		server,
		user,
		deps,
		"reject_item",
		{
			title: "Recusar roteiro",
			description:
				"Recusa um roteiro que a agência enviou; ele volta para a agência ajustar (RN-212). O motivo é opcional, mas ajuda a agência. Informe a versão que você revisou (veja em get_approval_item).",
			input: {
				...contentIdInput,
				version: rejectInput.shape.version,
				reason: rejectInput.shape.reason,
			},
		},
		async (actor, input) =>
			approvalItemResult(
				"Roteiro recusado. A agência vai ajustar.",
				await rejectItem(deps, actor, input.content_id, {
					version: input.version,
					...(input.reason !== undefined && { reason: input.reason }),
				}),
			),
	);
