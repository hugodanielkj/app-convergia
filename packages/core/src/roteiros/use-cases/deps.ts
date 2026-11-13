import type { CompanyRepository } from "../../acesso/ports/company-repository";
import type { Content } from "../../conteudo/content";
import type { ContentRepository } from "../../conteudo/ports/content-repository";
import type { QuotaRepository } from "../../cotas/ports/quota-repository";
import type { ActorContext } from "../../shared/actor-context";
import type { ScriptAi, ScriptBrief } from "../ports/script-ai";
import type { ScriptRepository } from "../ports/script-repository";

export type ScriptDeps = {
	companies: CompanyRepository;
	contents: ContentRepository;
	scripts: ScriptRepository;
	scriptAi: ScriptAi;
	quotas: QuotaRepository;
	now: () => Date;
};

export async function briefFor(
	deps: Pick<ScriptDeps, "companies">,
	actor: ActorContext,
	content: Content,
): Promise<ScriptBrief> {
	const company = await deps.companies.findInAgency(
		actor.companyId,
		actor.agencyId,
	);
	if (!company) {
		throw new Error(`Empresa ${actor.companyId} sumiu durante a chamada.`);
	}
	return { companyName: company.name, content };
}
