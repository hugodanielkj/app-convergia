import { type ReferenceProcessingDeps, referenceTarget } from "./processing";
/** RN-305: idempotência e devolução atômica de cota, inclusive após interrupção do worker. */
export async function runReferenceJob(
	d: ReferenceProcessingDeps,
	companyId: string,
	id: string,
) {
	const work = await d.knowledge.claimReferenceJob(companyId, id, d.now());
	if (!work) return;
	const meta = { companyId, tool: work.job.quotaTool };
	try {
		if (work.job.operation === "collect") {
			const evidence = await d.referenceProvider.collect(
				referenceTarget(work.reference.url),
			);
			const summary = await d.referenceAi.summarize(meta, evidence);
			await d.knowledge.finishReferenceJob(companyId, id, {
				evidence,
				summary,
			});
		} else {
			if (!work.reference.evidence)
				throw Error("A referência não tem dados coletados.");
			const analysis = await d.referenceAi.analyzeCreator(
				meta,
				work.reference.evidence,
			);
			await d.knowledge.finishReferenceJob(companyId, id, { analysis });
		}
	} catch {
		await d.knowledge.finishReferenceJob(companyId, id, {
			error:
				"Não foi possível processar esta referência. Confira se ela é pública e tente novamente.",
		});
	}
}
export async function recoverReferenceJobs(d: ReferenceProcessingDeps) {
	const stale = new Date(d.now().getTime() - 5 * 60_000);
	for (const job of await d.knowledge.pendingReferenceJobs(stale)) {
		if (job.status === "running")
			await d.knowledge.finishReferenceJob(job.companyId, job.id, {
				error: "O processamento foi interrompido. Tente novamente.",
			});
		else {
			try {
				await d.referenceQueue.enqueue({
					id: job.id,
					companyId: job.companyId,
				});
			} catch {
				/* O registro durável será reenfileirado na próxima recuperação. */
			}
		}
	}
}
