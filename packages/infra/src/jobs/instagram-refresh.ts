import type { PgBoss } from "pg-boss";

/** Job diário do Instagram: renova os tokens e atualiza o retrato de cada empresa (stack §5). */
export const INSTAGRAM_REFRESH_QUEUE = "instagram-refresh";

/** Todo dia às 6h de São Paulo, antes do expediente. */
const CRON = "0 6 * * *";

export async function scheduleInstagramRefresh(
	boss: PgBoss,
	run: () => Promise<{ refreshed: number; failed: number }>,
): Promise<void> {
	if (!(await boss.getQueue(INSTAGRAM_REFRESH_QUEUE))) {
		await boss.createQueue(INSTAGRAM_REFRESH_QUEUE, {
			retryLimit: 1,
			expireInSeconds: 30 * 60,
		});
	}
	await boss.schedule(INSTAGRAM_REFRESH_QUEUE, CRON, null, {
		tz: "America/Sao_Paulo",
	});
	await boss.work(INSTAGRAM_REFRESH_QUEUE, async () => {
		const { refreshed, failed } = await run();
		console.log(
			`Instagram atualizado: ${refreshed} empresas, ${failed} com falha`,
		);
	});
}
