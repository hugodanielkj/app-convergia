import type { Content, KanbanStatus } from "../content";

export type NewContent = Omit<
	Content,
	"id" | "companyId" | "deletedAt" | "createdAt" | "updatedAt"
>;

export type ContentPatch = Partial<
	Omit<
		Content,
		| "id"
		| "companyId"
		| "createdByUserId"
		| "createdByKind"
		| "createdAt"
		| "updatedAt"
	>
>;

/** Toda operação recebe a empresa e só enxerga os cards dela (RN-015). */
export interface ContentRepository {
	/** Cards fora da lixeira, por coluna e posição. */
	listActive(
		companyId: string,
		filter?: {
			status?: KanbanStatus;
			plannedFrom?: string;
			plannedTo?: string;
		},
	): Promise<Content[]>;
	/** Cards excluídos a partir de `since`, os mais recentes primeiro. */
	listDeleted(companyId: string, since: Date): Promise<Content[]>;
	/** O card, mesmo na lixeira. */
	find(companyId: string, id: string): Promise<Content | null>;
	insertMany(companyId: string, contents: NewContent[]): Promise<Content[]>;
	update(companyId: string, id: string, patch: ContentPatch): Promise<Content>;
}
