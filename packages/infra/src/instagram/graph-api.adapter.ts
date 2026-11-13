import {
	type InstagramAccountType,
	type InstagramGateway,
	InstagramGatewayError,
	type InstagramMediaType,
	type InstagramPost,
	type InstagramProfile,
} from "@convergia/core";
import { z } from "zod";

/** API do Instagram com o login do Instagram (stack §5). */
const AUTHORIZE_URL = "https://www.instagram.com/oauth/authorize";
const TOKEN_URL = "https://api.instagram.com/oauth/access_token";
const GRAPH = "https://graph.instagram.com";
const VERSION = "v27.0";
/** ✅ RN-039: perfil, legendas e curtidas e comentários. Insights ficam de fora. */
const SCOPES = ["instagram_business_basic"];
const TIMEOUT_MS = 15_000;

/** Campos do perfil: os opcionais podem não existir para todo tipo de conta. */
const BASE_PROFILE_FIELDS = [
	"user_id",
	"username",
	"name",
	"account_type",
	"profile_picture_url",
	"followers_count",
	"follows_count",
	"media_count",
];
const EXTRA_PROFILE_FIELDS = ["biography", "website"];
const MEDIA_FIELDS = [
	"id",
	"caption",
	"media_type",
	"permalink",
	"timestamp",
	"like_count",
	"comments_count",
];

const optionalString = z
	.string()
	.nullish()
	.transform((v) => v || null);
const optionalNumber = z
	.number()
	.nullish()
	.transform((v) => v ?? null);

const shortToken = z.union([
	z.object({
		data: z
			.array(
				z.object({
					access_token: z.string(),
					user_id: z.union([z.string(), z.number()]),
				}),
			)
			.min(1),
	}),
	z.object({
		access_token: z.string(),
		user_id: z.union([z.string(), z.number()]),
	}),
]);
const longToken = z.object({
	access_token: z.string(),
	expires_in: z.number(),
});
const profileResponse = z.object({
	username: z.string(),
	name: optionalString,
	account_type: z.string().nullish(),
	biography: optionalString,
	website: optionalString,
	profile_picture_url: optionalString,
	followers_count: optionalNumber,
	follows_count: optionalNumber,
	media_count: optionalNumber,
});
const mediaResponse = z.object({
	data: z.array(
		z.object({
			id: z.string(),
			caption: optionalString,
			media_type: z.string().nullish(),
			permalink: optionalString,
			timestamp: optionalString,
			like_count: optionalNumber,
			comments_count: optionalNumber,
		}),
	),
});
const errorBody = z.object({
	error: z
		.object({
			code: z.number().optional(),
			type: z.string().optional(),
		})
		.optional(),
	error_type: z.string().optional(),
});

const ACCOUNT_TYPES: Record<string, InstagramAccountType> = {
	BUSINESS: "business",
	MEDIA_CREATOR: "creator",
	CREATOR: "creator",
};
const MEDIA_TYPES: Record<string, InstagramMediaType> = {
	IMAGE: "image",
	VIDEO: "video",
	CAROUSEL_ALBUM: "carousel",
};

/** Erro de campo inexistente (código 100): tenta de novo só com os campos básicos. */
class UnknownField extends Error {}

export type GraphApiConfig = {
	appId: string;
	appSecret: string;
	redirectUri: string;
};

export function createGraphApiGateway(
	config: GraphApiConfig,
	fetchImpl: typeof fetch = fetch,
): InstagramGateway {
	async function call<T>(
		url: URL | string,
		schema: z.ZodType<T>,
		init?: RequestInit,
	): Promise<T> {
		let response: Response;
		try {
			response = await fetchImpl(url, {
				...init,
				signal: AbortSignal.timeout(TIMEOUT_MS),
			});
		} catch {
			throw new InstagramGatewayError(
				"unavailable",
				"Sem resposta do Instagram",
			);
		}
		const body: unknown = await response.json().catch(() => null);
		if (!response.ok) {
			// Nunca registra a URL: ela leva o token.
			const parsed = errorBody.safeParse(body);
			const code = parsed.success ? parsed.data.error?.code : undefined;
			if (code === 100) throw new UnknownField();
			if (response.status === 401 || code === 190) {
				throw new InstagramGatewayError(
					"unauthorized",
					`Instagram recusou o acesso (HTTP ${response.status})`,
				);
			}
			throw new InstagramGatewayError(
				"unavailable",
				`Instagram respondeu HTTP ${response.status}${code ? ` (código ${code})` : ""}`,
			);
		}
		const parsed = schema.safeParse(body);
		if (!parsed.success) {
			throw new InstagramGatewayError(
				"unavailable",
				"Resposta do Instagram em formato inesperado",
			);
		}
		return parsed.data;
	}

	function graphUrl(path: string, params: Record<string, string>): URL {
		const url = new URL(`${GRAPH}/${VERSION}/${path}`);
		for (const [key, value] of Object.entries(params)) {
			url.searchParams.set(key, value);
		}
		return url;
	}

	async function fetchProfile(accessToken: string): Promise<InstagramProfile> {
		const get = (fields: string[]) =>
			call(
				graphUrl("me", {
					fields: fields.join(","),
					access_token: accessToken,
				}),
				profileResponse,
			);
		let raw: z.infer<typeof profileResponse>;
		try {
			raw = await get([...BASE_PROFILE_FIELDS, ...EXTRA_PROFILE_FIELDS]);
		} catch (error) {
			if (!(error instanceof UnknownField)) throw error;
			raw = await get(BASE_PROFILE_FIELDS);
		}
		const accountType = ACCOUNT_TYPES[(raw.account_type ?? "").toUpperCase()];
		if (!accountType) {
			throw new InstagramGatewayError(
				"not_professional",
				"A conta não é Profissional",
			);
		}
		return {
			username: raw.username,
			name: raw.name,
			biography: raw.biography ?? null,
			website: raw.website ?? null,
			accountType,
			followersCount: raw.followers_count,
			followsCount: raw.follows_count,
			mediaCount: raw.media_count,
			profilePictureUrl: raw.profile_picture_url,
		};
	}

	async function fetchPosts(
		accessToken: string,
		limit: number,
	): Promise<InstagramPost[]> {
		const { data } = await call(
			graphUrl("me/media", {
				fields: MEDIA_FIELDS.join(","),
				limit: String(limit),
				access_token: accessToken,
			}),
			mediaResponse,
		);
		return data.slice(0, limit).map((media) => ({
			id: media.id,
			caption: media.caption,
			mediaType: MEDIA_TYPES[media.media_type ?? ""] ?? null,
			permalink: media.permalink,
			publishedAt: media.timestamp ? new Date(media.timestamp) : null,
			likeCount: media.like_count,
			commentsCount: media.comments_count,
		}));
	}

	const expiresAt = (seconds: number) => new Date(Date.now() + seconds * 1000);

	return {
		configured: true,
		simulated: false,

		authorizeUrl({ state }) {
			const url = new URL(AUTHORIZE_URL);
			url.searchParams.set("client_id", config.appId);
			url.searchParams.set("redirect_uri", config.redirectUri);
			url.searchParams.set("response_type", "code");
			url.searchParams.set("scope", SCOPES.join(","));
			url.searchParams.set("state", state);
			return url.toString();
		},

		async exchangeCode(code) {
			const short = await call(TOKEN_URL, shortToken, {
				method: "POST",
				body: new URLSearchParams({
					client_id: config.appId,
					client_secret: config.appSecret,
					grant_type: "authorization_code",
					redirect_uri: config.redirectUri,
					code,
				}),
			});
			const first = "data" in short ? short.data[0] : short;
			if (!first) {
				throw new InstagramGatewayError("unavailable", "Token não veio");
			}
			const long = await call(
				graphUrl("access_token", {
					grant_type: "ig_exchange_token",
					client_secret: config.appSecret,
					access_token: first.access_token,
				}),
				longToken,
			);
			return {
				igUserId: String(first.user_id),
				accessToken: long.access_token,
				expiresAt: expiresAt(long.expires_in),
			};
		},

		async refreshToken(accessToken) {
			const refreshed = await call(
				graphUrl("refresh_access_token", {
					grant_type: "ig_refresh_token",
					access_token: accessToken,
				}),
				longToken,
			);
			return {
				accessToken: refreshed.access_token,
				expiresAt: expiresAt(refreshed.expires_in),
			};
		},

		async fetchSnapshot(accessToken, limit) {
			const profile = await fetchProfile(accessToken);
			return { profile, posts: await fetchPosts(accessToken, limit) };
		},
	};
}
