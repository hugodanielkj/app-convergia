import type { InMemoryContentRepository } from "../../conteudo/testing/in-memory-content-repository";
import type { ApprovalEvent, ApprovalRequest } from "../approval";
import type { ApprovalRepository } from "../ports/approval-repository";

/** Dublê do repositório de aprovações. Divide os dados com o repositório de cards. */
export class InMemoryApprovalRepository implements ApprovalRepository {
	private sequence = 0;

	constructor(private readonly contents: InMemoryContentRepository) {}

	async submit(
		companyId: string,
		input: Parameters<ApprovalRepository["submit"]>[1],
	): Promise<ApprovalRequest | null> {
		const content = this.contents.rows.find(
			(c) => c.companyId === companyId && c.id === input.contentId,
		);
		if (
			!content ||
			content.deletedAt ||
			content.contentVersion !== input.expect.contentVersion ||
			content.approvalStatus !== input.expect.approvalStatus
		) {
			return null;
		}
		this.sequence += 1;
		const request: ApprovalRequest = {
			id: `request-${this.sequence}`,
			companyId,
			contentId: content.id,
			itemType: "script",
			submittedVersion: content.contentVersion,
			itemVersion: content.contentVersion,
			snapshot: structuredClone(input.snapshot),
			status: "pending",
			submittedBy: input.event.actorId,
			submittedAt: input.at,
			decidedBy: null,
			decidedAt: null,
			decidedOnBehalf: false,
			reason: null,
		};
		this.contents.approvalRequests.push(request);
		content.approvalStatus = "pending";
		content.currentApprovalRequestId = request.id;
		this.contents.recordEvent(request, input.event, null);
		return structuredClone(request);
	}

	async decide(
		companyId: string,
		input: Parameters<ApprovalRepository["decide"]>[1],
	): Promise<ApprovalRequest | null> {
		const content = this.contents.rows.find(
			(c) => c.companyId === companyId && c.id === input.contentId,
		);
		const request = this.contents.approvalRequests.find(
			(r) => r.companyId === companyId && r.id === input.requestId,
		);
		if (
			!content ||
			!request ||
			request.status !== "pending" ||
			content.approvalStatus !== "pending" ||
			content.currentApprovalRequestId !== request.id ||
			(input.expectVersion !== null &&
				content.contentVersion !== input.expectVersion)
		) {
			return null;
		}
		Object.assign(request, {
			status: input.outcome,
			decidedBy: input.event.actorId,
			decidedAt: input.at,
			decidedOnBehalf: input.onBehalf,
			reason: input.reason,
		});
		content.approvalStatus = input.contentStatus;
		this.contents.recordEvent(request, input.event, input.reason);
		return structuredClone(request);
	}

	async findMany(companyId: string, ids: string[]): Promise<ApprovalRequest[]> {
		return this.contents.approvalRequests
			.filter((r) => r.companyId === companyId && ids.includes(r.id))
			.map((r) => structuredClone(r));
	}

	async listEvents(
		companyId: string,
		contentId: string,
	): Promise<ApprovalEvent[]> {
		const ids = new Set(
			this.contents.approvalRequests
				.filter((r) => r.companyId === companyId)
				.map((r) => r.id),
		);
		return this.contents.approvalEvents
			.filter((e) => e.contentId === contentId && ids.has(e.requestId))
			.map((e) => structuredClone(e));
	}
}
