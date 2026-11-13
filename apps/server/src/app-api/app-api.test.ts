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

const clientUser: AuthenticatedUser = {
	kind: "client_user",
	userId: "user-client",
	agencyId: "agency-1",
	companyId: "company-a",
	scopes: [],
};

const agencyMember: AuthenticatedUser = {
	kind: "agency_member",
	userId: "user-agency",
	agencyId: "agency-1",
	scopes: [],
};

describe("API do app", () => {
	let apiKeys: InMemoryApiKeyRepository;
	let app: ReturnType<typeof createApp>;

	async function get(path: string, as?: AuthenticatedUser) {
		const headers: Record<string, string> = {};
		if (as) {
			const { token } = await issueApiKey(
				{ apiKeys },
				{ userId: as.userId, name: "teste", scopes: ["read", "write"] },
			);
			headers.authorization = `Bearer ${token}`;
		}
		return app.request(`/api/app${path}`, { headers });
	}

	beforeEach(() => {
		apiKeys = new InMemoryApiKeyRepository(
			new Map<string, AuthenticatedUser>([
				[clientUser.userId, clientUser],
				[agencyMember.userId, agencyMember],
			]),
		);
		app = createApp({
			authenticate: createAuthenticate({ apiKeys }),
			contents: new InMemoryContentRepository(),
			scripts: new InMemoryScriptRepository(),
			scriptAi: new FakeScriptAi(),
			quotas: new InMemoryQuotaRepository(),
			now: () => new Date(),
			companies: new InMemoryCompanyRepository([
				{ id: "company-b", agencyId: "agency-1", name: "Padaria Beta" },
				{ id: "company-a", agencyId: "agency-1", name: "Loja Alfa" },
				{ id: "company-x", agencyId: "agency-2", name: "De outra agência" },
			]),
		});
	});

	it("RN-020: sem credencial devolve 401 com a mensagem", async () => {
		const response = await get("/me");

		expect(response.status).toBe(401);
		expect(await response.json()).toEqual({
			error: "unauthorized",
			message: "Credencial ausente.",
		});
	});

	it("/me devolve quem está conectado", async () => {
		const response = await get("/me", clientUser);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			userId: "user-client",
			kind: "client_user",
			agencyId: "agency-1",
			companyId: "company-a",
			scopes: ["read", "write"],
		});
	});

	it("RN-010: a agência lista as empresas da própria agência", async () => {
		const response = await get("/companies", agencyMember);

		expect(await response.json()).toEqual({
			companies: [
				{ id: "company-b", name: "Padaria Beta" },
				{ id: "company-a", name: "Loja Alfa" },
			],
		});
	});

	it("RN-015: o cliente lista só a própria empresa", async () => {
		const response = await get("/companies", clientUser);

		expect(await response.json()).toEqual({
			companies: [{ id: "company-a", name: "Loja Alfa" }],
		});
	});

	it("RN-022: a agência abre a empresa informada na URL", async () => {
		const response = await get("/companies/company-b", agencyMember);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			id: "company-b",
			name: "Padaria Beta",
		});
	});

	it("RN-015: o cliente não abre outra empresa", async () => {
		const response = await get("/companies/company-b", clientUser);

		expect(response.status).toBe(403);
		expect(await response.json()).toEqual({
			error: "no_access",
			message: "Você não tem acesso a esta empresa.",
		});
	});

	it("RN-010: a agência não abre empresa de outra agência", async () => {
		const response = await get("/companies/company-x", agencyMember);

		expect(response.status).toBe(403);
	});
});
