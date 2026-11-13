import type { AiCallMeta } from "../roteiros/ports/script-ai";
import { DomainError } from "../shared/domain-error";
import type { KnowledgeRepository, SavedReference } from "./knowledge";
export type ReferenceTarget = {
	url: string;
	kind: "post" | "creator";
	handle: string | null;
};
/** RN-090: a identidade ignora parâmetros de rastreamento e variações de domínio. */
export function referenceTarget(value: string): ReferenceTarget {
	let u: URL;
	try {
		u = new URL(value);
	} catch {
		throw invalidReference();
	}
	if (
		u.protocol !== "https:" ||
		!["instagram.com", "www.instagram.com"].includes(u.hostname) ||
		u.port ||
		u.username ||
		u.password
	)
		throw invalidReference();
	const parts = u.pathname.split("/").filter(Boolean);
	if (
		parts.length === 2 &&
		["p", "reel", "reels", "tv"].includes(parts[0] ?? "") &&
		/^[A-Za-z0-9_-]+$/.test(parts[1] ?? "")
	)
		return {
			url: `https://www.instagram.com/p/${parts[1]}/`,
			kind: "post",
			handle: null,
		};
	const handle = parts[0]?.toLowerCase();
	if (
		parts.length === 1 &&
		handle &&
		/^[a-z0-9_][a-z0-9_.]{0,29}$/.test(handle) &&
		![
			"accounts",
			"explore",
			"direct",
			"stories",
			"reels",
			"p",
			"reel",
			"tv",
			"about",
			"developer",
			"developers",
			"legal",
			"privacy",
			"terms",
		].includes(handle)
	)
		return {
			url: `https://www.instagram.com/${handle}/`,
			kind: "creator",
			handle,
		};
	throw invalidReference();
}
export const invalidReference = () =>
	new DomainError(
		"invalid_reference",
		"Informe um link público de post ou perfil do Instagram.",
	);
export type ReferenceEvidence = {
	title: string;
	bio: string | null;
	posts: { caption: string; likes: number | null; comments: number | null }[];
};
export interface ReferenceProvider {
	readonly configured: boolean;
	collect(target: ReferenceTarget): Promise<ReferenceEvidence>;
}
export interface ReferenceAi {
	summarize(meta: AiCallMeta, evidence: ReferenceEvidence): Promise<string>;
	analyzeCreator(
		meta: AiCallMeta,
		evidence: ReferenceEvidence,
	): Promise<string>;
}
export type ReferenceOperation = "collect" | "analyze";
export type ReferenceQuotaTool =
	| "save_reference_by_url"
	| "run_creator_deep_analysis";
export type ReferenceJob = {
	id: string;
	companyId: string;
	referenceId: string;
	operation: ReferenceOperation;
	status: "queued" | "running" | "ready" | "failed";
	quotaDay: string;
	quotaTool: ReferenceQuotaTool;
	createdAt: Date;
	startedAt: Date | null;
};
export interface ReferenceQueue {
	enqueue(job: { id: string; companyId: string }): Promise<void>;
}
export type ReferenceProcessingDeps = {
	knowledge: KnowledgeRepository;
	referenceProvider: ReferenceProvider;
	referenceAi: ReferenceAi;
	referenceQueue: ReferenceQueue;
	now: () => Date;
};
export type StartedReference = {
	reference: SavedReference;
	job: ReferenceJob | null;
	started: boolean;
};
