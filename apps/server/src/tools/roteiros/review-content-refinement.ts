import { PREVIEW_DECISIONS, reviewContentRefinement } from "@convergia/core";
import { z } from "zod";
import { registerCompanyTool } from "../company-tool";
import { contentIdInput, contentResult } from "../conteudo/format";
import type { RegisterScriptTool } from "./deps";
import { citationsText } from "./format";

export const registerReviewContentRefinement: RegisterScriptTool = (
	server,
	user,
	deps,
) =>
	registerCompanyTool(
		server,
		user,
		deps,
		"review_content_refinement",
		{
			title: "Aplicar ou descartar prévia",
			description:
				"Aplica no card a prévia proposta pelo refino, ou a descarta. Não chama a IA nem consome cota. Aplicar é recusado se o card mudou depois da prévia (RN-074) e soma as fontes da prévia às citações do card, sem apagar nenhuma (RN-075).",
			input: {
				...contentIdInput,
				message_id: z
					.string()
					.describe(
						"ID da resposta da IA com a prévia (veja em get_refine_chat)",
					),
				decision: z
					.enum(PREVIEW_DECISIONS)
					.describe("apply aplica a prévia no card; discard descarta"),
			},
		},
		async (actor, input) => {
			const { content } = await reviewContentRefinement(
				deps,
				actor,
				input.content_id,
				input.message_id,
				input.decision,
			);
			return contentResult(
				input.decision === "apply"
					? `Prévia aplicada no card.${citationsText("Citações do card", content.citations)}`
					: "Prévia descartada.",
				content,
			);
		},
	);
