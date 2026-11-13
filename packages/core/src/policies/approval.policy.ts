import { notPending } from "../aprovacao/errors";
import type { ApprovalStatus, Content, CreatorKind } from "../conteudo/content";
import { SCRIPT_FIELDS } from "../conteudo/content";
import type { ActorContext } from "../shared/actor-context";
import { DomainError, NotDecidedYet } from "../shared/domain-error";

export function creatorKind(actor: ActorContext): CreatorKind {
	return actor.kind === "agency_member" ? "agency" : "client";
}

/** Estado inicial: o cliente cria sem aprovação (RN-204); a agência cria em preparo (§5.4). */
export function initialApprovalStatus(actor: ActorContext): ApprovalStatus {
	return actor.kind === "agency_member" ? "in_preparation" : "none";
}

/**
 * Quem pode mexer no conteúdo aprovável (o roteiro). Chamado antes de `onContentChanged`.
 * A agência sempre pode (RN-203). O cliente edita livremente só o que é só dele.
 */
export function assertCanEditContent(
	actor: ActorContext,
	status: ApprovalStatus,
): void {
	if (actor.kind === "agency_member" || status === "none") {
		return;
	}
	if (status === "pending") {
		// RN-217: o cliente só aprova ou recusa o que a agência enviou.
		throw new DomainError(
			"edit_pending_item",
			"Este item foi enviado pela agência. Aprove ou recuse com um comentário.",
		);
	}
	// RN-222: o cliente edita o próprio card depois que a agência mexeu nele?
	throw new NotDecidedYet("Q-26");
}

export type ContentChangeEffect = {
	approvalStatus: ApprovalStatus;
	/** Evento do histórico de aprovação (RN-230), gravado na mesma transação da mexida. */
	event: "approval_lost" | "updated_while_pending" | null;
};

/** Chamado em toda escrita de conteúdo, depois de `assertCanEditContent` (design §5.3). */
export function onContentChanged(
	actor: ActorContext,
	status: ApprovalStatus,
): ContentChangeEffect {
	if (actor.kind === "client_user") {
		return { approvalStatus: status, event: null };
	}
	switch (status) {
		case "pending":
			// RN-216: a pendência continua e passa a mostrar a versão nova.
			return { approvalStatus: "pending", event: "updated_while_pending" };
		case "approved":
			// RN-215: mexer em item aprovado faz perder a aprovação.
			return { approvalStatus: "in_preparation", event: "approval_lost" };
		default:
			// RN-203, RN-213: qualquer mexida da agência leva para em preparo.
			return { approvalStatus: "in_preparation", event: null };
	}
}

/**
 * ❓ RN-231 (Q-23): se o cliente vê o trabalho da agência no histórico do card ainda está em
 * aberto. A agência vê tudo; o cliente vê o histórico só enquanto ele não tem nada da agência.
 */
export function assertCanSeeHistory(
	actor: ActorContext,
	entries: { createdByKind: CreatorKind }[],
): void {
	if (
		actor.kind === "client_user" &&
		entries.some((entry) => entry.createdByKind === "agency")
	) {
		throw new NotDecidedYet("Q-23");
	}
}

/** RN-210: só a agência envia, e só o roteiro em preparo. */
export function assertCanSubmit(actor: ActorContext, content: Content): void {
	if (actor.kind === "client_user") {
		// RN-200: o que o cliente cria não precisa de aprovação.
		throw new DomainError(
			"client_submit",
			"Itens criados por você não precisam de aprovação.",
		);
	}
	switch (content.approvalStatus) {
		case "none":
			// RN-204: a agência ainda não mexeu no roteiro.
			throw new DomainError(
				"nothing_to_approve",
				"Este roteiro não precisa de aprovação: a agência ainda não mexeu nele.",
			);
		case "pending":
			throw new DomainError(
				"already_pending",
				"Este item já está aguardando aprovação.",
			);
		case "approved":
			throw new DomainError(
				"already_approved",
				"Este roteiro já foi aprovado.",
			);
		case "rejected":
			// RN-213: recusado volta para a agência ajustar; o ajuste o leva para em preparo.
			throw new DomainError(
				"rejected_unchanged",
				"Ajuste o roteiro recusado antes de enviar de novo.",
			);
	}
	if (SCRIPT_FIELDS.every((field) => !content.script[field])) {
		throw new DomainError(
			"empty_script",
			"Escreva ou gere o roteiro antes de enviar para aprovação.",
		);
	}
}

/** RN-218: só a agência cancela um envio pendente. */
export function assertCanCancel(actor: ActorContext, content: Content): void {
	if (actor.kind === "client_user") {
		throw new DomainError(
			"client_cancel",
			"Só a agência pode cancelar um envio para aprovação.",
		);
	}
	assertPending(content);
}

/**
 * RN-211: o cliente aprova. RN-214: a agência aprova em nome dele só com motivo, e isso fica
 * registrado.
 */
export function approvalDecision(
	actor: ActorContext,
	content: Content,
	onBehalfReason: string | undefined,
): { onBehalf: boolean; reason: string | null } {
	assertPending(content);
	if (actor.kind === "client_user") {
		return { onBehalf: false, reason: null };
	}
	if (!onBehalfReason) {
		throw new DomainError(
			"on_behalf_reason_required",
			"Informe o motivo da aprovação em nome do cliente (ex.: aprovado por WhatsApp em 10/11).",
		);
	}
	return { onBehalf: true, reason: onBehalfReason };
}

/** RN-212, RN-214: só o cliente recusa. */
export function assertCanReject(actor: ActorContext, content: Content): void {
	if (actor.kind === "agency_member") {
		throw new DomainError("agency_reject", "Só o cliente pode recusar.");
	}
	assertPending(content);
}

function assertPending(content: Content): void {
	if (
		content.approvalStatus !== "pending" ||
		!content.currentApprovalRequestId
	) {
		throw notPending();
	}
}
