import { describe, expect, it } from "vitest";
import { InMemoryCompanyRepository } from "../acesso/testing/in-memory-company-repository";
import { inMemoryContentDeps } from "../aprovacao/testing/content-deps";
import { sourceInput } from "../conteudo/source";
import { agency, client } from "../conteudo/testing/actors";
import { createContents } from "../conteudo/use-cases/create-contents";
import {
	addContentSource,
	createContentSourceUpload,
	retryContentSource,
} from "../conteudo/use-cases/sources";
import { briefFor } from "../roteiros/use-cases/deps";
import { referenceInput } from "./knowledge";
import {
	attachContentReference,
	deleteSavedReference,
	detachContentReference,
	listContentReferences,
	runCreatorDeepAnalysis,
	saveReferenceByUrl,
} from "./use-cases";

describe("Referências e fontes", () => {
	const setup = async () => {
		const d = inMemoryContentDeps();
		const [card] = await createContents(d, client, [{ title: "Card" }]);
		if (!card) throw Error();
		return { ...d, card };
	};
	it("RN-068: anexar e remover referência não muda conteúdo nem aprovação", async () => {
		const d = await setup();
		const r = await attachContentReference(d, agency, d.card.id, {
			title: "Link",
			url: "https://example.com",
			kind: "link",
		});
		expect(
			(await d.contents.find(client.companyId, d.card.id))?.contentVersion,
		).toBe(1);
		expect(
			(await d.contents.find(client.companyId, d.card.id))?.approvalStatus,
		).toBe("none");
		await detachContentReference(d, client, d.card.id, r.id);
		expect(await listContentReferences(d, client, d.card.id)).toEqual([]);
	});
	it("RN-015: outra empresa não lista nem remove vínculo", async () => {
		const d = await setup();
		const r = await attachContentReference(d, client, d.card.id, {
			title: "Link",
			url: "https://example.com",
			kind: "link",
		});
		const other = { ...client, companyId: "other" };
		await expect(listContentReferences(d, other, d.card.id)).rejects.toThrow();
		await expect(
			detachContentReference(d, other, d.card.id, r.id),
		).rejects.toThrow();
	});
	it("RN-090, RN-093: salva uma referência e limita a um criador por empresa", async () => {
		const d = await setup();
		const first = await saveReferenceByUrl(d, client, {
			url: "https://www.instagram.com/criador/",
		});
		expect(first.reference.status).toBe("queued");
		await expect(
			saveReferenceByUrl(d, client, {
				url: "https://www.instagram.com/outro/",
			}),
		).rejects.toThrow("1 criador");
		expect(d.referenceQueue.jobs).toHaveLength(1);
	});
	it("RN-092: análise salva é devolvida sem depender da cota em aberto", async () => {
		const d = await setup();
		d.knowledge.saved.push({
			id: "creator",
			companyId: client.companyId,
			url: "https://www.instagram.com/creator/",
			kind: "creator",
			status: "ready",
			text: "Bio pública",
			analysis: "Pilares e tom de voz",
			error: null,
		});
		expect((await runCreatorDeepAnalysis(d, client, "creator")).analysis).toBe(
			"Pilares e tom de voz",
		);
		const creator = d.knowledge.saved[0];
		if (!creator) throw new Error("Criador não encontrado");
		creator.analysis = null;
		await expect(runCreatorDeepAnalysis(d, client, "creator")).rejects.toThrow(
			"Aguarde a coleta",
		);
	});
	it("RN-091: excluir uma referência é definitivo e isolado", async () => {
		const d = await setup();
		d.knowledge.saved.push({
			id: "ref",
			companyId: client.companyId,
			url: "https://www.instagram.com/p/abc/",
			kind: "post",
			status: "ready",
			text: null,
			analysis: null,
			error: null,
		});
		await expect(
			deleteSavedReference(d, { ...client, companyId: "other" }, "ref"),
		).rejects.toThrow();
		await deleteSavedReference(d, client, "ref");
		expect(await d.knowledge.listSaved(client.companyId)).toEqual([]);
	});
	it("RN-076: roteiro recebe só fontes prontas e referências anexadas da empresa", async () => {
		const d = await setup();
		await attachContentReference(d, client, d.card.id, {
			title: "Artigo",
			url: "https://example.com",
			kind: "link",
		});
		d.sources.rows.push(
			{
				id: "s1",
				companyId: client.companyId,
				contentId: d.card.id,
				kind: "text",
				status: "ready",
				text: "Texto extraído",
				url: null,
				error: null,
			},
			{
				id: "s2",
				companyId: client.companyId,
				contentId: d.card.id,
				kind: "text",
				status: "failed",
				text: "Não usar",
				url: null,
				error: "Falha",
			},
		);
		const brief = await briefFor(
			{
				...d,
				companies: new InMemoryCompanyRepository([
					{ id: client.companyId, agencyId: client.agencyId, name: "Empresa" },
				]),
			},
			client,
			d.card,
		);
		expect(brief.sources).toHaveLength(1);
		expect(brief.references?.[0]?.title).toBe("Artigo");
	});
	it("RN-066: texto tem de 200 a 150.000 caracteres e PDF exige upload válido", () => {
		expect(
			sourceInput.safeParse({ kind: "text", text: "a".repeat(199) }).success,
		).toBe(false);
		expect(
			sourceInput.safeParse({ kind: "text", text: "a".repeat(200) }).success,
		).toBe(true);
		expect(
			sourceInput.safeParse({ kind: "text", text: "a".repeat(150001) }).success,
		).toBe(false);
		expect(
			sourceInput.safeParse({ kind: "pdf", uploadId: "invalido" }).success,
		).toBe(false);
	});
	it("RN-035: aceita só links públicos de terceiros no domínio Instagram", () => {
		for (const url of [
			"http://instagram.com/criador",
			"https://instagram.com.evil.test/p/abc",
			"https://usuario:senha@instagram.com/p/abc",
			"https://instagram.com/",
		])
			expect(referenceInput.safeParse({ url }).success).toBe(false);
		expect(
			referenceInput.safeParse({ url: "https://www.instagram.com/p/abc/" })
				.success,
		).toBe(true);
	});
	it("Q-21: adicionar e pedir upload não extrai nem cria objetos", async () => {
		const d = await setup();
		await expect(addContentSource(d, client, d.card.id)).rejects.toThrow(
			"Q-21",
		);
		await expect(
			createContentSourceUpload(d, client, d.card.id),
		).rejects.toThrow("Q-21");
		expect(d.sources.rows).toEqual([]);
	});
	it("RN-015: repetir extração confere empresa e card antes da cota", async () => {
		const d = await setup();
		await expect(
			retryContentSource(d, { ...client, companyId: "other" }, d.card.id, "s1"),
		).rejects.toThrow("Card não encontrado");
	});
});
