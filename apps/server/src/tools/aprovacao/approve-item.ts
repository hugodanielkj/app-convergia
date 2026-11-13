import { approveInput, approveItem } from "@convergia/core";
import { registerCompanyTool } from "../company-tool";
import { contentIdInput } from "../conteudo/format";
import type { RegisterApprovalTool } from "./deps";
import { approvalItemResult } from "./format";

export const registerApproveItem: RegisterApprovalTool = (server, user, deps) =>
	registerCompanyTool(
		server,
		user,
		deps,
		"approve_item",
		{
			title: "Aprovar roteiro",
			description:
				user.kind === "agency_member"
					? "Aprova em nome do cliente um roteiro pendente, com motivo obrigatório (ex.: o cliente aprovou por WhatsApp). Fica registrado que foi a agência (RN-214). Informe a versão que o cliente aprovou (veja em get_approval_item)."
					: "Aprova um roteiro que a agência enviou (RN-211). Informe a versão que você revisou (veja em get_approval_item); se a agência mudou o roteiro depois, revise a versão nova.",
			input: {
				...contentIdInput,
				version: approveInput.shape.version,
				on_behalf_reason: approveInput.shape.onBehalfReason,
			},
		},
		async (actor, input) =>
			approvalItemResult(
				"Roteiro aprovado.",
				await approveItem(deps, actor, input.content_id, {
					version: input.version,
					...(input.on_behalf_reason !== undefined && {
						onBehalfReason: input.on_behalf_reason,
					}),
				}),
			),
	);
