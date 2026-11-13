import { z } from "zod";
import type { Content, CreatorKind, Script } from "../conteudo/content";

/**
 * O que passa por aprovação (RN-201): roteiro e ideia; carrossel entra com seu módulo.
 */
export const APPROVAL_ITEM_TYPES = ["script", "idea"] as const;
export type ApprovalItemType = (typeof APPROVAL_ITEM_TYPES)[number];

/** Situação de uma solicitação de aprovação (design §5.3). */
export const APPROVAL_REQUEST_STATUSES = [
	"pending",
	"approved",
	"rejected",
	"cancelled",
] as const;
export type ApprovalRequestStatus = (typeof APPROVAL_REQUEST_STATUSES)[number];

/** ✅ RN-230: tudo o que fica no histórico da aprovação. */
export const APPROVAL_EVENT_TYPES = [
	"submitted",
	"updated_while_pending",
	"cancelled",
	"approved",
	"approved_on_behalf",
	"rejected",
	"approval_lost",
] as const;
export type ApprovalEventType = (typeof APPROVAL_EVENT_TYPES)[number];

/** Um envio para aprovação e a decisão sobre ele (design §5.3). */
export type ApprovalRequest = {
	id: string;
	companyId: string;
	contentId: string;
	itemType: ApprovalItemType;
	/** `content_version` no envio. */
	submittedVersion: number;
	/** `content_version` que o cliente vê agora; muda se a agência edita na pendência (RN-216). */
	itemVersion: number;
	/** Cópia do roteiro na versão `itemVersion`: o que o cliente aprovou ou recusou. */
	snapshot: Script;
	status: ApprovalRequestStatus;
	submittedBy: string;
	submittedAt: Date;
	decidedBy: string | null;
	decidedAt: Date | null;
	/** ✅ RN-214: a agência aprovou em nome do cliente. */
	decidedOnBehalf: boolean;
	/** Motivo da recusa (opcional, RN-212) ou da aprovação em nome do cliente (RN-214). */
	reason: string | null;
};

export type ApprovalEvent = {
	id: string;
	requestId: string;
	contentId: string;
	type: ApprovalEventType;
	actorId: string;
	actorKind: CreatorKind;
	actorName: string | null;
	itemVersion: number;
	reason: string | null;
	at: Date;
};

/** Evento a gravar; o repositório completa a solicitação, a versão e o horário. */
export type ApprovalEventDraft<
	T extends ApprovalEventType = ApprovalEventType,
> = {
	type: T;
	actorId: string;
	actorKind: CreatorKind;
};

/** O card e a solicitação vigente do roteiro dele. */
export type ApprovalItem = {
	content: Content;
	request: ApprovalRequest | null;
};

/** Listas da tela de aprovações e das ferramentas MCP (design §6, "Aprovação"). */
export const APPROVAL_VIEWS = [
	"pending",
	"to_submit",
	"rejected",
	"approved",
] as const;
export type ApprovalView = (typeof APPROVAL_VIEWS)[number];

const version = z
	.number()
	.int()
	.min(1)
	.describe(
		"A versão do roteiro que você revisou (content_version). Se a agência mudou o roteiro depois, a decisão é recusada para você revisar a versão nova",
	);

const reasonText = (max: number) => z.string().trim().min(1).max(max);

/** ✅ RN-211, RN-214. */
export const approveInput = z.object({
	version,
	onBehalfReason: reasonText(500)
		.optional()
		.describe(
			'Só para a agência, obrigatório: por que aprova em nome do cliente (ex.: "cliente aprovou por WhatsApp em 10/11")',
		),
});
export type ApproveInput = z.infer<typeof approveInput>;

/** ✅ RN-212: o motivo da recusa é opcional. */
export const rejectInput = z.object({
	version,
	reason: reasonText(1_000)
		.optional()
		.describe("O que a agência precisa mudar (opcional)"),
});
export type RejectInput = z.infer<typeof rejectInput>;
