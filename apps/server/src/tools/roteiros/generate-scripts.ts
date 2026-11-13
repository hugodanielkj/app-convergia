import { generateScripts, MAX_SCRIPTS_PER_CALL } from "@convergia/core";
import { z } from "zod";
import { registerCompanyTool } from "../company-tool";
import { contentLine } from "../conteudo/format";
import type { RegisterScriptTool } from "./deps";
import { scriptText } from "./format";

export const registerGenerateScripts: RegisterScriptTool = (
	server,
	user,
	deps,
) =>
	registerCompanyTool(
		server,
		user,
		deps,
		"generate_scripts",
		{
			title: "Gerar roteiros",
			description: `Escreve o roteiro completo (gancho, corpo, CTA e legenda) de 1 a ${MAX_SCRIPTS_PER_CALL} cards e grava no card, substituindo o roteiro atual. A IA usa o título, a ideia e os campos do card. Consome uma unidade da cota diária "gerar roteiro" da empresa por chamada. Roteiro gerado pela agência precisa da aprovação do cliente (RN-203).`,
			input: {
				content_ids: z
					.array(z.string())
					.min(1)
					.max(MAX_SCRIPTS_PER_CALL)
					.describe("IDs dos cards (veja em list_contents)"),
			},
		},
		async (actor, input) => {
			const contents = await generateScripts(deps, actor, input.content_ids);
			return {
				content: [
					{
						type: "text",
						text: contents
							.map((c) => `${contentLine(c)}\n${scriptText(c.script)}`)
							.join("\n\n"),
					},
				],
				structuredContent: { contents: JSON.parse(JSON.stringify(contents)) },
			};
		},
	);
