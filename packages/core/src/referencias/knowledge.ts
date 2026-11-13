import { z } from "zod";
import type { ActorContext } from "../shared/actor-context";
import type {
	ReferenceEvidence,
	ReferenceJob,
	ReferenceOperation,
	ReferenceTarget,
	StartedReference,
} from "./processing";
export const referenceInput = z.object({
	url: z.url().refine((value) => {
		const u = new URL(value);
		return (
			u.protocol === "https:" &&
			["instagram.com", "www.instagram.com"].includes(u.hostname) &&
			!u.username &&
			!u.password &&
			!u.port &&
			u.pathname !== "/"
		);
	}, "Informe um link público de post ou perfil do Instagram."),
});
export const attachmentInput = z.object({
	title: z.string().trim().min(1).max(200),
	url: z.url({ protocol: /^https?$/ }),
	kind: z.enum(["post", "creator", "link", "document"]),
});
export type CardReference = z.infer<typeof attachmentInput> & {
	id: string;
	companyId: string;
	contentId: string;
};
export type SavedReference = {
	id: string;
	companyId: string;
	url: string;
	kind: "post" | "creator";
	status: "queued" | "ready" | "failed";
	text: string | null;
	analysis: string | null;
	error: string | null;
	evidence?: ReferenceEvidence | null;
	summary?: string | null;
	analysisStatus?: "none" | "queued" | "ready" | "failed";
};
export interface KnowledgeRepository {
	startReferenceJob(
		actor: ActorContext,
		input: {
			operation: ReferenceOperation;
			target: ReferenceTarget;
			referenceId?: string;
			day: string;
			limit: number;
			creatorLimit: number;
			at: Date;
		},
	): Promise<StartedReference>;
	claimReferenceJob(
		companyId: string,
		id: string,
		at: Date,
	): Promise<{ job: ReferenceJob; reference: SavedReference } | null>;
	/** Grava resultado e, em falha, devolve a reserva uma única vez, na mesma transação. */
	finishReferenceJob(
		companyId: string,
		id: string,
		result: {
			evidence?: ReferenceEvidence;
			summary?: string;
			analysis?: string;
			error?: string;
		},
	): Promise<void>;
	pendingReferenceJobs(before: Date): Promise<ReferenceJob[]>;

	listSaved(companyId: string): Promise<SavedReference[]>;
	findSaved(companyId: string, id: string): Promise<SavedReference | null>;
	deleteSaved(companyId: string, id: string): Promise<boolean>;
	listAttached(companyId: string, contentId: string): Promise<CardReference[]>;
	attach(
		companyId: string,
		contentId: string,
		input: z.infer<typeof attachmentInput>,
	): Promise<CardReference>;
	detach(companyId: string, contentId: string, id: string): Promise<boolean>;
}
