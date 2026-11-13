import { type AuthenticatedUser, issueApiKey } from "@convergia/core";
import {
	FakeScriptAi,
	InMemoryApiKeyRepository,
	InMemoryCompanyRepository,
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
	error?: string;
	message?: string;
	contentVersion?: number;
	content?: { id: string; approvalStatus: string; contentVersion: number };
	request?: { status: string; decidedOnBehalf: boolean; reason: string | null };
	items?: { content: { id: string }; request: { reason: string | null } }[];
	changedSinceSubmit?: boolean;
	history?: { type: string }[];
};

describe("API do app: aprovação", () => {
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

	const approval = (id: string) =>
		`/companies/company-a/contents/${id}/approval`;

	/** Card com roteiro da agência, enviado para aprovação. */
	const sentCard = async () => {
		const created = await call(
			agency,
			"POST",
			"/companies/company-a/contents",
			{
				title: "Reel",
				script: { hook: "Gancho" },
			},
		);
		const id = created.body.id ?? "";
		const sent = await call(agency, "POST", `${approval(id)}/submit`);
		expect(sent.status).toBe(200);
		return { id, version: sent.body.content?.contentVersion ?? 0 };
	};

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
			...inMemoryContentDeps(),
			scripts: new InMemoryScriptRepository(),
			scriptAi: new FakeScriptAi(),
			quotas: new InMemoryQuotaRepository(),
			...testDiscoveryDeps(),
			now: () => new Date("2026-11-13T12:00:00Z"),
		});
	});

	it("RN-210, RN-211: a agência envia e o cliente vê na lista e aprova", async () => {
		const { id, version } = await sentCard();

		const pending = await call(
			clientA,
			"GET",
			"/companies/company-a/approvals?view=pending",
		);
		expect(pending.body.items?.map((item) => item.content.id)).toEqual([id]);

		const approved = await call(clientA, "POST", `${approval(id)}/approve`, {
			version,
		});
		expect(approved.status).toBe(200);
		expect(approved.body.content?.approvalStatus).toBe("approved");

		const detail = await call(clientA, "GET", approval(id));
		expect(detail.body.history?.map((e) => e.type)).toEqual([
			"submitted",
			"approved",
		]);
	});

	it("RN-216: versão desatualizada responde 409 com a mensagem do §7", async () => {
		const { id, version } = await sentCard();
		await call(agency, "PATCH", `/companies/company-a/contents/${id}`, {
			script: { hook: "Outro gancho" },
		});

		const detail = await call(clientA, "GET", approval(id));
		expect(detail.body.changedSinceSubmit).toBe(true);
		const stale = await call(clientA, "POST", `${approval(id)}/reject`, {
			version,
		});
		expect(stale).toMatchObject({
			status: 409,
			body: {
				error: "approval_version_changed",
				message: "O item foi atualizado pela agência. Revise a versão nova.",
			},
		});
	});

	it("RN-214: a agência aprova em nome do cliente com motivo e não recusa", async () => {
		const { id, version } = await sentCard();

		const noReason = await call(agency, "POST", `${approval(id)}/approve`, {
			version,
		});
		expect(noReason.status).toBe(422);
		const rejected = await call(agency, "POST", `${approval(id)}/reject`, {
			version,
		});
		expect(rejected.body.message).toBe("Só o cliente pode recusar.");

		const approved = await call(agency, "POST", `${approval(id)}/approve`, {
			version,
			onBehalfReason: "Aprovou por WhatsApp",
		});
		expect(approved.body.request).toMatchObject({
			status: "approved",
			decidedOnBehalf: true,
			reason: "Aprovou por WhatsApp",
		});
	});

	it("RN-212, RN-218: recusa com motivo e cancelamento pela agência", async () => {
		const first = await sentCard();
		await call(clientA, "POST", `${approval(first.id)}/reject`, {
			version: first.version,
			reason: "Gancho fraco",
		});
		const rejected = await call(
			agency,
			"GET",
			"/companies/company-a/approvals?view=rejected",
		);
		expect(rejected.body.items?.[0]?.request.reason).toBe("Gancho fraco");

		const second = await sentCard();
		const byClient = await call(
			clientA,
			"POST",
			`${approval(second.id)}/cancel`,
		);
		expect(byClient.status).toBe(422);
		const cancelled = await call(
			agency,
			"POST",
			`${approval(second.id)}/cancel`,
		);
		expect(cancelled.body.content?.approvalStatus).toBe("in_preparation");
	});

	it("RN-200: o cliente não envia o próprio card", async () => {
		const created = await call(
			clientA,
			"POST",
			"/companies/company-a/contents",
			{
				title: "Meu",
				script: { hook: "Meu gancho" },
			},
		);
		const sent = await call(
			clientA,
			"POST",
			`${approval(created.body.id ?? "")}/submit`,
		);
		expect(sent.body.message).toBe(
			"Itens criados por você não precisam de aprovação.",
		);
	});

	it("RN-015: a empresa B não vê nem decide", async () => {
		const { id, version } = await sentCard();
		const other = await call(
			clientB,
			"POST",
			`/companies/company-b/contents/${id}/approval/approve`,
			{ version },
		);
		expect(other.body.message).toBe("Card não encontrado.");
		const foreignUrl = await call(clientB, "GET", approval(id));
		expect(foreignUrl.status).toBe(403);
		const list = await call(
			clientB,
			"GET",
			"/companies/company-b/approvals?view=pending",
		);
		expect(list.body.items).toEqual([]);
	});
});
