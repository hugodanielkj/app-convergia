import type { Content, KanbanStatus } from "@convergia/core";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

export const STATUS_LABEL: Record<KanbanStatus, string> = {
	idea: "Ideia",
	draft: "Rascunho",
	edited: "Editado",
	published: "Publicado",
};

const APPROVAL_LABEL: Record<Content["approvalStatus"], string> = {
	none: "não precisa de aprovação",
	in_preparation: "em preparo pela agência",
	pending: "aguardando o cliente",
	approved: "aprovado",
	rejected: "recusado",
};

/** Uma linha por card, para a IA citar o ID nas próximas chamadas. */
export function contentLine(content: Content): string {
	const date = content.plannedDate
		? `, planejado para ${content.plannedDate}`
		: "";
	return `- ${content.title} (ID: ${content.id}) · ${STATUS_LABEL[content.status]}${date} · roteiro ${APPROVAL_LABEL[content.approvalStatus]}`;
}

export function contentResult(
	summary: string,
	content: Content,
): CallToolResult {
	return {
		content: [{ type: "text", text: `${summary}\n${contentLine(content)}` }],
		structuredContent: { content: JSON.parse(JSON.stringify(content)) },
	};
}

export function contentListResult(
	empty: string,
	contents: Content[],
): CallToolResult {
	return {
		content: [
			{
				type: "text",
				text:
					contents.length === 0 ? empty : contents.map(contentLine).join("\n"),
			},
		],
		structuredContent: { contents: JSON.parse(JSON.stringify(contents)) },
	};
}

export const contentIdInput = {
	content_id: z.string().describe("ID do card (veja em list_contents)"),
};
