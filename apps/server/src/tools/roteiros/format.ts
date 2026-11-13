import type { RefineMessage, Script } from "@convergia/core";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

const PREVIEW_LABEL = {
	pending: "prévia pendente",
	applied: "prévia aplicada",
	discarded: "prévia descartada",
} as const;

export function scriptText(script: Script): string {
	return [
		`Gancho: ${script.hook ?? "—"}`,
		`Corpo: ${script.body ?? "—"}`,
		`CTA: ${script.cta ?? "—"}`,
		`Legenda: ${script.caption ?? "—"}`,
	].join("\n");
}

function messageText(message: RefineMessage): string {
	if (message.role === "user") return `Pedido: ${message.text}`;
	const status = message.previewStatus
		? ` (${PREVIEW_LABEL[message.previewStatus]}, ID: ${message.id})`
		: "";
	const preview = message.preview ? `\n${scriptText(message.preview)}` : "";
	return `IA${status}: ${message.text}${preview}`;
}

export function refineMessagesResult(
	empty: string,
	messages: RefineMessage[],
): CallToolResult {
	return {
		content: [
			{
				type: "text",
				text:
					messages.length === 0
						? empty
						: messages.map(messageText).join("\n\n"),
			},
		],
		structuredContent: { messages: JSON.parse(JSON.stringify(messages)) },
	};
}
