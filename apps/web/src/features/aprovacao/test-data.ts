import type { ApprovalItemDto, ContentDto } from "../../api/client";

/** Card e solicitação de exemplo para os testes das telas de aprovação. */
export function approvalItem(
	overrides: {
		content?: Partial<ContentDto>;
		request?: Partial<NonNullable<ApprovalItemDto["request"]>> | null;
	} = {},
): ApprovalItemDto {
	const content = {
		id: "card-1",
		companyId: "c1",
		title: "Reel do lançamento",
		script: { hook: "Gancho da agência", body: null, cta: null, caption: null },
		citations: [],
		contentVersion: 3,
		approvalStatus: "pending",
		currentApprovalRequestId: "req-1",
		updatedAt: "2026-11-13T15:00:00.000Z",
		...overrides.content,
	} as ContentDto;
	const request =
		overrides.request === null
			? null
			: ({
					id: "req-1",
					contentId: content.id,
					submittedVersion: 3,
					itemVersion: 3,
					status: "pending",
					submittedAt: "2026-11-13T15:00:00.000Z",
					decidedAt: null,
					decidedOnBehalf: false,
					reason: null,
					...overrides.request,
				} as NonNullable<ApprovalItemDto["request"]>);
	return { content, request } as ApprovalItemDto;
}
