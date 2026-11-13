import { type AuthenticatedUser, issueApiKey } from "@convergia/core";
import {
	FakeScriptAi,
	InMemoryApiKeyRepository,
	InMemoryCompanyRepository,
	InMemoryContentRepository,
	InMemoryQuotaRepository,
	InMemoryScriptRepository,
} from "@convergia/core/testing";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app";
import { createAuthenticate } from "../auth/authenticate";

const clientA: AuthenticatedUser = {
	kind: "client_user",
	userId: "user-client-a",
	agencyId: "agency-1",
	companyId: "company-a",
	scopes: [],
};
const clientB: AuthenticatedUser = {
	...clientA,
	userId: "user-client-b",
	companyId: "company-b",
};
const agency: AuthenticatedUser = {
	kind: "agency_member",
	userId: "user-agency",
	agencyId: "agency-1",
	scopes: [],
};

/** O que os testes leem das respostas. */
type Body = {
	id: string;
	error?: string;
	message?: string;
	approvalStatus?: string;
	contentVersion?: number;
	deletedAt?: string | null;
	contents: { id: string }[];
};

describe("API do app: cards", () => {
	let apiKeys: InMemoryApiKeyRepository;
	let app: ReturnType<typeof createApp>;

	async function call(
		as: AuthenticatedUser,
		method: string,
		path: string,
		body?: unknown,
	) {
		const { token } = await issueApiKey(
			{ apiKeys },
			{ userId: as.userId, name: "teste", scopes: ["read", "write"] },
		);
		const response = await app.request(`/api/app${path}`, {
			method,
			headers: {
				authorization: `Bearer ${token}`,
				"content-type": "application/json",
			},
			...(body === undefined ? {} : { body: JSON.stringify(body) }),
		});
		return { status: response.status, body: (await response.json()) as Body };
	}

	beforeEach(() => {
		apiKeys = new InMemoryApiKeyRepository(
			new Map([clientA, clientB, agency].map((u) => [u.userId, u])),
		);
		app = createApp({
			authenticate: createAuthenticate({ apiKeys }),
			companies: new InMemoryCompanyRepository([
				{ id: "company-a", agencyId: "agency-1", name: "A" },
				{ id: "company-b", agencyId: "agency-1", name: "B" },
			]),
			contents: new InMemoryContentRepository(),
			scripts: new InMemoryScriptRepository(),
			scriptAi: new FakeScriptAi(),
			quotas: new InMemoryQuotaRepository(),
			now: () => new Date("2026-11-12T12:00:00Z"),
		});
	});

	it("fluxo completo: criar, editar, mover, agendar, ver no calendário", async () => {
		const created = await call(
			clientA,
			"POST",
			"/companies/company-a/contents",
			{
				title: "Reel novo",
			},
		);
		expect(created.status).toBe(201);
		const id = created.body.id;

		const edited = await call(
			agency,
			"PATCH",
			`/companies/company-a/contents/${id}`,
			{
				script: { hook: "Gancho da agência" },
			},
		);
		expect(edited.body).toMatchObject({
			approvalStatus: "in_preparation",
			contentVersion: 2,
		});

		const blocked = await call(
			agency,
			"POST",
			`/companies/company-a/contents/${id}/move`,
			{
				status: "published",
			},
		);
		expect(blocked).toEqual({
			status: 422,
			body: {
				error: "publish_without_approval",
				message:
					"Este card só pode ir para publicado depois que o cliente aprovar o roteiro.",
			},
		});

		await call(clientA, "PUT", `/companies/company-a/contents/${id}/schedule`, {
			plannedDate: "2026-11-20",
		});
		const calendar = await call(
			clientA,
			"GET",
			"/companies/company-a/calendar?from=2026-11-01&to=2026-11-30",
		);
		expect(calendar.body.contents.map((c: { id: string }) => c.id)).toEqual([
			id,
		]);
	});

	it("RN-015: o cliente da empresa B não abre os cards da A", async () => {
		const created = await call(
			clientA,
			"POST",
			"/companies/company-a/contents",
			{ title: "A" },
		);

		const byUrl = await call(
			clientB,
			"GET",
			`/companies/company-a/contents/${created.body.id}`,
		);
		const byOwnCompany = await call(
			clientB,
			"GET",
			`/companies/company-b/contents/${created.body.id}`,
		);

		expect(byUrl.status).toBe(403);
		expect(byOwnCompany).toEqual({
			status: 422,
			body: { error: "content_not_found", message: "Card não encontrado." },
		});
	});

	it("RN-018, RN-069: exclusão vai para a lixeira e volta", async () => {
		const created = await call(
			agency,
			"POST",
			"/companies/company-a/contents",
			{ title: "X" },
		);
		const id = created.body.id;

		expect(
			(await call(clientA, "DELETE", `/companies/company-a/contents/${id}`))
				.status,
		).toBe(422);
		expect(
			(await call(agency, "DELETE", `/companies/company-a/contents/${id}`))
				.status,
		).toBe(200);
		expect(
			(await call(agency, "GET", "/companies/company-a/trash")).body.contents,
		).toHaveLength(1);
		expect(
			(
				await call(
					agency,
					"POST",
					`/companies/company-a/contents/${id}/restore`,
				)
			).body.deletedAt,
		).toBeNull();
	});

	it("entrada inválida volta com a mensagem em português", async () => {
		const response = await call(
			clientA,
			"POST",
			"/companies/company-a/contents",
			{ title: "" },
		);

		expect(response.status).toBe(422);
		expect(response.body.error).toBe("invalid_input");
		expect(response.body.message).toMatch(
			/^Confira os dados enviados \(title\): /,
		);
	});
});
