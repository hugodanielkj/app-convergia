import {
	DomainError,
	type KnowledgeRepository,
	quotaExhausted,
	type ReferenceEvidence,
	type ReferenceJob,
} from "@convergia/core";
import { and, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "../client";
import {
	cardReferences,
	companies,
	quotaUsage,
	referenceJobs,
	savedReferences,
} from "../schema";
import { type Tx, withCompany } from "../with-company";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function createKnowledgeRepository(db: Db): KnowledgeRepository {
	return {
		async startReferenceJob(actor, input) {
			return withCompany(db, actor.companyId, async (tx) => {
				await lockCompany(tx, actor.companyId);
				const [existing] = await tx
					.select()
					.from(savedReferences)
					.where(
						and(
							eq(savedReferences.companyId, actor.companyId),
							input.referenceId
								? eq(savedReferences.id, input.referenceId)
								: eq(savedReferences.url, input.target.url),
						),
					);
				if (input.referenceId && !existing)
					throw new DomainError(
						"reference_not_found",
						"Referência não encontrada nesta empresa.",
					);
				if (existing) {
					const [job] = await tx
						.select()
						.from(referenceJobs)
						.where(
							and(
								eq(referenceJobs.companyId, actor.companyId),
								eq(referenceJobs.referenceId, existing.id),
								eq(referenceJobs.operation, input.operation),
								inArray(referenceJobs.status, ["queued", "running"]),
							),
						);
					if (
						job ||
						(input.operation === "collect" && existing.status === "ready") ||
						(input.operation === "analyze" && existing.analysis)
					)
						return { reference: existing, job: job ?? null, started: false };
				}
				if (!existing && input.target.kind === "creator") {
					const creators = await tx
						.select({ id: savedReferences.id })
						.from(savedReferences)
						.where(
							and(
								eq(savedReferences.companyId, actor.companyId),
								eq(savedReferences.kind, "creator"),
							),
						);
					if (creators.length >= input.creatorLimit)
						throw new DomainError(
							"creator_limit",
							"Esta empresa já tem 1 criador de referência. Exclua o atual antes de salvar outro.",
						);
				}
				const tool =
					input.operation === "collect"
						? "save_reference_by_url"
						: "run_creator_deep_analysis";
				const reserved = await tx
					.insert(quotaUsage)
					.values({
						companyId: actor.companyId,
						toolKey: tool,
						day: input.day,
						used: 1,
					})
					.onConflictDoUpdate({
						target: [quotaUsage.companyId, quotaUsage.toolKey, quotaUsage.day],
						set: { used: sql`${quotaUsage.used}+1` },
						setWhere: sql`${quotaUsage.used}<${input.limit}`,
					})
					.returning();
				if (!reserved.length) throw quotaExhausted(tool, input.limit);
				let reference = existing;
				if (!reference) {
					[reference] = await tx
						.insert(savedReferences)
						.values({
							companyId: actor.companyId,
							url: input.target.url,
							kind: input.target.kind,
							status: "queued",
						})
						.returning();
				} else {
					[reference] = await tx
						.update(savedReferences)
						.set(
							input.operation === "collect"
								? { status: "queued", error: null }
								: { analysisStatus: "queued", error: null },
						)
						.where(
							and(
								eq(savedReferences.companyId, actor.companyId),
								eq(savedReferences.id, reference.id),
							),
						)
						.returning();
				}
				if (!reference) throw Error("Referência não gravada.");
				const [job] = await tx
					.insert(referenceJobs)
					.values({
						companyId: actor.companyId,
						referenceId: reference.id,
						operation: input.operation,
						status: "queued",
						quotaTool: tool,
						quotaDay: input.day,
						createdAt: input.at,
					})
					.returning();
				if (!job) throw Error("Tarefa não gravada.");
				return { reference, job, started: true };
			});
		},
		async claimReferenceJob(companyId, id, at) {
			if (!uuid.test(id)) return null;
			return withCompany(db, companyId, async (tx) => {
				const [job] = await tx
					.update(referenceJobs)
					.set({ status: "running", startedAt: at })
					.where(
						and(
							eq(referenceJobs.companyId, companyId),
							eq(referenceJobs.id, id),
							eq(referenceJobs.status, "queued"),
						),
					)
					.returning();
				if (!job) return null;
				const [reference] = await tx
					.select()
					.from(savedReferences)
					.where(
						and(
							eq(savedReferences.companyId, companyId),
							eq(savedReferences.id, job.referenceId),
						),
					);
				return reference ? { job, reference } : null;
			});
		},
		async finishReferenceJob(companyId, id, result) {
			if (!uuid.test(id)) return;
			await withCompany(db, companyId, async (tx) => {
				await lockCompany(tx, companyId);
				await finish(tx, companyId, id, result);
			});
		},
		async pendingReferenceJobs(before) {
			const result: ReferenceJob[] = [];
			// O worker é global; cada consulta de tarefas continua dentro do contexto da empresa (RN-015).
			for (const company of await db
				.select({ id: companies.id })
				.from(companies)) {
				const rows = await withCompany(db, company.id, (tx) =>
					tx
						.select()
						.from(referenceJobs)
						.where(
							and(
								eq(referenceJobs.companyId, company.id),
								inArray(referenceJobs.status, ["queued", "running"]),
							),
						)
						.limit(100),
				);
				result.push(
					...rows.filter(
						(j) =>
							j.status === "queued" || (j.startedAt && j.startedAt < before),
					),
				);
			}
			return result;
		},
		listSaved: (companyId) =>
			withCompany(db, companyId, (tx) =>
				tx
					.select()
					.from(savedReferences)
					.where(eq(savedReferences.companyId, companyId)),
			),
		findSaved: (companyId, id) =>
			!uuid.test(id)
				? Promise.resolve(null)
				: withCompany(
						db,
						companyId,
						async (tx) =>
							(
								await tx
									.select()
									.from(savedReferences)
									.where(
										and(
											eq(savedReferences.companyId, companyId),
											eq(savedReferences.id, id),
										),
									)
							)[0] ?? null,
					),
		async deleteSaved(companyId, id) {
			if (!uuid.test(id)) return false;
			return withCompany(db, companyId, async (tx) => {
				await lockCompany(tx, companyId);
				const jobs = await tx
					.select()
					.from(referenceJobs)
					.where(
						and(
							eq(referenceJobs.companyId, companyId),
							eq(referenceJobs.referenceId, id),
							inArray(referenceJobs.status, ["queued", "running"]),
						),
					);
				for (const job of jobs)
					await finish(tx, companyId, job.id, {
						error: "Referência excluída.",
					});
				const deleted = await tx
					.delete(savedReferences)
					.where(
						and(
							eq(savedReferences.companyId, companyId),
							eq(savedReferences.id, id),
						),
					)
					.returning();
				return deleted.length > 0;
			});
		},
		listAttached: (companyId, contentId) =>
			withCompany(db, companyId, (tx) =>
				tx
					.select()
					.from(cardReferences)
					.where(
						and(
							eq(cardReferences.companyId, companyId),
							eq(cardReferences.contentId, contentId),
						),
					),
			),
		attach: (companyId, contentId, input) =>
			withCompany(db, companyId, async (tx) => {
				const [row] = await tx
					.insert(cardReferences)
					.values({ ...input, companyId, contentId })
					.returning();
				if (!row) throw new Error("Referência não gravada.");
				return row;
			}),
		detach: (companyId, contentId, id) =>
			!uuid.test(id)
				? Promise.resolve(false)
				: withCompany(
						db,
						companyId,
						async (tx) =>
							(
								await tx
									.delete(cardReferences)
									.where(
										and(
											eq(cardReferences.companyId, companyId),
											eq(cardReferences.contentId, contentId),
											eq(cardReferences.id, id),
										),
									)
									.returning()
							).length > 0,
					),
	};
}

async function lockCompany(tx: Tx, id: string) {
	await tx
		.select({ id: companies.id })
		.from(companies)
		.where(eq(companies.id, id))
		.for("update");
}
async function finish(
	tx: Tx,
	companyId: string,
	id: string,
	result: {
		evidence?: ReferenceEvidence;
		summary?: string;
		analysis?: string;
		error?: string;
	},
) {
	const [job] = await tx
		.update(referenceJobs)
		.set({ status: result.error ? "failed" : "ready" })
		.where(
			and(
				eq(referenceJobs.companyId, companyId),
				eq(referenceJobs.id, id),
				inArray(referenceJobs.status, ["queued", "running"]),
			),
		)
		.returning();
	if (!job) return;
	const patch =
		job.operation === "collect"
			? result.error
				? { status: "failed" as const, error: result.error }
				: {
						status: "ready" as const,
						error: null,
						evidence: result.evidence,
						summary: result.summary,
						text: [
							result.evidence?.bio,
							...(result.evidence?.posts.map((p) => p.caption) ?? []),
						]
							.filter(Boolean)
							.join("\n\n"),
					}
			: result.error
				? { analysisStatus: "failed" as const, error: result.error }
				: {
						analysisStatus: "ready" as const,
						analysis: result.analysis,
						error: null,
					};
	await tx
		.update(savedReferences)
		.set(patch)
		.where(
			and(
				eq(savedReferences.companyId, companyId),
				eq(savedReferences.id, job.referenceId),
			),
		);
	if (result.error)
		await tx
			.update(quotaUsage)
			.set({ used: sql`greatest(${quotaUsage.used}-1,0)` })
			.where(
				and(
					eq(quotaUsage.companyId, companyId),
					eq(quotaUsage.toolKey, job.quotaTool),
					eq(quotaUsage.day, job.quotaDay),
				),
			);
}
