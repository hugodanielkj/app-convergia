import type { ReferenceQueue } from "@convergia/core";
import type { PgBoss } from "pg-boss";

const QUEUE = "process-reference";
export function createReferenceQueue(boss: PgBoss): ReferenceQueue {
	return {
		async enqueue(data) {
			await boss.send(QUEUE, data, {
				singletonKey: data.id,
				retryLimit: 0,
				expireInSeconds: 300,
			});
		},
	};
}
export async function workReferenceQueue(
	boss: PgBoss,
	run: (companyId: string, id: string) => Promise<void>,
	recover: () => Promise<void>,
) {
	if (!(await boss.getQueue(QUEUE)))
		await boss.createQueue(QUEUE, { retryLimit: 0, expireInSeconds: 300 });
	await boss.work<{ companyId: string; id: string }>(QUEUE, async (jobs) => {
		for (const job of jobs) await run(job.data.companyId, job.data.id);
	});
	await recover();
	let recovering = false;
	const interval = setInterval(async () => {
		if (recovering) return;
		recovering = true;
		try {
			await recover();
		} catch {
			console.error("Falha na recuperação da fila de referências.");
		} finally {
			recovering = false;
		}
	}, 30000);
	interval.unref();
	return () => clearInterval(interval);
}
