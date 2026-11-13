import type { CompanyRepository } from "../acesso/ports/company-repository";
import type { QuotaRepository } from "../cotas/ports/quota-repository";
import { withQuota } from "../cotas/with-quota";
import { assertIdeaCanBecomeCard } from "../policies/ideas.policy";
import { assertCanWrite } from "../policies/permission.policy";
import type { ActorContext } from "../shared/actor-context";
import { DomainError } from "../shared/domain-error";
import type { BrainstormAi, IdeaRepository } from "./ports";
export type IdeaDeps = {
	ideas: IdeaRepository;
	brainstormAi: BrainstormAi;
	companies: CompanyRepository;
	quotas: QuotaRepository;
	now: () => Date;
};
export const listBrainstormSuggestions = (
	deps: Pick<IdeaDeps, "ideas">,
	actor: ActorContext,
) => deps.ideas.list(actor.companyId);
export async function regenerateBrainstorm(
	deps: IdeaDeps,
	actor: ActorContext,
	input: { brief: string },
) {
	assertCanWrite(actor);
	const company = await deps.companies.findInAgency(
		actor.companyId,
		actor.agencyId,
	);
	if (!company)
		throw new DomainError(
			"company_not_found",
			"Você não tem acesso a esta empresa.",
		);
	return withQuota(deps, actor, "regenerate_brainstorm", async () => {
		const drafts = await deps.brainstormAi.generate(
			{ companyId: actor.companyId, tool: "regenerate_brainstorm" },
			company.name,
			input.brief,
		);
		return deps.ideas.replace(actor, drafts, deps.now());
	});
}
export async function acceptBrainstormSuggestion(
	deps: Pick<IdeaDeps, "ideas" | "now">,
	actor: ActorContext,
	id: string,
) {
	assertCanWrite(actor);
	const idea = await deps.ideas.find(actor.companyId, id);
	if (!idea) throw ideaNotFound();
	assertIdeaCanBecomeCard(idea);
	const card = await deps.ideas.accept(actor, id, deps.now());
	if (!card)
		throw new DomainError(
			"idea_changed",
			"Esta ideia mudou. Atualize a lista e tente de novo.",
		);
	return card;
}
export async function dismissBrainstormSuggestion(
	deps: Pick<IdeaDeps, "ideas" | "now">,
	actor: ActorContext,
	id: string,
) {
	assertCanWrite(actor);
	if (!(await deps.ideas.dismiss(actor, id, deps.now()))) throw ideaNotFound();
}
export const ideaNotFound = () =>
	new DomainError("idea_not_found", "Ideia não encontrada nesta empresa.");
