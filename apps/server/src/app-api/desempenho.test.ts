import { type AuthenticatedUser, issueApiKey } from "@convergia/core";
import {
	FakeInstagramGateway,
	FakeScriptAi,
	InMemoryApiKeyRepository,
	InMemoryCompanyRepository,
	InMemoryInstagramRepository,
	InMemoryQuotaRepository,
	InMemoryScriptRepository,
	inMemoryContentDeps,
	testDiscoveryDeps,
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

type Body = {
	id?: string;
	status?: string;
	message?: string;
	authorizeUrl?: string;
	connection?: { username: string } | null;
};

describe("API do app: Instagram (RN-034 a RN-039)", () => {
	let apiKeys: InMemoryApiKeyRepository;
	let gateway: FakeInstagramGateway;
	let scriptAi: FakeScriptAi;
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

	/** A Meta devolve o navegador para o retorno, com o `state` do link. */
	const callback = async (params: Record<string, string>) => {
		const response = await app.request(
			`/api/instagram/callback?${new URLSearchParams(params)}`,
		);
		return {
			status: response.status,
			location: response.headers.get("location") ?? "",
		};
	};

	const connect = async () => {
		const started = await call(
			clientA,
			"POST",
			"/companies/company-a/instagram/connect",
			{ username: "@PadariaDoze" },
		);
		const state =
			new URL(started.body.authorizeUrl ?? "").searchParams.get("state") ?? "";
		return callback({ state, code: "codigo" });
	};

	beforeEach(() => {
		apiKeys = new InMemoryApiKeyRepository(
			new Map([clientA, clientB, agency].map((u) => [u.userId, u])),
		);
		gateway = new FakeInstagramGateway();
		scriptAi = new FakeScriptAi();
		app = createApp({
			authenticate: createAuthenticate({ apiKeys }),
			companies: new InMemoryCompanyRepository([
				{ id: "company-a", agencyId: "agency-1", name: "A" },
				{ id: "company-b", agencyId: "agency-1", name: "B" },
			]),
			...inMemoryContentDeps(),
			scripts: new InMemoryScriptRepository(),
			instagram: new InMemoryInstagramRepository(),
			instagramGateway: gateway,
			scriptAi,
			quotas: new InMemoryQuotaRepository(),
			...testDiscoveryDeps(),
			now: () => new Date("2026-11-13T12:00:00Z"),
		});
	});

	it("RN-035: o cliente conecta e volta para a tela Desempenho", async () => {
		const before = await call(clientA, "GET", "/companies/company-a/instagram");
		expect(before.body.status).toBe("not_connected");

		const back = await connect();

		expect(back).toEqual({
			status: 302,
			location: "/empresas/company-a/desempenho?instagram=conectado",
		});
		const after = await call(agency, "GET", "/companies/company-a/instagram");
		expect(after.body).toMatchObject({
			status: "connected",
			connection: { username: "padariadoze" },
		});
		expect(JSON.stringify(after.body)).not.toContain("token-");
	});

	it("RN-076: com o Instagram conectado, a geração de roteiro leva o contexto", async () => {
		await connect();
		const card = await call(agency, "POST", "/companies/company-a/contents", {
			title: "Pão de sexta",
		});
		await call(
			agency,
			"POST",
			`/companies/company-a/contents/${card.body.id}/script`,
		);

		expect(scriptAi.calls[0]?.brief.instagram?.profile.username).toBe(
			"padariadoze",
		);
	});

	it("RN-034: a agência não conecta", async () => {
		const response = await call(
			agency,
			"POST",
			"/companies/company-a/instagram/connect",
			{ username: "padariadoze" },
		);
		expect(response).toMatchObject({
			status: 403,
			body: { message: expect.stringContaining("Só o cliente conecta") },
		});
	});

	it("o retorno sem link válido não conecta e explica", async () => {
		const back = await callback({ state: "inventado", code: "x" });
		expect(back.location).toBe(
			`/instagram?${new URLSearchParams({ instagram_erro: "O link de conexão expirou. Volte ao app e conecte de novo." })}`,
		);
	});

	it("cancelar na Meta volta para a empresa com o aviso", async () => {
		const started = await call(
			clientA,
			"POST",
			"/companies/company-a/instagram/connect",
			{ username: "padariadoze" },
		);
		const state =
			new URL(started.body.authorizeUrl ?? "").searchParams.get("state") ?? "";
		const back = await callback({ state, error: "access_denied" });

		expect(back.location).toContain(
			"/empresas/company-a/desempenho?instagram_erro=",
		);
	});

	it("@ inválido é recusado na entrada", async () => {
		const response = await call(
			clientA,
			"POST",
			"/companies/company-a/instagram/connect",
			{ username: "não é um @" },
		);
		expect(response).toMatchObject({
			status: 422,
			body: { message: expect.stringContaining("Informe o @ da empresa") },
		});
	});

	it("RN-015: a empresa B não vê a conexão da A", async () => {
		await connect();
		const other = await call(clientB, "GET", "/companies/company-b/instagram");
		expect(other.body.status).toBe("not_connected");
		const foreign = await call(
			clientB,
			"GET",
			"/companies/company-a/instagram",
		);
		expect(foreign.status).toBe(403);
	});
});
