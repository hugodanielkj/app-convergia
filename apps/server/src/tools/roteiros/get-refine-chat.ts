import { getRefineChat } from "@convergia/core";
import { registerCompanyTool } from "../company-tool";
import { contentIdInput } from "../conteudo/format";
import type { RegisterScriptTool } from "./deps";
import { refineMessagesResult } from "./format";

export const registerGetRefineChat: RegisterScriptTool = (server, user, deps) =>
	registerCompanyTool(
		server,
		user,
		deps,
		"get_refine_chat",
		{
			title: "Ver conversa de refino",
			description:
				"Mostra as últimas mensagens do refino do roteiro de um card, com as prévias propostas e o estado de cada uma (pendente, aplicada ou descartada).",
			input: contentIdInput,
			readOnly: true,
		},
		async (actor, input) =>
			refineMessagesResult(
				"Ainda não há conversa de refino neste card.",
				await getRefineChat(deps, actor, input.content_id),
			),
	);
