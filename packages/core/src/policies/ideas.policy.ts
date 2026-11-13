import type { Idea } from "../ideias/idea";
import { DomainError } from "../shared/domain-error";
/** RN-083, RN-084: aprovar não cria card; a conversão é explícita e exige aprovação quando a agência mexeu. */
export function assertIdeaCanBecomeCard(idea: Idea): void {
	if (idea.state === "added") return;
	if (idea.state !== "active")
		throw new DomainError("idea_inactive", "Esta ideia não está mais ativa.");
	if (idea.approvalStatus !== "none" && idea.approvalStatus !== "approved")
		throw new DomainError(
			"idea_not_approved",
			"A ideia precisa da aprovação do cliente antes de virar card.",
		);
}
