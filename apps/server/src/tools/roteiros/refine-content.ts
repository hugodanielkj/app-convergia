import { refineContent, refineContentInput } from "@convergia/core";
import { registerCompanyTool } from "../company-tool";
import { contentIdInput } from "../conteudo/format";
import type { RegisterScriptTool } from "./deps";
import { refineMessagesResult } from "./format";

export const registerRefineContent: RegisterScriptTool = (server, user, deps) =>
	registerCompanyTool(
		server,
		user,
		deps,
		"refine_content",
		{
			title: "Refinar roteiro",
			description:
				'Conversa com a IA para ajustar o roteiro de um card. Gera uma prévia e NÃO altera o roteiro: depois aplique ou descarte com review_content_refinement. Com web_search, a IA pesquisa na web e devolve as fontes usadas; ao aplicar, elas se somam às citações do card, sem apagar as que já existem. Consome uma unidade da cota diária "refinar roteiro" da empresa.',
			input: {
				...contentIdInput,
				message: refineContentInput.shape.message,
				web_search: refineContentInput.shape.webSearch,
			},
		},
		async (actor, input) =>
			refineMessagesResult(
				"",
				await refineContent(deps, actor, input.content_id, input.message, {
					webSearch: input.web_search,
				}),
			),
	);
