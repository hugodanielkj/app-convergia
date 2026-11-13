import { assertCanWrite } from "../../policies/permission.policy";
import { sourceDailyLimit } from "../../policies/sources.policy";
import type { ActorContext } from "../../shared/actor-context";
import { DomainError } from "../../shared/domain-error";
import type { ContentRepository } from "../ports/content-repository";
import type { SourceRepository } from "../source";
import { getContent } from "./read-contents";
export type SourceDeps = {
	contents: ContentRepository;
	sources: SourceRepository;
};
export async function listContentSources(
	d: SourceDeps,
	a: ActorContext,
	contentId: string,
) {
	await getContent(d, a, contentId);
	return d.sources.list(a.companyId, contentId);
}
export async function getContentSource(
	d: SourceDeps,
	a: ActorContext,
	contentId: string,
	id: string,
) {
	await getContent(d, a, contentId);
	const s = await d.sources.find(a.companyId, contentId, id);
	if (!s)
		throw new DomainError(
			"source_not_found",
			"Fonte não encontrada neste card.",
		);
	return s;
}
export async function addContentSource(
	d: SourceDeps,
	a: ActorContext,
	contentId: string,
) {
	assertCanWrite(a);
	await getContent(d, a, contentId);
	sourceDailyLimit();
}
export async function retryContentSource(
	d: SourceDeps,
	a: ActorContext,
	contentId: string,
	id: string,
) {
	assertCanWrite(a);
	await getContentSource(d, a, contentId, id);
	sourceDailyLimit();
}
export async function createContentSourceUpload(
	d: SourceDeps,
	a: ActorContext,
	contentId: string,
) {
	assertCanWrite(a);
	await getContent(d, a, contentId);
	sourceDailyLimit();
}
export async function createContentFromSource(_d: SourceDeps, a: ActorContext) {
	assertCanWrite(a);
	sourceDailyLimit();
}
