import { describe, expect, it } from "vitest";
import { InMemoryCompanyRepository } from "../acesso/testing/in-memory-company-repository";
import { agency, client } from "../conteudo/testing/actors";
import { InMemoryContentRepository } from "../conteudo/testing/in-memory-content-repository";
import { InMemoryQuotaRepository } from "../cotas/testing/in-memory-quota-repository";
import { FakeBrainstormAi, InMemoryIdeaRepository } from "./testing";
import {
	acceptBrainstormSuggestion,
	dismissBrainstormSuggestion,
	listBrainstormSuggestions,
	regenerateBrainstorm,
} from "./use-cases";

const setup = () => {
	const contents = new InMemoryContentRepository();
	const companies = new InMemoryCompanyRepository([
		{ id: client.companyId, agencyId: client.agencyId, name: "Empresa" },
	]);
	return {
		contents,
		companies,
		ideas: new InMemoryIdeaRepository(contents),
		brainstormAi: new FakeBrainstormAi(),
		quotas: new InMemoryQuotaRepository(),
		now: () => new Date("2026-11-13T15:00:00Z"),
	};
};
describe("Ideias", () => {
	it("RN-080: regenerar substitui o conjunto ativo", async () => {
		const d = setup();
		const first = await regenerateBrainstorm(d, client, { brief: "Dicas" });
		const next = await regenerateBrainstorm(d, client, { brief: "Dicas" });
		expect(await listBrainstormSuggestions(d, client)).toEqual(next);
		expect(
			(await d.ideas.find(client.companyId, first[0]?.id ?? ""))?.state,
		).toBe("dismissed");
	});
	it("RN-082: aceitar cria um único card sem IA, na coluna ideia", async () => {
		const d = setup();
		const [idea] = await regenerateBrainstorm(d, client, { brief: "Dicas" });
		const a = await acceptBrainstormSuggestion(d, client, idea?.id ?? "");
		const b = await acceptBrainstormSuggestion(d, client, idea?.id ?? "");
		expect(a.id).toBe(b.id);
		expect(a.status).toBe("idea");
		expect(a.script.body).toBeNull();
		expect(d.contents.rows).toHaveLength(1);
	});
	it("RN-083: ideia da agência exige aprovação antes de virar card", async () => {
		const d = setup();
		const [idea] = await regenerateBrainstorm(d, agency, { brief: "Dicas" });
		expect(idea?.approvalStatus).toBe("in_preparation");
		await expect(
			acceptBrainstormSuggestion(d, client, idea?.id ?? ""),
		).rejects.toThrow("aprovação");
	});
	it("RN-084: ideia aprovada continua ativa até Virar card", async () => {
		const d = setup();
		const [idea] = await regenerateBrainstorm(d, agency, { brief: "Dicas" });
		const subject = d.ideas.subjects.rows[0];
		if (!subject) throw Error();
		subject.approvalStatus = "approved";
		expect(d.contents.rows).toHaveLength(0);
		await acceptBrainstormSuggestion(d, client, idea?.id ?? "");
		expect(d.contents.rows).toHaveLength(1);
	});
	it("RN-015: outra empresa não lista, aceita nem descarta ideias", async () => {
		const d = setup();
		const [idea] = await regenerateBrainstorm(d, client, { brief: "Dicas" });
		const other = { ...client, companyId: "company-b" };
		expect(await listBrainstormSuggestions(d, other)).toEqual([]);
		await expect(
			acceptBrainstormSuggestion(d, other, idea?.id ?? ""),
		).rejects.toThrow("não encontrada");
		await expect(
			dismissBrainstormSuggestion(d, other, idea?.id ?? ""),
		).rejects.toThrow("não encontrada");
	});
	it("RN-303: brainstorm tem 5 gerações compartilhadas por dia", async () => {
		const d = setup();
		for (let n = 0; n < 5; n++)
			await regenerateBrainstorm(d, n % 2 ? agency : client, {
				brief: "Dicas",
			});
		await expect(
			regenerateBrainstorm(d, client, { brief: "Dicas" }),
		).rejects.toThrow("5 por dia");
	});
	it("RN-305: falha da IA preserva conjunto e devolve cota", async () => {
		const d = setup();
		const old = await regenerateBrainstorm(d, client, { brief: "Dicas" });
		d.brainstormAi.fail = true;
		await expect(
			regenerateBrainstorm(d, client, { brief: "Dicas" }),
		).rejects.toThrow("IA indisponível");
		expect(await listBrainstormSuggestions(d, client)).toEqual(old);
		expect([...d.quotas.used.values()]).toEqual([1]);
	});
});
