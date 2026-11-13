import type { ContentRepository } from "../conteudo/ports/content-repository";
import { getContent } from "../conteudo/use-cases/read-contents";
import { assertCanWrite } from "../policies/permission.policy";
import { dailyLimit, quotaDay } from "../policies/quota.policy";
import { referenceCreatorLimit } from "../policies/references.policy";
import type { ActorContext } from "../shared/actor-context";
import { DomainError } from "../shared/domain-error";
import type { CardReference, KnowledgeRepository } from "./knowledge";
import { type ReferenceProcessingDeps, referenceTarget } from "./processing";
export type KnowledgeDeps = {
	knowledge: KnowledgeRepository;
	contents: ContentRepository;
};
export const listSavedReferences = (d: KnowledgeDeps, a: ActorContext) =>
	d.knowledge.listSaved(a.companyId);
/** RN-090, RN-301: reserva e registro duráveis antes de enfileirar; uma URL não duplica a coleta. */
export async function saveReferenceByUrl(
	d: KnowledgeDeps & ReferenceProcessingDeps,
	a: ActorContext,
	input: { url: string },
) {
	assertCanWrite(a);
	const target = referenceTarget(input.url);
	const existing = (await d.knowledge.listSaved(a.companyId)).find(
		(r) => r.url === target.url,
	);
	if (existing?.status === "ready")
		return { reference: existing, job: null, started: false };
	if (!d.referenceProvider.configured)
		throw new DomainError(
			"reference_provider_unavailable",
			"A coleta de referências ainda não foi configurada neste ambiente.",
		);
	return startJob(d, a, { target, operation: "collect" });
}
async function startJob(
	d: KnowledgeDeps & ReferenceProcessingDeps,
	a: ActorContext,
	input: {
		target: ReturnType<typeof referenceTarget>;
		operation: "collect" | "analyze";
		referenceId?: string;
	},
) {
	const tool =
		input.operation === "collect"
			? "save_reference_by_url"
			: "run_creator_deep_analysis";
	const result = await d.knowledge.startReferenceJob(a, {
		...input,
		day: quotaDay(d.now()),
		limit: dailyLimit(tool),
		creatorLimit: referenceCreatorLimit(),
		at: d.now(),
	});
	if (result.started && result.job) {
		try {
			await d.referenceQueue.enqueue({
				id: result.job.id,
				companyId: a.companyId,
			});
		} catch {
			await d.knowledge.finishReferenceJob(a.companyId, result.job.id, {
				error: "A fila não aceitou o processamento. Tente de novo.",
			});
			throw new DomainError(
				"reference_queue_unavailable",
				"A fila não aceitou o processamento. Tente de novo.",
			);
		}
	}
	return result;
}
export async function deleteSavedReference(
	d: KnowledgeDeps,
	a: ActorContext,
	id: string,
) {
	assertCanWrite(a);
	if (!(await d.knowledge.deleteSaved(a.companyId, id)))
		throw referenceNotFound();
}
export async function getCreatorAnalysis(
	d: KnowledgeDeps,
	a: ActorContext,
	id: string,
) {
	const r = await d.knowledge.findSaved(a.companyId, id);
	if (r?.kind !== "creator") throw referenceNotFound();
	return { reference: r, analysis: r.analysis };
}
/** RN-092: consultar análise salva nunca chama IA ou reserva cota. */
export async function runCreatorDeepAnalysis(
	d: KnowledgeDeps & ReferenceProcessingDeps,
	a: ActorContext,
	id: string,
) {
	assertCanWrite(a);
	const result = await getCreatorAnalysis(d, a, id);
	if (result.analysis) return result;
	if (result.reference.status !== "ready" || !result.reference.evidence)
		throw new DomainError(
			"reference_not_ready",
			"Aguarde a coleta da referência terminar antes de analisar.",
		);
	const started = await startJob(d, a, {
		target: referenceTarget(result.reference.url),
		operation: "analyze",
		referenceId: id,
	});
	return { reference: started.reference, analysis: started.reference.analysis };
}
export async function listContentReferences(
	d: KnowledgeDeps,
	a: ActorContext,
	contentId: string,
) {
	await getContent(d, a, contentId);
	return d.knowledge.listAttached(a.companyId, contentId);
}
export async function attachContentReference(
	d: KnowledgeDeps,
	a: ActorContext,
	contentId: string,
	input: Pick<CardReference, "title" | "url" | "kind">,
) {
	assertCanWrite(a);
	await getContent(d, a, contentId);
	return d.knowledge.attach(a.companyId, contentId, input);
}
export async function detachContentReference(
	d: KnowledgeDeps,
	a: ActorContext,
	contentId: string,
	id: string,
) {
	assertCanWrite(a);
	await getContent(d, a, contentId);
	if (!(await d.knowledge.detach(a.companyId, contentId, id)))
		throw referenceNotFound();
}
const referenceNotFound = () =>
	new DomainError(
		"reference_not_found",
		"Referência não encontrada nesta empresa.",
	);
