import {
	HISTORY_LIMIT,
	type HistoryEntry,
	listContentGenerations,
} from "@convergia/core";
import { registerCompanyTool } from "../company-tool";
import { contentIdInput } from "../conteudo/format";
import type { RegisterScriptTool } from "./deps";
import { scriptText } from "./format";

const FIELD_LABEL = {
	hook: "gancho",
	body: "corpo",
	cta: "CTA",
	caption: "legenda",
} as const;

function entryText(entry: HistoryEntry): string {
	const who = entry.createdByKind === "agency" ? "agência" : "cliente";
	const when = entry.createdAt.toISOString();
	if (entry.kind === "script") {
		return `Roteiro completo (${who}, ${when}):\n${scriptText(entry.script)}`;
	}
	const options = entry.options
		.map((option, i) => `${i + 1}. ${option}`)
		.join("\n");
	return `Opções de ${FIELD_LABEL[entry.field]} (${who}, ${when}):\n${options}`;
}

export const registerListContentGenerations: RegisterScriptTool = (
	server,
	user,
	deps,
) =>
	registerCompanyTool(
		server,
		user,
		deps,
		"list_content_generations",
		{
			title: "Ver histórico de gerações",
			description: `Mostra as últimas ${HISTORY_LIMIT} gerações de IA de um card, das mais novas para as mais antigas: roteiros completos e opções avulsas de gancho, corpo, CTA ou legenda, com quem gerou e quando. Não consome cota.`,
			input: contentIdInput,
			readOnly: true,
		},
		async (actor, input) => {
			const entries = await listContentGenerations(
				deps,
				actor,
				input.content_id,
			);
			return {
				content: [
					{
						type: "text",
						text:
							entries.length === 0
								? "Este card ainda não tem gerações de IA."
								: entries.map(entryText).join("\n\n"),
					},
				],
				structuredContent: { entries: JSON.parse(JSON.stringify(entries)) },
			};
		},
	);
