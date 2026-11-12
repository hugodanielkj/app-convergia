import {
	deleteContent,
	listDeletedContents,
	restoreContent,
} from "@convergia/core";
import { registerCompanyTool } from "../company-tool";
import type { RegisterContentTool } from "./deps";
import { contentIdInput, contentListResult, contentResult } from "./format";

export const registerTrashTools: RegisterContentTool = (server, user, deps) => {
	registerCompanyTool(
		server,
		user,
		deps,
		"delete_content",
		{
			title: "Excluir card",
			description:
				"Manda o card para a lixeira, de onde pode ser restaurado por 30 dias (RN-069). O cliente só exclui os cards que criou (RN-018).",
			input: contentIdInput,
		},
		async (actor, input) =>
			contentResult(
				"Card enviado para a lixeira. Dá para restaurar por 30 dias.",
				await deleteContent(deps, actor, input.content_id),
			),
	);
	registerCompanyTool(
		server,
		user,
		deps,
		"list_deleted_contents",
		{
			title: "Lixeira",
			description:
				"Lista os cards excluídos nos últimos 30 dias, que ainda podem ser restaurados.",
			input: {},
			readOnly: true,
		},
		async (actor) =>
			contentListResult(
				"A lixeira está vazia.",
				await listDeletedContents(deps, actor),
			),
	);
	registerCompanyTool(
		server,
		user,
		deps,
		"restore_content",
		{
			title: "Restaurar card",
			description:
				"Tira um card da lixeira, se ele foi excluído há até 30 dias (RN-069).",
			input: contentIdInput,
		},
		async (actor, input) =>
			contentResult(
				"Card restaurado.",
				await restoreContent(deps, actor, input.content_id),
			),
	);
};
