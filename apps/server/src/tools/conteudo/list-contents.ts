import { KANBAN_STATUSES, listContents } from "@convergia/core";
import { z } from "zod";
import { registerCompanyTool } from "../company-tool";
import type { RegisterContentTool } from "./deps";
import { contentListResult } from "./format";

export const registerListContents: RegisterContentTool = (server, user, deps) =>
	registerCompanyTool(
		server,
		user,
		deps,
		"list_contents",
		{
			title: "Listar cards",
			description:
				"Lista os cards da empresa no kanban (ideia, rascunho, editado, publicado), com o ID, a data planejada e o estado de aprovação do roteiro. Não consome cota.",
			input: {
				status: z
					.enum(KANBAN_STATUSES)
					.optional()
					.describe("Filtrar por coluna"),
			},
			readOnly: true,
		},
		async (actor, input) =>
			contentListResult(
				"Nenhum card ainda.",
				await listContents(
					deps,
					actor,
					input.status ? { status: input.status } : {},
				),
			),
	);
