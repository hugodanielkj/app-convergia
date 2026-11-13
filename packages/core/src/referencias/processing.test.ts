import { describe, expect, it } from "vitest";
import { inMemoryContentDeps } from "../aprovacao/testing/content-deps";
import { agency, client } from "../conteudo/testing/actors";
import { referenceTarget } from "./processing";
import { recoverReferenceJobs, runReferenceJob } from "./run-reference-job";
import {
	deleteSavedReference,
	runCreatorDeepAnalysis,
	saveReferenceByUrl,
} from "./use-cases";

const setup = () => ({
	...inMemoryContentDeps(),
	now: () => new Date("2026-11-13T15:00:00Z"),
});
const post = (n: number) => ({ url: `https://www.instagram.com/p/post${n}/` });
describe("Processamento de referências", () => {
	it("RN-090: normaliza URLs equivalentes e não aceita páginas que não sejam posts ou perfis", () => {
		expect(referenceTarget("https://instagram.com/reel/ABC/?igsh=x").url).toBe(
			"https://www.instagram.com/p/ABC/",
		);
		expect(referenceTarget("https://instagram.com/CRIADOR/?a=1").handle).toBe(
			"criador",
		);
		for (const url of [
			"https://instagram.com/accounts/login/",
			"https://instagram.com/explore/",
			"https://instagram.com/p/abc/extra/",
			"https://instagram.com.evil.test/p/a/",
			"http://instagram.com/perfil/",
		])
			expect(() => referenceTarget(url)).toThrow();
	});
	it("RN-090, RN-303: URLs repetidas em andamento ou prontas não reservam outra cota", async () => {
		const d = setup();
		const a = await saveReferenceByUrl(d, client, post(1));
		const b = await saveReferenceByUrl(d, agency, {
			url: "https://instagram.com/reel/post1/?igsh=x",
		});
		expect(a.reference.id).toBe(b.reference.id);
		expect(d.referenceQueue.jobs).toHaveLength(1);
		await runReferenceJob(d, client.companyId, a.job?.id ?? "");
		d.referenceProvider.configured = false;
		const cached = await saveReferenceByUrl(d, client, post(1));
		expect(cached.reference.summary).toContain("simulado");
		expect([...d.knowledge.used.values()]).toEqual([1]);
	});
	it("RN-093: apenas um criador por empresa, com liberação da vaga ao excluir", async () => {
		const d = setup();
		const a = await saveReferenceByUrl(d, client, {
			url: "https://instagram.com/criador/",
		});
		await expect(
			saveReferenceByUrl(d, agency, { url: "https://instagram.com/outro/" }),
		).rejects.toThrow("1 criador");
		await deleteSavedReference(d, client, a.reference.id);
		await expect(
			saveReferenceByUrl(d, client, { url: "https://instagram.com/outro/" }),
		).resolves.toMatchObject({ started: true });
	});
	it("RN-301, RN-303: agência e cliente compartilham 3 coletas diárias", async () => {
		const d = setup();
		for (let n = 0; n < 3; n++)
			await saveReferenceByUrl(d, n % 2 ? agency : client, post(n));
		await expect(saveReferenceByUrl(d, client, post(4))).rejects.toThrow(
			"3 por dia",
		);
	});
	it("RN-305: falha do provedor devolve a cota uma única vez", async () => {
		const d = setup();
		d.referenceProvider.fail = true;
		const a = await saveReferenceByUrl(d, client, post(1));
		await runReferenceJob(d, client.companyId, a.job?.id ?? "");
		await runReferenceJob(d, client.companyId, a.job?.id ?? "");
		expect(d.referenceProvider.calls).toBe(1);
		expect([...d.knowledge.used.values()]).toEqual([0]);
		expect(
			(await d.knowledge.findSaved(client.companyId, a.reference.id))?.status,
		).toBe("failed");
	});
	it("RN-305: fila indisponível não deixa reserva presa", async () => {
		const d = setup();
		d.referenceQueue.fail = true;
		await expect(saveReferenceByUrl(d, client, post(1))).rejects.toThrow(
			"fila",
		);
		expect([...d.knowledge.used.values()]).toEqual([0]);
	});
	it("RN-092: análise aprofundada usa evidências coletadas, é assíncrona e depois retorna do cache", async () => {
		const d = setup();
		const a = await saveReferenceByUrl(d, client, {
			url: "https://instagram.com/criador/",
		});
		await runReferenceJob(d, client.companyId, a.job?.id ?? "");
		const b = await runCreatorDeepAnalysis(d, agency, a.reference.id);
		expect(b.reference.analysisStatus).toBe("queued");
		await runCreatorDeepAnalysis(d, client, a.reference.id);
		expect(d.referenceQueue.jobs).toHaveLength(2);
		const job = d.referenceQueue.jobs[1];
		await runReferenceJob(d, client.companyId, job?.id ?? "");
		const cached = await runCreatorDeepAnalysis(d, client, a.reference.id);
		expect(cached.analysis).toContain("Análise simulada");
		expect(d.referenceAi.calls).toBe(2);
		expect([...d.knowledge.used.values()]).toEqual([1, 1]);
	});
	it("RN-015: trabalhador de outra empresa não coleta nem revela a referência", async () => {
		const d = setup();
		const a = await saveReferenceByUrl(d, client, post(1));
		await runReferenceJob(d, "outra", a.job?.id ?? "");
		expect(d.referenceProvider.calls).toBe(0);
		await expect(
			runCreatorDeepAnalysis(
				d,
				{ ...client, companyId: "outra" },
				a.reference.id,
			),
		).rejects.toThrow("não encontrada");
	});
	it("RN-305: exclusão durante processamento cancela a tarefa e impede regravação", async () => {
		const d = setup();
		const a = await saveReferenceByUrl(d, client, post(1));
		await d.knowledge.claimReferenceJob(
			client.companyId,
			a.job?.id ?? "",
			d.now(),
		);
		await deleteSavedReference(d, client, a.reference.id);
		await d.knowledge.finishReferenceJob(client.companyId, a.job?.id ?? "", {
			summary: "Resultado atrasado",
		});
		expect(d.knowledge.saved).toEqual([]);
		expect([...d.knowledge.used.values()]).toEqual([0]);
	});
	it("RN-305: recuperação fecha execução interrompida e reenfileira registro durável sem fila", async () => {
		const d = setup();
		const a = await saveReferenceByUrl(d, client, post(1));
		await d.knowledge.claimReferenceJob(
			client.companyId,
			a.job?.id ?? "",
			new Date("2026-11-13T14:00:00Z"),
		);
		const b = await saveReferenceByUrl(d, client, post(2));
		await recoverReferenceJobs(d);
		await recoverReferenceJobs(d);
		expect(d.knowledge.jobs.find((j) => j.id === a.job?.id)?.status).toBe(
			"failed",
		);
		expect([...d.knowledge.used.values()]).toEqual([1]);
		expect(d.referenceQueue.jobs.some((j) => j.id === b.job?.id)).toBe(true);
	});
});
