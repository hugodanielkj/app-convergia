import type { AuthenticatedUser } from "@convergia/core";
import {
	FakeScriptAi,
	InMemoryCompanyRepository,
	InMemoryQuotaRepository,
	InMemoryScriptRepository,
	inMemoryContentDeps,
	testDiscoveryDeps,
} from "@convergia/core/testing";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createAppApi } from "./index";

const user: AuthenticatedUser = {
	kind: "client_user",
	userId: "client-a",
	agencyId: "agency-a",
	companyId: "company-a",
	scopes: ["read", "write"],
};
function setup(as = user) {
	const memory = inMemoryContentDeps();
	const app = createAppApi({
		...memory,
		...testDiscoveryDeps(),
		quotas: new InMemoryQuotaRepository(),
		scripts: new InMemoryScriptRepository(),
		scriptAi: new FakeScriptAi(),
		companies: new InMemoryCompanyRepository([
			{ id: "company-a", agencyId: "agency-a", name: "Empresa A" },
			{ id: "company-b", agencyId: "agency-a", name: "Empresa B" },
		]),
		now: () => new Date(),
		authenticate: async () => as,
	});
	return { app, ...memory };
}
const post = (json: unknown) => ({
	method: "POST",
	headers: { "content-type": "application/json" },
	body: JSON.stringify(json),
});
describe("API do passo 8", () => {
	it("RN-080, RN-082: gera, lista e converte ideia em card nos mesmos dados", async () => {
		const { app, contents } = setup();
		const response = await app.request(
			"/companies/company-a/ideas",
			post({ brief: "Bastidores" }),
		);
		expect(response.status).toBe(200);
		const { ideas } = z
			.object({ ideas: z.array(z.object({ id: z.string() })) })
			.parse(await response.json());
		const id = ideas[0]?.id;
		if (!id) throw new Error("Nenhuma ideia retornada");
		expect(
			(await app.request(`/companies/company-a/ideas/${id}/accept`, post({})))
				.status,
		).toBe(200);
		expect(contents.rows).toHaveLength(1);
		const listed = await app.request("/companies/company-a/ideas");
		expect(await listed.json()).toMatchObject({ ideas: [] });
	});
	it("RN-015: cliente não acessa nem grava ideias e referências de outra empresa", async () => {
		const { app } = setup();
		for (const path of ["ideas", "references"]) {
			expect((await app.request(`/companies/company-b/${path}`)).status).toBe(
				403,
			);
		}
		expect(
			(await app.request("/companies/company-b/ideas", post({ brief: "Tema" })))
				.status,
		).toBe(403);
	});
	it("valida a entrada na borda com HTTP 422", async () => {
		const { app } = setup();
		expect(
			(await app.request("/companies/company-a/ideas", post({ brief: "" })))
				.status,
		).toBe(422);
		expect(
			(
				await app.request(
					"/companies/company-a/references",
					post({ url: "https://example.com" }),
				)
			).status,
		).toBe(422);
	});
	it("RN-024: leitura não gera nem descarta ideias", async () => {
		const { app } = setup({ ...user, scopes: ["read"] });
		expect(
			(await app.request("/companies/company-a/ideas", post({ brief: "Tema" })))
				.status,
		).toBe(422);
	});
	it("Q-17, Q-21: coleta bloqueada devolve 501 e não grava dados", async () => {
		const { app, knowledge } = setup();
		for (const [url, questionId] of [
			["https://www.instagram.com/criador/", "Q-17"],
			["https://www.instagram.com/p/abc/", "Q-21"],
		]) {
			const r = await app.request(
				"/companies/company-a/references",
				post({ url }),
			);
			expect(r.status).toBe(501);
			expect(await r.json()).toMatchObject({ questionId });
		}
		expect(knowledge.saved).toEqual([]);
	});
});
