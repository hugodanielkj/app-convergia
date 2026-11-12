import {
	createContents,
	MAX_BULK_CONTENTS,
	newContentInput,
} from "@convergia/core";
import { z } from "zod";
import { registerCompanyTool } from "../company-tool";
import type { RegisterContentTool } from "./deps";
import { contentListResult } from "./format";

export const registerBulkCreateContents: RegisterContentTool = (
	server,
	user,
	deps,
) =>
	registerCompanyTool(
		server,
		user,
		deps,
		"bulk_create_contents",
		{
			title: "Criar vários cards",
			description: `Cria de 1 a ${MAX_BULK_CONTENTS} cards de uma vez, por exemplo para planejar a semana. Não usa IA e não consome cota (RN-064).`,
			input: {
				contents: z
					.array(newContentInput)
					.describe(`De 1 a ${MAX_BULK_CONTENTS} cards`),
			},
		},
		async (actor, input) =>
			contentListResult(
				"Nenhum card criado.",
				await createContents(deps, actor, input.contents),
			),
	);
