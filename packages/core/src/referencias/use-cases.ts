import type { ContentRepository } from "../conteudo/ports/content-repository";
import { getContent } from "../conteudo/use-cases/read-contents";
import { assertCanWrite } from "../policies/permission.policy";
import {
	referenceCreatorLimit,
	referenceDailyLimit,
} from "../policies/references.policy";
import type { ActorContext } from "../shared/actor-context";
import { DomainError } from "../shared/domain-error";
import type { CardReference, KnowledgeRepository } from "./knowledge";
export type KnowledgeDeps = {
	knowledge: KnowledgeRepository;
	contents: ContentRepository;
};
export const listSavedReferences = (d: KnowledgeDeps, a: ActorContext) =>
	d.knowledge.listSaved(a.companyId);
export async function saveReferenceByUrl(
	_d: KnowledgeDeps,
	a: ActorContext,
	input: { url: string },
): Promise<never> {
	assertCanWrite(a);
	if (!/^\/(p|reel|reels|tv)\//.test(new URL(input.url).pathname))
		referenceCreatorLimit();
	return referenceDailyLimit();
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
export async function runCreatorDeepAnalysis(
	d: KnowledgeDeps,
	a: ActorContext,
	id: string,
) {
	assertCanWrite(a);
	const result = await getCreatorAnalysis(d, a, id);
	if (result.analysis) return result;
	return referenceDailyLimit();
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
