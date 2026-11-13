import { beforeEach, describe, expect, it } from "vitest";
import { agency, client, readOnly } from "../../conteudo/testing/actors";
import { InstagramGatewayError } from "../ports/instagram-gateway";
import {
	FakeInstagramGateway,
	InMemoryInstagramRepository,
	testPost,
	unavailable,
} from "../testing/fakes";
import {
	completeInstagramConnection,
	getInstagramConnection,
	type InstagramDeps,
	refreshInstagramConnections,
	startInstagramConnection,
} from "./instagram-connection";

const DAY = 86_400_000;

describe("conexão do Instagram", () => {
	let now: Date;
	let instagram: InMemoryInstagramRepository;
	let gateway: FakeInstagramGateway;
	let deps: InstagramDeps;

	beforeEach(() => {
		now = new Date("2026-11-13T12:00:00Z");
		instagram = new InMemoryInstagramRepository();
		gateway = new FakeInstagramGateway(() => now);
		deps = { instagram, instagramGateway: gateway, now: () => now };
	});

	/** O cliente pede o link e a Meta devolve com o `state` dele. */
	const connect = async (
		username = "padariadoze",
		callback: { code?: string | null; error?: string | null } = {},
	) => {
		const { authorizeUrl } = await startInstagramConnection(deps, client, {
			username,
		});
		const state = new URL(authorizeUrl).searchParams.get("state");
		return completeInstagramConnection(deps, {
			state,
			code: callback.code === undefined ? "codigo" : callback.code,
			error: callback.error ?? null,
		});
	};

	it("RN-035, RN-039: o cliente conecta e o perfil e os posts recentes ficam guardados", async () => {
		gateway.posts = [testPost(), testPost({ id: "post-2", caption: null })];

		const outcome = await connect("@PadariaDoze");

		expect(outcome.error).toBeNull();
		expect(outcome.companyId).toBe(client.companyId);
		expect(outcome.connection).toMatchObject({
			username: "padariadoze",
			igUserId: "ig-1",
			connectedByUserId: client.userId,
			simulated: false,
			snapshot: {
				profile: { biography: "Pães de fermentação natural em Viçosa." },
				collectedAt: now,
			},
		});
		expect(outcome.connection?.snapshot?.posts).toHaveLength(2);
		// O token não sai do repositório.
		expect(JSON.stringify(outcome.connection)).not.toContain("token-");
		expect(await getInstagramConnection(deps, agency)).toMatchObject({
			status: "connected",
			connection: { username: "padariadoze" },
		});
	});

	it("RN-034: a agência não conecta o Instagram da empresa", async () => {
		await expect(
			startInstagramConnection(deps, agency, { username: "padariadoze" }),
		).rejects.toThrow("Só o cliente conecta o Instagram da empresa.");
	});

	it("RN-024: conexão só de leitura não conecta", async () => {
		await expect(
			startInstagramConnection(deps, readOnly, { username: "padariadoze" }),
		).rejects.toThrow("Esta conexão é só de leitura.");
	});

	it("sem o app da Meta configurado, avisa em vez de conectar", async () => {
		gateway.configured = false;
		expect(await getInstagramConnection(deps, client)).toEqual({
			status: "not_configured",
			connection: null,
		});
		await expect(
			startInstagramConnection(deps, client, { username: "padariadoze" }),
		).rejects.toThrow("A conexão com o Instagram ainda não foi configurada");
	});

	it("RN-035: entrar com outra conta não conecta", async () => {
		const outcome = await connect("outraconta");

		expect(outcome.error?.message).toBe(
			"Você entrou com @padariadoze, mas informou @outraconta. Entre com a conta da empresa ou informe o @ certo.",
		);
		expect(await instagram.find(client.companyId)).toBeNull();
	});

	it("o link vale uma vez só e expira", async () => {
		const { authorizeUrl } = await startInstagramConnection(deps, client, {
			username: "padariadoze",
		});
		const state = new URL(authorizeUrl).searchParams.get("state");
		const callback = { state, code: "codigo", error: null };

		expect(
			(await completeInstagramConnection(deps, callback)).error,
		).toBeNull();
		const reused = await completeInstagramConnection(deps, callback);
		expect(reused).toMatchObject({ companyId: null });
		expect(reused.error?.message).toBe(
			"O link de conexão expirou. Volte ao app e conecte de novo.",
		);

		const late = await startInstagramConnection(deps, client, {
			username: "padariadoze",
		});
		now = new Date(now.getTime() + 16 * 60_000);
		const expired = await completeInstagramConnection(deps, {
			state: new URL(late.authorizeUrl).searchParams.get("state"),
			code: "codigo",
			error: null,
		});
		expect(expired.error?.message).toContain("O link de conexão expirou");
		expect(
			(
				await completeInstagramConnection(deps, {
					state: null,
					code: "x",
					error: null,
				})
			).error?.message,
		).toContain("O link de conexão expirou");
	});

	it("cancelar na Meta volta para a empresa com o aviso", async () => {
		const outcome = await connect("padariadoze", {
			code: null,
			error: "access_denied",
		});

		expect(outcome.companyId).toBe(client.companyId);
		expect(outcome.error?.message).toBe(
			"A conexão foi cancelada no Instagram. Tente de novo quando quiser.",
		);
		expect(gateway.exchangedCodes).toEqual([]);
	});

	it("RN-036: conta que não é Profissional não conecta", async () => {
		gateway.failWith = new InstagramGatewayError(
			"not_professional",
			"conta pessoal",
		);
		expect((await connect()).error?.message).toContain(
			"Esta conta não é Profissional.",
		);
	});

	it("Instagram fora do ar vira mensagem, sem gravar nada", async () => {
		gateway.failWith = unavailable();
		expect((await connect()).error?.message).toBe(
			"O Instagram não respondeu. Tente de novo em instantes.",
		);
		expect(await instagram.find(client.companyId)).toBeNull();
	});

	it("RN-037: reconectar substitui a conexão anterior", async () => {
		await connect();
		gateway.profile = { ...gateway.profile, biography: "Bio nova" };

		await connect();

		const connection = await instagram.find(client.companyId);
		expect(connection?.snapshot?.profile.biography).toBe("Bio nova");
		expect(await instagram.listConnectedCompanyIds()).toEqual([
			client.companyId,
		]);
	});

	it("o job renova o token perto de expirar e atualiza o retrato", async () => {
		await connect();
		gateway.posts = [testPost({ id: "novo", likeCount: 999 })];

		// Ainda longe de expirar: só atualiza o retrato.
		now = new Date(now.getTime() + 10 * DAY);
		expect(await refreshInstagramConnections(deps)).toEqual({
			refreshed: 1,
			failed: 0,
		});
		expect(gateway.refreshedTokens).toEqual([]);
		expect(
			(await instagram.find(client.companyId))?.snapshot?.posts[0]?.likeCount,
		).toBe(999);

		// Faltando menos de 30 dias: renova antes.
		now = new Date(now.getTime() + 25 * DAY);
		await refreshInstagramConnections(deps);
		expect(gateway.refreshedTokens).toEqual(["token-1"]);
		expect((await instagram.findToken(client.companyId))?.accessToken).toBe(
			"token-2",
		);
	});

	it("o job segue quando uma empresa falha", async () => {
		await connect();
		gateway.failWith = unavailable();

		expect(await refreshInstagramConnections(deps)).toEqual({
			refreshed: 0,
			failed: 1,
		});
	});
});
