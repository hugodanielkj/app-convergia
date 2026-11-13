import { InstagramGatewayError } from "@convergia/core";
import { describe, expect, it } from "vitest";
import { chooseInstagram } from "./choose-gateway";
import { createGraphApiGateway } from "./graph-api.adapter";
import { createSimulatedInstagramGateway } from "./simulated-gateway";
import { createTokenCipher } from "./token-cipher";

const KEY = Buffer.alloc(32, 9).toString("base64");
const config = {
	appId: "app-1",
	appSecret: "segredo-de-teste",
	redirectUri: "https://app.exemplo.test/api/instagram/callback",
};

type Reply = { status?: number; body: unknown };

/** `fetch` falso: responde em ordem e guarda as URLs pedidas. */
function stubFetch(replies: Reply[]) {
	const urls: string[] = [];
	const bodies: string[] = [];
	const fetchImpl = (async (input: string | URL, init?: RequestInit) => {
		urls.push(String(input));
		bodies.push(String(init?.body ?? ""));
		const reply = replies.shift();
		if (!reply) throw new Error("chamada a mais");
		return Response.json(reply.body, { status: reply.status ?? 200 });
	}) as typeof fetch;
	return { fetchImpl, urls, bodies };
}

const profile = {
	user_id: "17841400000",
	username: "padariadoze",
	name: "Padaria Doze",
	account_type: "BUSINESS",
	biography: "Pães de fermentação natural",
	followers_count: 1200,
	follows_count: 300,
	media_count: 80,
};
const media = {
	data: [
		{
			id: "m1",
			caption: "Fornada de sexta",
			media_type: "VIDEO",
			permalink: "https://www.instagram.com/reel/abc/",
			timestamp: "2026-11-10T12:00:00+0000",
			like_count: 140,
			comments_count: 12,
		},
		{ id: "m2", media_type: "CAROUSEL_ALBUM" },
	],
};

describe("API do Instagram com o login do Instagram", () => {
	it("monta o link de autorização com o app, o retorno, a permissão básica e o state", () => {
		const url = new URL(
			createGraphApiGateway(config).authorizeUrl({
				state: "abc",
				username: "padariadoze",
			}),
		);
		expect(url.origin + url.pathname).toBe(
			"https://www.instagram.com/oauth/authorize",
		);
		expect(Object.fromEntries(url.searchParams)).toEqual({
			client_id: "app-1",
			redirect_uri: config.redirectUri,
			response_type: "code",
			scope: "instagram_business_basic",
			state: "abc",
		});
	});

	it("troca o código pelo token de 60 dias", async () => {
		const { fetchImpl, urls, bodies } = stubFetch([
			{
				body: {
					data: [
						{ access_token: "curto", user_id: 17841400000, permissions: "x" },
					],
				},
			},
			{
				body: {
					access_token: "longo",
					token_type: "bearer",
					expires_in: 5_183_944,
				},
			},
		]);
		const token = await createGraphApiGateway(config, fetchImpl).exchangeCode(
			"codigo",
		);

		expect(token).toMatchObject({
			igUserId: "17841400000",
			accessToken: "longo",
		});
		expect(token.expiresAt.getTime()).toBeGreaterThan(
			Date.now() + 59 * 86_400_000,
		);
		expect(urls[0]).toBe("https://api.instagram.com/oauth/access_token");
		expect(new URLSearchParams(bodies[0])).toMatchObject(
			new URLSearchParams({
				client_id: "app-1",
				client_secret: "segredo-de-teste",
				grant_type: "authorization_code",
				redirect_uri: config.redirectUri,
				code: "codigo",
			}),
		);
		expect(new URL(urls[1] ?? "").searchParams.get("grant_type")).toBe(
			"ig_exchange_token",
		);
	});

	it("aceita a resposta do token sem o envelope data", async () => {
		const { fetchImpl } = stubFetch([
			{ body: { access_token: "curto", user_id: "9" } },
			{ body: { access_token: "longo", expires_in: 100 } },
		]);
		expect(
			(await createGraphApiGateway(config, fetchImpl).exchangeCode("c"))
				.igUserId,
		).toBe("9");
	});

	it("RN-039: lê o perfil e os posts recentes com curtidas e comentários", async () => {
		const { fetchImpl, urls } = stubFetch([{ body: profile }, { body: media }]);
		const snapshot = await createGraphApiGateway(
			config,
			fetchImpl,
		).fetchSnapshot("token", 25);

		expect(snapshot.profile).toEqual({
			username: "padariadoze",
			name: "Padaria Doze",
			biography: "Pães de fermentação natural",
			website: null,
			accountType: "business",
			followersCount: 1200,
			followsCount: 300,
			mediaCount: 80,
			profilePictureUrl: null,
		});
		expect(snapshot.posts).toEqual([
			{
				id: "m1",
				caption: "Fornada de sexta",
				mediaType: "video",
				permalink: "https://www.instagram.com/reel/abc/",
				publishedAt: new Date("2026-11-10T12:00:00Z"),
				likeCount: 140,
				commentsCount: 12,
			},
			{
				id: "m2",
				caption: null,
				mediaType: "carousel",
				permalink: null,
				publishedAt: null,
				likeCount: null,
				commentsCount: null,
			},
		]);
		const mediaUrl = new URL(urls[1] ?? "");
		expect(mediaUrl.pathname).toBe("/v27.0/me/media");
		expect(mediaUrl.searchParams.get("limit")).toBe("25");
	});

	it("se a bio ou o site não existem para a conta, lê só os campos básicos", async () => {
		const { fetchImpl, urls } = stubFetch([
			{ status: 400, body: { error: { code: 100, type: "IGApiException" } } },
			{ body: { ...profile, biography: undefined } },
			{ body: { data: [] } },
		]);
		const snapshot = await createGraphApiGateway(
			config,
			fetchImpl,
		).fetchSnapshot("token", 25);
		expect(snapshot.profile.biography).toBeNull();
		expect(new URL(urls[1] ?? "").searchParams.get("fields")).not.toContain(
			"biography",
		);
	});

	it("RN-036: conta que não é Profissional é recusada", async () => {
		const { fetchImpl } = stubFetch([
			{ body: { ...profile, account_type: "PERSONAL" } },
		]);
		await expect(
			createGraphApiGateway(config, fetchImpl).fetchSnapshot("token", 25),
		).rejects.toMatchObject({ kind: "not_professional" });
	});

	it("token recusado e erro da Meta viram erros do gateway, sem a URL na mensagem", async () => {
		const { fetchImpl } = stubFetch([
			{ status: 400, body: { error: { code: 190, type: "OAuthException" } } },
			{ status: 500, body: {} },
		]);
		const gateway = createGraphApiGateway(config, fetchImpl);

		const refused = await gateway.refreshToken("token-secreto").catch((e) => e);
		expect(refused).toBeInstanceOf(InstagramGatewayError);
		expect(refused.kind).toBe("unauthorized");
		expect(refused.message).not.toContain("token-secreto");
		await expect(gateway.refreshToken("token-secreto")).rejects.toMatchObject({
			kind: "unavailable",
		});
	});
});

describe("criptografia dos tokens", () => {
	it("cifra, decifra e não repete o texto cifrado", () => {
		const cipher = createTokenCipher(KEY);
		const a = cipher.encrypt("token-do-instagram");
		expect(a).not.toContain("token-do-instagram");
		expect(cipher.encrypt("token-do-instagram")).not.toBe(a);
		expect(cipher.decrypt(a)).toBe("token-do-instagram");
	});

	it("recusa texto adulterado ou cifrado com outra chave", () => {
		const stored = createTokenCipher(KEY).encrypt("token");
		const other = createTokenCipher(Buffer.alloc(32, 1).toString("base64"));
		expect(() => other.decrypt(stored)).toThrow();
		expect(() =>
			createTokenCipher(KEY).decrypt(`${stored.slice(0, -4)}AAAA`),
		).toThrow();
	});
});

describe("Instagram simulado e escolha do Instagram", () => {
	it("o simulado volta direto para o app com o @ informado e marca os dados como simulados", async () => {
		const gateway = createSimulatedInstagramGateway();
		const url = new URL(
			gateway.authorizeUrl({ state: "s1", username: "padariadoze" }),
			"http://localhost",
		);
		expect(url.pathname).toBe("/api/instagram/callback");
		const token = await gateway.exchangeCode(
			url.searchParams.get("code") ?? "",
		);
		const snapshot = await gateway.fetchSnapshot(token.accessToken, 3);

		expect(gateway.simulated).toBe(true);
		expect(snapshot.profile.username).toBe("padariadoze");
		expect(snapshot.profile.name).toContain("simulado");
		expect(snapshot.posts).toHaveLength(3);
	});

	it("usa a Meta com o app configurado, o simulado fora de produção e nenhum em produção", () => {
		expect(
			chooseInstagram({
				NODE_ENV: "production",
				INSTAGRAM_APP_ID: "app",
				INSTAGRAM_APP_SECRET: "s",
				INSTAGRAM_REDIRECT_URI: config.redirectUri,
				INSTAGRAM_TOKEN_KEY: KEY,
			}).gateway.simulated,
		).toBe(false);
		expect(chooseInstagram({ NODE_ENV: "development" }).gateway.simulated).toBe(
			true,
		);
		expect(chooseInstagram({ NODE_ENV: "production" }).gateway.configured).toBe(
			false,
		);
	});
});
