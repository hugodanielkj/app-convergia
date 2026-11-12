import type { Content, KanbanStatus } from "../conteudo/content";
import type { ActorContext } from "../shared/actor-context";
import { DomainError } from "../shared/domain-error";

/** RN-069: por quanto tempo um card excluído pode ser restaurado. */
export const TRASH_RETENTION_DAYS = 30;

/**
 * RN-061: coluna e aprovação são independentes, exceto que um card cujo roteiro passou
 * pela agência só vai para `published` com o roteiro aprovado.
 */
export function assertCanMoveTo(content: Content, status: KanbanStatus): void {
	if (
		status === "published" &&
		content.approvalStatus !== "none" &&
		content.approvalStatus !== "approved"
	) {
		throw new DomainError(
			"publish_without_approval",
			"Este card só pode ir para publicado depois que o cliente aprovar o roteiro.",
		);
	}
}

/** RN-018: a agência exclui qualquer card; o cliente, só os que criou. Vale também para restaurar. */
export function assertCanDelete(actor: ActorContext, content: Content): void {
	if (actor.kind === "client_user" && content.createdByKind === "agency") {
		throw new DomainError(
			"delete_agency_content",
			"Só a agência pode excluir um card criado por ela.",
		);
	}
}

export function trashCutoff(now: Date): Date {
	return new Date(now.getTime() - TRASH_RETENTION_DAYS * 86_400_000);
}
