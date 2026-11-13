import { registerApproveItem } from "./approve-item";
import { registerCancelApprovalRequest } from "./cancel-approval-request";
import type { RegisterApprovalTool } from "./deps";
import { registerGetApprovalHistory } from "./get-approval-history";
import { registerGetApprovalItem } from "./get-approval-item";
import { registerListItemsToSubmit } from "./list-items-to-submit";
import { registerListPendingApprovals } from "./list-pending-approvals";
import { registerListRejectedItems } from "./list-rejected-items";
import { registerRejectItem } from "./reject-item";
import { registerSubmitForApproval } from "./submit-for-approval";

/**
 * Ferramentas de aprovação (design §6, "Aprovação"). Cada lado só vê o que pode fazer: enviar e
 * cancelar são da agência (RN-210, RN-218); recusar é do cliente (RN-212, RN-214).
 */
export const registerApprovalTools: RegisterApprovalTool = (
	server,
	user,
	deps,
) => {
	const shared = [
		registerListPendingApprovals,
		registerGetApprovalItem,
		registerGetApprovalHistory,
		registerApproveItem,
	];
	const byKind =
		user.kind === "agency_member"
			? [
					registerSubmitForApproval,
					registerCancelApprovalRequest,
					registerListItemsToSubmit,
					registerListRejectedItems,
				]
			: [registerRejectItem];
	for (const register of [...shared, ...byKind]) {
		register(server, user, deps);
	}
};
