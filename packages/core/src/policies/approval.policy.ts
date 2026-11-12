import type { ApprovalStatus, CreatorKind } from "../conteudo/content";
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
	/** Evento do histórico de aprovação (RN-230); gravado quando o módulo de aprovação existir. */
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
