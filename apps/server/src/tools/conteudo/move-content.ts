import { moveContent, moveContentInput } from "@convergia/core";
import { registerCompanyTool } from "../company-tool";
import type { RegisterContentTool } from "./deps";
import { contentIdInput, contentResult } from "./format";

export const registerMoveContent: RegisterContentTool = (server, user, deps) =>
	registerCompanyTool(
		server,
		user,
		deps,
		"move_content",
		{
			title: "Mover card no kanban",
			description:
				"Move o card para outra coluna (idea, draft, edited, published) ou muda a posição dele na coluna. Card com roteiro da agência só vai para published depois de aprovado (RN-061).",
			input: { ...contentIdInput, ...moveContentInput.shape },
		},
		async (actor, { content_id, ...move }) =>
			contentResult(
				"Card movido.",
				await moveContent(deps, actor, content_id, move),
			),
	);
