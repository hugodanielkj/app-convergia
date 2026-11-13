import type {
	ApprovalDetail,
	ApprovalEvent,
	ApprovalItem,
	Script,
} from "@convergia/core";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { contentLine } from "../conteudo/format";

const EVENT_LABEL: Record<ApprovalEvent["type"], string> = {
	submitted: "enviado para aprovação",
	updated_while_pending: "roteiro atualizado pela agência durante a pendência",
	cancelled: "envio cancelado pela agência",
	approved: "aprovado pelo cliente",
	approved_on_behalf: "aprovado pela agência em nome do cliente",
	rejected: "recusado pelo cliente",
	approval_lost: "perdeu a aprovação: a agência mexeu no roteiro",
};

const SCRIPT_LABEL: Record<keyof Script, string> = {
	hook: "Gancho",
	body: "Corpo",
	cta: "CTA",
	caption: "Legenda",
};

function json(value: unknown) {
	return JSON.parse(JSON.stringify(value));
}

function itemLine({ content, request }: ApprovalItem): string {
	const reason = request?.reason ? ` · motivo: ${request.reason}` : "";
	return `${contentLine(content)} · versão ${content.contentVersion}${reason}`;
}

export function approvalItemResult(
	summary: string,
	item: ApprovalItem,
): CallToolResult {
	return {
		content: [{ type: "text", text: `${summary}\n${itemLine(item)}` }],
		structuredContent: json(item),
	};
}

export function approvalListResult(
	empty: string,
	items: ApprovalItem[],
): CallToolResult {
	return {
		content: [
			{
				type: "text",
				text: items.length === 0 ? empty : items.map(itemLine).join("\n"),
			},
		],
		structuredContent: { items: json(items) },
	};
}

export function historyLines(history: ApprovalEvent[]): string {
	if (history.length === 0) return "Ainda não há histórico de aprovação.";
	return history
		.map((event) => {
			const who = event.actorName ? ` por ${event.actorName}` : "";
			const reason = event.reason ? ` · motivo: ${event.reason}` : "";
			return `- ${event.at.toISOString()}: ${EVENT_LABEL[event.type]}${who} (versão ${event.itemVersion})${reason}`;
		})
		.join("\n");
}

/** O roteiro que o cliente vê e se mudou depois do envio (RN-216). */
export function approvalDetailResult(detail: ApprovalDetail): CallToolResult {
	const { content, changedSinceSubmit } = detail;
	const script = (Object.keys(SCRIPT_LABEL) as (keyof Script)[])
		.map((field) => `${SCRIPT_LABEL[field]}: ${content.script[field] ?? "—"}`)
		.join("\n");
	const changed = changedSinceSubmit
		? "\nA agência mudou o roteiro depois de enviar; esta é a versão atual."
		: "";
	return {
		content: [
			{
				type: "text",
				text: `${itemLine(detail)}${changed}\n\n${script}\n\nHistórico:\n${historyLines(detail.history)}`,
			},
		],
		structuredContent: json(detail),
	};
}
