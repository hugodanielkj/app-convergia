import {
	generateScriptOptions,
	MAX_OPTIONS_PER_CALL,
	type ScriptField,
	scriptOptionsInput,
} from "@convergia/core";
import { z } from "zod";
import { registerCompanyTool } from "../company-tool";
import type { RegisterScriptTool } from "./deps";

const FIELD_LABEL: Record<ScriptField, { name: string; plural: string }> = {
	hook: { name: "gancho", plural: "ganchos" },
	body: { name: "corpo", plural: "corpos" },
	cta: { name: "CTA", plural: "CTAs" },
	caption: { name: "legenda", plural: "legendas" },
};

/**
 * `generate_hook_options`, `generate_body_options`, `generate_cta_options` e
 * `generate_caption_options` (📎 RN-071): o mesmo caso de uso, uma ferramenta por parte.
 */
function optionsTool(field: ScriptField): RegisterScriptTool {
	const { name, plural } = FIELD_LABEL[field];
	return (server, user, deps) =>
		registerCompanyTool(
			server,
			user,
			deps,
			`generate_${field}_options`,
			{
				title: `Sugerir opções de ${name}`,
				description: `Sugere até ${MAX_OPTIONS_PER_CALL} ${plural} diferentes para o roteiro de um card, sem alterar o card. Para usar uma opção, grave-a no card com update_content. Consome a cota diária "opções de ${name}" da empresa.`,
				input: {
					content_id: z.string().describe("ID do card (veja em list_contents)"),
					count: scriptOptionsInput.shape.count,
				},
			},
			async (actor, input) => {
				const result = await generateScriptOptions(
					deps,
					actor,
					input.content_id,
					field,
					input.count,
				);
				return {
					content: [
						{
							type: "text",
							text: result.options
								.map((option, i) => `Opção ${i + 1}: ${option}`)
								.join("\n\n"),
						},
					],
					structuredContent: result,
				};
			},
		);
}

export const registerScriptOptionTools: RegisterScriptTool[] = [
	optionsTool("hook"),
	optionsTool("body"),
	optionsTool("cta"),
	optionsTool("caption"),
];
