import { referenceInput, saveReferenceByUrl } from "@convergia/core";

import { registerCompanyTool } from "../company-tool";
import type { RegisterKnowledgeTool } from "./deps";
export const registerSaveReferenceByUrl: RegisterKnowledgeTool = (
	server,
	user,
	deps,
) =>
	registerCompanyTool(
		server,
		user,
		deps,
		"save_reference_by_url",
		{
			title: "Salvar referência",
			description:
				"Salva post ou perfil público do Instagram em segundo plano. Até 3 novas coletas por empresa/dia e 1 criador salvo. Devolve o ID; acompanhe com list_saved_references. Uma referência já pronta é reutilizada sem cota.",
			input: referenceInput.shape,
			readOnly: false,
		},
		async (actor, input) => {
			const result = await saveReferenceByUrl(deps, actor, input);
			return {
				content: [
					{ type: "text", text: JSON.stringify(result ?? { ok: true }) },
				],
				structuredContent: {
					result: JSON.parse(JSON.stringify(result ?? { ok: true })),
				},
			};
		},
	);
