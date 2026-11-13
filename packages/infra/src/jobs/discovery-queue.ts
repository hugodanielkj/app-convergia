import type { DiscoveryQueue } from "@convergia/core";
import { PgBoss } from "pg-boss";

/** Fila das coletas de vídeos (design §8.3), no próprio Postgres (stack §6). */
export const DISCOVERY_QUEUE = "discover-videos";

/** Uma coleta faz no máximo algumas dezenas de chamadas; passou disso, travou. */
const EXPIRE_SECONDS = 10 * 60;

export async function startJobs(databaseUrl: string): Promise<PgBoss> {
	const boss = new PgBoss(databaseUrl);
	boss.on("error", (error) => console.error("Erro na fila de jobs", error));
	await boss.start();
	if (!(await boss.getQueue(DISCOVERY_QUEUE))) {
		await boss.createQueue(DISCOVERY_QUEUE, {
			// A coleta não repete sozinha: a cota já voltou e a pessoa pode pesquisar de novo.
			retryLimit: 0,
			expireInSeconds: EXPIRE_SECONDS,
		});
	}
	return boss;
}

export function createDiscoveryQueue(boss: PgBoss): DiscoveryQueue {
	return {
		async enqueue(queryId) {
			await boss.send(DISCOVERY_QUEUE, { queryId }, { singletonKey: queryId });
		},
	};
}

/** Processa as coletas da fila, uma de cada vez por processo. */
export async function workDiscoveryQueue(
	boss: PgBoss,
	run: (queryId: string) => Promise<void>,
): Promise<void> {
	await boss.work<{ queryId: string }>(DISCOVERY_QUEUE, async (jobs) => {
		for (const job of jobs) await run(job.data.queryId);
	});
}
