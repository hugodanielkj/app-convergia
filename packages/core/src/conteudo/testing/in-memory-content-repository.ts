import type {
	ApprovalEvent,
	ApprovalEventDraft,
	ApprovalRequest,
} from "../../aprovacao/approval";
import type { ApprovalStatus, Content } from "../content";
import type {
	ContentChange,
	ContentPatch,
	ContentRepository,
	NewContent,
} from "../ports/content-repository";

/**
 * Dublê do repositório de cards para testes unitários. Guarda também as solicitações e o
 * histórico de aprovação, como o banco faz na mesma transação (ver `InMemoryApprovalRepository`).
 */
export class InMemoryContentRepository implements ContentRepository {
	readonly rows: Content[] = [];
	readonly approvalRequests: ApprovalRequest[] = [];
	readonly approvalEvents: ApprovalEvent[] = [];
	private sequence = 0;

	constructor(private readonly now: () => Date = () => new Date()) {}

	async listActive(
		companyId: string,
		filter: {
			status?: string;
			approvalStatuses?: ApprovalStatus[];
			plannedFrom?: string;
			plannedTo?: string;
		} = {},
	): Promise<Content[]> {
		return this.rows
			.filter(
				(c) =>
					c.companyId === companyId &&
					!c.deletedAt &&
					(!filter.status || c.status === filter.status) &&
					(!filter.approvalStatuses ||
						filter.approvalStatuses.includes(c.approvalStatus)) &&
					(!filter.plannedFrom ||
						(c.plannedDate !== null && c.plannedDate >= filter.plannedFrom)) &&
					(!filter.plannedTo ||
						(c.plannedDate !== null && c.plannedDate <= filter.plannedTo)),
			)
			.sort(
				(a, b) => a.status.localeCompare(b.status) || a.position - b.position,
			)
			.map((c) => structuredClone(c));
	}

	async listDeleted(companyId: string, since: Date): Promise<Content[]> {
		return this.rows
			.filter(
				(c) => c.companyId === companyId && c.deletedAt && c.deletedAt >= since,
			)
			.map((c) => structuredClone(c));
	}

	async find(companyId: string, id: string): Promise<Content | null> {
		const row = this.rows.find((c) => c.companyId === companyId && c.id === id);
		return row ? structuredClone(row) : null;
	}

	async insertMany(
		companyId: string,
		contents: NewContent[],
	): Promise<Content[]> {
		const created = contents.map((content) => {
			this.sequence += 1;
			return {
				...content,
				id: `content-${this.sequence}`,
				companyId,
				currentApprovalRequestId: null,
				deletedAt: null,
				createdAt: this.now(),
				updatedAt: this.now(),
			};
		});
		this.rows.push(...created);
		return created.map((c) => structuredClone(c));
	}

	async update(
		companyId: string,
		id: string,
		patch: ContentPatch,
	): Promise<Content> {
		const row = this.rows.find((c) => c.companyId === companyId && c.id === id);
		if (!row) throw new Error(`Card ${id} não existe.`);
		Object.assign(row, patch, { updatedAt: this.now() });
		return structuredClone(row);
	}

	async applyContentChange(
		companyId: string,
		id: string,
		patch: ContentPatch,
		change: ContentChange,
	): Promise<Content | null> {
		const row = this.rows.find((c) => c.companyId === companyId && c.id === id);
		if (
			!row ||
			row.contentVersion !== change.expect.contentVersion ||
			row.approvalStatus !== change.expect.approvalStatus
		) {
			return null;
		}
		Object.assign(row, patch, { updatedAt: this.now() });
		const request = this.approvalRequests.find(
			(r) => r.id === row.currentApprovalRequestId,
		);
		if (change.approvalEvent && request) {
			if (change.approvalEvent.type === "updated_while_pending") {
				request.itemVersion = row.contentVersion;
				request.snapshot = structuredClone(row.script);
			}
			this.recordEvent(request, change.approvalEvent, null);
		}
		return structuredClone(row);
	}

	/** Usado também pelo `InMemoryApprovalRepository`. */
	recordEvent(
		request: ApprovalRequest,
		event: ApprovalEventDraft,
		reason: string | null,
	): void {
		this.sequence += 1;
		const content = this.rows.find((c) => c.id === request.contentId);
		this.approvalEvents.push({
			id: `event-${this.sequence}`,
			requestId: request.id,
			contentId: request.contentId,
			...event,
			actorName: null,
			itemVersion: content?.contentVersion ?? request.itemVersion,
			reason,
			at: this.now(),
		});
	}
}
