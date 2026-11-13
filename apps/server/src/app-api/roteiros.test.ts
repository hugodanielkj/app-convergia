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

type Citation = { title: string; url: string };
type Message = {
	id: string;
	role: string;
	previewStatus: string | null;
	sources: Citation[];
};
type Body = {
	id: string;
	error?: string;
	questionId?: string;
	message?: string | Message;
	script?: { hook: string | null };
	approvalStatus?: string;
	citations?: Citation[];
	content?: { script: { hook: string | null }; citations: Citation[] };
	messages?: Message[];
	entries?: { kind: string; createdByKind: string; createdAt: string }[];
};

describe("API do app: roteiros (RN-006)", () => {
	let apiKeys: InMemoryApiKeyRepository;
	let app: ReturnType<typeof createApp>;
	let scriptAi: FakeScriptAi;
	let tokens: Map<string, string>;

	async function call(
		as: AuthenticatedUser,
		method: string,
		path: string,
		body?: unknown,
	) {
		let token = tokens.get(as.userId);
		if (!token) {
			({ token } = await issueApiKey(
				{ apiKeys },
				{ userId: as.userId, name: "teste", scopes: ["read", "write"] },
			));
			tokens.set(as.userId, token);
		}
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

	const newCard = async () =>
		(
			await call(clientA, "POST", "/companies/company-a/contents", {
				title: "Sofá retrátil",
			})
		).body.id;

	beforeEach(() => {
		apiKeys = new InMemoryApiKeyRepository(
			new Map([clientA, clientB, agency].map((u) => [u.userId, u])),
		);
		scriptAi = new FakeScriptAi();
		tokens = new Map();
		app = createApp({
			authenticate: createAuthenticate({ apiKeys }),
			companies: new InMemoryCompanyRepository([
				{ id: "company-a", agencyId: "agency-1", name: "A" },
				{ id: "company-b", agencyId: "agency-1", name: "B" },
			]),
			contents: new InMemoryContentRepository(),
			scripts: new InMemoryScriptRepository(),
			scriptAi,
			quotas: new InMemoryQuotaRepository(),
			now: () => new Date("2026-11-12T12:00:00Z"),
		});
	});

	it("gera o roteiro de um card e devolve o card atualizado", async () => {
		const id = await newCard();
		const generated = await call(
			clientA,
			"POST",
			`/companies/company-a/contents/${id}/script`,
		);
		expect(generated.status).toBe(200);
		expect(generated.body.script?.hook).toBe("Gancho sobre Sofá retrátil");
	});

	it("RN-203: a agência gera dentro do cliente e o roteiro fica em preparo", async () => {
		const id = await newCard();
		const generated = await call(
			agency,
			"POST",
			`/companies/company-a/contents/${id}/script`,
		);
		expect(generated.body.approvalStatus).toBe("in_preparation");
	});

	it("refina, lista a conversa e aplica a prévia", async () => {
		const id = await newCard();
		const path = `/companies/company-a/contents/${id}/refine`;
		const refined = await call(clientA, "POST", path, {
			message: "gancho mais curto",
		});
		expect(refined.status).toBe(200);
		const preview = refined.body.messages?.[1]?.id;

		const chat = await call(clientA, "GET", path);
		expect(chat.body.messages).toHaveLength(2);

		const applied = await call(clientA, "POST", `${path}/${preview}/apply`);
		expect(applied.status).toBe(200);
		expect(applied.body.content?.script.hook).toBe(
			"Novo gancho (gancho mais curto)",
		);

		const again = await call(clientA, "POST", `${path}/${preview}/discard`);
		expect(again.status).toBe(409);
		expect(again.body.message).toBe(
			"Esta prévia não está mais disponível. Peça um novo refino.",
		);
	});

	it("RN-075: refino com pesquisa devolve as fontes e aplicar leva ao card", async () => {
		const id = await newCard();
		const path = `/companies/company-a/contents/${id}/refine`;
		const plain = await call(clientA, "POST", path, { message: "sem busca" });
		expect(plain.body.messages?.[1]?.sources).toEqual([]);
		expect(scriptAi.calls[0]?.webSearch).toBe(false);

		const refined = await call(clientA, "POST", path, {
			message: "com dados",
			webSearch: true,
		});
		expect(scriptAi.calls[1]?.webSearch).toBe(true);
		const source = {
			title: "Fonte sobre com dados",
			url: "https://example.com/fonte",
		};
		expect(refined.body.messages?.[1]?.sources).toEqual([source]);

		const applied = await call(
			clientA,
			"POST",
			`${path}/${refined.body.messages?.[1]?.id}/apply`,
		);
		expect(applied.body.content?.citations).toEqual([source]);
		const card = await call(
			clientA,
			"GET",
			`/companies/company-a/contents/${id}`,
		);
		expect(card.body.citations).toEqual([source]);
	});

	it("RN-074: aplicar prévia em card alterado devolve 409 com a mensagem do §7", async () => {
		const id = await newCard();
		const path = `/companies/company-a/contents/${id}/refine`;
		const refined = await call(clientA, "POST", path, { message: "pedido" });
		await call(clientA, "PATCH", `/companies/company-a/contents/${id}`, {
			script: { cta: "Comente" },
		});
		const applied = await call(
			clientA,
			"POST",
			`${path}/${refined.body.messages?.[1]?.id}/apply`,
		);
		expect(applied).toMatchObject({
			status: 409,
			body: {
				error: "stale_preview",
				message: "O card mudou depois desta prévia. Gere uma nova.",
			},
		});
	});

	it("RN-300: cota esgotada devolve 429 com a mensagem do §7", async () => {
		const id = await newCard();
		for (let i = 0; i < 10; i++) {
			await call(clientA, "POST", `/companies/company-a/contents/${id}/script`);
		}
		const blocked = await call(
			agency,
			"POST",
			`/companies/company-a/contents/${id}/script`,
		);
		expect(blocked).toMatchObject({
			status: 429,
			body: {
				error: "quota_exhausted",
				message:
					"A cota diária de gerar roteiro desta empresa acabou (10 por dia). Tente amanhã.",
			},
		});
	});

	it("valida o pedido de refino e a decisão sobre a prévia", async () => {
		const id = await newCard();
		const path = `/companies/company-a/contents/${id}/refine`;
		expect((await call(clientA, "POST", path, { message: "" })).status).toBe(
			422,
		);
		expect(
			(await call(clientA, "POST", path, { message: "x", webSearch: "sim" }))
				.status,
		).toBe(422);
		expect(
			(await call(clientA, "POST", `${path}/qualquer/aceitar`)).status,
		).toBe(422);
		expect(scriptAi.calls).toHaveLength(0);
	});

	it("RN-015: a empresa B não gera, não refina e não lê o refino da A", async () => {
		const id = await newCard();
		await call(clientA, "POST", `/companies/company-a/contents/${id}/refine`, {
			message: "pedido",
		});
		for (const [method, suffix, body] of [
			["POST", "script", undefined],
			["POST", "refine", { message: "x" }],
			["GET", "refine", undefined],
		] as const) {
			const own = await call(
				clientB,
				method,
				`/companies/company-b/contents/${id}/${suffix}`,
				body,
			);
			expect(own.body.message).toBe("Card não encontrado.");
			const other = await call(
				clientB,
				method,
				`/companies/company-a/contents/${id}/${suffix}`,
				body,
			);
			expect(other.status).toBe(403);
		}
	});

	describe("opções avulsas (RN-071)", () => {
		const optionsPath = (company: string, id: string, field: string) =>
			`/companies/${company}/contents/${id}/options/${field}`;

		it("Q-21: sem cota decidida, devolve 501 com a pergunta em aberto", async () => {
			const id = await newCard();
			const blocked = await call(
				clientA,
				"POST",
				optionsPath("company-a", id, "hook"),
				{},
			);
			expect(blocked).toMatchObject({
				status: 501,
				body: {
					error: "not_decided_yet",
					questionId: "Q-21",
					message:
						"Esta funcionalidade depende de uma regra ainda não definida (Q-21).",
				},
			});
			expect(scriptAi.calls).toHaveLength(0);
		});

		it("valida a parte do roteiro e a quantidade", async () => {
			const id = await newCard();
			for (const [field, body] of [
				["titulo", {}],
				["hook", { count: 4 }],
				["hook", { count: 0 }],
			] as const) {
				const result = await call(
					clientA,
					"POST",
					optionsPath("company-a", id, field),
					body,
				);
				expect(result.status).toBe(422);
			}
		});

		it("RN-015: a empresa B não pede opções de um card da A", async () => {
			const id = await newCard();
			const own = await call(
				clientB,
				"POST",
				optionsPath("company-b", id, "cta"),
				{},
			);
			expect(own.body.message).toBe("Card não encontrado.");
			const other = await call(
				clientB,
				"POST",
				optionsPath("company-a", id, "cta"),
				{},
			);
			expect(other.status).toBe(403);
		});
	});

	describe("histórico de gerações (RN-072)", () => {
		const historyPath = (company: string, id: string) =>
			`/companies/${company}/contents/${id}/history`;

		it("lista as gerações do card, das mais novas para as mais antigas", async () => {
			const id = await newCard();
			const empty = await call(clientA, "GET", historyPath("company-a", id));
			expect(empty).toMatchObject({ status: 200, body: { entries: [] } });

			await call(clientA, "POST", `/companies/company-a/contents/${id}/script`);
			const history = await call(clientA, "GET", historyPath("company-a", id));
			expect(history.body.entries).toHaveLength(1);
			expect(history.body.entries?.[0]).toMatchObject({
				kind: "script",
				createdByKind: "client",
			});
			expect(typeof history.body.entries?.[0]?.createdAt).toBe("string");
		});

		it("Q-23: o cliente ver o trabalho da agência devolve 501", async () => {
			const id = await newCard();
			await call(agency, "POST", `/companies/company-a/contents/${id}/script`);
			expect(
				(await call(agency, "GET", historyPath("company-a", id))).status,
			).toBe(200);
			const client = await call(clientA, "GET", historyPath("company-a", id));
			expect(client).toMatchObject({
				status: 501,
				body: { error: "not_decided_yet", questionId: "Q-23" },
			});
		});

		it("RN-015: a empresa B não lê o histórico da A", async () => {
			const id = await newCard();
			const own = await call(clientB, "GET", historyPath("company-b", id));
			expect(own.body.message).toBe("Card não encontrado.");
			const other = await call(clientB, "GET", historyPath("company-a", id));
			expect(other.status).toBe(403);
		});
	});
});
