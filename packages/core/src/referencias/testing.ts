import type { ContentSource, SourceRepository } from "../conteudo/source";
import { quotaExhausted } from "../policies/quota.policy";
import { DomainError } from "../shared/domain-error";
import type {
	CardReference,
	KnowledgeRepository,
	SavedReference,
} from "./knowledge";
import type {
	ReferenceAi,
	ReferenceJob,
	ReferenceProvider,
	ReferenceQueue,
} from "./processing";
export class InMemoryKnowledgeRepository implements KnowledgeRepository {
	readonly saved: SavedReference[] = [];
	readonly jobs: ReferenceJob[] = [];
	readonly used = new Map<string, number>();
	private sequence = 0;
	async startReferenceJob(
		actor: Parameters<KnowledgeRepository["startReferenceJob"]>[0],
		input: Parameters<KnowledgeRepository["startReferenceJob"]>[1],
	) {
		const companyId = actor.companyId;
		let reference = this.saved.find(
			(r) =>
				r.companyId === companyId &&
				(input.referenceId
					? r.id === input.referenceId
					: r.url === input.target.url),
		);
		if (input.referenceId && !reference)
			throw new DomainError(
				"reference_not_found",
				"Referência não encontrada nesta empresa.",
			);
		if (reference) {
			const job = this.jobs.find(
				(j) =>
					j.companyId === companyId &&
					j.referenceId === reference?.id &&
					j.operation === input.operation &&
					["queued", "running"].includes(j.status),
			);
			if (
				job ||
				(input.operation === "collect" && reference.status === "ready") ||
				(input.operation === "analyze" && reference.analysis)
			)
				return {
					reference: structuredClone(reference),
					job: structuredClone(job ?? null),
					started: false,
				};
		}
		if (
			!reference &&
			input.target.kind === "creator" &&
			this.saved.filter(
				(r) => r.companyId === companyId && r.kind === "creator",
			).length >= input.creatorLimit
		)
			throw new DomainError(
				"creator_limit",
				"Esta empresa já tem 1 criador de referência. Exclua o atual antes de salvar outro.",
			);
		const tool =
			input.operation === "collect"
				? ("save_reference_by_url" as const)
				: ("run_creator_deep_analysis" as const);
		const key = [companyId, tool, input.day].join(":");
		const used = this.used.get(key) ?? 0;
		if (used >= input.limit) throw quotaExhausted(tool, input.limit);
		this.used.set(key, used + 1);
		if (!reference) {
			reference = {
				id: `ref-${++this.sequence}`,
				companyId,
				url: input.target.url,
				kind: input.target.kind,
				status: "queued",
				text: null,
				analysis: null,
				error: null,
				analysisStatus: "none",
			};
			this.saved.push(reference);
		} else if (input.operation === "collect") {
			reference.status = "queued";
			reference.error = null;
		} else {
			reference.analysisStatus = "queued";
			reference.error = null;
		}
		const job: ReferenceJob = {
			id: `job-${++this.sequence}`,
			companyId,
			referenceId: reference.id,
			operation: input.operation,
			status: "queued",
			quotaDay: input.day,
			quotaTool: tool,
			createdAt: input.at,
			startedAt: null,
		};
		this.jobs.push(job);
		return {
			reference: structuredClone(reference),
			job: structuredClone(job),
			started: true,
		};
	}
	async claimReferenceJob(companyId: string, id: string, at: Date) {
		const job = this.jobs.find(
			(j) => j.companyId === companyId && j.id === id && j.status === "queued",
		);
		const reference = this.saved.find(
			(r) => r.companyId === companyId && r.id === job?.referenceId,
		);
		if (!job || !reference) return null;
		job.status = "running";
		job.startedAt = at;
		return structuredClone({ job, reference });
	}
	async finishReferenceJob(
		companyId: string,
		id: string,
		result: Parameters<KnowledgeRepository["finishReferenceJob"]>[2],
	) {
		const job = this.jobs.find(
			(j) =>
				j.companyId === companyId &&
				j.id === id &&
				["queued", "running"].includes(j.status),
		);
		if (!job) return;
		job.status = result.error ? "failed" : "ready";
		const r = this.saved.find(
			(r) => r.companyId === companyId && r.id === job.referenceId,
		);
		if (r) {
			if (job.operation === "collect") {
				r.status = result.error ? "failed" : "ready";
				if (result.evidence) {
					r.evidence = result.evidence;
					r.text = [
						result.evidence.bio,
						...result.evidence.posts.map((p) => p.caption),
					]
						.filter(Boolean)
						.join("\n");
				}
				if (result.summary) r.summary = result.summary;
			} else {
				r.analysisStatus = result.error ? "failed" : "ready";
				if (result.analysis) r.analysis = result.analysis;
			}
			r.error = result.error ?? null;
		}
		if (result.error) {
			const key = [companyId, job.quotaTool, job.quotaDay].join(":");
			this.used.set(key, Math.max(0, (this.used.get(key) ?? 0) - 1));
		}
	}
	async pendingReferenceJobs(before: Date) {
		return structuredClone(
			this.jobs.filter(
				(j) =>
					j.status === "queued" ||
					(j.status === "running" && j.startedAt && j.startedAt < before),
			),
		);
	}

	readonly attached: CardReference[] = [];
	async listSaved(companyId: string) {
		return structuredClone(this.saved.filter((r) => r.companyId === companyId));
	}
	async findSaved(companyId: string, id: string) {
		return structuredClone(
			this.saved.find((r) => r.companyId === companyId && r.id === id) ?? null,
		);
	}
	async deleteSaved(companyId: string, id: string) {
		const n = this.saved.findIndex(
			(r) => r.companyId === companyId && r.id === id,
		);
		if (n < 0) return false;
		for (const job of this.jobs.filter(
			(j) => j.companyId === companyId && j.referenceId === id,
		))
			await this.finishReferenceJob(companyId, job.id, {
				error: "Referência excluída.",
			});
		this.saved.splice(n, 1);
		return true;
	}
	async listAttached(companyId: string, contentId: string) {
		return structuredClone(
			this.attached.filter(
				(r) => r.companyId === companyId && r.contentId === contentId,
			),
		);
	}
	async attach(
		companyId: string,
		contentId: string,
		input: Pick<CardReference, "title" | "url" | "kind">,
	) {
		const r = {
			id: `ref-${this.attached.length + 1}`,
			companyId,
			contentId,
			...input,
		};
		this.attached.push(r);
		return structuredClone(r);
	}
	async detach(companyId: string, contentId: string, id: string) {
		const n = this.attached.findIndex(
			(r) =>
				r.companyId === companyId && r.contentId === contentId && r.id === id,
		);
		if (n < 0) return false;
		this.attached.splice(n, 1);
		return true;
	}
}
export class InMemorySourceRepository implements SourceRepository {
	readonly rows: ContentSource[] = [];
	async list(companyId: string, contentId: string) {
		return structuredClone(
			this.rows.filter(
				(r) => r.companyId === companyId && r.contentId === contentId,
			),
		);
	}
	async find(companyId: string, contentId: string, id: string) {
		return structuredClone(
			this.rows.find(
				(r) =>
					r.companyId === companyId && r.contentId === contentId && r.id === id,
			) ?? null,
		);
	}
}

export class FakeReferenceProvider implements ReferenceProvider {
	configured = true;
	fail = false;
	calls = 0;
	async collect() {
		this.calls++;
		if (this.fail) throw Error("Falha simulada");
		return {
			title: "Criador de exemplo",
			bio: "Dicas de decoração",
			posts: [
				{
					caption: "Como decorar uma sala pequena",
					likes: null,
					comments: null,
				},
			],
		};
	}
}
export class FakeReferenceAi implements ReferenceAi {
	calls = 0;
	fail = false;
	async summarize() {
		this.calls++;
		if (this.fail) throw Error("Falha simulada");
		return "Resumo simulado de dicas práticas.";
	}
	async analyzeCreator() {
		this.calls++;
		if (this.fail) throw Error("Falha simulada");
		return "Análise simulada: pilares, público provável e adaptações.";
	}
}
export class FakeReferenceQueue implements ReferenceQueue {
	jobs: { id: string; companyId: string }[] = [];
	fail = false;
	async enqueue(job: { id: string; companyId: string }) {
		if (this.fail) throw Error("Fila indisponível");
		this.jobs.push(job);
	}
}
