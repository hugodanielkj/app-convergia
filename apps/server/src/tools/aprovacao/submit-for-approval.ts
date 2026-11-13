import { submitForApproval } from "@convergia/core";
import { registerCompanyTool } from "../company-tool";
import { contentIdInput } from "../conteudo/format";
import type { RegisterApprovalTool } from "./deps";
import { approvalItemResult } from "./format";

export const registerSubmitForApproval: RegisterApprovalTool = (
	server,
	user,
	deps,
) =>
	registerCompanyTool(
		server,
		user,
		deps,
		"submit_for_approval",
		{
			title: "Enviar roteiro para aprovação",
			description:
				"Agência: envia o roteiro de um card em preparo para o cliente aprovar (RN-210). Gerar ou editar não envia nada sozinho. Um roteiro recusado precisa ser ajustado antes de ir de novo.",
			input: contentIdInput,
		},
		async (actor, input) =>
			approvalItemResult(
				"Roteiro enviado para aprovação do cliente.",
				await submitForApproval(deps, actor, input.content_id),
			),
	);
