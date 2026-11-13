import type { Env } from "@convergia/config";
import type { InstagramGateway } from "@convergia/core";
import { createGraphApiGateway } from "./graph-api.adapter";
import { createSimulatedInstagramGateway } from "./simulated-gateway";
import { createTokenCipher, type TokenCipher } from "./token-cipher";

type InstagramEnv = Pick<Env, "NODE_ENV"> &
	Partial<
		Pick<
			Env,
			| "INSTAGRAM_APP_ID"
			| "INSTAGRAM_APP_SECRET"
			| "INSTAGRAM_REDIRECT_URI"
			| "INSTAGRAM_TOKEN_KEY"
		>
	>;

/** Sem o app da Meta, em produção: a tela avisa que falta configurar. */
const notConfigured: InstagramGateway = {
	configured: false,
	simulated: false,
	authorizeUrl() {
		throw new Error("Instagram não configurado.");
	},
	exchangeCode() {
		throw new Error("Instagram não configurado.");
	},
	refreshToken() {
		throw new Error("Instagram não configurado.");
	},
	fetchSnapshot() {
		throw new Error("Instagram não configurado.");
	},
};

/**
 * Chave fixa só para os tokens do Instagram simulado, que não dão acesso a nada. Com o app da
 * Meta, `INSTAGRAM_TOKEN_KEY` é obrigatória (ver `packages/config`).
 */
const SIMULATED_TOKEN_KEY = Buffer.alloc(
	32,
	"convergia-instagram-simulado",
).toString("base64");

/**
 * Qual Instagram o servidor usa: o da Meta quando o app está configurado; fora de produção, o
 * simulado; em produção sem o app, nenhum.
 */
export function chooseInstagram(env: InstagramEnv): {
	gateway: InstagramGateway;
	cipher: TokenCipher;
	label: string;
} {
	if (
		env.INSTAGRAM_APP_ID &&
		env.INSTAGRAM_APP_SECRET &&
		env.INSTAGRAM_REDIRECT_URI &&
		env.INSTAGRAM_TOKEN_KEY
	) {
		return {
			gateway: createGraphApiGateway({
				appId: env.INSTAGRAM_APP_ID,
				appSecret: env.INSTAGRAM_APP_SECRET,
				redirectUri: env.INSTAGRAM_REDIRECT_URI,
			}),
			cipher: createTokenCipher(env.INSTAGRAM_TOKEN_KEY),
			label: "Meta (login do Instagram)",
		};
	}
	const cipher = createTokenCipher(
		env.INSTAGRAM_TOKEN_KEY ?? SIMULATED_TOKEN_KEY,
	);
	if (env.NODE_ENV === "production") {
		return { gateway: notConfigured, cipher, label: "não configurado" };
	}
	return {
		gateway: createSimulatedInstagramGateway(),
		cipher,
		label: "simulado (falta INSTAGRAM_APP_ID)",
	};
}
