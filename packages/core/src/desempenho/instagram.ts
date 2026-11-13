import { z } from "zod";

/** Posts recentes que a IA lê (✅ RN-039). */
export const RECENT_POSTS_LIMIT = 25;

/** O link de conexão vale por pouco tempo e só uma vez. */
export const CONNECT_LINK_MINUTES = 15;

/** 📎 RN-036: só conta Profissional entra pela API oficial. */
export const INSTAGRAM_ACCOUNT_TYPES = ["business", "creator"] as const;
export type InstagramAccountType = (typeof INSTAGRAM_ACCOUNT_TYPES)[number];

/** ✅ RN-039: o perfil que a IA lê. Campo que o Instagram não devolveu fica `null`. */
export type InstagramProfile = {
	username: string;
	name: string | null;
	biography: string | null;
	website: string | null;
	accountType: InstagramAccountType;
	followersCount: number | null;
	followsCount: number | null;
	mediaCount: number | null;
	profilePictureUrl: string | null;
};

export const INSTAGRAM_MEDIA_TYPES = ["image", "video", "carousel"] as const;
export type InstagramMediaType = (typeof INSTAGRAM_MEDIA_TYPES)[number];

/** ✅ RN-039: legenda e desempenho (curtidas e comentários) de um post recente. */
export type InstagramPost = {
	id: string;
	caption: string | null;
	mediaType: InstagramMediaType | null;
	permalink: string | null;
	publishedAt: Date | null;
	likeCount: number | null;
	commentsCount: number | null;
};

/** O que foi lido do Instagram numa coleta: é o contexto da marca para a IA (✅ RN-032). */
export type InstagramSnapshot = {
	profile: InstagramProfile;
	posts: InstagramPost[];
	collectedAt: Date;
};

/** Conexão do Instagram de uma empresa, sem o token (que só o repositório conhece). */
export type InstagramConnection = {
	companyId: string;
	igUserId: string;
	username: string;
	connectedByUserId: string;
	connectedAt: Date;
	tokenExpiresAt: Date;
	/** Conectado pelo Instagram simulado do ambiente de desenvolvimento. */
	simulated: boolean;
	snapshot: InstagramSnapshot | null;
};

/** Normaliza o @: sem o "@", em minúsculas. */
export function normalizeHandle(handle: string): string {
	return handle.trim().replace(/^@/, "").toLowerCase();
}

/** ✅ RN-035: o cliente informa o @ da empresa antes de entrar pela Meta. */
export const connectInstagramInput = z.object({
	username: z
		.string()
		.transform(normalizeHandle)
		.pipe(
			z
				.string()
				.regex(/^[a-z0-9._]{1,30}$/, "Informe o @ da empresa no Instagram."),
		)
		.describe('O @ da empresa no Instagram, ex.: "padariadoze"'),
});
export type ConnectInstagramInput = z.infer<typeof connectInstagramInput>;
