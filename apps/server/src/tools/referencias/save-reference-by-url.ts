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
				"Salva um link público do Instagram. Depende das cotas ainda não definidas; perfis também dependem do limite de criadores.",
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
