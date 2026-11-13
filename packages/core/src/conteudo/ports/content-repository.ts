import type { ApprovalEventDraft } from "../../aprovacao/approval";
import type { ApprovalStatus, Content, KanbanStatus } from "../content";

export type NewContent = Omit<
	Content,
	| "id"
	| "companyId"
	| "currentApprovalRequestId"
	| "deletedAt"
	| "createdAt"
	| "updatedAt"
>;

export type ContentPatch = Partial<
	Omit<
		Content,
		| "id"
		| "companyId"
		| "createdByUserId"
		| "createdByKind"
		| "currentApprovalRequestId"
		| "createdAt"
		| "updatedAt"
	>
>;

/**
 * Mexida no roteiro (RN-203). Só grava se o card ainda está como o caso de uso o leu, para
 * nenhuma decisão do cliente ficar no meio de uma edição da agência (design §9).
 */
export type ContentChange = {
	expect: { contentVersion: number; approvalStatus: ApprovalStatus };
	/**
	 * RN-230: evento no histórico da solicitação vigente, na mesma transação. Em
	 * `updated_while_pending`, a solicitação passa a mostrar a versão nova (RN-216).
	 */
	approvalEvent: ApprovalEventDraft<
		"approval_lost" | "updated_while_pending"
	> | null;
};

/** Toda operação recebe a empresa e só enxerga os cards dela (RN-015). */
export interface ContentRepository {
	/** Cards fora da lixeira, por coluna e posição. */
	listActive(
		companyId: string,
		filter?: {
			status?: KanbanStatus;
			approvalStatuses?: ApprovalStatus[];
			plannedFrom?: string;
			plannedTo?: string;
		},
	): Promise<Content[]>;
	/** Cards excluídos a partir de `since`, os mais recentes primeiro. */
	listDeleted(companyId: string, since: Date): Promise<Content[]>;
	/** O card, mesmo na lixeira. */
	find(companyId: string, id: string): Promise<Content | null>;
	insertMany(companyId: string, contents: NewContent[]): Promise<Content[]>;
	/** Mudanças que não mexem no roteiro: coluna, data, campos editoriais, lixeira. */
	update(companyId: string, id: string, patch: ContentPatch): Promise<Content>;
	/** Mexida no roteiro. `null` quando o card mudou desde a leitura (`change.expect`). */
	applyContentChange(
		companyId: string,
		id: string,
		patch: ContentPatch,
		change: ContentChange,
	): Promise<Content | null>;
}
