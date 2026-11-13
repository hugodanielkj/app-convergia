import type { CompanyRepository } from "../../acesso/ports/company-repository";
import type { Content } from "../../conteudo/content";
import type { ContentRepository } from "../../conteudo/ports/content-repository";
import type { SourceRepository } from "../../conteudo/source";
import type { QuotaRepository } from "../../cotas/ports/quota-repository";
import type { KnowledgeRepository } from "../../referencias/knowledge";
import { referenceTarget } from "../../referencias/processing";
import type { ActorContext } from "../../shared/actor-context";
import type { ScriptAi, ScriptBrief } from "../ports/script-ai";
import type { ScriptRepository } from "../ports/script-repository";
export type ScriptDeps = {
	knowledge?: KnowledgeRepository;
	sources?: SourceRepository;
	companies: CompanyRepository;
	contents: ContentRepository;
	scripts: ScriptRepository;
	scriptAi: ScriptAi;
	quotas: QuotaRepository;
	now: () => Date;
};

export async function briefFor(
	deps: Pick<ScriptDeps, "companies" | "knowledge" | "sources">,
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
	const references =
		(await deps.knowledge?.listAttached(actor.companyId, content.id)) ?? [];
	const saved = (await deps.knowledge?.listSaved(actor.companyId)) ?? [];
	const contextualReferences = references.map((r) => {
		let url = r.url;
		try {
			url = referenceTarget(url).url;
		} catch {
			/* Referências gerais de artigos e documentos preservam o link original. */
		}
		const data = saved.find((s) => s.url === url && s.status === "ready");
		return {
			...r,
			text: data?.text ?? null,
			analysis: data?.analysis ?? data?.summary ?? null,
		};
	});
	return {
		companyName: company.name,
		content,
		references: contextualReferences,
		sources: (
			(await deps.sources?.list(actor.companyId, content.id)) ?? []
		).filter((s) => s.status === "ready"),
	};
}
